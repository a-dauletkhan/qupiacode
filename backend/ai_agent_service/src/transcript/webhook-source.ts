import type { TranscriptEvent, TranscriptSource } from "./types.js";

export class WebhookTranscriptSource implements TranscriptSource {
  private handlers = new Map<string, (event: TranscriptEvent) => void>();

  subscribe(roomId: string, handler: (event: TranscriptEvent) => void): void {
    this.handlers.set(roomId, handler);
  }

  unsubscribe(roomId: string): void {
    this.handlers.delete(roomId);
  }

  handleEvent(event: TranscriptEvent): void {
    if (!event.is_final) return;
    const handler = this.handlers.get(event.room_id);
    if (handler) handler(event);
  }
}
