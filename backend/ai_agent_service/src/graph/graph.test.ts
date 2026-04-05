import { describe, it, expect, vi } from "vitest";
import { MemorySaver, Command } from "@langchain/langgraph";
import { buildGraph } from "./graph.js";
import type { LLMProvider, LLMResponse } from "../llm/types.js";
import type { PersonasFile } from "../persona-loader.js";

function createMockLiveblocks() {
  const storage: Record<string, unknown> = { nodes: [], edges: [] };
  return {
    getStorageDocument: vi.fn(async () => ({ data: storage })),
    initializeStorageDocument: vi.fn(async (_roomId: string, data: any) => {
      storage.nodes = data.data.nodes?.data ?? [];
      storage.edges = data.data.edges?.data ?? [];
    }),
    createComment: vi.fn(async () => {}),
    createThread: vi.fn(async () => {}),
    storage,
  };
}

function createMockLLM(): LLMProvider {
  return {
    chat: vi.fn(async () => ({
      text: "I created a sticky note for you.",
      toolCalls: [
        {
          name: "createNode",
          arguments: {
            nodeType: "sticky_note",
            position: { x: 100, y: 100 },
            text: "Test idea",
          },
        },
      ],
    } as LLMResponse)),
  };
}

const testPersonas: PersonasFile = {
  personas: {
    designer: {
      name: "Designer",
      description: "",
      icon: "",
      color: "oklch(0.72 0.16 240)",
      triggers: { keywords: ["design"], mention: "@designer" },
      tools: ["createNode", "sendMessage"],
      system_prompt: "You are a designer.",
    },
  },
  pipelines: {},
};

describe("graph integration", () => {
  it("processes a command through the graph until interrupt", async () => {
    const liveblocks = createMockLiveblocks();
    const llm = createMockLLM();
    const checkpointer = new MemorySaver();

    const graph = buildGraph(
      liveblocks as any,
      llm,
      testPersonas,
      checkpointer,
    );
    const config = { configurable: { thread_id: "test-room-1" } };

    // invoke runs until the interrupt() in human_gate pauses execution
    const result = await graph.invoke(
      {
        roomId: "test-room-1",
        command: {
          userId: "user-1",
          userName: "Alice",
          message: "design a user flow",
          source: "chat" as const,
          selectedNodeIds: [],
          targetPersona: null,
        },
      },
      config,
    );

    // The LLM was called in the persona node
    expect(llm.chat).toHaveBeenCalledOnce();

    // The execute node flushed to Liveblocks storage
    expect(liveblocks.initializeStorageDocument).toHaveBeenCalled();

    // A pending action was accumulated (pendingActions uses an append reducer)
    expect(result.pendingActions.length).toBeGreaterThan(0);
    expect(result.pendingActions[0].persona).toBe("designer");
  });

  it("resumes from interrupt with approval", async () => {
    const liveblocks = createMockLiveblocks();
    const llm = createMockLLM();
    const checkpointer = new MemorySaver();

    const graph = buildGraph(
      liveblocks as any,
      llm,
      testPersonas,
      checkpointer,
    );
    const config = { configurable: { thread_id: "test-room-2" } };

    // First invoke: runs until interrupt at human_gate
    await graph.invoke(
      {
        roomId: "test-room-2",
        command: {
          userId: "user-1",
          userName: "Alice",
          message: "design something",
          source: "chat" as const,
          selectedNodeIds: [],
          targetPersona: null,
        },
      },
      config,
    );

    // Resume with approval -- Command({ resume }) feeds the value back to interrupt()
    const resumed = await graph.invoke(
      new Command({
        resume: {
          actionId: "act-test",
          status: "approved",
          nodeIds: ["ai-node-1"],
          edgeIds: [],
          userId: "user-1",
        },
      }),
      config,
    );

    expect(resumed.lastFeedback?.status).toBe("approved");
  });
});
