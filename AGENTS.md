# Repository Guidelines

## Project Structure & Module Organization

This repository defines a RaspberryAce/AceStream Docker Compose stack. Treat the current behavior as a stable functional base: avoid broad rewrites unless the user explicitly asks for them or they are required for a focused fix.

- `docker-compose.yml`: orchestrates all services on the `aceproxy-net` network.
- `httproxy/`: HTTPAceProxy submodule used as the proxy service on port `8888`. Treat it as an external component unless the change is specifically for that codebase.
- `peer-checker/`: Python Flask/aiohttp service in `peer-checker/app.py`; checks playlist peer counts and serves status on port `8889`.
- `webplayer/`: Node/Express service in `webplayer/server.js`; exposes the UI and starts ffmpeg HLS streams on port `8890`.
- Static web assets live under `webplayer/public/` and `httproxy/http/`.

## Architecture Notes

- `aceserve` uses `wafy80/acestream:latest` and exposes:
  - `6878`: HTTP AceStream
  - `62062`: AceStream API
  - `8621`: AceStream P2P
- `peer-checker` is still a development component and should not be assumed active unless verified. Its intended endpoints are:
  - `http://<host>:8889/`: dashboard
  - `http://<host>:8889/aio_filtered`: M3U marked by peers
  - `http://<host>:8889/status`: JSON status
  - `http://<host>:8889/channels`: JSON channel list
  - `http://<host>:8889/refresh`: manual refresh
- `webplayer` consumes `/aio` directly from `httproxy`, not the filtered `peer-checker` list, unless explicitly changed.

## Build, Test, and Development Commands

- `make up`: build/start the complete Docker Compose stack in detached mode.
- `make down`: stop and remove the stack containers.
- `make restart`: restart all running services.
- `make status`: show Compose service status.
- `make logs`: follow logs for all services.
- `make logs-engine`: follow AceStream engine logs.
- `make logs-proxy`: follow HTTPAceProxy logs.
- `make update-channels`: refresh channels/proxy.
- `make update`: pull images and recreate the stack.
- `docker compose build peer-checker webplayer`: rebuild only local helper services after code changes.

Note: if the `Makefile` log targets fail with modern Docker Compose because they use container names, prefer service names: `aceserve` and `httproxy`.

## Coding Style & Naming Conventions

Python code targets Python 3.12 in containers. Use 4-space indentation, clear function names, and environment-variable configuration through `os.environ.get(...)`, matching `peer-checker/app.py`.

Node code uses CommonJS (`require`), semicolons, `const`/`let`, and Express route handlers as shown in `webplayer/server.js`. Keep service constants near the top.

## Testing Guidelines

There is no formal test suite in the current repository. For configuration changes, validate with:

```sh
docker compose config
docker compose up -d --build
docker compose ps
```

For `peer-checker` changes:

```sh
python -m py_compile peer-checker/app.py
docker compose up -d --build peer-checker
```

Then check `http://localhost:8889/status`, `/channels`, and `/aio_filtered`.

For `webplayer` changes:

```sh
node --check webplayer/server.js
docker compose up -d --build webplayer
```

Then check `http://localhost:8890/api/channels` and `http://localhost:8890/`.

## Commit & Pull Request Guidelines

Recent commits use short, direct summaries, but no strict convention is enforced. Prefer concise present-tense messages that identify the affected service, for example `peer-checker: handle empty playlists`.

Pull requests should include a short description, services changed, validation commands run, and any required configuration changes. Include screenshots for visible `webplayer` or proxy UI changes. Note any `httproxy` submodule updates explicitly.

## Security & Configuration Tips

- Do not commit local secrets, private playlist URLs, or host-specific credentials.
- Keep runtime settings in `docker-compose.yml` environment entries or service-specific `.env` files when introduced.
- Be careful when changing published ports, service names, environment variables, healthchecks, or plugin lists because they affect the whole stack.
- Preserve Raspberry/local LAN compatibility: avoid heavy dependencies or new external services.
- If M3U parsing, endpoints, or JSON formats change, review impact in `peer-checker`, `webplayer`, and IPTV clients.
- Before editing, review `git status --short` so user work is not overwritten.
