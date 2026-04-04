import { cn } from "@/lib/utils"
import {
  CallAgentCard,
  CallUserCard,
} from "@/modules/VoiceCall/components/call-user-card"
import { VoiceCallControlPanel } from "@/modules/VoiceCall/components/voice-call-control-panel"

const callUsers = [
  { id: 1, name: "User 1", status: "Connected", isMuted: false },
  { id: 2, name: "User 2", status: "Connected", isMuted: false },
  { id: 3, name: "User 3", status: "Muted", isMuted: true },
  { id: 4, name: "User 4", status: "Speaking", isMuted: false },
]

export function VoiceCall({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex h-full w-full flex-col justify-between bg-sidebar p-2",
        className
      )}
      {...props}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <CallAgentCard className="mb-3"></CallAgentCard>

        {callUsers.length > 0 ? (
          callUsers.map((user, index) => (
            <CallUserCard
              key={user.id}
              name={user.name}
              status={user.status}
              isMuted={user.isMuted}
              className={index == 0 ? "border-t" : ""}
            />
          ))
        ) : (
          <div className="text-center text-sm text-muted-foreground py-2">
            Nobody here...
          </div>
        )}

        <VoiceCallControlPanel className="absolute bottom-0 left-1/2 -translate-x-1/2" />
      </div>
    </section>
  )
}
