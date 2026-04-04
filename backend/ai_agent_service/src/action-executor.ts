import type { ToolCall } from "./llm/types.js";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";

export interface StorageAdapter {
  setNode: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  setEdge: (id: string, data: Record<string, unknown>) => void;
  deleteEdge: (id: string) => void;
  sendMessage: (text: string) => void;
  getNodes: () => Array<{ id: string; position?: { x: number; y: number }; width?: number; height?: number }>;
}

export class ActionExecutor {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async execute(toolCalls: ToolCall[]): Promise<void> {
    for (const call of toolCalls) {
      this.executeOne(call);
    }
  }

  private executeOne(call: ToolCall): void {
    switch (call.name) {
      case "createNode":
        this.handleCreateNode(call.arguments);
        break;
      case "updateNode":
        this.handleUpdateNode(call.arguments);
        break;
      case "deleteNode":
        this.storage.deleteNode(call.arguments.nodeId as string);
        break;
      case "createEdge":
        this.handleCreateEdge(call.arguments);
        break;
      case "deleteEdge":
        this.storage.deleteEdge(call.arguments.edgeId as string);
        break;
      case "sendMessage":
        this.storage.sendMessage(call.arguments.text as string);
        break;
      case "groupNodes":
        this.handleGroupNodes(call.arguments);
        break;
      case "rearrangeNodes":
        this.handleRearrange(call.arguments);
        break;
      default:
        logger.warn({ toolCall: call.name }, "Unknown tool call");
    }
  }

  private handleCreateNode(args: Record<string, unknown>): void {
    const id = `agent-${randomUUID().slice(0, 8)}`;
    const nodeType = args.nodeType as string;
    const position = args.position as { x: number; y: number };
    const width = (args.width as number) ?? 150;
    const height = (args.height as number) ?? 80;

    const data: Record<string, unknown> = { type: nodeType };

    if (nodeType === "shape") {
      data.shapeKind = args.shapeKind ?? "rectangle";
      data.color = args.color ?? "oklch(0.768 0.233 130.85)";
      data.paintStyle = args.paintStyle ?? "solid";
      data.strokeWidth = 2;
      data.label = args.label ?? "";
    } else if (nodeType === "text") {
      data.text = args.text ?? "";
      data.color = args.color ?? "oklch(0.268 0 0)";
      data.fontSize = args.fontSize ?? 16;
      data.fontWeight = "normal";
      data.align = "left";
    } else if (nodeType === "sticky_note") {
      data.text = args.text ?? "";
      data.color = args.color ?? "oklch(0.92 0.17 122)";
      data.textColor = "oklch(0.268 0 0)";
      data.fontSize = args.fontSize ?? 14;
    }

    this.storage.setNode(id, { type: nodeType, position, width, height, data });
  }

  private handleUpdateNode(args: Record<string, unknown>): void {
    const nodeId = args.nodeId as string;
    const updates: Record<string, unknown> = {};

    if (args.position) updates.position = args.position;
    if (args.width) updates.width = args.width;
    if (args.height) updates.height = args.height;
    if (args.text !== undefined) updates["data.text"] = args.text;
    if (args.label !== undefined) updates["data.label"] = args.label;
    if (args.color !== undefined) updates["data.color"] = args.color;

    this.storage.setNode(nodeId, updates);
  }

  private handleCreateEdge(args: Record<string, unknown>): void {
    const id = `agent-edge-${randomUUID().slice(0, 8)}`;
    this.storage.setEdge(id, {
      source: args.source,
      target: args.target,
      label: args.label ?? "",
    });
  }

  private handleGroupNodes(args: Record<string, unknown>): void {
    const nodeIds = args.nodeIds as string[];
    const label = args.label as string;
    const color = (args.color as string) ?? "oklch(0.9 0.05 130)";

    const id = `agent-group-${randomUUID().slice(0, 8)}`;
    const allNodes = this.storage.getNodes();
    const targetNodes = allNodes.filter((n) => nodeIds.includes(n.id));

    if (targetNodes.length === 0) return;

    const padding = 40;
    const minX = Math.min(...targetNodes.map((n) => n.position?.x ?? 0)) - padding;
    const minY = Math.min(...targetNodes.map((n) => n.position?.y ?? 0)) - padding - 30;
    const maxX = Math.max(...targetNodes.map((n) => (n.position?.x ?? 0) + (n.width ?? 150))) + padding;
    const maxY = Math.max(...targetNodes.map((n) => (n.position?.y ?? 0) + (n.height ?? 80))) + padding;

    this.storage.setNode(id, {
      type: "group",
      position: { x: minX, y: minY },
      width: maxX - minX,
      height: maxY - minY,
      data: { type: "group", label, color },
    });
  }

  private handleRearrange(args: Record<string, unknown>): void {
    const nodeIds = args.nodeIds as string[];
    const layout = args.layout as string;
    const spacing = (args.spacing as number) ?? 40;

    const allNodes = this.storage.getNodes();
    const targetNodes = allNodes.filter((n) => nodeIds.includes(n.id));

    if (targetNodes.length === 0) return;

    const anchor = targetNodes.reduce(
      (acc, n) => ({
        x: Math.min(acc.x, n.position?.x ?? 0),
        y: Math.min(acc.y, n.position?.y ?? 0),
      }),
      { x: Infinity, y: Infinity }
    );

    const nodeWidth = 150;
    const nodeHeight = 80;

    targetNodes.forEach((node, i) => {
      let position: { x: number; y: number };

      switch (layout) {
        case "horizontal":
          position = { x: anchor.x + i * (nodeWidth + spacing), y: anchor.y };
          break;
        case "vertical":
          position = { x: anchor.x, y: anchor.y + i * (nodeHeight + spacing) };
          break;
        case "grid": {
          const cols = Math.ceil(Math.sqrt(targetNodes.length));
          const col = i % cols;
          const row = Math.floor(i / cols);
          position = {
            x: anchor.x + col * (nodeWidth + spacing),
            y: anchor.y + row * (nodeHeight + spacing),
          };
          break;
        }
        case "cluster":
        default:
          position = {
            x: anchor.x + (i % 3) * (nodeWidth + spacing / 2),
            y: anchor.y + Math.floor(i / 3) * (nodeHeight + spacing / 2),
          };
          break;
      }

      this.storage.setNode(node.id, { position });
    });
  }
}
