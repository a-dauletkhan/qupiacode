# AI Agent API Contract

> Backend-frontend contract for the AI agent integration.
> Frontend mocks this contract until backend endpoints are ready.

## Architecture Overview

```
Frontend (React)                         Backend
    |                                       |
    |--- @agent chat / canvas menu -------> POST /api/ai/rooms/:roomId/command
    |--- activity events (batched) -------> POST /api/ai/rooms/:roomId/events
    |--- approve/reject AI nodes ---------> POST /api/ai/rooms/:roomId/feedback
    |--- poll queue status ---------------> GET  /api/ai/rooms/:roomId/queue
    |                                       |
    |                                       |--- LLM call (Claude/OpenAI)
    |                                       |--- Decision Engine
    |                                       |
    |<-- AI nodes/edges via Liveblocks ---- |--- writes to Liveblocks storage
    |<-- AI chat via Liveblocks Comments -- |--- createComment/createThread
    |<-- AI presence via Liveblocks ------- |--- updatePresence
    |                                       |
```

---

## 1. Endpoints

### 1.1 `POST /api/ai/rooms/:roomId/command`

User sends an explicit command to the AI agent (from chat `@agent` or canvas context menu).

**Request:**
```json
{
  "userId": "user-uuid",
  "userName": "Alice",
  "message": "organize these nodes into a flowchart",
  "context": {
    "selectedNodeIds": ["node-1", "node-2", "node-3"],
    "selectedEdgeIds": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "source": "chat" | "canvas_context_menu"
  }
}
```

**Response `202 Accepted`:**
```json
{
  "commandId": "cmd-a1b2c3d4",
  "status": "queued",
  "position": 1,
  "estimatedWaitMs": 0
}
```

**Behavior:**
- Enqueues the command in the per-room FIFO queue.
- Bypasses the decision engine (direct commands always trigger the LLM).
- Returns immediately; the AI processes asynchronously.
- Results delivered via Liveblocks (canvas mutations + chat messages).

---

### 1.2 `POST /api/ai/rooms/:roomId/events`

Frontend sends batched user activity events for passive AI context.

**Request:**
```json
{
  "userId": "user-uuid",
  "events": [
    {
      "type": "node:selected",
      "timestamp": 1712300000000,
      "data": { "nodeIds": ["node-1"] }
    },
    {
      "type": "tool:switched",
      "timestamp": 1712300001000,
      "data": { "from": "selection", "to": "rectangle" }
    }
  ]
}
```

**Response `200 OK`:**
```json
{ "accepted": 2 }
```

**Event Types:**

| Event Type | `data` Schema | Description |
|---|---|---|
| `node:selected` | `{ nodeIds: string[] }` | User selected node(s) |
| `node:deselected` | `{}` | Selection cleared |
| `node:drag:start` | `{ nodeId: string }` | Drag began |
| `node:drag:end` | `{ nodeId: string, position: {x,y} }` | Drag ended |
| `text:edit:start` | `{ nodeId: string }` | Entered text editing |
| `text:edit:end` | `{ nodeId: string }` | Exited text editing |
| `tool:switched` | `{ from: ToolId, to: ToolId }` | Active tool changed |
| `undo` | `{}` | User pressed undo |
| `redo` | `{}` | User pressed redo |
| `copy` | `{ nodeIds: string[] }` | User copied nodes |
| `paste` | `{ nodeIds: string[] }` | User pasted nodes |
| `delete` | `{ nodeIds: string[], edgeIds: string[] }` | User deleted objects |
| `property:changed` | `{ nodeId: string, property: string, value: any }` | Style/content changed |
| `selection:changed` | `{ nodeIds: string[] }` | Multi-select changed |
| `edge:created` | `{ edgeId: string, source: string, target: string }` | New connection made |

**Behavior:**
- Events are fire-and-forget; frontend batches every 2-5 seconds.
- Backend feeds events into the `ContextAccumulator`.
- These do NOT trigger LLM calls directly; the `DecisionEngine` evaluation loop uses them as signal.

---

### 1.3 `POST /api/ai/rooms/:roomId/feedback`

