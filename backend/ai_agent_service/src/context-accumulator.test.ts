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
      data: {
        objectType: "sticky_note",
        content: { text: "Hello" },
        style: { color: "#yellow", textColor: "#000", fontSize: 14 },
      },
    };

    acc.updateCanvasSnapshot([node], []);
    acc.addTranscriptSegment({
      utteranceId: "utt-1",
      segmentId: "seg-1",
      participantIdentity: "user-1",
      speakerId: "user-1",
      speakerName: "Alice",
      text: "Let's add a user flow",
      source: "livekit",
      occurredAt: new Date(1000).toISOString(),
      timestamp: 1000,
      startTimeMs: 0,
      endTimeMs: 1000,
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

    acc.addTranscriptSegment({
      utteranceId: "utt-1",
      segmentId: "seg-1",
      participantIdentity: "u1",
      speakerId: "u1",
      speakerName: "A",
      text: "first",
      source: "livekit",
      occurredAt: new Date(1).toISOString(),
      timestamp: 1,
      startTimeMs: 0,
      endTimeMs: 1,
    });
    acc.addTranscriptSegment({
      utteranceId: "utt-2",
      segmentId: "seg-2",
      participantIdentity: "u1",
      speakerId: "u1",
      speakerName: "A",
      text: "second",
      source: "livekit",
      occurredAt: new Date(2).toISOString(),
      timestamp: 2,
      startTimeMs: 1,
      endTimeMs: 2,
    });
    acc.addTranscriptSegment({
      utteranceId: "utt-3",
      segmentId: "seg-3",
      participantIdentity: "u1",
      speakerId: "u1",
      speakerName: "A",
      text: "third",
      source: "livekit",
      occurredAt: new Date(3).toISOString(),
      timestamp: 3,
      startTimeMs: 2,
      endTimeMs: 3,
    });

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
      { type: "canvas.selection.changed", timestamp: 1000, data: { nodeIds: ["n1"] } },
      { type: "canvas.tool.changed", timestamp: 1001, data: { from: "selection", to: "rectangle" } },
    ]);

    const context = acc.buildContext();
    expect(context).toContain("canvas.selection.changed");
    expect(context).toContain("canvas.tool.changed");
  });

  it("tracks feedback for LLM context", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

    acc.addFeedback("user-1", "act-1", "rejected", "not what I wanted");

    const context = acc.buildContext();
    expect(context).toContain("rejected");
    expect(context).toContain("not what I wanted");
  });
});
