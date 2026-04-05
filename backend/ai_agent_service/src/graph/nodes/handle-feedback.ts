import { Liveblocks } from "@liveblocks/node";
import type { LiveMap, LiveObject } from "@liveblocks/client";
import type { AgentStateType } from "../state.js";
import { enterSharedRoom, leaveSharedRoom } from "../shared-room.js";

export function createHandleFeedbackNode(liveblocks: Liveblocks) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const { roomId, lastFeedback } = state;
    if (!lastFeedback) return { done: true };

    try {
      const room = enterSharedRoom(liveblocks, roomId);
      const { root } = await room.getStorage();

      // useLiveblocksFlow stores under root.flow.nodes (LiveMap) and root.flow.edges (LiveMap)
      const flow = root.get("flow") as LiveObject<any> | undefined;
      if (!flow) {
        console.info("[handle-feedback] No flow storage found");
        await leaveSharedRoom(roomId);
        return {};
      }

      const nodesMap = flow.get("nodes") as LiveMap<string, any> | undefined;
      const edgesMap = flow.get("edges") as LiveMap<string, any> | undefined;

      if (lastFeedback.status === "rejected") {
        // Remove rejected nodes by ID from the LiveMap
        if (nodesMap) {
          for (const id of lastFeedback.nodeIds) {
            const exists = nodesMap.has(id);
            console.info(`[handle-feedback] Removing node "${id}" — exists: ${exists}`);
            if (exists) {
              nodesMap.delete(id);
            }
          }
        }
        // Remove rejected edges by ID
        if (edgesMap) {
          for (const id of lastFeedback.edgeIds) {
            const exists = edgesMap.has(id);
            console.info(`[handle-feedback] Removing edge "${id}" — exists: ${exists}`);
            if (exists) {
              edgesMap.delete(id);
            }
          }
        }
        console.log(`Rejected: removed ${lastFeedback.nodeIds.length} nodes, ${lastFeedback.edgeIds.length} edges`);
      } else if (lastFeedback.status === "approved") {
        // Update _ai.status to "approved" on nodes
        if (nodesMap) {
          for (const id of lastFeedback.nodeIds) {
            const nodeObj = nodesMap.get(id) as LiveObject<any> | undefined;
            if (!nodeObj) continue;

            const dataObj = nodeObj.get("data") as LiveObject<any> | undefined;
            if (!dataObj) continue;

            const aiObj = dataObj.get("_ai") as LiveObject<any> | undefined;
            if (aiObj) {
              aiObj.set("status", "approved");
              console.info(`[handle-feedback] Approved node "${id}"`);
            }
          }
        }
        // Update _ai.status on edges
        if (edgesMap) {
          for (const id of lastFeedback.edgeIds) {
            const edgeObj = edgesMap.get(id) as LiveObject<any> | undefined;
            if (!edgeObj) continue;

            const aiObj = edgeObj.get("_ai") as LiveObject<any> | undefined;
            if (aiObj) {
              aiObj.set("status", "approved");
              console.info(`[handle-feedback] Approved edge "${id}"`);
            }
          }
        }
        console.log(`Approved: ${lastFeedback.nodeIds.length} nodes, ${lastFeedback.edgeIds.length} edges`);
      }

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 500));
      await leaveSharedRoom(roomId);
    } catch (err) {
      console.error("Feedback storage update failed:", err);
    }

    return {};
  };
}
