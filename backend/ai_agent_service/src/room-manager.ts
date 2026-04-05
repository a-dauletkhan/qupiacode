import { randomUUID } from "node:crypto";
import { Liveblocks, type CommentBody } from "@liveblocks/node";
import { ActionExecutor } from "./action-executor.js";
import { config } from "./config.js";
import { ContextAccumulator } from "./context-accumulator.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createOpenAIProvider } from "./llm/openai-provider.js";
import { createProviderRouter } from "./llm/provider-router.js";
import type { LLMProvider, Message } from "./llm/types.js";
import { roomLogger } from "./logger.js";
import { SupabaseRoomStore } from "./persistence/supabase-room-store.js";
import { canvasTools } from "./tools/canvas-tools.js";
import type {
  ActivityEvent,
  AgentAction,
  AgentStatus,
  CommandRequest,
  CommandResponse,
  FeedbackRequest,
  FeedbackResponse,
  PendingActionResponse,
  QueueItem,
  QueueStatusResponse,
  RecordingSystemEventPayload,
  TargetPersona,
  TranscriptIngestionPayload,
} from "./types.js";

const MAX_QUEUE_DEPTH = 10;

const BASE_SYSTEM_PROMPT = `You are an AI assistant helping on a collaborative whiteboard.

You receive the exact canvas snapshot that the user currently sees, plus recent chat, transcript, and feedback context.

Rules:
- Answer explicit user requests only.
- Describe what you can actually see in the provided snapshot. Do not guess unseen content.
- For multi-step routines, mindmaps, workflows, timelines, trees, and other structured diagrams, use createDiagram.
- If the user asks for N steps, stages, blocks, or branches, create separate nodes for those items instead of summarizing them into one block.
- Prefer createDiagram over repeated createNode/createEdge calls whenever more than 2 nodes or any branching is needed.
- Keep text readable. Prefer short labels for main shape nodes, and put longer supporting details in sticky notes or separate branch nodes.
- Do not cram long comma-separated content into tiny shapes.
- If you propose board changes, only create new pending draft nodes or edges.
- You may connect new draft nodes to existing visible nodes when that clearly helps satisfy the request.
- Do not delete existing user-created nodes in this mode.
- You may update existing user-created nodes as pending changes when the user explicitly asks for edits, color changes, cleaner spacing, better readability, or reduced overlap.
- When the user asks to edit, recolor, rename, move, resize, or restyle existing blocks, prefer updateNode over creating new nodes.
- When one or more nodes are selected and the request sounds like an edit, treat the selected nodes as the default targets unless the user clearly says otherwise.
- When the user asks to clean up layout, reduce overlaps, or untangle connections, prefer rearrangeNodes.
- rearrangeNodes may omit nodeIds when the selected nodes or the whole visible board should be cleaned up together.
- When the user asks to recolor, resize, move, or restyle an existing block, prefer updateNode.
- Do not collapse a requested structure into a single summary node.
- Create as many pending draft nodes and edges as needed to satisfy the user's request.
- Keep drafts reversible and keep your chat reply concise.
- If no board change is needed, reply with text only.`;

const PERSONA_APPENDICES: Record<TargetPersona, string> = {
  designer: `Persona: Designer.
- Focus on layout clarity, hierarchy, grouping, readability, and visual flow.
- Prefer diagrams, labeled sections, and clean spatial organization over long chat-only explanations.
- When generating structure, make it easy to scan from left-to-right or center-out.`,
  critique: `Persona: Critique.
- Focus on gaps, risks, weak structure, ambiguity, and possible improvements.
- If the user asks for analysis, explain clearly what works and what needs work before adding new canvas elements.
- Only create canvas drafts when they directly support the critique with a clearer alternative.`,
  marketing: `Persona: Marketing.
- Focus on audience, positioning, copy, naming, messaging, benefits, and differentiation.
- Prefer concise, punchy labels and supporting notes that can be turned into messaging frameworks.
- When making canvas drafts, organize ideas into clear message pillars, comparisons, or audience flows.`,
};

