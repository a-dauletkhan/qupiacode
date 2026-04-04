# VoiceCall Module

## Module purpose

Provides the in-call sidebar UI for displaying the agent, participants, per-user volume controls, and global call actions.

## Main components

- `VoiceCallCard` composes the full sidebar surface.
- `CallAgentCard` and `CallUserCard` render participant rows.
- `VoiceCallControlPanel` renders global microphone and hang-up actions.
- `VolumeSlider` handles per-participant volume adjustment.

## Composition boundaries

`VoiceCallCard` owns layout composition and mock participant data. Leaf components stay presentational and accept explicit props or callbacks.

## Extension guidance

Connect real call state at the `VoiceCallCard` boundary first, then pass participant state and action handlers into the leaf components.
