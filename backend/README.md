# Backend

`/backend` is the canonical Python and deploy root for the project.

The two service domains still live in their own packages:

- `canvas_service/`
  Canvas auth, board metadata, and Liveblocks session auth.
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

## Data Ownership

The current backend split is:

- Supabase Auth for users and JWT validation
- Supabase tables for board metadata
- Liveblocks for collaborative canvas state
- LiveKit for voice rooms and the silent transcription worker

The old SQLAlchemy-backed board storage and local Redis/websocket canvas sync are no longer part of the active app surface.

The backend board API now expects two Supabase tables:

- `public.boards`
- `public.board_members`

You can create them by running the checked-in SQL from [supabase/boards.sql](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/supabase/boards.sql) in the Supabase SQL editor.

`SUPABASE_SERVICE_ROLE_KEY` is required for the backend because board metadata is managed server-side through the Supabase admin client.

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

For the full local backend stack:

```bash
cd backend
cp .env.example .env
docker compose up --build
```

That starts:

- `api`
- `voice-worker`

The Compose stack now depends only on external LiveKit, Liveblocks, and Supabase values from `.env`.

`VOICE_AGENT_CONNECT_ROOM` defaults to `canvas:demo-canvas`, so the worker auto-connects to a demo room in local Compose without a manual `connect` command.

## Railway

Set Railway:

- `Root Directory = /backend`
- `Config Path = /backend/railway.toml`

Railway now uses the root [Dockerfile](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/Dockerfile), which installs dependencies with `uv` and starts the combined API + worker process via [scripts/run_backend_stack.py](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/scripts/run_backend_stack.py).

The API binds to `PORT` automatically in Railway, and the healthcheck stays on `/healthz`.
