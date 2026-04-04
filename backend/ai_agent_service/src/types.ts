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
