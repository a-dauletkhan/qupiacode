import type { Intensity } from "./types.js";

interface DecisionInput {
  hasDirectMention: boolean;
  timeSinceLastChange: number;
  timeSinceLastAction: number;
  changeCount: number;
  hasTranscriptActivity: boolean;
}

interface IntensityThresholds {
  silenceThreshold: number;
  cooldown: number;
  minChanges: number;
}

const THRESHOLDS: Record<Intensity, IntensityThresholds> = {
  quiet: {
    silenceThreshold: 15_000,
    cooldown: 30_000,
    minChanges: 2,
  },
  balanced: {
    silenceThreshold: 7_000,
    cooldown: 12_000,
    minChanges: 2,
  },
  active: {
    silenceThreshold: 3_000,
    cooldown: 5_000,
    minChanges: 1,
  },
};

export class DecisionEngine {
  private intensity: Intensity = "balanced";

  setIntensity(intensity: Intensity): void {
    this.intensity = intensity;
  }

  getIntensity(): Intensity {
    return this.intensity;
  }

  shouldAct(input: DecisionInput): boolean {
    if (input.hasDirectMention) return true;

    const thresholds = THRESHOLDS[this.intensity];

    if (input.timeSinceLastAction < thresholds.cooldown) return false;

    if (
      input.timeSinceLastChange >= thresholds.silenceThreshold &&
      input.changeCount >= thresholds.minChanges
    ) {
      return true;
    }

    if (
      this.intensity !== "quiet" &&
      input.hasTranscriptActivity &&
      input.changeCount >= thresholds.minChanges &&
      input.timeSinceLastChange >= thresholds.silenceThreshold
    ) {
      return true;
    }

    return false;
  }
}
