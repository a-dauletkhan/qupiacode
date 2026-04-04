import { describe, it, expect, vi } from "vitest";
import { ActionExecutor } from "./action-executor.js";
import type { ToolCall } from "./llm/types.js";

function createMockStorage() {
  const nodes = new Map<string, Record<string, unknown>>();
  const edges = new Map<string, Record<string, unknown>>();
  const messages: string[] = [];

  return {
    nodes,
    edges,
    messages,
    getNodes: () => Array.from(nodes.entries()).map(([id, data]) => ({ id, ...data })),
    getEdges: () => Array.from(edges.entries()).map(([id, data]) => ({ id, ...data })),
    setNode: (id: string, data: Record<string, unknown>) => nodes.set(id, data),
    deleteNode: (id: string) => nodes.delete(id),
    setEdge: (id: string, data: Record<string, unknown>) => edges.set(id, data),
    deleteEdge: (id: string) => edges.delete(id),
    sendMessage: (text: string) => messages.push(text),
  };
}

describe("ActionExecutor", () => {
  it("executes createNode tool call", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    const toolCall: ToolCall = {
      name: "createNode",
      arguments: {
        nodeType: "sticky_note",
        position: { x: 100, y: 200 },
        text: "Hello",
        color: "#yellow",
      },
    };

    await executor.execute([toolCall]);

    expect(storage.nodes.size).toBe(1);
    const node = Array.from(storage.nodes.values())[0];
    expect(node.type).toBe("sticky_note");
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it("executes deleteNode tool call", async () => {
    const storage = createMockStorage();
    storage.setNode("node-1", { type: "shape" });

    const executor = new ActionExecutor(storage);

    await executor.execute([{ name: "deleteNode", arguments: { nodeId: "node-1" } }]);

    expect(storage.nodes.size).toBe(0);
  });

  it("executes sendMessage tool call", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    await executor.execute([{ name: "sendMessage", arguments: { text: "I organized the board" } }]);

    expect(storage.messages).toEqual(["I organized the board"]);
  });

  it("executes multiple tool calls in sequence", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    await executor.execute([
      { name: "createNode", arguments: { nodeType: "shape", position: { x: 0, y: 0 }, shapeKind: "rectangle" } },
      { name: "createNode", arguments: { nodeType: "shape", position: { x: 200, y: 0 }, shapeKind: "rectangle" } },
      { name: "sendMessage", arguments: { text: "Added two shapes" } },
    ]);

    expect(storage.nodes.size).toBe(2);
    expect(storage.messages).toEqual(["Added two shapes"]);
  });

  it("skips unknown tool calls without throwing", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    await executor.execute([{ name: "unknownTool", arguments: {} }]);

    expect(storage.nodes.size).toBe(0);
  });

  it("injects _ai metadata into created nodes", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage, {
      actionId: "act-001",
      commandId: "cmd-001",
      requestedBy: "user-1",
    });

    await executor.execute([{
      name: "createNode",
      arguments: { nodeType: "sticky_note", position: { x: 0, y: 0 }, text: "test" },
    }]);

    expect(storage.nodes.size).toBe(1);
    const node = Array.from(storage.nodes.values())[0];
    const data = node.data as Record<string, unknown>;
    const ai = data._ai as Record<string, unknown>;
    expect(ai.actionId).toBe("act-001");
    expect(ai.commandId).toBe("cmd-001");
    expect(ai.requestedBy).toBe("user-1");
    expect(ai.status).toBe("pending");
    expect(ai.createdAt).toBeTypeOf("number");
  });

  it("injects _ai metadata into created edges", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage, {
      actionId: "act-002",
      commandId: null,
      requestedBy: null,
    });

    await executor.execute([{
      name: "createEdge",
      arguments: { source: "n1", target: "n2", label: "test" },
    }]);

    expect(storage.edges.size).toBe(1);
    const edge = Array.from(storage.edges.values())[0];
    const ai = edge._ai as Record<string, unknown>;
    expect(ai.actionId).toBe("act-002");
    expect(ai.status).toBe("pending");
  });

  it("does not inject _ai metadata when no context provided", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    await executor.execute([{
      name: "createNode",
      arguments: { nodeType: "shape", position: { x: 0, y: 0 } },
    }]);

    const node = Array.from(storage.nodes.values())[0];
    const data = node.data as Record<string, unknown>;
    expect(data._ai).toBeUndefined();
  });
});
