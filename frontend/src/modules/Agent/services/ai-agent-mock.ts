/**
 * Mock implementation of the AI Agent backend.
 *
 * Simulates all four endpoints locally so the frontend can be developed
 * and tested before the real backend is wired up.
 *
 * Swap with the real service by changing the import in the consumer:
 *   import * as aiAgent from "./ai-agent-mock"   // dev
 *   import * as aiAgent from "./ai-agent-service" // prod
 */

import type {
  AiCommandRequest,
  AiCommandResponse,
  AiEventsRequest,
  AiEventsResponse,
  AiFeedbackRequest,
  AiFeedbackResponse,
  AiQueueResponse,
  AgentProcessingStatus,
  QueuedCommand,
  RecentAction,
} from "../types"

// ---------------------------------------------------------------------------
// Internal mock state
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mock endpoint: sendCommand
// ---------------------------------------------------------------------------

export async function sendCommand(
  roomId: string,
  req: AiCommandRequest,
): Promise<AiCommandResponse> {
  await delay(150) // simulate network

  const commandId = uid("cmd", nextCmdId++)
  const queue = roomQueue(roomId)

  queue.push({
    commandId,
    userId: req.userId,
    userName: req.userName,
    message: req.message,
    queuedAt: Date.now(),
    position: queue.length + 1,
  })

  // Simulate async processing: after 2s, produce a mock action
  statuses.set(roomId, "processing")
  setTimeout(() => {
    simulateAction(roomId, commandId, req)
  }, 2000)

  return {
    commandId,
    status: "queued",
    position: queue.length,
    estimatedWaitMs: queue.length * 2000,
  }
}

// ---------------------------------------------------------------------------
// Mock endpoint: sendEvents
// ---------------------------------------------------------------------------

export async function sendEvents(
  _roomId: string,
  req: AiEventsRequest,
): Promise<AiEventsResponse> {
  await delay(50)
  // In the real backend these feed the ContextAccumulator.
  // In the mock we just acknowledge them.
  console.debug("[ai-agent-mock] received events:", req.events.length)
  return { accepted: req.events.length }
}

// ---------------------------------------------------------------------------
// Mock endpoint: sendFeedback
// ---------------------------------------------------------------------------

export async function sendFeedback(
  roomId: string,
  req: AiFeedbackRequest,
): Promise<AiFeedbackResponse> {
  await delay(100)

  const actions = roomActions(roomId)
  const action = actions.find((a) => a.actionId === req.actionId)
  if (action) {
    action.status = req.status
  }

  console.debug(
    `[ai-agent-mock] feedback: ${req.actionId} → ${req.status}`,
    req.reason ?? "",
  )

  return {
    ok: true,
    actionId: req.actionId,
    status: req.status,
  }
}

// ---------------------------------------------------------------------------
// Mock endpoint: getQueue
// ---------------------------------------------------------------------------

