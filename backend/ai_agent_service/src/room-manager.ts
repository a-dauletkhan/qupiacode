import { Liveblocks, type PlainLsonObject } from "@liveblocks/node";
import { createClient, type Room as LbRoom } from "@liveblocks/client";
import { config } from "./config.js";
import { roomLogger } from "./logger.js";
import { ContextAccumulator } from "./context-accumulator.js";
import { DecisionEngine } from "./decision-engine.js";
import { ActionExecutor, type StorageAdapter, type ActionContext } from "./action-executor.js";
import { canvasTools } from "./tools/canvas-tools.js";
import { createProviderRouter } from "./llm/provider-router.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createOpenAIProvider } from "./llm/openai-provider.js";
import type { LLMProvider, Message } from "./llm/types.js";
import type { TranscriptSource } from "./transcript/types.js";
import type {
  QueueItem,
  AgentAction,
  AgentStatus,
  QueueStatusResponse,
  CommandRequest,
  CommandResponse,
  ActivityEvent,
  FeedbackRequest,
  FeedbackResponse,
} from "./types.js";
import { randomUUID } from "node:crypto";

const MAX_QUEUE_DEPTH = 10;

const SYSTEM_PROMPT = `You are an AI assistant participating in a collaborative canvas whiteboarding session. You can see what's on the canvas and hear what users are saying.

Your role:
- Help organize and structure ideas on the canvas
- Create visual representations of concepts being discussed
- Suggest connections between items
- Label and annotate existing items when helpful
- Keep the canvas organized and readable

Guidelines:
- Always explain what you're doing via sendMessage
- Don't make too many changes at once — prefer 1-3 actions per intervention
- Respect the existing layout and don't move things users clearly positioned intentionally
- Use sticky notes for new ideas, shapes for structural elements, edges for connections
- Match the visual style already on the canvas

You have access to tools for manipulating the canvas and sending chat messages.`;

interface RoomSession {
  accumulator: ContextAccumulator;
  decisionEngine: DecisionEngine;
  lastActionTime: number;
  lastChangeTime: number;
  changeCount: number;
  evaluationTimer: ReturnType<typeof setInterval> | null;
  presenceRoom: LbRoom | null;
  // FIFO command queue
  commandQueue: QueueItem[];
  currentCommand: (QueueItem & { startedAt: number }) | null;
  isProcessing: boolean;
  // Recent actions for queue status
  recentActions: AgentAction[];
}

export class RoomManager {
  private liveblocks: Liveblocks;
  private lbClient: ReturnType<typeof createClient>;
  private llm: LLMProvider;
  private sessions = new Map<string, RoomSession>();
  private transcriptSource: TranscriptSource;

  constructor(transcriptSource: TranscriptSource) {
    this.liveblocks = new Liveblocks({ secret: config.liveblocks.secretKey });
    this.lbClient = createClient({
      authEndpoint: async (_room) => {
        const session = this.liveblocks.prepareSession("ai-agent", {
          userInfo: { name: "AI Agent" },
        });
        session.allow("*", session.FULL_ACCESS);
        const { body } = await session.authorize();
        return JSON.parse(body);
      },
    });
    this.transcriptSource = transcriptSource;

    const claude = createClaudeProvider(config.llm.anthropic.apiKey, config.llm.anthropic.model);
    const openai = createOpenAIProvider(config.llm.openai.apiKey, config.llm.openai.model, config.llm.openai.baseURL);
    this.llm = createProviderRouter({ claude, openai }, config.llm.provider);
  }

  // ──────────────── Room Lifecycle ────────────────

  async joinRoom(roomId: string): Promise<void> {
    const log = roomLogger(roomId);

    if (this.sessions.has(roomId)) {
      log.debug("Already in room, skipping join");
      return;
    }

    const { room: presenceRoom } = this.lbClient.enterRoom(roomId, {
      initialPresence: { cursor: null, type: "ai_agent", status: "watching" },
    });

    const session: RoomSession = {
      accumulator: new ContextAccumulator({ maxTranscriptSegments: 20, maxRecentChanges: 30 }),
      decisionEngine: new DecisionEngine(),
      lastActionTime: 0,
      lastChangeTime: Date.now(),
      changeCount: 0,
      evaluationTimer: null,
      presenceRoom,
      commandQueue: [],
      currentCommand: null,
      isProcessing: false,
      recentActions: [],
    };

    this.sessions.set(roomId, session);

    this.transcriptSource.subscribe(roomId, (event) => {
      log.debug({ speaker: event.speaker_name, text: event.text }, "Transcript event received");
      session.accumulator.addTranscriptSegment({
        speakerId: event.speaker_id,
        speakerName: event.speaker_name,
        text: event.text,
        timestamp: event.timestamp,
      });
      session.lastChangeTime = Date.now();
      session.changeCount++;
    });

    session.evaluationTimer = setInterval(() => {
      this.evaluate(roomId).catch((err) =>
        log.error({ err }, "Evaluation error")
      );
    }, 3000);

    await this.syncCanvasState(roomId);
    log.info("Joined room");
  }

