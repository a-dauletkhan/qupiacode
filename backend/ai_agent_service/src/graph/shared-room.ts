/**
 * Shared Liveblocks room connection for the AI agent.
 * One connection per room, reused across graph nodes.
 */

import { Liveblocks } from "@liveblocks/node";
import { createClient, type Room } from "@liveblocks/client";

let _client: ReturnType<typeof createClient> | null = null;
const _rooms = new Map<string, Room>();

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
  if (existing) return existing;

  const client = getClient(liveblocks);
  const { room } = client.enterRoom(roomId, {
    initialPresence: { cursor: null, type: "ai_agent", status: "acting" },
    initialStorage: {},
  });

  _rooms.set(roomId, room);
  return room;
}

export async function leaveSharedRoom(roomId: string): Promise<void> {
  const room = _rooms.get(roomId);
  if (!room) return;

  // Set presence to watching so the frontend sees the typing stop
  room.updatePresence({ status: "watching" });

  // Wait for presence update to sync via WebSocket
  await new Promise((resolve) => setTimeout(resolve, 300));

  room.disconnect();
  _rooms.delete(roomId);
  console.info(`[shared-room] Disconnected from room ${roomId}`);
}
