import type { Tool } from "../llm/types.js";

export const canvasTools: Tool[] = [
  {
    name: "createNode",
    description:
      "Create a new node on the canvas. Use 'shape' for rectangles/ellipses, 'text' for text labels, 'sticky_note' for sticky notes.",
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
      },
      required: ["nodeType", "position"],
    },
  },
  {
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
    name: "createEdge",
    description: "Create a connection (edge) between two nodes.",
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
    name: "deleteEdge",
    description: "Delete an edge from the canvas.",
    parameters: {
      type: "object",
      properties: {
        edgeId: { type: "string", description: "ID of the edge to delete" },
      },
      required: ["edgeId"],
    },
  },
  {
    name: "sendMessage",
    description:
      "Send a chat message to explain what you did, suggest next steps, or respond to users. Use this to communicate your reasoning.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message text" },
      },
      required: ["text"],
    },
  },
  {
    name: "groupNodes",
    description:
      "Create a visual group around a set of nodes with a label. Groups help organize related items on the canvas.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          description: "IDs of nodes to group",
          items: { type: "string", description: "Node ID" },
        },
        label: { type: "string", description: "Label for the group" },
        color: { type: "string", description: "Group background color as oklch string" },
      },
      required: ["nodeIds", "label"],
    },
  },
  {
    name: "rearrangeNodes",
    description:
      "Rearrange a set of nodes into a layout pattern. Use for organizing scattered items.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          description: "IDs of nodes to rearrange",
          items: { type: "string", description: "Node ID" },
        },
        layout: {
          type: "string",
          description: "Layout pattern to apply",
          enum: ["grid", "horizontal", "vertical", "cluster"],
        },
        spacing: { type: "number", description: "Spacing between nodes in pixels. Default 40." },
      },
      required: ["nodeIds", "layout"],
    },
  },
];
