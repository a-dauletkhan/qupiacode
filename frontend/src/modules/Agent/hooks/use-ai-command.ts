import * as React from "react"
import * as aiAgent from "../services/ai-agent-service"
<<<<<<< Updated upstream
import type { AiCommandContext, AiCommandResponse, CommandSource } from "../types"
=======
import type { AiCommandRequest, AiCommandResponse } from "../types"
>>>>>>> Stashed changes

type UseAiCommandOptions = {
  roomId: string
}

export function useAiCommand({ roomId }: UseAiCommandOptions) {
  const [pending, setPending] = React.useState(false)
  const [lastResponse, setLastResponse] = React.useState<AiCommandResponse | null>(null)

  const send = React.useCallback(
    async (request: AiCommandRequest) => {
      setPending(true)
      try {
<<<<<<< Updated upstream
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
=======
        const res = await aiAgent.sendCommand(roomId, request)
>>>>>>> Stashed changes
        setLastResponse(res)
        return res
      } finally {
        setPending(false)
      }
    },
    [roomId],
  )

  return { send, pending, lastResponse }
}
