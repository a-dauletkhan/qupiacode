export type Intensity = "quiet" | "balanced" | "active";

export type AgentStatus = "idle" | "processing" | "acting";

export interface AgentPresence {
  type: "ai_agent";
  status: "watching" | "acting";
  cursor: null;
}

export type CanvasObjectType = "shape" | "text" | "sticky_note";
export type ShapeKind = "rectangle" | "diamond" | "ellipse";
export type PaintStyle = "solid" | "outline" | "sketch" | "hatch";
export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "medium" | "bold";

export interface Position {
  x: number;
  y: number;
}

export interface ShapeData {
  type: "shape";
  shapeKind: ShapeKind;
  color: string;
  paintStyle: PaintStyle;
  strokeWidth: number;
  label?: string;
}

export interface TextData {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
  fontWeight: FontWeight;
  align: TextAlign;
}

export interface StickyNoteData {
  type: "sticky_note";
  text: string;
  color: string;
  textColor: string;
  fontSize: number;
}

export type CanvasNodeData = ShapeData | TextData | StickyNoteData;

export interface CanvasNode {
  id: string;
  type: CanvasObjectType;
  position: Position;
  width?: number;
  height?: number;
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface TranscriptSegment {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

// --- AI Metadata ---

export interface AiMetadata {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

// --- Command API ---

export type CommandSource = "chat" | "canvas_context_menu";

export interface CommandContext {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  viewport: { x: number; y: number; zoom: number };
  source: CommandSource;
}

export interface CommandRequest {
  userId: string;
  userName: string;
  message: string;
  context: CommandContext;
}

export interface CommandResponse {
  commandId: string;
  status: "queued";
  position: number;
  estimatedWaitMs: number;
}

// --- Activity Events API ---

export type ActivityEventType =
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
  | "edge:created";

export interface ActivityEvent {
  type: ActivityEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface EventsRequest {
  userId: string;
  events: ActivityEvent[];
}

// --- Feedback API ---

export interface FeedbackRequest {
  userId: string;
  actionId: string;
  nodeIds: string[];
  edgeIds: string[];
  status: "approved" | "rejected";
  reason?: string;
}

export interface FeedbackResponse {
  ok: boolean;
  actionId: string;
  status: "approved" | "rejected";
}

// --- Queue ---

export interface QueueItem {
  commandId: string;
  userId: string;
  userName: string;
  message: string;
  context: CommandContext;
  queuedAt: number;
}

export interface AgentAction {
  actionId: string;
  commandId: string | null;
  type: "canvas_mutation";
  nodeIds: string[];
  edgeIds: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

export interface QueueStatusResponse {
  agentStatus: AgentStatus;
  currentCommand: {
    commandId: string;
    userId: string;
    userName: string;
    message: string;
    startedAt: number;
  } | null;
  queue: Array<{
    commandId: string;
    userId: string;
    userName: string;
    message: string;
    queuedAt: number;
    position: number;
  }>;
  recentActions: AgentAction[];
}
