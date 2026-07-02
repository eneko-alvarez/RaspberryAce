const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const PROXY_HOST = process.env.PROXY_HOST || 'httproxy';
const PROXY_PORT = process.env.PROXY_PORT || '8888';
const HLS_DIR = '/tmp/hls';

const SUBGROUP_RULES = [
  { group: 'Deportes', label: 'DAZN', patterns: ['dazn'] },
  { group: 'Deportes', label: 'Movistar', patterns: ['movistar', 'vamos', 'm\\+'] },
  { group: 'Deportes', label: 'LaLiga', patterns: ['laliga', 'la liga', 'hypermotion', 'liga ea'] },
  { group: 'Deportes', label: 'Champions', patterns: ['champions', 'liga de campeones', 'uefa'] },
  { group: 'Deportes', label: 'Mundial', patterns: ['mundial', 'world cup', 'copa mundial'] },
  { group: 'Deportes', label: 'Copa del Rey', patterns: ['copa del rey'] },
  { group: 'Deportes', label: 'Primera RFEF', patterns: ['primera rfef', '1 rfef'] },
  { group: 'Deportes', label: 'Formula 1', patterns: ['f1', 'formula 1', 'formula uno'] },
  { group: 'Deportes', label: 'MotoGP', patterns: ['motogp', 'moto gp'] },
  { group: 'Deportes', label: 'Tenis', patterns: ['tenis', 'tennis'] },
  { group: 'Deportes', label: 'Basket', patterns: ['basket', 'baloncesto', 'nba', 'acb', 'euroleague'] },
  { group: 'Deportes', label: 'Golf', patterns: ['golf'] },
  { group: 'Deportes', label: 'UFC', patterns: ['ufc', 'mma'] },
  { group: 'Deportes', label: 'Eurosport', patterns: ['eurosport'] },
  { group: 'Deportes', label: 'ESPN', patterns: ['espn'] },
  { group: 'Deportes', label: 'beIN Sports', patterns: ['bein'] },
  { group: 'Deportes', label: 'Sky Sports', patterns: ['sky sport', 'sky sports'] },
  { group: 'Deportes', label: 'BT Sport', patterns: ['bt sport', 'bt sports', 'tnt sports'] },
  { group: 'Deportes', label: 'Sport TV', patterns: ['sport tv'] },
  { group: 'Deportes', label: 'Viaplay', patterns: ['viaplay'] },
  { group: 'Deportes', label: 'Eventos', patterns: ['evento', 'eventos', 'ppv', 'multi', 'directo'] },

  { group: 'Cine y Series', label: 'Movistar', patterns: ['movistar', 'm\\+'] },
  { group: 'Cine y Series', label: 'HBO', patterns: ['hbo'] },
  { group: 'Cine y Series', label: 'AMC', patterns: ['amc'] },
  { group: 'Cine y Series', label: 'AXN', patterns: ['axn'] },
  { group: 'Cine y Series', label: 'TNT', patterns: ['tnt'] },
  { group: 'Cine y Series', label: 'Warner', patterns: ['warner'] },
  { group: 'Cine y Series', label: 'Paramount', patterns: ['paramount'] },
  { group: 'Cine y Series', label: 'Comedia', patterns: ['comedy', 'comedia'] },
  { group: 'Cine y Series', label: 'Series', patterns: ['series', 'serie'] },

  { group: 'Infantil', label: 'Disney', patterns: ['disney'] },
  { group: 'Infantil', label: 'Nickelodeon', patterns: ['nick', 'nickelodeon'] },
  { group: 'Infantil', label: 'Cartoon Network', patterns: ['cartoon'] },
  { group: 'Infantil', label: 'Clan', patterns: ['clan'] },
  { group: 'Infantil', label: 'Boing', patterns: ['boing'] },

  { group: 'Documentales', label: 'Discovery', patterns: ['discovery'] },
  { group: 'Documentales', label: 'National Geographic', patterns: ['nat geo', 'national geographic'] },
  { group: 'Documentales', label: 'Historia', patterns: ['history', 'historia'] },
  { group: 'Documentales', label: 'Viajes', patterns: ['travel', 'viajar', 'viajes'] },

  { group: 'Noticias', label: '24h', patterns: ['24h', '24 horas'] },
  { group: 'Noticias', label: 'CNN', patterns: ['cnn'] },
  { group: 'Noticias', label: 'Euronews', patterns: ['euronews'] },
  { group: 'Noticias', label: 'BBC', patterns: ['bbc'] },

  { group: 'Musica', label: 'MTV', patterns: ['mtv'] },
  { group: 'Musica', label: 'VH1', patterns: ['vh1'] },
  { group: 'Musica', label: 'Radio', patterns: ['radio'] },

  { group: 'Regional', label: 'Andalucia', patterns: ['andalucia', 'canal sur'] },
  { group: 'Regional', label: 'Catalunya', patterns: ['catalunya', 'cataluna', 'tv3', '3cat'] },
  { group: 'Regional', label: 'Madrid', patterns: ['madrid', 'telemadrid'] },
  { group: 'Regional', label: 'Galicia', patterns: ['galicia', 'tvg'] },
  { group: 'Regional', label: 'Euskadi', patterns: ['euskadi', 'etb'] },
  { group: 'Regional', label: 'Valencia', patterns: ['valencia', 'apunt', 'a punt'] },
];

