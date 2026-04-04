# AI Canvas Agent Design

## Overview

A proactive AI agent that participates in collaborative canvas sessions as a Liveblocks room participant. The agent observes canvas changes and voice call transcripts, then acts by creating/updating/deleting canvas items and posting chat messages. Users control the agent's participation intensity (quiet/balanced/active).

## Architecture

### Services

Three services total:

1. **API Service** (Python/FastAPI) — auth (Supabase JWT), board/room management, Liveblocks token issuance
2. **AI Agent Service** (Node.js) — joins Liveblocks rooms via `@liveblocks/node`, LLM-powered decision-making and canvas manipulation
3. **Voice Call Service** (Python/FastAPI) — LiveKit token issuance (existing, unchanged)

### Data Layer

Liveblocks is the single source of truth for all canvas data. No PostgreSQL for nodes/edges. The previous canvas_service persistence layer (canvas_objects module, collaboration module, Redis pub/sub) is removed.

The API service retains a slim database for board metadata and membership only.

### System Diagram

```
Frontend (React)
├── Canvas (React Flow + Liveblocks Flow)
├── Chat Panel (Liveblocks Comments)
└── Voice Call (LiveKit client)
        │              │                │
   Liveblocks     Liveblocks         LiveKit
   Storage        Comments           WebRTC
        │              │                │
   Liveblocks Cloud    │                │
   (single source      │                │
    of truth)          │                │
        │              │                │
   AI Agent Service ◄──┘                │
   (Node.js)                            │
        ▲                               │
        │ TranscriptSource interface     │
        │                               │
   LiveKit Transcript Service ◄─────────┘
   (teammate, in progress)

API Service (FastAPI)
├── Supabase auth
├── Board/room management
└── Liveblocks token generation
```

## AI Agent Service

### Module Breakdown

#### 1. Room Manager

Manages the agent's lifecycle in Liveblocks rooms.

- Uses `@liveblocks/node` to join and leave rooms
- Subscribes to storage change events (node/edge CRUD)
- Maintains agent presence:
  ```typescript
  {
    type: "ai_agent",
    status: "watching" | "acting",
    intensity: "quiet" | "balanced" | "active"
  }
  ```
- One agent instance per active room
- Spins up via Liveblocks webhook (`RoomCreated` / `UserEntered` events) or when the API service notifies the agent that a board session has started
- Shuts down when the room is empty (`RoomDeleted` / last `UserLeft` event)

#### 2. Context Accumulator

Builds a rolling context window for the LLM to reason over.

Inputs:
- **Canvas snapshot** — current nodes, edges, positions, and data from Liveblocks storage
- **Recent changes** — sliding window of the last N storage mutations (who changed what, when)
- **Transcript buffer** — rolling window of recent speech segments
- **Chat history** — recent messages from Liveblocks Comments

The accumulator compresses older context and keeps recent context detailed to stay within LLM token limits.

#### 3. Decision Engine (Intensity Controller)

Decides when the agent should act based on the configured intensity level.

| Intensity | Trigger Conditions |
|-----------|-------------------|
| **Quiet** | Direct @agent mentions, long silences (>15s) after significant canvas changes |
| **Balanced** | Pattern recognition (grouping, repeated actions), topic shifts in conversation, moderate pauses |
| **Active** | Frequent suggestions after most changes, proactive organization, comments on discussion points |

Each evaluation uses heuristics combined with a lightweight LLM call to decide: "should I intervene now, and if so, what should I do?"

#### 4. Action Executor

Translates LLM tool-call outputs into Liveblocks storage operations.

Available actions:
- `createNode(type, position, data)` — add shape, text, or sticky note to storage
- `updateNode(id, changes)` — modify position, size, content, style
- `deleteNode(id)` — remove node from storage
- `createEdge(source, target, data)` — connect nodes
- `deleteEdge(id)` — remove edge
- `sendMessage(text)` — post to Liveblocks Comments
- `groupNodes(ids, label)` — create a visual group
- `rearrangeNodes(ids, layout)` — reposition nodes (grid, cluster, etc.)

The executor validates actions before executing (e.g., target node exists, position within canvas bounds).

#### 5. LLM Provider Router

Abstracts the LLM behind a swappable interface:

```typescript
interface LLMProvider {
  chat(messages: Message[], tools: Tool[]): Promise<LLMResponse>
  stream(messages: Message[], tools: Tool[]): AsyncIterator<LLMChunk>
}
```

Concrete implementations for Claude (Anthropic API) and OpenAI. Configuration selects which provider and model to use. The agent uses tool-calling mode — the LLM receives canvas context and available actions as tools, and returns structured tool calls.

## Transcript Input Interface

The agent consumes transcript events through an abstracted interface, decoupled from the transport mechanism.

### Event Schema

```typescript
interface TranscriptEvent {
  room_id: string
  speaker_id: string
  speaker_name: string
  text: string
  timestamp: number
  is_final: boolean
}
```

### Source Abstraction

```typescript
interface TranscriptSource {
  subscribe(roomId: string, handler: (event: TranscriptEvent) => void): void
  unsubscribe(roomId: string): void
}
```

The teammate building the LiveKit transcription service implements a concrete `TranscriptSource` using their chosen transport (SSE, Redis Streams, Kafka, etc.). The agent only processes events where `is_final: true` to avoid reacting to partial speech.

## Data Flow Examples

### User draws a shape, agent reacts

1. User creates a rectangle on canvas
2. Liveblocks Flow writes node to room storage (CRDT)
3. Agent's Room Manager receives storage change event
4. Context Accumulator updates canvas snapshot + recent changes
5. Decision Engine evaluates based on intensity setting
6. If acting: LLM receives context, returns tool calls
7. Action Executor writes new nodes/edges to Liveblocks storage
8. Agent posts explanation in Liveblocks Comments
9. All users see changes + message in real-time

### Users discuss on voice call, agent suggests

1. Users talk: "we need to split this into three services"
2. Transcript Service sends TranscriptEvent to agent
3. Context Accumulator appends to transcript buffer
4. Decision Engine detects actionable intent
5. LLM receives canvas snapshot + transcript + recent changes
6. LLM returns tool calls to create shapes, edges, and a chat message
7. Action Executor writes all to Liveblocks storage
8. Users see shapes appear + explanatory chat message

### User sends chat command

1. User posts: "organize these sticky notes by theme"
2. Agent receives comment via Liveblocks room subscription
3. Direct request — bypasses Decision Engine
4. LLM receives all sticky notes + instruction
5. LLM returns rearrangeNodes + label updates
6. Action Executor moves nodes in storage
7. Agent posts summary: "Grouped into 3 themes: UX, Backend, Infrastructure"

## Frontend Changes

### Agent Presence on Canvas

- Distinguish agent from users via presence `type: "ai_agent"`
- Render agent with an AI avatar/badge instead of a cursor
- Show agent status indicator: thinking, acting, or idle
- No cursor rendered for the agent

### Chat Panel

- Replace current mock chat with Liveblocks Comments (`useThreads`, `useCreateComment`)
- Agent messages styled distinctly (existing lime-500 pattern)
- Agent posts explanations when it modifies the canvas

### Intensity Control

- 3-position toggle: Quiet / Balanced / Active
- Stored in Liveblocks room storage (visible to all participants)
- Agent subscribes to this value and adjusts Decision Engine behavior
- Default: Balanced

### Canvas Service Cleanup

**Remove:**
- `canvas_objects` module (models, CRUD endpoints)
- `collaboration` module (WebSocket, Redis pub/sub, connection manager, events)
- Redis dependency

**Keep:**
- `auth` module (Supabase JWT verification)
- `boards` module (slimmed to room management)

**Add:**
- Liveblocks token endpoint — backend generates session tokens using secret key, frontend authenticates with them

## Scope

### In Scope
- AI Agent Service (Node.js) with all 5 modules
- LLM provider abstraction (Claude + OpenAI implementations)
- Liveblocks room participation and canvas manipulation
- Transcript input interface (abstracted, transport-agnostic)
- Frontend: agent presence, Liveblocks Comments chat, intensity control
- Backend: slim down canvas_service, add Liveblocks token endpoint

### Out of Scope
- Event replay / session recording (deferred)
- Text-to-speech / agent speaking on voice call
- LiveKit transcription implementation (teammate's responsibility)
- Specific transport choice for transcript delivery
