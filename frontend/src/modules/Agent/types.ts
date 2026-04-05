import type { ToolId } from "@/modules/Canvas/components/canvas/primitives/schema"

export type AiActionStatus = "pending" | "approved" | "rejected"

export type AiMetadata = {
  actionId: string
  commandId: string | null
  requestedBy: string | null
  status: AiActionStatus
  createdAt: number
  persona?: string
  personaColor?: string
}

export type CommandSource = "chat" | "canvas_context_menu"
export type AiTargetPersona = "designer" | "critique" | "marketing"
export type AiChatPersona = "agent" | AiTargetPersona

export type CanvasSnapshotNode = {
  id: string
  type: "shape" | "text" | "sticky_note"
  position: { x: number; y: number }
  parentId?: string | null
  width?: number
  height?: number
  data: Record<string, unknown> & {
    objectType: "shape" | "text" | "sticky_note"
    content: Record<string, unknown>
    style: Record<string, unknown>
    shapeKind?: "rectangle" | "diamond" | "ellipse"
    zIndex?: number
    draft?: boolean
    _ai?: AiMetadata
  }
}

export type CanvasSnapshotEdge = {
  id: string
  source: string
  target: string
  label?: string
  data?: Record<string, unknown>
}

export type CanvasSnapshot = {
  roomId: string
  projectId: string
  nodes: CanvasSnapshotNode[]
  edges: CanvasSnapshotEdge[]
  selectedNodeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  agentIntensity?: "quiet" | "balanced" | "active"
}

export type AiCommandRequest = {
  userId: string
  userName: string
  message: string
  source: CommandSource
  threadId?: string | null
  targetPersona?: AiTargetPersona | null
  canvasSnapshot: CanvasSnapshot
}

export type AiCreateNodeAction = {
  type: "create_node"
  nodeId: string
  nodeType: "shape" | "text" | "sticky_note"
  position: { x: number; y: number }
  parentId?: string | null
  width?: number
  height?: number
  objectType: "shape" | "text" | "sticky_note"
  content: Record<string, unknown>
  style: Record<string, unknown>
  shapeKind?: "rectangle" | "diamond" | "ellipse"
  zIndex?: number
}

export type AiCreateEdgeAction = {
  type: "create_edge"
  edgeId: string
  source: string
  target: string
  label?: string
}

export type AiNodeMutationSnapshot = {
  position: { x: number; y: number }
  parentId?: string | null
  width?: number
  height?: number
  content: Record<string, unknown>
  style: Record<string, unknown>
  shapeKind?: "rectangle" | "diamond" | "ellipse"
  zIndex?: number
}

export type AiUpdateNodeAction = {
  type: "update_node"
  nodeId: string
  before: AiNodeMutationSnapshot
  after: AiNodeMutationSnapshot
}

export type AiCanvasAction =
  | AiCreateNodeAction
  | AiCreateEdgeAction
  | AiUpdateNodeAction

export type AiPendingAction = {
  actionId: string
  summary: string
  actions: AiCanvasAction[]
  requiresApproval: true
}

export type AiCommandResponse = {
  commandId: string
  message: string
  pendingAction: AiPendingAction | null
}

export type AiEventType =
  | "chat.message.created"
  | "chat.message.mentioned_ai"
  | "canvas.node.created"
  | "canvas.node.drag_ended"
  | "canvas.node.content_committed"
  | "canvas.edge.created"
  | "canvas.edge.deleted"
  | "canvas.selection.changed"
  | "canvas.tool.changed"

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
  type: "canvas_mutation"
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

export type ToolSwitchData = { from: ToolId; to: ToolId }
export type NodeSelectionData = { nodeIds: string[] }
export type NodeDragEndData = { nodeId: string; position: { x: number; y: number } }
export type DeleteData = { nodeIds: string[]; edgeIds: string[] }
export type EdgeCreatedData = { edgeId: string; source: string; target: string }
export type PropertyChangedData = { nodeId: string; property: string; value: unknown }
