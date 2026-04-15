"""
Peer Checker - Evalúa canales AceStream por peers activos.
Todos los canales se incluyen en la playlist, ordenados y marcados:
  🟢  3+ peers   → canal probablemente funcional ahora mismo
  🟡  1-2 peers  → canal con actividad baja
  🔴  0 peers    → sin actividad (puede funcionar más tarde)
"""

import asyncio
import aiohttp
import re
import os
import time
import logging
import threading
from datetime import datetime
from flask import Flask, Response, jsonify, request

# ─── Config ────────────────────────────────────────────────────────────────────
PROXY_HOST     = os.environ.get("PROXY_HOST",     "httproxy")
PROXY_PORT     = os.environ.get("PROXY_PORT",     "8888")
LISTEN_PORT    = int(os.environ.get("LISTEN_PORT", "8889"))
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", "300"))
CONCURRENCY    = int(os.environ.get("CONCURRENCY",   "20"))
PEER_TIMEOUT   = int(os.environ.get("PEER_TIMEOUT",  "12"))
SOURCE_PATH    = os.environ.get("SOURCE_PATH",    "/aio")

BASE_URL = f"http://{PROXY_HOST}:{PROXY_PORT}"

PEERS_GREEN  = 3
PEERS_YELLOW = 1

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)

# ─── Estado global ─────────────────────────────────────────────────────────────
state = {
    "m3u":         None,
    "last_update": None,
    "total":       0,
    "green":       0,
    "yellow":      0,
    "red":         0,
    "status":      "starting",
    "running":     False,
    "channel_log": [],
}
state_lock = threading.Lock()

app = Flask(__name__)

# ─── Helpers ───────────────────────────────────────────────────────────────────

def peer_tier(peers: int) -> tuple:
    if peers >= PEERS_GREEN:
        return "🟢", "green", 0
    elif peers >= PEERS_YELLOW:
        return "🟡", "yellow", 1
    else:
        return "🔴", "red", 2


def inject_emoji_into_extinf(extinf: str, emoji: str) -> str:
    if "," in extinf:
        prefix, name = extinf.rsplit(",", 1)
        return f"{prefix},{emoji} {name.strip()}"
    return f"{extinf} {emoji}"


def extract_content_id(url: str):
    m = re.search(r"/content_id/([a-f0-9]+)/", url)
    return m.group(1) if m else None


def parse_m3u(text: str) -> tuple:
    lines = [l.rstrip() for l in text.splitlines()]
    if not lines:
        return "", []

    header = lines[0] if lines[0].startswith("#EXTM3U") else "#EXTM3U"
    channels = []
    i = 1

    while i < len(lines):
        line = lines[i]
        if not line.startswith("#EXTINF"):
            i += 1
            continue

        extinf = line
        name = extinf.rsplit(",", 1)[-1].strip() if "," in extinf else ""
        gm = re.search(r'group-title="([^"]*)"', extinf)
        group = gm.group(1) if gm else ""

        extgrp = None
        url = None
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if nxt.startswith("#EXTGRP"):
                extgrp = nxt
            elif nxt.startswith("http"):
                url = nxt
                i += 1
                break
            elif nxt.startswith("#EXTINF"):
                break
            i += 1

        channels.append({"extinf": extinf, "extgrp": extgrp,
                         "url": url, "name": name, "group": group})

    return header, channels

# ─── Peer checking ─────────────────────────────────────────────────────────────

async def check_channel(session, ch, semaphore):
    cid = extract_content_id(ch["url"]) if ch.get("url") else None

    if not cid:
        return {**ch, "peers": -1, "emoji": "🔴", "tier": "red", "sort": 2, "error": "no_content_id"}

    async with semaphore:
        check_url = f"{BASE_URL}/statplugin?action=check_peers&content_id={cid}"
        try:
            async with session.get(check_url, timeout=aiohttp.ClientTimeout(total=PEER_TIMEOUT)) as resp:
                data = await resp.json(content_type=None)
            peers = data.get("total_peers", 0)
            emoji, tier, sort = peer_tier(peers)
            return {**ch, "peers": peers, "emoji": emoji, "tier": tier, "sort": sort, "error": None}
        except asyncio.TimeoutError:
            return {**ch, "peers": -1, "emoji": "🔴", "tier": "red", "sort": 2, "error": "timeout"}
        except Exception as e:
            return {**ch, "peers": -1, "emoji": "🔴", "tier": "red", "sort": 2, "error": str(e)}


