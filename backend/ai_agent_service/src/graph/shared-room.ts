/**
 * Shared Liveblocks room connection for the AI agent.
 * Stays connected per room, disconnects after 30s of inactivity.
 */

import { Liveblocks } from "@liveblocks/node";
import { createClient, type Room } from "@liveblocks/client";
import WebSocket from "ws";

let _client: ReturnType<typeof createClient> | null = null;
const _rooms = new Map<string, { room: Room; idleTimer: ReturnType<typeof setTimeout> | null }>();

const IDLE_DISCONNECT_MS = 30_000;

function getClient(liveblocks: Liveblocks) {
  if (!_client) {
    _client = createClient({
      polyfills: { WebSocket: WebSocket as any },
      authEndpoint: async () => {
        const session = liveblocks.prepareSession("ai-agent", {
          userInfo: { name: "AI Agent" },
        });
        session.allow("*", session.FULL_ACCESS);
        const { body } = await session.authorize();
        return JSON.parse(body);
      },
    });
  }
  return _client;
}

export function enterSharedRoom(liveblocks: Liveblocks, roomId: string): Room {
  const existing = _rooms.get(roomId);
  if (existing) {
    if (existing.idleTimer) {
      clearTimeout(existing.idleTimer);
      existing.idleTimer = null;
    }
    existing.room.updatePresence({ status: "acting" });
    return existing.room;
  }

  const client = getClient(liveblocks);
  const { room } = client.enterRoom(roomId, {
    initialPresence: { cursor: null, type: "ai_agent", status: "acting", persona: null },
    initialStorage: {},
  });

  _rooms.set(roomId, { room, idleTimer: null });
  return room;
}

/** Update presence to show which persona is currently working */
export function setPersonaPresence(roomId: string, persona: string, action?: string) {
  const entry = _rooms.get(roomId);
  if (entry) {
    console.info(`[shared-room] Setting persona presence: ${persona}, action: ${action ?? "none"}`);
    entry.room.updatePresence({ status: "acting", persona, action: action ?? null });
  } else {
    console.info(`[shared-room] Cannot set persona — no room entry for ${roomId}`);
  }
}

/** Update presence to show current phase */
export function setPresencePhase(roomId: string, phase: string) {
  const entry = _rooms.get(roomId);
  if (entry) {
    entry.room.updatePresence({ phase });
  }
}

export async function leaveSharedRoom(roomId: string): Promise<void> {
  const entry = _rooms.get(roomId);
  if (!entry) return;

  entry.room.updatePresence({ status: "watching", persona: null });

  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => {
    const current = _rooms.get(roomId);
    if (current) {
      current.room.disconnect();
      _rooms.delete(roomId);
      console.info(`[shared-room] Disconnected from room ${roomId} (idle timeout)`);
    }
  }, IDLE_DISCONNECT_MS);
}
