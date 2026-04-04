import express from "express";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";
import { RoomManager } from "./room-manager.js";
import type { AiCommandRequest, AiEventsRequest, AiFeedbackRequest } from "./types.js";

const app = express();
app.use(express.json());

const transcriptSource = new WebhookTranscriptSource();
const roomManager = new RoomManager(transcriptSource);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Existing routes ---

app.post("/api/transcript", (req, res) => {
  transcriptSource.handleEvent(req.body);
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/join", async (req, res) => {
  await roomManager.joinRoom(req.params.roomId);
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/leave", async (req, res) => {
  await roomManager.leaveRoom(req.params.roomId);
  res.json({ ok: true });
});

app.post("/api/liveblocks/webhook", async (req, res) => {
  const event = req.body;

  if (event.type === "storageUpdated") {
    await roomManager.handleStorageChange(
      event.data.roomId,
      "storage updated",
      event.data.userId ?? "unknown"
    );
  } else if (event.type === "userEntered") {
    await roomManager.joinRoom(event.data.roomId);
  }

  res.json({ ok: true });
});

// --- New AI agent routes ---

app.post("/api/ai/rooms/:roomId/command", async (req, res) => {
  try {
    const request = req.body as AiCommandRequest;
    const result = await roomManager.handleCommand(req.params.roomId, request);
    res.status(202).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Queue full") {
      res.status(429).json({
        error: "queue_full",
        message: "AI agent queue for this room is full. Try again shortly.",
        retryAfterMs: 5000,
      });
      return;
    }
    console.error("Command error:", err);
    res.status(500).json({ error: "internal", message: "Failed to process command" });
  }
});

app.post("/api/ai/rooms/:roomId/events", (req, res) => {
  const { userId, events } = req.body as AiEventsRequest;
  roomManager.handleEvents(req.params.roomId, userId, events);
  res.json({ accepted: events.length });
});

app.post("/api/ai/rooms/:roomId/feedback", async (req, res) => {
  try {
    const request = req.body as AiFeedbackRequest;
    await roomManager.handleFeedback(req.params.roomId, request);
    res.json({ ok: true, actionId: request.actionId, status: request.status });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "internal", message: "Failed to process feedback" });
  }
});

app.get("/api/ai/rooms/:roomId/queue", (req, res) => {
  const status = roomManager.getQueueStatus(req.params.roomId);
  res.json(status);
});

app.listen(config.server.port, () => {
  logger.info({ port: config.server.port }, "AI Agent Service started");
});