const MAIN_GROUPS = new Set([
  'deportes',
  'generalistas',
  'noticias',
  'cine y series',
  'infantil',
  'documentales',
  'musica',
  'regional',
  'internacional',
  'adultos',
  'religion',
  'otros',
]);

const GENERIC_SUBGROUPS = new Set([
  'sport',
  'sports',
  'deporte',
  'deportes',
  'movies',
  'movie',
  'cine',
  'series',
  'kids',
  'infantil',
  'regional',
  'general',
  'tv',
  'canales',
  'channels',
  'otros',
  'other',
  'unknown',
  'sin grupo',
  'educational',
  'entertaining',
  'informational',
  'documentaries',
  'documentary',
  'music',
  'musica',
  'fashion',
  'amateur',
  'acepl',
  'newera',
  'elcano',
  'misterchire',
  'af1c1onados',
]);

app.use(express.json());

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const activeStreams = {};

setInterval(() => {
  const now = Date.now();
  for (const [id, stream] of Object.entries(activeStreams)) {
    if (now - stream.lastAccess > 120000) {
      console.log(`Stopping idle stream: ${id}`);
      stream.process.kill();
      fs.rmSync(stream.dir, { recursive: true, force: true });
      delete activeStreams[id];
    }
  }
}, 30000);

// Fetch raw M3U from httproxy
function fetchM3U() {
  return new Promise((resolve, reject) => {
    http.get(`http://${PROXY_HOST}:${PROXY_PORT}/aio`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Parse M3U and return structured JSON
// Handles #EXTGRP lines between #EXTINF and URL
app.get('/api/channels', async (req, res) => {
  try {
    const m3u = await fetchM3U();
    const lines = m3u.split('\n').map(l => l.trim()).filter(Boolean);
    const channels = [];

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXTINF')) continue;

      const infLine = lines[i];

      // Extract fields from #EXTINF
      const nameMatch = infLine.match(/,(.+)$/);
      const groupMatch = infLine.match(/group-title="([^"]*)"/);
      const rawGroupMatch = infLine.match(/raw-group="([^"]*)"/);
      const logoMatch = infLine.match(/tvg-logo="([^"]*)"/);
      const tvgIdMatch = infLine.match(/tvg-id="([^"]*)"/);

      // Find next non-# line (the URL), skipping #EXTGRP etc.
      let url = null;
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (!lines[j].startsWith('#')) { url = lines[j]; break; }
      }

      if (!url || !nameMatch) continue;

      // Replace internal docker hostname with the server's own proxy
      // The stream endpoint will fetch server-side, so we just store the original URL
      // but rewrite httproxy -> PROXY_HOST (already correct for server-side fetch)
      const name = nameMatch[1].trim();
      const group = groupMatch ? groupMatch[1] : 'Sin grupo';
      const rawGroup = rawGroupMatch ? rawGroupMatch[1] : group;
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : null;
      const contentId = extractContentId(url);
      const subgroups = inferSubgroups(group, name, tvgId, rawGroup);

      channels.push({
        name: nameMatch[1].trim(),
        group,
        rawGroup,
        subgroups,
        logo: logoMatch ? logoMatch[1] : null,
        tvgId,
        contentId,
        // Encode original internal URL for use with /stream/:id endpoint
        streamId: Buffer.from(url).toString('base64')
      });
    }

    const grouped = {};
    const subgrouped = {};
    for (const ch of channels) {
      if (!grouped[ch.group]) grouped[ch.group] = [];
      grouped[ch.group].push(ch);
      if (!subgrouped[ch.group]) subgrouped[ch.group] = {};
      for (const subgroup of ch.subgroups) {
        if (!subgrouped[ch.group][subgroup]) subgrouped[ch.group][subgroup] = [];
        subgrouped[ch.group][subgroup].push(ch);
      }
    }

    res.json({ channels, grouped, subgrouped: orderSubgrouped(subgrouped), total: channels.length });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/custom-channel', (req, res) => {
  const rawInput = String(req.body?.id || '').trim();
  const contentId = normalizeAceContentId(rawInput);

  if (!contentId) {
    return res.status(400).json({ error: 'Introduce un content id AceStream válido' });
  }

  const channelUrl = `http://${PROXY_HOST}:${PROXY_PORT}/content_id/${contentId}/stream.ts`;
  res.json({
    name: `Custom ${contentId.slice(0, 8)}`,
    group: 'Custom',
    rawGroup: 'Manual',
    subgroups: ['Manual'],
    logo: null,
    tvgId: null,
    contentId,
    streamId: Buffer.from(channelUrl).toString('base64')
  });
});

