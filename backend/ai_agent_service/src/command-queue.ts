import type { QueueItem } from "./types.js";

export class CommandQueue {
  private readonly maxSize: number;
  private readonly queue: QueueItem[] = [];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  enqueue(item: QueueItem): void {
    if (this.isFull()) {
      throw new Error("Queue full");
    }
    this.queue.push(item);
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
