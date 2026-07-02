# Repository Guidelines

## Project Structure & Module Organization

This repository defines an AceStream Docker Compose stack. The root `docker-compose.yml` wires services together and the root `Makefile` provides shortcuts.

- `httproxy/`: HTTPAceProxy submodule used as the proxy service. Treat it as an external component unless the change is specifically for that codebase.
- `peer-checker/`: Python Flask/aiohttp service that checks playlist peer counts and serves status on port `8889`.
- `webplayer/`: Node/Express service that exposes the UI and starts ffmpeg HLS streams on port `8890`.
- Static web assets live under `webplayer/public/` and `httproxy/http/`.

## Build, Test, and Development Commands

- `make up`: build/start the complete Docker Compose stack in detached mode.
- `make down`: stop and remove the stack containers.
- `make restart`: restart all running services.
- `make status`: show Compose service status.
- `make logs`: follow logs for all services.
- `make logs-engine`: follow the AceStream engine logs.
- `make logs-proxy`: follow HTTPAceProxy logs.
- `make update`: pull images and recreate the stack.
- `docker compose build peer-checker webplayer`: rebuild only local helper services after code changes.

## Coding Style & Naming Conventions

Python code targets Python 3.12 in containers. Use 4-space indentation, clear function names, and environment-variable configuration through `os.environ.get(...)`, matching `peer-checker/app.py`.

Node code uses CommonJS (`require`), semicolons, `const`/`let`, and Express route handlers as shown in `webplayer/server.js`. Keep service constants near the top.

## Testing Guidelines

There is no formal test suite in the current repository. For now, validate changes by building affected containers and running the stack:

```sh
docker compose build peer-checker webplayer
make up
make status
```

Check health endpoints and logs before opening a PR: `http://localhost:8889/status`, `http://localhost:8890/`, and `make logs`.

## Commit & Pull Request Guidelines

Recent commits use short, direct summaries, but no strict convention is enforced. Prefer concise present-tense messages that identify the affected service, for example `peer-checker: handle empty playlists`.

Pull requests should include a short description, services changed, validation commands run, and any required configuration changes. Include screenshots for visible `webplayer` or proxy UI changes. Note any `httproxy` submodule updates explicitly.

## Security & Configuration Tips

Do not commit local secrets, private playlist URLs, or host-specific credentials. Keep runtime settings in `docker-compose.yml` environment entries or service-specific `.env` files when introduced. Be careful when changing published ports or plugin lists because they affect the whole stack.
