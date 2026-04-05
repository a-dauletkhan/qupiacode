import { Annotation } from "@langchain/langgraph";
import type {
  CanvasNode,
  CanvasEdge,
  TranscriptSegment,
  AiActivityEvent,
} from "../types.js";
import type { ToolCall } from "../llm/types.js";

export interface CommandInput {
  userId: string;
  userName: string;
  message: string;
  source: "chat" | "canvas_context_menu" | "proactive";
  selectedNodeIds: string[];
  targetPersona: string | null;
}

export interface PendingAction {
  persona: string;
  personaColor: string;
  actionId: string;
  toolCalls: ToolCall[];
  chatMessage: string | null;
}

export interface FeedbackInput {
  actionId: string;
  status: "approved" | "rejected";
  reason?: string;
  nodeIds: string[];
  edgeIds: string[];
  userId: string;
}

// Last-write-wins reducer
const lastValue = <T>() => ({
  value: (_prev: T, next: T) => next,
});

export const AgentState = Annotation.Root({
  roomId: Annotation<string>,

  command: Annotation<CommandInput | null>({
    ...lastValue<CommandInput | null>(),
    default: () => null,
  }),
  canvasSnapshot: Annotation<{ nodes: CanvasNode[]; edges: CanvasEdge[] }>({
    ...lastValue<{ nodes: CanvasNode[]; edges: CanvasEdge[] }>(),
    default: () => ({ nodes: [], edges: [] }),
  }),
  transcript: Annotation<TranscriptSegment[]>({
    ...lastValue<TranscriptSegment[]>(),
    default: () => [],
  }),
  userEvents: Annotation<AiActivityEvent[]>({
    ...lastValue<AiActivityEvent[]>(),
    default: () => [],
  }),

  mode: Annotation<"auto" | "pipeline" | "direct">({
    ...lastValue<"auto" | "pipeline" | "direct">(),
    default: () => "auto" as const,
  }),
  targetPersona: Annotation<string | null>({
    ...lastValue<string | null>(),
    default: () => null,
  }),

  pipelineSteps: Annotation<string[]>({
    ...lastValue<string[]>(),
    default: () => [],
  }),
  currentStep: Annotation<number>({
    ...lastValue<number>(),
    default: () => 0,
  }),

  pendingActions: Annotation<PendingAction[]>({
    value: (existing, update) => [...existing, ...update],
    default: () => [],
  }),

  lastFeedback: Annotation<FeedbackInput | null>({
    ...lastValue<FeedbackInput | null>(),
    default: () => null,
  }),

  done: Annotation<boolean>({
    ...lastValue<boolean>(),
    default: () => false,
  }),
  error: Annotation<string | null>({
    ...lastValue<string | null>(),
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
