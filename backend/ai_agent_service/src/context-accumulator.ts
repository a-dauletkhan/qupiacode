import type { CanvasNode, CanvasEdge, TranscriptSegment } from "./types.js";

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

    return sections.join("\n\n");
  }
}
