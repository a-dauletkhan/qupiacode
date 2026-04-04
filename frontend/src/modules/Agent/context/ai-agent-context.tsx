import * as React from "react"
import { useAiCommand } from "../hooks/use-ai-command"
import { useAiFeedback } from "../hooks/use-ai-feedback"
import { useAiEventBatcher } from "../hooks/use-ai-event-batcher"
import { useAiQueue } from "../hooks/use-ai-queue"
import type { AiEvent, AiQueueResponse, CommandSource } from "../types"

type AiAgentContextValue = {
  roomId: string
  userId: string
  userName: string
  sendCommand: (message: string, context: { selectedNodeIds?: string[]; selectedEdgeIds?: string[]; viewport?: { x: number; y: number; zoom: number }; source: CommandSource }) => Promise<unknown>
  commandPending: boolean
  approve: (actionId: string, nodeIds: string[], edgeIds: string[]) => Promise<unknown>
  reject: (actionId: string, nodeIds: string[], edgeIds: string[], reason?: string) => Promise<unknown>
  feedbackPending: boolean
  pushEvent: (event: Pick<AiEvent, "type" | "data">) => void
  queue: AiQueueResponse
}

const AiAgentContext = React.createContext<AiAgentContextValue | null>(null)

type AiAgentProviderProps = {
  roomId: string
  userId: string
  userName: string
  children: React.ReactNode
}

export function AiAgentProvider({ roomId, userId, userName, children }: AiAgentProviderProps) {
  const command = useAiCommand({ roomId, userId, userName })
  const feedback = useAiFeedback({ roomId, userId })
  const batcher = useAiEventBatcher({ roomId, userId })
  const queue = useAiQueue({ roomId })

  const value = React.useMemo<AiAgentContextValue>(
    () => ({
      roomId,
      userId,
      userName,
      sendCommand: command.send,
      commandPending: command.pending,
      approve: feedback.approve,
      reject: feedback.reject,
      feedbackPending: feedback.pending,
      pushEvent: batcher.push,
      queue,
    }),
    [roomId, userId, userName, command, feedback, batcher, queue],
  )

  return (
    <AiAgentContext.Provider value={value}>
      {children}
    </AiAgentContext.Provider>
  )
}

export function useAiAgent() {
  const context = React.useContext(AiAgentContext)
  if (!context) {
    throw new Error("useAiAgent must be used inside AiAgentProvider")
  }
  return context
}

export function useAiAgentOptional() {
  return React.useContext(AiAgentContext)
}
