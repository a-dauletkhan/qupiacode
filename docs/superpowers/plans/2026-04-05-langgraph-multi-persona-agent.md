# LangGraph Multi-Persona AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI agent service internals with a LangGraph StateGraph supporting multi-persona routing (Designer, Critique, Marketing), pipeline execution with human-in-the-loop gates, and Redis-checkpointed state persistence.

**Architecture:** Express routes stay as the API layer (same frontend contract). LangGraph StateGraph replaces RoomManager, CommandQueue, ContextAccumulator, and DecisionEngine. Each persona is defined in `personas.yaml` and loaded at startup. The graph uses `interrupt()` for approve/reject gates and Redis for state checkpointing. Existing LLM providers (Claude/OpenAI) and ActionExecutor are kept unchanged.

**Tech Stack:** TypeScript, @langchain/langgraph 1.2.7, @langchain/core 1.1.39, @langchain/langgraph-checkpoint-redis, redis, yaml, Express 5, Liveblocks Node SDK, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/personas.yaml` | Create | Persona definitions (name, prompt, tools, triggers, pipelines) |
| `src/persona-loader.ts` | Create | Parse YAML → typed persona config, validate |
| `src/persona-loader.test.ts` | Create | Tests for persona loading |
| `src/graph/state.ts` | Create | AgentState Annotation definition |
| `src/graph/checkpointer.ts` | Create | Redis checkpointer setup with fallback |
| `src/graph/nodes/gather-context.ts` | Create | ENTRY node — read canvas + transcript from Liveblocks |
| `src/graph/nodes/router.ts` | Create | ROUTER node — pick mode + persona |
| `src/graph/nodes/router.test.ts` | Create | Tests for routing logic |
| `src/graph/nodes/persona.ts` | Create | PERSONA node — LLM call with persona prompt |
| `src/graph/nodes/execute.ts` | Create | EXECUTE node — ActionExecutor + Liveblocks flush |
| `src/graph/nodes/human-gate.ts` | Create | HUMAN GATE node — interrupt() |
| `src/graph/nodes/handle-feedback.ts` | Create | Process approve/reject, remove/update nodes |
| `src/graph/graph.ts` | Create | Assemble StateGraph with all nodes + edges |
| `src/graph/graph.test.ts` | Create | Integration test with MemorySaver |
| `src/index.ts` | Modify | Rewrite routes to invoke graph |
| `src/types.ts` | Modify | Add persona field to AiMetadata, add graph-related types |
| `src/action-executor.ts` | Modify | Add persona + personaColor to AiActionContext |
| `src/config.ts` | Modify | Add Redis URL + proactive interval config |
| `frontend/.../types.ts` | Modify | Add persona + personaColor to AiMetadata |
| `frontend/.../ai-badge.tsx` | Modify | Show persona name + color |
| `frontend/.../Chat.tsx` | Modify | Extend @agent regex for @designer/@critique/@marketing |

### Files to remove (after graph is working):
| `src/room-manager.ts` | Remove | Replaced by graph |
| `src/command-queue.ts` | Remove | Replaced by graph state |
| `src/command-queue.test.ts` | Remove | No longer needed |
| `src/context-accumulator.ts` | Remove | Replaced by gather-context node |
| `src/context-accumulator.test.ts` | Remove | No longer needed |
| `src/decision-engine.ts` | Remove | Replaced by router node |
| `src/decision-engine.test.ts` | Remove | No longer needed |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `backend/ai_agent_service/package.json`

- [ ] **Step 1: Install LangGraph and supporting packages**

```bash
cd backend/ai_agent_service && npm install @langchain/langgraph@1.2.7 @langchain/core@1.1.39 @langchain/langgraph-checkpoint-redis redis yaml
```

- [ ] **Step 2: Verify install succeeded**

```bash
cd backend/ai_agent_service && node -e "require('@langchain/langgraph'); require('yaml'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd backend/ai_agent_service && git add package.json package-lock.json
git commit -m "chore(ai-agent): install langgraph, redis, yaml dependencies"
```

---

### Task 2: Create Personas Config + Loader

**Files:**
- Create: `backend/ai_agent_service/src/personas.yaml`
- Create: `backend/ai_agent_service/src/persona-loader.ts`
- Create: `backend/ai_agent_service/src/persona-loader.test.ts`

- [ ] **Step 1: Create `src/personas.yaml`**

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

- [ ] **Step 2: Write failing tests for persona-loader**

Create `src/persona-loader.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadPersonas, type PersonaConfig, type PipelineConfig } from "./persona-loader.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("persona-loader", () => {
  it("loads all personas from YAML", () => {
    const { personas } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    expect(Object.keys(personas)).toEqual(["designer", "critique", "marketing"]);
  });

  it("parses persona fields correctly", () => {
    const { personas } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    const designer = personas.designer;

    expect(designer.name).toBe("Designer");
    expect(designer.color).toContain("oklch");
    expect(designer.triggers.mention).toBe("@designer");
    expect(designer.triggers.keywords).toContain("layout");
    expect(designer.tools).toContain("createNode");
    expect(designer.tools).toContain("sendMessage");
    expect(designer.system_prompt).toContain("Designer persona");
  });

  it("loads pipeline definitions", () => {
    const { pipelines } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    expect(Object.keys(pipelines)).toEqual(["campaign", "review"]);
    expect(pipelines.campaign.steps).toEqual(["designer", "critique", "marketing"]);
    expect(pipelines.campaign.triggers).toContain("campaign");
  });

  it("validates pipeline steps reference existing personas", () => {
    const { personas, pipelines } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    for (const pipeline of Object.values(pipelines)) {
      for (const step of pipeline.steps) {
        expect(personas[step]).toBeDefined();
      }
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend/ai_agent_service && npx vitest run src/persona-loader.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 4: Implement persona-loader**

Create `src/persona-loader.ts`:

```typescript
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface PersonaTriggers {
  keywords: string[];
  mention: string;
}

export interface PersonaConfig {
  name: string;
  description: string;
  icon: string;
  color: string;
  triggers: PersonaTriggers;
  tools: string[];
  system_prompt: string;
}

export interface PipelineConfig {
  triggers: string[];
  steps: string[];
}

export interface PersonasFile {
  personas: Record<string, PersonaConfig>;
  pipelines: Record<string, PipelineConfig>;
}

export function loadPersonas(filePath: string): PersonasFile {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = parseYaml(raw) as PersonasFile;

  if (!parsed.personas || Object.keys(parsed.personas).length === 0) {
    throw new Error("personas.yaml must define at least one persona");
  }

  if (!parsed.pipelines) {
    parsed.pipelines = {};
  }

  // Validate pipeline steps reference existing personas
  for (const [name, pipeline] of Object.entries(parsed.pipelines)) {
    for (const step of pipeline.steps) {
      if (!parsed.personas[step]) {
        throw new Error(`Pipeline "${name}" references unknown persona "${step}"`);
      }
    }
  }

  return parsed;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend/ai_agent_service && npx vitest run src/persona-loader.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
cd backend/ai_agent_service && git add src/personas.yaml src/persona-loader.ts src/persona-loader.test.ts
git commit -m "feat(ai-agent): add personas.yaml config and persona loader"
```

---

### Task 3: Define Graph State + Extend Types

**Files:**
- Create: `backend/ai_agent_service/src/graph/state.ts`
- Modify: `backend/ai_agent_service/src/types.ts`
- Modify: `backend/ai_agent_service/src/action-executor.ts`

- [ ] **Step 1: Extend AiMetadata in types.ts**

Add `persona` and `personaColor` to the existing `AiMetadata` interface in `src/types.ts`:

```typescript
export interface AiMetadata {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  status: AiActionStatus;
  createdAt: number;
  persona: string;          // "designer" | "critique" | "marketing"
  personaColor: string;     // oklch color string from personas.yaml
}
```

- [ ] **Step 2: Extend AiActionContext in action-executor.ts**

Add `persona` and `personaColor` to the `AiActionContext` interface:

```typescript
export interface AiActionContext {
  actionId: string;
  commandId: string | null;
  requestedBy: string | null;
  persona: string;
  personaColor: string;
}
```

Update `buildAiMeta()` to include the new fields:

```typescript
  private buildAiMeta(): AiMetadata | null {
    if (!this.aiContext) return null;
    return {
      actionId: this.aiContext.actionId,
      commandId: this.aiContext.commandId,
      requestedBy: this.aiContext.requestedBy,
      status: "pending",
      createdAt: Date.now(),
      persona: this.aiContext.persona,
      personaColor: this.aiContext.personaColor,
    };
  }
```

- [ ] **Step 3: Create graph state definition**

Create `src/graph/state.ts`:

```typescript
import { Annotation } from "@langchain/langgraph";
import type {
  CanvasNode,
  CanvasEdge,
  TranscriptSegment,
  AiActivityEvent,
} from "../types.js";
import type { ToolCall } from "../llm/types.js";

export interface CommandInput {
  userId: string;
  userName: string;
  message: string;
  source: "chat" | "canvas_context_menu";
  selectedNodeIds: string[];
  targetPersona: string | null;
}

export interface PendingAction {
  persona: string;
  personaColor: string;
  actionId: string;
  toolCalls: ToolCall[];
  chatMessage: string | null;
}

export interface FeedbackInput {
  actionId: string;
  status: "approved" | "rejected";
  reason?: string;
  nodeIds: string[];
  edgeIds: string[];
  userId: string;
}

export const AgentState = Annotation.Root({
  roomId: Annotation<string>,

  // Input
  command: Annotation<CommandInput | null>({
    default: () => null,
  }),
  canvasSnapshot: Annotation<{ nodes: CanvasNode[]; edges: CanvasEdge[] }>({
    default: () => ({ nodes: [], edges: [] }),
  }),
  transcript: Annotation<TranscriptSegment[]>({
    default: () => [],
  }),
  userEvents: Annotation<AiActivityEvent[]>({
    default: () => [],
  }),

  // Routing
  mode: Annotation<"auto" | "pipeline" | "direct">({
    default: () => "auto",
  }),
  targetPersona: Annotation<string | null>({
    default: () => null,
  }),

  // Pipeline tracking
  pipelineSteps: Annotation<string[]>({
    default: () => [],
  }),
  currentStep: Annotation<number>({
    default: () => 0,
  }),

  // Per-persona output
  pendingActions: Annotation<PendingAction[]>({
    reducer: (existing, update) => [...existing, ...update],
    default: () => [],
  }),

  // Feedback
  lastFeedback: Annotation<FeedbackInput | null>({
    default: () => null,
  }),

  // Control
  done: Annotation<boolean>({
    default: () => false,
  }),
  error: Annotation<string | null>({
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend/ai_agent_service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd backend/ai_agent_service && git add src/types.ts src/action-executor.ts src/graph/state.ts
git commit -m "feat(ai-agent): define LangGraph state annotation and extend AI metadata with persona"
```

---

### Task 4: Create Redis Checkpointer

**Files:**
- Create: `backend/ai_agent_service/src/graph/checkpointer.ts`
- Modify: `backend/ai_agent_service/src/config.ts`

- [ ] **Step 1: Add Redis URL to config**

Add to `src/config.ts` inside the config object:

```typescript
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  agent: {
    proactiveIntervalMs: parseInt(process.env.AI_PROACTIVE_INTERVAL_MS ?? "10000", 10),
  },
```

- [ ] **Step 2: Create checkpointer setup**

Create `src/graph/checkpointer.ts`:

```typescript
import { MemorySaver } from "@langchain/langgraph";
import { config } from "../config.js";

export async function createCheckpointer() {
  try {
    const { RedisSaver } = await import("@langchain/langgraph-checkpoint-redis");
    const checkpointer = await RedisSaver.fromUrl(config.redis.url, {
      defaultTTL: 3600, // 1 hour TTL per thread
    });
    console.log("Checkpointer: Redis connected");
    return checkpointer;
  } catch (err) {
    console.warn("Checkpointer: Redis unavailable, falling back to MemorySaver", err);
    return new MemorySaver();
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd backend/ai_agent_service && git add src/config.ts src/graph/checkpointer.ts
git commit -m "feat(ai-agent): add Redis checkpointer with MemorySaver fallback"
```

---

### Task 5: Create Graph Nodes

**Files:**
- Create: `backend/ai_agent_service/src/graph/nodes/gather-context.ts`
- Create: `backend/ai_agent_service/src/graph/nodes/router.ts`
- Create: `backend/ai_agent_service/src/graph/nodes/router.test.ts`
- Create: `backend/ai_agent_service/src/graph/nodes/persona.ts`
- Create: `backend/ai_agent_service/src/graph/nodes/execute.ts`
- Create: `backend/ai_agent_service/src/graph/nodes/human-gate.ts`
- Create: `backend/ai_agent_service/src/graph/nodes/handle-feedback.ts`

- [ ] **Step 1: Create gather-context node**

Create `src/graph/nodes/gather-context.ts`:

```typescript
import { Liveblocks } from "@liveblocks/node";
import type { AgentStateType } from "../state.js";
import type { CanvasNode, CanvasEdge } from "../../types.js";

export function createGatherContextNode(liveblocks: Liveblocks) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const { roomId } = state;

    try {
      const storage = await liveblocks.getStorageDocument(roomId, "json");
      const root = (storage?.data ?? {}) as Record<string, unknown>;
      const rawNodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
      const rawEdges = (root.edges ?? []) as Array<Record<string, unknown>>;

      const nodes: CanvasNode[] = rawNodes.map((n) => ({
        id: n.id as string,
        type: ((n.data as Record<string, unknown>)?.type as string ?? "shape") as CanvasNode["type"],
        position: n.position as { x: number; y: number },
        width: n.width as number | undefined,
        height: n.height as number | undefined,
        data: n.data as CanvasNode["data"],
      }));

      const edges: CanvasEdge[] = rawEdges.map((e) => ({
        id: e.id as string,
        source: e.source as string,
        target: e.target as string,
        label: e.label as string | undefined,
      }));

      return {
        canvasSnapshot: { nodes, edges },
      };
    } catch (err) {
      console.error(`Failed to gather context for room ${roomId}:`, err);
      return {
        canvasSnapshot: { nodes: [], edges: [] },
      };
    }
  };
}
```

- [ ] **Step 2: Create router node with tests**

Create `src/graph/nodes/router.ts`:

```typescript
import type { AgentStateType } from "../state.js";
import type { PersonasFile } from "../../persona-loader.js";

export function createRouterNode(personasFile: PersonasFile) {
  const { personas, pipelines } = personasFile;

  return (state: AgentStateType): Partial<AgentStateType> => {
    const message = state.command?.message?.toLowerCase() ?? "";
    const targetFromCommand = state.command?.targetPersona;

    // Priority 1: Direct persona mention from command
    if (targetFromCommand && personas[targetFromCommand]) {
      return {
        mode: "direct",
        targetPersona: targetFromCommand,
        pipelineSteps: [],
        currentStep: 0,
      };
    }

    // Priority 2: Check for @mention in message text
    for (const [id, persona] of Object.entries(personas)) {
      if (message.includes(persona.triggers.mention)) {
        return {
          mode: "direct",
          targetPersona: id,
          pipelineSteps: [],
          currentStep: 0,
        };
      }
    }

    // Priority 3: Pipeline triggers
    for (const [, pipeline] of Object.entries(pipelines)) {
      for (const trigger of pipeline.triggers) {
        if (message.includes(trigger.toLowerCase())) {
          return {
            mode: "pipeline",
            targetPersona: pipeline.steps[0],
            pipelineSteps: pipeline.steps,
            currentStep: 0,
          };
        }
      }
    }

    // Priority 4: Auto-detect by keyword matching
    let bestPersona: string | null = null;
    let bestScore = 0;

    for (const [id, persona] of Object.entries(personas)) {
      const score = persona.triggers.keywords.filter((kw) =>
        message.includes(kw.toLowerCase())
      ).length;
      if (score > bestScore) {
        bestScore = score;
        bestPersona = id;
      }
    }

    return {
      mode: "auto",
      targetPersona: bestPersona ?? "designer", // default to designer
      pipelineSteps: [],
      currentStep: 0,
    };
  };
}
```

Create `src/graph/nodes/router.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createRouterNode } from "./router.js";
import type { AgentStateType } from "../state.js";
import type { PersonasFile } from "../../persona-loader.js";

const testPersonas: PersonasFile = {
  personas: {
    designer: {
      name: "Designer",
      description: "",
      icon: "",
      color: "",
      triggers: { keywords: ["layout", "design", "create"], mention: "@designer" },
      tools: [],
      system_prompt: "",
    },
    critique: {
      name: "Critique",
      description: "",
      icon: "",
      color: "",
      triggers: { keywords: ["review", "feedback"], mention: "@critique" },
      tools: [],
      system_prompt: "",
    },
    marketing: {
      name: "Marketing",
      description: "",
      icon: "",
      color: "",
      triggers: { keywords: ["copy", "brand"], mention: "@marketing" },
      tools: [],
      system_prompt: "",
    },
  },
  pipelines: {
    campaign: {
      triggers: ["build a campaign"],
      steps: ["designer", "critique", "marketing"],
    },
  },
};

function makeState(overrides: Partial<AgentStateType>): AgentStateType {
  return {
    roomId: "room-1",
    command: null,
    canvasSnapshot: { nodes: [], edges: [] },
    transcript: [],
    userEvents: [],
    mode: "auto",
    targetPersona: null,
    pipelineSteps: [],
    currentStep: 0,
    pendingActions: [],
    lastFeedback: null,
    done: false,
    error: null,
    ...overrides,
  };
}

describe("router node", () => {
  const router = createRouterNode(testPersonas);

  it("routes direct persona from command targetPersona", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "organize this", source: "chat", selectedNodeIds: [], targetPersona: "critique" },
    }));
    expect(result.mode).toBe("direct");
    expect(result.targetPersona).toBe("critique");
  });

  it("routes @mention in message text", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "@marketing name this feature", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("direct");
    expect(result.targetPersona).toBe("marketing");
  });

  it("routes pipeline trigger", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "build a campaign for Q2", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("pipeline");
    expect(result.targetPersona).toBe("designer");
    expect(result.pipelineSteps).toEqual(["designer", "critique", "marketing"]);
  });

  it("auto-detects by keyword", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "review and give feedback on this layout", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("auto");
    expect(result.targetPersona).toBe("critique"); // "review" + "feedback" = 2 hits
  });

  it("defaults to designer when no keywords match", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "hello", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.targetPersona).toBe("designer");
  });

  it("direct mention beats pipeline trigger", () => {
    const result = router(makeState({
      command: { userId: "u1", userName: "A", message: "@critique build a campaign", source: "chat", selectedNodeIds: [], targetPersona: null },
    }));
    expect(result.mode).toBe("direct");
    expect(result.targetPersona).toBe("critique");
  });
});
```

- [ ] **Step 3: Run router tests**

```bash
cd backend/ai_agent_service && npx vitest run src/graph/nodes/router.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 4: Create persona node**

Create `src/graph/nodes/persona.ts`:

```typescript
import type { AgentStateType, PendingAction } from "../state.js";
import type { PersonasFile } from "../../persona-loader.js";
import type { LLMProvider, Message, Tool } from "../../llm/types.js";
import { canvasTools } from "../../tools/canvas-tools.js";
import { randomUUID } from "node:crypto";

export function createPersonaNode(personasFile: PersonasFile, llm: LLMProvider) {
  const { personas } = personasFile;

  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const personaId = state.targetPersona;
    if (!personaId || !personas[personaId]) {
      return { error: `Unknown persona: ${personaId}`, done: true };
    }

    const persona = personas[personaId];
    const actionId = `act-${randomUUID().slice(0, 8)}`;

    // Filter tools to only those allowed for this persona
    const allowedTools: Tool[] = canvasTools.filter((t) =>
      persona.tools.includes(t.name)
    );

    // Build context string
    const contextParts: string[] = [];

    // Canvas state
    const { nodes, edges } = state.canvasSnapshot;
    if (nodes.length > 0 || edges.length > 0) {
      const nodeDesc = nodes.map(
        (n) => `  - ${n.id} (${n.type}) at (${n.position.x}, ${n.position.y}): ${JSON.stringify(n.data)}`
      );
      const edgeDesc = edges.map(
        (e) => `  - ${e.id}: ${e.source} -> ${e.target}${e.label ? ` [${e.label}]` : ""}`
      );
      contextParts.push(`## Canvas State\nNodes (${nodes.length}):\n${nodeDesc.join("\n")}\nEdges (${edges.length}):\n${edgeDesc.join("\n") || "  (none)"}`);
    } else {
      contextParts.push("## Canvas State\nThe canvas is empty.");
    }

    // Transcript
    if (state.transcript.length > 0) {
      const lines = state.transcript.map((t) => `  [${t.speakerName}]: ${t.text}`);
      contextParts.push(`## Recent Conversation\n${lines.join("\n")}`);
    }

    // User events
    if (state.userEvents.length > 0) {
      const lines = state.userEvents.slice(-10).map(
        (e) => `  - ${e.type} ${JSON.stringify(e.data)}`
      );
      contextParts.push(`## Recent User Activity\n${lines.join("\n")}`);
    }

    const context = contextParts.join("\n\n");
    const commandText = state.command?.message ?? "Analyze the canvas and help where appropriate.";
    const commandUser = state.command?.userName ?? "System";

    // Build messages
    const messages: Message[] = [
      { role: "system", content: persona.system_prompt },
      {
        role: "user",
        content: `${commandUser} asked: "${commandText}"\n\nHere is the current context:\n\n${context}`,
      },
    ];

    try {
      const response = await llm.chat(messages, allowedTools);

      const action: PendingAction = {
        persona: personaId,
        personaColor: persona.color,
        actionId,
        toolCalls: response.toolCalls,
        chatMessage: response.text,
      };

      return { pendingActions: [action] };
    } catch (err) {
      console.error(`Persona ${personaId} LLM call failed:`, err);
      return { error: `${persona.name} failed to respond`, done: true };
    }
  };
}
```

- [ ] **Step 5: Create execute node**

Create `src/graph/nodes/execute.ts`:

```typescript
import { Liveblocks } from "@liveblocks/node";
import type { AgentStateType } from "../state.js";
import { ActionExecutor, type AiActionContext } from "../../action-executor.js";

export function createExecuteNode(liveblocks: Liveblocks) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const { roomId, pendingActions } = state;
    const latestAction = pendingActions[pendingActions.length - 1];

    if (!latestAction || (latestAction.toolCalls.length === 0 && !latestAction.chatMessage)) {
      return {};
    }

    const aiContext: AiActionContext = {
      actionId: latestAction.actionId,
      commandId: state.command ? `cmd-${state.command.userId.slice(0, 8)}` : null,
      requestedBy: state.command?.userId ?? null,
      persona: latestAction.persona,
      personaColor: latestAction.personaColor,
    };

    // Build storage adapter that writes to Liveblocks
    const pendingNodeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingNodeDeletes: string[] = [];
    const pendingEdgeSets: Array<{ id: string; data: Record<string, unknown> }> = [];
    const pendingEdgeDeletes: string[] = [];
    const messageQueue: string[] = [];

    const adapter = {
      getNodes: () => [],
      setNode(id: string, data: Record<string, unknown>) { pendingNodeSets.push({ id, data }); },
      deleteNode(id: string) { pendingNodeDeletes.push(id); },
      setEdge(id: string, data: Record<string, unknown>) { pendingEdgeSets.push({ id, data }); },
      deleteEdge(id: string) { pendingEdgeDeletes.push(id); },
      sendMessage(text: string) { messageQueue.push(text); },
    };

    // Execute tool calls
    if (latestAction.toolCalls.length > 0) {
      const executor = new ActionExecutor(adapter, aiContext);
      await executor.execute(latestAction.toolCalls);
    }

    // Add text response as chat message
    if (latestAction.chatMessage && !latestAction.toolCalls.some((tc) => tc.name === "sendMessage")) {
      adapter.sendMessage(latestAction.chatMessage);
    }

    // Flush to Liveblocks
    try {
      if (pendingNodeSets.length > 0 || pendingNodeDeletes.length > 0 ||
          pendingEdgeSets.length > 0 || pendingEdgeDeletes.length > 0) {

        const storage = await liveblocks.getStorageDocument(roomId, "json");
        const root = (storage?.data ?? {}) as Record<string, unknown>;
        let nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
        let edges = (root.edges ?? []) as Array<Record<string, unknown>>;

        for (const { id, data } of pendingNodeSets) {
          const idx = nodes.findIndex((n) => n.id === id);
          if (idx >= 0) { nodes[idx] = { ...nodes[idx], ...data, id }; }
          else { nodes.push({ id, ...data }); }
        }
        nodes = nodes.filter((n) => !pendingNodeDeletes.includes(n.id as string));

        for (const { id, data } of pendingEdgeSets) {
          const idx = edges.findIndex((e) => e.id === id);
          if (idx >= 0) { edges[idx] = { ...edges[idx], ...data, id }; }
          else { edges.push({ id, ...data }); }
        }
        edges = edges.filter((e) => !pendingEdgeDeletes.includes(e.id as string));

        await liveblocks.initializeStorageDocument(roomId, {
          liveblocksType: "LiveObject",
          data: {
            ...root,
            nodes: { liveblocksType: "LiveList", data: nodes } as any,
            edges: { liveblocksType: "LiveList", data: edges } as any,
          },
        });

        console.log(`[${latestAction.persona}] Flushed to Liveblocks:`, {
          nodeSets: pendingNodeSets.length, nodeDeletes: pendingNodeDeletes.length,
          edgeSets: pendingEdgeSets.length, edgeDeletes: pendingEdgeDeletes.length,
        });
      }

      // Send chat messages
      for (const text of messageQueue) {
        try {
          await liveblocks.createComment({ roomId, threadId: "agent-thread", data: {
            userId: "ai-agent", body: { version: 1 as const, content: [{ type: "paragraph" as const, children: [{ text }] }] },
          }} as any);
        } catch {
          try {
            await liveblocks.createThread({ roomId, data: {
              userId: "ai-agent", body: { version: 1 as const, content: [{ type: "paragraph" as const, children: [{ text }] }] }, metadata: {},
            }} as any);
          } catch (err) { console.error("Failed to send agent message:", err); }
        }
      }
    } catch (err) {
      console.error(`[${latestAction.persona}] Flush failed:`, err);
      return { error: "Failed to write to canvas" };
    }

    return {};
  };
}
```

- [ ] **Step 6: Create human-gate node**

Create `src/graph/nodes/human-gate.ts`:

```typescript
import { interrupt } from "@langchain/langgraph";
import type { AgentStateType, FeedbackInput } from "../state.js";

