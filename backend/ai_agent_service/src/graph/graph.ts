import { StateGraph, START, END } from "@langchain/langgraph";
import { Liveblocks } from "@liveblocks/node";
import type { LLMProvider } from "../llm/types.js";
import type { PersonasFile } from "../persona-loader.js";
import { AgentState, type AgentStateType } from "./state.js";
import { createGatherContextNode } from "./nodes/gather-context.js";
import { createRouterNode } from "./nodes/router.js";
import { createPersonaNode } from "./nodes/persona.js";
import { createExecuteNode } from "./nodes/execute.js";
import { humanGateNode } from "./nodes/human-gate.js";
import { createHandleFeedbackNode } from "./nodes/handle-feedback.js";

function shouldContinueAfterFeedback(state: AgentStateType): string {
  if (state.lastFeedback?.status === "rejected") {
    return "__end__";
  }

  if (
    state.mode === "pipeline" &&
    state.currentStep < state.pipelineSteps.length - 1
  ) {
    return "next_step";
  }

  return "__end__";
}

function advanceStep(state: AgentStateType): Partial<AgentStateType> {
  const nextStep = state.currentStep + 1;
  return {
    targetPersona: state.pipelineSteps[nextStep],
    currentStep: nextStep,
    lastFeedback: null,
  };
}

export function buildGraph(
  liveblocks: Liveblocks,
  llm: LLMProvider,
  personasFile: PersonasFile,
  checkpointer: any,
) {
  const graph = new StateGraph(AgentState)
    .addNode("gather_context", createGatherContextNode(liveblocks))
    .addNode("router", createRouterNode(personasFile))
    .addNode("persona", createPersonaNode(personasFile, llm))
    .addNode("execute", createExecuteNode(liveblocks))
    .addNode("human_gate", humanGateNode)
    .addNode("handle_feedback", createHandleFeedbackNode(liveblocks))
    .addNode("next_step", advanceStep)

    .addEdge(START, "gather_context")
    .addEdge("gather_context", "router")
    .addEdge("router", "persona")
    .addEdge("persona", "execute")
    .addEdge("execute", "human_gate")
    .addEdge("human_gate", "handle_feedback")
    .addConditionalEdges("handle_feedback", shouldContinueAfterFeedback, [
      "next_step",
      "__end__",
    ])
    .addEdge("next_step", "persona");

  return graph.compile({ checkpointer });
}