// Start or reuse HLS stream
app.get('/stream/:channelId/index.m3u8', (req, res) => {
  const { channelId } = req.params;
  let channelUrl;
  try {
    channelUrl = Buffer.from(channelId, 'base64').toString('utf8');
  } catch {
    return res.status(400).send('Invalid channel ID');
  }

  const streamDir = path.join(HLS_DIR, channelId);
  const playlistPath = path.join(streamDir, 'index.m3u8');

  if (activeStreams[channelId]) {
    activeStreams[channelId].lastAccess = Date.now();
    waitForFile(playlistPath, 15000)
      .then(() => res.sendFile(playlistPath))
      .catch(() => res.status(504).send('Stream timeout'));
    return;
  }

  fs.mkdirSync(streamDir, { recursive: true });
  console.log(`Starting stream: ${channelUrl}`);

  const ffmpeg = spawn('ffmpeg', [
    '-re', '-i', channelUrl,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(streamDir, 'seg%03d.ts'),
    playlistPath
  ]);

  ffmpeg.stderr.on('data', d => process.stdout.write(d));
  ffmpeg.on('exit', code => {
    console.log(`ffmpeg exit (${code}) for ${channelId}`);
    delete activeStreams[channelId];
  });

  activeStreams[channelId] = { process: ffmpeg, lastAccess: Date.now(), dir: streamDir };

  waitForFile(playlistPath, 15000)
    .then(() => res.sendFile(playlistPath))
    .catch(() => res.status(504).send('Stream timeout'));
});

app.get('/stream/:channelId/:segment', (req, res) => {
  const { channelId, segment } = req.params;
  if (activeStreams[channelId]) activeStreams[channelId].lastAccess = Date.now();
  res.sendFile(path.join(HLS_DIR, channelId, segment));
});

app.use(express.static(path.join(__dirname, 'public')));

function waitForFile(filePath, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (fs.existsSync(filePath)) return resolve();
      if (Date.now() - start > timeout) return reject();
      setTimeout(check, 500);
    };
    check();
  });
}

