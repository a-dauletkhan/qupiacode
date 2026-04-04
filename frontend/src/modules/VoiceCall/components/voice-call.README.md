# VoiceCall

## Purpose

Renders the actual voice room sidebar by consuming the VoiceCall hook and passing
presentational props into the leaf UI components.

## Owned state

- no direct transport or backend state
- layout-only rendering concerns for the sidebar surface

## Props

- `canvasId` - optional explicit canvas identifier; falls back to `?canvas_id=` or `demo-canvas`
- `userId` - optional explicit user identifier; falls back to `?user_id=` or a generated local id
- `displayName` - optional participant name; falls back to `?display_name=` or a generated guest label
- `apiBaseUrl` - optional backend base URL; defaults to `VITE_VOICE_API_BASE_URL` or same-origin `/api`
- `className` and native `section` props are forwarded

## Dependencies

- `useVoiceCall` for backend + LiveKit orchestration
- `CallAgentCard`, `CallUserCard`, and `VoiceCallControlPanel` for UI composition
- `Button` for the speaker-audio recovery action

## Integration notes

- backend token requests live in `services/voice-call-service.ts`
- LiveKit room orchestration and state shaping live in `hooks/use-voice-call.ts`
- the component still accepts explicit `canvasId`, `userId`, `displayName`, and `apiBaseUrl`

## Known limits

- The AI agent card stays placeholder-only until an actual LiveKit agent participant joins the room.
- Participant identity and canvas identity still come from URL params or local defaults, not app state.
