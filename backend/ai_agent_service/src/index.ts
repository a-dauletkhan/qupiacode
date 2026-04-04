import express from "express";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";
import { RoomManager } from "./room-manager.js";

const app = express();
app.use(express.json());

const transcriptSource = new WebhookTranscriptSource();
const roomManager = new RoomManager(transcriptSource);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Transcript webhook from LiveKit transcription service
app.post("/api/transcript", (req, res) => {
  transcriptSource.handleEvent(req.body);
  res.json({ ok: true });
});

// Room lifecycle — called by API service or Liveblocks webhooks
app.post("/api/rooms/:roomId/join", async (req, res) => {
  await roomManager.joinRoom(req.params.roomId);
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/leave", async (req, res) => {
  await roomManager.leaveRoom(req.params.roomId);
  res.json({ ok: true });
});

// Liveblocks webhook endpoint for storage changes and room events
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