export function humanGateNode(state: AgentStateType): Partial<AgentStateType> {
  const latestAction = state.pendingActions[state.pendingActions.length - 1];
  if (!latestAction) {
    return { done: true };
  }

  // Pause graph — wait for human approval
  const feedback = interrupt({
    actionId: latestAction.actionId,
    persona: latestAction.persona,
    message: "Waiting for approval on AI-generated canvas changes",
  }) as FeedbackInput;

  return { lastFeedback: feedback };
}
```

- [ ] **Step 7: Create handle-feedback node**

Create `src/graph/nodes/handle-feedback.ts`:

```typescript
import { Liveblocks } from "@liveblocks/node";
import type { AgentStateType } from "../state.js";

export function createHandleFeedbackNode(liveblocks: Liveblocks) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const { roomId, lastFeedback } = state;
    if (!lastFeedback) return { done: true };

    if (lastFeedback.status === "rejected") {
      // Remove rejected nodes/edges from Liveblocks
      try {
        const storage = await liveblocks.getStorageDocument(roomId, "json");
        const root = (storage?.data ?? {}) as Record<string, unknown>;
        let nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
        let edges = (root.edges ?? []) as Array<Record<string, unknown>>;

        nodes = nodes.filter((n) => !lastFeedback.nodeIds.includes(n.id as string));
        edges = edges.filter((e) => !lastFeedback.edgeIds.includes(e.id as string));

        await liveblocks.initializeStorageDocument(roomId, {
          liveblocksType: "LiveObject",
          data: { ...root, nodes: { liveblocksType: "LiveList", data: nodes } as any, edges: { liveblocksType: "LiveList", data: edges } as any },
        });

        console.log(`Rejected: removed ${lastFeedback.nodeIds.length} nodes, ${lastFeedback.edgeIds.length} edges`);
      } catch (err) {
        console.error("Failed to remove rejected nodes:", err);
      }
    } else if (lastFeedback.status === "approved") {
      // Update _ai.status to "approved" in Liveblocks
      try {
        const storage = await liveblocks.getStorageDocument(roomId, "json");
        const root = (storage?.data ?? {}) as Record<string, unknown>;
        const nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
        const edges = (root.edges ?? []) as Array<Record<string, unknown>>;

        for (const node of nodes) {
          if (lastFeedback.nodeIds.includes(node.id as string)) {
            const data = node.data as Record<string, unknown> | undefined;
            const ai = data?._ai as Record<string, unknown> | undefined;
            if (ai) ai.status = "approved";
          }
        }

        for (const edge of edges) {
          if (lastFeedback.edgeIds.includes(edge.id as string)) {
            const ai = edge._ai as Record<string, unknown> | undefined;
            if (ai) ai.status = "approved";
          }
        }

        await liveblocks.initializeStorageDocument(roomId, {
          liveblocksType: "LiveObject",
          data: { ...root, nodes: { liveblocksType: "LiveList", data: nodes } as any, edges: { liveblocksType: "LiveList", data: edges } as any },
        });

        console.log(`Approved: ${lastFeedback.nodeIds.length} nodes`);
      } catch (err) {
        console.error("Failed to approve nodes:", err);
      }
    }

    return {};
  };
}
```

- [ ] **Step 8: Commit**

```bash
cd backend/ai_agent_service && git add src/graph/
git commit -m "feat(ai-agent): create all LangGraph nodes (gather-context, router, persona, execute, human-gate, handle-feedback)"
```

---

### Task 6: Assemble the Graph

**Files:**
- Create: `backend/ai_agent_service/src/graph/graph.ts`
- Create: `backend/ai_agent_service/src/graph/graph.test.ts`

- [ ] **Step 1: Assemble StateGraph**

Create `src/graph/graph.ts`:

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { Liveblocks } from "@liveblocks/node";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { LLMProvider } from "../llm/types.js";
import type { PersonasFile } from "../persona-loader.js";
import { AgentState, type AgentStateType } from "./state.js";
import { createGatherContextNode } from "./nodes/gather-context.js";
import { createRouterNode } from "./nodes/router.js";
import { createPersonaNode } from "./nodes/persona.js";
import { createExecuteNode } from "./nodes/execute.js";
import { humanGateNode } from "./nodes/human-gate.js";
import { createHandleFeedbackNode } from "./nodes/handle-feedback.js";

function shouldContinueAfterFeedback(state: AgentStateType): string {
  // If rejected and this was a pipeline, skip remaining steps
  if (state.lastFeedback?.status === "rejected") {
    return "__end__";
  }

  // If pipeline mode and more steps remain, go to next persona
  if (state.mode === "pipeline" && state.currentStep < state.pipelineSteps.length - 1) {
    return "next_step";
  }

  return "__end__";
}

function advanceStep(state: AgentStateType): Partial<AgentStateType> {
  const nextStep = state.currentStep + 1;
  return {
    targetPersona: state.pipelineSteps[nextStep],
    currentStep: nextStep,
    lastFeedback: null,
  };
}

export function buildGraph(
  liveblocks: Liveblocks,
  llm: LLMProvider,
  personasFile: PersonasFile,
  checkpointer: BaseCheckpointSaver,
) {
  const graph = new StateGraph(AgentState)
    .addNode("gather_context", createGatherContextNode(liveblocks))
    .addNode("router", createRouterNode(personasFile))
    .addNode("persona", createPersonaNode(personasFile, llm))
    .addNode("execute", createExecuteNode(liveblocks))
    .addNode("human_gate", humanGateNode)
    .addNode("handle_feedback", createHandleFeedbackNode(liveblocks))
    .addNode("next_step", advanceStep)

    // Edges
    .addEdge(START, "gather_context")
    .addEdge("gather_context", "router")
    .addEdge("router", "persona")
    .addEdge("persona", "execute")
    .addEdge("execute", "human_gate")
    .addEdge("human_gate", "handle_feedback")
    .addConditionalEdges("handle_feedback", shouldContinueAfterFeedback, [
      "next_step",
      "__end__",
    ])
    .addEdge("next_step", "persona");

  return graph.compile({ checkpointer });
}
```

