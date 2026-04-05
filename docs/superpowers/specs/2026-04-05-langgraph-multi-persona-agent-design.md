# LangGraph Multi-Persona AI Agent Design

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Replace the existing AI agent service internals with a LangGraph StateGraph supporting multi-persona routing, pipeline execution, and Redis-checkpointed human-in-the-loop approval.

---

## Problem

The current AI agent is a single-personality assistant. Creative manager teams need domain-specific personas (Designer, Critique, Marketing) that respond from their expertise, can be explicitly invoked or auto-detected, and can run in multi-step pipelines where each persona contributes sequentially with user approval gates between steps.

## Decisions

- **Full LangGraph (Option B)** — LangGraph replaces RoomManager, CommandQueue, ContextAccumulator, and DecisionEngine. Express routes stay as the API layer.
- **Multi-persona routing** — auto by context, direct via `@designer`/`@critique`/`@marketing`, or pipeline for complex requests.
- **Pipeline with gates** — Designer creates → user approves → Critique reviews → user approves → Marketing adds copy. Each step paused via `interrupt()`.
- **Redis checkpointer** — graph state survives restart, works cross-laptop.
- **Personas in YAML config** — backend team edits `personas.yaml`, no code changes for prompt tweaks or new personas.
- **No session memory** — each session starts fresh. No cross-session persona memory.
- **Approve/reject only** — personas never modify existing user nodes. All output is new nodes with `_ai` metadata going through the existing approve/reject flow.
- **Frontend changes minimal** — same API contract, extend `@agent` to accept `@designer`/`@critique`/`@marketing`, AI badge shows persona name + color.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  ai_agent_service (Node.js + @langchain/langgraph)              │
│                                                                 │
│  Express routes (same API contract — frontend unchanged)        │
│  ┌────────────┬────────────┬─────────────┬──────────────┐       │
│  │ /command   │ /events    │ /feedback   │ /queue       │       │
│  └─────┬──────┴─────┬──────┴──────┬──────┴──────┬───────┘       │
│        │            │             │             │               │
│        ▼            ▼             ▼             ▼               │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  LangGraph StateGraph                                │       │
│  │                                                      │       │
│  │  ENTRY ─► ROUTER ─► PERSONA ─► EXECUTE ─► HUMAN GATE│       │
│  │                        ▲                     │       │       │
│  │                        │              ┌──────┴─────┐ │       │
│  │                        │              │ approved?  │ │       │
│  │                        │              └──┬──────┬──┘ │       │
│  │                        └── reject ───────┘      │    │       │
│  │                                          approve│    │       │
│  │                                                 ▼    │       │
│  │                                          NEXT STEP?  │       │
│  │                                          │      │    │       │
│  │                                        more   done   │       │
│  │                                        steps   │     │       │
│  │                                          │    END    │       │
│  │                                      (loop back)     │       │
│  │                                                      │       │
│  │  Checkpointer: Redis (ioredis)                       │       │
│  └──────────────────────────────────────────────────────┘       │
│        │                                                        │
│  ┌─────┴──────────────┐    ┌──────────────────────┐             │
│  │  ActionExecutor    │    │  Liveblocks Node SDK │             │
│  │  (unchanged)       │    │  (canvas + chat)     │             │
│  └────────────────────┘    └──────────────────────┘             │
│                                                                 │
│  Config: personas.yaml                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Graph State

```typescript
interface AgentState {
  roomId: string

  // Input
  command: {
    userId: string
    userName: string
    message: string
    source: "chat" | "canvas_context_menu"
    selectedNodeIds: string[]
  } | null
  canvasSnapshot: { nodes: CanvasNode[]; edges: CanvasEdge[] }
  transcript: TranscriptSegment[]
  userEvents: AiActivityEvent[]

  // Routing
  mode: "auto" | "pipeline" | "direct"
  targetPersona: string | null

  // Pipeline tracking
  pipelineSteps: string[]
  currentStep: number

  // Per-persona output
  pendingActions: Array<{
    persona: string
    actionId: string
    toolCalls: ToolCall[]
    chatMessage: string | null
  }>

  // Feedback
  lastFeedback: {
    actionId: string
    status: "approved" | "rejected"
    reason?: string
  } | null

  // Control
  done: boolean
}
```

---

## Graph Nodes

### ENTRY (gather-context)
- Reads current canvas state from Liveblocks via `getStorageDocument()`
- Reads recent transcript segments from shared Redis context
- Reads buffered user activity events from Redis
- Populates `canvasSnapshot`, `transcript`, `userEvents` in state

### ROUTER
Priority order (first match wins):
1. Checks `command.message` for direct mentions (`@designer`, `@critique`, `@marketing`)
   - Found → `mode: "direct"`, `targetPersona: matched name`
