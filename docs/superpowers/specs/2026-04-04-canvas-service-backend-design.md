# Canvas Service Backend Design

**Date:** 2026-04-04
**Context:** 24h hackathon, 4 experienced devs, Miro-like collaborative canvas board

---

## Overview

Backend service for a real-time collaborative canvas board (Miro-like). Frontend is handled by separate teammates using React Flow. This service is one of two backend services in the monorepo (`canvas_service` and `voice_call_service`).

**Tech Stack:**
| Layer | Choice |
|---|---|
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 (async) |
| Validation | Pydantic v2 |
| DB | Supabase PostgreSQL (no migrations — tables created via Supabase dashboard) |
| Cache / pub-sub | Redis (via `redis-py` async) |
| Auth | Supabase JWT verification (`python-jose`) |
| Image storage | Supabase Storage |
| Background tasks | `asyncio` recurring task started at app startup (snapshots) |
| Testing | pytest + httpx + pytest-asyncio |

---

## Architecture

Single FastAPI app with domain-driven modules. One deployable service, clean internal boundaries for parallel team development.

```
backend/canvas_service/
├── main.py
├── core/
│   ├── config.py            # Settings from env vars
│   ├── database.py          # SQLAlchemy async engine + session
│   ├── redis.py             # Redis async connection
│   └── auth.py              # Supabase JWT verification FastAPI dependency
├── modules/
│   ├── boards/              # Board CRUD + membership
│   │   ├── router.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── canvas_objects/      # Nodes + edges CRUD
│   │   ├── router.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── collaboration/       # WebSocket hub + real-time events
│   │   ├── router.py
│   │   ├── connection_manager.py
│   │   └── events.py
│   ├── snapshots/           # Periodic canvas snapshots
│   │   ├── router.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   └── comments/            # Comments anchored to objects/positions
│       ├── router.py
│       ├── models.py
│       ├── schemas.py
│       └── service.py
├── media/                   # Image upload to Supabase Storage
│   └── router.py
├── tests/
├── .env
├── docker-compose.yml       # Redis only (PostgreSQL via Supabase)
└── requirements.txt
```

**Suggested team split:**
- Dev 1 → `boards` + `core/auth` setup
- Dev 2 → `canvas_objects` (nodes + edges)
- Dev 3 → `collaboration` (WebSockets — the core of the system)
- Dev 4 → `comments` + `snapshots` + `media`

---

## Data Models (Supabase PostgreSQL)

Tables are created directly in the Supabase dashboard. No migration tooling.

### `boards`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL
owner_id    UUID NOT NULL        -- Supabase auth user ID
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()
```

### `board_members`
```sql
board_id    UUID REFERENCES boards(id) ON DELETE CASCADE
user_id     UUID NOT NULL
role        TEXT CHECK (role IN ('owner', 'editor', 'viewer'))
PRIMARY KEY (board_id, user_id)
```

### `canvas_nodes`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
board_id    UUID REFERENCES boards(id) ON DELETE CASCADE
type        TEXT NOT NULL   -- 'node' | 'sticky_note' | 'drawing' | 'text' | 'image'
position    JSONB NOT NULL  -- { "x": float, "y": float }  React Flow format
width       FLOAT
height      FLOAT
z_index     INT DEFAULT 0
parent_id   UUID REFERENCES canvas_nodes(id)  -- React Flow parentId for grouping
data        JSONB           -- type-specific: color, text content, stroke points, src URL, etc.
updated_by  UUID NOT NULL
updated_at  TIMESTAMPTZ DEFAULT now()   -- used for LWW conflict resolution
```

### `canvas_edges`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
board_id        UUID REFERENCES boards(id) ON DELETE CASCADE
source          UUID REFERENCES canvas_nodes(id) ON DELETE CASCADE
target          UUID REFERENCES canvas_nodes(id) ON DELETE CASCADE
source_handle   TEXT
target_handle   TEXT
type            TEXT            -- React Flow edge type: 'smoothstep', 'straight', etc.
animated        BOOLEAN DEFAULT false
label           TEXT
data            JSONB           -- style, markers, etc.
updated_by      UUID NOT NULL
updated_at      TIMESTAMPTZ DEFAULT now()
```

### `comments`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
board_id    UUID REFERENCES boards(id) ON DELETE CASCADE
object_id   UUID REFERENCES canvas_nodes(id)  -- nullable: anchored to node or free-floating
position_x  FLOAT
position_y  FLOAT
text        TEXT NOT NULL
author_id   UUID NOT NULL
created_at  TIMESTAMPTZ DEFAULT now()
```