interface DraftExpectation {
  minNodes: number;
  minEdges: number;
}

interface DeferredQueueItem {
  item: QueueItem;
  request: CommandRequest;
  resolve: (value: CommandResponse) => void;
  reject: (reason?: unknown) => void;
}

interface RoomSession {
  accumulator: ContextAccumulator;
  commandQueue: DeferredQueueItem[];
  currentCommand: (QueueItem & { startedAt: number }) | null;
  isProcessing: boolean;
  recentActions: AgentAction[];
}

export class RoomManager {
  private llm: LLMProvider;
  private sessions = new Map<string, RoomSession>();
  private store = new SupabaseRoomStore();
  private liveblocks = new Liveblocks({ secret: config.liveblocks.secretKey });

  constructor() {
    const claude = createClaudeProvider(config.llm.anthropic.apiKey, config.llm.anthropic.model);
    const openai = createOpenAIProvider(
      config.llm.openai.apiKey,
      config.llm.openai.model,
      config.llm.openai.baseURL,
    );
    this.llm = createProviderRouter({ claude, openai }, config.llm.provider);
  }

  async joinRoom(roomId: string): Promise<void> {
    const log = roomLogger(roomId);
    if (this.sessions.has(roomId)) {
      await this.store.touchRoomSession(roomId, { source: "join_room_existing" });
      log.debug("Already in room, skipping join");
      return;
    }

    this.sessions.set(roomId, {
      accumulator: new ContextAccumulator({
        maxTranscriptSegments: 20,
        maxRecentChanges: 30,
        maxActivityEvents: 50,
        maxFeedbackEntries: 20,
      }),
      commandQueue: [],
      currentCommand: null,
      isProcessing: false,
      recentActions: [],
    });

    await this.store.touchRoomSession(roomId, { source: "join_room" });
    log.info("Joined room");
  }

  async leaveRoom(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) {
      return;
    }

