# VoiceCall Module

## Module purpose

Provides the in-call sidebar UI for displaying the agent, participants, per-user volume controls, and global call actions.

## Main components

- `VoiceCall` composes the sidebar surface and renders the hook output.
- `CallAgentCard` and `CallUserCard` render participant rows.
- `VoiceCallControlPanel` renders join, microphone, speaker-audio, and hang-up actions.
- `VolumeSlider` handles per-participant volume adjustment.
- `useVoiceCall` owns the call lifecycle, LiveKit room state, and participant shaping.
- `voice-call-service` owns backend token request logic.

## Composition boundaries

`VoiceCall` now stays focused on layout composition. Backend integration lives under
`services/`, and the call state machine that uses that backend lives under `hooks/`.
Leaf components stay presentational and accept explicit props or callbacks.

## Extension guidance

Connect real app identity and canvas state at the `VoiceCall` boundary first, then keep passing explicit participant state and action handlers into the leaf components.
