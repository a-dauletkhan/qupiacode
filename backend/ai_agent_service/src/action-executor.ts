import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";
import type { ToolCall } from "./llm/types.js";
import type {
  AiCanvasAction,
  CanvasNode,
  CanvasObjectType,
  CanvasSnapshot,
  CreateEdgeAction,
  CreateNodeAction,
  NodeMutationSnapshot,
  Position,
  ShapeKind,
  UpdateNodeAction,
} from "./types.js";

export interface ActionContext {
  actionId?: string | null;
  commandId?: string | null;
  requestedBy?: string | null;
  persona?: string | null;
  personaColor?: string | null;
  canvasSnapshot?: CanvasSnapshot;
}

export type AiActionContext = ActionContext;

interface LegacyActionAdapter {
  setNode(id: string, data: Record<string, unknown>): void;
  deleteNode(id: string): void;
  setEdge(id: string, data: Record<string, unknown>): void;
  deleteEdge(id: string): void;
  sendMessage(text: string): void;
}

export class ActionExecutor {
  private actionContext: ActionContext;
  private legacyAdapter: LegacyActionAdapter | null = null;
  private _actionId: string;
  private _actions: AiCanvasAction[] = [];
  private _messages: string[] = [];

  constructor(actionContext?: ActionContext);
  constructor(legacyAdapter: LegacyActionAdapter, actionContext?: ActionContext);
  constructor(
    legacyAdapterOrActionContext?: LegacyActionAdapter | ActionContext,
    maybeActionContext?: ActionContext,
  ) {
    if (maybeActionContext || isLegacyActionAdapter(legacyAdapterOrActionContext)) {
      this.legacyAdapter = isLegacyActionAdapter(legacyAdapterOrActionContext)
        ? legacyAdapterOrActionContext
        : null;
      this.actionContext = maybeActionContext ?? { commandId: null, requestedBy: null };
    } else {
      this.actionContext = legacyAdapterOrActionContext ?? { commandId: null, requestedBy: null };
    }
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
      .filter(
        (action): action is CreateNodeAction | UpdateNodeAction =>
          action.type === "create_node" || action.type === "update_node",
      )
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

  private executeOne(call: ToolCall): void {
    switch (call.name) {
      case "createNode":
        this.handleCreateNode(call.arguments);
        break;
      case "updateNode":
        this.handleUpdateNode(call.arguments);
        break;
      case "createDiagram":
        this.handleCreateDiagram(call.arguments);
        break;
      case "rearrangeNodes":
        this.handleRearrangeNodes(call.arguments);
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
    const nodeType = normalizeNodeType(args.nodeType);
    if (!nodeType) {
      logger.warn({ args }, "Skipping createNode with invalid nodeType");
      return;
    }

    this.pushAction(
      buildCreateNodeAction(`ai-${randomUUID().slice(0, 8)}`, nodeType, args, normalizePosition(args.position)),
    );
  }

  private handleUpdateNode(args: Record<string, unknown>): void {
    const nodeId = normalizeRequiredString(args.nodeId);
    const currentNode = nodeId ? this.findSnapshotNode(nodeId) : null;

    if (!nodeId || !currentNode) {
      logger.warn({ args }, "Skipping updateNode with missing or unknown nodeId");
      return;
    }

    this.pushAction(buildUpdateNodeAction(currentNode, args));
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

    this.pushAction(action);
  }

  private handleRearrangeNodes(args: Record<string, unknown>): void {
    if (!this.actionContext.canvasSnapshot) {
      logger.warn({ args }, "Skipping rearrangeNodes without a canvas snapshot");
      return;
    }

    const requestedNodeIds = Array.isArray(args.nodeIds)
      ? args.nodeIds.map(normalizeRequiredString).filter((value): value is string => Boolean(value))
      : [];
    const nodeIds = resolveRearrangeNodeIds(requestedNodeIds, this.actionContext.canvasSnapshot);

    if (nodeIds.length < 2) {
      logger.warn({ args }, "Skipping rearrangeNodes with insufficient nodeIds");
      return;
    }

    const layout = normalizeRearrangeLayout(args.layout) ?? "force";
    const spacing = normalizeOptionalNumber(args.spacing) ?? 140;
    const snapshotNodes = nodeIds
      .map((nodeId) => this.findSnapshotNode(nodeId))
      .filter((node): node is CanvasNode => Boolean(node));

    if (snapshotNodes.length < 2) {
      logger.warn({ args }, "Skipping rearrangeNodes because nodes were not found in snapshot");
      return;
    }

    const rootNodeId =
      normalizeOptionalString(args.rootNodeId) ??
      this.actionContext.canvasSnapshot.selectedNodeIds.find((nodeId) => nodeIds.includes(nodeId)) ??
      chooseLayoutRoot(snapshotNodes, this.actionContext.canvasSnapshot);

    const positionMap = rearrangeExistingNodes(
      snapshotNodes,
      this.actionContext.canvasSnapshot,
      layout,
      spacing,
      rootNodeId,
    );

    for (const node of snapshotNodes) {
      const nextPosition = positionMap.get(node.id);
      if (!nextPosition) {
        continue;
      }

      const current = createNodeMutationSnapshot(node);
      if (
        Math.abs(current.position.x - nextPosition.x) < 2 &&
        Math.abs(current.position.y - nextPosition.y) < 2
      ) {
        continue;
      }

      this.pushAction({
        type: "update_node",
        nodeId: node.id,
        before: current,
        after: {
          ...current,
          position: nextPosition,
        },
      });
    }
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
      this.pushAction(action);
      nodeIdByKey.set(node.key, action.nodeId);
    }

    for (const edge of edges) {
      const source = nodeIdByKey.get(edge.sourceKey);
      const target = nodeIdByKey.get(edge.targetKey);
      if (!source || !target) {
        logger.warn({ edge }, "Skipping createDiagram edge with unresolved node key");
        continue;
      }

      this.pushAction({
        type: "create_edge",
        edgeId: `ai-edge-${randomUUID().slice(0, 8)}`,
        source,
        target,
        label: edge.label,
      });
    }

    const summary = normalizeRequiredString(args.summary);
    if (summary) {
      this.pushMessage(summary);
    }
  }

  private handleSendMessage(args: Record<string, unknown>): void {
    const text = normalizeRequiredString(args.text);
    if (text) {
      this.pushMessage(text);
    }
  }

  private findSnapshotNode(nodeId: string): CanvasNode | null {
    return this.actionContext.canvasSnapshot?.nodes.find((node) => node.id === nodeId) ?? null;
  }

  private pushAction(action: AiCanvasAction): void {
    this._actions.push(action);
    if (!this.legacyAdapter) {
      return;
    }

    switch (action.type) {
      case "create_node":
        this.legacyAdapter.setNode(action.nodeId, legacyCreateNodePayload(action, this.actionContext));
        break;
      case "update_node":
        this.legacyAdapter.setNode(action.nodeId, legacyUpdateNodePayload(action));
        break;
      case "create_edge":
        this.legacyAdapter.setEdge(action.edgeId, legacyCreateEdgePayload(action, this.actionContext));
        break;
    }
  }

  private pushMessage(text: string): void {
    this._messages.push(text);
    this.legacyAdapter?.sendMessage(text);
  }
}

function isLegacyActionAdapter(value: unknown): value is LegacyActionAdapter {
  return Boolean(
    value &&
      typeof value === "object" &&
      "setNode" in value &&
      "setEdge" in value &&
      "sendMessage" in value,
  );
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

function normalizeRearrangeLayout(value: unknown): RearrangeLayout | undefined {
  return value === "force" ||
    value === "mindmap" ||
    value === "radial" ||
    value === "horizontal" ||
    value === "vertical" ||
    value === "grid"
    ? value
    : undefined;
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

function buildUpdateNodeAction(node: CanvasNode, args: Record<string, unknown>): UpdateNodeAction {
  const before = createNodeMutationSnapshot(node);
  const textUpdate = normalizeOptionalString(args.text);
  const labelUpdate = normalizeOptionalString(args.label);
  const content =
    node.type === "shape"
      ? {
          ...before.content,
          ...(labelUpdate !== undefined ? { label: labelUpdate } : {}),
          ...(labelUpdate === undefined && textUpdate !== undefined ? { label: textUpdate } : {}),
        }
      : {
          ...before.content,
          ...(textUpdate !== undefined ? { text: textUpdate } : {}),
          ...(textUpdate === undefined && labelUpdate !== undefined ? { text: labelUpdate } : {}),
        };

  const style = {
    ...before.style,
    ...(normalizeOptionalString(args.color) !== undefined ? { color: normalizeOptionalString(args.color) } : {}),
    ...(normalizeOptionalString(args.textColor) !== undefined
      ? { textColor: normalizeOptionalString(args.textColor) }
      : {}),
    ...(normalizeOptionalNumber(args.fontSize) !== undefined ? { fontSize: normalizeOptionalNumber(args.fontSize) } : {}),
    ...(normalizeOptionalString(args.fontWeight) !== undefined
      ? { fontWeight: normalizeOptionalString(args.fontWeight) }
      : {}),
    ...(normalizeOptionalString(args.align) !== undefined ? { align: normalizeOptionalString(args.align) } : {}),
    ...(normalizeOptionalString(args.paintStyle) !== undefined
      ? { paintStyle: normalizeOptionalString(args.paintStyle) }
      : {}),
    ...(normalizeOptionalNumber(args.strokeWidth) !== undefined
      ? { strokeWidth: normalizeOptionalNumber(args.strokeWidth) }
      : {}),
  };

  const shapeKind = normalizeShapeKind(args.shapeKind) ?? before.shapeKind;
  const resizedText = extractMutationSnapshotText(node.type, content);

  const estimatedSize = estimateNodeSize(
    node.type,
    shapeKind,
    resizedText,
    typeof style.fontSize === "number" ? style.fontSize : undefined,
  );

  return {
    type: "update_node",
    nodeId: node.id,
    before,
    after: {
      position: normalizeOptionalPosition(args.position) ?? before.position,
      parentId: normalizeOptionalString(args.parentId) ?? before.parentId,
      width: normalizeOptionalNumber(args.width) ?? Math.max(before.width ?? 0, estimatedSize.width),
      height: normalizeOptionalNumber(args.height) ?? Math.max(before.height ?? 0, estimatedSize.height),
      content,
      style,
      shapeKind,
      zIndex: normalizeOptionalNumber(args.zIndex) ?? before.zIndex,
    },
  };
}

function createNodeMutationSnapshot(node: CanvasNode): NodeMutationSnapshot {
  const text = extractMutationSnapshotText(node.type, node.data.content);
  const estimatedSize = estimateNodeSize(
    node.type,
    node.data.shapeKind,
    text,
    typeof node.data.style.fontSize === "number" ? node.data.style.fontSize : undefined,
  );

  return {
    position: { ...node.position },
    parentId: node.parentId ?? null,
    width: typeof node.width === "number" ? node.width : estimatedSize.width,
    height: typeof node.height === "number" ? node.height : estimatedSize.height,
    content: { ...node.data.content },
    style: { ...node.data.style },
    shapeKind: node.data.shapeKind,
    zIndex: node.data.zIndex,
  };
}

function extractMutationSnapshotText(
  nodeType: CanvasNode["type"],
  content: Record<string, unknown>,
): string {
  return nodeType === "shape"
    ? typeof content.label === "string"
      ? content.label
      : ""
    : typeof content.text === "string"
      ? content.text
      : "";
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
          minWidth: 320,
          maxWidth: 520,
          minHeight: 168,
          maxHeight: 340,
          paddingX: 80,
          paddingY: 68,
          targetLines: 4,
        }
      : nodeType === "text"
        ? {
            minWidth: 300,
            maxWidth: 560,
            minHeight: 80,
            maxHeight: 260,
            paddingX: 36,
            paddingY: 28,
            targetLines: 2,
          }
        : {
            minWidth: shapeKind === "ellipse" ? 260 : 240,
            maxWidth: shapeKind === "ellipse" ? 400 : 440,
            minHeight: shapeKind === "ellipse" ? 128 : 112,
            maxHeight: 240,
            paddingX: 46,
            paddingY: 34,
            targetLines: 2,
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
type RearrangeLayout = "force" | "mindmap" | "radial" | "horizontal" | "vertical" | "grid";

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

function resolveRearrangeNodeIds(requestedNodeIds: string[], snapshot: CanvasSnapshot): string[] {
  if (requestedNodeIds.length >= 2) {
    return requestedNodeIds;
  }

  if (snapshot.selectedNodeIds.length >= 2) {
    return [...snapshot.selectedNodeIds];
  }

  if (snapshot.nodes.length >= 2) {
    return snapshot.nodes.map((node) => node.id);
  }

  return [];
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
  const basePositions =
    diagramType === "mindmap" || diagramType === "concept_map"
      ? layoutMindmapNodes(nodes, edges, anchor, existingNodes, diagramType, rootKey)
      : layoutLayeredDiagramNodes(nodes, depthMap, layout, anchor, existingNodes, diagramType, rootKey);

  return relaxDiagramNodePositions(
    nodes,
    edges,
    basePositions,
    existingNodes,
    diagramType,
    rootKey,
  );
}

function layoutLayeredDiagramNodes(
  nodes: DiagramNodeInput[],
  depthMap: Map<string, number>,
  layout: DiagramLayout,
  anchor: Position,
  existingNodes: Map<string, ExistingNodeInfo>,
  diagramType: DiagramType,
  rootKey: string,
): Map<string, Position> {
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
      const widthGap = 88;
      const totalWidth = group.reduce(
        (sum, node, index) =>
          sum + getDiagramNodeSize(node, rootKey, diagramType, existingNodes).width + (index > 0 ? widthGap : 0),
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
          y: Math.round(anchor.y + depth * 280),
        });
        cursorX += size.width + widthGap;
      }
      continue;
    }

    const heightGap = 84;
    const totalHeight = group.reduce(
      (sum, node, index) =>
        sum + getDiagramNodeSize(node, rootKey, diagramType, existingNodes).height + (index > 0 ? heightGap : 0),
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
        x: Math.round(anchor.x + depth * 380),
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
  const subtreeGap = 72;
  const leafMinSpan = 160;

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

    const rootGap = 120;
    const baseStep = 340;
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
      positions.set(node.key, { x: rootPosition.x + rootSize.width + 260, y: fallbackY });
      fallbackY += getDiagramNodeSize(node, rootKey, diagramType, existingNodes).height + 64;
    }
  }

