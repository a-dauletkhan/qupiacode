import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";
import type { ToolCall } from "./llm/types.js";
import type {
  AiCanvasAction,
  CanvasObjectType,
  CanvasSnapshot,
  CreateEdgeAction,
  CreateNodeAction,
  Position,
  ShapeKind,
} from "./types.js";

export interface ActionContext {
  commandId?: string | null;
  requestedBy?: string | null;
  canvasSnapshot?: CanvasSnapshot;
}

export interface AiActionContext {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  persona: string;
  personaColor: string;
}

export class ActionExecutor {
  private actionContext: ActionContext;
<<<<<<< Updated upstream
  private aiContext: AiActionContext | null;
  private _createdNodeIds: string[] = [];
  private _createdEdgeIds: string[] = [];
=======
>>>>>>> Stashed changes
  private _actionId: string;
  private _actions: AiCanvasAction[] = [];
  private _messages: string[] = [];

<<<<<<< Updated upstream
  constructor(storage: StorageAdapter, actionContext?: ActionContext | AiActionContext) {
    this.storage = storage;
    if (actionContext && "persona" in actionContext) {
      this.aiContext = actionContext as AiActionContext;
      this.actionContext = { commandId: actionContext.commandId, requestedBy: actionContext.requestedBy };
    } else {
      this.aiContext = null;
      this.actionContext = actionContext ?? { commandId: null, requestedBy: null };
    }
=======
  constructor(actionContext?: ActionContext) {
    this.actionContext = actionContext ?? { commandId: null, requestedBy: null };
>>>>>>> Stashed changes
    this._actionId = `act-${randomUUID().slice(0, 8)}`;
  }

  get actionId(): string {
    return this._actionId;
  }

  get actions(): AiCanvasAction[] {
    return [...this._actions];
  }

  get messages(): string[] {
    return [...this._messages];
  }

  get createdNodeIds(): string[] {
    return this._actions
      .filter((action): action is CreateNodeAction => action.type === "create_node")
      .map((action) => action.nodeId);
  }

  get createdEdgeIds(): string[] {
    return this._actions
      .filter((action): action is CreateEdgeAction => action.type === "create_edge")
      .map((action) => action.edgeId);
  }

  async execute(toolCalls: ToolCall[]): Promise<void> {
    for (const call of toolCalls) {
      this.executeOne(call);
    }
  }

<<<<<<< Updated upstream
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

=======
>>>>>>> Stashed changes
  private executeOne(call: ToolCall): void {
    switch (call.name) {
      case "createNode":
        this.handleCreateNode(call.arguments);
        break;
      case "createDiagram":
        this.handleCreateDiagram(call.arguments);
        break;
      case "createEdge":
        this.handleCreateEdge(call.arguments);
        break;
      case "sendMessage":
        this.handleSendMessage(call.arguments);
        break;
      default:
        logger.warn({ toolCall: call.name }, "Ignoring unsupported tool call");
    }
  }

  private handleCreateNode(args: Record<string, unknown>): void {
<<<<<<< Updated upstream
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
=======
    const nodeType = normalizeNodeType(args.nodeType);
    if (!nodeType) {
      logger.warn({ args }, "Skipping createNode with invalid nodeType");
      return;
    }

    this._actions.push(
      buildCreateNodeAction(`ai-${randomUUID().slice(0, 8)}`, nodeType, args, normalizePosition(args.position)),
    );
>>>>>>> Stashed changes
  }

  private handleCreateEdge(args: Record<string, unknown>): void {
    const source = normalizeRequiredString(args.source);
    const target = normalizeRequiredString(args.target);
    if (!source || !target) {
      logger.warn({ args }, "Skipping createEdge with missing source/target");
      return;
    }

    const action: CreateEdgeAction = {
      type: "create_edge",
      edgeId: `ai-edge-${randomUUID().slice(0, 8)}`,
      source,
      target,
      label: normalizeOptionalString(args.label),
    };

    this._actions.push(action);
  }

  private handleCreateDiagram(args: Record<string, unknown>): void {
    const nodes = normalizeDiagramNodes(args.nodes);
    if (nodes.length === 0) {
      logger.warn({ args }, "Skipping createDiagram with no valid nodes");
      return;
    }

    const edges = normalizeDiagramEdges(args.edges);
    const diagramType = normalizeDiagramType(args.diagramType) ?? "flowchart";
    const layout = normalizeDiagramLayout(args.layout) ?? getDefaultLayout(diagramType);
    const rootKey = normalizeOptionalString(args.rootKey) ?? nodes[0]!.key;
    const explicitAnchor = normalizeOptionalPosition(args.anchor);
    const existingNodes = buildExistingNodeLookup(this.actionContext.canvasSnapshot);
    const anchor = resolveDiagramAnchor(
      this.actionContext.canvasSnapshot,
      explicitAnchor,
      nodes.find((node) => node.key === rootKey)?.existingNodeId,
      existingNodes,
    );
    const depthMap = buildDiagramDepthMap(nodes, edges, rootKey);
    const positionMap = layoutDiagramNodes(
      nodes,
      edges,
      depthMap,
      layout,
      anchor,
      existingNodes,
      diagramType,
      rootKey,
    );
    const nodeIdByKey = new Map<string, string>();

    const orderedNodes = [...nodes].sort((left, right) => {
      const depthDelta = (depthMap.get(left.key) ?? 0) - (depthMap.get(right.key) ?? 0);
      if (depthDelta !== 0) return depthDelta;
      const laneDelta = (left.lane ?? Number.MAX_SAFE_INTEGER) - (right.lane ?? Number.MAX_SAFE_INTEGER);
      if (laneDelta !== 0) return laneDelta;
      return left.key.localeCompare(right.key);
    });

    for (const node of orderedNodes) {
      const existingNodeId = node.existingNodeId && existingNodes.has(node.existingNodeId) ? node.existingNodeId : null;
      if (existingNodeId) {
        nodeIdByKey.set(node.key, existingNodeId);
        continue;
      }

      const nodeType = node.nodeType;
      const action = buildCreateNodeAction(
        `ai-${randomUUID().slice(0, 8)}`,
        nodeType,
        buildDiagramNodeArguments(node, rootKey, diagramType),
        positionMap.get(node.key) ?? anchor,
      );
      this._actions.push(action);
      nodeIdByKey.set(node.key, action.nodeId);
    }

    for (const edge of edges) {
      const source = nodeIdByKey.get(edge.sourceKey);
      const target = nodeIdByKey.get(edge.targetKey);
      if (!source || !target) {
        logger.warn({ edge }, "Skipping createDiagram edge with unresolved node key");
        continue;
      }

      this._actions.push({
        type: "create_edge",
        edgeId: `ai-edge-${randomUUID().slice(0, 8)}`,
        source,
        target,
        label: edge.label,
      });
    }

    const summary = normalizeRequiredString(args.summary);
    if (summary) {
      this._messages.push(summary);
    }
  }

  private handleSendMessage(args: Record<string, unknown>): void {
    const text = normalizeRequiredString(args.text);
    if (text) {
      this._messages.push(text);
    }
  }
}

function normalizePosition(value: unknown): { x: number; y: number } {
  const x = normalizeOptionalNumber((value as Record<string, unknown> | undefined)?.x) ?? 0;
  const y = normalizeOptionalNumber((value as Record<string, unknown> | undefined)?.y) ?? 0;
  return { x, y };
}

function normalizeOptionalPosition(value: unknown): { x: number; y: number } | undefined {
  const position = value as Record<string, unknown> | undefined;
  const x = normalizeOptionalNumber(position?.x);
  const y = normalizeOptionalNumber(position?.y);
  if (x === undefined || y === undefined) {
    return undefined;
  }
  return { x, y };
}

function normalizeRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeNodeType(value: unknown): CreateNodeAction["nodeType"] | null {
  return value === "shape" || value === "text" || value === "sticky_note" ? value : null;
}

function normalizeShapeKind(value: unknown): CreateNodeAction["shapeKind"] | undefined {
  return value === "rectangle" || value === "diamond" || value === "ellipse" ? value : undefined;
}

function normalizeDiagramType(value: unknown): DiagramType | undefined {
  return value === "mindmap" || value === "flowchart" || value === "timeline" || value === "concept_map"
    ? value
    : undefined;
}

function normalizeDiagramLayout(value: unknown): DiagramLayout | undefined {
  return value === "radial" || value === "horizontal" || value === "vertical" ? value : undefined;
}

function getDefaultLayout(diagramType: DiagramType): DiagramLayout {
  if (diagramType === "timeline") return "vertical";
  return "horizontal";
}

function buildCreateNodeAction(
  nodeId: string,
  nodeType: CreateNodeAction["nodeType"],
  args: Record<string, unknown>,
  position: Position,
): CreateNodeAction {
  const shapeKind = nodeType === "shape" ? normalizeShapeKind(args.shapeKind) ?? "rectangle" : undefined;
  const text = extractNodeText(nodeType, args);
  const estimatedSize = estimateNodeSize(
    nodeType,
    shapeKind,
    text,
    normalizeOptionalNumber(args.fontSize),
  );

  return {
    type: "create_node",
    nodeId,
    nodeType,
    objectType: nodeType,
    position,
    parentId: normalizeOptionalString(args.parentId),
    width: normalizeOptionalNumber(args.width) ?? estimatedSize.width,
    height: normalizeOptionalNumber(args.height) ?? estimatedSize.height,
    content: buildNodeContent(nodeType, args),
    style: buildNodeStyle(nodeType, args),
    shapeKind,
    zIndex: 10,
  } satisfies CreateNodeAction;
}

function buildNodeContent(
  nodeType: CreateNodeAction["nodeType"],
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (nodeType === "shape") {
    return {
      label: normalizeOptionalString(args.label) ?? normalizeOptionalString(args.text) ?? "",
    };
  }

  return {
    text: normalizeOptionalString(args.text) ?? normalizeOptionalString(args.label) ?? "",
  };
}

function buildNodeStyle(
  nodeType: CreateNodeAction["nodeType"],
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (nodeType === "shape") {
    return {
      color: normalizeOptionalString(args.color) ?? "oklch(0.768 0.233 130.85)",
      paintStyle: normalizeOptionalString(args.paintStyle) ?? "solid",
      strokeWidth: normalizeOptionalNumber(args.strokeWidth) ?? 2,
    };
  }

  if (nodeType === "text") {
    return {
      color: normalizeOptionalString(args.color) ?? "oklch(0.145 0 0)",
      fontSize: normalizeOptionalNumber(args.fontSize) ?? 24,
      fontWeight: normalizeOptionalString(args.fontWeight) ?? "normal",
      align: normalizeOptionalString(args.align) ?? "left",
    };
  }

  return {
    color: normalizeOptionalString(args.color) ?? "oklch(0.92 0.17 122)",
    textColor: normalizeOptionalString(args.textColor) ?? "oklch(0.145 0 0)",
    fontSize: normalizeOptionalNumber(args.fontSize) ?? 20,
  };
}

function extractNodeText(
  nodeType: CreateNodeAction["nodeType"],
  args: Record<string, unknown>,
): string {
  if (nodeType === "shape") {
    return normalizeOptionalString(args.label) ?? normalizeOptionalString(args.text) ?? "";
  }
  return normalizeOptionalString(args.text) ?? normalizeOptionalString(args.label) ?? "";
}

function estimateNodeSize(
  nodeType: CreateNodeAction["nodeType"],
  shapeKind: CreateNodeAction["shapeKind"] | undefined,
  text: string,
  explicitFontSize: number | undefined,
): { width: number; height: number } {
  const content = text.trim();
  const fontSize =
    explicitFontSize ??
    (nodeType === "sticky_note" ? 20 : nodeType === "text" ? 24 : shapeKind === "ellipse" ? 18 : 16);

  const sizing =
    nodeType === "sticky_note"
      ? {
          minWidth: 280,
          maxWidth: 380,
          minHeight: 168,
          maxHeight: 300,
          paddingX: 92,
          paddingY: 72,
          targetLines: 3,
        }
      : nodeType === "text"
        ? {
            minWidth: 280,
            maxWidth: 460,
            minHeight: 80,
            maxHeight: 260,
            paddingX: 36,
            paddingY: 28,
            targetLines: 2,
          }
        : {
            minWidth: shapeKind === "ellipse" ? 240 : 220,
            maxWidth: shapeKind === "ellipse" ? 340 : 320,
            minHeight: shapeKind === "ellipse" ? 124 : 112,
            maxHeight: 240,
            paddingX: 40,
            paddingY: 34,
            targetLines: shapeKind === "ellipse" ? 2 : 3,
          };

  if (!content) {
    return { width: sizing.minWidth, height: sizing.minHeight };
  }

  const longestWordLength = content
    .split(/\s+/)
    .reduce((max, word) => Math.max(max, word.length), 0);
  const desiredLines = Math.max(1, Math.min(sizing.targetLines + 1, Math.ceil(content.length / 36)));
  const targetCharsPerLine = Math.max(
    longestWordLength,
    Math.ceil(content.length / Math.max(1, desiredLines)),
  );

  let width = clampNumber(
    Math.round(targetCharsPerLine * fontSize * 0.58 + sizing.paddingX),
    sizing.minWidth,
    sizing.maxWidth,
  );

  if (content.length > 80) {
    width = Math.min(sizing.maxWidth, width + 20);
  }

  const charsPerLine = Math.max(8, Math.floor((width - sizing.paddingX) / Math.max(fontSize * 0.55, 1)));
  const lineCount = estimateWrappedLineCount(content, charsPerLine);
  const height = clampNumber(
    Math.round(sizing.paddingY + lineCount * fontSize * 1.22),
    sizing.minHeight,
    sizing.maxHeight,
  );

  return { width, height };
}

function estimateWrappedLineCount(text: string, maxCharsPerLine: number): number {
  const paragraphs = text.split(/\n+/);
  let totalLines = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      totalLines += 1;
      continue;
    }