export async function getQueue(roomId: string): Promise<AiQueueResponse> {
  await delay(50)

  const queue = roomQueue(roomId)
  const actions = roomActions(roomId)
  const status = statuses.get(roomId) ?? "idle"

  const current = status !== "idle" && queue.length > 0 ? queue[0] : null

  return {
    agentStatus: status,
    currentCommand: current
      ? {
          commandId: current.commandId,
          userId: current.userId,
          userName: current.userName,
          message: current.message,
          startedAt: current.queuedAt,
        }
      : null,
    queue: queue.slice(1).map((q, i) => ({ ...q, position: i + 1 })),
    recentActions: actions.slice(-10),
  }
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

/**
 * Simulates the AI processing a command and producing canvas mutations.
 *
 * In the real system, the AI Agent Service would:
 * 1. Read current canvas state from Liveblocks
 * 2. Call the LLM with canvas tools
 * 3. Execute tool calls → write to Liveblocks storage
 *
 * Here we dispatch a CustomEvent that the frontend mock layer can listen to.
 * The frontend hooks pick up this event and apply the mutations locally.
 */
function simulateAction(
  roomId: string,
  commandId: string,
  req: AiCommandRequest,
) {
  const actionId = uid("act", nextActionId++)
  const actions = roomActions(roomId)
  const queue = roomQueue(roomId)

  // Build mock AI response based on the command content
  const mockNodes = buildMockResponse(req, actionId)

  const action: RecentAction = {
    actionId,
    commandId,
    type: "canvas_mutation",
    nodeIds: mockNodes.map((n) => n.id),
    edgeIds: [],
    status: "pending",
    createdAt: Date.now(),
  }

  actions.push(action)

  // Remove processed command from queue
  const idx = queue.findIndex((q) => q.commandId === commandId)
  if (idx !== -1) queue.splice(idx, 1)

  // Dispatch event for frontend to pick up
  window.dispatchEvent(
    new CustomEvent("ai-agent:action", {
      detail: {
        roomId,
        actionId,
        commandId,
        requestedBy: req.userId,
        nodes: mockNodes,
        edges: [] as MockEdge[],
        chatMessage: `Re: ${req.userName}'s request — "${req.message}". I've added ${mockNodes.length} item(s) to the canvas.`,
      },
    }),
  )

  statuses.set(roomId, "idle")
}

type MockNode = {
  id: string
  type: "shape" | "text" | "sticky_note"
  position: { x: number; y: number }
  width: number
  height: number
  data: Record<string, unknown>
}

type MockEdge = {
  id: string
  source: string
  target: string
  label?: string
  data: Record<string, unknown>
}

function buildMockResponse(req: AiCommandRequest, actionId: string): MockNode[] {
  const message = req.message.toLowerCase()
  const baseX = req.context.viewport?.x ?? 200
  const baseY = req.context.viewport?.y ?? 200

  const aiMeta = {
    _ai: {
      actionId,
      commandId: null as string | null,
      requestedBy: req.userId,
      status: "pending" as const,
      createdAt: Date.now(),
    },
  }

  // Simulate different responses based on keywords
  if (message.includes("organize") || message.includes("group")) {
    return [
      {
        id: `ai-${actionId}-1`,
        type: "sticky_note",
        position: { x: baseX + 50, y: baseY + 50 },
        width: 200,
        height: 100,
        data: {
          objectType: "sticky_note",
          content: { text: "Organized group" },
          style: {
            color: "oklch(0.92 0.17 122)",
            textColor: "oklch(0.145 0 0)",
            fontSize: 14,
          },
          zIndex: 10,
          ...aiMeta,
        },
      },
    ]
  }

  if (message.includes("label") || message.includes("annotate")) {
    return [
      {
        id: `ai-${actionId}-1`,
        type: "text",
        position: { x: baseX + 20, y: baseY - 30 },
        width: 180,
        height: 40,
        data: {
          objectType: "text",
          content: { text: "AI-generated label" },
          style: {
            color: "oklch(0.768 0.233 130.85)",
            fontSize: 16,
            fontWeight: "normal",
            align: "left",
          },
          zIndex: 10,
          ...aiMeta,
        },
      },
    ]
  }

  if (message.includes("connect") || message.includes("flow")) {
    return [
      {
        id: `ai-${actionId}-1`,
        type: "shape",
        position: { x: baseX + 100, y: baseY + 100 },
        width: 150,
        height: 80,
        data: {
          objectType: "shape",
          shapeKind: "rectangle",
          content: { label: "New Step" },
          style: {
            color: "oklch(0.72 0.16 240)",
            paintStyle: "solid",
            strokeWidth: 2,
          },
          zIndex: 10,
          ...aiMeta,
        },
      },
    ]
  }

  // Default: create a sticky note with the AI's "thought"
  return [
    {
      id: `ai-${actionId}-1`,
      type: "sticky_note",
      position: { x: baseX + 80, y: baseY + 80 },
      width: 200,
      height: 120,
      data: {
        objectType: "sticky_note",
        content: { text: `AI suggestion for: "${req.message}"` },
        style: {
          color: "oklch(0.92 0.17 122)",
          textColor: "oklch(0.145 0 0)",
          fontSize: 14,
        },
        zIndex: 10,
        ...aiMeta,
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Event type for consumers
// ---------------------------------------------------------------------------

export type AiAgentActionEvent = CustomEvent<{
  roomId: string
  actionId: string
  commandId: string
  requestedBy: string
  nodes: MockNode[]
  edges: MockEdge[]
  chatMessage: string
}>