User approves or rejects an AI-generated canvas object.

**Request:**
```json
{
  "userId": "user-uuid",
  "actionId": "act-x1y2z3",
  "nodeIds": ["ai-node-1", "ai-node-2"],
  "edgeIds": ["ai-edge-1"],
  "status": "approved" | "rejected",
  "reason": "not what I wanted"
}
```

**Response `200 OK`:**
```json
{
  "ok": true,
  "actionId": "act-x1y2z3",
  "status": "approved"
}
```

**Behavior:**
- **Approved:** Backend updates node metadata to remove pending state. Nodes become permanent.
- **Rejected:** Backend removes the AI-generated nodes/edges from Liveblocks storage. Rejection reason + context fed back to LLM as learning signal for the session.
- Feedback is added to the `ContextAccumulator` so the LLM adapts within the session.

---

### 1.4 `GET /api/ai/rooms/:roomId/queue`

Poll the current command queue and agent status.

**Response `200 OK`:**
```json
{
  "agentStatus": "idle" | "processing" | "acting",
  "currentCommand": {
    "commandId": "cmd-a1b2c3d4",
    "userId": "user-uuid",
    "userName": "Alice",
    "message": "organize these nodes",
    "startedAt": 1712300005000
  } | null,
  "queue": [
    {
      "commandId": "cmd-e5f6g7h8",
      "userId": "user-uuid-2",
      "userName": "Bob",
      "message": "add labels to all shapes",
      "queuedAt": 1712300006000,
      "position": 1
    }
  ],
  "recentActions": [
    {
      "actionId": "act-x1y2z3",
      "commandId": "cmd-prev",
      "type": "canvas_mutation",
      "nodeIds": ["ai-node-1"],
      "edgeIds": [],
      "status": "pending",
      "createdAt": 1712300003000
    }
  ]
}
```

---

## 2. AI Node Schema (via Liveblocks Storage)

AI-generated nodes are stored in the same Liveblocks `nodes` array but carry extra metadata in `data._ai`:

```typescript
// Standard node with AI metadata
{
  id: "ai-a1b2c3d4",          // prefix "ai-" for AI-generated
  type: "shape",               // same React Flow node types
  position: { x: 200, y: 300 },
  width: 150,
  height: 80,
  data: {
    objectType: "shape",
    shapeKind: "rectangle",
    content: { label: "User Auth" },
    style: { color: "oklch(0.768 0.233 130.85)", paintStyle: "solid", strokeWidth: 2 },
    zIndex: 10,

    // AI-specific metadata
    _ai: {
      actionId: "act-x1y2z3",
      commandId: "cmd-a1b2c3d4",       // which command triggered this (null for proactive)
      requestedBy: "user-uuid",         // who triggered (null for proactive)
      status: "pending",                // "pending" | "approved" | "rejected"
      createdAt: 1712300005000
    }
  }
}
```

**AI Edge schema:**
```typescript
{
  id: "ai-edge-a1b2c3d4",
  source: "node-1",
  target: "ai-a1b2c3d4",
  label: "connects to",
  data: {
    _ai: {
      actionId: "act-x1y2z3",
      commandId: "cmd-a1b2c3d4",
      requestedBy: "user-uuid",
      status: "pending",
      createdAt: 1712300005000
    }
  }
}
```

### Status Lifecycle

```
                    ┌──────────┐
                    │  pending  │  ← AI creates node
                    └─────┬────┘
                          │
               ┌──────────┴──────────┐
               │                     │
         ┌─────▼─────┐        ┌─────▼──────┐
         │  approved  │        │  rejected   │
         └───────────┘        └─────┬──────┘
              │                     │
              ▼                     ▼
        Node becomes          Node removed from
        permanent             Liveblocks storage
        (_ai metadata         + signal sent to LLM
         stays for audit)
```

---

## 3. Liveblocks Storage Additions

Current storage:
```typescript
{
  agentIntensity: "quiet" | "balanced" | "active"
}
```

No additional storage keys needed. AI nodes live in the existing `nodes`/`edges` arrays with `_ai` metadata. The frontend detects AI nodes by checking for the `_ai` field.

