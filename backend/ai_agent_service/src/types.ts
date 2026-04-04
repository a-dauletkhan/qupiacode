export type Intensity = "quiet" | "balanced" | "active";

export type AgentStatus = "watching" | "acting";

export interface AgentPresence {
  type: "ai_agent";
  status: AgentStatus;
  intensity: Intensity;
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

// --- AI metadata attached to nodes/edges created by the agent ---

export type AiActionStatus = "pending" | "approved" | "rejected";

export interface AiMetadata {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  status: AiActionStatus;
  createdAt: number;
}

// --- Command (explicit user request) ---

export interface AiCommandRequest {
  userId: string;
  userName: string;
  message: string;
  context: {
    selectedNodeIds: string[];
    selectedEdgeIds: string[];
    viewport: { x: number; y: number; zoom: number };
    source: "chat" | "canvas_context_menu";
  };
}

export interface AiCommandResponse {
  commandId: string;
  status: "queued";
  position: number;
  estimatedWaitMs: number;
}

// --- Activity events (passive frontend tracking) ---

export interface AiActivityEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface AiEventsRequest {
  userId: string;
  events: AiActivityEvent[];
}

// --- Feedback (approve/reject) ---

export interface AiFeedbackRequest {
  userId: string;
  actionId: string;
  nodeIds: string[];
  edgeIds: string[];
  status: "approved" | "rejected";
  reason?: string;
}

// --- Queue item ---

export interface QueuedCommand {
  commandId: string;
  userId: string;
  userName: string;
  message: string;
  context: AiCommandRequest["context"];
  queuedAt: number;
}