async def _run_check_async():
    t0 = time.time()
    logger.info("▶ Peer check starting…")

    with state_lock:
        state["status"]  = "checking"
        state["running"] = True

    try:
        connector = aiohttp.TCPConnector(limit=CONCURRENCY + 5)
        async with aiohttp.ClientSession(connector=connector) as session:

            src_url = f"{BASE_URL}{SOURCE_PATH}"
            logger.info(f"  Fetching {src_url}")
            async with session.get(src_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                m3u_text = await resp.text()

            header, channels = parse_m3u(m3u_text)
            total = len(channels)
            logger.info(f"  {total} canales — lanzando checks…")

            semaphore = asyncio.Semaphore(CONCURRENCY)
            tasks = [check_channel(session, ch, semaphore) for ch in channels]
            results = await asyncio.gather(*tasks)

        # Ordenar: verde → amarillo → rojo, preservando orden original dentro de cada grupo
        indexed = list(enumerate(results))
        sorted_results = [r for _, r in sorted(indexed, key=lambda x: (x[1]["sort"], x[0]))]

        # Construir M3U con emojis inyectados
        lines = [header]
        for ch in sorted_results:
            lines.append(inject_emoji_into_extinf(ch["extinf"], ch["emoji"]))
            if ch.get("extgrp"):
                lines.append(ch["extgrp"])
            if ch.get("url"):
                lines.append(ch["url"])
        m3u_out = "\n".join(lines) + "\n"

        green  = sum(1 for r in results if r["tier"] == "green")
        yellow = sum(1 for r in results if r["tier"] == "yellow")
        red    = sum(1 for r in results if r["tier"] == "red")

        elapsed = round(time.time() - t0, 1)
        logger.info(f"✔ Listo en {elapsed}s — 🟢 {green}  🟡 {yellow}  🔴 {red}  (total {total})")

        channel_log = [
            {"name": r["name"], "group": r["group"], "peers": r["peers"],
             "tier": r["tier"], "emoji": r["emoji"], "error": r.get("error")}
            for r in sorted_results
        ]

        with state_lock:
            state["m3u"]         = m3u_out
            state["last_update"] = time.time()
            state["total"]       = total
            state["green"]       = green
            state["yellow"]      = yellow
            state["red"]         = red
            state["status"]      = "ok"
            state["channel_log"] = channel_log

    except Exception as exc:
        logger.error(f"✖ Check failed: {exc}", exc_info=True)
        with state_lock:
            state["status"] = f"error: {exc}"
    finally:
        with state_lock:
            state["running"] = False


def run_check():
    asyncio.run(_run_check_async())


def _background_loop():
    while True:
        run_check()
        logger.info(f"  Próximo refresh en {CHECK_INTERVAL}s")
        time.sleep(CHECK_INTERVAL)

# ─── Rutas HTTP ────────────────────────────────────────────────────────────────

@app.route("/aio_filtered")
def aio_filtered():
    with state_lock:
        m3u  = state["m3u"]
        stat = state["status"]
    if m3u is None:
        return Response(f"# No disponible aún (estado: {stat})\n# Reintenta en unos segundos.",
                        status=503, mimetype="application/x-mpegurl")
    return Response(m3u, mimetype="application/x-mpegurl",
                    headers={"Content-Disposition": "inline; filename=peer_checked.m3u"})


@app.route("/status")
def status():
    with state_lock:
        s = dict(state)
    last = (datetime.fromtimestamp(s["last_update"]).strftime("%Y-%m-%d %H:%M:%S")
            if s["last_update"] else None)
    return jsonify({
        "status": s["status"], "running": s["running"], "last_update": last,
        "total_channels": s["total"], "green": s["green"],
        "yellow": s["yellow"], "red": s["red"],
        "check_interval_s": CHECK_INTERVAL, "concurrency": CONCURRENCY,
        "source": f"{BASE_URL}{SOURCE_PATH}",
    })


@app.route("/channels")
def channels():
    tier_filter  = request.args.get("tier")
    group_filter = request.args.get("group")
    with state_lock:
        log = list(state["channel_log"])
    if tier_filter:
        log = [c for c in log if c["tier"] == tier_filter]
    if group_filter:
        log = [c for c in log if c["group"].lower() == group_filter.lower()]
    return jsonify({"count": len(log), "channels": log})


@app.route("/refresh", methods=["GET", "POST"])
def refresh():
    with state_lock:
        already = state["running"]
    if already:
        return jsonify({"message": "Ya hay un check en curso, espera."}), 409
    threading.Thread(target=run_check, daemon=True, name="manual-refresh").start()
    return jsonify({"message": "Refresh iniciado."})


@app.route("/")
def index():
    with state_lock:
        s = dict(state)

    last  = (datetime.fromtimestamp(s["last_update"]).strftime("%Y-%m-%d %H:%M:%S")
             if s["last_update"] else "nunca")
    total = s["total"] or 1
    pct_g = round(s["green"]  / total * 100)
    pct_y = round(s["yellow"] / total * 100)
    pct_r = round(s["red"]    / total * 100)
    status_color = ("#22c55e" if s["status"] == "ok" else
                    "#f59e0b" if s["status"] == "checking" else "#ef4444")

    rows = ""
    for ch in s["channel_log"]:
        peers_txt = str(ch["peers"]) if ch["peers"] >= 0 else "—"
        err = (f'<span style="color:#64748b;font-size:.75rem"> ({ch["error"]})</span>'
               if ch.get("error") else "")
        rows += (f'<tr>'
                 f'<td>{ch["emoji"]}</td>'
                 f'<td>{ch["group"]}</td>'
                 f'<td>{ch["name"]}{err}</td>'
                 f'<td style="text-align:center">{peers_txt}</td>'
                 f'</tr>\n')

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Peer Checker</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:1.5rem}}
    h1{{font-size:1.4rem;margin-bottom:1.2rem;color:#f8fafc}}
    .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.8rem;margin-bottom:1rem}}
    .stat{{background:#1e293b;border-radius:10px;padding:1rem;text-align:center}}
    .stat .val{{font-size:2rem;font-weight:700}}
    .stat .lbl{{font-size:.75rem;color:#94a3b8;margin-top:.25rem}}
    .card{{background:#1e293b;border-radius:10px;padding:1.2rem;margin-bottom:.8rem}}
    .bars{{display:flex;height:10px;border-radius:5px;overflow:hidden;margin:.6rem 0}}
    .bar-g{{background:#22c55e;width:{pct_g}%}}
    .bar-y{{background:#f59e0b;width:{pct_y}%}}
    .bar-r{{background:#ef4444;width:{pct_r}%}}
    .badge{{display:inline-block;padding:.2rem .65rem;border-radius:999px;font-size:.75rem;font-weight:600;background:{status_color};color:#fff}}
    .actions{{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.8rem}}
    .btn{{padding:.55rem 1.2rem;border-radius:8px;font-size:.85rem;color:#fff;text-decoration:none;cursor:pointer;border:none}}
    .btn-blue{{background:#3b82f6}}.btn-blue:hover{{background:#2563eb}}
    .btn-green{{background:#16a34a}}.btn-green:hover{{background:#15803d}}
    .btn-purple{{background:#7c3aed}}.btn-purple:hover{{background:#6d28d9}}
    pre{{background:#0f172a;padding:.8rem;border-radius:8px;font-size:.8rem;overflow-x:auto;margin-top:.5rem;color:#94a3b8}}
    table{{width:100%;border-collapse:collapse;font-size:.82rem;margin-top:.5rem}}
    th{{text-align:left;padding:.4rem .6rem;color:#64748b;border-bottom:1px solid #334155;font-weight:500}}
    td{{padding:.35rem .6rem;border-bottom:1px solid #0f172a;vertical-align:middle}}
    tr:last-child td{{border-bottom:none}}
    tr:hover td{{background:#243044}}
    input[type=text]{{background:#0f172a;border:1px solid #334155;border-radius:6px;padding:.4rem .7rem;color:#e2e8f0;font-size:.82rem;width:220px}}
    .legend{{font-size:.78rem;color:#94a3b8;display:flex;gap:1rem;margin-top:.4rem;flex-wrap:wrap}}
  </style>
</head>
<body>
  <h1>📡 Peer Checker</h1>

  <div class="grid">
    <div class="stat"><div class="val">{s['total']}</div><div class="lbl">Total canales</div></div>
    <div class="stat"><div class="val" style="color:#22c55e">{s['green']}</div><div class="lbl">🟢 3+ peers</div></div>
    <div class="stat"><div class="val" style="color:#f59e0b">{s['yellow']}</div><div class="lbl">🟡 1-2 peers</div></div>
    <div class="stat"><div class="val" style="color:#ef4444">{s['red']}</div><div class="lbl">🔴 0 peers</div></div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
      <span>Estado: <span class="badge">{s['status']}</span></span>
      <span style="font-size:.82rem;color:#94a3b8">Última actualización: <strong style="color:#e2e8f0">{last}</strong></span>
    </div>
    <div class="bars" style="margin-top:.8rem"><div class="bar-g"></div><div class="bar-y"></div><div class="bar-r"></div></div>
    <div class="legend">
      <span>🟢 {pct_g}% funcionales</span>
      <span>🟡 {pct_y}% baja actividad</span>
      <span>🔴 {pct_r}% sin peers</span>
    </div>
    <p style="font-size:.78rem;color:#64748b;margin-top:.5rem">Refresco automático cada {CHECK_INTERVAL}s · Concurrencia {CONCURRENCY} checks simultáneos</p>
  </div>

  <div class="actions">
    <a href="/aio_filtered" class="btn btn-green">⬇ Descargar playlist</a>
    <a href="/refresh" class="btn btn-blue" onclick="this.textContent='⏳ Refreshing…'">🔄 Refresh ahora</a>
    <a href="/channels" class="btn btn-purple">📋 JSON canales</a>
  </div>

  <div class="card">
    <p style="font-size:.82rem;color:#94a3b8;margin-bottom:.4rem">URL para tu cliente IPTV:</p>
    <pre>http://&lt;ip-raspberry&gt;:8889/aio_filtered</pre>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem">
      <span style="font-weight:600">Canales ({s['total']})</span>
      <input type="text" id="search" placeholder="Filtrar por nombre o grupo…" oninput="filterTable(this.value)">
    </div>
    <table id="tbl">
      <thead><tr><th></th><th>Grupo</th><th>Canal</th><th>Peers</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>

  <script>
    function filterTable(q) {{
      q = q.toLowerCase();
      document.querySelectorAll('#tbl tbody tr').forEach(tr => {{
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      }});
    }}
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>"""
    return Response(html, mimetype="text/html")


# ─── Arranque ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info(f"Peer Checker arrancando — puerto {LISTEN_PORT}")
    logger.info(f"  Fuente    : {BASE_URL}{SOURCE_PATH}")
    logger.info(f"  Intervalo : {CHECK_INTERVAL}s   Concurrencia: {CONCURRENCY}")
    logger.info(f"  Umbrales  : 🟢 >={PEERS_GREEN} peers  🟡 >={PEERS_YELLOW} peers  🔴 <{PEERS_YELLOW} peers")

    threading.Thread(target=_background_loop, daemon=True, name="bg-checker").start()
    app.run(host="0.0.0.0", port=LISTEN_PORT, threaded=True)
