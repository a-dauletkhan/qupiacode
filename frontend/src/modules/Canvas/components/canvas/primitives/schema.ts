import type { Edge, Node } from "@xyflow/react"
import {
  Circle,
  Hand,
  Image as ImageIcon,
  MousePointer2,
  Square,
  StickyNote,
  Type,
  type LucideIcon,
} from "lucide-react"

export type ToolId =
  | "hand"
  | "selection"
  | "rectangle"
  | "ellipse"
  | "sticky_note"
  | "arrow"
  | "line"
  | "draw"
  | "text"
  | "image"
  | "eraser"

export type ShapeKind = Extract<ToolId, "rectangle" | "ellipse">
export type CanvasCreationTool = ShapeKind | "text" | "sticky_note" | "image"
export type CanvasObjectType = "shape" | "text" | "sticky_note"
export type PrimitivePaintStyle = "solid" | "outline" | "sketch" | "hatch"
export type CanvasTextAlign = "left" | "center" | "right"
export type CanvasFontWeight = "normal" | "medium" | "bold"

export type ShapeStylePreset = {
  color: string
  paintStyle: PrimitivePaintStyle
  strokeWidth: number
}

export type TextStylePreset = {
  color: string
  fontSize: number
  fontWeight: CanvasFontWeight
  align: CanvasTextAlign
}

export type StickyNoteStylePreset = {
  color: string
  textColor: string
  fontSize: number
}

export type CanvasEditorDefaults = {
  shape: ShapeStylePreset
  text: TextStylePreset
  stickyNote: StickyNoteStylePreset
}

type BaseCanvasObjectData<ObjectType extends CanvasObjectType, Content, Style> = {
  objectType: ObjectType
  content: Content
  style: Style
  zIndex: number
  draft?: boolean
}

export type ShapeObjectData = BaseCanvasObjectData<
  "shape",
  {
    label: string
    imageUrl?: string
    requestId?: string
    generationStatus?: string
    generationError?: string
    statusUrl?: string
    cancelUrl?: string
  },
  ShapeStylePreset
> & {
  shapeKind: ShapeKind
  sourceTool?: ShapeKind | "image"
}

export type TextObjectData = BaseCanvasObjectData<
  "text",
  { text: string },
  TextStylePreset
>

export type StickyNoteObjectData = BaseCanvasObjectData<
  "sticky_note",
  { text: string },
  StickyNoteStylePreset
>

export type CanvasObjectData =
  | ShapeObjectData
  | TextObjectData
  | StickyNoteObjectData

export type ShapeNode = Node<ShapeObjectData, "shape">
export type TextNode = Node<TextObjectData, "text">
export type StickyNoteNode = Node<StickyNoteObjectData, "sticky_note">
export type CanvasObjectNode = ShapeNode | TextNode | StickyNoteNode

export type CanvasObjectRect = {
  x: number
  y: number
  width: number
  height: number
}

export type ToolConfig = {
  id: ToolId
  label: string
  shortcut: string
  icon: LucideIcon
  fillable?: boolean
  implemented: boolean
}

export type PaintStyleOption = {
  id: PrimitivePaintStyle
  label: string
  description: string
}

export type ColorSwatch = {
  label: string
  value: string
}

export const DEFAULT_CANVAS_COLOR = "oklch(0.768 0.233 130.85)"
export const DEFAULT_STICKY_NOTE_COLOR = "oklch(0.92 0.17 122)"
export const DEFAULT_STICKY_NOTE_TEXT_COLOR = "oklch(0.145 0 0)"
export const DRAFT_CANVAS_OBJECT_ID = "canvas-object-draft"

export const COLOR_SWATCHS: ColorSwatch[] = [
  { label: "Lime", value: "oklch(0.768 0.233 130.85)" },
  { label: "Sun", value: "oklch(0.86 0.18 95)" },
  { label: "Sky", value: "oklch(0.72 0.16 240)" },
  { label: "Coral", value: "oklch(0.72 0.19 28)" },
]