2. Checks for pipeline triggers from `personas.yaml` pipelines config
   - Found → `mode: "pipeline"`, `pipelineSteps: ["designer", "critique", "marketing"]`, `currentStep: 0`
3. Otherwise → `mode: "auto"`, analyzes keywords in command + canvas context to pick best persona. If no keywords match, defaults to Designer.
- Sets `targetPersona` for the current step

### PERSONA (LLM call)
- Loads persona config from `personas.yaml` by `targetPersona`
- Builds system prompt from persona's `system_prompt`
- Filters available tools to persona's `tools` list
- Calls LLM via existing provider-router (Claude/OpenAI)
- Stores result in `pendingActions`

### EXECUTE (action executor + flush)
- Generates `actionId`
- Runs ActionExecutor with `AiActionContext` including `persona` and `personaColor`
- Flushes to Liveblocks storage (nodes with `_ai` metadata)
- Sends chat message via Liveblocks Comments API
- The `_ai` metadata includes `persona` and `personaColor` fields

### HUMAN GATE
- Calls LangGraph `interrupt()` — graph pauses
- State serialized to Redis checkpointer
- Frontend sees AI nodes with approve/reject buttons
- Graph resumes when `POST /feedback` invokes the graph with feedback

### HANDLE FEEDBACK
- Reads `lastFeedback` from state
- **Approved:** updates `_ai.status` to `"approved"` in Liveblocks, checks if pipeline has more steps
- **Rejected:** removes nodes/edges from Liveblocks, optionally cycles back to PERSONA with rejection reason in context

### NEXT STEP (conditional edge)
- If `mode === "pipeline"` and `currentStep < pipelineSteps.length - 1`:
  - Increment `currentStep`, set `targetPersona` to next step
  - Route back to PERSONA
- Otherwise → END

---

## Personas Config

File: `src/personas.yaml`

```yaml
personas:
  designer:
    name: "Designer"
    description: "Visual layout and structure specialist"
    icon: "Palette"
    color: "oklch(0.72 0.16 240)"
    triggers:
      keywords: ["layout", "design", "arrange", "flow", "wireframe", "visual", "create", "build", "draw"]
      mention: "@designer"
    tools:
      - createNode
      - updateNode
      - deleteNode
      - createEdge
      - deleteEdge
      - groupNodes
      - rearrangeNodes
      - sendMessage
    system_prompt: |
      You are the Designer persona in a collaborative canvas whiteboarding session for a creative team.
      Your expertise: visual layout, information architecture, spatial organization, flow diagrams.
      Guidelines:
      - Create clear, organized visual structures
      - Use shapes for structural elements, sticky notes for ideas, edges for relationships
      - Group related items and apply consistent spacing
      - Explain your design choices via sendMessage
      - Respect existing layout — don't rearrange what users intentionally placed
      - Prefer 1-3 actions per turn

  critique:
    name: "Critique"
    description: "Reviews work and suggests improvements"
    icon: "MessageSquareWarning"
    color: "oklch(0.72 0.19 28)"
    triggers:
      keywords: ["review", "feedback", "improve", "critique", "what's wrong", "check", "evaluate"]
      mention: "@critique"
    tools:
      - createNode
      - createEdge
      - sendMessage
    system_prompt: |
      You are the Critique persona in a collaborative canvas whiteboarding session for a creative team.
      Your expertise: constructive feedback, identifying gaps, improving clarity, catching inconsistencies.
      Guidelines:
      - NEVER modify or delete existing user nodes
      - Add feedback as sticky notes positioned near the relevant items
      - Use coral/warm colors for your sticky notes
      - Be specific and actionable
      - Prioritize: structural issues > clarity > style
      - Explain your reasoning via sendMessage
      - Max 3 feedback items per turn

  marketing:
    name: "Marketing"
    description: "Brand voice, copy, and audience alignment"
    icon: "Megaphone"
    color: "oklch(0.86 0.18 95)"
    triggers:
      keywords: ["copy", "brand", "message", "audience", "name", "tagline", "tone", "campaign"]
      mention: "@marketing"
    tools:
      - createNode
      - createEdge
      - sendMessage
    system_prompt: |
      You are the Marketing persona in a collaborative canvas whiteboarding session for a creative team.
      Your expertise: brand voice, copywriting, audience targeting, naming, messaging hierarchy.
      Guidelines:
      - NEVER modify or delete existing user nodes
      - Add copy suggestions as text nodes or sticky notes
      - Use warm/gold colors for your suggestions
      - Provide 2-3 naming/copy alternatives when asked
      - Consider audience alignment and brand consistency
      - Explain your reasoning via sendMessage
      - Keep suggestions concise

pipelines:
  campaign:
    triggers: ["campaign", "build a campaign", "campaign layout"]
    steps: ["designer", "critique", "marketing"]

  review:
    triggers: ["full review", "review everything"]
    steps: ["critique", "marketing"]
```

