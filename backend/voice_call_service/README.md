# Voice Call Service

Minimal FastAPI backend for issuing LiveKit voice tokens on a per-canvas basis.

## What This Service Does

- Maps one canvas to one LiveKit room.
- Issues LiveKit access tokens through `POST /api/voice/token`.
- Returns lightweight text-agent metadata with the voice token response.
- Runs a separate LiveKit worker that can join rooms as a text-only participant.
- Applies platform-side business logic before a user joins a room.
- Accepts LiveKit webhooks for local development and keeps recent events in memory.

## What This Service Does Not Do Yet

- Real authentication or authorization.
- Database-backed state.
- Redis, queues, or background jobs.
- Transcript storage.
- Canvas ownership or membership checks.
- Automatic LiveKit agent dispatch on participant join.
- Canvas mutations or typed chat-to-agent input.

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
- `app/voice_agent/`
  Silent LiveKit transcription worker runtime, mock-mode helpers, and transcript forwarding.
- `voice_agent_worker.py`
  Worker CLI entrypoint used for local development and deployment.
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
- `VOICE_AGENT_ENABLED`
- `VOICE_AGENT_NAME`
- `VOICE_AGENT_WAKE_PHRASES`
- `VOICE_AGENT_TRANSCRIPTION_MODE`
- `VOICE_AGENT_STT_MODEL`
- `VOICE_AGENT_STT_LANGUAGE`
- `VOICE_AGENT_TRANSCRIPT_FORWARD_URL`
- `VOICE_AGENT_TRANSCRIPT_FORWARD_AUTH_TOKEN`
- `VOICE_AGENT_TRANSCRIPT_FORWARD_PARTIALS_ENABLED`
- `VOICE_AGENT_MOCK_TRANSCRIPT_TEMPLATE`
- `VOICE_AGENT_TRANSCRIPT_PARTIALS_ENABLED`
- `VOICE_AGENT_DIARIZATION_ENABLED`

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

Run the worker:

```bash
uv run python voice_agent_worker.py dev
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

If you point `.env` at LiveKit Cloud instead, skip `livekit-server --dev`. The worker and
frontend can connect to LiveKit Cloud directly during local development.

## Local End-To-End Testing

1. Copy `.env.example` to `.env`.
2. Pick a transcription mode:

- `VOICE_AGENT_TRANSCRIPTION_MODE=mock`
  Best for cheap pipeline testing. The worker emits one placeholder transcript per participant microphone track and can still forward it to your external service.
- `VOICE_AGENT_TRANSCRIPTION_MODE=livekit_inference`
  Uses LiveKit Inference STT and consumes your LiveKit Cloud inference credits.

3. Optional: set `VOICE_AGENT_TRANSCRIPT_FORWARD_URL` to the external service that should receive transcript JSON payloads.
4. If you are using self-hosted local LiveKit, start it:

```bash
livekit-server --dev
```

If you are using LiveKit Cloud credentials in `.env`, skip that command.

5. Start the API:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

6. Start the worker in a second terminal:

```bash
uv run python voice_agent_worker.py dev
```

7. Start the frontend from `/frontend`:

```bash
npm install
npm run dev
```

8. Open two browser windows using the same `canvas_id` and different `user_id` values, for example:

```text
http://localhost:5173/?canvas_id=demo-canvas&user_id=alice&display_name=Alice
http://localhost:5173/?canvas_id=demo-canvas&user_id=bob&display_name=Bob
```

9. Explicitly connect the worker to that room:

```bash
uv run python voice_agent_worker.py connect --room canvas:demo-canvas
```

10. Validate the result:

- In `livekit_inference` mode, speak normally and confirm transcript lines appear in Chat.
- In `mock` mode, join the room and confirm the placeholder transcript appears without consuming STT credits.
- If `VOICE_AGENT_TRANSCRIPT_FORWARD_URL` is set, confirm your external service receives JSON payloads with room, participant, track, segment, and timestamp metadata.

Notes:

- `connect --room ...` is the easiest local test path today because the backend does not yet attach LiveKit agent dispatch to the issued user token.
- `mock` mode is the safest default for prototyping because it exercises the room/UI/webhook pipeline without spending LiveKit inference credits.
- Partial transcript rendering depends on `VOICE_AGENT_TRANSCRIPT_PARTIALS_ENABLED` and provider behavior.
- Overlapping speech from separate participants is handled best-effort through LiveKit participant attribution.

## Production Deployment

For production, deploy the API and the LiveKit worker as separate Railway services and
use LiveKit Cloud for media transport.

- Railway runs the backend token/webhook service and the LiveKit worker.
- LiveKit Cloud handles WebRTC/audio transport.
- Vercel hosts the frontend separately.

### Railway Config-As-Code

This repo includes:

- [railway.toml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/voice_call_service/railway.toml) for the API service
- [railway.worker.toml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/voice_call_service/railway.worker.toml) for the worker service

Create two Railway services from the same repo:

1. An API service that uses `/backend/voice_call_service/railway.toml`
2. A worker service that uses `/backend/voice_call_service/railway.worker.toml`

For both services:

1. Connect the repo.
2. Set `Root Directory` to `/backend/voice_call_service`.
3. Keep `Builder = Railpack`.

The config file owns build, start, watch, and healthcheck behavior. Secrets, custom
domains, repo connection, and the root directory setting stay in Railway settings.

### Railway Variables

Set these in both Railway services:

- `APP_ENV=production`
- `LOG_LEVEL=INFO`
- `LIVEKIT_URL=<your LiveKit Cloud URL>`
- `LIVEKIT_API_KEY=<your LiveKit Cloud API key>`
- `LIVEKIT_API_SECRET=<your LiveKit Cloud API secret>`
- `VOICE_AGENT_ENABLED=true`
- `VOICE_AGENT_NAME=Qupia Agent`
- `VOICE_AGENT_WAKE_PHRASES=agent,hey agent,ai agent`
- `VOICE_AGENT_TRANSCRIPTION_MODE=livekit_inference`
- `VOICE_AGENT_STT_MODEL=assemblyai/universal-streaming`
- `VOICE_AGENT_STT_LANGUAGE=en`
- `VOICE_AGENT_TRANSCRIPT_FORWARD_URL=https://<your-transcript-service>/...`
- `VOICE_AGENT_TRANSCRIPT_FORWARD_AUTH_TOKEN=<optional bearer token>`
- `VOICE_AGENT_TRANSCRIPT_FORWARD_PARTIALS_ENABLED=false`
- `VOICE_AGENT_MOCK_TRANSCRIPT_TEMPLATE=[mock] {participant_name} shared a prototype update.`
- `VOICE_AGENT_TRANSCRIPT_PARTIALS_ENABLED=true`
- `VOICE_AGENT_DIARIZATION_ENABLED=false`

Set these API-only variables on the API service:

- `VOICE_TOKEN_TTL_SECONDS=3600`
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

### Important Current Limitation

The worker is registered as a named LiveKit agent. Deploying the worker is not enough by itself; each room still needs a LiveKit dispatch.

Right now, this repo does **not** automatically create that dispatch when a user joins. For production you need one of these:

1. Add `RoomConfiguration.agents` to the issued user token in `app/services/livekit_tokens.py`.
2. Create explicit dispatches from the backend through the LiveKit server API.
3. Manually create dispatches for testing and demos.

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