export const TEXT_COLOR_SWATCHS: ColorSwatch[] = [
  { label: "Ink", value: "oklch(0.145 0 0)" },
  { label: "Slate", value: "oklch(0.34 0 0)" },
  { label: "Paper", value: "oklch(0.985 0 0)" },
  { label: "Forest", value: "oklch(0.42 0.11 146)" },
]

export const DEFAULT_EDITOR_DEFAULTS: CanvasEditorDefaults = {
  shape: {
    color: DEFAULT_CANVAS_COLOR,
    paintStyle: "solid",
    strokeWidth: 2,
  },
  text: {
    color: DEFAULT_CANVAS_COLOR,
    fontSize: 24,
    fontWeight: "normal",
    align: "left",
  },
  stickyNote: {
    color: DEFAULT_STICKY_NOTE_COLOR,
    textColor: DEFAULT_STICKY_NOTE_TEXT_COLOR,
    fontSize: 20,
  },
}

export const TOOL_CONFIGS: ToolConfig[] = [
  { id: "hand", label: "Hand", shortcut: "H", icon: Hand, implemented: true },
  {
    id: "selection",
    label: "Selection",
    shortcut: "1",
    icon: MousePointer2,
    fillable: true,
    implemented: true,
  },
  {
    id: "rectangle",
    label: "Rectangle",
    shortcut: "2",
    icon: Square,
    fillable: true,
    implemented: true,
  },
  {
    id: "ellipse",
    label: "Ellipse",
    shortcut: "4",
    icon: Circle,
    fillable: true,
    implemented: true,
  },
  {
    id: "sticky_note",
    label: "Sticky note",
    shortcut: "5",
    icon: StickyNote,
    fillable: true,
    implemented: true,
  },
  { id: "text", label: "Text", shortcut: "6", icon: Type, implemented: true },
  {
    id: "image",
    label: "Insert image",
    shortcut: "7",
    icon: ImageIcon,
    implemented: true,
    fillable: true,
  },
]

export const PAINT_STYLE_OPTIONS: PaintStyleOption[] = [
  {
    id: "solid",
    label: "Solid",
    description: "Filled color with a crisp outline.",
  },
  {
    id: "outline",
    label: "Outline",
    description: "No fill, just a structural stroke.",
  },
  {
    id: "sketch",
    label: "Sketch",
    description: "Loose hand-drawn edge with a soft fill.",
  },
  {
    id: "hatch",
    label: "Hatch",
    description: "Diagonal stripe texture with a translucent fill.",
  },
]

