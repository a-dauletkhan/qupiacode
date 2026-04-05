import * as React from "react"
import * as aiAgent from "../services/ai-agent-service"
import type { AiCommandContext, AiCommandResponse, CommandSource } from "../types"

type UseAiCommandOptions = {
  roomId: string
  userId: string
  userName: string
}

export function useAiCommand({ roomId, userId, userName }: UseAiCommandOptions) {
  const [pending, setPending] = React.useState(false)
  const [lastResponse, setLastResponse] = React.useState<AiCommandResponse | null>(null)

  const send = React.useCallback(
    async (message: string, context: Partial<AiCommandContext> & { source: CommandSource }) => {
      setPending(true)
      try {
        const res = await aiAgent.sendCommand(roomId, {
          userId,
          userName,
          message,
          context: {
            selectedNodeIds: context.selectedNodeIds ?? [],
            selectedEdgeIds: context.selectedEdgeIds ?? [],
            viewport: context.viewport ?? { x: 0, y: 0, zoom: 1 },
            source: context.source,
            ...(context.targetPersona !== undefined ? { targetPersona: context.targetPersona } : {}),
          },
        })
        setLastResponse(res)
        return res
      } finally {
        setPending(false)
      }
    },
    [roomId, userId, userName],
  )

  return { send, pending, lastResponse }
}