  return positions;
}

function relaxDiagramNodePositions(
  nodes: DiagramNodeInput[],
  edges: DiagramEdgeInput[],
  positions: Map<string, Position>,
  existingNodes: Map<string, ExistingNodeInfo>,
  diagramType: DiagramType,
  rootKey: string,
): Map<string, Position> {
  const nodeSpecs = nodes.map((node) => {
    const size = getDiagramNodeSize(node, rootKey, diagramType, existingNodes);
    return {
      id: node.key,
      width: size.width,
      height: size.height,
    };
  });

  const obstacleSpecs = [...existingNodes.entries()].map(([id, size]) => ({
    id: `obstacle:${id}`,
    width: size.width,
    height: size.height,
  }));
  const obstaclePositions = new Map<string, Position>(
    [...existingNodes.entries()].map(([id, size]) => [`obstacle:${id}`, size.position]),
  );

  const fixedIds = new Set<string>([
    ...nodes
      .filter((node) => node.existingNodeId && existingNodes.has(node.existingNodeId))
      .map((node) => node.key),
    ...obstacleSpecs.map((node) => node.id),
  ]);
  const rootPosition = positions.get(rootKey);

  return relaxNodeLayoutPositions(
    [...nodeSpecs, ...obstacleSpecs],
    edges.map((edge) => ({ source: edge.sourceKey, target: edge.targetKey })),
    new Map([...positions.entries(), ...obstaclePositions.entries()]),
    {
      fixedIds,
      spacing: diagramType === "mindmap" ? 126 : 112,
      iterations: diagramType === "mindmap" ? 60 : 48,
      anchor: rootPosition,
      preserveBias: 0.06,
    },
  );
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

function chooseLayoutRoot(nodes: CanvasNode[], snapshot: CanvasSnapshot): string {
  const selected = snapshot.selectedNodeIds.find((nodeId) => nodes.some((node) => node.id === nodeId));
  if (selected) {
    return selected;
  }

  const degree = new Map<string, number>();
  for (const node of nodes) {
    degree.set(node.id, 0);
  }
  for (const edge of snapshot.edges) {
    if (degree.has(edge.source)) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    }
    if (degree.has(edge.target)) {
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
  }

  return [...degree.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? nodes[0]!.id;
}

function rearrangeExistingNodes(
  nodes: CanvasNode[],
  snapshot: CanvasSnapshot,
  layout: RearrangeLayout,
  spacing: number,
  rootNodeId: string,
): Map<string, Position> {
  switch (layout) {
    case "horizontal":
    case "vertical":
    case "grid":
      return simpleExistingNodeLayout(nodes, layout, spacing);
    case "radial":
    case "mindmap":
      return radialExistingNodeLayout(nodes, spacing, rootNodeId);
    case "force":
    default:
      return forceDirectedExistingNodeLayout(nodes, snapshot, spacing, rootNodeId);
  }
}

function simpleExistingNodeLayout(
  nodes: CanvasNode[],
  layout: Extract<RearrangeLayout, "horizontal" | "vertical" | "grid">,
  spacing: number,
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const sorted = [...nodes].sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);
  const anchor = sorted[0]?.position ?? { x: 0, y: 0 };

  if (layout === "grid") {
    const columns = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));
    sorted.forEach((node, index) => {
      const size = createNodeMutationSnapshot(node);
      const column = index % columns;
      const row = Math.floor(index / columns);
      positions.set(node.id, {
        x: Math.round(anchor.x + column * ((size.width ?? 220) + spacing)),
        y: Math.round(anchor.y + row * ((size.height ?? 120) + spacing)),
      });
    });
    return positions;
  }

  let cursorX = anchor.x;
  let cursorY = anchor.y;
  for (const node of sorted) {
    const size = createNodeMutationSnapshot(node);
    positions.set(node.id, { x: Math.round(cursorX), y: Math.round(cursorY) });
    if (layout === "horizontal") {
      cursorX += (size.width ?? 220) + spacing;
    } else {
      cursorY += (size.height ?? 120) + spacing;
    }
  }

  return positions;
}

