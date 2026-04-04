# AI Agent Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing AI agent service to support the frontend API contract — direct user commands, activity events, approve/reject feedback, and actual canvas persistence via Liveblocks.

**Architecture:** The AI agent service (`backend/ai_agent_service/`) is a Node.js Express app with a `RoomManager` that orchestrates per-room AI sessions. We add 4 new routes, a FIFO command queue, `_ai` metadata on created nodes, real Liveblocks storage writes in `flush()`, and a feedback loop that removes/updates nodes and informs the LLM.

**Tech Stack:** TypeScript, Express 5, Liveblocks Node SDK (`@liveblocks/node`), Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `AiMetadata`, command/event/feedback types |
| `src/command-queue.ts` | Create | Per-room FIFO command queue |
| `src/action-executor.ts` | Modify | Inject `_ai` metadata into created nodes/edges |
| `src/room-manager.ts` | Modify | Add `handleCommand()`, `handleFeedback()`, `handleEvents()`, queue integration, real Liveblocks writes in `flush()` |
| `src/context-accumulator.ts` | Modify | Add `addFeedback()` and `addUserEvents()` methods |
| `src/index.ts` | Modify | Add 4 new Express routes |
| `src/command-queue.test.ts` | Create | Tests for queue |
| `src/action-executor.test.ts` | Modify | Tests for `_ai` metadata injection |
| `src/context-accumulator.test.ts` | Modify | Tests for feedback + events |

---

### Task 1: Add Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add command, event, feedback, and metadata types**

Append to `src/types.ts`:

```typescript
// --- AI metadata attached to nodes/edges created by the agent ---

export type AiActionStatus = "pending" | "approved" | "rejected";

export interface AiMetadata {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  status: AiActionStatus;
  createdAt: number;
}

// --- Command (explicit user request) ---

export interface AiCommandRequest {
  userId: string;
  userName: string;
  message: string;
  context: {
    selectedNodeIds: string[];
    selectedEdgeIds: string[];
    viewport: { x: number; y: number; zoom: number };
    source: "chat" | "canvas_context_menu";
  };
}

export interface AiCommandResponse {
  commandId: string;
  status: "queued";
  position: number;
  estimatedWaitMs: number;
}

// --- Activity events (passive frontend tracking) ---

export interface AiActivityEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface AiEventsRequest {
  userId: string;
  events: AiActivityEvent[];
}

// --- Feedback (approve/reject) ---

export interface AiFeedbackRequest {
  userId: string;
  actionId: string;
  nodeIds: string[];
  edgeIds: string[];
  status: "approved" | "rejected";
  reason?: string;
}

// --- Queue item ---

export interface QueuedCommand {
  commandId: string;
  userId: string;
  userName: string;
  message: string;
  context: AiCommandRequest["context"];
  queuedAt: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat(ai-agent): add command, event, feedback, and metadata types"
```

---

### Task 2: Create Command Queue

