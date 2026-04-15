.PHONY: up down restart status logs update

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