function normalizeAceContentId(input) {
  if (!input) return null;

  let candidate = input;
  try {
    const parsed = new URL(input);
    if (parsed.protocol === 'acestream:') {
      candidate = parsed.hostname || parsed.pathname.replace(/^\/+/, '');
    } else if (parsed.searchParams.has('id')) {
      candidate = parsed.searchParams.get('id');
    } else if (parsed.searchParams.has('infohash')) {
      candidate = parsed.searchParams.get('infohash');
    } else {
      const match = parsed.pathname.match(/\/(?:content_id|pid|infohash)\/([^/]+)/);
      if (match) candidate = match[1];
    }
  } catch {
    candidate = input.replace(/^acestream:\/\//i, '');
  }

  candidate = String(candidate).trim();
  return /^[a-fA-F0-9]{40}$/.test(candidate) ? candidate.toLowerCase() : null;
}

function extractContentId(url) {
  const match = String(url || '').match(/\/(?:content_id|pid|infohash)\/([a-fA-F0-9]{40})\//);
  return match ? match[1].toLowerCase() : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferSubgroups(group, name, tvgId, rawGroup) {
  const text = normalizeText(`${name || ''} ${tvgId || ''} ${rawGroup || ''}`);
  const labels = [];

  for (const rule of SUBGROUP_RULES) {
    if (rule.group !== group) continue;
    if (rule.patterns.some(pattern => new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(text))) {
      labels.push(rule.label);
    }
  }

  labels.push(...rawGroupSubgroups(group, rawGroup));

  if (!labels.length) labels.push('Otros');
  return [...new Set(labels)];
}

function rawGroupSubgroups(group, rawGroup) {
  const labels = [];
  const parts = String(rawGroup || '')
    .split(/\s*(?:,|\/|\||>|»|\s-\s)\s*/)
    .map(cleanSubgroupLabel)
    .filter(Boolean);

  for (const label of parts) {
    const normalized = normalizeText(label).trim();
    if (!normalized || MAIN_GROUPS.has(normalized) || GENERIC_SUBGROUPS.has(normalized)) continue;
    if (normalizeText(group) === normalized) continue;
    if (matchesStaticSubgroup(group, label)) continue;
    if (label.length < 3 || label.length > 28) continue;
    labels.push(label);
  }

  return labels;
}

function cleanSubgroupLabel(value) {
  const cleaned = String(value || '')
    .replace(/^\d+(?:\.\d+)?\s*/, '')
    .replace(/\.(?:w3u|m3u8?|json)$/i, '')
    .replace(/[_#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /https?:\/\//i.test(cleaned)) return null;
  const normalized = normalizeText(cleaned);
  const known = {
    dazn: 'DAZN',
    espn: 'ESPN',
    ufc: 'UFC',
    nba: 'NBA',
    acb: 'ACB',
    laliga: 'LaLiga',
    'la liga': 'LaLiga',
    motogp: 'MotoGP',
    'moto gp': 'MotoGP',
    mundial: 'Mundial',
    eurosport: 'Eurosport',
    'bein sport': 'beIN Sports',
    'bein sports': 'beIN Sports',
    'copa del rey': 'Copa del Rey',
    'primera rfef': 'Primera RFEF',
  };
  if (normalized.includes('mundial')) return 'Mundial';
  if (known[normalized]) return known[normalized];

  return cleaned
    .split(' ')
    .map(word => word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function matchesStaticSubgroup(group, label) {
  const text = normalizeText(label);
  return SUBGROUP_RULES.some(rule => {
    if (rule.group !== group) return false;
    return rule.patterns.some(pattern => new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(text));
  });
}

function orderSubgrouped(subgrouped) {
  const ordered = {};
  for (const [group, subgroups] of Object.entries(subgrouped)) {
    const preferred = SUBGROUP_RULES
      .filter(rule => rule.group === group)
      .map(rule => rule.label);
    const preferredSet = new Set(preferred);
    const labels = Object.keys(subgroups);
    const dynamicLabels = labels
      .filter(label => !preferredSet.has(label) && label !== 'Otros')
      .filter(label => subgroups[label].length >= 2)
      .sort((a, b) => subgroups[b].length - subgroups[a].length || a.localeCompare(b, 'es'))
      .slice(0, 24);
    const sortedLabels = [
      ...preferred.filter(label => subgroups[label]),
      ...dynamicLabels,
      ...labels.filter(label => label === 'Otros')
    ];
    ordered[group] = {};
    for (const label of sortedLabels) {
      ordered[group][label] = subgroups[label];
    }
  }
  return ordered;
}

app.listen(8890, () => console.log('Webplayer on :8890'));