function radialExistingNodeLayout(
  nodes: CanvasNode[],
  spacing: number,
  rootNodeId: string,
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const root = nodes.find((node) => node.id === rootNodeId) ?? nodes[0];
  if (!root) {
    return positions;
  }

  positions.set(root.id, { ...root.position });
  const others = nodes.filter((node) => node.id !== root.id);
  const rootSize = createNodeMutationSnapshot(root);
  const radius = Math.max(240, spacing * 1.4 + Math.max(rootSize.width ?? 0, rootSize.height ?? 0));

  others.forEach((node, index) => {
    const angle = (-Math.PI / 2) + (index / Math.max(others.length, 1)) * Math.PI * 2;
    const size = createNodeMutationSnapshot(node);
    positions.set(node.id, {
      x: Math.round(root.position.x + Math.cos(angle) * radius - (size.width ?? 220) / 2),
      y: Math.round(root.position.y + Math.sin(angle) * radius - (size.height ?? 120) / 2),
    });
  });

  return positions;
}

function forceDirectedExistingNodeLayout(
  nodes: CanvasNode[],
  snapshot: CanvasSnapshot,
  spacing: number,
  rootNodeId: string,
): Map<string, Position> {
  const root = nodes.find((node) => node.id === rootNodeId) ?? nodes[0];
  const selectedIds = new Set(nodes.map((node) => node.id));
  const edges = snapshot.edges.filter(
    (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target),
  );

  if (!root) {
    return new Map();
  }

  const initialPositions = new Map(nodes.map((node) => [node.id, { ...node.position }]));
  const nodeSpecs = nodes.map((node) => {
    const snapshotState = createNodeMutationSnapshot(node);
    return {
      id: node.id,
      width: snapshotState.width ?? 220,
      height: snapshotState.height ?? 120,
    };
  });

  return relaxNodeLayoutPositions(
    nodeSpecs,
    edges.map((edge) => ({ source: edge.source, target: edge.target })),
    initialPositions,
    {
      fixedIds: new Set([root.id]),
      spacing,
      anchor: root.position,
      preserveBias: 0.08,
      iterations: 64,
    },
  );
}

