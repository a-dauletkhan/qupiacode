import type { AgentAction, CanvasEdge, CanvasNode, TranscriptSegment, ActivityEvent } from "./types.js";

interface AccumulatorConfig {
  maxTranscriptSegments: number;
  maxRecentChanges: number;
  maxActivityEvents?: number;
  maxFeedbackEntries?: number;
}

interface ChangeEntry {
  userId: string;
  description: string;
  timestamp: number;
}

interface FeedbackEntry {
  userId: string;
  actionId: string;
  status: "approved" | "rejected";
  reason?: string;
  timestamp: number;
}

interface ChatMessageEntry {
  userId: string;
  text: string;
  mentionedAi: boolean;
  timestamp: number;
}

export class ContextAccumulator {
  private nodes: CanvasNode[] = [];
  private edges: CanvasEdge[] = [];
  private transcript: TranscriptSegment[] = [];
  private recentChanges: ChangeEntry[] = [];
  private activityEvents: ActivityEvent[] = [];
  private feedbackEntries: FeedbackEntry[] = [];
  private chatMessages: ChatMessageEntry[] = [];
  private pendingActions: AgentAction[] = [];
  private config: AccumulatorConfig;

  constructor(config: AccumulatorConfig) {
    this.config = config;
  }

  updateCanvasSnapshot(nodes: CanvasNode[], edges: CanvasEdge[]): void {
    this.nodes = nodes;
    this.edges = edges;
  }

  addTranscriptSegment(segment: TranscriptSegment): void {
    this.transcript.push(segment);
    if (this.transcript.length > this.config.maxTranscriptSegments) {
      this.transcript = this.transcript.slice(-this.config.maxTranscriptSegments);
    }
  }

  addChange(userId: string, description: string): void {
    this.recentChanges.push({ userId, description, timestamp: Date.now() });
    if (this.recentChanges.length > this.config.maxRecentChanges) {
      this.recentChanges = this.recentChanges.slice(-this.config.maxRecentChanges);
    }
  }

  addActivityEvents(events: ActivityEvent[]): void {
    const max = this.config.maxActivityEvents ?? 50;
    this.activityEvents.push(...events);
    if (this.activityEvents.length > max) {
      this.activityEvents = this.activityEvents.slice(-max);
    }
  }

  addFeedback(userId: string, actionId: string, status: "approved" | "rejected", reason?: string): void {
    const max = this.config.maxFeedbackEntries ?? 20;
    this.feedbackEntries.push({ userId, actionId, status, reason, timestamp: Date.now() });
    if (this.feedbackEntries.length > max) {
      this.feedbackEntries = this.feedbackEntries.slice(-max);
    }
  }

  addChatMessage(userId: string, text: string, mentionedAi: boolean, timestamp = Date.now()): void {
    const max = this.config.maxActivityEvents ?? 50;
    this.chatMessages.push({ userId, text, mentionedAi, timestamp });
    if (this.chatMessages.length > max) {
      this.chatMessages = this.chatMessages.slice(-max);
    }
  }

  setPendingActions(actions: AgentAction[]): void {
    this.pendingActions = actions;
  }

  getState(): {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    transcript: TranscriptSegment[];
    recentChanges: ChangeEntry[];
    activityEvents: ActivityEvent[];
    feedbackEntries: FeedbackEntry[];
    chatMessages: ChatMessageEntry[];
    pendingActions: AgentAction[];
  } {
    return {
      nodes: [...this.nodes],
      edges: [...this.edges],
      transcript: [...this.transcript],
      recentChanges: [...this.recentChanges],
      activityEvents: [...this.activityEvents],
      feedbackEntries: [...this.feedbackEntries],
      chatMessages: [...this.chatMessages],
      pendingActions: [...this.pendingActions],
    };
  }

  buildContext(): string {
    const sections: string[] = [];

    // Canvas state
    if (this.nodes.length > 0 || this.edges.length > 0) {
      const nodeDescriptions = this.nodes.map((node) => {
        const content = node.data.content as Record<string, unknown> | undefined;
        const primaryText =
          (typeof content?.label === "string" && content.label.trim()) ||
          (typeof content?.text === "string" && content.text.trim()) ||
          "";
        const shapeKind = node.data.shapeKind ? ` shape=${node.data.shapeKind}` : "";
        const draftState = node.data._ai ? ` ai_status=${node.data._ai.status}` : "";
        const label = primaryText ? ` label="${primaryText}"` : "";
        return `  - id="${node.id}" type=${node.type}${shapeKind}${label} pos=(${Math.round(node.position.x)}, ${Math.round(node.position.y)})${draftState}`;
      });
      const edgeDescriptions = this.edges.map(
        (edge) =>
          `  - id="${edge.id}" "${edge.source}" -> "${edge.target}"${
            edge.label ? ` label="${edge.label}"` : ""
          }`
      );
      sections.push(
        `## Canvas State\nNodes (${this.nodes.length}):\n${nodeDescriptions.join("\n")}\nEdges (${this.edges.length}):\n${edgeDescriptions.join("\n") || "  (none)"}`
      );
    } else {
      sections.push("## Canvas State\nThe canvas is empty.");
    }

    // Recent changes
    if (this.recentChanges.length > 0) {
      const changeLines = this.recentChanges.map(
        (c) => `  - ${c.userId}: ${c.description}`
      );
      sections.push(`## Recent Changes\n${changeLines.join("\n")}`);
    }

    // User activity events
    if (this.activityEvents.length > 0) {
      const eventLines = this.activityEvents.map(
        (e) => `  - [${e.type}] ${JSON.stringify(e.data)}`
      );
      sections.push(`## Recent User Activity\n${eventLines.join("\n")}`);
    }

    if (this.chatMessages.length > 0) {
      const chatLines = this.chatMessages.map(
        (message) =>
          `  - ${message.userId}${message.mentionedAi ? " (@agent)" : ""}: ${message.text}`
      );
      sections.push(`## Recent Human Chat\n${chatLines.join("\n")}`);
    }

    // Transcript
    if (this.transcript.length > 0) {
      const transcriptLines = this.transcript.map(
        (t) => `  [${t.speakerName}]: ${t.text}`
      );
      sections.push(`## Recent Conversation\n${transcriptLines.join("\n")}`);
    }

    // Feedback history
    if (this.feedbackEntries.length > 0) {
      const feedbackLines = this.feedbackEntries.map(
        (f) => `  - Action ${f.actionId}: ${f.status}${f.reason ? ` (reason: ${f.reason})` : ""}`
      );
      sections.push(`## User Feedback on AI Actions\n${feedbackLines.join("\n")}`);
    }

    if (this.pendingActions.length > 0) {
      const actionLines = this.pendingActions.map(
        (action) =>
          `  - ${action.actionId} (${action.type}) nodes=${action.nodeIds.length} edges=${action.edgeIds.length} status=${action.status}`
      );
      sections.push(`## Pending AI Actions\n${actionLines.join("\n")}`);
    }

    return sections.join("\n\n");
  }
}
