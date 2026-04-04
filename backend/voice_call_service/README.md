# Voice Call Service

The voice-call code still lives in this package, but `/backend` is now the only documented runtime and deploy root.

Use these root-level files instead:

- [backend/README.md](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/README.md)
- [backend/pyproject.toml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/pyproject.toml)
- [backend/docker-compose.yml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/docker-compose.yml)
- [backend/railway.toml](/Users/dauletkhan/gitted/hackathon/qupiacode/backend/railway.toml)

What still lives here:

- `app/`
  Voice API routes, settings, models, and the LiveKit transcription worker implementation.
- `tests/`
  Voice-service tests, now run from `/backend`.
- `voice_agent_worker.py`
  Compatibility entrypoint for the old service-local worker flow.

This folder is still a bounded package, not a separate first-class deployment root.
