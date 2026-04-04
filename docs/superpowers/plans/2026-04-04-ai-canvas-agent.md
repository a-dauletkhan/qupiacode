# AI Canvas Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proactive AI agent that joins Liveblocks rooms as a participant, observes canvas changes and voice transcripts, and acts on the canvas autonomously with configurable intensity.

**Architecture:** Node.js service using `@liveblocks/node` to join rooms as a participant. The agent reads/writes canvas storage via Liveblocks CRDTs, consumes transcript events through an abstracted TranscriptSource interface, and uses an LLM (swappable provider) to decide when and how to act. The existing Python canvas_service is slimmed down to auth + board management.

**Tech Stack:** Node.js, TypeScript, `@liveblocks/node`, Anthropic SDK, OpenAI SDK, Express (health/webhook endpoints), React 19, `@liveblocks/react`, `@liveblocks/react-flow`

---

## File Structure

### AI Agent Service (new: `backend/ai_agent_service/`)

```
backend/ai_agent_service/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                          # Entry point, Express server + agent bootstrap
│   ├── config.ts                         # Environment config
│   ├── room-manager.ts                   # Liveblocks room lifecycle
│   ├── context-accumulator.ts            # Rolling context window for LLM
│   ├── decision-engine.ts                # Intensity-based trigger logic
│   ├── action-executor.ts                # Executes LLM tool calls on Liveblocks storage
│   ├── llm/
│   │   ├── types.ts                      # LLMProvider interface, Message, Tool types
│   │   ├── provider-router.ts            # Provider selection and routing
│   │   ├── claude-provider.ts            # Anthropic implementation
│   │   └── openai-provider.ts            # OpenAI implementation
│   ├── transcript/
│   │   ├── types.ts                      # TranscriptEvent, TranscriptSource interface
│   │   └── webhook-source.ts             # HTTP webhook implementation of TranscriptSource
│   ├── tools/
│   │   └── canvas-tools.ts               # Tool definitions for LLM (createNode, updateNode, etc.)
│   └── types.ts                          # Shared types (canvas node schemas, presence, etc.)
```

### Backend Canvas Service (modify: `backend/canvas_service/`)

```
backend/canvas_service/
├── main.py                               # Remove redis, collaboration, canvas_objects routers
├── core/
│   ├── config.py                         # Add liveblocks_secret_key
│   ├── auth.py                           # Unchanged
│   └── database.py                       # Unchanged (still needed for boards)
├── modules/
│   ├── auth/router.py                    # Unchanged
│   ├── boards/                           # Unchanged
│   └── liveblocks/                       # NEW: token endpoint
│       ├── __init__.py
│       ├── router.py                     # POST /api/liveblocks/auth
│       └── service.py                    # Token generation logic
```

### Frontend (modify: `frontend/src/`)

```
frontend/src/
├── modules/
│   ├── Canvas/components/canvas/
│   │   └── room.tsx                      # Switch from publicApiKey to authEndpoint
│   ├── Chat/components/
│   │   └── Chat.tsx                      # Replace mock data with Liveblocks Comments
│   └── Agent/                            # NEW module
│       └── components/
│           ├── agent-presence.tsx         # Agent avatar/status on canvas
│           └── intensity-control.tsx      # Quiet/Balanced/Active toggle
├── liveblocks.config.ts                  # Update types for agent presence + storage
```

---

## Task 1: Scaffold AI Agent Service

**Files:**
- Create: `backend/ai_agent_service/package.json`
- Create: `backend/ai_agent_service/tsconfig.json`
- Create: `backend/ai_agent_service/.env.example`
- Create: `backend/ai_agent_service/src/config.ts`
- Create: `backend/ai_agent_service/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "ai-agent-service",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@liveblocks/node": "^3.17.0",
    "express": "^5.1.0",
    "dotenv": "^16.5.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^24.12.0",
    "tsx": "^4.19.0",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .env.example**

```env
# Liveblocks
LIVEBLOCKS_SECRET_KEY=sk_dev_xxxxx

# LLM Provider: "claude" or "openai"
LLM_PROVIDER=claude

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# OpenAI
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4o

# Server
PORT=3001
```

- [ ] **Step 4: Create config.ts**

```typescript
// backend/ai_agent_service/src/config.ts
import "dotenv/config";

export const config = {
  liveblocks: {
    secretKey: requireEnv("LIVEBLOCKS_SECRET_KEY"),
  },
  llm: {
    provider: (process.env.LLM_PROVIDER ?? "claude") as "claude" | "openai",
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? "",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
    },
  },
  server: {
    port: parseInt(process.env.PORT ?? "3001", 10),
  },
} as const;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
```

- [ ] **Step 5: Create index.ts with health endpoint**

```typescript
// backend/ai_agent_service/src/index.ts
import express from "express";
import { config } from "./config.js";

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.server.port, () => {
  console.log(`AI Agent Service running on port ${config.server.port}`);
});
```

- [ ] **Step 6: Install dependencies and verify it starts**

Run:
```bash
cd backend/ai_agent_service && npm install && npm run dev
```

Expected: `AI Agent Service running on port 3001`

- [ ] **Step 7: Commit**

```bash
git add backend/ai_agent_service/
git commit -m "feat: scaffold AI agent service with config and health endpoint"
```

---

## Task 2: LLM Provider Abstraction

**Files:**
- Create: `backend/ai_agent_service/src/llm/types.ts`
- Create: `backend/ai_agent_service/src/llm/claude-provider.ts`
- Create: `backend/ai_agent_service/src/llm/openai-provider.ts`
- Create: `backend/ai_agent_service/src/llm/provider-router.ts`
- Test: `backend/ai_agent_service/src/llm/__tests__/provider-router.test.ts`

- [ ] **Step 1: Write the LLM types**

```typescript
// backend/ai_agent_service/src/llm/types.ts

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolParameter {
  type: string;
  description: string;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  items?: ToolParameter;
  enum?: string[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  text: string | null;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  chat(messages: Message[], tools: Tool[]): Promise<LLMResponse>;
}
```

- [ ] **Step 2: Write the failing test for provider router**

```typescript
// backend/ai_agent_service/src/llm/__tests__/provider-router.test.ts
import { describe, it, expect, vi } from "vitest";
import { createProviderRouter } from "../provider-router.js";
import type { LLMProvider, Message, Tool } from "../types.js";

function createMockProvider(response: { text: string }): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue({ text: response.text, toolCalls: [] }),
  };
}