**Files:**
- Create: `src/command-queue.ts`
- Create: `src/command-queue.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/command-queue.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { CommandQueue } from "./command-queue.js";
import type { QueuedCommand } from "./types.js";

describe("CommandQueue", () => {
  it("enqueues and dequeues in FIFO order", () => {
    const queue = new CommandQueue(10);

    queue.enqueue({
      commandId: "cmd-1",
      userId: "u1",
      userName: "Alice",
      message: "organize",
      context: { selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, source: "chat" },
      queuedAt: 1000,
    });
    queue.enqueue({
      commandId: "cmd-2",
      userId: "u2",
      userName: "Bob",
      message: "label",
      context: { selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, source: "chat" },
      queuedAt: 2000,
    });

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
    queue.enqueue({ commandId: "cmd-1", userId: "u1", userName: "A", message: "a", context: { selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, source: "chat" }, queuedAt: 1 });
    queue.enqueue({ commandId: "cmd-2", userId: "u1", userName: "A", message: "b", context: { selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, source: "chat" }, queuedAt: 2 });

    expect(queue.isFull()).toBe(true);
    expect(() =>
      queue.enqueue({ commandId: "cmd-3", userId: "u1", userName: "A", message: "c", context: { selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, source: "chat" }, queuedAt: 3 })
    ).toThrow("Queue full");
  });

  it("returns pending items for status endpoint", () => {
    const queue = new CommandQueue(10);
    queue.enqueue({ commandId: "cmd-1", userId: "u1", userName: "Alice", message: "x", context: { selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, source: "chat" }, queuedAt: 1 });
    queue.enqueue({ commandId: "cmd-2", userId: "u2", userName: "Bob", message: "y", context: { selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, source: "chat" }, queuedAt: 2 });

    const items = queue.items();
    expect(items).toHaveLength(2);
    expect(items[0].commandId).toBe("cmd-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/ai_agent_service && npx vitest run src/command-queue.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CommandQueue**

Create `src/command-queue.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/ai_agent_service && npx vitest run src/command-queue.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/command-queue.ts src/command-queue.test.ts
git commit -m "feat(ai-agent): add FIFO command queue with max depth"
```

---

### Task 3: Add `_ai` Metadata to ActionExecutor

**Files:**
- Modify: `src/action-executor.ts`
- Modify: `src/action-executor.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/action-executor.test.ts`:

```typescript
it("injects _ai metadata into created nodes", async () => {
  const storage = createMockStorage();
  const executor = new ActionExecutor(storage, {
    actionId: "act-001",
    commandId: "cmd-001",
    requestedBy: "user-1",
  });

  await executor.execute([{
    name: "createNode",
    arguments: { nodeType: "sticky_note", position: { x: 0, y: 0 }, text: "test" },
  }]);

  const node = Array.from(storage.nodes.values())[0];
  const data = node.data as Record<string, unknown>;
  const ai = data._ai as Record<string, unknown>;
  expect(ai.actionId).toBe("act-001");
  expect(ai.commandId).toBe("cmd-001");
  expect(ai.requestedBy).toBe("user-1");
  expect(ai.status).toBe("pending");
  expect(ai.createdAt).toBeTypeOf("number");
});

