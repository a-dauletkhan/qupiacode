# VoiceCall

## Purpose

Owns the actual voice room integration for the sidebar by fetching backend tokens, connecting to LiveKit, tracking participants, and passing presentational props into the leaf UI components.

## Owned state

- LiveKit `Room` lifecycle and connection state
- token request state and error messages
- participant list view models
- microphone and speaker playback status
- per-participant volume values

## Props

- `canvasId` - optional explicit canvas identifier; falls back to `?canvas_id=` or `demo-canvas`
- `userId` - optional explicit user identifier; falls back to `?user_id=` or a generated local id
- `displayName` - optional participant name; falls back to `?display_name=` or a generated guest label
- `apiBaseUrl` - optional backend base URL; defaults to `VITE_VOICE_API_BASE_URL` or same-origin `/api`
- `className` and native `section` props are forwarded

## Dependencies

- `livekit-client` for room connection and participant media
- `CallAgentCard`, `CallUserCard`, and `VoiceCallControlPanel` for UI composition
- `Button` for the speaker-audio recovery action

## Integration notes

- In local Vite development, `/api/*` is proxied to the FastAPI backend.
- For browser microphone access, open the frontend on `localhost` or HTTPS rather than `0.0.0.0`.
- The component currently uses URL query params as a lightweight stand-in until the app has real canvas and user state wired in.

## Known limits

- The AI agent card stays placeholder-only until an actual LiveKit agent participant joins the room.
- Participant identity and canvas identity still come from URL params or local defaults, not app state.
