import { Liveblocks } from "@liveblocks/node";
import { LiveObject, LiveMap } from "@liveblocks/client";
import type { AgentStateType } from "../state.js";
import { ActionExecutor, type AiActionContext } from "../../action-executor.js";
import { enterSharedRoom } from "../shared-room.js";

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
            // Partial update — modify existing LiveObject fields
            const existing = nodesMap.get(id) as LiveObject<any> | undefined;
            if (!existing) {
              console.info(`[execute] Cannot update node "${id}" — not found in map`);
              continue;
            }
            // Apply each field from the update
            if (nodeData.position) {
              existing.set("position", new LiveObject(nodeData.position as Record<string, unknown>));
            }
            if (nodeData.style) {
              // Merge with existing style, don't replace
              const existingStyle = existing.get("style") as LiveObject<any> | undefined;
              const newStyle = nodeData.style as Record<string, unknown>;
              if (existingStyle) {
                for (const [k, v] of Object.entries(newStyle)) existingStyle.set(k, v);
              } else {
                existing.set("style", new LiveObject(newStyle));
              }
            }

            // Update nested data fields via dot-path keys
            const existingData = existing.get("data") as LiveObject<any> | undefined;
            if (existingData) {
              // Debug: log current state
              const beforeData = existingData.toImmutable ? existingData.toImmutable() : existingData;
              console.info(`[execute] Node "${id}" data BEFORE update:`, JSON.stringify(beforeData).slice(0, 300));

              // Content fields (data.content.text, data.content.label)
              const content = existingData.get("content") as LiveObject<any> | undefined;
              if (content) {
                if (nodeData["data.content.text"] !== undefined) {
                  console.info(`[execute]   Setting content.text = "${nodeData["data.content.text"]}"`);
                  content.set("text", nodeData["data.content.text"]);
                }
                if (nodeData["data.content.label"] !== undefined) {
                  console.info(`[execute]   Setting content.label = "${nodeData["data.content.label"]}"`);
                  content.set("label", nodeData["data.content.label"]);
                }
              } else {
                console.info(`[execute]   No "content" LiveObject found in data`);
              }

              // Style fields (data.style.color, data.style.fontSize, etc.)
              const dataStyle = existingData.get("style") as LiveObject<any> | undefined;
              if (dataStyle) {
                const styleUpdates: Record<string, unknown> = {};
                if (nodeData["data.style.color"] !== undefined) styleUpdates.color = nodeData["data.style.color"];
                if (nodeData["data.style.textColor"] !== undefined) styleUpdates.textColor = nodeData["data.style.textColor"];
                if (nodeData["data.style.fontSize"] !== undefined) styleUpdates.fontSize = nodeData["data.style.fontSize"];
                if (nodeData["data.style.fontWeight"] !== undefined) styleUpdates.fontWeight = nodeData["data.style.fontWeight"];
                if (nodeData["data.style.paintStyle"] !== undefined) styleUpdates.paintStyle = nodeData["data.style.paintStyle"];
                if (nodeData["data.style.strokeWidth"] !== undefined) styleUpdates.strokeWidth = nodeData["data.style.strokeWidth"];

                for (const [k, v] of Object.entries(styleUpdates)) {
                  console.info(`[execute]   Setting data.style.${k} = ${JSON.stringify(v)}`);
                  dataStyle.set(k, v);
                }
              } else {
                console.info(`[execute]   No "style" LiveObject found in data`);
              }

              // Direct data fields
              if (nodeData["data.shapeKind"] !== undefined) {
                console.info(`[execute]   Setting data.shapeKind = "${nodeData["data.shapeKind"]}"`);
                existingData.set("shapeKind", nodeData["data.shapeKind"]);
              }
            } else {
              console.info(`[execute] Node "${id}" has no "data" LiveObject — cannot update`);
            }
          } else {
            // Full create — build nested LiveObject structure
            const rawData = nodeData.data as Record<string, unknown>;
            const rawStyle = nodeData.style as Record<string, unknown> | undefined;

            const dataEntries: Record<string, unknown> = { ...rawData };
            if (rawData.content && typeof rawData.content === "object") {
              dataEntries.content = new LiveObject(rawData.content as Record<string, unknown>);
            }
            if (rawData.style && typeof rawData.style === "object") {
              dataEntries.style = new LiveObject(rawData.style as Record<string, unknown>);
            }
            if (rawData._ai && typeof rawData._ai === "object") {
              dataEntries._ai = new LiveObject(rawData._ai as Record<string, unknown>);
            }

            const nodeEntries: Record<string, unknown> = {
              id: nodeData.id,
              type: nodeData.type,
              draggable: true,
              selectable: true,
              focusable: true,
              position: new LiveObject(nodeData.position as Record<string, unknown>),
              data: new LiveObject(dataEntries),
            };
            if (rawStyle) {
              nodeEntries.style = new LiveObject(rawStyle);
            }

            nodesMap.set(id, new LiveObject(nodeEntries));
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
            edgeEntries._ai = new LiveObject(edgeData._ai as Record<string, unknown>);
          }
          edgesMap.set(id, new LiveObject(edgeEntries));
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
