import type { QueuedCommand } from "./types.js";

export class CommandQueue {
  private queue: QueuedCommand[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  enqueue(command: QueuedCommand): void {
    if (this.queue.length >= this.maxSize) {
      throw new Error("Queue full");
    }
    this.queue.push(command);
  }

  dequeue(): QueuedCommand | null {
    return this.queue.shift() ?? null;
  }

  peek(): QueuedCommand | null {
    return this.queue[0] ?? null;
  }

  size(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  items(): QueuedCommand[] {
    return [...this.queue];
  }
}