it("injects _ai metadata into created edges", async () => {
  const storage = createMockStorage();
  const executor = new ActionExecutor(storage, {
    actionId: "act-002",
    commandId: null,
    requestedBy: null,
  });

  await executor.execute([{
    name: "createEdge",
    arguments: { source: "n1", target: "n2", label: "test" },
  }]);

  const edge = Array.from(storage.edges.values())[0];
  const ai = edge._ai as Record<string, unknown>;
  expect(ai.actionId).toBe("act-002");
  expect(ai.status).toBe("pending");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/ai_agent_service && npx vitest run src/action-executor.test.ts`
Expected: FAIL — ActionExecutor constructor doesn't accept second arg

- [ ] **Step 3: Modify ActionExecutor to accept and inject `_ai` metadata**

Update `src/action-executor.ts`. The constructor takes an optional `aiContext`:

```typescript
import type { ToolCall } from "./llm/types.js";
import type { AiMetadata } from "./types.js";
import { randomUUID } from "node:crypto";

export interface StorageAdapter {
  setNode: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  setEdge: (id: string, data: Record<string, unknown>) => void;
  deleteEdge: (id: string) => void;
  sendMessage: (text: string) => void;
  getNodes: () => Array<{ id: string; position?: { x: number; y: number }; width?: number; height?: number }>;
}

export interface AiActionContext {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
}

export class ActionExecutor {
  private storage: StorageAdapter;
  private aiContext: AiActionContext | null;

  constructor(storage: StorageAdapter, aiContext?: AiActionContext) {
    this.storage = storage;
    this.aiContext = aiContext ?? null;
  }

  async execute(toolCalls: ToolCall[]): Promise<void> {
    for (const call of toolCalls) {
      this.executeOne(call);
    }
  }

  private buildAiMeta(): AiMetadata | null {
    if (!this.aiContext) return null;
    return {
      actionId: this.aiContext.actionId,
      commandId: this.aiContext.commandId,
      requestedBy: this.aiContext.requestedBy,
      status: "pending",
      createdAt: Date.now(),
    };
  }

  // ... rest of executeOne, handleCreateNode, etc. unchanged
  // EXCEPT: handleCreateNode and handleCreateEdge inject _ai into data
```

In `handleCreateNode`, after building `data`, add:

```typescript
    const aiMeta = this.buildAiMeta();
    if (aiMeta) {
      data._ai = aiMeta;
    }
```

In `handleCreateEdge`, change to:

```typescript
  private handleCreateEdge(args: Record<string, unknown>): void {
    const id = `agent-edge-${randomUUID().slice(0, 8)}`;
    const edgeData: Record<string, unknown> = {
      source: args.source,
      target: args.target,
      label: args.label ?? "",
    };
    const aiMeta = this.buildAiMeta();
    if (aiMeta) {
      edgeData._ai = aiMeta;
    }
    this.storage.setEdge(id, edgeData);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/ai_agent_service && npx vitest run src/action-executor.test.ts`
Expected: All tests PASS (existing tests still pass since `aiContext` is optional)

- [ ] **Step 5: Commit**

```bash
git add src/action-executor.ts src/action-executor.test.ts
git commit -m "feat(ai-agent): inject _ai metadata into AI-created nodes and edges"
```

---

### Task 4: Extend ContextAccumulator with Feedback and Events

**Files:**
- Modify: `src/context-accumulator.ts`
- Modify: `src/context-accumulator.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/context-accumulator.test.ts`:

```typescript
it("tracks user activity events", () => {
  const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

  acc.addUserEvents("user-1", [
    { type: "node:selected", timestamp: 1000, data: { nodeIds: ["n1"] } },
    { type: "tool:switched", timestamp: 1001, data: { from: "selection", to: "rectangle" } },
  ]);

  const context = acc.buildContext();
  expect(context).toContain("node:selected");
  expect(context).toContain("tool:switched");
});

it("tracks feedback for LLM context", () => {
  const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

  acc.addFeedback({
    actionId: "act-1",
    status: "rejected",
    reason: "not what I wanted",
    userId: "user-1",
  });

  const context = acc.buildContext();
  expect(context).toContain("rejected");
  expect(context).toContain("not what I wanted");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/ai_agent_service && npx vitest run src/context-accumulator.test.ts`
Expected: FAIL — `addUserEvents` and `addFeedback` not defined

- [ ] **Step 3: Implement addUserEvents and addFeedback**

Add to `src/context-accumulator.ts`:

```typescript
interface FeedbackEntry {
  actionId: string;
  status: "approved" | "rejected";
  reason?: string;
  userId: string;
  timestamp: number;
}

interface UserActivityEntry {
  userId: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}
```

Add fields to the class:

```typescript
  private feedback: FeedbackEntry[] = [];
  private userEvents: UserActivityEntry[] = [];
```

Add methods:

```typescript
  addFeedback(entry: Omit<FeedbackEntry, "timestamp">): void {
    this.feedback.push({ ...entry, timestamp: Date.now() });
    // Keep last 20
    if (this.feedback.length > 20) {
      this.feedback = this.feedback.slice(-20);
    }
  }

  addUserEvents(userId: string, events: Array<{ type: string; timestamp: number; data: Record<string, unknown> }>): void {
    for (const event of events) {
      this.userEvents.push({ userId, ...event });
    }
    // Keep last 50
    if (this.userEvents.length > 50) {
      this.userEvents = this.userEvents.slice(-50);
    }
  }
```

Add to `buildContext()` before the return:

```typescript
    // User activity
    if (this.userEvents.length > 0) {
      const eventLines = this.userEvents.slice(-10).map(
        (e) => `  - ${e.userId}: ${e.type} ${JSON.stringify(e.data)}`
      );
      sections.push(`## Recent User Activity\n${eventLines.join("\n")}`);
    }

    // Feedback history
    if (this.feedback.length > 0) {
      const feedbackLines = this.feedback.map(
        (f) => `  - ${f.actionId}: ${f.status}${f.reason ? ` (reason: ${f.reason})` : ""}`
      );
      sections.push(`## Feedback on AI Actions\n${feedbackLines.join("\n")}`);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/ai_agent_service && npx vitest run src/context-accumulator.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/context-accumulator.ts src/context-accumulator.test.ts
git commit -m "feat(ai-agent): add user events and feedback tracking to context accumulator"
```

---

### Task 5: Fix `flush()` to Persist Canvas Mutations via Liveblocks

**Files:**
- Modify: `src/room-manager.ts`

This is the critical gap — `createStorageAdapter().flush()` currently logs mutations but doesn't write them to Liveblocks. We'll use the Liveblocks REST API via the Node SDK's `sendYjsBinaryUpdate` is not needed — we use the Liveblocks `@liveblocks/node` `Liveblocks.initializeStorageDocument()` + room-level mutations. However, the simplest approach is to use the Liveblocks REST API to read the current storage, apply mutations, and write back.

Actually, the cleanest approach: use the Liveblocks client SDK (already used for presence) to also do storage mutations within the room.

- [ ] **Step 1: Refactor `createStorageAdapter` to use the Liveblocks client room**

In `src/room-manager.ts`, the `RoomSession` already has `presenceRoom` which is a Liveblocks client room. However, it doesn't have storage access because `enterRoom` was called without `initialStorage`. We need to use the Liveblocks **Node SDK** (`this.liveblocks`) instead.

Replace the `createStorageAdapter` method. The new approach uses the Liveblocks Node SDK's HTTP API to batch-apply mutations:

```typescript
  private createStorageAdapter(roomId: string, aiContext: AiActionContext): StorageAdapter & { flush(): Promise<void> } {
    const pendingNodeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingNodeDeletes: string[] = [];
    const pendingEdgeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingEdgeDeletes: string[] = [];
    const messageQueue: string[] = [];
    const liveblocks = this.liveblocks;

    return {
      getNodes: () => [],
      setNode(id: string, data: Record<string, unknown>) {
        pendingNodeSets.push({ id, data });
      },
      deleteNode(id: string) {
        pendingNodeDeletes.push(id);
      },
      setEdge(id: string, data: Record<string, unknown>) {
        pendingEdgeSets.push({ id, data });
      },
      deleteEdge(id: string) {
        pendingEdgeDeletes.push(id);
      },
      sendMessage(text: string) {
        messageQueue.push(text);
      },
      async flush() {
        // Apply canvas mutations via Liveblocks REST API
        if (pendingNodeSets.length > 0 || pendingNodeDeletes.length > 0 ||
            pendingEdgeSets.length > 0 || pendingEdgeDeletes.length > 0) {

          try {
            // Read current storage
            const storage = await liveblocks.getStorageDocument(roomId, "json");
            const root = (storage?.data ?? {}) as Record<string, unknown>;
            let nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
            let edges = (root.edges ?? []) as Array<Record<string, unknown>>;

            // Apply node sets (create or update)
            for (const { id, data } of pendingNodeSets) {
              const existing = nodes.findIndex((n) => n.id === id);
              if (existing >= 0) {
                nodes[existing] = { ...nodes[existing], ...data, id };
              } else {
                nodes.push({ id, ...data });
              }
            }

            // Apply node deletes
            nodes = nodes.filter((n) => !pendingNodeDeletes.includes(n.id as string));

            // Apply edge sets
            for (const { id, data } of pendingEdgeSets) {
              const existing = edges.findIndex((e) => e.id === id);
              if (existing >= 0) {
                edges[existing] = { ...edges[existing], ...data, id };
              } else {
                edges.push({ id, ...data });
              }
            }

            // Apply edge deletes
            edges = edges.filter((e) => !pendingEdgeDeletes.includes(e.id as string));

            // Write back via Liveblocks initialize (overwrites storage)
            await liveblocks.initializeStorageDocument(roomId, {
              liveblocksType: "LiveObject",
              data: {
                ...root,
                nodes: { liveblocksType: "LiveList", data: nodes },
                edges: { liveblocksType: "LiveList", data: edges },
              },
            });

            console.log(`Flushed mutations to Liveblocks for room ${roomId}:`, {
              nodeSets: pendingNodeSets.length,
              nodeDeletes: pendingNodeDeletes.length,
              edgeSets: pendingEdgeSets.length,
              edgeDeletes: pendingEdgeDeletes.length,
            });
          } catch (err) {
            console.error(`Failed to flush mutations for room ${roomId}:`, err);
          }
        }

        // Send chat messages via Liveblocks Comments API
        for (const text of messageQueue) {
          try {
            await liveblocks.createComment({
              roomId,
              threadId: "agent-thread",
              data: {
                userId: "ai-agent",
                body: {
                  version: 1 as const,
                  content: [{ type: "paragraph" as const, children: [{ text }] }],
                },
              },
            } as any);
          } catch {
            try {
              await liveblocks.createThread({
                roomId,
                data: {
                  userId: "ai-agent",
                  body: {
                    version: 1 as const,
                    content: [{ type: "paragraph" as const, children: [{ text }] }],
                  },
                  metadata: {},
                },
              } as any);
            } catch (err) {
              console.error("Failed to send agent message:", err);
            }
          }
        }
      },
    };
  }
```

- [ ] **Step 2: Update the `act()` method to pass `AiActionContext` to ActionExecutor**

In the `act()` method, generate an `actionId` and pass the context:

```typescript
  private async act(roomId: string, session: RoomSession, isDirect: boolean, commandId?: string, requestedBy?: string): Promise<void> {
    const actionId = `act-${randomUUID().slice(0, 8)}`;
    const context = session.accumulator.buildContext();

    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: isDirect
          ? `A user directly asked you to act. Here is the current context:\n\n${context}`
          : `Here is what's happening on the canvas. Decide if you should help, and if so, take action.\n\n${context}`,
      },
    ];

    session.presenceRoom?.updatePresence({ status: "acting" });

    try {
      const response = await this.llm.chat(messages, canvasTools);

      if (response.toolCalls.length > 0) {
        const aiContext: AiActionContext = { actionId, commandId: commandId ?? null, requestedBy: requestedBy ?? null };
        const adapter = this.createStorageAdapter(roomId, aiContext);
        const executor = new ActionExecutor(adapter, aiContext);
        await executor.execute(response.toolCalls);
        await adapter.flush();
      }

      if (response.text && !response.toolCalls.some((tc) => tc.name === "sendMessage")) {
        const adapter = this.createStorageAdapter(roomId, { actionId, commandId: commandId ?? null, requestedBy: requestedBy ?? null });
        adapter.sendMessage(response.text);
        await adapter.flush();
      }

      session.lastActionTime = Date.now();
      session.changeCount = 0;
    } catch (err) {
      console.error(`Action error in room ${roomId}:`, err);
    } finally {
      session.presenceRoom?.updatePresence({ status: "watching" });
    }
  }
```

Add `import { randomUUID } from "node:crypto";` at the top and `import type { AiActionContext } from "./action-executor.js";` as well.

- [ ] **Step 3: Commit**

```bash
git add src/room-manager.ts
git commit -m "feat(ai-agent): persist canvas mutations to Liveblocks storage in flush()"
```

---

### Task 6: Add Command Queue to RoomManager

**Files:**
- Modify: `src/room-manager.ts`

- [ ] **Step 1: Add queue to RoomSession and processing loop**

Add `CommandQueue` to imports and to `RoomSession`:

```typescript
import { CommandQueue } from "./command-queue.js";

interface RoomSession {
  // ... existing fields ...
  commandQueue: CommandQueue;
  processingCommand: boolean;
}
```

In `joinRoom()`, initialize the queue:

```typescript
    const session: RoomSession = {
      // ... existing fields ...
      commandQueue: new CommandQueue(10),
      processingCommand: false,
    };
```

- [ ] **Step 2: Add `handleCommand()` method**

```typescript
  async handleCommand(roomId: string, request: AiCommandRequest): Promise<AiCommandResponse> {
    const session = this.sessions.get(roomId);
    if (!session) {
      // Auto-join room if not active
      await this.joinRoom(roomId);
      return this.handleCommand(roomId, request);
    }

    const commandId = `cmd-${randomUUID().slice(0, 8)}`;
    const command: QueuedCommand = {
      commandId,
      userId: request.userId,
      userName: request.userName,
      message: request.message,
      context: request.context,
      queuedAt: Date.now(),
    };

    if (session.commandQueue.isFull()) {
      throw new Error("Queue full");
    }

    session.commandQueue.enqueue(command);

    // Start processing if not already running
    if (!session.processingCommand) {
      this.processQueue(roomId).catch((err) =>
        console.error(`Queue processing error in room ${roomId}:`, err)
      );
    }

    return {
      commandId,
      status: "queued",
      position: session.commandQueue.size(),
      estimatedWaitMs: session.commandQueue.size() * 5000,
    };
  }

  private async processQueue(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session || session.processingCommand) return;

    session.processingCommand = true;

    try {
      while (session.commandQueue.size() > 0) {
        const command = session.commandQueue.dequeue();
        if (!command) break;

        console.log(`Processing command ${command.commandId} from ${command.userName}: "${command.message}"`);

        // Sync canvas state before each command
        await this.syncCanvasState(roomId);

        // Add the command message to context
        session.accumulator.addTranscriptSegment({
          speakerId: command.userId,
          speakerName: command.userName,
          text: `[Command] ${command.message}`,
          timestamp: command.queuedAt,
        });

        await this.act(roomId, session, true, command.commandId, command.userId);
      }
    } finally {
      session.processingCommand = false;
    }
  }
```

- [ ] **Step 3: Add `handleEvents()` method**

```typescript
  handleEvents(roomId: string, userId: string, events: AiActivityEvent[]): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    session.accumulator.addUserEvents(userId, events);

    // Count events as changes for the decision engine
    session.lastChangeTime = Date.now();
    session.changeCount += events.length;
  }
```

- [ ] **Step 4: Add `handleFeedback()` method**

```typescript
  async handleFeedback(roomId: string, request: AiFeedbackRequest): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    // Track feedback in context accumulator for LLM learning
    session.accumulator.addFeedback({
      actionId: request.actionId,
      status: request.status,
      reason: request.reason,
      userId: request.userId,
    });

    if (request.status === "rejected") {
      // Remove rejected nodes/edges from Liveblocks storage
      try {
        const storage = await this.liveblocks.getStorageDocument(roomId, "json");
        const root = (storage?.data ?? {}) as Record<string, unknown>;
        let nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
        let edges = (root.edges ?? []) as Array<Record<string, unknown>>;

        nodes = nodes.filter((n) => !request.nodeIds.includes(n.id as string));
        edges = edges.filter((e) => !request.edgeIds.includes(e.id as string));

        await this.liveblocks.initializeStorageDocument(roomId, {
          liveblocksType: "LiveObject",
          data: {
            ...root,
            nodes: { liveblocksType: "LiveList", data: nodes },
            edges: { liveblocksType: "LiveList", data: edges },
          },
        });
      } catch (err) {
        console.error(`Failed to remove rejected nodes for room ${roomId}:`, err);
      }
    } else if (request.status === "approved") {
      // Update _ai.status to "approved" in Liveblocks storage
      try {
        const storage = await this.liveblocks.getStorageDocument(roomId, "json");
        const root = (storage?.data ?? {}) as Record<string, unknown>;
        const nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
        const edges = (root.edges ?? []) as Array<Record<string, unknown>>;

        for (const node of nodes) {
          if (request.nodeIds.includes(node.id as string)) {
            const data = node.data as Record<string, unknown> | undefined;
            const ai = data?._ai as Record<string, unknown> | undefined;
            if (ai) ai.status = "approved";
          }
        }

        for (const edge of edges) {
          if (request.edgeIds.includes(edge.id as string)) {
            const ai = edge._ai as Record<string, unknown> | undefined;
            if (ai) ai.status = "approved";
          }
        }

        await this.liveblocks.initializeStorageDocument(roomId, {
          liveblocksType: "LiveObject",
          data: {
            ...root,
            nodes: { liveblocksType: "LiveList", data: nodes },
            edges: { liveblocksType: "LiveList", data: edges },
          },
        });
      } catch (err) {
        console.error(`Failed to approve nodes for room ${roomId}:`, err);
      }
    }
  }
```

- [ ] **Step 5: Add `getQueueStatus()` method**

```typescript
  getQueueStatus(roomId: string) {
    const session = this.sessions.get(roomId);
    if (!session) {
      return { agentStatus: "idle" as const, currentCommand: null, queue: [], recentActions: [] };
    }

    return {
      agentStatus: session.processingCommand ? "processing" as const : "idle" as const,
      currentCommand: null, // Current command already dequeued during processing
      queue: session.commandQueue.items().map((q, i) => ({ ...q, position: i + 1 })),
      recentActions: [],
    };
  }
```

- [ ] **Step 6: Update `evaluate()` to skip when queue is active**

In the `evaluate()` method, add at the top:

```typescript
    // Skip proactive evaluation while processing commands
    if (session.processingCommand) return;
```

- [ ] **Step 7: Commit**

```bash
git add src/room-manager.ts
git commit -m "feat(ai-agent): add command queue, events, feedback, and queue status to RoomManager"
```

---

### Task 7: Add Express Routes

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add all 4 new routes**

Replace `src/index.ts`:

```typescript
import express from "express";
import { config } from "./config.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";
import { RoomManager } from "./room-manager.js";
import type { AiCommandRequest, AiEventsRequest, AiFeedbackRequest } from "./types.js";

const app = express();
app.use(express.json());

const transcriptSource = new WebhookTranscriptSource();
const roomManager = new RoomManager(transcriptSource);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Existing routes ---

app.post("/api/transcript", (req, res) => {
  transcriptSource.handleEvent(req.body);
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/join", async (req, res) => {
  await roomManager.joinRoom(req.params.roomId);
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/leave", async (req, res) => {
  await roomManager.leaveRoom(req.params.roomId);
  res.json({ ok: true });
});

app.post("/api/liveblocks/webhook", async (req, res) => {
  const event = req.body;

  if (event.type === "storageUpdated") {
    await roomManager.handleStorageChange(
      event.data.roomId,
      "storage updated",
      event.data.userId ?? "unknown"
    );
  } else if (event.type === "userEntered") {
    await roomManager.joinRoom(event.data.roomId);
  }

  res.json({ ok: true });
});

// --- New AI agent routes ---

app.post("/api/ai/rooms/:roomId/command", async (req, res) => {
  try {
    const request = req.body as AiCommandRequest;
    const result = await roomManager.handleCommand(req.params.roomId, request);
    res.status(202).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Queue full") {
      res.status(429).json({
        error: "queue_full",
        message: "AI agent queue for this room is full. Try again shortly.",
        retryAfterMs: 5000,
      });
      return;
    }
    console.error("Command error:", err);
    res.status(500).json({ error: "internal", message: "Failed to process command" });
  }
});

app.post("/api/ai/rooms/:roomId/events", (req, res) => {
  const { userId, events } = req.body as AiEventsRequest;
  roomManager.handleEvents(req.params.roomId, userId, events);
  res.json({ accepted: events.length });
});

app.post("/api/ai/rooms/:roomId/feedback", async (req, res) => {
  try {
    const request = req.body as AiFeedbackRequest;
    await roomManager.handleFeedback(req.params.roomId, request);
    res.json({ ok: true, actionId: request.actionId, status: request.status });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "internal", message: "Failed to process feedback" });
  }
});

