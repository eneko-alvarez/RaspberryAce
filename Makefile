DEV_COMPOSE=docker compose -f docker-compose.dev.yml

.PHONY: up down restart status logs update dev-up dev-down dev-restart dev-status dev-logs

up:
	docker compose up -d
	@echo "✅ AceStream stack arriba → http://192.168.1.125:8888/stat"

down:
	docker compose down
	@echo "🛑 AceStream stack parado"

restart:
	docker compose restart
	@echo "🔄 AceStream stack reiniciado"

update-channels:
	docker compose restart httproxy
	@echo "🔄 Proxy reiniciado (IDs refrescados)"

status:
	docker compose ps

logs:
	docker compose logs -f

logs-engine:
	docker compose logs -f aceserve-engine

logs-proxy:
	docker compose logs -f httpaceproxy

update:
	docker compose pull
	docker compose up -d
	@echo "⬆️  Imágenes actualizadas"

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
