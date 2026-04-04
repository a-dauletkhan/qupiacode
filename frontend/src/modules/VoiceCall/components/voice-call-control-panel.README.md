# VoiceCallControlPanel

## Purpose

Renders call action buttons for joining, microphone toggling, and ending the call.

## Owned state

None. Actions are delegated through optional callback props.

## Props

- `inCall` - switches between the join-call state and the active-call controls.
- `isWorking` - disables interactions while the parent is joining or ending a call.
- `microphoneEnabled` - controls whether the mic button shows the muted or unmuted icon.
- `microphoneAvailable` - disables the mic button when browser capture is unavailable.
- `needsAudioResume` - shows an extra speaker-audio recovery action when autoplay is blocked.
- `onJoinCall` - called when the join-call button is pressed.
- `onToggleMicrophone` - called when the microphone button is pressed.
- `onResumeAudio` - called when the speaker-audio recovery action is pressed.
- `onEndCall` - called when the end-call button is pressed.
- `className` and native `div` props are forwarded to the wrapper.

## Dependencies

- `Button` from `@/components/ui/button`
- `MicIcon` and `PhoneOffIcon` from `lucide-react`

## Integration notes

The parent component owns placement and call state. Keep positioning styles on the parent when embedding this control panel.

## Known limits

The component stays intentionally dumb and depends on the parent to decide connection, microphone, and speaker-autoplay state.