  async leaveRoom(roomId: string): Promise<void> {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session) return;

    if (session.evaluationTimer) clearInterval(session.evaluationTimer);
    this.transcriptSource.unsubscribe(roomId);
    if (session.presenceRoom) {
      session.presenceRoom.disconnect();
    }
    this.sessions.delete(roomId);
    log.info("Left room");
  }

  hasRoom(roomId: string): boolean {
    return this.sessions.has(roomId);
  }

  // ──────────────── Command Handling ────────────────

  handleCommand(roomId: string, request: CommandRequest): CommandResponse {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session) {
      throw new Error("Room not found");
    }

    if (session.commandQueue.length >= MAX_QUEUE_DEPTH) {
      throw new QueueFullError();
    }

    const commandId = `cmd-${randomUUID().slice(0, 8)}`;
    const item: QueueItem = {
      commandId,
      userId: request.userId,
      userName: request.userName,
      message: request.message,
      context: request.context,
      queuedAt: Date.now(),
    };

    session.commandQueue.push(item);
    const position = session.commandQueue.length;
    log.info({ commandId, position, userId: request.userId }, "Command queued");

    // Start processing if idle
    this.processQueue(roomId).catch((err) =>
      log.error({ err }, "Queue processing error")
    );

    return {
      commandId,
      status: "queued",
      position,
      estimatedWaitMs: session.isProcessing ? position * 5000 : 0,
    };
  }

  // ──────────────── Activity Events ────────────────

  handleEvents(roomId: string, userId: string, events: ActivityEvent[]): number {
    const session = this.sessions.get(roomId);
    if (!session) return 0;

    session.accumulator.addActivityEvents(events);
    session.lastChangeTime = Date.now();
    session.changeCount += events.length;

    roomLogger(roomId).debug({ userId, count: events.length }, "Activity events received");
    return events.length;
  }

  // ──────────────── Feedback ────────────────

  async handleFeedback(roomId: string, feedback: FeedbackRequest): Promise<FeedbackResponse> {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session) {
      throw new Error("Room not found");
    }

    log.info({ actionId: feedback.actionId, status: feedback.status }, "Feedback received");

    // Add to context accumulator for LLM learning
    session.accumulator.addFeedback(
      feedback.userId,
      feedback.actionId,
      feedback.status,
      feedback.reason
    );

    // Update the tracked action status
    const action = session.recentActions.find((a) => a.actionId === feedback.actionId);
    if (action) {
      action.status = feedback.status;
    }

    if (feedback.status === "approved") {
      await this.approveAction(roomId, feedback);
    } else {
      await this.rejectAction(roomId, feedback);
    }

    return {
      ok: true,
      actionId: feedback.actionId,
      status: feedback.status,
    };
  }

  // ──────────────── Queue Status ────────────────

  getQueueStatus(roomId: string): QueueStatusResponse {
    const session = this.sessions.get(roomId);
    if (!session) {
      throw new Error("Room not found");
    }

    let agentStatus: AgentStatus = "idle";
    if (session.currentCommand) {
      agentStatus = "processing";
    }
    if (session.presenceRoom) {
      agentStatus = session.isProcessing ? "acting" : (session.currentCommand ? "processing" : "idle");
    }

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
      queue: session.commandQueue.map((item, i) => ({
        commandId: item.commandId,
        userId: item.userId,
        userName: item.userName,
        message: item.message,
        queuedAt: item.queuedAt,
        position: i + 1,
      })),
      recentActions: session.recentActions.slice(-20),
    };
  }

  // ──────────────── Storage Changes ────────────────

  async handleStorageChange(roomId: string, description: string, userId: string): Promise<void> {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session) return;

    log.debug({ userId, description }, "Storage change received");
    session.accumulator.addChange(userId, description);
    session.lastChangeTime = Date.now();
    session.changeCount++;

    await this.syncCanvasState(roomId);
  }

  // ──────────────── Internals ────────────────

  private async syncCanvasState(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    try {
      const storage = await this.liveblocks.getStorageDocument(roomId, "json");
      const root = (storage?.data ?? {}) as Record<string, unknown>;
      const nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
      const edges = (root.edges ?? []) as Array<Record<string, unknown>>;

      session.accumulator.updateCanvasSnapshot(
        nodes.map((n) => ({
          id: n.id as string,
          type: ((n.data as Record<string, unknown>)?.type as string ?? "shape") as import("./types.js").CanvasObjectType,
          position: n.position as { x: number; y: number },
          width: n.width as number | undefined,
          height: n.height as number | undefined,
          data: n.data as import("./types.js").CanvasNodeData,
        })),
        edges.map((e) => ({
          id: e.id as string,
          source: e.source as string,
          target: e.target as string,
          label: e.label as string | undefined,
        }))
      );

      const intensity = root.agentIntensity as string | undefined;
      if (intensity === "quiet" || intensity === "balanced" || intensity === "active") {
        session.decisionEngine.setIntensity(intensity);
      }
    } catch (err) {
      roomLogger(roomId).error({ err }, "Failed to sync canvas state");
    }
  }

  private async evaluate(roomId: string): Promise<void> {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session) return;

    // Pause proactive evaluation while command queue is active
    if (session.isProcessing || session.commandQueue.length > 0 || session.currentCommand) {
      log.debug("Skipping proactive evaluation — command queue active");
      return;
    }

    const now = Date.now();
    const evalInput = {
      hasDirectMention: false,
      timeSinceLastChange: now - session.lastChangeTime,
      timeSinceLastAction: now - session.lastActionTime,
      changeCount: session.changeCount,
      hasTranscriptActivity: session.accumulator.buildContext().includes("## Recent Conversation"),
    };
    const shouldAct = session.decisionEngine.shouldAct(evalInput);

    log.debug({ shouldAct, ...evalInput, intensity: session.decisionEngine.getIntensity() }, "Evaluation tick");

    if (shouldAct) {
      log.info("Decision: acting (proactive)");
      await this.act(roomId, session, { isDirect: false, commandId: null, requestedBy: null, attribution: null });
    }
  }

