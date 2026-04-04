import * as React from "react"
import * as aiAgent from "../services/ai-agent-mock"
import type { AiQueueResponse } from "../types"

const POLL_INTERVAL_MS = 4000

type UseAiQueueOptions = {
  roomId: string
  enabled?: boolean
}

const EMPTY_QUEUE: AiQueueResponse = {
  agentStatus: "idle",
  currentCommand: null,
  queue: [],
  recentActions: [],
}

export function useAiQueue({ roomId, enabled = true }: UseAiQueueOptions) {
  const [data, setData] = React.useState<AiQueueResponse>(EMPTY_QUEUE)

  React.useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function poll() {
      try {
        const res = await aiAgent.getQueue(roomId)
        if (!cancelled) setData(res)
      } catch {
        // silently skip failed polls
      }
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [roomId, enabled])

  return data
}
