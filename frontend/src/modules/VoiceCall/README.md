# VoiceCall Module

## Module purpose

Provides the in-call sidebar UI for displaying the agent, participants, per-user volume controls, and global call actions.

## Main components

- `VoiceCall` composes the sidebar surface and owns the LiveKit integration boundary.
- `CallAgentCard` and `CallUserCard` render participant rows.
- `VoiceCallControlPanel` renders join, microphone, speaker-audio, and hang-up actions.
- `VolumeSlider` handles per-participant volume adjustment.

## Composition boundaries

`VoiceCall` owns layout composition, backend token fetching, LiveKit room state, and participant view-model shaping. Leaf components stay presentational and accept explicit props or callbacks.

## Extension guidance

Connect real app identity and canvas state at the `VoiceCall` boundary first, then keep passing explicit participant state and action handlers into the leaf components.
