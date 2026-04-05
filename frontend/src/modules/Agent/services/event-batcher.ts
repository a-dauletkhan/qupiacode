/**
 * Batches frontend activity events and flushes them to the AI agent service
 * at a configurable interval (default: 3 seconds).
 *
 * Usage:
 *   const batcher = createEventBatcher(roomId, userId)
 *   batcher.push({ type: "node:selected", data: { nodeIds: ["n1"] } })
 *   // ... automatically flushed every 3s
 *   batcher.destroy() // on unmount
 */

import type { AiEvent, AiEventType } from "../types"
import * as aiAgent from "./ai-agent-service"

const DEFAULT_FLUSH_INTERVAL_MS = 3000

export type EventBatcher = {
  push: (event: Pick<AiEvent, "type" | "data">) => void
  flush: () => void
  destroy: () => void
}

export function createEventBatcher(
  roomId: string,
  userId: string,
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
): EventBatcher {
  let buffer: AiEvent[] = []
  let timer: ReturnType<typeof setInterval> | null = null

  function flush() {
    if (buffer.length === 0) return

    const events = buffer
    buffer = []

    aiAgent.sendEvents(roomId, { userId, events }).catch((err) => {
      console.error("[ai-agent] event batcher flush failed", err)
    })
  }

  timer = setInterval(flush, flushIntervalMs)

  return {
    push(event) {
      buffer.push({
        type: event.type as AiEventType,
        timestamp: Date.now(),
        data: event.data,
      })
    },
    flush,
    destroy() {
      if (timer) clearInterval(timer)
      flush() // flush remaining
    },
  }
}
