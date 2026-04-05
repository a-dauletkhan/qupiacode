import * as React from "react"
import { useAiCommand } from "../hooks/use-ai-command"
import { useAiFeedback } from "../hooks/use-ai-feedback"
import { useAiEventBatcher } from "../hooks/use-ai-event-batcher"
import { useAiQueue } from "../hooks/use-ai-queue"
import type {
  AiChatPersona,
  AiCommandResponse,
  AiEvent,
  AiPendingAction,
  AiTargetPersona,
  AiQueueResponse,
  CanvasSnapshot,
  CommandSource,
} from "../types"

type OnCanvasAction = (action: {
  type: "approve" | "reject"
  nodeIds: string[]
  edgeIds: string[]
  actionId: string
  pendingAction: AiPendingAction | null
}) => void

type ApplyPendingAction = (pendingAction: AiPendingAction) => void

type SendCommandOptions = {
  source: CommandSource
  threadId?: string | null
  targetPersona?: AiTargetPersona | null
  chatPersona?: AiChatPersona | null
}

type AiAgentContextValue = {
  roomId: string
  userId: string
  userName: string
  activePersona: AiChatPersona | null
  sendCommand: (message: string, options: SendCommandOptions) => Promise<AiCommandResponse>
  commandPending: boolean
  approve: (actionId: string, nodeIds: string[], edgeIds: string[]) => Promise<unknown>
  reject: (actionId: string, nodeIds: string[], edgeIds: string[], reason?: string) => Promise<unknown>
  feedbackPending: boolean
  pushEvent: (event: Pick<AiEvent, "type" | "data">) => void
  queue: AiQueueResponse
  getPendingAction: (actionId: string) => AiPendingAction | null
  registerCanvasAction: (cb: OnCanvasAction) => () => void
  registerCanvasSnapshotProvider: (cb: () => CanvasSnapshot) => () => void
  registerPendingActionApplier: (cb: ApplyPendingAction) => () => void
  _notifyCanvasAction: OnCanvasAction
}

const AiAgentContext = React.createContext<AiAgentContextValue | null>(null)

type AiAgentProviderProps = {
  roomId: string
  userId: string
  userName: string
  children: React.ReactNode
}

export function AiAgentProvider({ roomId, userId, userName, children }: AiAgentProviderProps) {
  const command = useAiCommand({ roomId })
  const feedback = useAiFeedback({ roomId, userId })
  const batcher = useAiEventBatcher({ roomId, userId })
  const queue = useAiQueue({ roomId })
  const [activePersona, setActivePersona] = React.useState<AiChatPersona | null>(null)
  const canvasActionCallbacks = React.useRef(new Set<OnCanvasAction>())
  const pendingActionAppliers = React.useRef(new Set<ApplyPendingAction>())
  const pendingActionsRef = React.useRef(new Map<string, AiPendingAction>())
  const snapshotProviderRef = React.useRef<() => CanvasSnapshot>(() => ({
    roomId,
    projectId: roomId,
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }))

  const registerCanvasAction = React.useCallback((cb: OnCanvasAction) => {
    canvasActionCallbacks.current.add(cb)
    return () => {
      canvasActionCallbacks.current.delete(cb)
    }
  }, [])

  const registerCanvasSnapshotProvider = React.useCallback((cb: () => CanvasSnapshot) => {
    snapshotProviderRef.current = cb
    return () => {
      snapshotProviderRef.current = () => ({
        roomId,
        projectId: roomId,
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      })
    }
  }, [roomId])

  const registerPendingActionApplier = React.useCallback((cb: ApplyPendingAction) => {
    pendingActionAppliers.current.add(cb)
    return () => {
      pendingActionAppliers.current.delete(cb)
    }
  }, [])

  const notifyCanvasAction = React.useCallback<OnCanvasAction>((action) => {
    canvasActionCallbacks.current.forEach((cb) => cb(action))
  }, [])

  const getPendingAction = React.useCallback((actionId: string) => {
    return pendingActionsRef.current.get(actionId) ?? null
  }, [])

  const sendCommand = React.useCallback(
    async (message: string, options: SendCommandOptions) => {
      setActivePersona(options.chatPersona ?? null)
      try {
        const response = await command.send({
          userId,
          userName,
          message,
          source: options.source,
          threadId: options.threadId ?? null,
          targetPersona: options.targetPersona ?? null,
          canvasSnapshot: snapshotProviderRef.current(),
        })

        if (response.pendingAction) {
          pendingActionsRef.current.set(response.pendingAction.actionId, response.pendingAction)
          pendingActionAppliers.current.forEach((cb) => cb(response.pendingAction!))
        }

        return response
      } finally {
        setActivePersona(null)
      }
    },
    [command, userId, userName],
  )

  const value = React.useMemo<AiAgentContextValue>(
    () => ({
      roomId,
      userId,
      userName,
      activePersona,
      sendCommand,
      commandPending: command.pending,
      approve: feedback.approve,
      reject: feedback.reject,
      feedbackPending: feedback.pending,
      pushEvent: batcher.push,
      queue,
      getPendingAction,
      registerCanvasAction,
      registerCanvasSnapshotProvider,
      registerPendingActionApplier,
      _notifyCanvasAction: notifyCanvasAction,
    }),
    [
      roomId,
      userId,
      userName,
      activePersona,
      sendCommand,
      command.pending,
      feedback.approve,
      feedback.reject,
      feedback.pending,
      batcher.push,
      queue,
      getPendingAction,
      registerCanvasAction,
      registerCanvasSnapshotProvider,
      registerPendingActionApplier,
      notifyCanvasAction,
    ],
  )

  return <AiAgentContext.Provider value={value}>{children}</AiAgentContext.Provider>
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
