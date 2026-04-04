# AI Agent Frontend Integration Design

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Frontend event-driven AI agent integration with approve/reject UX

---

## Problem

The AI agent backend exists (context accumulator, decision engine, LLM tools, action executor) but the frontend has no way to:
1. Send explicit commands to the AI (from chat or canvas context menu)
2. Stream user activity events for proactive AI context
3. Display AI-generated canvas objects with pending/approve/reject UX
4. Send approval feedback back to the AI

## Decisions Made

- **Explicit commands:** via `@agent` in team chat + right-click canvas context menu
- **Passive tracking:** medium level (selections, tool switches, undo/redo, copy/paste, deletes, property changes)
- **AI canvas mutations:** appear with pending visual style + AI badge + approve/reject buttons
- **AI chat messages:** posted automatically, no gate needed
- **Multi-user commands:** FIFO queue per room, processed sequentially
- **Canvas schema awareness:** AI always gets full canvas snapshot (nodes + edges + types + positions)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend                                                │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ EventBatcher │  │ AiCommand    │  │ AiFeedback     │  │
│  │ (3s batch)   │  │ Service      │  │ Service        │  │
│  │              │  │              │  │                │  │
│  │ push() ──────►  sendCommand()─►  sendFeedback()──►  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬─────────┘  │
│         │ POST /events    │ POST /command   │ POST /feedback
│         ▼                 ▼                 ▼             │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Backend (or Mock)                                │   │
│  └───────────────────────────┬───────────────────────┘   │
│                              │                           │
│                              │ Liveblocks storage        │
│                              ▼                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Liveblocks CRDT                                  │   │
│  │  nodes[] ← includes AI nodes with _ai metadata   │   │
│  │  edges[] ← includes AI edges with _ai metadata   │   │
│  └───────────────────────────┬───────────────────────┘   │
│                              │                           │
│                              ▼                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Canvas renders AI nodes with:                    │   │
│  │  • Dashed border + AI badge on corner             │   │
│  │  • Approve / Reject action bar                    │   │
│  │  • Slightly different visual treatment            │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Frontend Components

### 1. AI Node Wrapper

Wraps every canvas node that has `data._ai` metadata. Adds visual overlay.

```
┌──────────────────────────────┐
│                         [AI] │  ← badge top-right corner
│                              │
│     (normal node content)    │     dashed lime border
│                              │     slightly translucent bg
│  [✓ Approve]  [✗ Reject]    │  ← floating action bar below
└──────────────────────────────┘
```

- **Pending state:** dashed border, 80% opacity, AI badge visible, action bar visible
- **Approved state:** solid border, full opacity, AI badge stays (small, subtle), action bar removed
- **Rejected state:** node removed from canvas (handled by backend via Liveblocks)

**Style tokens:**
- Border: `border-dashed border-lime-500/50`
- Badge: `bg-lime-500/15 text-lime-600 text-[10px]`
- Action bar: positioned below node, `bg-card border shadow-sm`

### 2. Chat AI Command Integration

Modify existing `Chat.tsx` to detect `@agent` prefix:

```
User types: "@agent organize these into a flowchart"
                │
                ▼
  1. Parse: message starts with "@agent"
  2. Extract command text: "organize these into a flowchart"
  3. Call sendCommand() with current selection context
  4. Still post the message to Liveblocks thread (for visibility)
  5. AI response appears as agent-type message in chat
```

### 3. Canvas Context Menu

Add "Ask AI" option to the right-click context menu when nodes are selected:

```
  ┌─────────────────────┐
  │  Copy           ⌘C  │
  │  Paste          ⌘V  │
  │  Delete         ⌫   │
  │  ─────────────────  │
  │  🤖 Ask AI...       │  ← opens inline prompt input
  └─────────────────────┘
              │
              ▼
  ┌───────────────────────────────┐
  │  What should AI do with       │
  │  these 3 selected nodes?      │
  │  ┌─────────────────────────┐  │
  │  │ Type your request...    │  │
  │  └─────────────────────────┘  │
  │           [Send to AI]        │
  └───────────────────────────────┘
```

### 4. Event Batcher Hook

React hook that creates and manages the event batcher lifecycle:

```typescript
useAiEventBatcher(roomId, userId)
  → creates EventBatcher on mount
  → exposes push() for canvas event handlers
  → destroys on unmount
```

Canvas event handlers call `batcher.push()` for:
- `onSelectionChange` → `node:selected` / `node:deselected`
- `onNodeDragStop` → `node:drag:end`
- `onNodesDelete` → `delete`
- Tool bar clicks → `tool:switched`
- Undo/redo keyboard shortcuts → `undo` / `redo`

