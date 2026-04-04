import * as React from "react"
import { createEventBatcher, type EventBatcher } from "../services/event-batcher"
import type { AiEvent } from "../types"

type UseAiEventBatcherOptions = {
  roomId: string
  userId: string
  enabled?: boolean
}

export function useAiEventBatcher({ roomId, userId, enabled = true }: UseAiEventBatcherOptions) {
  const batcherRef = React.useRef<EventBatcher | null>(null)

  React.useEffect(() => {
    if (!enabled) return

    batcherRef.current = createEventBatcher(roomId, userId)

    return () => {
      batcherRef.current?.destroy()
      batcherRef.current = null
    }
  }, [roomId, userId, enabled])

  const push = React.useCallback((event: Pick<AiEvent, "type" | "data">) => {
    batcherRef.current?.push(event)
  }, [])

  return { push }
}
