/**
 * Shared Liveblocks room connection for the AI agent.
 * Stays connected per room, disconnects after 30s of inactivity.
 */

import { Liveblocks } from "@liveblocks/node";
import { createClient, type Room } from "@liveblocks/client";

let _client: ReturnType<typeof createClient> | null = null;
const _rooms = new Map<string, { room: Room; idleTimer: ReturnType<typeof setTimeout> | null }>();

const IDLE_DISCONNECT_MS = 30_000; // disconnect after 30s of no activity

function getClient(liveblocks: Liveblocks) {
  if (!_client) {
    _client = createClient({
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
    // Cancel idle disconnect timer — room is active again
    if (existing.idleTimer) {
      clearTimeout(existing.idleTimer);
      existing.idleTimer = null;
    }
    // Set presence to acting
    existing.room.updatePresence({ status: "acting" });
    return existing.room;
  }

  const client = getClient(liveblocks);
  const { room } = client.enterRoom(roomId, {
    initialPresence: { cursor: null, type: "ai_agent", status: "acting" },
    initialStorage: {},
  });

  _rooms.set(roomId, { room, idleTimer: null });
  return room;
}

export async function leaveSharedRoom(roomId: string): Promise<void> {
  const entry = _rooms.get(roomId);
  if (!entry) return;

  // Set presence to watching (stop typing indicator)
  entry.room.updatePresence({ status: "watching" });

  // Start idle timer — disconnect if no new activity within 30s
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
