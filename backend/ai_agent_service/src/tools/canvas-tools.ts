import type { Tool } from "../llm/types.js";

export const canvasTools: Tool[] = [
  {
    name: "createDiagram",
    description:
      "Create a complete pending diagram in one call. Use this for mindmaps, multi-step routines, processes, workflows, timelines, trees, and any request that needs multiple connected blocks.",
    parameters: {
      type: "object",
      properties: {
        diagramType: {
          type: "string",
          description: "The overall diagram style",
          enum: ["mindmap", "flowchart", "timeline", "concept_map"],
        },
        layout: {
          type: "string",
          description: "Preferred layout direction for the generated draft",
          enum: ["radial", "horizontal", "vertical"],
        },
        rootKey: {
          type: "string",
          description: "Optional key of the central or first node in the diagram",
        },
        summary: {
          type: "string",
          description: "Short summary of the draft you are preparing",
        },
        anchor: {
          type: "object",
          description: "Optional anchor position for the whole diagram",
          properties: {
            x: { type: "number", description: "X coordinate" },
            y: { type: "number", description: "Y coordinate" },
          },
          required: ["x", "y"],
        },
        nodes: {
          type: "array",
          description:
            "Every node that should be created. If the user asks for 5 steps, include 5 separate step nodes here.",
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "Temporary key used to connect edges inside this diagram",
              },
              existingNodeId: {
                type: "string",
                description:
                  "Optional existing canvas node id to reuse instead of creating a new node for this key",
              },
              nodeType: {
                type: "string",
                description: "The type of canvas object",
                enum: ["shape", "text", "sticky_note"],
              },
              label: {
                type: "string",
                description: "Label text for shape nodes",
              },
              text: {
                type: "string",
                description: "Text content for text and sticky note nodes",
              },
              shapeKind: {
                type: "string",
                description: "Shape variant (only for nodeType=shape)",
                enum: ["rectangle", "diamond", "ellipse"],
              },
              width: { type: "number", description: "Width in pixels" },
              height: { type: "number", description: "Height in pixels" },
              color: { type: "string", description: "Fill or text color as oklch string" },
              paintStyle: {
                type: "string",
                description: "Paint style (only for shapes)",
                enum: ["solid", "outline", "sketch", "hatch"],
              },
              textColor: {
                type: "string",
                description: "Sticky note text color",
              },
              fontSize: { type: "number", description: "Font size in pixels" },
              fontWeight: {
                type: "string",
                description: "Text weight (only for nodeType=text)",
                enum: ["normal", "medium", "bold"],
              },
              align: {
                type: "string",
                description: "Text alignment (only for nodeType=text)",
                enum: ["left", "center", "right"],
              },
              parentKey: {
                type: "string",
                description: "Optional parent key for grouping/hierarchy hints",
              },
              depth: {
                type: "number",
                description: "Optional hierarchy depth hint for layout",
              },
              lane: {
                type: "number",
                description: "Optional ordering hint among sibling nodes",
              },
            },
            required: ["key", "nodeType"],
          },
        },
        edges: {
          type: "array",
          description: "Connections between nodes in this diagram using node keys",
          items: {
            type: "object",
            properties: {
              sourceKey: { type: "string", description: "Source node key" },
              targetKey: { type: "string", description: "Target node key" },
              label: { type: "string", description: "Edge label text" },
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
<<<<<<< Updated upstream
      "Create a new node on the canvas. Use 'shape' for rectangles/ellipses, 'text' for text labels, 'sticky_note' for sticky notes.",
=======
      "Create a new pending node on the canvas. Use 'shape' for rectangles/diamonds/ellipses, 'text' for text labels, 'sticky_note' for sticky notes.",
>>>>>>> Stashed changes
    parameters: {
      type: "object",
      properties: {
        nodeType: {
          type: "string",
          description: "The type of canvas object",
          enum: ["shape", "text", "sticky_note"],
        },
        position: {
          type: "object",
          description: "Position on canvas",
          properties: {
            x: { type: "number", description: "X coordinate" },
            y: { type: "number", description: "Y coordinate" },
          },
          required: ["x", "y"],
        },
        width: { type: "number", description: "Width in pixels. Default 150." },
        height: { type: "number", description: "Height in pixels. Default 80." },
        shapeKind: {
          type: "string",
          description: "Shape variant (only for nodeType=shape)",
          enum: ["rectangle", "ellipse"],
        },
        color: { type: "string", description: "Fill color as oklch string" },
        paintStyle: {
          type: "string",
          description: "Paint style (only for shapes)",
          enum: ["solid", "outline", "sketch", "hatch"],
        },
        text: { type: "string", description: "Text content (for text and sticky_note types)" },
        fontSize: { type: "number", description: "Font size in pixels" },
        label: { type: "string", description: "Label text (for shapes)" },
        fontWeight: {
          type: "string",
          description: "Text weight (only for nodeType=text)",
          enum: ["normal", "medium", "bold"],
        },
        align: {
          type: "string",
          description: "Text alignment (only for nodeType=text)",
          enum: ["left", "center", "right"],
        },
        textColor: {
          type: "string",
          description: "Sticky note text color (only for nodeType=sticky_note)",
        },
      },
      required: ["nodeType", "position"],
    },
  },
  {
<<<<<<< Updated upstream
    name: "updateNode",
    description: "Update an existing node's properties. Use this to edit text, labels, colors, sizes, positions, and styles of nodes already on the canvas. Pass the node's ID and only the fields you want to change.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the node to update (from the canvas state)" },
        position: {
          type: "object",
          description: "New position on canvas",
          properties: {
            x: { type: "number", description: "X coordinate" },
            y: { type: "number", description: "Y coordinate" },
          },
        },
        width: { type: "number", description: "New width in pixels" },
        height: { type: "number", description: "New height in pixels" },
        text: { type: "string", description: "New text content (for text and sticky_note nodes)" },
        label: { type: "string", description: "New label (for shape nodes)" },
        color: { type: "string", description: "New fill/background color as oklch string" },
        textColor: { type: "string", description: "New text color as oklch string" },
        fontSize: { type: "number", description: "New font size in pixels" },
        fontWeight: { type: "string", description: "Font weight", enum: ["normal", "medium", "bold"] },
        paintStyle: { type: "string", description: "Shape paint style", enum: ["solid", "outline", "sketch", "hatch"] },
        strokeWidth: { type: "number", description: "Shape border width in pixels" },
        shapeKind: { type: "string", description: "Shape variant", enum: ["rectangle", "diamond", "ellipse"] },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "deleteNode",
    description: "Delete a node from the canvas.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the node to delete" },
      },
      required: ["nodeId"],
    },
  },
  {
=======
>>>>>>> Stashed changes
    name: "createEdge",
    description: "Create a new pending connection (edge) between two nodes.",
    parameters: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source node ID" },
        target: { type: "string", description: "Target node ID" },
        label: { type: "string", description: "Edge label text" },
      },
      required: ["source", "target"],
    },
  },
  {
    name: "sendMessage",
    description:
      "Provide the assistant reply that should appear in chat after you answer or create a pending draft.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message text" },
      },
      required: ["text"],
    },
  },
];
