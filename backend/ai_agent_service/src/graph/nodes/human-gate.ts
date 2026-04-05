import { interrupt } from "@langchain/langgraph";
import type { AgentStateType, FeedbackInput } from "../state.js";

export function humanGateNode(state: AgentStateType): Partial<AgentStateType> {
  const latestAction = state.pendingActions[state.pendingActions.length - 1];
  if (!latestAction) {
    return { done: true };
  }

  const feedback = interrupt({
    actionId: latestAction.actionId,
    persona: latestAction.persona,
    message: "Waiting for approval on AI-generated canvas changes",
  }) as FeedbackInput;

  return { lastFeedback: feedback };
}