    let currentLineLength = 0;
    let lineCount = 1;
    for (const word of words) {
      const wordLength = word.length;
      if (currentLineLength === 0) {
        currentLineLength = wordLength;
        continue;
      }
      if (currentLineLength + 1 + wordLength <= maxCharsPerLine) {
        currentLineLength += 1 + wordLength;
      } else {
        lineCount += 1;
        currentLineLength = wordLength;
      }
    }
    totalLines += lineCount;
  }

  return Math.max(totalLines, 1);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type DiagramType = "mindmap" | "flowchart" | "timeline" | "concept_map";
type DiagramLayout = "radial" | "horizontal" | "vertical";

interface DiagramNodeInput {
  key: string;
  existingNodeId?: string;
  nodeType: CanvasObjectType;
  label?: string;
  text?: string;
  shapeKind?: ShapeKind;
  width?: number;
  height?: number;
  color?: string;
  paintStyle?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  align?: string;
  parentKey?: string;
  depth?: number;
  lane?: number;
}

interface DiagramEdgeInput {
  sourceKey: string;
  targetKey: string;
  label?: string;
}

interface ExistingNodeInfo {
  position: Position;
  width: number;
  height: number;
}

function normalizeDiagramNodes(value: unknown): DiagramNodeInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nodes: DiagramNodeInput[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const args = entry as Record<string, unknown>;
    const key = normalizeRequiredString(args.key);
    const nodeType = normalizeNodeType(args.nodeType);
    if (!key || !nodeType) {
      continue;
    }

    nodes.push({
      key,
      existingNodeId: normalizeOptionalString(args.existingNodeId),
      nodeType,
      label: normalizeOptionalString(args.label),
      text: normalizeOptionalString(args.text),
      shapeKind: normalizeShapeKind(args.shapeKind),
      width: normalizeOptionalNumber(args.width),
      height: normalizeOptionalNumber(args.height),
      color: normalizeOptionalString(args.color),
      paintStyle: normalizeOptionalString(args.paintStyle),
      textColor: normalizeOptionalString(args.textColor),
      fontSize: normalizeOptionalNumber(args.fontSize),
      fontWeight: normalizeOptionalString(args.fontWeight),
      align: normalizeOptionalString(args.align),
      parentKey: normalizeOptionalString(args.parentKey),
      depth: normalizeOptionalNumber(args.depth),
      lane: normalizeOptionalNumber(args.lane),
    });
  }

  return nodes;
}

