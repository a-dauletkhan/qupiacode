# Voice Call Service

Minimal FastAPI backend for issuing LiveKit voice tokens on a per-canvas basis.

## What This Service Does

- Maps one canvas to one LiveKit room.
- Issues LiveKit access tokens through `POST /api/voice/token`.
- Applies platform-side business logic before a user joins a room.
- Accepts LiveKit webhooks for local development and keeps recent events in memory.

## What This Service Does Not Do Yet

- Real authentication or authorization.
- Database-backed state.
- Redis, queues, or background jobs.
- Transcript storage.
- AI agent orchestration.
- Canvas ownership or membership checks.

## Room Naming

- Current rule: `canvas:{canvas_id}`
- Example: canvas `abc123` becomes room `canvas:abc123`

This logic lives in `app/services/livekit_tokens.py` so we can evolve it later. If the product grows to allow a small number of voice rooms per canvas, we can extend the naming convention in one place, for example `canvas:{canvas_id}:voice:{slot}`.

## Token Issuance Flow

1. The frontend sends `canvas_id`, `user_id`, and an optional `display_name` to `POST /api/voice/token`.
2. The backend calls a stub authorization function in `app/services/authz.py`.
3. If allowed, the backend derives:
   - `room_name = canvas:{canvas_id}`
   - `participant_identity = user:{user_id}`
4. The backend uses LiveKit's official Python server SDK to create a room-scoped JWT.
5. The frontend uses the returned `server_url` and `token` to connect with a LiveKit client SDK.

## Architecture

- `app/main.py`
  FastAPI app creation and router registration.
- `app/api/routes/health.py`
  Liveness endpoint.
- `app/api/routes/voice.py`
  Voice token endpoint and HTTP error handling.
- `app/api/routes/webhooks.py`
  LiveKit webhook intake.
- `app/core/config.py`
  Pydantic settings and environment loading.
- `app/core/logging.py`
  Lightweight logging configuration.
- `app/services/authz.py`
  Stub canvas voice authorization boundary.
- `app/services/livekit_tokens.py`
  Room naming, identity naming, permission model, and token creation.
- `app/services/livekit_webhooks.py`
  Webhook parsing, local-dev event recording, and future verification boundary.
- `tests/`
  Endpoint tests.

## Required Environment Variables

Copy `.env.example` to `.env` and fill in the LiveKit values:

```bash
cp .env.example .env
```

- `APP_ENV`
- `APP_HOST`
- `APP_PORT`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LOG_LEVEL`
- `CORS_ALLOWED_ORIGINS`

Optional:

- `VOICE_TOKEN_TTL_SECONDS`
- `CORS_ALLOWED_ORIGIN_REGEX`

## Exact `uv` Setup Commands

These are the `uv` commands used to initialize and wire up this project:

```bash
uv init --bare --python 3.12 --no-package --vcs none
uv python pin 3.12
uv venv --python 3.12
uv add fastapi "uvicorn[standard]" pydantic-settings livekit-api
uv add --dev pytest httpx ruff basedpyright
```

For a fresh checkout, install everything with:

```bash
uv sync --all-groups
```

## Running Locally

Start the API server:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run tests:

```bash
uv run pytest
```

Run Ruff:

```bash
uv run ruff check .
```

Run basedpyright:

```bash
uv run basedpyright
```

## LiveKit Server

This FastAPI service does **not** run the LiveKit media server for you.

- The backend issues tokens and handles app-side logic.
- LiveKit runs separately and handles WebRTC/audio transport.
- For local development with self-hosted LiveKit, a common setup is:

```bash
livekit-server --dev
```

With that dev-mode server, the default credentials match `.env.example`:

- `LIVEKIT_URL=ws://localhost:7880`
- `LIVEKIT_API_KEY=devkey`
- `LIVEKIT_API_SECRET=secret`

## Production Deployment

For production, deploy only this FastAPI service to Railway and use LiveKit Cloud for
media transport.

- Railway runs the backend token and webhook service.
- LiveKit Cloud handles WebRTC/audio transport.
- Vercel hosts the frontend separately.

