import type {
  AiCanvasAction,
  AiCommandRequest,
  AiCommandResponse,
  AiEventsRequest,
  AiEventsResponse,
  AiFeedbackRequest,
  AiFeedbackResponse,
  AiPendingAction,
  AiQueueResponse,
  AgentProcessingStatus,
  QueuedCommand,
  RecentAction,
} from "../types"

let nextCmdId = 1
let nextActionId = 1

const queues = new Map<string, QueuedCommand[]>()
const recentActions = new Map<string, RecentAction[]>()
const statuses = new Map<string, AgentProcessingStatus>()

function roomQueue(roomId: string): QueuedCommand[] {
  if (!queues.has(roomId)) queues.set(roomId, [])
  return queues.get(roomId)!
}

function roomActions(roomId: string): RecentAction[] {
  if (!recentActions.has(roomId)) recentActions.set(roomId, [])
  return recentActions.get(roomId)!
}

function uid(prefix: string, id: number) {
  return `${prefix}-${String(id).padStart(4, "0")}`
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function sendCommand(roomId: string, req: AiCommandRequest): Promise<AiCommandResponse> {
  await delay(120)

  const commandId = uid("cmd", nextCmdId++)
  const actionId = uid("act", nextActionId++)
  const queue = roomQueue(roomId)
  const actions = roomActions(roomId)

  queue.push({
    commandId,
    userId: req.userId,
    userName: req.userName,
    message: req.message,
    queuedAt: Date.now(),
    position: queue.length + 1,
  })
  statuses.set(roomId, "processing")

  const pendingAction = buildMockPendingAction(req, actionId)
  actions.push({
    actionId,
    commandId,
    type: "canvas_mutation",
    nodeIds: pendingAction.actions
      .filter((action): action is Extract<AiCanvasAction, { type: "create_node" }> => action.type === "create_node")
      .map((action) => action.nodeId),
    edgeIds: pendingAction.actions
      .filter((action): action is Extract<AiCanvasAction, { type: "create_edge" }> => action.type === "create_edge")
      .map((action) => action.edgeId),
    status: "pending",
    createdAt: Date.now(),
  })

  queue.shift()
  statuses.set(roomId, "idle")

  return {
    commandId,
    message: `Mock AI reviewed "${req.message}" using the current snapshot and prepared a pending draft.`,
    pendingAction,
  }
}

export async function sendEvents(_roomId: string, req: AiEventsRequest): Promise<AiEventsResponse> {
  await delay(40)
  return { accepted: req.events.length }
}

export async function sendFeedback(roomId: string, req: AiFeedbackRequest): Promise<AiFeedbackResponse> {
  await delay(80)
  const actions = roomActions(roomId)
  const action = actions.find((entry) => entry.actionId === req.actionId)
  if (action) {
    action.status = req.status
  }
  return {
    ok: true,
    actionId: req.actionId,
    status: req.status,
  }
}

export async function getQueue(roomId: string): Promise<AiQueueResponse> {
  await delay(40)
  return {
    agentStatus: statuses.get(roomId) ?? "idle",
    currentCommand: null,
    queue: roomQueue(roomId),
    recentActions: roomActions(roomId).slice(-10),
  }
}

function buildMockPendingAction(req: AiCommandRequest, actionId: string): AiPendingAction {
  const baseX = req.canvasSnapshot.viewport.x + 120
  const baseY = req.canvasSnapshot.viewport.y + 120
  const actions: AiCanvasAction[] = [
    {
      type: "create_node",
      nodeId: `ai-${actionId}-1`,
      nodeType: "sticky_note",
      objectType: "sticky_note",
      position: { x: baseX, y: baseY },
      width: 220,
      height: 140,
      content: {
        text: `Mock AI draft for "${req.message}"`,
      },
      style: {
        color: "oklch(0.92 0.17 122)",
        textColor: "oklch(0.145 0 0)",
        fontSize: 20,
      },
      zIndex: 10,
    },
  ]

  return {
    actionId,
    summary: `Mock draft prepared for "${req.message}"`,
    actions,
    requiresApproval: true,
  }
}