### `canvas_snapshots`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
board_id    UUID REFERENCES boards(id) ON DELETE CASCADE
state       JSONB NOT NULL   -- { nodes: [...], edges: [...] } full React Flow state
created_at  TIMESTAMPTZ DEFAULT now()
```

---

## Real-time Collaboration

**WebSocket endpoint:** `WS /ws/{board_id}?token=<supabase-jwt>`

**Connection flow:**
1. Client connects with JWT in query param
2. Backend verifies JWT → extracts user_id
3. User is added to in-memory `ConnectionManager` under `board_id`
4. Backend subscribes to Redis pub/sub channel `board:{board_id}`
5. On disconnect: removed from manager, `user:left` event broadcast

**Event message format (both directions):**
```json
{
  "event": "node:updated",
  "payload": {
    "id": "node-uuid",
    "position": { "x": 120, "y": 340 },
    "updated_by": "user-uuid",
    "updated_at": "2026-04-04T12:00:00Z"
  }
}
```

**Event types:**
| Event | Direction | Persisted |
|---|---|---|
| `node:created` | client→server→clients | yes |
| `node:updated` | client→server→clients | yes |
| `node:deleted` | client→server→clients | yes |
| `edge:created` | client→server→clients | yes |
| `edge:updated` | client→server→clients | yes |
| `edge:deleted` | client→server→clients | yes |
| `comment:created` | client→server→clients | yes |
| `cursor:moved` | client→server→clients | no |
| `user:joined` | server→clients | no |
| `user:left` | server→clients | no |

**Last Write Wins (LWW) conflict resolution:**
1. Client sends update with its local `updated_at` timestamp
2. Backend compares against DB `updated_at`
3. If client timestamp is newer → persist to DB, publish to Redis channel
4. If client timestamp is older → silently reject (another client's update already won)

**Why Redis pub/sub:** Ensures events are relayed across all FastAPI worker processes. Connections for the same board may land on different workers — Redis fans out to all of them.

**REST → WebSocket sync:** REST endpoints for nodes/edges also publish to Redis after DB write, so REST-based changes are broadcast to all connected WebSocket clients.

---

## REST API Endpoints

All endpoints require `Authorization: Bearer <supabase-jwt>`.

### Boards
```
GET    /boards                              List boards for current user
POST   /boards                              Create board
GET    /boards/{id}                         Get board details
DELETE /boards/{id}                         Delete board
POST   /boards/{id}/members                 Invite user to board
DELETE /boards/{id}/members/{user_id}       Remove member
```

### Canvas
```
GET    /boards/{id}/canvas                  Full board state: { nodes, edges }
POST   /boards/{id}/nodes                   Create node (broadcasts via WS)
PATCH  /boards/{id}/nodes/{node_id}         Update node (broadcasts via WS)
DELETE /boards/{id}/nodes/{node_id}         Delete node (broadcasts via WS)
POST   /boards/{id}/edges                   Create edge (broadcasts via WS)
PATCH  /boards/{id}/edges/{edge_id}         Update edge (broadcasts via WS)
DELETE /boards/{id}/edges/{edge_id}         Delete edge (broadcasts via WS)
```

### Comments
```
GET    /boards/{id}/comments                List all comments on board
POST   /boards/{id}/comments                Add comment
DELETE /boards/{id}/comments/{comment_id}   Delete comment
```

### Snapshots
```
GET    /boards/{id}/snapshots               List snapshots (id + created_at only)
GET    /boards/{id}/snapshots/{snapshot_id} Get full snapshot state
POST   /boards/{id}/snapshots               Manually trigger snapshot
```

### Media
```
POST   /media/upload                        Upload image → returns Supabase Storage URL
```

### WebSocket
```
WS     /ws/{board_id}?token=<jwt>
```

### Canvas response format (React Flow compatible)
```json
{
  "nodes": [
    {
      "id": "uuid",
      "type": "sticky_note",
      "position": { "x": 100, "y": 200 },
      "width": 200,
      "height": 150,
      "zIndex": 1,
      "parentId": null,
      "data": { "text": "Hello", "color": "#ffeb3b" }
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source": "node-uuid-1",
      "target": "node-uuid-2",
      "sourceHandle": null,
      "targetHandle": null,
      "type": "smoothstep",
      "animated": false,
      "label": null,
      "data": {}
    }
  ]
}
```

---

## Error Handling

Consistent JSON error shape across all endpoints:
```json
{ "detail": "Board not found" }
```

| Status | Case |
|---|---|
| 401 | Invalid or expired Supabase JWT |
| 403 | User is not a board member |
| 404 | Board, node, edge, comment not found |
| 409 | LWW conflict (optional for REST, silent for WS) |
| 413 | Image upload too large |

WebSocket disconnects handled gracefully: remove from ConnectionManager, broadcast `user:left`.

---

## Snapshots

An `asyncio` task is started at app startup (via FastAPI `lifespan`) and runs every 5 minutes per active board:
1. Reads all `canvas_nodes` + `canvas_edges` for the board
2. Serializes to React Flow `{ nodes, edges }` format
3. Writes a row to `canvas_snapshots`

"Active board" = any board with at least one connected WebSocket client.

---

## Testing Strategy (realistic for 24h)

- **Unit tests** — LWW timestamp comparison logic, snapshot serialization, JWT verification
- **Integration tests** — REST endpoints against Supabase test project
- **WebSocket tests** — connect two clients to same board via `httpx` + `websockets`, verify events received

Skip: load testing, fuzz testing, full E2E.

---

## Infrastructure

- **docker-compose.yml** — Redis only (PostgreSQL via Supabase)
- **Tables** — created manually in Supabase dashboard (no migration tooling)
- **Auth** — Supabase issues JWTs, backend verifies with `python-jose` using Supabase JWT secret
- **Image storage** — Supabase Storage bucket, backend uploads and returns public URL
