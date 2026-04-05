import type { ToolCall } from "./llm/types.js";
import type { AiMetadata } from "./types.js";
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

export interface ActionContext {
  commandId: string | null;
  requestedBy: string | null;
}

export interface AiActionContext {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  persona: string;
  personaColor: string;
}

export class ActionExecutor {
  private storage: StorageAdapter;
  private actionContext: ActionContext;
  private aiContext: AiActionContext | null;
  private _createdNodeIds: string[] = [];
  private _createdEdgeIds: string[] = [];
  private _actionId: string;

  constructor(storage: StorageAdapter, actionContext?: ActionContext | AiActionContext) {
    this.storage = storage;
    if (actionContext && "persona" in actionContext) {
      this.aiContext = actionContext as AiActionContext;
      this.actionContext = { commandId: actionContext.commandId, requestedBy: actionContext.requestedBy };
    } else {
      this.aiContext = null;
      this.actionContext = actionContext ?? { commandId: null, requestedBy: null };
    }
    this._actionId = `act-${randomUUID().slice(0, 8)}`;
  }

  get actionId(): string {
    return this._actionId;
  }

  get createdNodeIds(): string[] {
    return this._createdNodeIds;
  }

  get createdEdgeIds(): string[] {
    return this._createdEdgeIds;
  }

  async execute(toolCalls: ToolCall[]): Promise<void> {
    for (const call of toolCalls) {
      this.executeOne(call);
    }
  }

  private makeAiMetadata(): AiMetadata {
    return {
      actionId: this._actionId,
      commandId: this.actionContext.commandId,
      requestedBy: this.actionContext.requestedBy,
      status: "pending",
      createdAt: Date.now(),
      persona: this.aiContext?.persona ?? "",
      personaColor: this.aiContext?.personaColor ?? "",
    };
  }

  private buildAiMeta(): AiMetadata | null {
    if (!this.aiContext) return null;
    return {
      actionId: this.aiContext.actionId,
      commandId: this.aiContext.commandId,
      requestedBy: this.aiContext.requestedBy,
      status: "pending",
      createdAt: Date.now(),
      persona: this.aiContext.persona,
      personaColor: this.aiContext.personaColor,
    };
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
    const id = `ai-${randomUUID().slice(0, 8)}`;
    const nodeType = args.nodeType as string;
    const position = args.position as { x: number; y: number };
    const width = (args.width as number) ?? 150;
    const height = (args.height as number) ?? 80;

    // Build data in the exact format the frontend React Flow schema expects
    const data: Record<string, unknown> = { objectType: nodeType, zIndex: 0 };

    if (nodeType === "shape") {
      data.shapeKind = args.shapeKind ?? "rectangle";
      data.content = { label: (args.label as string) ?? "" };
      data.style = {
        color: (args.color as string) ?? "oklch(0.768 0.233 130.85)",
        paintStyle: (args.paintStyle as string) ?? "solid",
        strokeWidth: 2,
      };
    } else if (nodeType === "text") {
      data.content = { text: (args.text as string) ?? "" };
      data.style = {
        color: (args.color as string) ?? "oklch(0.268 0 0)",
        fontSize: (args.fontSize as number) ?? 16,
        fontWeight: "normal",
        align: "left",
      };
    } else if (nodeType === "sticky_note") {
      data.content = { text: (args.text as string) ?? "" };
      data.style = {
        color: (args.color as string) ?? "oklch(0.92 0.17 122)",
        textColor: "oklch(0.268 0 0)",
        fontSize: (args.fontSize as number) ?? 14,
      };
    }

    data._ai = this.makeAiMetadata();

    this._createdNodeIds.push(id);
    // React Flow expects: { id, type, position, style: { width, height }, data }
    this.storage.setNode(id, { type: nodeType, position, style: { width, height }, data });
  }

  private handleUpdateNode(args: Record<string, unknown>): void {
    const nodeId = args.nodeId as string;
    const updates: Record<string, unknown> = {};

    // Layout
    if (args.position) updates.position = args.position;
    if (args.width || args.height) updates.style = { ...(args.width ? { width: args.width } : {}), ...(args.height ? { height: args.height } : {}) };

    // Content — text for text/sticky_note, label for shapes
    if (args.text !== undefined) updates["data.content.text"] = args.text;
    if (args.label !== undefined) updates["data.content.label"] = args.label;

    // Style properties
    if (args.color !== undefined) updates["data.style.color"] = args.color;
    if (args.textColor !== undefined) updates["data.style.textColor"] = args.textColor;
    if (args.fontSize !== undefined) updates["data.style.fontSize"] = args.fontSize;
    if (args.fontWeight !== undefined) updates["data.style.fontWeight"] = args.fontWeight;
    if (args.paintStyle !== undefined) updates["data.style.paintStyle"] = args.paintStyle;
    if (args.strokeWidth !== undefined) updates["data.style.strokeWidth"] = args.strokeWidth;
    if (args.shapeKind !== undefined) updates["data.shapeKind"] = args.shapeKind;

    this.storage.setNode(nodeId, updates);
  }

  private handleCreateEdge(args: Record<string, unknown>): void {
    const id = `ai-edge-${randomUUID().slice(0, 8)}`;
    const edgeData: Record<string, unknown> = {
      source: args.source,
      target: args.target,
      label: args.label ?? "",
      data: { _ai: this.makeAiMetadata() },
    };
    this._createdEdgeIds.push(id);
    this.storage.setEdge(id, edgeData);
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