### 5. AI Queue Status Indicator

Small indicator near the AgentPresence component showing queue state:

```
  ┌──────────────────────────────────────┐
  │  🤖 AI Agent  acting...  │ Queue: 2  │
  └──────────────────────────────────────┘
```

---

## Data Flow: Command Lifecycle

```
1. User sends "@agent organize these"
        │
        ▼
2. Frontend: sendCommand(roomId, { message, selectedNodeIds, source: "chat" })
        │
        ▼
3. Backend: enqueues command, returns { commandId, position }
        │
        ▼
4. Backend: dequeues, reads canvas via Liveblocks, calls LLM
        │
        ▼
5. LLM returns tool calls: createNode("Grouped Ideas", ...), sendMessage(...)
        │
        ▼
6. Backend: executes tools → writes to Liveblocks storage with _ai metadata
        │
        ▼
7. Frontend: Liveblocks auto-syncs → new node appears with _ai.status="pending"
        │
        ▼
8. Frontend: AI node wrapper renders dashed border + badge + approve/reject
        │
        ▼
9. User clicks [✓ Approve]
        │
        ▼
10. Frontend: sendFeedback(roomId, { actionId, status: "approved" })
        │
        ▼
11. Backend: updates _ai.status in Liveblocks → node becomes permanent
        │
        ▼
12. Frontend: Liveblocks syncs → node now renders with normal style
```

---

## Data Flow: Proactive AI (no explicit command)

```
1. Users edit canvas + talk on voice call
        │
        ▼
2. Frontend: EventBatcher pushes activity events every 3s
   Backend: receives transcripts via LiveKit webhook
        │
        ▼
3. Backend: DecisionEngine evaluates every 3s
   (enough silence + enough changes + cooldown passed?)
        │
        ▼
4. If shouldAct=true → LLM called with full canvas + transcript context
        │
        ▼
5. Same flow as steps 6-12 above
   (_ai.commandId = null, _ai.requestedBy = null for proactive actions)
```

---

## Files to Create / Modify

### New files:
| File | Purpose |
|---|---|
| `Agent/types.ts` | TypeScript types for all AI agent contracts |
| `Agent/services/ai-agent-service.ts` | Real backend API client |
| `Agent/services/ai-agent-mock.ts` | Mock backend for dev |
| `Agent/services/event-batcher.ts` | Batched event sender |
| `Agent/utils/ai-node-helpers.ts` | isAiNode, getAiMeta, groupByAction |
| `Agent/components/ai-node-wrapper.tsx` | Visual overlay for AI nodes |
| `Agent/components/ai-action-bar.tsx` | Approve/reject buttons |
| `Agent/components/ai-badge.tsx` | Corner badge for AI nodes |
| `Agent/components/ai-prompt-input.tsx` | Inline prompt for context menu |
| `Agent/components/ai-queue-status.tsx` | Queue indicator |
| `Agent/hooks/use-ai-event-batcher.ts` | Hook for event batcher lifecycle |
| `Agent/hooks/use-ai-command.ts` | Hook for sending commands |
| `Agent/hooks/use-ai-feedback.ts` | Hook for approve/reject |

### Modified files:
| File | Change |
|---|---|
| `Chat/components/Chat.tsx` | Detect `@agent` prefix, route to command service |
| `Canvas/components/canvas/flow-canvas/index.tsx` | Wire event batcher, render AI node wrappers |
| `Canvas/components/canvas/primitives/schema.ts` | Add `_ai` to node data type |
| `Canvas/components/canvas/room.tsx` | No changes needed (Liveblocks handles sync) |

---

## Mock Behavior Summary

During development, `ai-agent-mock.ts` simulates:

| Endpoint | Mock behavior |
|---|---|
| `POST /command` | Queues command, after 2s dispatches `ai-agent:action` CustomEvent with mock nodes |
| `POST /events` | Logs to console, returns `{ accepted: N }` |
| `POST /feedback` | Updates internal mock state, logs to console |
| `GET /queue` | Returns current mock queue state |

The mock dispatches `ai-agent:action` CustomEvent that the frontend hooks listen to. This simulates what Liveblocks would deliver in production (new nodes appearing with `_ai` metadata).

---

## Open Questions for Backend Team

1. Should `flush()` use Liveblocks HTTP API (`sendYjsUpdate`) or Liveblocks client SDK (`room.batch()`)?
2. How to handle `_ai.status` updates — direct Liveblocks storage mutation or via a dedicated endpoint?
3. Should the queue persist across AI agent service restarts (Redis) or is in-memory OK?
4. Rate limiting on `/events` endpoint — should backend enforce max events per batch?