    session.commandQueue.splice(0).forEach((entry) =>
      entry.reject(new Error("Room closed before command completed")),
    );
    this.sessions.delete(roomId);
    await this.store.endRoomSession(roomId);
    roomLogger(roomId).info("Left room");
  }

  hasRoom(roomId: string): boolean {
    return this.sessions.has(roomId);
  }

  async handleTranscript(roomId: string, event: TranscriptIngestionPayload): Promise<void> {
    if (!event.is_final) {
      return;
    }

    await this.ensureRoom(roomId);

    const session = this.sessions.get(roomId);
    if (!session) {
      return;
    }

    session.accumulator.addTranscriptSegment({
      utteranceId: event.utterance_id,
      segmentId: event.segment_id,
      participantIdentity: event.participant_identity,
      speakerId: event.speaker_id,
      speakerName: event.speaker_name,
      text: event.text,
      source: event.source,
      occurredAt: event.occurred_at,
      timestamp: Date.parse(event.occurred_at),
      startTimeMs: event.start_time_ms,
      endTimeMs: event.end_time_ms,
    });

    await this.store.touchRoomSession(roomId, { source: "transcript" });
  }

  async handleSystemEvent(roomId: string, event: RecordingSystemEventPayload): Promise<void> {
    await this.store.touchRoomSession(roomId, { source: "system_event" });
    await this.store.upsertRecording(event);
    await this.store.appendRoomEvent({
      roomId,
      eventType: event.event_type,
      source: "system",
      actorType: "system",
      actorId: event.recording_id,
      occurredAt: event.occurred_at,
      payload: event as unknown as Record<string, unknown>,
    });
  }

  async handleCommand(roomId: string, request: CommandRequest): Promise<CommandResponse> {
    const log = roomLogger(roomId);
    await this.ensureRoom(roomId);

    const session = this.sessions.get(roomId);
    if (!session) {
      throw new Error("Room not found");
    }

    if (session.commandQueue.length + (session.currentCommand ? 1 : 0) >= MAX_QUEUE_DEPTH) {
      throw new QueueFullError();
    }

    const commandId = `cmd-${randomUUID().slice(0, 8)}`;
    const item: QueueItem = {
      commandId,
      userId: request.userId,
      userName: request.userName,
      message: request.message,
      source: request.source,
      queuedAt: Date.now(),
    };

    const responsePromise = new Promise<CommandResponse>((resolve, reject) => {
      session.commandQueue.push({
        item,
        request,
        resolve,
        reject,
      });
    });

    log.info({ commandId, position: session.commandQueue.length, userId: request.userId }, "Command queued");

    await this.store.touchRoomSession(roomId, { source: "command" });
    await this.store.appendRoomEvent({
      roomId,
      eventType: "ai.command.queued",
      source: "frontend",
      actorType: "user",
      actorId: request.userId,
      occurredAt: new Date(item.queuedAt).toISOString(),
      payload: {
        command_id: commandId,
        message: request.message,
        source: request.source,
        thread_id: request.threadId ?? null,
        target_persona: request.targetPersona ?? null,
      },
    });

    void this.processQueue(roomId).catch((err) => log.error({ err }, "Queue processing error"));

    return responsePromise;
  }

  async handleEvents(roomId: string, userId: string, events: ActivityEvent[]): Promise<number> {
    await this.ensureRoom(roomId);
    const session = this.sessions.get(roomId);
    if (!session) {
      return 0;
    }

    const chatEvents = events.filter((event) => event.type.startsWith("chat."));
    const canvasEvents = events.filter((event) => !event.type.startsWith("chat."));

    if (canvasEvents.length > 0) {
      session.accumulator.addActivityEvents(canvasEvents);
      await this.store.appendRoomEvent({
        roomId,
        eventType: "canvas.activity.batch",
        source: "frontend",
        actorType: "user",
        actorId: userId,
        occurredAt: new Date(canvasEvents[canvasEvents.length - 1]!.timestamp).toISOString(),
        payload: {
          user_id: userId,
          events: canvasEvents,
        },
      });
    }

    for (const event of chatEvents) {
      const roomEventType =
        event.type === "chat.message.mentioned_ai"
          ? "chat.message.mentioned_ai"
          : "chat.message.created";
      const text =
        typeof event.data.text === "string"
          ? event.data.text
          : typeof event.data.body === "string"
            ? event.data.body
            : "";
      session.accumulator.addChatMessage(
        userId,
        text,
        event.type === "chat.message.mentioned_ai",
        event.timestamp,
      );
      await this.store.appendRoomEvent({
        roomId,
        eventType: roomEventType,
        source: "frontend",
        actorType: "user",
        actorId: userId,
        occurredAt: new Date(event.timestamp).toISOString(),
        payload: event.data,
      });
    }

    await this.store.touchRoomSession(roomId, { source: "events" });
    roomLogger(roomId).debug({ userId, count: events.length }, "Activity events received");
    return events.length;
  }

  async handleFeedback(roomId: string, feedback: FeedbackRequest): Promise<FeedbackResponse> {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session) {
      throw new Error("Room not found");
    }

    log.info({ actionId: feedback.actionId, status: feedback.status }, "Feedback received");

    session.accumulator.addFeedback(feedback.userId, feedback.actionId, feedback.status, feedback.reason);

    const action = session.recentActions.find((entry) => entry.actionId === feedback.actionId);
    if (action) {
      action.status = feedback.status;
    }
    session.accumulator.setPendingActions(session.recentActions.filter((entry) => entry.status === "pending"));

    await this.store.insertActionFeedback(
      roomId,
      feedback.actionId,
      feedback.userId,
      feedback.status,
      feedback.reason,
    );
    await this.store.updateActionStatus(roomId, feedback.actionId, feedback.status);
    await this.store.appendRoomEvent({
      roomId,
      eventType: feedback.status === "approved" ? "ai.action.approved" : "ai.action.rejected",
      source: "frontend",
      actorType: "user",
      actorId: feedback.userId,
      occurredAt: new Date().toISOString(),
      payload: {
        action_id: feedback.actionId,
        node_ids: feedback.nodeIds,
        edge_ids: feedback.edgeIds,
        reason: feedback.reason ?? null,
      },
    });
    await this.store.touchRoomSession(roomId, { source: "feedback" });

    return {
      ok: true,
      actionId: feedback.actionId,
      status: feedback.status,
    };
  }

  getQueueStatus(roomId: string): QueueStatusResponse {
    const session = this.sessions.get(roomId);
    if (!session) {
      throw new Error("Room not found");
    }

    session.accumulator.setPendingActions(session.recentActions.filter((entry) => entry.status === "pending"));

    const agentStatus: AgentStatus = session.isProcessing
      ? "acting"
      : session.currentCommand
        ? "processing"
        : "idle";

    return {
      agentStatus,
      currentCommand: session.currentCommand
        ? {
            commandId: session.currentCommand.commandId,
            userId: session.currentCommand.userId,
            userName: session.currentCommand.userName,
            message: session.currentCommand.message,
            startedAt: session.currentCommand.startedAt,
          }
        : null,
      queue: session.commandQueue.map(({ item }, index) => ({
        commandId: item.commandId,
        userId: item.userId,
        userName: item.userName,
        message: item.message,
        queuedAt: item.queuedAt,
        position: index + 1,
      })),
      recentActions: session.recentActions.slice(-20),
    };
  }

  async handleStorageChange(roomId: string, description: string, userId: string): Promise<void> {
    await this.ensureRoom(roomId);
    const session = this.sessions.get(roomId);
    if (!session) {
      return;
    }

    session.accumulator.addChange(userId, description);
    await this.store.touchRoomSession(roomId, { source: "storage_change" });
    await this.store.appendRoomEvent({
      roomId,
      eventType: "canvas.storage.synced",
      source: "liveblocks",
      actorType: "user",
      actorId: userId,
      occurredAt: new Date().toISOString(),
      payload: {
        description,
      },
    });
  }

  private async ensureRoom(roomId: string): Promise<void> {
    if (!this.sessions.has(roomId)) {
      await this.joinRoom(roomId);
    }
  }

  private async processQueue(roomId: string): Promise<void> {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session || session.isProcessing) {
      return;
    }

    while (session.commandQueue.length > 0) {
      const next = session.commandQueue.shift()!;
      session.currentCommand = { ...next.item, startedAt: Date.now() };
      session.isProcessing = true;

      log.info({ commandId: next.item.commandId, userId: next.item.userId }, "Processing command");

      try {
        next.resolve(await this.executeCommand(roomId, session, next.item.commandId, next.request));
      } catch (err) {
        log.error({ err, commandId: next.item.commandId }, "Command processing error");
        next.reject(err);
      } finally {
        session.currentCommand = null;
        session.isProcessing = false;
      }
    }
  }

  private async executeCommand(
    roomId: string,
    session: RoomSession,
    commandId: string,
    request: CommandRequest,
  ): Promise<CommandResponse> {
    session.accumulator.updateCanvasSnapshot(request.canvasSnapshot.nodes, request.canvasSnapshot.edges);
    session.accumulator.addChange(
      request.userId,
      `[Command:${request.source}] ${request.message} (selected: ${
        request.canvasSnapshot.selectedNodeIds.join(", ") || "none"
      })`,
    );

    const context = session.accumulator.buildContext();
    const selectedInfo = buildSelectedNodeInfo(request);
    const actionHint = buildExplicitActionHint(request);
    const systemPrompt = buildSystemPrompt(request.targetPersona);
    const personaHint = buildPersonaUserHint(request.targetPersona);

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${personaHint ? `${personaHint}\n\n` : ""}${actionHint ? `${actionHint}\n\n` : ""}User request (${request.source}): "${request.message}"${selectedInfo}\n\nCurrent room context:\n\n${context}`,
      },
    ];

    const expectation = inferStructuredDraftExpectation(request.message);
    let response = await this.llm.chat(messages, canvasTools);
    roomLogger(roomId).info(
      { toolCalls: response.toolCalls.length, hasText: !!response.text },
      "LLM response received",
    );

    let executor = new ActionExecutor({
      commandId,
      requestedBy: request.userId,
      canvasSnapshot: request.canvasSnapshot,
    });
    await executor.execute(response.toolCalls);

    if (expectation && shouldRetryStructuredDraft(executor, expectation)) {
      roomLogger(roomId).info(
        {
          commandId,
          createdNodes: executor.createdNodeIds.length,
          createdEdges: executor.createdEdgeIds.length,
          minNodes: expectation.minNodes,
          minEdges: expectation.minEdges,
        },
        "Retrying structured draft because the first pass was too small",
      );

      response = await this.llm.chat(
        [
          ...messages,
          {
            role: "user",
            content: buildStructuredDraftRetryPrompt(request, executor, expectation),
          },
        ],
        canvasTools,
      );
      roomLogger(roomId).info(
        { toolCalls: response.toolCalls.length, hasText: !!response.text },
        "LLM retry response received",
      );

      executor = new ActionExecutor({
        commandId,
        requestedBy: request.userId,
        canvasSnapshot: request.canvasSnapshot,
      });
      await executor.execute(response.toolCalls);
    }

    const message = buildAssistantMessage(response.text, executor.messages, request.message);
    const pendingAction = await this.persistPendingAction(roomId, session, commandId, request, executor, message);
    const publishedThreadId = await this.publishAssistantMessage(roomId, request, message);

    if (message) {
      await this.store.appendRoomEvent({
        roomId,
        eventType: "ai.suggestion.created",
        source: "ai_agent",
        actorType: "ai",
        actorId: "ai-agent",
        occurredAt: new Date().toISOString(),
        payload: {
          command_id: commandId,
          requested_by: request.userId,
          thread_id: request.threadId ?? null,
          published_thread_id: publishedThreadId,
          target_persona: request.targetPersona ?? null,
          message,
        },
      });
    }

    await this.store.touchRoomSession(roomId, { source: "agent_action" });

    return {
      commandId,
      message,
      pendingAction,
    };
  }

  private async persistPendingAction(
    roomId: string,
    session: RoomSession,
    commandId: string,
    request: CommandRequest,
    executor: ActionExecutor,
    message: string,
  ): Promise<PendingActionResponse | null> {
    if (executor.actions.length === 0) {
      return null;
    }

    const action: AgentAction = {
      actionId: executor.actionId,
      commandId,
      type: "canvas_mutation",
      nodeIds: executor.createdNodeIds,
      edgeIds: executor.createdEdgeIds,
      status: "pending",
      createdAt: Date.now(),
    };

    session.recentActions.push(action);
    session.recentActions = session.recentActions.slice(-50);
    session.accumulator.setPendingActions(session.recentActions.filter((entry) => entry.status === "pending"));

    const summary = message || `Prepared a pending draft for "${request.message}".`;

    await this.store.upsertAction({
      ...action,
      roomId,
      requestedBy: request.userId,
      summary,
    });
    await this.store.appendRoomEvent({
      roomId,
      eventType: "ai.action.pending",
      source: "ai_agent",
      actorType: "ai",
      actorId: "ai-agent",
      occurredAt: new Date(action.createdAt).toISOString(),
      payload: {
        action_id: action.actionId,
        command_id: action.commandId,
        node_ids: action.nodeIds,
        edge_ids: action.edgeIds,
        requested_by: request.userId,
        summary,
        actions: executor.actions,
      },
    });

    return {
      actionId: action.actionId,
      summary,
      actions: executor.actions,
      requiresApproval: true,
    };
  }

  private async publishAssistantMessage(
    roomId: string,
    request: CommandRequest,
    message: string,
  ): Promise<string | null> {
    if (!message.trim()) {
      return request.threadId ?? null;
    }

    const body = toCommentBody(message);
    try {
      if (request.threadId) {
        await this.liveblocks.createComment({
          roomId,
          threadId: request.threadId,
          data: {
            userId: "ai-agent",
            createdAt: new Date(),
            body,
          },
        });
        return request.threadId;
      }

      const thread = await this.liveblocks.createThread({
        roomId,
        data: {
          metadata: {},
          comment: {
            userId: "ai-agent",
            createdAt: new Date(),
            body,
          },
        },
      });
      return thread.id;
    } catch (err) {
      roomLogger(roomId).error({ err, threadId: request.threadId ?? null }, "Failed to publish assistant message");
      return request.threadId ?? null;
    }
  }
}

function buildAssistantMessage(responseText: string | null, toolMessages: string[], userMessage: string): string {
  const candidates = [responseText, ...toolMessages]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  const deduped = candidates.filter((value, index) => candidates.indexOf(value) === index);
  if (deduped.length > 0) {
    return deduped.join("\n\n");
  }

  return `I reviewed "${userMessage}" and prepared the most relevant next step I could from the current board context.`;
}

function toCommentBody(text: string): CommentBody {
  return {
    version: 1,
    content: text.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      children: [{ text: paragraph }],
    })),
  };
}

function buildSelectedNodeInfo(request: CommandRequest): string {
  if (request.canvasSnapshot.selectedNodeIds.length === 0) {
    return "\nSelected node ids: none";
  }

  const selectedNodes = request.canvasSnapshot.nodes.filter((node) =>
    request.canvasSnapshot.selectedNodeIds.includes(node.id),
  );

  if (selectedNodes.length === 0) {
    return `\nSelected node ids: ${request.canvasSnapshot.selectedNodeIds.join(", ")}`;
  }

  const descriptions = selectedNodes.map((node) => {
    const content = node.data.content as Record<string, unknown> | undefined;
    const label =
      (typeof content?.label === "string" && content.label.trim()) ||
      (typeof content?.text === "string" && content.text.trim()) ||
      "";
    const color = typeof node.data.style.color === "string" ? node.data.style.color : undefined;
    const width = typeof node.width === "number" ? Math.round(node.width) : undefined;
    const height = typeof node.height === "number" ? Math.round(node.height) : undefined;
    const meta = [
      `id=${node.id}`,
      `type=${node.type}`,
      `pos=(${Math.round(node.position.x)}, ${Math.round(node.position.y)})`,
      width && height ? `size=${width}x${height}` : null,
      color ? `color=${color}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return label
      ? `"${label}" (${meta})`
      : `${node.id} (${meta})`;
  });

  return `\nSelected nodes: ${descriptions.join(", ")}`;
}

