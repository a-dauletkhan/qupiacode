# Backend

`/backend` is the canonical Python and deploy root for the project.

The two service domains still live in their own packages:

- `canvas_service/`
  Canvas API, collaboration websocket, SQLAlchemy models, and Redis integration.
- `voice_call_service/`
  LiveKit token routes and the text-only transcription worker.

Everything is now run from `/backend`:

- [main.py](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/main.py)
  Unified FastAPI app.
- [voice_agent_worker.py](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/voice_agent_worker.py)
  Root worker entrypoint.
- [scripts/run_backend_stack.py](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/scripts/run_backend_stack.py)
  Railway-friendly API + worker supervisor.
- [pyproject.toml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/pyproject.toml)
  The only supported Python dependency definition.
- [docker-compose.yml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/docker-compose.yml)
  One-command local stack.
- [railway.toml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/railway.toml)
  Railway config for `/backend`.

## Why Postgres Is Still Here

Supabase is still part of the system for auth and storage, but the canvas service currently persists board and canvas data through SQLAlchemy and `DATABASE_URL`.

That means local development still needs a PostgreSQL database, and the Compose stack brings one up for you automatically. Redis also stays local because the collaboration websocket still uses it for pub/sub.

## Local Python Flow

If you want to run the backend directly on your machine without Docker:

```bash
cd backend
cp .env.example .env
uv sync
uv run python -m scripts.run_backend_stack --worker-mode connect --room canvas:demo-canvas --reload
```

Useful shortcuts:

```bash
make sync
make dev
make dev-connect ROOM=canvas:demo-canvas
make test
make lint
make typecheck
```

## One-Command Local Stack

For the full local backend stack, including Postgres and Redis:

```bash
cd backend
cp .env.example .env
docker compose up --build
```

That starts:

- `api`
- `voice-worker`
- `postgres`
- `redis`

The Compose stack uses:

- local Postgres via `DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/qupia`
- local Redis via `REDIS_URL=redis://redis:6379/0`
- external LiveKit and Supabase values from `.env`

`VOICE_AGENT_CONNECT_ROOM` defaults to `canvas:demo-canvas`, so the worker auto-connects to a demo room in local Compose without a manual `connect` command.

## Railway

Set Railway:

- `Root Directory = /backend`
- `Config Path = /backend/railway.toml`

Railway now uses the root [Dockerfile](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/Dockerfile), which installs dependencies with `uv` and starts the combined API + worker process via [scripts/run_backend_stack.py](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/scripts/run_backend_stack.py).

The API binds to `PORT` automatically in Railway, and the healthcheck stays on `/healthz`.
