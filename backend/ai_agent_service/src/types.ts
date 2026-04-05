export type Intensity = "quiet" | "balanced" | "active";

export type AgentStatus = "idle" | "processing" | "acting";

export interface AgentPresence {
  type: "ai_agent";
  status: "watching" | "acting";
  cursor: null;
}

export type CanvasObjectType = "shape" | "text" | "sticky_note";
export type ShapeKind = "rectangle" | "diamond" | "ellipse";
export type TargetPersona = "designer" | "critique" | "marketing";

export interface Position {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface AiMetadata {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  persona?: string;
  personaColor?: string;
}

export interface CanvasNodeData {
  objectType: CanvasObjectType;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
  shapeKind?: ShapeKind;
  zIndex?: number;
  draft?: boolean;
  _ai?: AiMetadata;
  [key: string]: unknown;
}

export interface CanvasNode {
  id: string;
  type: CanvasObjectType;
  position: Position;
  parentId?: string | null;
  width?: number;
  height?: number;
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface CanvasSnapshot {
  roomId: string;
  projectId: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: string[];
  viewport: Viewport;
  agentIntensity?: Intensity;
}

export interface TranscriptSegment {
  utteranceId: string;
  segmentId: string;
  participantIdentity: string | null;
  speakerId: string | null;
  speakerName: string;
  text: string;
  source: "livekit";
  occurredAt: string;
  timestamp: number;
  startTimeMs: number | null;
  endTimeMs: number | null;
}

export type CommandSource = "chat" | "canvas_context_menu";

export interface CommandRequest {
  userId: string;
  userName: string;
  message: string;
  source: CommandSource;
  threadId?: string | null;
  targetPersona?: TargetPersona | null;
  canvasSnapshot: CanvasSnapshot;
}

export interface CreateNodeAction {
  type: "create_node";
  nodeId: string;
  nodeType: CanvasObjectType;
  position: Position;
  parentId?: string | null;
  width?: number;
  height?: number;
  objectType: CanvasObjectType;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
  shapeKind?: ShapeKind;
  zIndex?: number;
}

export interface CreateEdgeAction {
  type: "create_edge";
  edgeId: string;
  source: string;
  target: string;
  label?: string;
}

export interface NodeMutationSnapshot {
  position: Position;
  parentId?: string | null;
  width?: number;
  height?: number;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
  shapeKind?: ShapeKind;
  zIndex?: number;
}

export interface UpdateNodeAction {
  type: "update_node";
  nodeId: string;
  before: NodeMutationSnapshot;
  after: NodeMutationSnapshot;
}

export type AiCanvasAction = CreateNodeAction | CreateEdgeAction | UpdateNodeAction;

export interface PendingActionResponse {
  actionId: string;
  summary: string;
  actions: AiCanvasAction[];
  requiresApproval: true;
}

export interface CommandResponse {
  commandId: string;
  message: string;
  pendingAction: PendingActionResponse | null;
}

export type SemanticEventType =
  | "chat.message.created"
  | "chat.message.mentioned_ai"
  | "canvas.node.created"
  | "canvas.node.drag_ended"
  | "canvas.node.content_committed"
  | "canvas.edge.created"
  | "canvas.edge.deleted"
  | "canvas.selection.changed"
  | "canvas.tool.changed";

export interface ActivityEvent {
  type: SemanticEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface EventsRequest {
  userId: string;
  events: ActivityEvent[];
}

export type RoomEventType =
  | "voice.transcript.final"
  | "chat.message.created"
  | "chat.message.mentioned_ai"
  | "canvas.activity.batch"
  | "canvas.storage.synced"
  | "ai.command.queued"
  | "ai.suggestion.created"
  | "ai.action.pending"
  | "ai.action.approved"
  | "ai.action.rejected"
  | "recording.started"
  | "recording.completed"
  | "recording.failed";

export type RoomEventSource = "livekit" | "frontend" | "liveblocks" | "ai_agent" | "system";
export type RoomEventActorType = "user" | "ai" | "system";

export interface TranscriptIngestionPayload {
  room_id: string;
  utterance_id: string;
  segment_id: string;
  participant_identity: string | null;
  speaker_id: string | null;
  speaker_name: string;
  text: string;
  is_final: boolean;
  start_time_ms: number | null;
  end_time_ms: number | null;
  occurred_at: string;
  source: "livekit";
}

export interface RecordingSystemEventPayload {
  room_id: string;
  room_name: string;
  event_type: "recording.started" | "recording.completed" | "recording.failed";
  occurred_at: string;
  recording_id: string;
  egress_id: string | null;
  status: string;
  storage_provider: "s3";
  storage_bucket: string | null;
  object_path: string | null;
  playback_url: string | null;
  metadata: Record<string, unknown>;
}

export interface PersistedRoomEvent {
  roomId: string;
  eventType: RoomEventType;
  source: RoomEventSource;
  actorType: RoomEventActorType;
  actorId: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
}

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

export interface QueueItem {
  commandId: string;
  userId: string;
  userName: string;
  message: string;
  source: CommandSource;
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
