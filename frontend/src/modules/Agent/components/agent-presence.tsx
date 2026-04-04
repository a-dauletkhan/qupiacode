import { useOthers } from "@liveblocks/react/suspense"
import { Bot } from "lucide-react"

export function AgentPresence() {
  const others = useOthers()
  const agent = others.find((o) => o.presence.type === "ai_agent")

  if (!agent) return null

  const status = agent.presence.status ?? "watching"

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
      <Bot className="size-3.5 text-lime-500" />
      <span className="text-muted-foreground">AI Agent</span>
      <span
        className={
          status === "acting"
            ? "text-lime-500 animate-pulse"
            : "text-muted-foreground"
        }
      >
        {status === "acting" ? "acting..." : "watching"}
      </span>
    </div>
  )
}
