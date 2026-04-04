import { LoaderCircleIcon, MicIcon, MicOffIcon, PhoneOffIcon, Volume2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type VoiceCallControlPanelProps = React.ComponentProps<"div"> & {
  inCall?: boolean
  isWorking?: boolean
  microphoneEnabled?: boolean
  microphoneAvailable?: boolean
  needsAudioResume?: boolean
  onJoinCall?: () => void
  onToggleMicrophone?: () => void
  onResumeAudio?: () => void
  onEndCall?: () => void
}

export function VoiceCallControlPanel({
  className,
  inCall = false,
  isWorking = false,
  microphoneEnabled = false,
  microphoneAvailable = true,
  needsAudioResume = false,
  onJoinCall,
  onToggleMicrophone,
  onResumeAudio,
  onEndCall,
  ...props
}: VoiceCallControlPanelProps) {
  const MicrophoneIcon = microphoneEnabled ? MicIcon : MicOffIcon

  return (
    <div
      className={cn("flex items-center justify-center gap-3", className)}
      {...props}
    >
      {inCall ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onToggleMicrophone}
            disabled={!microphoneAvailable || isWorking}
          >
            <MicrophoneIcon />
            <span className="sr-only">Toggle microphone</span>
          </Button>

          {needsAudioResume ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onResumeAudio}
              disabled={isWorking}
            >
              <Volume2Icon />
              <span className="sr-only">Enable speaker audio</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={onEndCall}
            disabled={isWorking}
          >
            <PhoneOffIcon />
            <span className="sr-only">End call</span>
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant={"default"}
          onClick={onJoinCall}
          disabled={isWorking}
        >
          {isWorking ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
          {isWorking ? "Joining..." : "Join call"}
        </Button>
      )}
    </div>
  )
}