function legacyCreateNodePayload(
  action: CreateNodeAction,
  context: ActionContext,
): Record<string, unknown> {
  return {
    id: action.nodeId,
    type: action.nodeType,
    position: action.position,
    style: action.width || action.height ? { width: action.width, height: action.height } : undefined,
    data: {
      objectType: action.objectType,
      content: action.content,
      style: action.style,
      shapeKind: action.shapeKind,
      zIndex: action.zIndex ?? 10,
      _ai: {
        actionId: context.commandId ?? null,
        commandId: context.commandId ?? null,
        requestedBy: context.requestedBy ?? null,
        status: "pending",
        createdAt: Date.now(),
      },
    },
  };
}

function legacyUpdateNodePayload(action: UpdateNodeAction): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    position: action.after.position,
    parentId: action.after.parentId ?? null,
    width: action.after.width,
    height: action.after.height,
    "data.shapeKind": action.after.shapeKind,
    zIndex: action.after.zIndex,
  };

  if (typeof action.after.content.label === "string") {
    payload["data.content.label"] = action.after.content.label;
  }
  if (typeof action.after.content.text === "string") {
    payload["data.content.text"] = action.after.content.text;
  }
  if (typeof action.after.style.color === "string") {
    payload["data.style.color"] = action.after.style.color;
  }
  if (typeof action.after.style.textColor === "string") {
    payload["data.style.textColor"] = action.after.style.textColor;
  }
  if (typeof action.after.style.fontSize === "number") {
    payload["data.style.fontSize"] = action.after.style.fontSize;
  }
  if (typeof action.after.style.fontWeight === "string") {
    payload["data.style.fontWeight"] = action.after.style.fontWeight;
  }
  if (typeof action.after.style.paintStyle === "string") {
    payload["data.style.paintStyle"] = action.after.style.paintStyle;
  }
  if (typeof action.after.style.strokeWidth === "number") {
    payload["data.style.strokeWidth"] = action.after.style.strokeWidth;
  }

  return payload;
}

