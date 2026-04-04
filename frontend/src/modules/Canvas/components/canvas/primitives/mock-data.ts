import {
  createShapeNode,
  createStickyNoteNode,
  createTextNode,
  initialEdges,
  type CanvasObjectNode,
} from "./schema"

export const initialNodes: CanvasObjectNode[] = [
  createShapeNode({
    id: "shape-rectangle",
    shapeKind: "rectangle",
    rect: { x: 72, y: 92, width: 228, height: 132 },
    preset: {
      color: "oklch(0.768 0.233 130.85)",
      paintStyle: "solid",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "shape-ellipse",
    shapeKind: "ellipse",
    rect: { x: 382, y: 48, width: 172, height: 172 },
    preset: {
      color: "oklch(0.768 0.233 130.85)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createTextNode({
    id: "text-brief",
    rect: { x: 640, y: 70, width: 220, height: 92 },
    text: "Canvas objects now map cleanly onto backend-friendly types.",
  }),
  createStickyNoteNode({
    id: "sticky-review",
    rect: { x: 640, y: 232, width: 232, height: 188 },
    text: "Review the voice-call lane and connect note actions here.",
  }),
]

export { initialEdges }