export const SHAPE_KIND_OPTIONS = [
  { value: "rectangle", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
] as const

export const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const

export const FONT_WEIGHT_OPTIONS = [
  { value: "normal", label: "Regular" },
  { value: "medium", label: "Medium" },
  { value: "bold", label: "Bold" },
] as const

const SHAPE_TOOL_IDS = new Set<ShapeKind>(["rectangle", "ellipse"])
const CANVAS_CREATION_TOOLS = new Set<CanvasCreationTool>([
  "rectangle",
  "ellipse",
  "text",
  "sticky_note",
  "image",
])

export function isShapeTool(tool: ToolId): tool is ShapeKind {
  return SHAPE_TOOL_IDS.has(tool as ShapeKind)
}

export function isCanvasCreationTool(
  tool: ToolId
): tool is CanvasCreationTool {
  return CANVAS_CREATION_TOOLS.has(tool as CanvasCreationTool)
}

export function isShapeNode(
  node: CanvasObjectNode | null | undefined
): node is ShapeNode {
  return Boolean(node && node.data.objectType === "shape")
}

export function isImagePlaceholderNode(
  node: CanvasObjectNode | ShapeNode | null | undefined
): node is ShapeNode {
  return Boolean(node && node.data.objectType === "shape" && node.data.sourceTool === "image")
}

export function isTextNode(
  node: CanvasObjectNode | null | undefined
): node is TextNode {
  return Boolean(node && node.data.objectType === "text")
}

export function isStickyNoteNode(
  node: CanvasObjectNode | null | undefined
): node is StickyNoteNode {
  return Boolean(node && node.data.objectType === "sticky_note")
}

export function getShapeLabel(shapeKind: ShapeKind) {
  switch (shapeKind) {
    case "rectangle":
      return "Rectangle"
    case "ellipse":
      return "Ellipse"
  }
}

export function clampStrokeWidth(value: number) {
  return Math.min(8, Math.max(1, Math.round(value)))
}

export function clampFontSize(value: number) {
  return Math.min(72, Math.max(12, Math.round(value)))
}

export function normalizeCanvasRect(
  start: { x: number; y: number },
  end: { x: number; y: number }
): CanvasObjectRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function expandCanvasRect(
  point: { x: number; y: number },
  width: number,
  height: number
): CanvasObjectRect {
  return {
    x: point.x - width / 2,
    y: point.y - height / 2,
    width,
    height,
  }
}

export function getCanvasObjectSize(node: CanvasObjectNode) {
  const width =
    Number(node.measured?.width) ||
    Number(node.width) ||
    Number(node.style?.width) ||
    0
  const height =
    Number(node.measured?.height) ||
    Number(node.height) ||
    Number(node.style?.height) ||
    0

  return { width, height }
}

export function createShapeNode(params: {
  id: string
  shapeKind: ShapeKind
  rect: CanvasObjectRect
  preset?: ShapeStylePreset
  label?: string
  sourceTool?: ShapeKind | "image"
  selected?: boolean
  draft?: boolean
}): ShapeNode {
  const preset = params.preset ?? DEFAULT_EDITOR_DEFAULTS.shape

  return {
    id: params.id,
    type: "shape",
    position: { x: params.rect.x, y: params.rect.y },
    style: {
      width: params.rect.width,
      height: params.rect.height,
    },
    selected: params.selected,
    draggable: !params.draft,
    selectable: !params.draft,
    focusable: !params.draft,
    data: {
      objectType: "shape",
      shapeKind: params.shapeKind,
      sourceTool: params.sourceTool ?? params.shapeKind,
      zIndex: 0,
      draft: params.draft,
      content: {
        label: params.label ?? getShapeLabel(params.shapeKind),
      },
      style: {
        color: preset.color,
        paintStyle: preset.paintStyle,
        strokeWidth: clampStrokeWidth(preset.strokeWidth),
      },
    },
  }
}

export function createTextNode(params: {
  id: string
  rect: CanvasObjectRect
  preset?: TextStylePreset
  text?: string
  selected?: boolean
  draft?: boolean
}): TextNode {
  const preset = params.preset ?? DEFAULT_EDITOR_DEFAULTS.text

  return {
    id: params.id,
    type: "text",
    position: { x: params.rect.x, y: params.rect.y },
    style: {
      width: params.rect.width,
      height: params.rect.height,
    },
    selected: params.selected,
    draggable: !params.draft,
    selectable: !params.draft,
    focusable: !params.draft,
    data: {
      objectType: "text",
      zIndex: 0,
      draft: params.draft,
      content: {
        text: params.text ?? "",
      },
      style: {
        color: preset.color,
        fontSize: clampFontSize(preset.fontSize),
        fontWeight: preset.fontWeight,
        align: preset.align,
      },
    },
  }
}

export function createStickyNoteNode(params: {
  id: string
  rect: CanvasObjectRect
  preset?: StickyNoteStylePreset
  text?: string
  selected?: boolean
  draft?: boolean
}): StickyNoteNode {
  const preset = params.preset ?? DEFAULT_EDITOR_DEFAULTS.stickyNote

  return {
    id: params.id,
    type: "sticky_note",
    position: { x: params.rect.x, y: params.rect.y },
    style: {
      width: params.rect.width,
      height: params.rect.height,
    },
    selected: params.selected,
    draggable: !params.draft,
    selectable: !params.draft,
    focusable: !params.draft,
    data: {
      objectType: "sticky_note",
      zIndex: 0,
      draft: params.draft,
      content: {
        text: params.text ?? "",
      },
      style: {
        color: preset.color,
        textColor: preset.textColor,
        fontSize: clampFontSize(preset.fontSize),
      },
    },
  }
}

export const initialEdges: Edge[] = []
