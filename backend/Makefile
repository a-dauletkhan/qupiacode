ROOM ?= canvas:demo-canvas

.PHONY: sync dev dev-connect start test lint typecheck compose-up

sync:
	uv sync

dev:
	uv run python -m scripts.run_backend_stack --worker-mode dev --reload

dev-connect:
	uv run python -m scripts.run_backend_stack --worker-mode connect --room "$(ROOM)" --reload

start:
	uv run python -m scripts.run_backend_stack --worker-mode start

test:
	uv run pytest

lint:
	uv run ruff check .

typecheck:
	uv run basedpyright

compose-up:
	docker compose up --build
