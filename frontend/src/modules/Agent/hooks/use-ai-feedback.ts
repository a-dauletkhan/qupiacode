import * as React from "react"
import * as aiAgent from "../services/ai-agent-mock"
import type { AiFeedbackStatus } from "../types"

type UseAiFeedbackOptions = {
  roomId: string
  userId: string
}

export function useAiFeedback({ roomId, userId }: UseAiFeedbackOptions) {
  const [pending, setPending] = React.useState(false)

  const submit = React.useCallback(
    async (
      actionId: string,
      nodeIds: string[],
      edgeIds: string[],
      status: AiFeedbackStatus,
      reason?: string,
    ) => {
      setPending(true)
      try {
        return await aiAgent.sendFeedback(roomId, {
          userId,
          actionId,
          nodeIds,
          edgeIds,
          status,
          reason,
        })
      } finally {
        setPending(false)
      }
    },
    [roomId, userId],
  )

  const approve = React.useCallback(
    (actionId: string, nodeIds: string[], edgeIds: string[]) =>
      submit(actionId, nodeIds, edgeIds, "approved"),
    [submit],
  )

  const reject = React.useCallback(
    (actionId: string, nodeIds: string[], edgeIds: string[], reason?: string) =>
      submit(actionId, nodeIds, edgeIds, "rejected", reason),
    [submit],
  )

  return { approve, reject, pending }
}