- [ ] **Step 2: Write integration test with MemorySaver**

Create `src/graph/graph.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { Command } from "@langchain/langgraph";
import { buildGraph } from "./graph.js";
import type { LLMProvider, LLMResponse } from "../llm/types.js";
import type { PersonasFile } from "../persona-loader.js";

// Mock Liveblocks
function createMockLiveblocks() {
  const storage: Record<string, unknown> = { nodes: [], edges: [] };
  return {
    getStorageDocument: vi.fn(async () => ({ data: storage })),
    initializeStorageDocument: vi.fn(async (_roomId: string, data: any) => {
      storage.nodes = data.data.nodes?.data ?? [];
      storage.edges = data.data.edges?.data ?? [];
    }),
    createComment: vi.fn(async () => {}),
    createThread: vi.fn(async () => {}),
    storage,
  };
}

// Mock LLM that returns a createNode tool call
function createMockLLM(): LLMProvider {
  return {
    chat: vi.fn(async () => ({
      text: "I created a sticky note for you.",
      toolCalls: [
        {
          name: "createNode",
          arguments: {
            nodeType: "sticky_note",
            position: { x: 100, y: 100 },
            text: "Test idea",
          },
        },
      ],
    } as LLMResponse)),
  };
}

const testPersonas: PersonasFile = {
  personas: {
    designer: {
      name: "Designer", description: "", icon: "", color: "oklch(0.72 0.16 240)",
      triggers: { keywords: ["design"], mention: "@designer" },
      tools: ["createNode", "sendMessage"],
      system_prompt: "You are a designer.",
    },
  },
  pipelines: {},
};

describe("graph integration", () => {
  it("processes a command through the full graph until interrupt", async () => {
    const liveblocks = createMockLiveblocks();
    const llm = createMockLLM();
    const checkpointer = new MemorySaver();

    const graph = buildGraph(liveblocks as any, llm, testPersonas, checkpointer);

    const config = { configurable: { thread_id: "test-room-1" } };

    // Invoke with a command — should pause at human_gate
    const result = await graph.invoke(
      {
        roomId: "test-room-1",
        command: {
          userId: "user-1",
          userName: "Alice",
          message: "design a user flow",
          source: "chat" as const,
          selectedNodeIds: [],
          targetPersona: null,
        },
      },
      config,
    );

    // Graph should have called LLM
    expect(llm.chat).toHaveBeenCalledOnce();

    // Graph should have written to Liveblocks
    expect(liveblocks.initializeStorageDocument).toHaveBeenCalled();

    // Should have pending actions
    expect(result.pendingActions.length).toBeGreaterThan(0);
    expect(result.pendingActions[0].persona).toBe("designer");
  });

  it("resumes from interrupt with approval", async () => {
    const liveblocks = createMockLiveblocks();
    const llm = createMockLLM();
    const checkpointer = new MemorySaver();

    const graph = buildGraph(liveblocks as any, llm, testPersonas, checkpointer);

    const config = { configurable: { thread_id: "test-room-2" } };

    // First invoke — pauses at interrupt
    await graph.invoke(
      {
        roomId: "test-room-2",
        command: {
          userId: "user-1", userName: "Alice", message: "design something",
          source: "chat" as const, selectedNodeIds: [], targetPersona: null,
        },
      },
      config,
    );

    // Resume with approval
    const resumed = await graph.invoke(
      new Command({
        resume: {
          actionId: "act-test",
          status: "approved",
          nodeIds: ["ai-node-1"],
          edgeIds: [],
          userId: "user-1",
        },
      }),
      config,
    );

    // Feedback handler should have been called
    expect(resumed.lastFeedback?.status).toBe("approved");
  });
});
```

