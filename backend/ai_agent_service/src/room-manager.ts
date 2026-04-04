import { Liveblocks } from "@liveblocks/node";
import { config } from "./config.js";
import { ContextAccumulator } from "./context-accumulator.js";
import { DecisionEngine } from "./decision-engine.js";
import { ActionExecutor, type StorageAdapter } from "./action-executor.js";
import { canvasTools } from "./tools/canvas-tools.js";
import { createProviderRouter } from "./llm/provider-router.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createOpenAIProvider } from "./llm/openai-provider.js";
import type { LLMProvider, Message } from "./llm/types.js";
import type { Intensity, TranscriptSegment } from "./types.js";
import type { TranscriptSource } from "./transcript/types.js";

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
}

export class RoomManager {
  private liveblocks: Liveblocks;
  private llm: LLMProvider;
  private sessions = new Map<string, RoomSession>();
  private transcriptSource: TranscriptSource;

  constructor(transcriptSource: TranscriptSource) {
    this.liveblocks = new Liveblocks({ secret: config.liveblocks.secretKey });
    this.transcriptSource = transcriptSource;

    const claude = createClaudeProvider(config.llm.anthropic.apiKey, config.llm.anthropic.model);
    const openai = createOpenAIProvider(config.llm.openai.apiKey, config.llm.openai.model);
    this.llm = createProviderRouter({ claude, openai }, config.llm.provider);
  }

  async joinRoom(roomId: string): Promise<void> {
    if (this.sessions.has(roomId)) return;

    const session: RoomSession = {
      accumulator: new ContextAccumulator({ maxTranscriptSegments: 20, maxRecentChanges: 30 }),
      decisionEngine: new DecisionEngine(),
      lastActionTime: 0,
      lastChangeTime: Date.now(),
      changeCount: 0,
      evaluationTimer: null,
    };

    this.sessions.set(roomId, session);

    // Subscribe to transcript events for this room
    this.transcriptSource.subscribe(roomId, (event) => {
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
        console.error(`Evaluation error in room ${roomId}:`, err)
      );
    }, 3000);

    // Load initial canvas state
    await this.syncCanvasState(roomId);

