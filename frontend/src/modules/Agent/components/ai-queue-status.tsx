import { Bot, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import type { AgentProcessingStatus } from "../types"
import { cn } from "@/lib/utils"

type AiQueueStatusProps = {
  agentStatus: AgentProcessingStatus
  queueLength: number
  currentUserName?: string | null
}

const STATUS_LABELS: Record<AgentProcessingStatus, string> = {
  idle: "watching",
  processing: "thinking...",
  acting: "acting...",
}

export function AiQueueStatus({ agentStatus, queueLength, currentUserName }: AiQueueStatusProps) {
  const isActive = agentStatus !== "idle"

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
      <Bot className="size-3.5 text-lime-500" />
      <span className="text-muted-foreground">AI</span>
      <span
        className={cn(
          isActive ? "text-lime-500" : "text-muted-foreground",
          isActive && "animate-pulse"
        )}
      >
        {STATUS_LABELS[agentStatus]}
      </span>

      <AnimatePresence>
        {currentUserName && isActive && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden truncate text-muted-foreground"
          >
            for {currentUserName}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {queueLength > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1 rounded-md bg-lime-500/10 px-1.5 py-0.5"
          >
            <Loader2 className="size-2.5 animate-spin text-lime-500" />
            <span className="text-[10px] font-medium text-lime-500">
              +{queueLength}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
