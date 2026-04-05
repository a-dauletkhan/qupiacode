import type { Tool } from "../llm/types.js";

export const canvasTools: Tool[] = [
  {
    name: "createDiagram",
    description:
      "Create a complete pending diagram in one call. Use this for mindmaps, multi-step routines, workflows, trees, timelines, branching structures, and other requests that need multiple connected blocks.",
    parameters: {
      type: "object",
      properties: {
        diagramType: {
          type: "string",
          enum: ["mindmap", "flowchart", "timeline", "concept_map"],
          description: "Overall diagram style",
        },
        layout: {
          type: "string",
          enum: ["radial", "horizontal", "vertical"],
          description: "Preferred high-level layout direction",
        },
        rootKey: {
          type: "string",
          description: "Optional key of the central or first node",
        },
        summary: {
          type: "string",
          description: "Short summary of the draft being prepared",
        },
        anchor: {
          type: "object",
          description: "Optional anchor position for the diagram",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
        nodes: {
          type: "array",
          description: "Nodes to include in the generated structure",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              existingNodeId: { type: "string" },
              nodeType: {
                type: "string",
                enum: ["shape", "text", "sticky_note"],
              },
              label: { type: "string" },
              text: { type: "string" },
              shapeKind: {
                type: "string",
                enum: ["rectangle", "diamond", "ellipse"],
              },
              width: { type: "number" },
              height: { type: "number" },
              color: { type: "string" },
              paintStyle: {
                type: "string",
                enum: ["solid", "outline", "sketch", "hatch"],
              },
              textColor: { type: "string" },
              fontSize: { type: "number" },
              fontWeight: {
                type: "string",
                enum: ["normal", "medium", "bold"],
              },
              align: {
                type: "string",
                enum: ["left", "center", "right"],
              },
              parentKey: { type: "string" },
              depth: { type: "number" },
              lane: { type: "number" },
            },
            required: ["key", "nodeType"],
          },
        },
        edges: {
          type: "array",
          description: "Connections between nodes using diagram node keys",
          items: {
            type: "object",
            properties: {
              sourceKey: { type: "string" },
              targetKey: { type: "string" },
              label: { type: "string" },
            },
            required: ["sourceKey", "targetKey"],
          },
        },
      },
      required: ["diagramType", "nodes"],
    },
  },
  {
    name: "createNode",
    description:
      "Create a new pending node on the canvas. Use this for isolated additions, not large diagrams.",
    parameters: {
      type: "object",
      properties: {
        nodeType: {
          type: "string",
          enum: ["shape", "text", "sticky_note"],
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
        width: { type: "number" },
        height: { type: "number" },
        shapeKind: {
          type: "string",
          enum: ["rectangle", "diamond", "ellipse"],
        },
        color: { type: "string" },
        paintStyle: {
          type: "string",
          enum: ["solid", "outline", "sketch", "hatch"],
        },
        text: { type: "string" },
        fontSize: { type: "number" },
        label: { type: "string" },
        fontWeight: {
          type: "string",
          enum: ["normal", "medium", "bold"],
        },
        align: {
          type: "string",
          enum: ["left", "center", "right"],
        },
        textColor: { type: "string" },
      },
      required: ["nodeType", "position"],
    },
  },
  {
    name: "updateNode",
    description:
      "Propose a pending update to an existing node. Use this to move, recolor, resize, restyle, or edit text/labels on existing blocks. Prefer this over createNode when the user asks to change selected or visible existing blocks.",
    parameters: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description: "ID of the existing node to update",
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
        },
        width: { type: "number" },
        height: { type: "number" },
        label: { type: "string" },
        text: { type: "string" },
        color: { type: "string" },
        textColor: { type: "string" },
        fontSize: { type: "number" },
        fontWeight: {
          type: "string",
          enum: ["normal", "medium", "bold"],
        },
        align: {
          type: "string",
          enum: ["left", "center", "right"],
        },
        paintStyle: {
          type: "string",
          enum: ["solid", "outline", "sketch", "hatch"],
        },
        strokeWidth: { type: "number" },
        shapeKind: {
          type: "string",
          enum: ["rectangle", "diamond", "ellipse"],
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "rearrangeNodes",
    description:
      "Rearrange existing nodes to reduce overlap and improve readability. Use this when edges are tangled, blocks overlap, or the user asks for a cleaner layout. If nodeIds are omitted, the selected nodes are rearranged first, otherwise the whole visible board may be rearranged.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          items: { type: "string" },
          description: "Optional IDs of existing nodes to rearrange",
        },
        layout: {
          type: "string",
          enum: ["force", "mindmap", "radial", "horizontal", "vertical", "grid"],
          description: "Layout strategy to apply",
        },
        rootNodeId: {
          type: "string",
          description: "Optional root node to keep more stable during layout",
        },
        spacing: {
          type: "number",
          description: "Preferred spacing between nodes in pixels",
        },
      },
      required: ["layout"],
    },
  },
  {
    name: "createEdge",
    description: "Create a new pending connection between two nodes.",
    parameters: {
      type: "object",
      properties: {
        source: { type: "string" },
        target: { type: "string" },
        label: { type: "string" },
      },
      required: ["source", "target"],
    },
  },
  {
    name: "sendMessage",
    description:
      "Provide the assistant reply that should appear in chat after you answer or prepare a pending draft.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
];
