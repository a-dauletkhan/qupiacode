import { randomUUID } from "node:crypto";
import { Liveblocks } from "@liveblocks/node";
import { createClient, type Room as LbRoom } from "@liveblocks/client";
import { config } from "./config.js";
import { roomLogger } from "./logger.js";
import { ContextAccumulator } from "./context-accumulator.js";
import { DecisionEngine } from "./decision-engine.js";
import { ActionExecutor, type StorageAdapter } from "./action-executor.js";
import { CommandQueue } from "./command-queue.js";
import { canvasTools } from "./tools/canvas-tools.js";
import { createProviderRouter } from "./llm/provider-router.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createOpenAIProvider } from "./llm/openai-provider.js";
import type { LLMProvider, Message } from "./llm/types.js";
import type { TranscriptSource } from "./transcript/types.js";
import type { AiActionContext } from "./action-executor.js";
import type { AiCommandRequest, AiCommandResponse, AiActivityEvent, AiFeedbackRequest, QueuedCommand } from "./types.js";

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
  commandQueue: CommandQueue;
  processingCommand: boolean;
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

  async joinRoom(roomId: string): Promise<void> {
    const log = roomLogger(roomId);

    if (this.sessions.has(roomId)) {
      log.debug("Already in room, skipping join");
      return;
    }

    // Enter room via client SDK to maintain WebSocket presence
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
      commandQueue: new CommandQueue(10),
      processingCommand: false,
    };

    this.sessions.set(roomId, session);

    // Subscribe to transcript events for this room
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

    // Start periodic evaluation loop
    session.evaluationTimer = setInterval(() => {
      this.evaluate(roomId).catch((err) =>
        log.error({ err }, "Evaluation error")
      );
    }, 3000);

    // Load initial canvas state
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

  async handleDirectMessage(roomId: string, _message: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    await this.syncCanvasState(roomId);

    // Direct messages bypass the decision engine
    await this.act(roomId, session, true);
  }

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

      // Read intensity setting from storage and update decision engine
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
    if (session.processingCommand) return;

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
      log.info("Decision: acting");
      await this.act(roomId, session, false);
    }
  }

  private async act(roomId: string, session: RoomSession, isDirect: boolean, commandId?: string, requestedBy?: string): Promise<void> {
    const actionId = `act-${randomUUID().slice(0, 8)}`;
    const context = session.accumulator.buildContext();

    log.debug({ isDirect, contextLength: context.length }, "Building LLM request");
    log.trace({ context }, "Full context sent to LLM");

    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: isDirect
          ? `A user directly asked you to act. Here is the current context:\n\n${context}`
          : `Here is what's happening on the canvas. Decide if you should help, and if so, take action.\n\n${context}`,
      },
    ];

    // Update presence to "acting"
    session.presenceRoom?.updatePresence({ status: "acting" });

    try {
      log.debug("Calling LLM...");
      const response = await this.llm.chat(messages, canvasTools);
      log.info({ toolCalls: response.toolCalls.length, hasText: !!response.text }, "LLM response received");
      log.debug({ toolCalls: response.toolCalls, text: response.text }, "LLM response details");

      if (response.toolCalls.length > 0) {
        const aiContext: AiActionContext = { actionId, commandId: commandId ?? null, requestedBy: requestedBy ?? null };
        const adapter = this.createStorageAdapter(roomId, aiContext);
        const executor = new ActionExecutor(adapter, aiContext);
        await executor.execute(response.toolCalls);
        await adapter.flush();
        log.info({ actions: response.toolCalls.map((tc) => tc.name) }, "Actions executed");
      }

      if (response.text && !response.toolCalls.some((tc) => tc.name === "sendMessage")) {
        const adapter = this.createStorageAdapter(roomId, { actionId, commandId: commandId ?? null, requestedBy: requestedBy ?? null });
        adapter.sendMessage(response.text);
        await adapter.flush();
        log.debug("Sent LLM text as chat message");
      }

      session.lastActionTime = Date.now();
      session.changeCount = 0;
    } catch (err) {
      log.error({ err }, "Action error");
    } finally {
      // Return to "watching"
      session.presenceRoom?.updatePresence({ status: "watching" });
    }
  }

  private createStorageAdapter(roomId: string, aiContext: AiActionContext): StorageAdapter & { flush(): Promise<void> } {
    const pendingNodeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingNodeDeletes: string[] = [];
    const pendingEdgeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingEdgeDeletes: string[] = [];
    const messageQueue: string[] = [];
    const liveblocks = this.liveblocks;

    return {
      getNodes: () => [],
      setNode(id: string, data: Record<string, unknown>) {
        pendingNodeSets.push({ id, data });
      },
      deleteNode(id: string) {
        pendingNodeDeletes.push(id);
      },
      setEdge(id: string, data: Record<string, unknown>) {
        pendingEdgeSets.push({ id, data });
      },
      deleteEdge(id: string) {
        pendingEdgeDeletes.push(id);
      },
      sendMessage(text: string) {
        messageQueue.push(text);
      },
      async flush() {
        if (pendingNodeSets.length > 0 || pendingNodeDeletes.length > 0 ||
            pendingEdgeSets.length > 0 || pendingEdgeDeletes.length > 0) {
          try {
            const storage = await liveblocks.getStorageDocument(roomId, "json");
            const root = (storage?.data ?? {}) as Record<string, unknown>;
            let nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
            let edges = (root.edges ?? []) as Array<Record<string, unknown>>;

            for (const { id, data } of pendingNodeSets) {
              const existing = nodes.findIndex((n) => n.id === id);
              if (existing >= 0) {
                nodes[existing] = { ...nodes[existing], ...data, id };
              } else {
                nodes.push({ id, ...data });
              }
            }

            nodes = nodes.filter((n) => !pendingNodeDeletes.includes(n.id as string));

            for (const { id, data } of pendingEdgeSets) {
              const existing = edges.findIndex((e) => e.id === id);
              if (existing >= 0) {
                edges[existing] = { ...edges[existing], ...data, id };
              } else {
                edges.push({ id, ...data });
              }
            }

            edges = edges.filter((e) => !pendingEdgeDeletes.includes(e.id as string));

            await liveblocks.initializeStorageDocument(roomId, {
              liveblocksType: "LiveObject",
              data: {
                ...root,
                nodes: { liveblocksType: "LiveList", data: nodes as any },
                edges: { liveblocksType: "LiveList", data: edges as any },
              },
            });

            console.log(`Flushed to Liveblocks for room ${roomId}:`, {
              nodeSets: pendingNodeSets.length, nodeDeletes: pendingNodeDeletes.length,
              edgeSets: pendingEdgeSets.length, edgeDeletes: pendingEdgeDeletes.length,
            });
          } catch (err) {
            console.error(`Failed to flush mutations for room ${roomId}:`, err);
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

  async handleCommand(roomId: string, request: AiCommandRequest): Promise<AiCommandResponse> {
    let session = this.sessions.get(roomId);
    if (!session) {
      await this.joinRoom(roomId);
      session = this.sessions.get(roomId)!;
    }

    const commandId = `cmd-${randomUUID().slice(0, 8)}`;
    const command: QueuedCommand = {
      commandId,
      userId: request.userId,
      userName: request.userName,
      message: request.message,
      context: request.context,
      queuedAt: Date.now(),
    };

    if (session.commandQueue.isFull()) {
      throw new Error("Queue full");
    }

    session.commandQueue.enqueue(command);

    if (!session.processingCommand) {
      this.processQueue(roomId).catch((err) =>
        console.error(`Queue processing error in room ${roomId}:`, err)
      );
    }

    return {
      commandId,
      status: "queued",
      position: session.commandQueue.size(),
      estimatedWaitMs: session.commandQueue.size() * 5000,
    };
  }

  private async processQueue(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session || session.processingCommand) return;

    session.processingCommand = true;

    try {
      while (session.commandQueue.size() > 0) {
        const command = session.commandQueue.dequeue();
        if (!command) break;

        console.log(`Processing command ${command.commandId} from ${command.userName}: "${command.message}"`);

        await this.syncCanvasState(roomId);

        session.accumulator.addTranscriptSegment({
          speakerId: command.userId,
          speakerName: command.userName,
          text: `[Command] ${command.message}`,
          timestamp: command.queuedAt,
        });

        await this.act(roomId, session, true, command.commandId, command.userId);
      }
    } finally {
      session.processingCommand = false;
    }
  }

  handleEvents(roomId: string, userId: string, events: AiActivityEvent[]): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    session.accumulator.addUserEvents(userId, events);
    session.lastChangeTime = Date.now();
    session.changeCount += events.length;
  }

  async handleFeedback(roomId: string, request: AiFeedbackRequest): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    session.accumulator.addFeedback({
      actionId: request.actionId,
      status: request.status,
      reason: request.reason,
      userId: request.userId,
    });

    if (request.status === "rejected") {
      try {
        const storage = await this.liveblocks.getStorageDocument(roomId, "json");
        const root = (storage?.data ?? {}) as Record<string, unknown>;
        let nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
        let edges = (root.edges ?? []) as Array<Record<string, unknown>>;

        nodes = nodes.filter((n) => !request.nodeIds.includes(n.id as string));
        edges = edges.filter((e) => !request.edgeIds.includes(e.id as string));

        await this.liveblocks.initializeStorageDocument(roomId, {
          liveblocksType: "LiveObject",
          data: {
            ...root,
            nodes: { liveblocksType: "LiveList", data: nodes as any },
            edges: { liveblocksType: "LiveList", data: edges as any },
          },
        });
      } catch (err) {
        console.error(`Failed to remove rejected nodes for room ${roomId}:`, err);
      }
    } else if (request.status === "approved") {
      try {
        const storage = await this.liveblocks.getStorageDocument(roomId, "json");
        const root = (storage?.data ?? {}) as Record<string, unknown>;
        const nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
        const edges = (root.edges ?? []) as Array<Record<string, unknown>>;

        for (const node of nodes) {
          if (request.nodeIds.includes(node.id as string)) {
            const data = node.data as Record<string, unknown> | undefined;
            const ai = data?._ai as Record<string, unknown> | undefined;
            if (ai) ai.status = "approved";
          }
        }

        for (const edge of edges) {
          if (request.edgeIds.includes(edge.id as string)) {
            const ai = edge._ai as Record<string, unknown> | undefined;
            if (ai) ai.status = "approved";
          }
        }

        await this.liveblocks.initializeStorageDocument(roomId, {
          liveblocksType: "LiveObject",
          data: {
            ...root,
            nodes: { liveblocksType: "LiveList", data: nodes as any },
            edges: { liveblocksType: "LiveList", data: edges as any },
          },
        });
      } catch (err) {
        console.error(`Failed to approve nodes for room ${roomId}:`, err);
      }
    }
  }

  getQueueStatus(roomId: string) {
    const session = this.sessions.get(roomId);
    if (!session) {
      return { agentStatus: "idle" as const, currentCommand: null, queue: [], recentActions: [] };
    }

    return {
      agentStatus: session.processingCommand ? "processing" as const : "idle" as const,
      currentCommand: null,
      queue: session.commandQueue.items().map((q, i) => ({ ...q, position: i + 1 })),
      recentActions: [],
    };
  }
}
