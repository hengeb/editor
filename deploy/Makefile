.DEFAULT_GOAL := help

.PHONY: setup up down logs shell test build help

setup: ## .env aus .env.example anlegen (falls noch nicht vorhanden)
	@test -f .env || cp .env.example .env

up: ## Container starten (nutzt ggf. lokal gebautes Image, sonst GHCR)
	@name="$$( [ -f .env ] && grep -E '^USER=' .env | cut -d= -f2- )"; \
	name="$${name:-$$(id -un)}"; \
	uid="$$(id -u "$$name")"; \
	gid="$$(id -g "$$name")"; \
	datadir="$$( [ -f .env ] && grep -E '^HOST_DATA_DIR=' .env | cut -d= -f2- )"; \
	datadir="$${datadir:-./data}"; \
	if [ ! -d "$$datadir" ]; then \
		mkdir -p "$$datadir"; \
		chown "$$uid:$$gid" "$$datadir" 2>/dev/null || true; \
	fi; \
	PUID="$$uid" PGID="$$gid" docker compose up -d

down: ## Container stoppen und entfernen
	docker compose down

logs: ## Logs live verfolgen
	docker compose logs -f

shell: ## Shell im laufenden Container öffnen
	docker compose exec editor sh

test: ## PHPUnit-Tests im Container ausführen
	docker compose exec editor vendor/bin/phpunit

build: ## Image lokal neu bauen (statt des GHCR-Images zu verwenden)
	docker compose build

help: ## Diese Hilfe anzeigen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-10s\033[0m %s\n", $$1, $$2}'
