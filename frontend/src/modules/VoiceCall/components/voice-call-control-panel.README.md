# VoiceCallControlPanel

## Purpose

Renders call action buttons for joining, microphone toggling, and ending the call.

## Owned state

None. Actions are delegated through optional callback props.

## Props

- `inCall` - switches between the join-call state and the active-call controls.
- `onJoinCall` - called when the join-call button is pressed.
- `onToggleMicrophone` - called when the microphone button is pressed.
- `onEndCall` - called when the end-call button is pressed.
- `className` and native `div` props are forwarded to the wrapper.

## Dependencies

- `Button` from `@/components/ui/button`
- `MicIcon` and `PhoneOffIcon` from `lucide-react`

## Integration notes

The parent component owns placement and call state. Keep positioning styles on the parent when embedding this control panel.

## Known limits

The component does not manage muted state yet, so icon state remains static until that prop is introduced.
