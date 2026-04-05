import { describe, it, expect } from "vitest";
import { createRouterNode } from "./router.js";
import type { AgentStateType } from "../state.js";
import type { PersonasFile } from "../../persona-loader.js";

const testPersonas: PersonasFile = {
  personas: {
    designer: {
      name: "Designer", description: "", icon: "", color: "",
      triggers: { keywords: ["layout", "design", "create"], mention: "@designer" },
      tools: [], system_prompt: "",
    },
    critique: {
      name: "Critique", description: "", icon: "", color: "",
      triggers: { keywords: ["review", "feedback"], mention: "@critique" },
      tools: [], system_prompt: "",
    },
    marketing: {
      name: "Marketing", description: "", icon: "", color: "",
      triggers: { keywords: ["copy", "brand"], mention: "@marketing" },
      tools: [], system_prompt: "",
    },
  },
  pipelines: {
    campaign: { triggers: ["build a campaign"], steps: ["designer", "critique", "marketing"] },
  },
};

function makeState(overrides: Partial<AgentStateType>): AgentStateType {
  return {
    roomId: "room-1", command: null,
    canvasSnapshot: { nodes: [], edges: [] }, transcript: [], userEvents: [],
    mode: "auto", targetPersona: null, pipelineSteps: [], currentStep: 0,
    pendingActions: [], lastFeedback: null, done: false, error: null,
    ...overrides,
  };
}

describe("router node", () => {
  const router = createRouterNode(testPersonas);

  it("routes direct persona from command targetPersona", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "organize this", source: "chat", selectedNodeIds: [], targetPersona: "critique" },
    }));
    expect(result.mode).toBe("direct");
    expect(result.targetPersona).toBe("critique");
  });

  it("routes @mention in message text", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "@marketing name this feature", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("direct");
    expect(result.targetPersona).toBe("marketing");
  });

  it("routes pipeline trigger", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "build a campaign for Q2", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("pipeline");
    expect(result.targetPersona).toBe("designer");
    expect(result.pipelineSteps).toEqual(["designer", "critique", "marketing"]);
  });

  it("auto-detects by keyword", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "review and give feedback", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("auto");
    expect(result.targetPersona).toBe("critique");
  });

  it("defaults to designer when no keywords match", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "hello", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.targetPersona).toBe("designer");
  });

  it("direct mention beats pipeline trigger", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "@critique build a campaign", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("direct");
    expect(result.targetPersona).toBe("critique");
  });
});