function legacyCreateEdgePayload(
  action: CreateEdgeAction,
  context: ActionContext,
): Record<string, unknown> {
  return {
    id: action.edgeId,
    source: action.source,
    target: action.target,
    label: action.label,
    _ai: {
      actionId: context.commandId ?? null,
      commandId: context.commandId ?? null,
      requestedBy: context.requestedBy ?? null,
      status: "pending",
      createdAt: Date.now(),
    },
  };
}

interface LayoutNodeSpec {
  id: string;
  width: number;
  height: number;
}

interface LayoutEdgeSpec {
  source: string;
  target: string;
}

function relaxNodeLayoutPositions(
  nodeSpecs: LayoutNodeSpec[],
  edges: LayoutEdgeSpec[],
  initialPositions: Map<string, Position>,
  options: {
    fixedIds?: Set<string>;
    spacing: number;
    anchor?: Position;
    preserveBias?: number;
    iterations?: number;
  },
): Map<string, Position> {
  const fixedIds = options.fixedIds ?? new Set<string>();
  const iterations = options.iterations ?? 48;
  const preserveBias = options.preserveBias ?? 0.06;
  const centers = new Map<string, { x: number; y: number }>();
  const initialCenters = new Map<string, { x: number; y: number }>();
  const specById = new Map(nodeSpecs.map((node) => [node.id, node]));

  for (const node of nodeSpecs) {
    const position = initialPositions.get(node.id) ?? { x: 0, y: 0 };
    const center = {
      x: position.x + node.width / 2,
      y: position.y + node.height / 2,
    };
    centers.set(node.id, { ...center });
    initialCenters.set(node.id, center);
  }

  const anchorCenter = options.anchor
    ? { x: options.anchor.x, y: options.anchor.y }
    : undefined;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const forces = new Map<string, { x: number; y: number }>();
    for (const node of nodeSpecs) {
      forces.set(node.id, { x: 0, y: 0 });
    }

    for (let index = 0; index < nodeSpecs.length; index += 1) {
      for (let inner = index + 1; inner < nodeSpecs.length; inner += 1) {
        const left = nodeSpecs[index]!;
        const right = nodeSpecs[inner]!;
        const leftCenter = centers.get(left.id)!;
        const rightCenter = centers.get(right.id)!;
        const deltaX = rightCenter.x - leftCenter.x;
        const deltaY = rightCenter.y - leftCenter.y;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const desiredX = left.width / 2 + right.width / 2 + options.spacing;
        const desiredY = left.height / 2 + right.height / 2 + options.spacing * 0.78;
        const overlapX = desiredX - Math.abs(deltaX);
        const overlapY = desiredY - Math.abs(deltaY);
        const shouldRepel = overlapX > 0 || overlapY > 0;

        if (!shouldRepel && distance > Math.max(desiredX, desiredY) * 1.15) {
          continue;
        }

        const unitX = deltaX / distance;
        const unitY = deltaY / distance;
        const pushMagnitude = shouldRepel
          ? Math.max(overlapX, overlapY, 8) * 0.18
          : (Math.max(desiredX, desiredY) * 1.15 - distance) * 0.02;

        forces.get(left.id)!.x -= unitX * pushMagnitude;
        forces.get(left.id)!.y -= unitY * pushMagnitude;
        forces.get(right.id)!.x += unitX * pushMagnitude;
        forces.get(right.id)!.y += unitY * pushMagnitude;
      }
    }

    for (const edge of edges) {
      const sourceSpec = specById.get(edge.source);
      const targetSpec = specById.get(edge.target);
      const source = centers.get(edge.source);
      const target = centers.get(edge.target);
      if (!sourceSpec || !targetSpec || !source || !target) {
        continue;
      }

      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const idealDistance =
        sourceSpec.width / 2 + targetSpec.width / 2 + options.spacing * 1.35;
      const pull = (distance - idealDistance) * 0.035;
      const unitX = deltaX / distance;
      const unitY = deltaY / distance;

      forces.get(edge.source)!.x += unitX * pull;
      forces.get(edge.source)!.y += unitY * pull;
      forces.get(edge.target)!.x -= unitX * pull;
      forces.get(edge.target)!.y -= unitY * pull;
    }

    for (const node of nodeSpecs) {
      if (fixedIds.has(node.id)) {
        continue;
      }

      const center = centers.get(node.id)!;
      const force = forces.get(node.id)!;
      const initialCenter = initialCenters.get(node.id)!;

      center.x += force.x + (initialCenter.x - center.x) * preserveBias;
      center.y += force.y + (initialCenter.y - center.y) * preserveBias;

      if (anchorCenter) {
        center.x += (anchorCenter.x - center.x) * 0.0025;
        center.y += (anchorCenter.y - center.y) * 0.0025;
      }
    }
  }

  return new Map(
    nodeSpecs.map((node) => {
      const center = centers.get(node.id)!;
      return [
        node.id,
        {
          x: Math.round(center.x - node.width / 2),
          y: Math.round(center.y - node.height / 2),
        },
      ];
    }),
  );
}
