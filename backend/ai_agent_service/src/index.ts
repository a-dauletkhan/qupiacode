import express from "express";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";
import { RoomManager, QueueFullError } from "./room-manager.js";
import type { CommandRequest, EventsRequest, FeedbackRequest } from "./types.js";

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

// ──────────────── AI Agent API Contract ────────────────

// 1.1 POST /api/ai/rooms/:roomId/command — User sends a command to the AI agent
app.post("/api/ai/rooms/:roomId/command", async (req, res) => {
  const { roomId } = req.params;
  const body = req.body as CommandRequest;

  if (!body.userId || !body.message || !body.context) {
    res.status(400).json({ error: "invalid_request", message: "Missing required fields: userId, message, context" });
    return;
  }

  // Auto-join the room if the agent isn't in it yet
  if (!roomManager.hasRoom(roomId)) {
    try {
      await roomManager.joinRoom(roomId);
    } catch (err) {
      logger.error({ err, roomId }, "Failed to auto-join room for command");
      res.status(404).json({ error: "room_not_found", message: "Agent could not join room" });
      return;
    }
  }

  try {
    const result = roomManager.handleCommand(roomId, body);
    res.status(202).json(result);
  } catch (err) {
    if (err instanceof QueueFullError) {
      res.status(429).json({ error: "queue_full", message: err.message, retryAfterMs: 5000 });
    } else {
      logger.error({ err, roomId }, "Command error");
      res.status(500).json({ error: "internal_error", message: "Failed to process command" });
    }
  }
});

// 1.2 POST /api/ai/rooms/:roomId/events — Batched user activity events
app.post("/api/ai/rooms/:roomId/events", (req, res) => {
  const { roomId } = req.params;
  const body = req.body as EventsRequest;

  if (!body.userId || !Array.isArray(body.events)) {
    res.status(400).json({ error: "invalid_request", message: "Missing required fields: userId, events" });
    return;
  }

  if (!roomManager.hasRoom(roomId)) {
    res.status(404).json({ error: "room_not_found", message: "Agent not active in room" });
    return;
  }

  const accepted = roomManager.handleEvents(roomId, body.userId, body.events);
  res.status(200).json({ accepted });
});

// 1.3 POST /api/ai/rooms/:roomId/feedback — Approve/reject AI-generated objects
app.post("/api/ai/rooms/:roomId/feedback", async (req, res) => {
  const { roomId } = req.params;
  const body = req.body as FeedbackRequest;

  if (!body.userId || !body.actionId || !body.status) {
    res.status(400).json({ error: "invalid_request", message: "Missing required fields: userId, actionId, status" });
    return;
  }

  if (!roomManager.hasRoom(roomId)) {
    res.status(404).json({ error: "room_not_found", message: "Agent not active in room" });
    return;
  }

  try {
    const result = await roomManager.handleFeedback(roomId, body);
    res.status(200).json(result);
  } catch (err) {
    logger.error({ err, roomId }, "Feedback error");
    res.status(500).json({ error: "internal_error", message: "Failed to process feedback" });
  }
});

// 1.4 GET /api/ai/rooms/:roomId/queue — Poll queue status
app.get("/api/ai/rooms/:roomId/queue", (req, res) => {
  const { roomId } = req.params;

  if (!roomManager.hasRoom(roomId)) {
    res.status(404).json({ error: "room_not_found", message: "Agent not active in room" });
    return;
  }

  try {
    const status = roomManager.getQueueStatus(roomId);
    res.status(200).json(status);
  } catch (err) {
    logger.error({ err, roomId }, "Queue status error");
    res.status(500).json({ error: "internal_error", message: "Failed to get queue status" });
  }
});

// ──────────────── Liveblocks Webhook ────────────────

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

app.listen(config.server.port, () => {
  logger.info({ port: config.server.port }, "AI Agent Service started");
});
