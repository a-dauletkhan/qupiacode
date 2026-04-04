import { describe, it, expect } from "vitest";
import { ContextAccumulator } from "./context-accumulator.js";
import type { CanvasNode, TranscriptSegment } from "./types.js";

describe("ContextAccumulator", () => {
  it("builds context with canvas snapshot and transcript", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

    const node: CanvasNode = {
      id: "node-1",
      type: "sticky_note",
      position: { x: 100, y: 200 },
      data: { type: "sticky_note", text: "Hello", color: "#yellow", textColor: "#000", fontSize: 14 },
    };

    acc.updateCanvasSnapshot([node], []);
    acc.addTranscriptSegment({
      speakerId: "user-1",
      speakerName: "Alice",
      text: "Let's add a user flow",
      timestamp: 1000,
    });

    const context = acc.buildContext();

    expect(context).toContain("node-1");
    expect(context).toContain("sticky_note");
    expect(context).toContain("Hello");
    expect(context).toContain("Alice");
    expect(context).toContain("user flow");
  });

  it("limits transcript segments to maxTranscriptSegments", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 2, maxRecentChanges: 10 });

    acc.addTranscriptSegment({ speakerId: "u1", speakerName: "A", text: "first", timestamp: 1 });
    acc.addTranscriptSegment({ speakerId: "u1", speakerName: "A", text: "second", timestamp: 2 });
    acc.addTranscriptSegment({ speakerId: "u1", speakerName: "A", text: "third", timestamp: 3 });

    const context = acc.buildContext();

    expect(context).not.toContain("first");
    expect(context).toContain("second");
    expect(context).toContain("third");
  });

  it("tracks recent changes", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });
    acc.addChange("user-1", "created node-1 (sticky_note)");

    const context = acc.buildContext();
    expect(context).toContain("created node-1");
  });

  it("tracks user activity events", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

    acc.addActivityEvents([
      { type: "node:selected", timestamp: 1000, data: { nodeIds: ["n1"] } },
      { type: "tool:switched", timestamp: 1001, data: { from: "selection", to: "rectangle" } },
    ]);

    const context = acc.buildContext();
    expect(context).toContain("node:selected");
    expect(context).toContain("tool:switched");
  });

  it("tracks feedback for LLM context", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

    acc.addFeedback("user-1", "act-1", "rejected", "not what I wanted");

    const context = acc.buildContext();
    expect(context).toContain("rejected");
    expect(context).toContain("not what I wanted");
  });
});
