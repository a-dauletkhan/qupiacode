import type { CanvasNode, CanvasEdge, TranscriptSegment } from "./types.js";

interface FeedbackEntry {
  actionId: string;
  status: "approved" | "rejected";
  reason?: string;
  userId: string;
  timestamp: number;
}

interface UserActivityEntry {
  userId: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface AccumulatorConfig {
  maxTranscriptSegments: number;
  maxRecentChanges: number;
}

interface ChangeEntry {
  userId: string;
  description: string;
  timestamp: number;
}

export class ContextAccumulator {
  private nodes: CanvasNode[] = [];
  private edges: CanvasEdge[] = [];
  private transcript: TranscriptSegment[] = [];
  private recentChanges: ChangeEntry[] = [];
  private feedback: FeedbackEntry[] = [];
  private userEvents: UserActivityEntry[] = [];
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

  addFeedback(entry: Omit<FeedbackEntry, "timestamp">): void {
    this.feedback.push({ ...entry, timestamp: Date.now() });
    if (this.feedback.length > 20) {
      this.feedback = this.feedback.slice(-20);
    }
  }

  addUserEvents(userId: string, events: Array<{ type: string; timestamp: number; data: Record<string, unknown> }>): void {
    for (const event of events) {
      this.userEvents.push({ userId, ...event });
    }
    if (this.userEvents.length > 50) {
      this.userEvents = this.userEvents.slice(-50);
    }
  }

  buildContext(): string {
    const sections: string[] = [];

    // Canvas state
    if (this.nodes.length > 0 || this.edges.length > 0) {
      const nodeDescriptions = this.nodes.map((n) => {
        const dataStr = JSON.stringify(n.data);
        return `  - ${n.id} (${n.type}) at (${n.position.x}, ${n.position.y}): ${dataStr}`;
      });
      const edgeDescriptions = this.edges.map(
        (e) => `  - ${e.id}: ${e.source} -> ${e.target}${e.label ? ` [${e.label}]` : ""}`
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

    // Transcript
    if (this.transcript.length > 0) {
      const transcriptLines = this.transcript.map(
        (t) => `  [${t.speakerName}]: ${t.text}`
      );
      sections.push(`## Recent Conversation\n${transcriptLines.join("\n")}`);
    }

    // User activity
    if (this.userEvents.length > 0) {
      const eventLines = this.userEvents.slice(-10).map(
        (e) => `  - ${e.userId}: ${e.type} ${JSON.stringify(e.data)}`
      );
      sections.push(`## Recent User Activity\n${eventLines.join("\n")}`);
    }

    // Feedback history
    if (this.feedback.length > 0) {
      const feedbackLines = this.feedback.map(
        (f) => `  - ${f.actionId}: ${f.status}${f.reason ? ` (reason: ${f.reason})` : ""}`
      );
      sections.push(`## Feedback on AI Actions\n${feedbackLines.join("\n")}`);
    }

    return sections.join("\n\n");
  }
}