function buildExplicitActionHint(request: CommandRequest): string {
  const lower = request.message.toLowerCase();
  const hasSelection = request.canvasSnapshot.selectedNodeIds.length > 0;
  const editIntent = /\b(edit|update|change|rename|rewrite|reword|recolor|color|move|reposition|resize|restyle|align|make .* (?:blue|green|yellow|bigger|smaller))\b/.test(
    lower,
  );
  const layoutIntent = /\b(layout|rearrange|untangle|tidy|clean up|cleanup|organize|space out|spread out|overlap|overlapping|readability|less overlap)\b/.test(
    lower,
  );

  if (layoutIntent) {
    return hasSelection
      ? `Important: this is a layout-cleanup request on existing selected nodes (${request.canvasSnapshot.selectedNodeIds.join(", ")}). Prefer rearrangeNodes and targeted updateNode calls. Do not create new nodes unless the user explicitly asks for new content.`
      : "Important: this is a layout-cleanup request on the existing board. Prefer rearrangeNodes and targeted updateNode calls. Do not create new nodes unless the user explicitly asks for new content.";
  }

  if (editIntent && hasSelection) {
    return `Important: this is an edit request targeting the selected node ids ${request.canvasSnapshot.selectedNodeIds.join(", ")}. Prefer updateNode on those existing nodes instead of createNode.`;
  }

  if (editIntent) {
    return "Important: this is an edit request on existing content. Prefer updateNode over createNode when possible.";
  }

  return "";
}