- [ ] **Step 3: Run integration tests**

```bash
cd backend/ai_agent_service && npx vitest run src/graph/graph.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
cd backend/ai_agent_service && git add src/graph/graph.ts src/graph/graph.test.ts
git commit -m "feat(ai-agent): assemble LangGraph StateGraph with full node pipeline and integration tests"
```

---

### Task 7: Rewrite Express Routes

**Files:**
- Modify: `backend/ai_agent_service/src/index.ts`

- [ ] **Step 1: Replace index.ts with graph-based routes**

```typescript
import express from "express";
import { Command } from "@langchain/langgraph";
import { Liveblocks } from "@liveblocks/node";
import { createClient } from "@liveblocks/client";
import { config } from "./config.js";
import { loadPersonas } from "./persona-loader.js";
import { createCheckpointer } from "./graph/checkpointer.js";
import { buildGraph } from "./graph/graph.js";
import { createProviderRouter } from "./llm/provider-router.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createOpenAIProvider } from "./llm/openai-provider.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";
import type { AiCommandRequest, AiEventsRequest, AiFeedbackRequest } from "./types.js";
import type { FeedbackInput } from "./graph/state.js";
import { resolve } from "node:path";

const app = express();
app.use(express.json());

// --- Setup ---
const liveblocks = new Liveblocks({ secret: config.liveblocks.secretKey });
const claude = createClaudeProvider(config.llm.anthropic.apiKey, config.llm.anthropic.model);
const openai = createOpenAIProvider(config.llm.openai.apiKey, config.llm.openai.model, config.llm.openai.baseURL);
const llm = createProviderRouter({ claude, openai }, config.llm.provider);
const personasFile = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
const transcriptSource = new WebhookTranscriptSource();

// Shared transcript buffer per room (in-memory, fed by webhook)
const transcriptBuffers = new Map<string, Array<{ speakerId: string; speakerName: string; text: string; timestamp: number }>>();
const eventBuffers = new Map<string, Array<{ type: string; timestamp: number; data: Record<string, unknown> }>>();

// Graph initialized async
let compiledGraph: Awaited<ReturnType<typeof buildGraph>> | null = null;

async function initGraph() {
  const checkpointer = await createCheckpointer();
  compiledGraph = buildGraph(liveblocks, llm, personasFile, checkpointer);
  console.log("LangGraph compiled with personas:", Object.keys(personasFile.personas).join(", "));
}

// --- Health ---
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", personas: Object.keys(personasFile.personas) });
});

// --- Transcript webhook (unchanged) ---
app.post("/api/transcript", (req, res) => {
  transcriptSource.handleEvent(req.body);

  // Buffer transcript for graph context
  const event = req.body;
  if (event.is_final && event.room_id) {
    const buffer = transcriptBuffers.get(event.room_id) ?? [];
    buffer.push({
      speakerId: event.speaker_id,
      speakerName: event.speaker_name,
      text: event.text,
      timestamp: event.timestamp,
    });
    if (buffer.length > 20) buffer.splice(0, buffer.length - 20);
    transcriptBuffers.set(event.room_id, buffer);
  }

  res.json({ ok: true });
});

// --- Room lifecycle (simplified) ---
app.post("/api/rooms/:roomId/join", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/leave", (_req, res) => {
  res.json({ ok: true });
});

// --- Liveblocks webhook ---
app.post("/api/liveblocks/webhook", (_req, res) => {
  res.json({ ok: true });
});

// --- AI Agent routes ---

app.post("/api/ai/rooms/:roomId/command", async (req, res) => {
  if (!compiledGraph) {
    res.status(503).json({ error: "not_ready", message: "AI agent is initializing" });
    return;
  }

  try {
    const { roomId } = req.params;
    const request = req.body as AiCommandRequest & { targetPersona?: string };
    const threadId = `room:${roomId}`;

    // Invoke graph
    const result = await compiledGraph.invoke(
      {
        roomId,
        command: {
          userId: request.userId,
          userName: request.userName,
          message: request.message,
          source: request.context.source,
          selectedNodeIds: request.context.selectedNodeIds,
          targetPersona: request.targetPersona ?? null,
        },
        transcript: transcriptBuffers.get(roomId) ?? [],
        userEvents: eventBuffers.get(roomId) ?? [],
      },
      { configurable: { thread_id: threadId } },
    );

    // Clear event buffer after consumption
    eventBuffers.delete(roomId);

    const latestAction = result.pendingActions?.[result.pendingActions.length - 1];

    res.status(202).json({
      commandId: latestAction?.actionId ?? "unknown",
      status: "queued",
      position: 1,
      estimatedWaitMs: 0,
      persona: latestAction?.persona ?? null,
    });
  } catch (err) {
    console.error("Command error:", err);
    res.status(500).json({ error: "internal", message: "Failed to process command" });
  }
});

app.post("/api/ai/rooms/:roomId/events", (req, res) => {
  const { roomId } = req.params;
  const { userId, events } = req.body as AiEventsRequest;

  const buffer = eventBuffers.get(roomId) ?? [];
  buffer.push(...events);
  if (buffer.length > 50) buffer.splice(0, buffer.length - 50);
  eventBuffers.set(roomId, buffer);

  res.json({ accepted: events.length });
});

app.post("/api/ai/rooms/:roomId/feedback", async (req, res) => {
  if (!compiledGraph) {
    res.status(503).json({ error: "not_ready", message: "AI agent is initializing" });
    return;
  }

  try {
    const { roomId } = req.params;
    const request = req.body as AiFeedbackRequest;
    const threadId = `room:${roomId}`;

    const feedback: FeedbackInput = {
      actionId: request.actionId,
      status: request.status,
      reason: request.reason,
      nodeIds: request.nodeIds,
      edgeIds: request.edgeIds,
      userId: request.userId,
    };

    // Resume graph from interrupt with feedback
    await compiledGraph.invoke(
      new Command({ resume: feedback }),
      { configurable: { thread_id: threadId } },
    );

    res.json({ ok: true, actionId: request.actionId, status: request.status });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "internal", message: "Failed to process feedback" });
  }
});

app.get("/api/ai/rooms/:roomId/queue", async (req, res) => {
  if (!compiledGraph) {
    res.json({ agentStatus: "idle", currentCommand: null, queue: [], recentActions: [] });
    return;
  }

  try {
    const { roomId } = req.params;
    const threadId = `room:${roomId}`;
    const graphState = await compiledGraph.getState({ configurable: { thread_id: threadId } });

    const isInterrupted = (graphState.tasks ?? []).some(
      (t: any) => t.interrupts && t.interrupts.length > 0
    );

    res.json({
      agentStatus: isInterrupted ? "acting" : "idle",
      currentCommand: null,
      queue: [],
      recentActions: [],
    });
  } catch {
    res.json({ agentStatus: "idle", currentCommand: null, queue: [], recentActions: [] });
  }
});

// --- Start ---
initGraph().then(() => {
  app.listen(config.server.port, () => {
    console.log(`AI Agent Service running on port ${config.server.port}`);
  });
}).catch((err) => {
  console.error("Failed to initialize graph:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend/ai_agent_service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd backend/ai_agent_service && git add src/index.ts
git commit -m "feat(ai-agent): rewrite Express routes to use LangGraph StateGraph"
```