describe("ProviderRouter", () => {
  it("routes to the configured provider", async () => {
    const claude = createMockProvider({ text: "claude response" });
    const openai = createMockProvider({ text: "openai response" });

    const router = createProviderRouter({ claude, openai }, "claude");
    const result = await router.chat(
      [{ role: "user", content: "hello" }],
      []
    );

    expect(result.text).toBe("claude response");
    expect(claude.chat).toHaveBeenCalledOnce();
    expect(openai.chat).not.toHaveBeenCalled();
  });

  it("routes to openai when configured", async () => {
    const claude = createMockProvider({ text: "claude response" });
    const openai = createMockProvider({ text: "openai response" });

    const router = createProviderRouter({ claude, openai }, "openai");
    const result = await router.chat(
      [{ role: "user", content: "hello" }],
      []
    );

    expect(result.text).toBe("openai response");
    expect(openai.chat).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend/ai_agent_service && npx vitest run src/llm/__tests__/provider-router.test.ts`

Expected: FAIL — module not found

- [ ] **Step 4: Implement provider router**

```typescript
// backend/ai_agent_service/src/llm/provider-router.ts
import type { LLMProvider, Message, Tool, LLMResponse } from "./types.js";

interface Providers {
  claude: LLMProvider;
  openai: LLMProvider;
}

export function createProviderRouter(
  providers: Providers,
  activeProvider: "claude" | "openai"
): LLMProvider {
  return {
    chat(messages: Message[], tools: Tool[]): Promise<LLMResponse> {
      return providers[activeProvider].chat(messages, tools);
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend/ai_agent_service && npx vitest run src/llm/__tests__/provider-router.test.ts`

Expected: PASS

- [ ] **Step 6: Install LLM SDKs**

Run:
```bash
cd backend/ai_agent_service && npm install @anthropic-ai/sdk openai
```

- [ ] **Step 7: Implement Claude provider**

```typescript
// backend/ai_agent_service/src/llm/claude-provider.ts
import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, Message, Tool, LLMResponse, ToolCall } from "./types.js";

export function createClaudeProvider(apiKey: string, model: string): LLMProvider {
  const client = new Anthropic({ apiKey });

  return {
    async chat(messages: Message[], tools: Tool[]): Promise<LLMResponse> {
      const systemMessage = messages.find((m) => m.role === "system");
      const nonSystemMessages = messages.filter((m) => m.role !== "system");

      const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      }));

      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemMessage?.content ?? "",
        messages: nonSystemMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      let text: string | null = null;
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          text = block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }

      return { text, toolCalls };
    },
  };
}
```

- [ ] **Step 8: Implement OpenAI provider**

```typescript
// backend/ai_agent_service/src/llm/openai-provider.ts
import OpenAI from "openai";
import type { LLMProvider, Message, Tool, LLMResponse, ToolCall } from "./types.js";

export function createOpenAIProvider(apiKey: string, model: string): LLMProvider {
  const client = new OpenAI({ apiKey });

  return {
    async chat(messages: Message[], tools: Tool[]): Promise<LLMResponse> {
      const openaiTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const response = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      const choice = response.choices[0];
      const text = choice.message.content;
      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map(
        (tc) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })
      );

      return { text, toolCalls };
    },
  };
}
```

- [ ] **Step 9: Commit**

```bash
git add backend/ai_agent_service/src/llm/
git commit -m "feat: add LLM provider abstraction with Claude and OpenAI implementations"
```

---

## Task 3: Shared Types and Canvas Tool Definitions

**Files:**
- Create: `backend/ai_agent_service/src/types.ts`
- Create: `backend/ai_agent_service/src/tools/canvas-tools.ts`
- Test: `backend/ai_agent_service/src/tools/__tests__/canvas-tools.test.ts`

- [ ] **Step 1: Define shared types**

These mirror the frontend schema types so the agent understands the canvas data.

```typescript
// backend/ai_agent_service/src/types.ts

export type Intensity = "quiet" | "balanced" | "active";

export type AgentStatus = "watching" | "acting";

export interface AgentPresence {
  type: "ai_agent";
  status: AgentStatus;
  intensity: Intensity;
  cursor: null;
}

export type CanvasObjectType = "shape" | "text" | "sticky_note";
export type ShapeKind = "rectangle" | "diamond" | "ellipse";
export type PaintStyle = "solid" | "outline" | "sketch" | "hatch";
export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "medium" | "bold";

export interface Position {
  x: number;
  y: number;
}

export interface ShapeData {
  type: "shape";
  shapeKind: ShapeKind;
  color: string;
  paintStyle: PaintStyle;
  strokeWidth: number;
  label?: string;
}

export interface TextData {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
  fontWeight: FontWeight;
  align: TextAlign;
}

export interface StickyNoteData {
  type: "sticky_note";
  text: string;
  color: string;
  textColor: string;
  fontSize: number;
}

export type CanvasNodeData = ShapeData | TextData | StickyNoteData;

export interface CanvasNode {
  id: string;
  type: CanvasObjectType;
  position: Position;
  width?: number;
  height?: number;
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface TranscriptSegment {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
}
```

- [ ] **Step 2: Write the failing test for canvas tools**

```typescript
// backend/ai_agent_service/src/tools/__tests__/canvas-tools.test.ts
import { describe, it, expect } from "vitest";
import { canvasTools } from "../canvas-tools.js";

describe("canvasTools", () => {
  it("defines all required tool names", () => {
    const toolNames = canvasTools.map((t) => t.name);
    expect(toolNames).toContain("createNode");
    expect(toolNames).toContain("updateNode");
    expect(toolNames).toContain("deleteNode");
    expect(toolNames).toContain("createEdge");
    expect(toolNames).toContain("deleteEdge");
    expect(toolNames).toContain("sendMessage");
    expect(toolNames).toContain("groupNodes");
    expect(toolNames).toContain("rearrangeNodes");
  });

  it("each tool has a description and parameters", () => {
    for (const tool of canvasTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe("object");
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend/ai_agent_service && npx vitest run src/tools/__tests__/canvas-tools.test.ts`

Expected: FAIL — module not found

- [ ] **Step 4: Implement canvas tool definitions**

```typescript
// backend/ai_agent_service/src/tools/canvas-tools.ts
import type { Tool } from "../llm/types.js";

export const canvasTools: Tool[] = [
  {
    name: "createNode",
    description:
      "Create a new node on the canvas. Use 'shape' for rectangles/diamonds/ellipses, 'text' for text labels, 'sticky_note' for sticky notes.",
    parameters: {
      type: "object",
      properties: {
        nodeType: {
          type: "string",
          description: "The type of canvas object",
          enum: ["shape", "text", "sticky_note"],
        },
        position: {
          type: "object",
          description: "Position on canvas",
          properties: {
            x: { type: "number", description: "X coordinate" },
            y: { type: "number", description: "Y coordinate" },
          },
          required: ["x", "y"],
        },
        width: { type: "number", description: "Width in pixels. Default 150." },
        height: { type: "number", description: "Height in pixels. Default 80." },
        shapeKind: {
          type: "string",
          description: "Shape variant (only for nodeType=shape)",
          enum: ["rectangle", "diamond", "ellipse"],
        },
        color: { type: "string", description: "Fill color as oklch string" },
        paintStyle: {
          type: "string",
          description: "Paint style (only for shapes)",
          enum: ["solid", "outline", "sketch", "hatch"],
        },
        text: { type: "string", description: "Text content (for text and sticky_note types)" },
        fontSize: { type: "number", description: "Font size in pixels" },
        label: { type: "string", description: "Label text (for shapes)" },
      },
      required: ["nodeType", "position"],
    },
  },
  {
    name: "updateNode",
    description: "Update an existing node's properties (position, size, data fields).",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the node to update" },
        position: {
          type: "object",
          description: "New position",
          properties: {
            x: { type: "number", description: "X coordinate" },
            y: { type: "number", description: "Y coordinate" },
          },
        },
        width: { type: "number", description: "New width" },
        height: { type: "number", description: "New height" },
        text: { type: "string", description: "New text content" },
        label: { type: "string", description: "New label" },
        color: { type: "string", description: "New color" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "deleteNode",
    description: "Delete a node from the canvas.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID of the node to delete" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "createEdge",
    description: "Create a connection (edge) between two nodes.",
    parameters: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source node ID" },
        target: { type: "string", description: "Target node ID" },
        label: { type: "string", description: "Edge label text" },
      },
      required: ["source", "target"],
    },
  },
  {
    name: "deleteEdge",
    description: "Delete an edge from the canvas.",
    parameters: {
      type: "object",
      properties: {
        edgeId: { type: "string", description: "ID of the edge to delete" },
      },
      required: ["edgeId"],
    },
  },
  {
    name: "sendMessage",
    description:
      "Send a chat message to explain what you did, suggest next steps, or respond to users. Use this to communicate your reasoning.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message text" },
      },
      required: ["text"],
    },
  },
  {
    name: "groupNodes",
    description:
      "Create a visual group around a set of nodes with a label. Groups help organize related items on the canvas.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          description: "IDs of nodes to group",
          items: { type: "string", description: "Node ID" },
        },
        label: { type: "string", description: "Label for the group" },
        color: { type: "string", description: "Group background color as oklch string" },
      },
      required: ["nodeIds", "label"],
    },
  },
  {
    name: "rearrangeNodes",
    description:
      "Rearrange a set of nodes into a layout pattern. Use for organizing scattered items.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          description: "IDs of nodes to rearrange",
          items: { type: "string", description: "Node ID" },
        },
        layout: {
          type: "string",
          description: "Layout pattern to apply",
          enum: ["grid", "horizontal", "vertical", "cluster"],
        },
        spacing: { type: "number", description: "Spacing between nodes in pixels. Default 40." },
      },
      required: ["nodeIds", "layout"],
    },
  },
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend/ai_agent_service && npx vitest run src/tools/__tests__/canvas-tools.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/ai_agent_service/src/types.ts backend/ai_agent_service/src/tools/
git commit -m "feat: add shared types and canvas tool definitions for LLM"
```

---

## Task 4: Transcript Input Interface

**Files:**
- Create: `backend/ai_agent_service/src/transcript/types.ts`
- Create: `backend/ai_agent_service/src/transcript/webhook-source.ts`
- Test: `backend/ai_agent_service/src/transcript/__tests__/webhook-source.test.ts`

- [ ] **Step 1: Define transcript types**

```typescript
// backend/ai_agent_service/src/transcript/types.ts