function normalizeDiagramEdges(value: unknown): DiagramEdgeInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const edges: DiagramEdgeInput[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const args = entry as Record<string, unknown>;
    const sourceKey = normalizeRequiredString(args.sourceKey);
    const targetKey = normalizeRequiredString(args.targetKey);
    if (!sourceKey || !targetKey) {
      continue;
    }

    edges.push({
      sourceKey,
      targetKey,
      label: normalizeOptionalString(args.label),
    });
  }

  return edges;
}

function buildExistingNodeLookup(snapshot?: CanvasSnapshot): Map<string, ExistingNodeInfo> {
  const lookup = new Map<string, ExistingNodeInfo>();
  for (const node of snapshot?.nodes ?? []) {
    const shapeKind = node.data.objectType === "shape" ? node.data.shapeKind : undefined;
    const text =
      node.data.objectType === "shape"
        ? typeof node.data.content.label === "string"
          ? node.data.content.label
          : ""
        : typeof node.data.content.text === "string"
          ? node.data.content.text
          : "";
    const estimatedSize = estimateNodeSize(
      node.type,
      shapeKind,
      text,
      typeof node.data.style.fontSize === "number" ? node.data.style.fontSize : undefined,
    );
    lookup.set(node.id, {
      position: node.position,
      width: typeof node.width === "number" ? node.width : estimatedSize.width,
      height: typeof node.height === "number" ? node.height : estimatedSize.height,
    });
  }
  return lookup;
}

