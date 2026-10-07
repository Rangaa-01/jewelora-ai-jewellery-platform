.PHONY: setup models db migrate seed dev lint typecheck test e2e build check

setup: ## Install everything for local development
	cd frontend && npm ci
	npm ci
	cd backend && uv venv -p 3.12 .venv && uv pip install -p .venv/bin/python -e ".[dev]" -e "../ai[dev]"
	$(MAKE) models

models: ## Download MediaPipe models (backend + browser copies)
	./scripts/download_models.sh
	mkdir -p frontend/public/models && cp -n ai/models/*.task ai/models/*.tflite frontend/public/models/ 2>/dev/null || true

db: ## Create local databases (needs PGPASSWORD for the postgres superuser)
	./scripts/setup_local_db.sh

migrate:
	cd backend && .venv/bin/alembic upgrade head

seed:
	cd backend && .venv/bin/python -m app.cli seed

dev:
	npm run dev

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test

e2e:
	npm run test:e2e

build:
	npm run build

check: lint typecheck test ## Everything CI runs except E2E