### Railway Config-As-Code

This repo includes [railway.toml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/voice_call_service/railway.toml) for the backend service.

In Railway:

1. Connect the repo.
2. Set `Root Directory` to `/backend/voice_call_service`.
3. Set the config file path to `/backend/voice_call_service/railway.toml`.
4. Keep `Builder = Railpack`.
5. Enable `Metal Build Environment` in the Railway UI.

The config file owns build, start, watch, and healthcheck behavior. Secrets, custom
domains, repo connection, the root directory setting, and the Metal toggle stay in
Railway settings.

### Railway Variables

Set these in the Railway service:

- `APP_ENV=production`
- `LOG_LEVEL=INFO`
- `VOICE_TOKEN_TTL_SECONDS=3600`
- `LIVEKIT_URL=<your LiveKit Cloud URL>`
- `LIVEKIT_API_KEY=<your LiveKit Cloud API key>`
- `LIVEKIT_API_SECRET=<your LiveKit Cloud API secret>`
- `CORS_ALLOWED_ORIGINS=https://<your-production-vercel-domain>`
- `CORS_ALLOWED_ORIGIN_REGEX=^https://.*-<your-vercel-project-slug>\.vercel\.app$`

### Vercel Variables

Set this in Vercel Preview and Production:

- `VITE_VOICE_API_BASE_URL=https://<your-railway-backend-domain>`

### LiveKit Cloud Webhook

Configure LiveKit Cloud to send webhooks to:

```text
https://<your-railway-backend-domain>/webhooks/livekit
```

### CORS

The backend now installs CORS middleware only when `CORS_ALLOWED_ORIGINS` or
`CORS_ALLOWED_ORIGIN_REGEX` is configured. This is required when the frontend is
served from Vercel and the backend is served from Railway.

## API Examples

### `GET /healthz`

```bash
curl http://127.0.0.1:8000/healthz
```

Response:

```json
{
  "status": "ok"
}
```

### `POST /api/voice/token`

```bash
curl -X POST http://127.0.0.1:8000/api/voice/token \
  -H "Content-Type: application/json" \
  -d '{
    "canvas_id": "canvas-123",
    "user_id": "user-456",
    "display_name": "Ava"
  }'
```

Example response:

```json
{
  "server_url": "ws://localhost:7880",
  "room_name": "canvas:canvas-123",
  "participant_identity": "user:user-456",
  "participant_name": "Ava",
  "token": "<livekit-jwt>"
}
```

## Two-Tab Local Voice Test

Once both the backend and LiveKit server are running, open:

```text
http://127.0.0.1:8000/dev/voice-test
```

Then:

1. Open that page in two browser tabs.
2. Keep the same `canvas_id` in both tabs.
3. Use different `user_id` values in each tab.
4. Click `Join and Unmute` in both tabs.

If autoplay is blocked for remote audio, click `Enable Speaker Audio`.

The `/dev/voice-test` page is local-development-only and is not registered when
`APP_ENV=production`.

## Frontend Integration

The frontend should:

1. Call `POST /api/voice/token` before joining voice for a canvas.
2. Use the returned `server_url` and `token` with a LiveKit client SDK.
3. Reuse `room_name` and `participant_identity` only for display or debugging; the JWT is the authority LiveKit uses for room access.

Minimal request shape:

```json
{
  "canvas_id": "canvas-123",
  "user_id": "user-456",
  "display_name": "Ava"
}
```

## Webhooks

`POST /webhooks/livekit` currently:

- Parses the incoming JSON body.
- Tries to normalize it as a LiveKit webhook event.
- Logs a small local-dev summary.
- Stores recent parsed events in memory only.

Production signature verification is intentionally left as a TODO in `app/services/livekit_webhooks.py`.

## Next Steps

- Replace the authz stub with real canvas membership checks.
- Add verified webhook signature handling with LiveKit's webhook receiver.
- Add role-based permission decisions for publish, subscribe, and moderation.
- Decide how to support a small fixed number of voice rooms per canvas if product scope expands.