export interface TranscriptEvent {
  room_id: string;
  speaker_id: string;
  speaker_name: string;
  text: string;
  timestamp: number;
  is_final: boolean;
}

export interface TranscriptSource {
  subscribe(roomId: string, handler: (event: TranscriptEvent) => void): void;
  unsubscribe(roomId: string): void;
}
```

- [ ] **Step 2: Write the failing test for webhook source**

```typescript
// backend/ai_agent_service/src/transcript/__tests__/webhook-source.test.ts
import { describe, it, expect, vi } from "vitest";
import { WebhookTranscriptSource } from "../webhook-source.js";
import type { TranscriptEvent } from "../types.js";

describe("WebhookTranscriptSource", () => {
  it("dispatches events to subscribed room handlers", () => {
    const source = new WebhookTranscriptSource();
    const handler = vi.fn();

    source.subscribe("room-1", handler);

    const event: TranscriptEvent = {
      room_id: "room-1",
      speaker_id: "user-1",
      speaker_name: "Alice",
      text: "hello world",
      timestamp: Date.now(),
      is_final: true,
    };

    source.handleEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("ignores events for non-final transcripts", () => {
    const source = new WebhookTranscriptSource();
    const handler = vi.fn();

    source.subscribe("room-1", handler);

    source.handleEvent({
      room_id: "room-1",
      speaker_id: "user-1",
      speaker_name: "Alice",
      text: "hel",
      timestamp: Date.now(),
      is_final: false,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not dispatch after unsubscribe", () => {
    const source = new WebhookTranscriptSource();
    const handler = vi.fn();

    source.subscribe("room-1", handler);
    source.unsubscribe("room-1");

    source.handleEvent({
      room_id: "room-1",
      speaker_id: "user-1",
      speaker_name: "Alice",
      text: "hello",
      timestamp: Date.now(),
      is_final: true,
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend/ai_agent_service && npx vitest run src/transcript/__tests__/webhook-source.test.ts`

Expected: FAIL — module not found

- [ ] **Step 4: Implement webhook source**

```typescript
// backend/ai_agent_service/src/transcript/webhook-source.ts
import type { TranscriptEvent, TranscriptSource } from "./types.js";

export class WebhookTranscriptSource implements TranscriptSource {
  private handlers = new Map<string, (event: TranscriptEvent) => void>();

  subscribe(roomId: string, handler: (event: TranscriptEvent) => void): void {
    this.handlers.set(roomId, handler);
  }

  unsubscribe(roomId: string): void {
    this.handlers.delete(roomId);
  }

  handleEvent(event: TranscriptEvent): void {
    if (!event.is_final) return;
    const handler = this.handlers.get(event.room_id);
    if (handler) handler(event);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend/ai_agent_service && npx vitest run src/transcript/__tests__/webhook-source.test.ts`

Expected: PASS

- [ ] **Step 6: Wire transcript webhook into Express**

Update `backend/ai_agent_service/src/index.ts`:

```typescript
// backend/ai_agent_service/src/index.ts
import express from "express";
import { config } from "./config.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";

const app = express();
app.use(express.json());

export const transcriptSource = new WebhookTranscriptSource();

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/transcript", (req, res) => {
  transcriptSource.handleEvent(req.body);
  res.json({ ok: true });
});

app.listen(config.server.port, () => {
  console.log(`AI Agent Service running on port ${config.server.port}`);
});
```

- [ ] **Step 7: Commit**

```bash
git add backend/ai_agent_service/src/transcript/ backend/ai_agent_service/src/index.ts
git commit -m "feat: add transcript input interface with webhook source"
```

---

## Task 5: Context Accumulator

**Files:**
- Create: `backend/ai_agent_service/src/context-accumulator.ts`
- Test: `backend/ai_agent_service/src/context-accumulator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/ai_agent_service/src/context-accumulator.test.ts
import { describe, it, expect } from "vitest";
import { ContextAccumulator } from "./context-accumulator.js";
import type { CanvasNode, TranscriptSegment } from "./types.js";

describe("ContextAccumulator", () => {
  it("builds context with canvas snapshot and transcript", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

    const node: CanvasNode = {
      id: "node-1",
      type: "sticky_note",
      position: { x: 100, y: 200 },
      data: { type: "sticky_note", text: "Hello", color: "#yellow", textColor: "#000", fontSize: 14 },
    };

    acc.updateCanvasSnapshot([node], []);
    acc.addTranscriptSegment({
      speakerId: "user-1",
      speakerName: "Alice",
      text: "Let's add a user flow",
      timestamp: 1000,
    });

    const context = acc.buildContext();

    expect(context).toContain("node-1");
    expect(context).toContain("sticky_note");
    expect(context).toContain("Hello");
    expect(context).toContain("Alice");
    expect(context).toContain("user flow");
  });

  it("limits transcript segments to maxTranscriptSegments", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 2, maxRecentChanges: 10 });

    acc.addTranscriptSegment({ speakerId: "u1", speakerName: "A", text: "first", timestamp: 1 });
    acc.addTranscriptSegment({ speakerId: "u1", speakerName: "A", text: "second", timestamp: 2 });
    acc.addTranscriptSegment({ speakerId: "u1", speakerName: "A", text: "third", timestamp: 3 });

    const context = acc.buildContext();

    expect(context).not.toContain("first");
    expect(context).toContain("second");
    expect(context).toContain("third");
  });

  it("tracks recent changes", () => {
    const acc = new ContextAccumulator({ maxTranscriptSegments: 5, maxRecentChanges: 10 });

    acc.addChange("user-1", "created node-1 (sticky_note)");

    const context = acc.buildContext();
    expect(context).toContain("created node-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/ai_agent_service && npx vitest run src/context-accumulator.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement context accumulator**

```typescript
// backend/ai_agent_service/src/context-accumulator.ts
import type { CanvasNode, CanvasEdge, TranscriptSegment } from "./types.js";

interface AccumulatorConfig {
  maxTranscriptSegments: number;
  maxRecentChanges: number;
}

interface ChangeEntry {
  userId: string;
  description: string;
  timestamp: number;
}

export class ContextAccumulator {
  private nodes: CanvasNode[] = [];
  private edges: CanvasEdge[] = [];
  private transcript: TranscriptSegment[] = [];
  private recentChanges: ChangeEntry[] = [];
  private config: AccumulatorConfig;

  constructor(config: AccumulatorConfig) {
    this.config = config;
  }

  updateCanvasSnapshot(nodes: CanvasNode[], edges: CanvasEdge[]): void {
    this.nodes = nodes;
    this.edges = edges;
  }

  addTranscriptSegment(segment: TranscriptSegment): void {
    this.transcript.push(segment);
    if (this.transcript.length > this.config.maxTranscriptSegments) {
      this.transcript = this.transcript.slice(-this.config.maxTranscriptSegments);
    }
  }

  addChange(userId: string, description: string): void {
    this.recentChanges.push({ userId, description, timestamp: Date.now() });
    if (this.recentChanges.length > this.config.maxRecentChanges) {
      this.recentChanges = this.recentChanges.slice(-this.config.maxRecentChanges);
    }
  }

  buildContext(): string {
    const sections: string[] = [];

    // Canvas state
    if (this.nodes.length > 0 || this.edges.length > 0) {
      const nodeDescriptions = this.nodes.map((n) => {
        const dataStr = JSON.stringify(n.data);
        return `  - ${n.id} (${n.type}) at (${n.position.x}, ${n.position.y}): ${dataStr}`;
      });
      const edgeDescriptions = this.edges.map(
        (e) => `  - ${e.id}: ${e.source} -> ${e.target}${e.label ? ` [${e.label}]` : ""}`
      );
      sections.push(
        `## Canvas State\nNodes (${this.nodes.length}):\n${nodeDescriptions.join("\n")}\nEdges (${this.edges.length}):\n${edgeDescriptions.join("\n") || "  (none)"}`
      );
    } else {
      sections.push("## Canvas State\nThe canvas is empty.");
    }

    // Recent changes
    if (this.recentChanges.length > 0) {
      const changeLines = this.recentChanges.map(
        (c) => `  - ${c.userId}: ${c.description}`
      );
      sections.push(`## Recent Changes\n${changeLines.join("\n")}`);
    }

    // Transcript
    if (this.transcript.length > 0) {
      const transcriptLines = this.transcript.map(
        (t) => `  [${t.speakerName}]: ${t.text}`
      );
      sections.push(`## Recent Conversation\n${transcriptLines.join("\n")}`);
    }

    return sections.join("\n\n");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/ai_agent_service && npx vitest run src/context-accumulator.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ai_agent_service/src/context-accumulator.ts backend/ai_agent_service/src/context-accumulator.test.ts
git commit -m "feat: add context accumulator for rolling LLM context window"
```

---

## Task 6: Decision Engine

**Files:**
- Create: `backend/ai_agent_service/src/decision-engine.ts`
- Test: `backend/ai_agent_service/src/decision-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/ai_agent_service/src/decision-engine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DecisionEngine } from "./decision-engine.js";
import type { Intensity } from "./types.js";

describe("DecisionEngine", () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  it("always triggers on direct mention regardless of intensity", () => {
    engine.setIntensity("quiet");
    const result = engine.shouldAct({
      hasDirectMention: true,
      timeSinceLastChange: 0,
      timeSinceLastAction: 0,
      changeCount: 0,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(true);
  });

  it("quiet mode triggers on long silence after changes", () => {
    engine.setIntensity("quiet");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 20_000,
      timeSinceLastAction: 30_000,
      changeCount: 3,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(true);
  });

  it("quiet mode does not trigger on recent activity", () => {
    engine.setIntensity("quiet");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 2000,
      timeSinceLastAction: 5000,
      changeCount: 1,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(false);
  });

  it("balanced mode triggers on moderate pause with changes", () => {
    engine.setIntensity("balanced");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 8000,
      timeSinceLastAction: 15_000,
      changeCount: 3,
      hasTranscriptActivity: true,
    });
    expect(result).toBe(true);
  });

  it("active mode triggers on any change with short cooldown", () => {
    engine.setIntensity("active");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 3000,
      timeSinceLastAction: 10_000,
      changeCount: 1,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(true);
  });

  it("active mode respects minimum cooldown", () => {
    engine.setIntensity("active");
    const result = engine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: 1000,
      timeSinceLastAction: 2000,
      changeCount: 1,
      hasTranscriptActivity: false,
    });
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/ai_agent_service && npx vitest run src/decision-engine.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement decision engine**

```typescript
// backend/ai_agent_service/src/decision-engine.ts
import type { Intensity } from "./types.js";

interface DecisionInput {
  hasDirectMention: boolean;
  timeSinceLastChange: number;     // ms since last canvas/chat change
  timeSinceLastAction: number;     // ms since agent last acted
  changeCount: number;             // number of changes in recent window
  hasTranscriptActivity: boolean;  // recent speech detected
}

interface IntensityThresholds {
  silenceThreshold: number;   // ms of silence before acting
  cooldown: number;           // minimum ms between agent actions
  minChanges: number;         // minimum changes before considering action
}

const THRESHOLDS: Record<Intensity, IntensityThresholds> = {
  quiet: {
    silenceThreshold: 15_000,
    cooldown: 30_000,
    minChanges: 2,
  },
  balanced: {
    silenceThreshold: 7_000,
    cooldown: 12_000,
    minChanges: 2,
  },
  active: {
    silenceThreshold: 3_000,
    cooldown: 5_000,
    minChanges: 1,
  },
};

export class DecisionEngine {
  private intensity: Intensity = "balanced";

  setIntensity(intensity: Intensity): void {
    this.intensity = intensity;
  }

  getIntensity(): Intensity {
    return this.intensity;
  }

  shouldAct(input: DecisionInput): boolean {
    // Always act on direct mentions
    if (input.hasDirectMention) return true;

    const thresholds = THRESHOLDS[this.intensity];

    // Respect cooldown
    if (input.timeSinceLastAction < thresholds.cooldown) return false;

    // Check if enough silence has passed and enough changes accumulated
    if (
      input.timeSinceLastChange >= thresholds.silenceThreshold &&
      input.changeCount >= thresholds.minChanges
    ) {
      return true;
    }

    // Balanced and active: also trigger on transcript activity with changes
    if (
      this.intensity !== "quiet" &&
      input.hasTranscriptActivity &&
      input.changeCount >= thresholds.minChanges &&
      input.timeSinceLastChange >= thresholds.silenceThreshold
    ) {
      return true;
    }

    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/ai_agent_service && npx vitest run src/decision-engine.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ai_agent_service/src/decision-engine.ts backend/ai_agent_service/src/decision-engine.test.ts
git commit -m "feat: add decision engine with configurable intensity thresholds"
```

---

## Task 7: Action Executor

**Files:**
- Create: `backend/ai_agent_service/src/action-executor.ts`
- Test: `backend/ai_agent_service/src/action-executor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/ai_agent_service/src/action-executor.test.ts
import { describe, it, expect, vi } from "vitest";
import { ActionExecutor } from "./action-executor.js";
import type { ToolCall } from "./llm/types.js";

// Mock storage that tracks mutations
function createMockStorage() {
  const nodes = new Map<string, Record<string, unknown>>();
  const edges = new Map<string, Record<string, unknown>>();
  const messages: string[] = [];

  return {
    nodes,
    edges,
    messages,
    getNodes: () => Array.from(nodes.entries()).map(([id, data]) => ({ id, ...data })),
    getEdges: () => Array.from(edges.entries()).map(([id, data]) => ({ id, ...data })),
    setNode: (id: string, data: Record<string, unknown>) => nodes.set(id, data),
    deleteNode: (id: string) => nodes.delete(id),
    setEdge: (id: string, data: Record<string, unknown>) => edges.set(id, data),
    deleteEdge: (id: string) => edges.delete(id),
    sendMessage: (text: string) => messages.push(text),
  };
}

describe("ActionExecutor", () => {
  it("executes createNode tool call", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    const toolCall: ToolCall = {
      name: "createNode",
      arguments: {
        nodeType: "sticky_note",
        position: { x: 100, y: 200 },
        text: "Hello",
        color: "#yellow",
      },
    };

    await executor.execute([toolCall]);

    expect(storage.nodes.size).toBe(1);
    const node = Array.from(storage.nodes.values())[0];
    expect(node.type).toBe("sticky_note");
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it("executes deleteNode tool call", async () => {
    const storage = createMockStorage();
    storage.setNode("node-1", { type: "shape" });

    const executor = new ActionExecutor(storage);

    await executor.execute([{ name: "deleteNode", arguments: { nodeId: "node-1" } }]);

    expect(storage.nodes.size).toBe(0);
  });

  it("executes sendMessage tool call", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    await executor.execute([{ name: "sendMessage", arguments: { text: "I organized the board" } }]);

    expect(storage.messages).toEqual(["I organized the board"]);
  });

  it("executes multiple tool calls in sequence", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    await executor.execute([
      { name: "createNode", arguments: { nodeType: "shape", position: { x: 0, y: 0 }, shapeKind: "rectangle" } },
      { name: "createNode", arguments: { nodeType: "shape", position: { x: 200, y: 0 }, shapeKind: "rectangle" } },
      { name: "sendMessage", arguments: { text: "Added two shapes" } },
    ]);

    expect(storage.nodes.size).toBe(2);
    expect(storage.messages).toEqual(["Added two shapes"]);
  });

  it("skips unknown tool calls without throwing", async () => {
    const storage = createMockStorage();
    const executor = new ActionExecutor(storage);

    await executor.execute([{ name: "unknownTool", arguments: {} }]);

    expect(storage.nodes.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/ai_agent_service && npx vitest run src/action-executor.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement action executor**

```typescript
// backend/ai_agent_service/src/action-executor.ts
import type { ToolCall } from "./llm/types.js";
import { randomUUID } from "node:crypto";

export interface StorageAdapter {
  setNode: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  setEdge: (id: string, data: Record<string, unknown>) => void;
  deleteEdge: (id: string) => void;
  sendMessage: (text: string) => void;
  getNodes: () => Array<{ id: string; position?: { x: number; y: number }; width?: number; height?: number }>;
}

export class ActionExecutor {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async execute(toolCalls: ToolCall[]): Promise<void> {
    for (const call of toolCalls) {
      this.executeOne(call);
    }
  }

  private executeOne(call: ToolCall): void {
    switch (call.name) {
      case "createNode":
        this.handleCreateNode(call.arguments);
        break;
      case "updateNode":
        this.handleUpdateNode(call.arguments);
        break;
      case "deleteNode":
        this.storage.deleteNode(call.arguments.nodeId as string);
        break;
      case "createEdge":
        this.handleCreateEdge(call.arguments);
        break;
      case "deleteEdge":
        this.storage.deleteEdge(call.arguments.edgeId as string);
        break;
      case "sendMessage":
        this.storage.sendMessage(call.arguments.text as string);
        break;
      case "groupNodes":
        this.handleGroupNodes(call.arguments);
        break;
      case "rearrangeNodes":
        this.handleRearrange(call.arguments);
        break;
      default:
        console.warn(`Unknown tool call: ${call.name}`);
    }
  }

  private handleCreateNode(args: Record<string, unknown>): void {
    const id = `agent-${randomUUID().slice(0, 8)}`;
    const nodeType = args.nodeType as string;
    const position = args.position as { x: number; y: number };
    const width = (args.width as number) ?? 150;
    const height = (args.height as number) ?? 80;

    const data: Record<string, unknown> = { type: nodeType };

    if (nodeType === "shape") {
      data.shapeKind = args.shapeKind ?? "rectangle";
      data.color = args.color ?? "oklch(0.768 0.233 130.85)";
      data.paintStyle = args.paintStyle ?? "solid";
      data.strokeWidth = 2;
      data.label = args.label ?? "";
    } else if (nodeType === "text") {
      data.text = args.text ?? "";
      data.color = args.color ?? "oklch(0.268 0 0)";
      data.fontSize = args.fontSize ?? 16;
      data.fontWeight = "normal";
      data.align = "left";
    } else if (nodeType === "sticky_note") {
      data.text = args.text ?? "";
      data.color = args.color ?? "oklch(0.92 0.17 122)";
      data.textColor = "oklch(0.268 0 0)";
      data.fontSize = args.fontSize ?? 14;
    }

    this.storage.setNode(id, { type: nodeType, position, width, height, data });
  }

  private handleUpdateNode(args: Record<string, unknown>): void {
    const nodeId = args.nodeId as string;
    const updates: Record<string, unknown> = {};

    if (args.position) updates.position = args.position;
    if (args.width) updates.width = args.width;
    if (args.height) updates.height = args.height;
    if (args.text !== undefined) updates["data.text"] = args.text;
    if (args.label !== undefined) updates["data.label"] = args.label;
    if (args.color !== undefined) updates["data.color"] = args.color;

    // Merge into existing node — the Liveblocks adapter will handle LiveObject.update()
    this.storage.setNode(nodeId, updates);
  }

  private handleCreateEdge(args: Record<string, unknown>): void {
    const id = `agent-edge-${randomUUID().slice(0, 8)}`;
    this.storage.setEdge(id, {
      source: args.source,
      target: args.target,
      label: args.label ?? "",
    });
  }

  private handleGroupNodes(args: Record<string, unknown>): void {
    const nodeIds = args.nodeIds as string[];
    const label = args.label as string;
    const color = (args.color as string) ?? "oklch(0.9 0.05 130)";

    // Create a group node that visually contains the specified nodes
    const id = `agent-group-${randomUUID().slice(0, 8)}`;
    const allNodes = this.storage.getNodes();
    const targetNodes = allNodes.filter((n) => nodeIds.includes(n.id));

    if (targetNodes.length === 0) return;

    // Calculate bounding box of target nodes
    const padding = 40;
    const minX = Math.min(...targetNodes.map((n) => n.position?.x ?? 0)) - padding;
    const minY = Math.min(...targetNodes.map((n) => n.position?.y ?? 0)) - padding - 30;
    const maxX = Math.max(...targetNodes.map((n) => (n.position?.x ?? 0) + (n.width ?? 150))) + padding;
    const maxY = Math.max(...targetNodes.map((n) => (n.position?.y ?? 0) + (n.height ?? 80))) + padding;

    this.storage.setNode(id, {
      type: "group",
      position: { x: minX, y: minY },
      width: maxX - minX,
      height: maxY - minY,
      data: { type: "group", label, color },
    });
  }

  private handleRearrange(args: Record<string, unknown>): void {
    const nodeIds = args.nodeIds as string[];
    const layout = args.layout as string;
    const spacing = (args.spacing as number) ?? 40;

    const allNodes = this.storage.getNodes();
    const targetNodes = allNodes.filter((n) => nodeIds.includes(n.id));

    if (targetNodes.length === 0) return;

    // Find top-left anchor from existing positions
    const anchor = targetNodes.reduce(
      (acc, n) => ({
        x: Math.min(acc.x, n.position?.x ?? 0),
        y: Math.min(acc.y, n.position?.y ?? 0),
      }),
      { x: Infinity, y: Infinity }
    );

    const nodeWidth = 150;
    const nodeHeight = 80;

    targetNodes.forEach((node, i) => {
      let position: { x: number; y: number };

      switch (layout) {
        case "horizontal":
          position = { x: anchor.x + i * (nodeWidth + spacing), y: anchor.y };
          break;
        case "vertical":
          position = { x: anchor.x, y: anchor.y + i * (nodeHeight + spacing) };
          break;
        case "grid": {
          const cols = Math.ceil(Math.sqrt(targetNodes.length));
          const col = i % cols;
          const row = Math.floor(i / cols);
          position = {
            x: anchor.x + col * (nodeWidth + spacing),
            y: anchor.y + row * (nodeHeight + spacing),
          };
          break;
        }
        case "cluster":
        default:
          // Cluster = tighter grid
          position = {
            x: anchor.x + (i % 3) * (nodeWidth + spacing / 2),
            y: anchor.y + Math.floor(i / 3) * (nodeHeight + spacing / 2),
          };
          break;
      }

      this.storage.setNode(node.id, { position });
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/ai_agent_service && npx vitest run src/action-executor.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ai_agent_service/src/action-executor.ts backend/ai_agent_service/src/action-executor.test.ts
git commit -m "feat: add action executor for translating LLM tool calls to storage ops"
```

---

## Task 8: Room Manager (Liveblocks Integration)

**Files:**
- Create: `backend/ai_agent_service/src/room-manager.ts`
- Modify: `backend/ai_agent_service/src/index.ts`

This is the integration layer that connects all modules. It uses the `@liveblocks/node` SDK to join rooms and wire up the context accumulator, decision engine, and action executor.

- [ ] **Step 1: Implement room manager**

```typescript
// backend/ai_agent_service/src/room-manager.ts
import { Liveblocks } from "@liveblocks/node";
import { config } from "./config.js";
import { ContextAccumulator } from "./context-accumulator.js";
import { DecisionEngine } from "./decision-engine.js";
import { ActionExecutor, type StorageAdapter } from "./action-executor.js";
import { canvasTools } from "./tools/canvas-tools.js";
import { createProviderRouter } from "./llm/provider-router.js";
import { createClaudeProvider } from "./llm/claude-provider.js";
import { createOpenAIProvider } from "./llm/openai-provider.js";
import type { LLMProvider, Message } from "./llm/types.js";
import type { Intensity, TranscriptSegment } from "./types.js";
import type { TranscriptSource } from "./transcript/types.js";

const SYSTEM_PROMPT = `You are an AI assistant participating in a collaborative canvas whiteboarding session. You can see what's on the canvas and hear what users are saying.

Your role:
- Help organize and structure ideas on the canvas
- Create visual representations of concepts being discussed
- Suggest connections between items
- Label and annotate existing items when helpful
- Keep the canvas organized and readable

Guidelines:
- Always explain what you're doing via sendMessage
- Don't make too many changes at once — prefer 1-3 actions per intervention
- Respect the existing layout and don't move things users clearly positioned intentionally
- Use sticky notes for new ideas, shapes for structural elements, edges for connections
- Match the visual style already on the canvas

You have access to tools for manipulating the canvas and sending chat messages.`;

interface RoomSession {
  accumulator: ContextAccumulator;
  decisionEngine: DecisionEngine;
  lastActionTime: number;
  lastChangeTime: number;
  changeCount: number;
  evaluationTimer: ReturnType<typeof setInterval> | null;
}

export class RoomManager {
  private liveblocks: Liveblocks;
  private llm: LLMProvider;
  private sessions = new Map<string, RoomSession>();
  private transcriptSource: TranscriptSource;

  constructor(transcriptSource: TranscriptSource) {
    this.liveblocks = new Liveblocks({ secret: config.liveblocks.secretKey });
    this.transcriptSource = transcriptSource;

    const claude = createClaudeProvider(config.llm.anthropic.apiKey, config.llm.anthropic.model);
    const openai = createOpenAIProvider(config.llm.openai.apiKey, config.llm.openai.model);
    this.llm = createProviderRouter({ claude, openai }, config.llm.provider);
  }

  async joinRoom(roomId: string): Promise<void> {
    if (this.sessions.has(roomId)) return;

    const session: RoomSession = {
      accumulator: new ContextAccumulator({ maxTranscriptSegments: 20, maxRecentChanges: 30 }),
      decisionEngine: new DecisionEngine(),
      lastActionTime: 0,
      lastChangeTime: Date.now(),
      changeCount: 0,
      evaluationTimer: null,
    };

    this.sessions.set(roomId, session);

    // Subscribe to transcript events for this room
    this.transcriptSource.subscribe(roomId, (event) => {
      session.accumulator.addTranscriptSegment({
        speakerId: event.speaker_id,
        speakerName: event.speaker_name,
        text: event.text,
        timestamp: event.timestamp,
      });
      session.lastChangeTime = Date.now();
      session.changeCount++;
    });

    // Start periodic evaluation loop
    session.evaluationTimer = setInterval(() => {
      this.evaluate(roomId).catch((err) =>
        console.error(`Evaluation error in room ${roomId}:`, err)
      );
    }, 3000);

    // Load initial canvas state
    await this.syncCanvasState(roomId);

    console.log(`Joined room: ${roomId}`);
  }

  async leaveRoom(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    if (session.evaluationTimer) clearInterval(session.evaluationTimer);
    this.transcriptSource.unsubscribe(roomId);
    this.sessions.delete(roomId);

    console.log(`Left room: ${roomId}`);
  }

  async handleStorageChange(roomId: string, description: string, userId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    session.accumulator.addChange(userId, description);
    session.lastChangeTime = Date.now();
    session.changeCount++;

    await this.syncCanvasState(roomId);
  }

  async handleDirectMessage(roomId: string, message: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    await this.syncCanvasState(roomId);

    // Direct messages bypass the decision engine
    await this.act(roomId, session, true);
  }

  private async syncCanvasState(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    try {
      const storage = await this.liveblocks.getStorageDocument(roomId, "json");
      const root = storage.data as Record<string, unknown>;
      const nodes = (root.nodes ?? []) as Array<Record<string, unknown>>;
      const edges = (root.edges ?? []) as Array<Record<string, unknown>>;

      session.accumulator.updateCanvasSnapshot(
        nodes.map((n) => ({
          id: n.id as string,
          type: (n.data as Record<string, unknown>)?.type as string ?? "shape",
          position: n.position as { x: number; y: number },
          width: n.width as number | undefined,
          height: n.height as number | undefined,
          data: n.data as any,
        })),
        edges.map((e) => ({
          id: e.id as string,
          source: e.source as string,
          target: e.target as string,
          label: e.label as string | undefined,
        }))
      );

      // Read intensity setting from storage and update decision engine
      const intensity = root.agentIntensity as string | undefined;
      if (intensity === "quiet" || intensity === "balanced" || intensity === "active") {
        session.decisionEngine.setIntensity(intensity);
      }
    } catch (err) {
      console.error(`Failed to sync canvas state for room ${roomId}:`, err);
    }
  }

  private async evaluate(roomId: string): Promise<void> {
    const session = this.sessions.get(roomId);
    if (!session) return;

    const now = Date.now();
    const shouldAct = session.decisionEngine.shouldAct({
      hasDirectMention: false,
      timeSinceLastChange: now - session.lastChangeTime,
      timeSinceLastAction: now - session.lastActionTime,
      changeCount: session.changeCount,
      hasTranscriptActivity: session.accumulator.buildContext().includes("## Recent Conversation"),
    });

    if (shouldAct) {
      await this.act(roomId, session, false);
    }
  }

  private async act(roomId: string, session: RoomSession, isDirect: boolean): Promise<void> {
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

    try {
      const response = await this.llm.chat(messages, canvasTools);

      if (response.toolCalls.length > 0) {
        const adapter = this.createStorageAdapter(roomId);
        const executor = new ActionExecutor(adapter);
        await executor.execute(response.toolCalls);
        await adapter.flush();
      }

      if (response.text && !response.toolCalls.some((tc) => tc.name === "sendMessage")) {
        // If LLM returned text but no sendMessage, send it as a chat message
        const adapter = this.createStorageAdapter(roomId);
        adapter.sendMessage(response.text);
        await adapter.flush();
      }

      session.lastActionTime = Date.now();
      session.changeCount = 0;
    } catch (err) {
      console.error(`Action error in room ${roomId}:`, err);
    }
  }

  private createStorageAdapter(roomId: string): StorageAdapter & { flush(): Promise<void> } {
    const mutations: Array<() => void> = [];
    const messageQueue: string[] = [];
    const liveblocks = this.liveblocks;

    return {
      getNodes() {
        // For rearrange — will be populated from accumulator snapshot
        return [];
      },
      setNode(id: string, data: Record<string, unknown>) {
        mutations.push(() => {
          // Will be applied during flush via mutateStorage
          (globalThis as any).__pendingNodeSets ??= [];
          (globalThis as any).__pendingNodeSets.push({ id, data });
        });
      },
      deleteNode(id: string) {
        mutations.push(() => {
          (globalThis as any).__pendingNodeDeletes ??= [];
          (globalThis as any).__pendingNodeDeletes.push(id);
        });
      },
      setEdge(id: string, data: Record<string, unknown>) {
        mutations.push(() => {
          (globalThis as any).__pendingEdgeSets ??= [];
          (globalThis as any).__pendingEdgeSets.push({ id, data });
        });
      },
      deleteEdge(id: string) {
        mutations.push(() => {
          (globalThis as any).__pendingEdgeDeletes ??= [];
          (globalThis as any).__pendingEdgeDeletes.push(id);
        });
      },
      sendMessage(text: string) {
        messageQueue.push(text);
      },
      async flush() {
        // Collect all pending mutations
        (globalThis as any).__pendingNodeSets = [];
        (globalThis as any).__pendingNodeDeletes = [];
        (globalThis as any).__pendingEdgeSets = [];
        (globalThis as any).__pendingEdgeDeletes = [];

        for (const mut of mutations) mut();

        const nodeSets = (globalThis as any).__pendingNodeSets as Array<{ id: string; data: Record<string, unknown> }>;
        const nodeDeletes = (globalThis as any).__pendingNodeDeletes as string[];
        const edgeSets = (globalThis as any).__pendingEdgeSets as Array<{ id: string; data: Record<string, unknown> }>;
        const edgeDeletes = (globalThis as any).__pendingEdgeDeletes as string[];

        // Apply via Liveblocks mutateStorage
        if (nodeSets.length > 0 || nodeDeletes.length > 0 || edgeSets.length > 0 || edgeDeletes.length > 0) {
          // Note: The exact Liveblocks storage mutation API depends on your room storage schema.
          // This uses the REST API approach via sendYjsMessage or mutateStorage.
          // The actual implementation will use the room's LiveObject/LiveMap structure
          // as defined in the frontend's liveblocks.config.ts and useLiveblocksFlow hook.
          //
          // For now, we use the Liveblocks REST API to update storage.
          // This will be refined in Task 10 when we integrate with the actual storage schema.
          console.log(`Flushing mutations for room ${roomId}:`, {
            nodeSets: nodeSets.length,
            nodeDeletes: nodeDeletes.length,
            edgeSets: edgeSets.length,
            edgeDeletes: edgeDeletes.length,
          });
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
                  version: 1,
                  content: [{ type: "paragraph", children: [{ text }] }],
                },
              },
            });
          } catch {
            // Thread might not exist yet — create it
            try {
              await liveblocks.createThread({
                roomId,
                data: {
                  userId: "ai-agent",
                  body: {
                    version: 1,
                    content: [{ type: "paragraph", children: [{ text }] }],
                  },
                  metadata: {},
                },
              });
            } catch (err) {
              console.error("Failed to send agent message:", err);
            }
          }
        }

        // Cleanup
        delete (globalThis as any).__pendingNodeSets;
        delete (globalThis as any).__pendingNodeDeletes;
        delete (globalThis as any).__pendingEdgeSets;
        delete (globalThis as any).__pendingEdgeDeletes;
      },
    };
  }
}
```

- [ ] **Step 2: Update index.ts to bootstrap room manager**

```typescript
// backend/ai_agent_service/src/index.ts
import express from "express";
import { config } from "./config.js";
import { WebhookTranscriptSource } from "./transcript/webhook-source.js";
import { RoomManager } from "./room-manager.js";

const app = express();
app.use(express.json());

const transcriptSource = new WebhookTranscriptSource();
const roomManager = new RoomManager(transcriptSource);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Transcript webhook from LiveKit transcription service
app.post("/api/transcript", (req, res) => {
  transcriptSource.handleEvent(req.body);
  res.json({ ok: true });
});

// Room lifecycle — called by API service or Liveblocks webhooks
app.post("/api/rooms/:roomId/join", async (req, res) => {
  await roomManager.joinRoom(req.params.roomId);
  res.json({ ok: true });
});

app.post("/api/rooms/:roomId/leave", async (req, res) => {
  await roomManager.leaveRoom(req.params.roomId);
  res.json({ ok: true });
});

// Liveblocks webhook endpoint for storage changes and room events
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
  } else if (event.type === "userLeft") {
    // Could check if room is empty and leave
    // For now, keep the agent in the room
  }

  res.json({ ok: true });
});

app.listen(config.server.port, () => {
  console.log(`AI Agent Service running on port ${config.server.port}`);
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/ai_agent_service/src/room-manager.ts backend/ai_agent_service/src/index.ts
git commit -m "feat: add room manager with Liveblocks integration and evaluation loop"
```

---

## Task 9: Slim Down Canvas Service Backend

**Files:**
- Modify: `backend/canvas_service/main.py`
- Modify: `backend/canvas_service/core/config.py`
- Create: `backend/canvas_service/modules/liveblocks/__init__.py`
- Create: `backend/canvas_service/modules/liveblocks/router.py`
- Create: `backend/canvas_service/modules/liveblocks/service.py`

- [ ] **Step 1: Add Liveblocks secret to config**

Replace `backend/canvas_service/core/config.py`:

```python
# backend/canvas_service/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str
    liveblocks_secret_key: str

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 2: Create Liveblocks token endpoint**

```python
# backend/canvas_service/modules/liveblocks/__init__.py
```

```python
# backend/canvas_service/modules/liveblocks/service.py
import httpx
from core.config import settings


async def create_liveblocks_session(user_id: str, user_name: str, room_id: str) -> dict:
    """Generate a Liveblocks session token for the given user and room."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.liveblocks.io/v2/identify-user",
            headers={
                "Authorization": f"Bearer {settings.liveblocks_secret_key}",
                "Content-Type": "application/json",
            },
            json={
                "userId": user_id,
                "groupIds": [room_id],
                "userInfo": {
                    "name": user_name,
                },
            },
        )
        response.raise_for_status()
        return response.json()
```

```python
# backend/canvas_service/modules/liveblocks/router.py
from fastapi import APIRouter, Depends, Request
from core.auth import get_current_user
from modules.liveblocks.service import create_liveblocks_session

router = APIRouter(prefix="/api/liveblocks", tags=["liveblocks"])


@router.post("/auth")
async def liveblocks_auth(request: Request, user_id: str = Depends(get_current_user)):
    body = await request.json()
    room_id = body.get("room")
    user_name = body.get("userName", "User")

    result = await create_liveblocks_session(
        user_id=str(user_id),
        user_name=user_name,
        room_id=room_id,
    )
    return result
```

- [ ] **Step 3: Install httpx dependency**

Run:
```bash
cd backend/canvas_service && pip install httpx
```

Add `httpx` to `requirements.txt` if it exists, or note it as a dependency.

- [ ] **Step 4: Update main.py — remove redis, canvas_objects, collaboration; add liveblocks**

```python
# backend/canvas_service/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from modules.boards.router import router as boards_router
from modules.auth.router import router as auth_router
from modules.liveblocks.router import router as liveblocks_router

app = FastAPI(title="Canvas Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(boards_router)
app.include_router(liveblocks_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/canvas_service/
git commit -m "refactor: slim down canvas service — remove redis/canvas_objects/collaboration, add Liveblocks auth"
```

---

## Task 10: Update Liveblocks Config and Room Component

**Files:**
- Modify: `frontend/liveblocks.config.ts`
- Modify: `frontend/src/modules/Canvas/components/canvas/room.tsx`

- [ ] **Step 1: Update liveblocks.config.ts with agent presence and storage types**

```typescript
// frontend/liveblocks.config.ts

declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      type?: "user" | "ai_agent";
      status?: "watching" | "acting";
      intensity?: "quiet" | "balanced" | "active";
    };

    Storage: {
      agentIntensity: "quiet" | "balanced" | "active";
    };

    UserMeta: {
      id: string;
      info: {
        name: string;
      };
    };

    RoomEvent: Record<string, never>;

    ThreadMetadata: Record<string, never>;

    RoomInfo: Record<string, never>;
  }
}

export {};
```

- [ ] **Step 2: Update room.tsx to use auth endpoint instead of public key**

```typescript
// frontend/src/modules/Canvas/components/canvas/room.tsx
"use client";

import type { ReactNode } from "react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import { LoaderCircle } from "lucide-react";

type RoomProps = {
  children: ReactNode;
  roomId: string;
};

export function Room({ children, roomId }: RoomProps) {
  return (
    <LiveblocksProvider
      authEndpoint={`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/liveblocks/auth`}
    >
      <RoomProvider
        id={roomId}
        initialPresence={{ cursor: null, type: "user" }}
        initialStorage={{ agentIntensity: "balanced" }}
      >
        <ClientSideSuspense fallback={<RoomLoadingFallback />}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function RoomLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoaderCircle className="size-8 animate-spin text-lime-400" />
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx to pass roomId to Room**

In `frontend/src/App.tsx`, update the Room usage from `<Room>` to `<Room roomId="my-room">` (or a dynamic room ID from URL/state). The exact change depends on how boards are loaded, but at minimum pass the prop:

Find: `<Room>`
Replace: `<Room roomId="my-room">`

- [ ] **Step 4: Commit**

```bash
git add frontend/liveblocks.config.ts frontend/src/modules/Canvas/components/canvas/room.tsx frontend/src/App.tsx
git commit -m "feat: update Liveblocks config for agent presence and switch to auth endpoint"
```

---

## Task 11: Agent Presence Component

**Files:**
- Create: `frontend/src/modules/Agent/components/agent-presence.tsx`

- [ ] **Step 1: Create the agent presence indicator**

```typescript
// frontend/src/modules/Agent/components/agent-presence.tsx
import { useOthers } from "@liveblocks/react/suspense";
import { Bot } from "lucide-react";

export function AgentPresence() {
  const others = useOthers();
  const agent = others.find((o) => o.presence.type === "ai_agent");

  if (!agent) return null;

  const status = agent.presence.status ?? "watching";

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
      <Bot className="size-3.5 text-lime-500" />
      <span className="text-muted-foreground">AI Agent</span>
      <span
        className={
          status === "acting"
            ? "text-lime-500 animate-pulse"
            : "text-muted-foreground"
        }
      >
        {status === "acting" ? "acting..." : "watching"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/Agent/
git commit -m "feat: add agent presence indicator component"
```

---

## Task 12: Intensity Control Component

**Files:**
- Create: `frontend/src/modules/Agent/components/intensity-control.tsx`

- [ ] **Step 1: Create the intensity toggle**

```typescript
// frontend/src/modules/Agent/components/intensity-control.tsx
import { useMutation, useStorage } from "@liveblocks/react/suspense";
import { Volume, Volume1, Volume2 } from "lucide-react";

const intensityOptions = [
  { value: "quiet" as const, label: "Quiet", icon: Volume },
  { value: "balanced" as const, label: "Balanced", icon: Volume1 },
  { value: "active" as const, label: "Active", icon: Volume2 },
];

export function IntensityControl() {
  const intensity = useStorage((root) => root.agentIntensity);

  const setIntensity = useMutation(({ storage }, value: "quiet" | "balanced" | "active") => {
    storage.set("agentIntensity", value);
  }, []);

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
      {intensityOptions.map((option) => {
        const Icon = option.icon;
        const isActive = intensity === option.value;

        return (
          <button
            key={option.value}
            onClick={() => setIntensity(option.value)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              isActive
                ? "bg-lime-500/15 text-lime-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={`Set AI agent to ${option.label} mode`}
          >
            <Icon className="size-3" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/Agent/components/intensity-control.tsx
git commit -m "feat: add intensity control toggle for AI agent"
```

---

## Task 13: Replace Mock Chat with Liveblocks Comments

**Files:**
- Modify: `frontend/src/modules/Chat/components/Chat.tsx`

- [ ] **Step 1: Rewrite Chat.tsx to use Liveblocks Comments**

Replace the entire Chat component with a Liveblocks Comments integration. The existing file uses mock data with 100 hardcoded messages — we replace all of that.

```typescript
// frontend/src/modules/Chat/components/Chat.tsx
import { useThreads, useCreateThread } from "@liveblocks/react/suspense";
import { Thread } from "@liveblocks/react-ui";
import { useState, useRef } from "react";
import { Bot, Send, User } from "lucide-react";
import "@liveblocks/react-ui/styles.css";

export function Chat() {
  const { threads } = useThreads();
  const createThread = useCreateThread();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    createThread({
      body: {
        version: 1,
        content: [{ type: "paragraph", children: [{ text }] }],
      },
      metadata: {},
    });

    setInput("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {threads.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No messages yet
          </div>
        ) : (
          threads.map((thread) => (
            <Thread key={thread.id} thread={thread} className="mb-2" />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-lime-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-md bg-lime-500 px-3 py-1.5 text-sm text-black disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/Chat/components/Chat.tsx
git commit -m "feat: replace mock chat with Liveblocks Comments integration"
```

---

## Task 14: Wire Agent UI into Canvas Layout

**Files:**
- Modify: `frontend/src/modules/Canvas/components/canvas/flow-canvas/index.tsx` (add AgentPresence)
- Modify: `frontend/src/modules/Canvas/components/app-sidebar.tsx` (add IntensityControl)

- [ ] **Step 1: Add AgentPresence to the canvas status bar**

In `frontend/src/modules/Canvas/components/canvas/flow-canvas/index.tsx`, import and render the AgentPresence component in the canvas overlay area (near the existing status panel at the bottom).

Add the import at the top:
```typescript
import { AgentPresence } from "@/modules/Agent/components/agent-presence";
```

Then render `<AgentPresence />` next to the existing status panel in the canvas. Find the status panel JSX (the area showing object count, active tool, etc.) and add the AgentPresence component nearby:

```tsx
<AgentPresence />
```

The exact insertion point is in the Panel or overlay section of the ReactFlow component — place it in the bottom-left or top-right corner of the canvas.

- [ ] **Step 2: Add IntensityControl to the sidebar**

In `frontend/src/modules/Canvas/components/app-sidebar.tsx`, import and render the IntensityControl between the voice call and chat sections.

Add the import:
```typescript
import { IntensityControl } from "@/modules/Agent/components/intensity-control";
```

Add the component between the VoiceCall and Chat panels — render it as a small bar:

```tsx
<div className="flex items-center justify-between border-b border-border px-3 py-1.5">
  <span className="text-xs text-muted-foreground">AI Agent</span>
  <IntensityControl />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/Canvas/components/canvas/flow-canvas/index.tsx frontend/src/modules/Canvas/components/app-sidebar.tsx
git commit -m "feat: wire agent presence and intensity control into canvas layout"
```

---

## Task 15: End-to-End Smoke Test

**Files:** None new — this is a verification task.

- [ ] **Step 1: Start all services**

Terminal 1 — API Service:
```bash
cd backend/canvas_service && uvicorn main:app --reload --port 8000
```

Terminal 2 — AI Agent Service:
```bash
cd backend/ai_agent_service && npm run dev
```

Terminal 3 — Frontend:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verify health endpoints**

```bash
curl http://localhost:3001/healthz
```
Expected: `{"status":"ok"}`

```bash
curl http://localhost:8000/docs
```
Expected: FastAPI Swagger UI loads

- [ ] **Step 3: Verify frontend loads**

Open `http://localhost:5173` in browser.
Expected: Canvas loads with Liveblocks connection, intensity control visible in sidebar, no console errors about missing components.

- [ ] **Step 4: Test transcript webhook**

```bash
curl -X POST http://localhost:3001/api/transcript \
  -H "Content-Type: application/json" \
  -d '{"room_id":"my-room","speaker_id":"user-1","speaker_name":"Test","text":"hello world","timestamp":1712234567890,"is_final":true}'
```
Expected: `{"ok":true}`

- [ ] **Step 5: Test room join**

```bash
curl -X POST http://localhost:3001/api/rooms/my-room/join
```
Expected: `{"ok":true}` and console log `Joined room: my-room`

- [ ] **Step 6: Run all agent service tests**

```bash
cd backend/ai_agent_service && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 7: Verify frontend builds**

```bash
cd frontend && npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit any fixes needed**

```bash
git add -A && git commit -m "fix: address smoke test issues"
```
(Only if fixes were needed)
