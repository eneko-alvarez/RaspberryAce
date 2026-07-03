DEV_COMPOSE=docker compose -f docker-compose.dev.yml

.PHONY: up all-up down restart status logs logs-engine logs-proxy logs-webplayer logs-vod update update-channels \
	ace-up ace-down ace-restart ace-logs vod-up vod-down vod-restart vod-status vod-logs \
	peer-up peer-logs dev-up dev-down dev-restart dev-status dev-logs

up:
	docker compose up -d --build
	@echo "Stack completo arriba"
	@echo "Webplayer: http://127.0.0.1:8890/"
	@echo "HTTPAceProxy: http://127.0.0.1:8888/stat"
	@echo "Peer checker: http://127.0.0.1:8889/status"

all-up: up

down:
	docker compose down
	@echo "Stack completo parado"

restart:
	docker compose restart
	@echo "Stack completo reiniciado"

update-channels:
	docker compose restart httproxy
	@echo "Proxy reiniciado (IDs refrescados)"

status:
	docker compose ps

logs:
	docker compose logs -f

logs-engine:
	docker compose logs -f aceserve

logs-proxy:
	docker compose logs -f httproxy

logs-webplayer:
	docker compose logs -f webplayer

logs-vod: logs-webplayer

update:
	docker compose pull
	docker compose up -d --build
	@echo "Imágenes actualizadas"

ace-up:
	docker compose up -d --build aceserve httproxy webplayer
	@echo "Directos arriba"
	@echo "Webplayer: http://127.0.0.1:8890/"
	@echo "HTTPAceProxy: http://127.0.0.1:8888/stat"

ace-down:
	docker compose stop webplayer httproxy aceserve
	@echo "Directos parados"

ace-restart:
	docker compose restart aceserve httproxy webplayer
	@echo "Directos reiniciados"

ace-logs:
	docker compose logs -f aceserve httproxy webplayer

vod-up:
	$(DEV_COMPOSE) up -d --build webplayer
	@echo "VOD/webplayer arriba sin stack AceStream → http://127.0.0.1:8890/"
	@echo "Requiere TMDB_ACCESS_TOKEN para cargar catálogo VOD."

vod-down:
	$(DEV_COMPOSE) down --remove-orphans
	@echo "VOD/webplayer parado"

vod-restart:
	$(DEV_COMPOSE) restart webplayer
	@echo "VOD/webplayer reiniciado"

vod-status:
	$(DEV_COMPOSE) ps

vod-logs:
	$(DEV_COMPOSE) logs -f webplayer

peer-up:
	docker compose up -d --build peer-checker
	@echo "Peer checker arriba → http://127.0.0.1:8889/status"

peer-logs:
	docker compose logs -f peer-checker

dev-up:
	$(DEV_COMPOSE) up -d --build --remove-orphans
	@echo "Dev stack arriba con motor externo → http://127.0.0.1:8890/"

dev-down:
	$(DEV_COMPOSE) down --remove-orphans
	@echo "Dev stack parado"

dev-restart:
	$(DEV_COMPOSE) restart
	@echo "Dev stack reiniciado"

dev-status:
	$(DEV_COMPOSE) ps

dev-logs:
	$(DEV_COMPOSE) logs -f
