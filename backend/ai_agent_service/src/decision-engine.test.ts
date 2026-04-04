import { describe, it, expect, vi, beforeEach } from "vitest";
import { DecisionEngine } from "./decision-engine.js";
import type { Intensity } from "./types.js";

describe("DecisionEngine", () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  it("always triggers on direct mention regardless of intensity", () => {
    engine.setIntensity("quiet");
    const result = engine.shouldAct({
      hasDirectMention: true,
      timeSinceLastChange: 0,
      timeSinceLastAction: 0,
      changeCount: 0,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(true);
  });

  it("quiet mode triggers on long silence after changes", () => {
    engine.setIntensity("quiet");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 20_000,
      timeSinceLastAction: 30_000,
      changeCount: 3,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(true);
  });

  it("quiet mode does not trigger on recent activity", () => {
    engine.setIntensity("quiet");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 2000,
      timeSinceLastAction: 5000,
      changeCount: 1,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(false);
  });

  it("balanced mode triggers on moderate pause with changes", () => {
    engine.setIntensity("balanced");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 8000,
      timeSinceLastAction: 15_000,
      changeCount: 3,
      hasTranscriptActivity: true,
    });
    expect(result).toBe(true);
  });

  it("active mode triggers on any change with short cooldown", () => {
    engine.setIntensity("active");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 3000,
      timeSinceLastAction: 10_000,
      changeCount: 1,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(true);
  });

  it("active mode respects minimum cooldown", () => {
    engine.setIntensity("active");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 1000,
      timeSinceLastAction: 2000,
      changeCount: 1,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(false);
  });
});
