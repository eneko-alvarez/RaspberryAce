# RaspberryAce Agent Notes

## Proyecto

RaspberryAce es una pila Docker para usar AceStream de forma local y autonoma. Esta revision debe tratarse como base funcional estable: no refactorizar ni cambiar comportamiento salvo que el usuario lo pida de forma explicita o sea imprescindible para una correccion concreta.

## Arquitectura

- `docker-compose.yml` orquesta todos los servicios en la red `aceproxy-net`.
- `aceserve` usa la imagen `wafy80/acestream:latest` y expone:
  - `6878`: HTTP AceStream
  - `62062`: API AceStream
  - `8621`: P2P AceStream
- `httproxy` se construye desde el submodulo `httproxy` (`HTTPAceProxy`) y expone `8888`.
- `peer-checker` es un servicio Flask/aiohttp en `peer-checker/app.py`. Es el unico componente que no esta completamente funcional y no debe asumirse activo en este momento. Su objetivo es leer la playlist `/aio`, consultar peers via `/statplugin`, ordenar y marcar canales, y servir:
  - `http://<host>:8889/`: dashboard
  - `http://<host>:8889/aio_filtered`: M3U marcada por peers
  - `http://<host>:8889/status`: estado JSON
  - `http://<host>:8889/channels`: listado JSON
  - `http://<host>:8889/refresh`: refresco manual
- `webplayer` es una app Express en `webplayer/server.js` con UI estatica en `webplayer/public/index.html`; expone `8890` y convierte streams a HLS con `ffmpeg`.

## Comandos habituales

- Levantar pila: `make up`
- Parar pila: `make down`
- Reiniciar pila: `make restart`
- Estado: `make status`
- Logs de todos los servicios: `make logs`
- Logs del motor: `docker compose logs -f aceserve`
- Logs del proxy: `docker compose logs -f httproxy`
- Refrescar canales/proxy: `make update-channels`
- Actualizar imagenes y recrear: `make update`

Nota: los targets `logs-engine` y `logs-proxy` del `Makefile` usan nombres de contenedor (`aceserve-engine`, `httpaceproxy`). Si fallan con Docker Compose moderno, preferir los nombres de servicio: `aceserve` y `httproxy`.

## Verificacion recomendada

Para cambios de configuracion Docker:

1. `docker compose config`
2. `docker compose up -d --build`
3. `docker compose ps`
4. Comprobar salud:
   - `curl -f http://127.0.0.1:8888/stat`
   - `curl -f http://127.0.0.1:8889/status`
   - `curl -f http://127.0.0.1:8890/api/channels`

Para cambios en `peer-checker`:

1. `python -m py_compile peer-checker/app.py`
2. Tratarlo como servicio en desarrollo/no activo: no integrarlo como dependencia de otros servicios sin validarlo antes.
3. Si Docker esta disponible y el usuario pide probarlo, `docker compose up -d --build peer-checker`
4. Verificar `/status`, `/channels` y `/aio_filtered`.

Para cambios en `webplayer`:

1. `node --check webplayer/server.js`
2. Si Docker esta disponible, `docker compose up -d --build webplayer`
3. Verificar `/api/channels` y la carga de `http://127.0.0.1:8890/`.

## Reglas de trabajo

- Mantener cambios pequenos y reversibles. No tocar el submodulo `httproxy` salvo peticion explicita.
- No cambiar puertos, nombres de servicio, variables de entorno ni healthchecks sin justificarlo.
- Conservar compatibilidad con Raspberry/local LAN: evitar dependencias pesadas o servicios externos nuevos.
- No sustituir la logica funcional actual por una reescritura grande. Mejor parchear el punto exacto.
- Si se cambia parsing M3U, endpoints o formato JSON, revisar impacto en `peer-checker`, `webplayer` y clientes IPTV.
- Preferir configuracion via variables de entorno en `docker-compose.yml`.
- No introducir secretos ni URLs privadas en el repo.
- Antes de editar, revisar `git status --short` para no pisar trabajo del usuario.

## Estado base conocido

- El usuario considera esta version correcta al 100% como base funcional.
- La fuente principal de canales del proxy es `/aio`.
- `peer-checker` es la excepcion: no esta completo ni activo ahora mismo. No basar cambios funcionales en que sus endpoints respondan.
- El comportamiento previsto de `peer-checker` es no descartar canales: conservarlos todos, ordenarlos y marcarlos con emoji segun peers.
- `webplayer` consume `/aio` directamente desde `httproxy`, no la lista filtrada de `peer-checker`, salvo que se cambie expresamente.