app.get("/api/ai/rooms/:roomId/queue", (req, res) => {
  const status = roomManager.getQueueStatus(req.params.roomId);
  res.json(status);
});

app.listen(config.server.port, () => {
  console.log(`AI Agent Service running on port ${config.server.port}`);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat(ai-agent): add command, events, feedback, and queue routes"
```

---

### Task 8: Switch Frontend from Mock to Real Service

**Files:**
- Modify: `frontend/src/modules/Agent/services/event-batcher.ts`
- Modify: `frontend/src/modules/Agent/hooks/use-ai-mock-bridge.ts`

- [ ] **Step 1: Switch event-batcher import**

In `frontend/src/modules/Agent/services/event-batcher.ts`, change:

```typescript
import * as aiAgent from "./ai-agent-mock" // swap to ai-agent-service for prod
```

to:

```typescript
import * as aiAgent from "./ai-agent-service"
```

- [ ] **Step 2: Remove or disable mock bridge**

In `frontend/src/modules/Canvas/components/canvas/flow-canvas/index.tsx`, the `useAiMockBridge` hook is no longer needed — Liveblocks will deliver AI node updates automatically. Comment out or remove:

```typescript
// useAiMockBridge({ onNodesChange })  // Not needed with real backend
```

The AI chat messages will now come from Liveblocks Comments API, so `useAiChatMessages` can be kept as a fallback but the primary source becomes Liveblocks threads.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/Agent/services/event-batcher.ts
git add frontend/src/modules/Canvas/components/canvas/flow-canvas/index.tsx
git commit -m "feat(frontend): switch AI agent from mock to real backend service"
```

---

### Task 9: Run Full Test Suite

- [ ] **Step 1: Run all backend tests**

```bash
cd backend/ai_agent_service && npx vitest run
```

Expected: All tests pass

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && npx tsc --noEmit && npx vite build
```

Expected: 0 type errors, build succeeds

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify all tests pass after AI agent backend integration"
```