---

### Task 8: Frontend — Persona Support

**Files:**
- Modify: `frontend/src/modules/Agent/types.ts`
- Modify: `frontend/src/modules/Agent/components/ai-badge.tsx`
- Modify: `frontend/src/modules/Chat/components/Chat.tsx`
- Modify: `frontend/src/modules/Agent/services/ai-agent-service.ts`

- [ ] **Step 1: Add persona fields to frontend AiMetadata type**

In `frontend/src/modules/Agent/types.ts`, update `AiMetadata`:

```typescript
export type AiMetadata = {
  actionId: string
  commandId: string | null
  requestedBy: string | null
  status: AiActionStatus
  createdAt: number
  persona: string
  personaColor: string
}
```

- [ ] **Step 2: Update AiBadge to show persona name + color**

Replace `frontend/src/modules/Agent/components/ai-badge.tsx`:

```typescript
import { Bot, Palette, MessageSquareWarning, Megaphone } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

type AiBadgeProps = {
  status: "pending" | "approved"
  persona?: string
  personaColor?: string
  className?: string
}

const PERSONA_ICONS: Record<string, typeof Bot> = {
  designer: Palette,
  critique: MessageSquareWarning,
  marketing: Megaphone,
}

export function AiBadge({ status, persona, personaColor, className }: AiBadgeProps) {
  const Icon = (persona && PERSONA_ICONS[persona]) || Bot
  const label = persona ? persona.charAt(0).toUpperCase() + persona.slice(1) : "AI"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "pointer-events-none absolute -right-2 -top-2 z-10 flex items-center gap-0.5 rounded-md px-1 py-0.5",
        status === "pending"
          ? "text-white"
          : "bg-muted/80 text-muted-foreground",
        className
      )}
      style={status === "pending" && personaColor ? {
        backgroundColor: `color-mix(in srgb, ${personaColor} 25%, transparent)`,
        color: personaColor,
      } : undefined}
    >
      <Icon className="size-2.5" />
      <span className="text-[8px] font-semibold uppercase tracking-wider">
        {label}
      </span>
    </motion.div>
  )
}
```

