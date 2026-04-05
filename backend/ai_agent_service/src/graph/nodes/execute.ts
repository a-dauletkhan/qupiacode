import { Liveblocks } from "@liveblocks/node";
import { LiveObject, LiveMap, type LsonObject } from "@liveblocks/client";
import type { AgentStateType } from "../state.js";
import { ActionExecutor, type AiActionContext } from "../../action-executor.js";
import { enterSharedRoom } from "../shared-room.js";

const lson = (obj: Record<string, unknown>) => obj as unknown as LsonObject;

export function createExecuteNode(liveblocks: Liveblocks) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const { roomId, pendingActions } = state;
    const latestAction = pendingActions[pendingActions.length - 1];

    if (!latestAction || (latestAction.toolCalls.length === 0 && !latestAction.chatMessage)) {
      return {};
    }

    const aiContext: AiActionContext = {
      actionId: latestAction.actionId,
      commandId: state.command ? `cmd-${state.command.userId.slice(0, 8)}` : null,
      requestedBy: state.command?.userId ?? null,
      persona: latestAction.persona,
      personaColor: latestAction.personaColor,
    };

    // Collect mutations from ActionExecutor
    const pendingNodeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingNodeDeletes: string[] = [];
    const pendingEdgeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingEdgeDeletes: string[] = [];
    const messageQueue: string[] = [];

    const adapter = {
      getNodes: () => [],
      setNode(id: string, data: Record<string, unknown>) { pendingNodeSets.push({ id, data }); },
      deleteNode(id: string) { pendingNodeDeletes.push(id); },
      setEdge(id: string, data: Record<string, unknown>) { pendingEdgeSets.push({ id, data }); },
      deleteEdge(id: string) { pendingEdgeDeletes.push(id); },
      sendMessage(text: string) { messageQueue.push(text); },
    };

    if (latestAction.toolCalls.length > 0) {
      const executor = new ActionExecutor(adapter, aiContext);
      await executor.execute(latestAction.toolCalls);
    }

    if (latestAction.chatMessage && !latestAction.toolCalls.some((tc) => tc.name === "sendMessage")) {
      adapter.sendMessage(latestAction.chatMessage);
    }

    try {
      if (pendingNodeSets.length > 0 || pendingNodeDeletes.length > 0 ||
          pendingEdgeSets.length > 0 || pendingEdgeDeletes.length > 0) {

        // Use the shared room connection (already entered by gather-context)
        const room = enterSharedRoom(liveblocks, roomId);
        const { root } = await room.getStorage();

        let flow = root.get("flow") as any;
        if (!flow) {
          root.set("flow", new LiveObject({ nodes: new LiveMap(), edges: new LiveMap() }));
          flow = root.get("flow") as any;
        }

        let nodesMap = flow.get("nodes") as LiveMap<string, any> | undefined;
        if (!nodesMap) {
          flow.set("nodes", new LiveMap());
          nodesMap = flow.get("nodes") as LiveMap<string, any>;
        }

        let edgesMap = flow.get("edges") as LiveMap<string, any> | undefined;
        if (!edgesMap) {
          flow.set("edges", new LiveMap());
          edgesMap = flow.get("edges") as LiveMap<string, any>;
        }

        // Apply node creates/updates
        for (const { id, data } of pendingNodeSets) {
          const nodeData = { id, ...data } as Record<string, unknown>;
          const isUpdate = !nodeData.data; // updateNode only sends partial fields (position, etc.)

          console.info(`[execute] ${isUpdate ? "Updating" : "Creating"} node:`, JSON.stringify(nodeData).slice(0, 300));

          if (isUpdate) {
            // Read existing node, apply changes to plain object, then replace entire LiveObject
            const existing = nodesMap.get(id) as LiveObject<any> | undefined;
            if (!existing) {
              console.info(`[execute] Cannot update node "${id}" — not found in map`);
              continue;
            }

            // Get current state as plain object
            const current = existing.toImmutable ? JSON.parse(JSON.stringify(existing.toImmutable())) : {};
            console.info(`[execute] Node "${id}" BEFORE:`, JSON.stringify(current).slice(0, 200));

            // Apply updates
            if (nodeData.position) current.position = nodeData.position;
            if (nodeData.style) current.style = { ...current.style, ...nodeData.style };
            if (nodeData["data.content.text"] !== undefined) {
              current.data = current.data ?? {};
              current.data.content = current.data.content ?? {};
              current.data.content.text = nodeData["data.content.text"];
            }
            if (nodeData["data.content.label"] !== undefined) {
              current.data = current.data ?? {};
              current.data.content = current.data.content ?? {};
              current.data.content.label = nodeData["data.content.label"];
            }
            if (nodeData["data.style.color"] !== undefined) {
              current.data = current.data ?? {};
              current.data.style = current.data.style ?? {};
              current.data.style.color = nodeData["data.style.color"];
            }
            if (nodeData["data.style.textColor"] !== undefined) {
              current.data.style.textColor = nodeData["data.style.textColor"];
            }
            if (nodeData["data.style.fontSize"] !== undefined) {
              current.data.style.fontSize = nodeData["data.style.fontSize"];
            }
            if (nodeData["data.style.fontWeight"] !== undefined) {
              current.data.style.fontWeight = nodeData["data.style.fontWeight"];
            }
            if (nodeData["data.style.paintStyle"] !== undefined) {
              current.data.style.paintStyle = nodeData["data.style.paintStyle"];
            }
            if (nodeData["data.style.strokeWidth"] !== undefined) {
              current.data.style.strokeWidth = nodeData["data.style.strokeWidth"];
            }
            if (nodeData["data.shapeKind"] !== undefined) {
              current.data.shapeKind = nodeData["data.shapeKind"];
            }

            console.info(`[execute] Node "${id}" AFTER:`, JSON.stringify(current).slice(0, 200));

            // Replace entire node LiveObject with updated version (triggers re-render)
            const updatedData = current.data ?? {};
            const dataEntries: Record<string, unknown> = { ...updatedData };
            if (updatedData.content && typeof updatedData.content === "object") {
              dataEntries.content = new LiveObject(lson(updatedData.content));
            }
            if (updatedData.style && typeof updatedData.style === "object") {
              dataEntries.style = new LiveObject(lson(updatedData.style));
            }
            if (updatedData._ai && typeof updatedData._ai === "object") {
              dataEntries._ai = new LiveObject(lson(updatedData._ai));
            }

            const nodeEntries: Record<string, unknown> = {
              id: current.id,
              type: current.type,
              draggable: true,
              selectable: true,
              focusable: true,
              position: new LiveObject(lson(current.position ?? {})),
              data: new LiveObject(lson(dataEntries)),
            };
            if (current.style) {
              nodeEntries.style = new LiveObject(lson(current.style));
            }

            nodesMap.set(id, new LiveObject(lson(nodeEntries)));
          } else {
            // Full create — build nested LiveObject structure
            const rawData = nodeData.data as Record<string, unknown>;
            const rawStyle = nodeData.style as Record<string, unknown> | undefined;

            const dataEntries: Record<string, unknown> = { ...rawData };
            if (rawData.content && typeof rawData.content === "object") {
              dataEntries.content = new LiveObject(lson(rawData.content as Record<string, unknown>));
            }
            if (rawData.style && typeof rawData.style === "object") {
              dataEntries.style = new LiveObject(lson(rawData.style as Record<string, unknown>));
            }
            if (rawData._ai && typeof rawData._ai === "object") {
              dataEntries._ai = new LiveObject(lson(rawData._ai as Record<string, unknown>));
            }

            const nodeEntries: Record<string, unknown> = {
              id: nodeData.id,
              type: nodeData.type,
              draggable: true,
              selectable: true,
              focusable: true,
              position: new LiveObject(lson(nodeData.position as Record<string, unknown>)),
              data: new LiveObject(lson(dataEntries)),
            };
            if (rawStyle) {
              nodeEntries.style = new LiveObject(lson(rawStyle));
            }

            nodesMap.set(id, new LiveObject(lson(nodeEntries)));
          }
        }

        // Apply node deletes
        for (const id of pendingNodeDeletes) {
          const exists = nodesMap.has(id);
          console.info(`[execute] Deleting node "${id}" — exists in map: ${exists}`);
          if (exists) {
            nodesMap.delete(id);
          }
        }

        // Apply edge creates/updates
        for (const { id, data } of pendingEdgeSets) {
          const edgeData = { id, ...data } as Record<string, unknown>;
          const edgeEntries: Record<string, unknown> = { ...edgeData };
          if (edgeData._ai && typeof edgeData._ai === "object") {
            edgeEntries._ai = new LiveObject(lson(edgeData._ai as Record<string, unknown>));
          }
          edgesMap.set(id, new LiveObject(lson(edgeEntries)));
        }

        // Apply edge deletes
        for (const id of pendingEdgeDeletes) {
          const exists = edgesMap.has(id);
          console.info(`[execute] Deleting edge "${id}" — exists in map: ${exists}`);
          if (exists) {
            edgesMap.delete(id);
          }
        }

        // Wait for WebSocket to sync mutations to all clients
        await new Promise((resolve) => setTimeout(resolve, 1500));

        console.log(`[${latestAction.persona}] Flushed to Liveblocks via client SDK:`, {
          nodeSets: pendingNodeSets.length, nodeDeletes: pendingNodeDeletes.length,
          edgeSets: pendingEdgeSets.length, edgeDeletes: pendingEdgeDeletes.length,
        });
      }

      // Send chat messages via Liveblocks Threads API
      for (const text of messageQueue) {
        try {
          await liveblocks.createThread({
            roomId,
            data: {
              comment: {
                userId: "ai-agent",
                createdAt: new Date(),
                body: {
                  version: 1 as const,
                  content: [{ type: "paragraph" as const, children: [{ text }] }],
                },
              },
              metadata: {},
            },
          } as any);
          console.info(`[${latestAction.persona}] Chat message sent: "${text.slice(0, 80)}..."`);
        } catch (err) {
          console.error("Failed to send agent message:", err);
        }
      }
    } catch (err) {
      console.error(`[${latestAction.persona}] Flush failed:`, err);
      return { error: "Failed to write to canvas" };
    }

    return {};
  };
}
