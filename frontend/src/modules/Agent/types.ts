import type { ToolId } from "@/modules/Canvas/components/canvas/primitives/schema"

// ---------------------------------------------------------------------------
// AI metadata attached to nodes/edges created by the agent
// ---------------------------------------------------------------------------

export type AiActionStatus = "pending" | "approved" | "rejected"

export type AiMetadata = {
  actionId: string
  commandId: string | null
  requestedBy: string | null
  status: AiActionStatus
  createdAt: number
}

// ---------------------------------------------------------------------------
// Command — explicit user request to the AI
// ---------------------------------------------------------------------------

export type CommandSource = "chat" | "canvas_context_menu"

export type AiCommandContext = {
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  source: CommandSource
}

export type AiCommandRequest = {
  userId: string
  userName: string
  message: string
  context: AiCommandContext
}

export type AiCommandResponse = {
  commandId: string
  status: "queued"
  position: number
  estimatedWaitMs: number
}

// ---------------------------------------------------------------------------
// Activity events — passive frontend tracking
// ---------------------------------------------------------------------------

export type AiEventType =
  | "node:selected"
  | "node:deselected"
  | "node:drag:start"
  | "node:drag:end"
  | "text:edit:start"
  | "text:edit:end"
  | "tool:switched"
  | "undo"
  | "redo"
  | "copy"
  | "paste"
  | "delete"
  | "property:changed"
  | "selection:changed"
  | "edge:created"

export type AiEvent = {
  type: AiEventType
  timestamp: number
  data: Record<string, unknown>
}

export type AiEventsRequest = {
  userId: string
  events: AiEvent[]
}

export type AiEventsResponse = {
  accepted: number
}

// ---------------------------------------------------------------------------
// Feedback — approve / reject AI-generated objects
// ---------------------------------------------------------------------------

export type AiFeedbackStatus = "approved" | "rejected"

export type AiFeedbackRequest = {
  userId: string
  actionId: string
  nodeIds: string[]
  edgeIds: string[]
  status: AiFeedbackStatus
  reason?: string
}

export type AiFeedbackResponse = {
  ok: boolean
  actionId: string
  status: AiFeedbackStatus
}

// ---------------------------------------------------------------------------
// Queue — current AI command queue state
// ---------------------------------------------------------------------------

export type AgentProcessingStatus = "idle" | "processing" | "acting"

export type QueuedCommand = {
  commandId: string
  userId: string
  userName: string
  message: string
  queuedAt: number
  position: number
}

export type RecentAction = {
  actionId: string
  commandId: string | null
  type: "canvas_mutation" | "chat_message"
  nodeIds: string[]
  edgeIds: string[]
  status: AiActionStatus
  createdAt: number
}

export type AiQueueResponse = {
  agentStatus: AgentProcessingStatus
  currentCommand: {
    commandId: string
    userId: string
    userName: string
    message: string
    startedAt: number
  } | null
  queue: QueuedCommand[]
  recentActions: RecentAction[]
}

// ---------------------------------------------------------------------------
// Tool event helpers (for building AiEvent from canvas interactions)
// ---------------------------------------------------------------------------

export type ToolSwitchData = { from: ToolId; to: ToolId }
export type NodeSelectionData = { nodeIds: string[] }
export type NodeDragEndData = { nodeId: string; position: { x: number; y: number } }
export type DeleteData = { nodeIds: string[]; edgeIds: string[] }
export type EdgeCreatedData = { edgeId: string; source: string; target: string }
export type PropertyChangedData = { nodeId: string; property: string; value: unknown }