- [ ] **Step 3: Update ai-aware-nodes to pass persona to AiBadge**

In `frontend/src/modules/Agent/components/ai-node-overlay.tsx`, update to accept and pass persona props:

```typescript
import { AnimatePresence, motion } from "motion/react"
import type { AiActionStatus } from "../types"
import { AiBadge } from "./ai-badge"
import { AiActionBar } from "./ai-action-bar"
import { cn } from "@/lib/utils"

type AiNodeOverlayProps = {
  status: AiActionStatus
  persona?: string
  personaColor?: string
  onApprove: () => void
  onReject: () => void
  children: React.ReactNode
}

export function AiNodeOverlay({
  status,
  persona,
  personaColor,
  onApprove,
  onReject,
  children,
}: AiNodeOverlayProps) {
  const isPending = status === "pending"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "relative h-full w-full",
        isPending && "ai-node-pending"
      )}
    >
      <AiBadge
        status={isPending ? "pending" : "approved"}
        persona={persona}
        personaColor={personaColor}
      />

      {children}

      <AnimatePresence>
        {isPending && (
          <AiActionBar onApprove={onApprove} onReject={onReject} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

- [ ] **Step 4: Update ai-aware-nodes to read persona from _ai metadata**

In `frontend/src/modules/Agent/components/ai-aware-nodes.tsx`, update the overlay calls to pass persona:

In the approved branch:
```typescript
      if (aiMeta?.status === "approved") {
        return (
          <AiNodeOverlay
            status="approved"
            persona={aiMeta.persona}
            personaColor={aiMeta.personaColor}
            onApprove={() => {}}
            onReject={() => {}}
          >
            <OriginalComponent {...props} />
          </AiNodeOverlay>
        )
      }