function buildSystemPrompt(targetPersona: TargetPersona | null | undefined): string {
  if (!targetPersona) {
    return BASE_SYSTEM_PROMPT;
  }

  return `${BASE_SYSTEM_PROMPT}\n\n${PERSONA_APPENDICES[targetPersona]}`;
}

function buildPersonaUserHint(targetPersona: TargetPersona | null | undefined): string {
  if (!targetPersona) {
    return "";
  }

  switch (targetPersona) {
    case "designer":
      return "The user explicitly asked for the designer persona. Optimize for visual clarity, hierarchy, and readable diagram structure.";
    case "critique":
      return "The user explicitly asked for the critique persona. Optimize for reviewing the current board, pointing out issues, and proposing improvements.";
    case "marketing":
      return "The user explicitly asked for the marketing persona. Optimize for messaging, positioning, naming, and copy-focused structure.";
    default:
      return "";
  }
}

export class QueueFullError extends Error {
  constructor() {
    super("AI agent queue for this room is full. Try again shortly.");
    this.name = "QueueFullError";
  }
}

function inferStructuredDraftExpectation(message: string): DraftExpectation | null {
  const lower = message.toLowerCase();
  const looksStructured = /\b(mindmap|workflow|flowchart|diagram|routine|steps?|stages?|timeline|process|branch|branches|tree|connected)\b/.test(
    lower,
  );

  if (!looksStructured) {
    return null;
  }

  const numericMatch = lower.match(/\b(\d+)\s+(?:step|steps|stage|stages|block|blocks|node|nodes|part|parts|item|items)\b/);
  const numericTarget = numericMatch ? Number.parseInt(numericMatch[1] ?? "", 10) : Number.NaN;
  const minNodes = Number.isFinite(numericTarget) ? Math.max(2, numericTarget) : 3;
  const minEdges = Math.max(1, minNodes - 1);
  return { minNodes, minEdges };
}

function shouldRetryStructuredDraft(executor: ActionExecutor, expectation: DraftExpectation): boolean {
  return executor.createdNodeIds.length < expectation.minNodes || executor.createdEdgeIds.length < expectation.minEdges;
}

function buildStructuredDraftRetryPrompt(
  request: CommandRequest,
  executor: ActionExecutor,
  expectation: DraftExpectation,
): string {
  const selectedHint = request.canvasSnapshot.selectedNodeIds.length
    ? `Selected existing node ids you may reuse as roots via existingNodeId: ${request.canvasSnapshot.selectedNodeIds.join(", ")}.`
    : "No existing node is selected, so create the full structure from scratch.";

  return `The previous draft was too small for the user's request.

User request: "${request.message}"
The previous draft created ${executor.createdNodeIds.length} new nodes and ${executor.createdEdgeIds.length} new edges.
Retry with a proper structured draft that creates at least ${expectation.minNodes} separate nodes and ${expectation.minEdges} connecting edges when appropriate.

Important:
- Use createDiagram for the whole structure.
- Do not collapse the structure into one summary node.
- If the canvas already contains a suitable root node, you may reuse it by setting existingNodeId on that diagram node instead of duplicating it.
- Include every requested step or branch as its own node.

${selectedHint}`;
}