function resolveDiagramAnchor(
  snapshot: CanvasSnapshot | undefined,
  explicitAnchor: Position | undefined,
  rootExistingNodeId: string | undefined,
  existingNodes: Map<string, ExistingNodeInfo>,
): Position {
  if (explicitAnchor) {
    return explicitAnchor;
  }

  if (rootExistingNodeId && existingNodes.has(rootExistingNodeId)) {
    return existingNodes.get(rootExistingNodeId)!.position;
  }

  const selectedRoot = snapshot?.selectedNodeIds?.[0];
  if (selectedRoot && existingNodes.has(selectedRoot)) {
    return existingNodes.get(selectedRoot)!.position;
  }

  if ((snapshot?.nodes.length ?? 0) > 0) {
    const nodes = snapshot!.nodes;
    const rightEdge = Math.max(
      ...nodes.map((node) => node.position.x + (typeof node.width === "number" ? node.width : 180)),
    );
    const averageY =
      nodes.reduce((sum, node) => sum + node.position.y + (typeof node.height === "number" ? node.height / 2 : 48), 0) /
      nodes.length;
    return {
      x: rightEdge + 260,
      y: averageY,
    };
  }

  return { x: 320, y: 220 };
}

function buildDiagramDepthMap(
  nodes: DiagramNodeInput[],
  edges: DiagramEdgeInput[],
  rootKey: string,
): Map<string, number> {
  const depthMap = new Map<string, number>();

  for (const node of nodes) {
    if (typeof node.depth === "number" && Number.isFinite(node.depth)) {
      depthMap.set(node.key, Math.max(0, Math.floor(node.depth)));
    }
  }

  if (!depthMap.has(rootKey)) {
    depthMap.set(rootKey, 0);
  }

  for (let index = 0; index < nodes.length; index += 1) {
    let changed = false;

    for (const node of nodes) {
      if (depthMap.has(node.key)) {
        continue;
      }
      if (node.parentKey && depthMap.has(node.parentKey)) {
        depthMap.set(node.key, depthMap.get(node.parentKey)! + 1);
        changed = true;
      }
    }

    for (const edge of edges) {
      if (!depthMap.has(edge.targetKey) && depthMap.has(edge.sourceKey)) {
        depthMap.set(edge.targetKey, depthMap.get(edge.sourceKey)! + 1);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  for (const node of nodes) {
    if (!depthMap.has(node.key)) {
      depthMap.set(node.key, node.key === rootKey ? 0 : 1);
    }
  }

  return depthMap;
}

function layoutDiagramNodes(
  nodes: DiagramNodeInput[],
  edges: DiagramEdgeInput[],
  depthMap: Map<string, number>,
  layout: DiagramLayout,
  anchor: Position,
  existingNodes: Map<string, ExistingNodeInfo>,
  diagramType: DiagramType,
  rootKey: string,
): Map<string, Position> {
  if (diagramType === "mindmap" || diagramType === "concept_map") {
    return layoutMindmapNodes(nodes, edges, anchor, existingNodes, diagramType, rootKey);
  }

  const groups = new Map<number, DiagramNodeInput[]>();
  for (const node of nodes) {
    const depth = depthMap.get(node.key) ?? 0;
    const group = groups.get(depth) ?? [];
    group.push(node);
    groups.set(depth, group);
  }

  const positions = new Map<string, Position>();
  const orderedDepths = [...groups.keys()].sort((left, right) => left - right);

  for (const depth of orderedDepths) {
    const group = [...(groups.get(depth) ?? [])].sort((left, right) => {
      const laneDelta = (left.lane ?? Number.MAX_SAFE_INTEGER) - (right.lane ?? Number.MAX_SAFE_INTEGER);
      if (laneDelta !== 0) return laneDelta;
      return left.key.localeCompare(right.key);
    });

    if (depth === 0 && group.length > 0) {
      for (const node of group) {
        if (node.existingNodeId && existingNodes.has(node.existingNodeId)) {
          positions.set(node.key, existingNodes.get(node.existingNodeId)!.position);
        } else {
          positions.set(node.key, anchor);
        }
      }
      continue;
    }

    if (layout === "vertical") {
      const widthGap = 72;
      const totalWidth = group.reduce(
        (sum, node, index) => sum + getDiagramNodeSize(node, rootKey, diagramType, existingNodes).width + (index > 0 ? widthGap : 0),
        0,
      );
      let cursorX = anchor.x - totalWidth / 2;
      for (const node of group) {
        if (node.existingNodeId && existingNodes.has(node.existingNodeId)) {
          positions.set(node.key, existingNodes.get(node.existingNodeId)!.position);
          continue;
        }
        const size = getDiagramNodeSize(node, rootKey, diagramType, existingNodes);
        positions.set(node.key, {
          x: Math.round(cursorX),
          y: Math.round(anchor.y + depth * 260),
        });
        cursorX += size.width + widthGap;
      }
      continue;
    }

    const heightGap = 64;
    const totalHeight = group.reduce(
      (sum, node, index) => sum + getDiagramNodeSize(node, rootKey, diagramType, existingNodes).height + (index > 0 ? heightGap : 0),
      0,
    );
    let cursorY = anchor.y - totalHeight / 2;
    for (const node of group) {
      if (node.existingNodeId && existingNodes.has(node.existingNodeId)) {
        positions.set(node.key, existingNodes.get(node.existingNodeId)!.position);
        continue;
      }
      const size = getDiagramNodeSize(node, rootKey, diagramType, existingNodes);
      positions.set(node.key, {
        x: Math.round(anchor.x + depth * 360),
        y: Math.round(cursorY),
      });
      cursorY += size.height + heightGap;
    }
  }

  return positions;
}

function layoutMindmapNodes(
  nodes: DiagramNodeInput[],
  edges: DiagramEdgeInput[],
  anchor: Position,
  existingNodes: Map<string, ExistingNodeInfo>,
  diagramType: DiagramType,
  rootKey: string,
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const rootNode = nodeByKey.get(rootKey) ?? nodes[0];
  if (!rootNode) {
    return positions;
  }

  const rootSize = getDiagramNodeSize(rootNode, rootKey, diagramType, existingNodes);
  const rootPosition =
    rootNode.existingNodeId && existingNodes.has(rootNode.existingNodeId)
      ? existingNodes.get(rootNode.existingNodeId)!.position
      : anchor;
  positions.set(rootNode.key, rootPosition);

  const childrenByKey = buildDiagramChildrenMap(nodes, edges);
  const firstLevel = sortDiagramNodeKeys(childrenByKey.get(rootKey) ?? []);
  const sideByKey = new Map<string, -1 | 1>();

  if (firstLevel.length === 1) {
    sideByKey.set(firstLevel[0]!, 1);
  } else {
    firstLevel.forEach((key, index) => {
      sideByKey.set(key, index % 2 === 0 ? 1 : -1);
    });
  }

  const queue = [...firstLevel];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const side = sideByKey.get(current) ?? 1;
    for (const child of childrenByKey.get(current) ?? []) {
      if (!sideByKey.has(child)) {
        sideByKey.set(child, side);
        queue.push(child);
      }
    }
  }

  const spanCache = new Map<string, number>();
  const subtreeGap = 56;
  const leafMinSpan = 136;

  const measureSpan = (nodeKey: string): number => {
    if (spanCache.has(nodeKey)) {
      return spanCache.get(nodeKey)!;
    }

    const node = nodeByKey.get(nodeKey);
    if (!node) {
      return leafMinSpan;
    }

    const size = getDiagramNodeSize(node, rootKey, diagramType, existingNodes);
    const children = (childrenByKey.get(nodeKey) ?? []).filter((child) => sideByKey.get(child) === sideByKey.get(nodeKey));
    if (children.length === 0) {
      const span = Math.max(size.height + 20, leafMinSpan);
      spanCache.set(nodeKey, span);
      return span;
    }

    const childSpan = children.reduce((sum, child, index) => sum + measureSpan(child) + (index > 0 ? subtreeGap : 0), 0);
    const span = Math.max(size.height + 24, childSpan);
    spanCache.set(nodeKey, span);
    return span;
  };

  const rootCenterY = rootPosition.y + rootSize.height / 2;
  const placeSide = (roots: string[], side: -1 | 1): void => {
    if (roots.length === 0) return;

    const rootGap = 88;
    const baseStep = 280;
    const totalSpan = roots.reduce((sum, key, index) => sum + measureSpan(key) + (index > 0 ? 72 : 0), 0);
    let cursorY = rootCenterY - totalSpan / 2;

    const placeNode = (nodeKey: string, depth: number, topY: number): void => {
      const node = nodeByKey.get(nodeKey);
      if (!node) return;

      const size = getDiagramNodeSize(node, rootKey, diagramType, existingNodes);
      const span = measureSpan(nodeKey);
      const centerY = topY + span / 2;
      const x =
        side === 1
          ? rootPosition.x + rootSize.width + rootGap + (depth - 1) * baseStep
          : rootPosition.x - rootGap - (depth - 1) * baseStep - size.width;
      positions.set(nodeKey, {
        x: Math.round(x),
        y: Math.round(centerY - size.height / 2),
      });

      const children = sortDiagramNodeKeys(
        (childrenByKey.get(nodeKey) ?? []).filter((child) => sideByKey.get(child) === side),
      );
      if (children.length === 0) {
        return;
      }

      const totalChildSpan = children.reduce(
        (sum, child, index) => sum + measureSpan(child) + (index > 0 ? subtreeGap : 0),
        0,
      );
      let childCursorY = centerY - totalChildSpan / 2;
      for (const child of children) {
        const childSpan = measureSpan(child);
        placeNode(child, depth + 1, childCursorY);
        childCursorY += childSpan + subtreeGap;
      }
    };

    for (const key of roots) {
      const span = measureSpan(key);
      placeNode(key, 1, cursorY);
      cursorY += span + 72;
    }
  };

  placeSide(firstLevel.filter((key) => sideByKey.get(key) === -1), -1);
  placeSide(firstLevel.filter((key) => sideByKey.get(key) !== -1), 1);

  const unplaced = nodes.filter((node) => !positions.has(node.key));
  if (unplaced.length > 0) {
    let fallbackY = rootPosition.y + rootSize.height + 120;
    for (const node of unplaced) {
      positions.set(node.key, { x: rootPosition.x + rootSize.width + 220, y: fallbackY });
      fallbackY += getDiagramNodeSize(node, rootKey, diagramType, existingNodes).height + 48;
    }
  }

  return positions;
}

function buildDiagramChildrenMap(
  nodes: DiagramNodeInput[],
  edges: DiagramEdgeInput[],
): Map<string, string[]> {
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const parentByKey = new Map<string, string>();

  for (const node of nodes) {
    if (node.parentKey && node.parentKey !== node.key && nodeKeys.has(node.parentKey)) {
      parentByKey.set(node.key, node.parentKey);
    }
  }

  for (const edge of edges) {
    if (
      edge.sourceKey !== edge.targetKey &&
      nodeKeys.has(edge.sourceKey) &&
      nodeKeys.has(edge.targetKey) &&
      !parentByKey.has(edge.targetKey)
    ) {
      parentByKey.set(edge.targetKey, edge.sourceKey);
    }
  }

  const children = new Map<string, string[]>();
  for (const node of nodes) {
    children.set(node.key, []);
  }

  for (const [child, parent] of parentByKey.entries()) {
    const group = children.get(parent);
    if (group) {
      group.push(child);
    }
  }

  return children;
}

function sortDiagramNodeKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => left.localeCompare(right));
}

