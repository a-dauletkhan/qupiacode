import express from "express";
import { Command } from "@langchain/langgraph";
import { Liveblocks } from "@liveblocks/node";
import { config } from "./config.js";
import { loadPersonas } from "./persona-loader.js";
import { createCheckpointer } from "./graph/checkpointer.js";
import { buildGraph } from "./graph/graph.js";
import { createProviderRouter } from "./llm/provider-router.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createOpenAIProvider } from "./llm/openai-provider.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";
import type { CommandRequest, EventsRequest, FeedbackRequest, ActivityEvent } from "./types.js";
import type { FeedbackInput } from "./graph/state.js";
import { leaveSharedRoom } from "./graph/shared-room.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

const liveblocks = new Liveblocks({ secret: config.liveblocks.secretKey });
const claude = createClaudeProvider(config.llm.anthropic.apiKey, config.llm.anthropic.model);
const openai = createOpenAIProvider(config.llm.openai.apiKey, config.llm.openai.model, config.llm.openai.baseURL);
const llm = createProviderRouter({ claude, openai }, config.llm.provider);
const personasFile = loadPersonas(resolve(__dirname, "personas.yaml"));
const transcriptSource = new WebhookTranscriptSource();

const transcriptBuffers = new Map<string, Array<{ speakerId: string; speakerName: string; text: string; timestamp: number }>>();
const eventBuffers = new Map<string, ActivityEvent[]>();

let compiledGraph: Awaited<ReturnType<typeof buildGraph>> | null = null;

async function initGraph() {
  const checkpointer = await createCheckpointer();
  compiledGraph = buildGraph(liveblocks, llm, personasFile, checkpointer);
  console.log("LangGraph compiled with personas:", Object.keys(personasFile.personas).join(", "));
}

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", personas: Object.keys(personasFile.personas) });
});

