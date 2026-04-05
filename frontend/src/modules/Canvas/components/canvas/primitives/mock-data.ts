import {
  createShapeNode,
  createStickyNoteNode,
  createTextNode,
  type CanvasObjectNode,
} from "./schema"
import type { Edge } from "@xyflow/react"

export const initialNodes: CanvasObjectNode[] = [
  createTextNode({
    id: "pipeline-title",
    rect: { x: 340, y: 32, width: 440, height: 56 },
    text: "Creative campaign pipeline",
  }),
  createTextNode({
    id: "pipeline-subtitle",
    rect: { x: 250, y: 86, width: 620, height: 64 },
    text: "Vertical main flow with right-side branches for supporting steps and review loops.",
    preset: {
      color: "oklch(0.708 0 0)",
      fontSize: 18,
      fontWeight: "normal",
      align: "center",
    },
  }),

  // Main vertical flow
  createShapeNode({
    id: "step-goal",
    shapeKind: "rectangle",
    rect: { x: 430, y: 170, width: 220, height: 92 },
    label: "1. Define Goal",
    preset: {
      color: "oklch(0.768 0.233 130.85)",
      paintStyle: "solid",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "step-concept",
    shapeKind: "rectangle",
    rect: { x: 430, y: 330, width: 220, height: 92 },
    label: "2. Concept Directions",
    preset: {
      color: "oklch(0.768 0.233 130.85)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "step-assets",
    shapeKind: "rectangle",
    rect: { x: 430, y: 490, width: 220, height: 92 },
    label: "3. Gather Assets",
    preset: {
      color: "oklch(0.72 0.16 240)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "step-build",
    shapeKind: "rectangle",
    rect: { x: 430, y: 650, width: 220, height: 92 },
    label: "4. Build Variants",
    preset: {
      color: "oklch(0.72 0.16 240)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "step-review",
    shapeKind: "ellipse",
    rect: { x: 420, y: 810, width: 240, height: 130 },
    label: "5. Review / Approve?",
    preset: {
      color: "oklch(0.86 0.18 95)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "step-export",
    shapeKind: "rectangle",
    rect: { x: 430, y: 990, width: 220, height: 92 },
    label: "6. Export Pack",
    preset: {
      color: "oklch(0.72 0.19 28)",
      paintStyle: "solid",
      strokeWidth: 2,
    },
  }),

  // Right-side branches
  createShapeNode({
    id: "side-brief-inputs",
    shapeKind: "rectangle",
    rect: { x: 780, y: 178, width: 230, height: 76 },
    label: "Audience + Offer",
    preset: {
      color: "oklch(0.78 0.11 210)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "side-references",
    shapeKind: "rectangle",
    rect: { x: 780, y: 338, width: 230, height: 76 },
    label: "Reference Board",
    preset: {
      color: "oklch(0.82 0.12 300)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "side-copy",
    shapeKind: "rectangle",
    rect: { x: 780, y: 498, width: 230, height: 76 },
    label: "Copy + CTA Drafts",
    preset: {
      color: "oklch(0.82 0.12 300)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "side-render",
    shapeKind: "rectangle",
    rect: { x: 780, y: 658, width: 230, height: 76 },
    label: "Render / Upscale",
    preset: {
      color: "oklch(0.78 0.11 210)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),
  createShapeNode({
    id: "side-fixes",
    shapeKind: "rectangle",
    rect: { x: 780, y: 838, width: 230, height: 76 },
    label: "Revision Loop",
    preset: {
      color: "oklch(0.88 0.14 75)",
      paintStyle: "outline",
      strokeWidth: 2,
    },
  }),

  // Right-side notes
  createStickyNoteNode({
    id: "note-goal",
    rect: { x: 1050, y: 145, width: 270, height: 120 },
    text: "Goal:\nCampaign objective\nTarget viewer\nSuccess metric",
  }),
  createStickyNoteNode({
    id: "note-concepts",
    rect: { x: 1050, y: 305, width: 270, height: 130 },
    text: "Try 3-5 routes:\nUGC\nAuthority\nProblem/solution\nBefore/after",
  }),
  createStickyNoteNode({
    id: "note-review",
    rect: { x: 1050, y: 780, width: 270, height: 140 },
    text: "Check:\nHook clarity\nBrand presence\nVisual hierarchy\nCTA strength",
  }),
  createStickyNoteNode({
    id: "note-export",
    rect: { x: 1050, y: 980, width: 290, height: 140 },
    text: "Deliverables:\n1:1, 4:5, 9:16\nSource prompts\nWinner shortlist",
  }),
]

export const initialEdges: Edge[] = [
  // Main vertical spine
  {
    id: "goal-to-concept",
    source: "step-goal",
    sourceHandle: "bottom",
    target: "step-concept",
    targetHandle: "top",
  },
  {
    id: "concept-to-assets",
    source: "step-concept",
    sourceHandle: "bottom",
    target: "step-assets",
    targetHandle: "top",
  },
  {
    id: "assets-to-build",
    source: "step-assets",
    sourceHandle: "bottom",
    target: "step-build",
    targetHandle: "top",
  },
  {
    id: "build-to-review",
    source: "step-build",
    sourceHandle: "bottom",
    target: "step-review",
    targetHandle: "top",
  },
  {
    id: "review-to-export",
    source: "step-review",
    sourceHandle: "bottom",
    target: "step-export",
    targetHandle: "top",
  },

  // Right-side branches from the RIGHT side of main nodes
  {
    id: "goal-to-brief-inputs",
    source: "step-goal",
    sourceHandle: "right",
    target: "side-brief-inputs",
    targetHandle: "left",
    type: "smoothstep",
  },
  {
    id: "concept-to-references",
    source: "step-concept",
    sourceHandle: "right",
    target: "side-references",
    targetHandle: "left",
    type: "smoothstep",
  },
  {
    id: "assets-to-copy",
    source: "step-assets",
    sourceHandle: "right",
    target: "side-copy",
    targetHandle: "left",
    type: "smoothstep",
  },
  {
    id: "build-to-render",
    source: "step-build",
    sourceHandle: "right",
    target: "side-render",
    targetHandle: "left",
    type: "smoothstep",
  },
  {
    id: "review-to-fixes",
    source: "step-review",
    sourceHandle: "right",
    target: "side-fixes",
    targetHandle: "left",
    type: "smoothstep",
  },

  // Revision loop back into build
  {
    id: "fixes-to-build",
    source: "side-fixes",
    sourceHandle: "left",
    target: "step-build",
    targetHandle: "right",
    type: "smoothstep",
  },
]