function getDiagramNodeSize(
  node: DiagramNodeInput,
  rootKey: string,
  diagramType: DiagramType,
  existingNodes: Map<string, ExistingNodeInfo>,
): { width: number; height: number } {
  if (node.existingNodeId && existingNodes.has(node.existingNodeId)) {
    const existing = existingNodes.get(node.existingNodeId)!;
    return { width: existing.width, height: existing.height };
  }

  return estimateNodeSize(
    node.nodeType,
    node.shapeKind ?? getDefaultDiagramShapeKind(node, rootKey, diagramType),
    node.nodeType === "shape" ? node.label ?? node.text ?? "" : node.text ?? node.label ?? "",
    node.fontSize,
  );
}

function buildDiagramNodeArguments(
  node: DiagramNodeInput,
  rootKey: string,
  diagramType: DiagramType,
): Record<string, unknown> {
  const args: Record<string, unknown> = {
    parentId: undefined,
    width: node.width,
    height: node.height,
    color: node.color,
    paintStyle: node.paintStyle,
    textColor: node.textColor,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    align: node.align,
  };

  if (node.nodeType === "shape") {
    args.label = node.label ?? node.text ?? "";
    args.shapeKind = node.shapeKind ?? getDefaultDiagramShapeKind(node, rootKey, diagramType);
  } else {
    args.text = node.text ?? node.label ?? "";
  }

  return args;
}

function getDefaultDiagramShapeKind(
  node: DiagramNodeInput,
  rootKey: string,
  diagramType: DiagramType,
): ShapeKind {
  if (diagramType === "mindmap" && node.key === rootKey) {
    return "ellipse";
  }
  return "rectangle";
}