---

## 4. Liveblocks Presence (unchanged)

```typescript
// User presence
{ cursor: { x, y } | null, type: "user" }

// AI agent presence
{ cursor: null, type: "ai_agent", status: "watching" | "acting" }
```

---

## 5. Chat Integration

### AI Messages in Team Chat

AI writes to team chat via Liveblocks Comments API (already implemented). No new endpoints needed.

### User Commands via Chat

When a user types `@agent <message>` in team chat:
1. Frontend intercepts the message before creating the Liveblocks thread.
2. Frontend sends the command to `POST /api/ai/rooms/:roomId/command` with `source: "chat"`.
3. Frontend still creates the Liveblocks thread (so the message appears in chat).
4. AI responds via Liveblocks Comments API.

### User Commands via Canvas Context Menu

When a user right-clicks selected nodes and chooses "Ask AI":
1. Frontend shows a prompt input.
2. On submit, frontend sends to `POST /api/ai/rooms/:roomId/command` with `source: "canvas_context_menu"` and `selectedNodeIds`.
3. AI response appears as canvas mutations + chat explanation.

---

## 6. Request Queue (FIFO)

```
Per-room queue (in-memory on AI Agent Service)

  ┌─────────────────────────────────────────────────────┐
  │  Room: "board-123"                                  │
  │                                                     │
  │  Queue: [cmd-1, cmd-2, cmd-3]                       │
  │           ▲                                         │
  │           │ processing                              │
  │                                                     │
  │  Rules:                                             │
  │  - One command processed at a time                  │
  │  - Each gets fresh canvas snapshot before LLM call  │
  │  - Proactive evaluations paused while queue active  │
  │  - AI prefixes response: "Re: Alice's request..."   │
  │  - Max queue depth: 10 (reject with 429 if full)    │
  └─────────────────────────────────────────────────────┘
```

---

## 7. Backend Next Steps

### Phase 1: Wire existing gaps
- [ ] **Persist canvas mutations in `flush()`** — call Liveblocks HTTP API to write node/edge changes to storage (currently only logged)
- [ ] **Expose `handleDirectMessage` as a route** — add `POST /api/ai/rooms/:roomId/command`
- [ ] **Add `_ai` metadata to created nodes** — extend `ActionExecutor.handleCreateNode()` to include `_ai` field

### Phase 2: New endpoints
- [ ] **`POST /api/ai/rooms/:roomId/events`** — accept batched frontend events, feed to `ContextAccumulator`
- [ ] **`POST /api/ai/rooms/:roomId/feedback`** — handle approve/reject, update Liveblocks storage, feed to LLM context
- [ ] **`GET /api/ai/rooms/:roomId/queue`** — return queue state and recent actions

### Phase 3: Queue system
- [ ] **Add FIFO command queue** to `RoomManager` — process commands sequentially per room
- [ ] **Pause proactive evaluation** while queue is active
- [ ] **Attribution** — prefix AI responses with requester info
- [ ] **Queue depth limit** — cap at 10, return 429

### Phase 4: Feedback loop
- [ ] **On approve** — update node `_ai.status` to `"approved"` in Liveblocks storage
- [ ] **On reject** — remove nodes/edges from storage, add rejection to `ContextAccumulator` as LLM context
- [ ] **Session memory** — track approval/rejection patterns per room for LLM system prompt enrichment

---

## 8. Error Responses

All endpoints use standard HTTP status codes:

| Status | Meaning |
|---|---|
| `200` | Success |
| `202` | Command accepted and queued |
| `400` | Invalid request body |
| `401` | Missing or invalid auth token |
| `404` | Room not found / agent not active in room |
| `429` | Queue full (max 10 commands) |
| `500` | Internal server error |

Error body:
```json
{
  "error": "queue_full",
  "message": "AI agent queue for this room is full. Try again shortly.",
  "retryAfterMs": 5000
}
```

---

## 9. Authentication

All endpoints require the same JWT Bearer token used by existing canvas endpoints:

```
Authorization: Bearer <supabase-jwt>
```

The AI agent service validates tokens via the same Supabase JWT verification used in the canvas service.
