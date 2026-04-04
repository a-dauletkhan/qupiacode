ROOM ?= canvas:demo-canvas

.PHONY: dev dev-connect start-combined test lint typecheck

dev:
	uv run python scripts/run_voice_stack.py --worker-mode dev --reload

dev-connect:
	uv run python scripts/run_voice_stack.py --worker-mode connect --room "$(ROOM)" --reload

start-combined:
	.venv/bin/python scripts/run_voice_stack.py --worker-mode start

test:
	uv run pytest

lint:
	uv run ruff check .

typecheck:
	uv run basedpyright
