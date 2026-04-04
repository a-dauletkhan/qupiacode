import { describe, it, expect, vi } from "vitest";
import { WebhookTranscriptSource } from "../webhook-source.js";
import type { TranscriptEvent } from "../types.js";

describe("WebhookTranscriptSource", () => {
  it("dispatches events to subscribed room handlers", () => {
    const source = new WebhookTranscriptSource();
    const handler = vi.fn();

    source.subscribe("room-1", handler);

    const event: TranscriptEvent = {
      room_id: "room-1",
      speaker_id: "user-1",
      speaker_name: "Alice",
      text: "hello world",
      timestamp: Date.now(),
      is_final: true,
    };

    source.handleEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("ignores events for non-final transcripts", () => {
    const source = new WebhookTranscriptSource();
    const handler = vi.fn();

    source.subscribe("room-1", handler);

    source.handleEvent({
      room_id: "room-1",
      speaker_id: "user-1",
      speaker_name: "Alice",
      text: "hel",
      timestamp: Date.now(),
      is_final: false,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not dispatch after unsubscribe", () => {
    const source = new WebhookTranscriptSource();
    const handler = vi.fn();

    source.subscribe("room-1", handler);
    source.unsubscribe("room-1");

    source.handleEvent({
      room_id: "room-1",
      speaker_id: "user-1",
      speaker_name: "Alice",
      text: "hello",
      timestamp: Date.now(),
      is_final: true,
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
