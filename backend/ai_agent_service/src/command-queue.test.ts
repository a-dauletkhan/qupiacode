import { describe, it, expect } from "vitest";
import { CommandQueue } from "./command-queue.js";
import type { QueueItem } from "./types.js";

function makeCommand(id: string, userName: string = "Test"): QueueItem {
  return {
    commandId: id,
    userId: "u1",
    userName,
    message: "test",
    source: "chat",
    queuedAt: Date.now(),
  };
}

describe("CommandQueue", () => {
  it("enqueues and dequeues in FIFO order", () => {
    const queue = new CommandQueue(10);
    queue.enqueue(makeCommand("cmd-1", "Alice"));
    queue.enqueue(makeCommand("cmd-2", "Bob"));

    expect(queue.size()).toBe(2);
    expect(queue.peek()?.commandId).toBe("cmd-1");

    const first = queue.dequeue();
    expect(first?.commandId).toBe("cmd-1");
    expect(queue.size()).toBe(1);

    const second = queue.dequeue();
    expect(second?.commandId).toBe("cmd-2");
    expect(queue.size()).toBe(0);
  });

  it("returns null when dequeuing empty queue", () => {
    const queue = new CommandQueue(10);
    expect(queue.dequeue()).toBeNull();
  });

  it("rejects when full", () => {
    const queue = new CommandQueue(2);
    queue.enqueue(makeCommand("cmd-1"));
    queue.enqueue(makeCommand("cmd-2"));

    expect(queue.isFull()).toBe(true);
    expect(() => queue.enqueue(makeCommand("cmd-3"))).toThrow("Queue full");
  });

  it("returns pending items for status endpoint", () => {
    const queue = new CommandQueue(10);
    queue.enqueue(makeCommand("cmd-1", "Alice"));
    queue.enqueue(makeCommand("cmd-2", "Bob"));

    const items = queue.items();
    expect(items).toHaveLength(2);
    expect(items[0].commandId).toBe("cmd-1");
  });
});
