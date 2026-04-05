import { Liveblocks } from "@liveblocks/node";
import type { AgentStateType } from "../state.js";
import type { CanvasNode, CanvasEdge } from "../../types.js";
import { enterSharedRoom } from "../shared-room.js";

export function createGatherContextNode(liveblocks: Liveblocks) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const { roomId } = state;

    try {
      console.info(`[gather-context] Entering room: "${roomId}"`);

      // Enter shared room — sets presence to "acting" immediately
      const room = enterSharedRoom(liveblocks, roomId);

      // Wait for presence to sync to frontend before proceeding
      await new Promise((resolve) => setTimeout(resolve, 300));

      const { root } = await room.getStorage();

      // useLiveblocksFlow stores under root.flow.nodes (LiveMap) and root.flow.edges (LiveMap)
      const flow = root.get("flow") as any;
      if (!flow) {
        console.info(`[gather-context] No "flow" key in storage`);
        return { canvasSnapshot: { nodes: [], edges: [] } };
      }

      const nodesMap = flow.get("nodes") as any;
      const edgesMap = flow.get("edges") as any;

      const nodeEntries: Array<[string, any]> = nodesMap ? Array.from(nodesMap.entries()) : [];
      const edgeEntries: Array<[string, any]> = edgesMap ? Array.from(edgesMap.entries()) : [];

      console.info(`[gather-context] Room ${roomId}: ${nodeEntries.length} nodes, ${edgeEntries.length} edges`);

      // Debug: dump full structure of first 2 nodes and 1 edge
      for (const [nodeId, nodeObj] of nodeEntries.slice(0, 2)) {
        const immutable = nodeObj.toImmutable ? nodeObj.toImmutable() : nodeObj;
        console.info(`[gather-context] FULL NODE "${nodeId}":`, JSON.stringify(immutable, null, 2));
      }
      for (const [edgeId, edgeObj] of edgeEntries.slice(0, 1)) {
        const immutable = edgeObj.toImmutable ? edgeObj.toImmutable() : edgeObj;
        console.info(`[gather-context] FULL EDGE "${edgeId}":`, JSON.stringify(immutable, null, 2));
      }

      const nodes: CanvasNode[] = nodeEntries.map(([, nodeObj]) => {
        const n = nodeObj.toImmutable ? nodeObj.toImmutable() : nodeObj;
        const data = n.data ?? {};
        return {
          id: n.id as string,
          type: (data.objectType as string ?? "shape") as CanvasNode["type"],
          position: n.position as { x: number; y: number },
          width: n.style?.width as number | undefined,
          height: n.style?.height as number | undefined,
          data: data as CanvasNode["data"],
        };
      });

      const edges: CanvasEdge[] = edgeEntries.map(([, edgeObj]) => {
        const e = edgeObj.toImmutable ? edgeObj.toImmutable() : edgeObj;
        return {
          id: e.id as string,
          source: e.source as string,
          target: e.target as string,
          label: e.label as string | undefined,
        };
      });

      return { canvasSnapshot: { nodes, edges } };
    } catch (err) {
      console.error(`Failed to gather context for room ${roomId}:`, err);
      return { canvasSnapshot: { nodes: [], edges: [] } };
    }
  };
}
