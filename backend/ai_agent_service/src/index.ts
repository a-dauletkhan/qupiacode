import express from "express";
import { config } from "./config.js";
import { requireInternalAuth } from "./internal-auth.js";
import { logger } from "./logger.js";
import { SupabaseRoomStore } from "./persistence/supabase-room-store.js";
import { QueueFullError, RoomManager } from "./room-manager.js";
import type {
  CommandRequest,
  EventsRequest,
  FeedbackRequest,
  RecordingSystemEventPayload,
  TranscriptIngestionPayload,
} from "./types.js";

const app = express();
app.use(express.json());

const roomManager = new RoomManager();
const roomStore = new SupabaseRoomStore();

function resolveRoomId(param: string | string[]): string {
  return Array.isArray(param) ? param[0] ?? "" : param;
}

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/internal/rooms/:roomId/join", requireInternalAuth, async (req, res) => {
  await roomManager.joinRoom(resolveRoomId(req.params.roomId));
  res.json({ ok: true });
});

app.post("/internal/rooms/:roomId/leave", requireInternalAuth, async (req, res) => {
  await roomManager.leaveRoom(resolveRoomId(req.params.roomId));
  res.json({ ok: true });
});

app.post("/internal/rooms/:roomId/transcripts", requireInternalAuth, async (req, res) => {
  const roomId = resolveRoomId(req.params.roomId);
  const body = req.body as TranscriptIngestionPayload;

  if (!body.text || !body.utterance_id || !body.segment_id || !body.occurred_at) {
    res.status(400).json({
      error: "invalid_request",
      message: "Missing required transcript fields",
    });
    return;
  }

  const normalizedEvent: TranscriptIngestionPayload = {
    ...body,
    room_id: roomId,
  };

  if (!normalizedEvent.is_final) {
    res.json({ ok: true, skipped: true });
    return;
  }

  logger.info(
    {
      roomId,
      participantIdentity: normalizedEvent.participant_identity,
      speakerName: normalizedEvent.speaker_name,
      textLength: normalizedEvent.text.length,
    },
    "Transcript received from voice worker",
  );

  await roomStore.storeTranscript(normalizedEvent);
  await roomStore.appendRoomEvent({
    roomId,
    eventType: "voice.transcript.final",
    source: "livekit",
    actorType: "user",
    actorId: normalizedEvent.participant_identity ?? normalizedEvent.speaker_id,
    occurredAt: normalizedEvent.occurred_at,
    payload: normalizedEvent as unknown as Record<string, unknown>,
  });
  await roomManager.handleTranscript(roomId, normalizedEvent);

  res.json({ ok: true });
});

app.post("/internal/rooms/:roomId/system-events", requireInternalAuth, async (req, res) => {
  const roomId = resolveRoomId(req.params.roomId);
  const body = req.body as RecordingSystemEventPayload;

  if (!body.event_type || !body.recording_id || !body.occurred_at || !body.room_name) {
    res.status(400).json({
      error: "invalid_request",
      message: "Missing required recording/system event fields",
    });
    return;
  }

  const normalizedEvent: RecordingSystemEventPayload = {
    ...body,
    room_id: roomId,
  };

  await roomManager.handleSystemEvent(roomId, normalizedEvent);
  res.json({ ok: true });
});

app.post("/api/ai/rooms/:roomId/command", requireInternalAuth, async (req, res) => {
  const roomId = resolveRoomId(req.params.roomId);
  const body = req.body as CommandRequest;

  if (!body.userId || !body.message || !body.source || !body.canvasSnapshot) {
    res.status(400).json({
      error: "invalid_request",
      message: "Missing required fields: userId, message, source, canvasSnapshot",
    });
    return;
  }

  try {
    const result = await roomManager.handleCommand(roomId, body);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof QueueFullError) {
      res.status(429).json({
        error: "queue_full",
        message: err.message,
        retryAfterMs: 5000,
      });
      return;
    }

    logger.error({ err, roomId }, "Command error");
    res.status(500).json({
      error: "internal_error",
      message: "Failed to process command",
    });
  }
});

app.post("/api/ai/rooms/:roomId/events", requireInternalAuth, async (req, res) => {
  const roomId = resolveRoomId(req.params.roomId);
  const body = req.body as EventsRequest;

  if (!body.userId || !Array.isArray(body.events)) {
    res.status(400).json({
      error: "invalid_request",
      message: "Missing required fields: userId, events",
    });
    return;
  }

  try {
    const accepted = await roomManager.handleEvents(roomId, body.userId, body.events);
    res.status(200).json({ accepted });
  } catch (err) {
    logger.error({ err, roomId }, "Events error");
    res.status(500).json({
      error: "internal_error",
      message: "Failed to process events",
    });
  }
});

app.post("/api/ai/rooms/:roomId/feedback", requireInternalAuth, async (req, res) => {
  const roomId = resolveRoomId(req.params.roomId);
  const body = req.body as FeedbackRequest;

  if (!body.userId || !body.actionId || !body.status) {
    res.status(400).json({
      error: "invalid_request",
      message: "Missing required fields: userId, actionId, status",
    });
    return;
  }

  try {
    const result = await roomManager.handleFeedback(roomId, body);
    res.status(200).json(result);
  } catch (err) {
    logger.error({ err, roomId }, "Feedback error");
    res.status(500).json({
      error: "internal_error",
      message: "Failed to process feedback",
    });
  }
});

app.get("/api/ai/rooms/:roomId/queue", requireInternalAuth, async (req, res) => {
  const roomId = resolveRoomId(req.params.roomId);

  try {
    if (!roomManager.hasRoom(roomId)) {
      await roomManager.joinRoom(roomId);
    }

    const status = roomManager.getQueueStatus(roomId);
    res.status(200).json(status);
  } catch (err) {
    logger.error({ err, roomId }, "Queue status error");
    res.status(500).json({
      error: "internal_error",
      message: "Failed to get queue status",
    });
  }
});

app.post("/api/liveblocks/webhook", async (req, res) => {
  const event = req.body as { type?: string; data?: Record<string, unknown> };
  const roomId = typeof event.data?.roomId === "string" ? event.data.roomId : null;

  if (!roomId) {
    res.json({ ok: true });
    return;
  }

  if (event.type === "storageUpdated") {
    await roomManager.handleStorageChange(
      roomId,
      "storage updated",
      typeof event.data?.userId === "string" ? event.data.userId : "unknown",
    );
  } else if (event.type === "userEntered") {
    await roomManager.joinRoom(roomId);
  }

  res.json({ ok: true });
});

app.listen(config.server.port, () => {
  logger.info({ port: config.server.port }, "AI Agent Service started");
});