```

In the pending branch:
```typescript
    return (
      <AiNodeOverlay
        status={aiMeta.status}
        persona={aiMeta.persona}
        personaColor={aiMeta.personaColor}
        onApprove={handleApprove}
        onReject={handleReject}
      >
        <OriginalComponent {...props} />
      </AiNodeOverlay>
    )
```

- [ ] **Step 5: Extend Chat.tsx to detect @designer, @critique, @marketing**

Update the regex in `Chat.tsx` `handleSubmit`:

```typescript
    // Detect @agent / @designer / @critique / @marketing commands
    const agentMatch = text.match(/^@(agent|designer|critique|marketing)\s+(.+)/i)
    if (agentMatch && aiAgent) {
      const persona = agentMatch[1].toLowerCase()
      const message = agentMatch[2]
      const targetPersona = persona === "agent" ? undefined : persona
      console.info("[ai-agent] chat command detected", {
        rawInput: text,
        persona: targetPersona ?? "auto",
        extractedCommand: message,
        roomId: aiAgent.roomId,
      })
      aiAgent.sendCommand(message, { source: "chat", targetPersona })
    }
```

Also update `AiCommandContext` type in `frontend/src/modules/Agent/types.ts` to include optional `targetPersona`:

```typescript
export type AiCommandContext = {
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  source: CommandSource
  targetPersona?: string
}
```

And update the `sendCommand` in `ai-agent-service.ts` to include it:

```typescript
export function sendCommand(roomId: string, req: AiCommandRequest): Promise<AiCommandResponse> {
  return post(`/api/ai/rooms/${roomId}/command`, req, `command: "${req.message}" from ${req.userName} (source: ${req.context.source}, persona: ${req.context.targetPersona ?? "auto"})`)
}
```

- [ ] **Step 6: Update chat placeholder**

```typescript
placeholder={aiAgent ? "Message or @designer @critique @marketing..." : "Type a message..."}
```

- [ ] **Step 7: Verify frontend builds**

```bash
cd frontend && npx tsc --noEmit && npx vite build 2>&1 | tail -3
```

Expected: 0 errors, build passes

- [ ] **Step 8: Commit**

```bash
git add frontend/src/modules/Agent/ frontend/src/modules/Chat/
git commit -m "feat(frontend): add persona support to AI badge, chat commands, and node overlay"
```

---

### Task 9: Remove Old Files

**Files:**
- Remove: `backend/ai_agent_service/src/room-manager.ts`
- Remove: `backend/ai_agent_service/src/command-queue.ts`
- Remove: `backend/ai_agent_service/src/command-queue.test.ts`
- Remove: `backend/ai_agent_service/src/context-accumulator.ts`
- Remove: `backend/ai_agent_service/src/context-accumulator.test.ts`
- Remove: `backend/ai_agent_service/src/decision-engine.ts`
- Remove: `backend/ai_agent_service/src/decision-engine.test.ts`

- [ ] **Step 1: Remove replaced files**

```bash
cd backend/ai_agent_service
rm src/room-manager.ts src/command-queue.ts src/command-queue.test.ts
rm src/context-accumulator.ts src/context-accumulator.test.ts
rm src/decision-engine.ts src/decision-engine.test.ts
```

- [ ] **Step 2: Verify remaining tests pass**

```bash
cd backend/ai_agent_service && npx vitest run
```

Expected: All remaining tests pass (persona-loader, router, action-executor, graph integration, canvas-tools, provider-router, webhook-source)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend/ai_agent_service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd backend/ai_agent_service && git add -A
git commit -m "refactor(ai-agent): remove old RoomManager, CommandQueue, ContextAccumulator, DecisionEngine"
```

---

### Task 10: Full Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd backend/ai_agent_service && npx vitest run
```

Expected: All tests pass

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && npx tsc --noEmit && npx vite build
```

Expected: 0 errors, build passes

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify full test suite passes after LangGraph multi-persona migration"
```
