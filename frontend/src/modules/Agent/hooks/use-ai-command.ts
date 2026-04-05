import * as React from "react"

import * as aiAgent from "../services/ai-agent-service"
import type { AiCommandRequest, AiCommandResponse } from "../types"

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
        const response = await aiAgent.sendCommand(roomId, request)
        setLastResponse(response)
        return response
      } finally {
        setPending(false)
      }
    },
    [roomId],
  )

  return { send, pending, lastResponse }
}