---

## AI Node Metadata (extended)

```typescript
_ai: {
  actionId: string
  commandId: string | null
  requestedBy: string | null
  status: "pending" | "approved" | "rejected"
  createdAt: number
  persona: string            // "designer" | "critique" | "marketing"
  personaColor: string       // oklch color from personas.yaml
}
```

---

## Express Routes (same API, new internals)

| Route | Current | New |
|---|---|---|
| `POST /api/ai/rooms/:roomId/command` | `roomManager.handleCommand()` | `graph.invoke(commandState, { configurable: { thread_id: roomId } })` |
| `POST /api/ai/rooms/:roomId/events` | `roomManager.handleEvents()` | Write events to Redis key `events:{roomId}`, graph reads on next invoke |
| `POST /api/ai/rooms/:roomId/feedback` | `roomManager.handleFeedback()` | `graph.invoke(feedbackState, { configurable: { thread_id: roomId } })` — resumes from interrupt |
| `GET /api/ai/rooms/:roomId/queue` | `roomManager.getQueueStatus()` | Read graph state from Redis checkpointer |

---

## Frontend Changes

Minimal — same API contract. Three additions:

### 1. Chat command detection
Extend `@agent` regex to also accept persona names:
```
@agent ...      → sends command with targetPersona: null (auto-route)
@designer ...   → sends command with targetPersona: "designer"
@critique ...   → sends command with targetPersona: "critique"
@marketing ...  → sends command with targetPersona: "marketing"
```

### 2. AI badge shows persona
`AiBadge` reads `_ai.persona` and `_ai.personaColor`:
- Shows "Designer" / "Critique" / "Marketing" instead of "AI"
- Badge background uses `personaColor`

### 3. Command request includes targetPersona
```typescript
// AiCommandRequest gets optional field
{
  ...existing fields,
  targetPersona?: string  // "designer" | "critique" | "marketing" | null
}
```

---

## File Structure

```
ai_agent_service/src/
├── index.ts                    # Express routes (same endpoints, graph internals)
├── config.ts                   # env vars + load personas.yaml
├── personas.yaml               # Persona definitions
├── persona-loader.ts           # Parse YAML → typed persona config
├── graph/
│   ├── state.ts                # AgentState type
│   ├── graph.ts                # StateGraph definition
│   ├── checkpointer.ts         # Redis checkpointer setup
│   └── nodes/
│       ├── gather-context.ts   # Read canvas + transcript + events
│       ├── router.ts           # Pick mode + persona
│       ├── persona.ts          # LLM call with persona prompt
│       ├── execute.ts          # ActionExecutor + Liveblocks flush
│       ├── human-gate.ts       # interrupt()
│       └── handle-feedback.ts  # Process approve/reject
├── action-executor.ts          # KEEP unchanged
├── tools/canvas-tools.ts       # KEEP unchanged
├── llm/                        # KEEP unchanged (provider-router, claude, openai)
└── types.ts                    # KEEP + extend

REMOVE:
├── room-manager.ts
├── command-queue.ts
├── context-accumulator.ts
└── decision-engine.ts
```

---

## Dependencies

```
New:
  @langchain/langgraph    # StateGraph, interrupt, checkpointer
  @langchain/core         # Base types
  ioredis                 # Redis client for checkpointer
  yaml                    # Parse personas.yaml

Keep:
  @anthropic-ai/sdk       # Claude provider
  @liveblocks/node        # Canvas persistence
  @liveblocks/client      # Presence
  express                 # API layer
  openai                  # OpenAI provider
  dotenv                  # Config
```

---

## Proactive AI (no explicit command)

The current DecisionEngine's logic (silence threshold, change count, cooldown) moves into the Express layer as a simple timer. When the timer fires:
1. Build a synthetic command: `{ message: "[proactive] analyze current canvas state", mode: "auto" }`
2. Invoke the graph with this command
3. Router picks the best persona based on canvas content and recent activity

Timer config via environment variable: `AI_PROACTIVE_INTERVAL_MS` (default: 10000, set to 0 to disable).

---

## Redis Keys

```
langgraph:checkpoint:{roomId}     # Graph state checkpoints (managed by LangGraph)
ai:events:{roomId}                # Buffered user activity events (LIST)
ai:transcript:{roomId}            # Recent transcript segments (LIST, max 20)
```

---

## Error Handling

- LLM call fails → graph catches error, sends "I couldn't complete that request" via chat, marks state as done
- Liveblocks write fails → logs error, retries once, then sends error message via chat
- Redis connection lost → graph falls back to MemorySaver (in-memory), logs warning
- Invalid persona in command → router falls back to auto-detection
- Pipeline step fails → skips to next step, sends explanation in chat
