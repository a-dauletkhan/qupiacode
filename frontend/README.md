# Frontend

React + TypeScript + Vite frontend for the collaborative canvas UI.

## Voice Call Local Dev

The sidebar voice UI now connects to the FastAPI backend and LiveKit.

If the backend `.env` uses LiveKit Cloud credentials, you do not need to run `livekit-server --dev` locally.
For cheap prototyping, set `VOICE_AGENT_TRANSCRIPTION_MODE=mock` in the backend so the worker emits placeholder transcripts instead of consuming inference credits.

Run the backend first:

```bash
cd ../backend/voice_call_service
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run the text-only agent worker in a second backend terminal:

```bash
cd ../backend/voice_call_service
uv run python voice_agent_worker.py dev
```

Run LiveKit locally:

```bash
livekit-server --dev
```

Skip that command if your backend already points at LiveKit Cloud.

Run the frontend:

```bash
npm install
npm run dev
```

Open the app on `http://localhost:5173`, not `0.0.0.0`, so microphone capture is available in the browser.

Optional local env file:

```bash
cp .env.example .env
```

Useful query params during local testing:

```text
http://localhost:5173/?canvas_id=demo-canvas&user_id=alice&display_name=Alice
```

```text
http://localhost:5173/?canvas_id=demo-canvas&user_id=bob&display_name=Bob
```

To force the current worker implementation into that room during local testing:

```bash
cd ../backend/voice_call_service
uv run python voice_agent_worker.py connect --room canvas:demo-canvas
```

In `mock` mode, joining the room is enough to see placeholder transcript items in Chat.

Vite proxies `/api/*` to `http://127.0.0.1:8000` by default for local development. If needed, override the backend URL with:

```bash
VITE_VOICE_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
```

For direct backend calls outside the Vite proxy, set `VITE_VOICE_API_BASE_URL`.

## Production Deploy

When the frontend is deployed to Vercel and the backend is deployed to Railway, set:

```bash
VITE_VOICE_API_BASE_URL=https://<your-railway-backend-domain>
```

Set that variable in both Vercel Preview and Production so deployed voice calls use the
Railway backend directly.
