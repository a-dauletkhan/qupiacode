import type { QueueItem } from "./types.js";

export class CommandQueue {
  private queue: QueueItem[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  enqueue(command: QueueItem): void {
    if (this.queue.length >= this.maxSize) {
      throw new Error("Queue full");
    }
    this.queue.push(command);
  }

  dequeue(): QueueItem | null {
    return this.queue.shift() ?? null;
  }

  peek(): QueueItem | null {
    return this.queue[0] ?? null;
  }

  size(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  items(): QueueItem[] {
    return [...this.queue];
  }
}