<<<<<<< Updated upstream
  private async processQueue(roomId: string): Promise<void> {
    const log = roomLogger(roomId);
    const session = this.sessions.get(roomId);
    if (!session || session.isProcessing) return;

    while (session.commandQueue.length > 0) {
      const item = session.commandQueue.shift()!;
      session.currentCommand = { ...item, startedAt: Date.now() };
      session.isProcessing = true;

      log.info({ commandId: item.commandId, userId: item.userId }, "Processing command");

      try {
        await this.syncCanvasState(roomId);

        // Add user's message context to accumulator
        session.accumulator.addChange(
          item.userId,
          `[Command] ${item.message} (selected: ${item.context.selectedNodeIds.join(", ") || "none"})`
        );

        await this.act(roomId, session, {
          isDirect: true,
          commandId: item.commandId,
          requestedBy: item.userId,
          attribution: `Re: ${item.userName}'s request: "${item.message}"`,
          selectedNodeIds: item.context.selectedNodeIds,
          userMessage: item.message,
        });
      } catch (err) {
        log.error({ err, commandId: item.commandId }, "Command processing error");
      }

      session.currentCommand = null;
    }

    session.isProcessing = false;
  }

  private async act(
    roomId: string,
    session: RoomSession,
    opts: {
      isDirect: boolean;
      commandId: string | null;
      requestedBy: string | null;
      attribution: string | null;
      selectedNodeIds?: string[];
      userMessage?: string;
    }
  ): Promise<void> {
    const log = roomLogger(roomId);
=======
  private async act(roomId: string, session: RoomSession, isDirect: boolean, commandId?: string, requestedBy?: string): Promise<void> {
    const log = roomLogger(roomId);
    const actionId = `act-${randomUUID().slice(0, 8)}`;
>>>>>>> Stashed changes
    const context = session.accumulator.buildContext();

    log.debug({ isDirect: opts.isDirect, contextLength: context.length }, "Building LLM request");
    log.trace({ context }, "Full context sent to LLM");

    let userContent: string;
    if (opts.isDirect && opts.userMessage) {
      const selectedInfo = opts.selectedNodeIds?.length
        ? `\nThe user has selected these nodes: ${opts.selectedNodeIds.join(", ")}`
        : "";
      userContent = `A user directly asked: "${opts.userMessage}"${selectedInfo}\n\nHere is the current context:\n\n${context}`;
    } else if (opts.isDirect) {
      userContent = `A user directly asked you to act. Here is the current context:\n\n${context}`;
    } else {
      userContent = `Here is what's happening on the canvas. Decide if you should help, and if so, take action.\n\n${context}`;
    }

    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    session.presenceRoom?.updatePresence({ status: "acting" });

    try {
      log.debug("Calling LLM...");
      const response = await this.llm.chat(messages, canvasTools);
      log.info({ toolCalls: response.toolCalls.length, hasText: !!response.text }, "LLM response received");
      log.debug({ toolCalls: response.toolCalls, text: response.text }, "LLM response details");

      const actionCtx: ActionContext = {
        commandId: opts.commandId,
        requestedBy: opts.requestedBy,
      };

      if (response.toolCalls.length > 0) {
        const adapter = this.createStorageAdapter(roomId);
        const executor = new ActionExecutor(adapter, actionCtx);
        await executor.execute(response.toolCalls);
        await adapter.flush();

        // Track the action
        if (executor.createdNodeIds.length > 0 || executor.createdEdgeIds.length > 0) {
          session.recentActions.push({
            actionId: executor.actionId,
            commandId: opts.commandId,
            type: "canvas_mutation",
            nodeIds: executor.createdNodeIds,
            edgeIds: executor.createdEdgeIds,
            status: "pending",
            createdAt: Date.now(),
          });
          if (session.recentActions.length > 50) {
            session.recentActions = session.recentActions.slice(-50);
          }
        }

        log.info({ actions: response.toolCalls.map((tc) => tc.name) }, "Actions executed");
      }

      if (response.text && !response.toolCalls.some((tc) => tc.name === "sendMessage")) {
        const messageText = opts.attribution
          ? `${opts.attribution}\n\n${response.text}`
          : response.text;
        const adapter = this.createStorageAdapter(roomId);
        adapter.sendMessage(messageText);
        await adapter.flush();
        log.debug("Sent LLM text as chat message");
      }

      session.lastActionTime = Date.now();
      session.changeCount = 0;
    } catch (err) {
      log.error({ err }, "Action error");
    } finally {
      session.presenceRoom?.updatePresence({ status: "watching" });
    }
  }

  private async approveAction(roomId: string, feedback: FeedbackRequest): Promise<void> {
    const log = roomLogger(roomId);

    try {
      const storage = await this.liveblocks.getStorageDocument(roomId, "json");
      const root = (storage?.data ?? {}) as Record<string, unknown>;
      const nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
      const edges = (root.edges ?? []) as Array<Record<string, unknown>>;
      let modified = false;

      for (const node of nodes) {
        const data = node.data as Record<string, unknown> | undefined;
        const ai = data?._ai as Record<string, unknown> | undefined;
        if (ai && ai.actionId === feedback.actionId) {
          ai.status = "approved";
          modified = true;
        }
      }

      for (const edge of edges) {
        const data = edge.data as Record<string, unknown> | undefined;
        const ai = data?._ai as Record<string, unknown> | undefined;
        if (ai && ai.actionId === feedback.actionId) {
          ai.status = "approved";
          modified = true;
        }
      }

      if (modified) {
        await this.writeStorageDocument(roomId, root);
        log.info({ actionId: feedback.actionId }, "Action approved — nodes updated");
      }
    } catch (err) {
      log.error({ err, actionId: feedback.actionId }, "Failed to approve action");
    }
  }

  private async rejectAction(roomId: string, feedback: FeedbackRequest): Promise<void> {
    const log = roomLogger(roomId);

    try {
      const storage = await this.liveblocks.getStorageDocument(roomId, "json");
      const root = (storage?.data ?? {}) as Record<string, unknown>;
      let nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
      let edges = (root.edges ?? []) as Array<Record<string, unknown>>;

      nodes = nodes.filter((node) => {
        const data = node.data as Record<string, unknown> | undefined;
        const ai = data?._ai as Record<string, unknown> | undefined;
        return !(ai && ai.actionId === feedback.actionId);
      });

      edges = edges.filter((edge) => {
        const data = edge.data as Record<string, unknown> | undefined;
        const ai = data?._ai as Record<string, unknown> | undefined;
        return !(ai && ai.actionId === feedback.actionId);
      });

      root.nodes = nodes;
      root.edges = edges;

      await this.writeStorageDocument(roomId, root);
      log.info({ actionId: feedback.actionId }, "Action rejected — nodes/edges removed");
    } catch (err) {
      log.error({ err, actionId: feedback.actionId }, "Failed to reject action");
    }
  }

  private async writeStorageDocument(roomId: string, data: Record<string, unknown>): Promise<void> {
    const log = roomLogger(roomId);
    const storageData = this.toLiveblocksFormat(data);

    try {
      try {
        await this.liveblocks.deleteStorageDocument(roomId);
      } catch {
        // Storage might not exist yet
      }
      await this.liveblocks.initializeStorageDocument(roomId, storageData as PlainLsonObject);
      log.debug("Storage document written");
    } catch (err) {
      log.error({ err }, "Failed to write storage document");
    }
  }

  private toLiveblocksFormat(data: unknown): unknown {
    if (Array.isArray(data)) {
      return {
        liveblocksType: "LiveList",
        data: data.map((item) => this.toLiveblocksFormat(item)),
      };
    }
    if (data !== null && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const converted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.toLiveblocksFormat(value);
      }
      return { liveblocksType: "LiveObject", data: converted };
    }
    return data;
  }

  private createStorageAdapter(roomId: string): StorageAdapter & { flush(): Promise<void> } {
    const nodeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const nodeDeletes: string[] = [];
    const edgeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const edgeDeletes: string[] = [];
    const messageQueue: string[] = [];
    const liveblocks = this.liveblocks;
    const self = this;

    return {
      getNodes: () => [],
      setNode(id: string, data: Record<string, unknown>) {
        nodeSets.push({ id, data });
      },
      deleteNode(id: string) {
        nodeDeletes.push(id);
      },
      setEdge(id: string, data: Record<string, unknown>) {
        edgeSets.push({ id, data });
      },
      deleteEdge(id: string) {
        edgeDeletes.push(id);
      },
      sendMessage(text: string) {
        messageQueue.push(text);
      },
      async flush() {
        const log = roomLogger(roomId);

        if (nodeSets.length > 0 || nodeDeletes.length > 0 || edgeSets.length > 0 || edgeDeletes.length > 0) {
          log.debug({
            nodeSets: nodeSets.length,
            nodeDeletes: nodeDeletes.length,
            edgeSets: edgeSets.length,
            edgeDeletes: edgeDeletes.length,
          }, "Flushing mutations to Liveblocks storage");

          try {
            const storage = await liveblocks.getStorageDocument(roomId, "json");
            const root = (storage?.data ?? {}) as Record<string, unknown>;
            let currentNodes = ((root.nodes ?? []) as Array<Record<string, unknown>>).slice();
            let currentEdges = ((root.edges ?? []) as Array<Record<string, unknown>>).slice();

            for (const { id, data } of nodeSets) {
              const idx = currentNodes.findIndex((n) => n.id === id);
              if (idx >= 0) {
                const existing = { ...currentNodes[idx] };
                for (const [key, value] of Object.entries(data)) {
                  if (key.startsWith("data.")) {
                    const field = key.slice(5);
                    (existing.data as Record<string, unknown>)[field] = value;
                  } else {
                    existing[key] = value;
                  }
                }
                currentNodes[idx] = existing;
              } else {
                currentNodes.push({ id, ...data });
              }
            }

            for (const id of nodeDeletes) {
              currentNodes = currentNodes.filter((n) => n.id !== id);
            }

            for (const { id, data } of edgeSets) {
              const idx = currentEdges.findIndex((e) => e.id === id);
              if (idx >= 0) {
                currentEdges[idx] = { id, ...currentEdges[idx], ...data };
              } else {
                currentEdges.push({ id, ...data });
              }
            }

            for (const id of edgeDeletes) {
              currentEdges = currentEdges.filter((e) => e.id !== id);
            }

            root.nodes = currentNodes;
            root.edges = currentEdges;

            await self.writeStorageDocument(roomId, root);
            log.info("Canvas mutations persisted to Liveblocks storage");
          } catch (err) {
            log.error({ err }, "Failed to flush mutations to Liveblocks storage");
          }
        }

        for (const text of messageQueue) {
          try {
            await liveblocks.createComment({
              roomId,
              threadId: "agent-thread",
              data: {
                userId: "ai-agent",
                body: { version: 1 as const, content: [{ type: "paragraph" as const, children: [{ text }] }] },
              },
            } as any);
          } catch {
            try {
              await liveblocks.createThread({
                roomId,
                data: {
                  userId: "ai-agent",
                  body: { version: 1 as const, content: [{ type: "paragraph" as const, children: [{ text }] }] },
                  metadata: {},
                },
              } as any);
            } catch (err) {
              roomLogger(roomId).error({ err }, "Failed to send agent message");
            }
          }
        }
      },
    };
  }
}

export class QueueFullError extends Error {
  constructor() {
    super("AI agent queue for this room is full. Try again shortly.");
    this.name = "QueueFullError";
  }
}
