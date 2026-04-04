import { MicIcon, PhoneOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type VoiceCallControlPanelProps = React.ComponentProps<"div"> & {
  inCall?: boolean
  onJoinCall?: () => void
  onToggleMicrophone?: () => void
  onEndCall?: () => void
}

export function VoiceCallControlPanel({
  className,
  inCall = false,
  onJoinCall,
  onToggleMicrophone,
  onEndCall,
  ...props
}: VoiceCallControlPanelProps) {
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
          >
            <MicIcon />
            <span className="sr-only">Toggle microphone</span>
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={onEndCall}
          >
            <PhoneOffIcon />
            <span className="sr-only">End call</span>
          </Button>
        </>
      ) : (
        <Button type="button" variant={"default"} onClick={onJoinCall}>
          Join call
        </Button>
      )}
    </div>
  )
}