app.post("/api/transcript", (req, res) => {
  transcriptSource.handleEvent(req.body);
  const event = req.body;
  if (event.is_final && event.room_id) {
    const buffer = transcriptBuffers.get(event.room_id) ?? [];
    buffer.push({
      speakerId: event.speaker_id,
      speakerName: event.speaker_name,
      text: event.text,
      timestamp: event.timestamp,
    });
    if (buffer.length > 20) buffer.splice(0, buffer.length - 20);
    transcriptBuffers.set(event.room_id, buffer);
  }
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/join", (_req, res) => { res.json({ ok: true }); });
app.post("/api/rooms/:roomId/leave", (_req, res) => { res.json({ ok: true }); });
app.post("/api/liveblocks/webhook", (_req, res) => { res.json({ ok: true }); });

app.post("/api/ai/rooms/:roomId/command", async (req, res) => {
  if (!compiledGraph) {
    res.status(503).json({ error: "not_ready", message: "AI agent is initializing" });
    return;
  }
  try {
    const { roomId } = req.params;
    const request = req.body as CommandRequest & { targetPersona?: string };
    const threadId = `room:${roomId}`;

    const result = await compiledGraph.invoke(
      {
        roomId,
        command: {
          userId: request.userId,
          userName: request.userName,
          message: request.message,
          source: request.context.source,
          selectedNodeIds: request.context.selectedNodeIds,
          targetPersona: request.targetPersona ?? null,
        },
        transcript: transcriptBuffers.get(roomId) ?? [],
        userEvents: eventBuffers.get(roomId) ?? [],
      },
      { configurable: { thread_id: threadId } },
    );

    eventBuffers.delete(roomId);

    // Release the shared room (sets presence back to "watching" then disconnects)
    await leaveSharedRoom(roomId);

    const latestAction = result.pendingActions?.[result.pendingActions.length - 1];
    res.status(202).json({
      commandId: latestAction?.actionId ?? "unknown",
      status: "queued",
      position: 1,
      estimatedWaitMs: 0,
      persona: latestAction?.persona ?? null,
    });
  } catch (err) {
    console.error("Command error:", err);
    await leaveSharedRoom(req.params.roomId);
    res.status(500).json({ error: "internal", message: "Failed to process command" });
  }
});

app.post("/api/ai/rooms/:roomId/events", (req, res) => {
  const { roomId } = req.params;
  const { events } = req.body as EventsRequest;
  const buffer = eventBuffers.get(roomId) ?? [];
  buffer.push(...events);
  if (buffer.length > 50) buffer.splice(0, buffer.length - 50);
  eventBuffers.set(roomId, buffer);
  res.json({ accepted: events.length });
});

app.post("/api/ai/rooms/:roomId/feedback", async (req, res) => {
  if (!compiledGraph) {
    res.status(503).json({ error: "not_ready", message: "AI agent is initializing" });
    return;
  }
  try {
    const { roomId } = req.params;
    const request = req.body as FeedbackRequest;
    const threadId = `room:${roomId}`;

    const feedback: FeedbackInput = {
      actionId: request.actionId,
      status: request.status,
      reason: request.reason,
      nodeIds: request.nodeIds,
      edgeIds: request.edgeIds,
      userId: request.userId,
    };

    // Check if graph is actually interrupted for this thread
    const graphState = await compiledGraph.getState({ configurable: { thread_id: threadId } });
    const isInterrupted = (graphState.tasks ?? []).some(
      (t: any) => t.interrupts && t.interrupts.length > 0
    );
    console.info(`[feedback] Thread ${threadId} — interrupted: ${isInterrupted}, next: ${graphState.next}`);

    if (isInterrupted) {
      // Resume graph from interrupt
      await compiledGraph.invoke(
        new Command({ resume: feedback }),
        { configurable: { thread_id: threadId } },
      );
      await leaveSharedRoom(roomId);
    } else {
      // Graph not interrupted — handle feedback directly via Liveblocks
      console.info(`[feedback] No interrupt to resume — applying feedback directly`);
      const { enterSharedRoom } = await import("./graph/shared-room.js");
      const { LiveMap } = await import("@liveblocks/client");
      const room = enterSharedRoom(liveblocks, roomId);
      const { root } = await room.getStorage();
      const flow = root.get("flow") as any;
      if (flow) {
        const nodesMap = flow.get("nodes") as any;
        const edgesMap = flow.get("edges") as any;

        if (feedback.status === "rejected") {
          if (nodesMap) {
            for (const id of feedback.nodeIds) {
              if (nodesMap.has(id)) {
                nodesMap.delete(id);
                console.info(`[feedback] Removed node "${id}"`);
              }
            }
          }
          if (edgesMap) {
            for (const id of feedback.edgeIds) {
              if (edgesMap.has(id)) {
                edgesMap.delete(id);
                console.info(`[feedback] Removed edge "${id}"`);
              }
            }
          }
        } else if (feedback.status === "approved") {
          if (nodesMap) {
            for (const id of feedback.nodeIds) {
              const nodeObj = nodesMap.get(id) as any;
              if (!nodeObj) continue;
              const dataObj = nodeObj.get?.("data") as any;
              const aiObj = dataObj?.get?.("_ai") as any;
              if (aiObj) {
                aiObj.set("status", "approved");
                console.info(`[feedback] Approved node "${id}"`);
              }
            }
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      await leaveSharedRoom(roomId);
    }

    res.json({ ok: true, actionId: request.actionId, status: request.status });
  } catch (err) {
    console.error("Feedback error:", err);
    await leaveSharedRoom(req.params.roomId);
    res.status(500).json({ error: "internal", message: "Failed to process feedback" });
  }
});

app.get("/api/ai/rooms/:roomId/queue", async (req, res) => {
  if (!compiledGraph) {
    res.json({ agentStatus: "idle", currentCommand: null, queue: [], recentActions: [] });
    return;
  }
  try {
    const { roomId } = req.params;
    const threadId = `room:${roomId}`;
    const graphState = await compiledGraph.getState({ configurable: { thread_id: threadId } });
    const isInterrupted = (graphState.tasks ?? []).some(
      (t: any) => t.interrupts && t.interrupts.length > 0
    );
    res.json({
      agentStatus: isInterrupted ? "acting" : "idle",
      currentCommand: null,
      queue: [],
      recentActions: [],
    });
  } catch {
    res.json({ agentStatus: "idle", currentCommand: null, queue: [], recentActions: [] });
  }
});

initGraph().then(() => {
  app.listen(config.server.port, () => {
    console.log(`AI Agent Service running on port ${config.server.port}`);
  });
}).catch((err) => {
  console.error("Failed to initialize graph:", err);
  process.exit(1);
});