    console.log(`Joined room: ${roomId}`);
  }

  async leaveRoom(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    if (session.evaluationTimer) clearInterval(session.evaluationTimer);
    this.transcriptSource.unsubscribe(roomId);
    this.sessions.delete(roomId);

    console.log(`Left room: ${roomId}`);
  }

  async handleStorageChange(roomId: string, description: string, userId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    session.accumulator.addChange(userId, description);
    session.lastChangeTime = Date.now();
    session.changeCount++;

    await this.syncCanvasState(roomId);
  }

  async handleDirectMessage(roomId: string, message: string): Promise<void> {
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
      const root = storage.data as Record<string, unknown>;
      const nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
      const edges = (root.edges ?? []) as Array<Record<string, unknown>>;

      session.accumulator.updateCanvasSnapshot(
        nodes.map((n) => ({
          id: n.id as string,
          type: (n.data as Record<string, unknown>)?.type as string ?? "shape",
          position: n.position as { x: number; y: number },
          width: n.width as number | undefined,
          height: n.height as number | undefined,
          data: n.data as any,
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
      console.error(`Failed to sync canvas state for room ${roomId}:`, err);
    }
  }

  private async evaluate(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    const now = Date.now();
    const shouldAct = session.decisionEngine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: now - session.lastChangeTime,
      timeSinceLastAction: now - session.lastActionTime,
      changeCount: session.changeCount,
      hasTranscriptActivity: session.accumulator.buildContext().includes("## Recent Conversation"),
    });

    if (shouldAct) {
      await this.act(roomId, session, false);
    }
  }

  private async act(roomId: string, session: RoomSession, isDirect: boolean): Promise<void> {
    const context = session.accumulator.buildContext();

    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: isDirect
          ? `A user directly asked you to act. Here is the current context:\n\n${context}`
          : `Here is what's happening on the canvas. Decide if you should help, and if so, take action.\n\n${context}`,
      },
    ];

    try {
      const response = await this.llm.chat(messages, canvasTools);

      if (response.toolCalls.length > 0) {
        const adapter = this.createStorageAdapter(roomId);
        const executor = new ActionExecutor(adapter);
        await executor.execute(response.toolCalls);
        await adapter.flush();
      }

      if (response.text && !response.toolCalls.some((tc) => tc.name === "sendMessage")) {
        // If LLM returned text but no sendMessage, send it as a chat message
        const adapter = this.createStorageAdapter(roomId);
        adapter.sendMessage(response.text);
        await adapter.flush();
      }

      session.lastActionTime = Date.now();
      session.changeCount = 0;
    } catch (err) {
      console.error(`Action error in room ${roomId}:`, err);
    }
  }

  private createStorageAdapter(roomId: string): StorageAdapter & { flush(): Promise<void> } {
    const mutations: Array<() => void> = [];
    const messageQueue: string[] = [];
    const liveblocks = this.liveblocks;

    return {
      getNodes() {
        return [];
      },
      setNode(id: string, data: Record<string, unknown>) {
        mutations.push(() => {
          (globalThis as any).__pendingNodeSets ??= [];
          (globalThis as any).__pendingNodeSets.push({ id, data });
        });
      },
      deleteNode(id: string) {
        mutations.push(() => {
          (globalThis as any).__pendingNodeDeletes ??= [];
          (globalThis as any).__pendingNodeDeletes.push(id);
        });
      },
      setEdge(id: string, data: Record<string, unknown>) {
        mutations.push(() => {
          (globalThis as any).__pendingEdgeSets ??= [];
          (globalThis as any).__pendingEdgeSets.push({ id, data });
        });
      },
      deleteEdge(id: string) {
        mutations.push(() => {
          (globalThis as any).__pendingEdgeDeletes ??= [];
          (globalThis as any).__pendingEdgeDeletes.push(id);
        });
      },
      sendMessage(text: string) {
        messageQueue.push(text);
      },
      async flush() {
        (globalThis as any).__pendingNodeSets = [];
        (globalThis as any).__pendingNodeDeletes = [];
        (globalThis as any).__pendingEdgeSets = [];
        (globalThis as any).__pendingEdgeDeletes = [];

        for (const mut of mutations) mut();

        const nodeSets = (globalThis as any).__pendingNodeSets as Array<{ id: string; data: Record<string, unknown> }>;
        const nodeDeletes = (globalThis as any).__pendingNodeDeletes as string[];
        const edgeSets = (globalThis as any).__pendingEdgeSets as Array<{ id: string; data: Record<string, unknown> }>;
        const edgeDeletes = (globalThis as any).__pendingEdgeDeletes as string[];

        if (nodeSets.length > 0 || nodeDeletes.length > 0 || edgeSets.length > 0 || edgeDeletes.length > 0) {
          console.log(`Flushing mutations for room ${roomId}:`, {
            nodeSets: nodeSets.length,
            nodeDeletes: nodeDeletes.length,
            edgeSets: edgeSets.length,
            edgeDeletes: edgeDeletes.length,
          });
        }

        // Send chat messages via Liveblocks Comments API
        for (const text of messageQueue) {
          try {
            await liveblocks.createComment({
              roomId,
              threadId: "agent-thread",
              data: {
                userId: "ai-agent",
                body: {
                  version: 1,
                  content: [{ type: "paragraph", children: [{ text }] }],
                },
              },
            });
          } catch {
            try {
              await liveblocks.createThread({
                roomId,
                data: {
                  userId: "ai-agent",
                  body: {
                    version: 1,
                    content: [{ type: "paragraph", children: [{ text }] }],
                  },
                  metadata: {},
                },
              });
            } catch (err) {
              console.error("Failed to send agent message:", err);
            }
          }
        }

        delete (globalThis as any).__pendingNodeSets;
        delete (globalThis as any).__pendingNodeDeletes;
        delete (globalThis as any).__pendingEdgeSets;
        delete (globalThis as any).__pendingEdgeDeletes;
      },
    };
  }
}
