# Canvas Service Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time collaborative canvas board backend (Miro-like) with FastAPI, PostgreSQL (Supabase), Redis, and WebSockets.

**Architecture:** Single FastAPI app with domain-driven modules (`boards`, `canvas_objects`, `collaboration`, `comments`, `snapshots`, `media`). All REST mutations publish to Redis pub/sub so WebSocket clients stay in sync. Conflict resolution uses Last Write Wins (LWW) via `updated_at` timestamp comparison. Tables are created manually in Supabase dashboard — no migrations.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), asyncpg, Pydantic v2, redis-py (async), python-jose, supabase-py, pytest, pytest-asyncio, httpx

---

## File Map

```
backend/canvas_service/
├── main.py                                   CREATE - app init, lifespan, router registration, CORS
├── core/
│   ├── config.py                             CREATE - pydantic-settings Settings class
│   ├── database.py                           CREATE - async SQLAlchemy engine + get_db dependency
│   ├── redis.py                              CREATE - async Redis client + init/close helpers
│   └── auth.py                              CREATE - verify_token() + get_current_user dependency
├── modules/
│   ├── boards/
│   │   ├── models.py                         CREATE - Board, BoardMember ORM models
│   │   ├── schemas.py                        CREATE - BoardCreate, BoardResponse, BoardMemberAdd
│   │   ├── service.py                        CREATE - board CRUD + membership functions
│   │   └── router.py                         CREATE - /boards REST endpoints
│   ├── canvas_objects/
│   │   ├── models.py                         CREATE - CanvasNode, CanvasEdge ORM models
│   │   ├── schemas.py                        CREATE - NodeCreate/Update/Response, EdgeCreate/Update/Response, CanvasResponse
│   │   ├── service.py                        CREATE - node/edge CRUD + LWW logic + Redis publish
│   │   └── router.py                         CREATE - /boards/{id}/nodes and /boards/{id}/edges endpoints
│   ├── collaboration/
│   │   ├── connection_manager.py             CREATE - in-memory WebSocket ConnectionManager
│   │   ├── events.py                         CREATE - EventType enum + make_event helper
│   │   └── router.py                         CREATE - WS /ws/{board_id} endpoint + event handler
│   ├── comments/
│   │   ├── models.py                         CREATE - Comment ORM model
│   │   ├── schemas.py                        CREATE - CommentCreate, CommentResponse
│   │   ├── service.py                        CREATE - comment CRUD + Redis publish
│   │   └── router.py                         CREATE - /boards/{id}/comments endpoints
│   └── snapshots/
│       ├── models.py                         CREATE - CanvasSnapshot ORM model
│       ├── schemas.py                        CREATE - SnapshotResponse
│       ├── service.py                        CREATE - take_snapshot() + snapshot_loop() background task
│       └── router.py                         CREATE - /boards/{id}/snapshots endpoints
├── media/
│   └── router.py                             CREATE - POST /media/upload to Supabase Storage
├── tests/
│   ├── conftest.py                           CREATE - pytest fixtures: test client, auth token, user ID
│   ├── test_auth.py                          CREATE - JWT verification unit tests
│   ├── test_boards.py                        CREATE - board CRUD integration tests
│   ├── test_canvas_objects.py                CREATE - node/edge CRUD + LWW integration tests
│   ├── test_collaboration.py                 CREATE - WebSocket event tests
│   └── test_snapshots.py                     CREATE - snapshot creation unit tests
├── .env.example                              CREATE - env var template
├── docker-compose.yml                        CREATE - Redis only
└── requirements.txt                          CREATE - all dependencies
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `backend/canvas_service/requirements.txt`
- Create: `backend/canvas_service/.env.example`
- Create: `backend/canvas_service/docker-compose.yml`
- Create: `backend/canvas_service/main.py`

- [ ] **Step 1: Create requirements.txt**

```
backend/canvas_service/requirements.txt
```

```
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
redis>=5.0.0
python-jose[cryptography]>=3.3.0
pydantic-settings>=2.0.0
httpx>=0.27.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
supabase>=2.4.0
python-multipart>=0.0.9
websockets>=12.0
```

- [ ] **Step 2: Create .env.example**

```
backend/canvas_service/.env.example
```

```
DATABASE_URL=postgresql+asyncpg://postgres:<password>@<host>:5432/<db>
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret-from-supabase-dashboard>
SUPABASE_STORAGE_BUCKET=canvas-media
```

Copy to `.env` and fill in real values from Supabase dashboard (Settings → API).

- [ ] **Step 3: Create docker-compose.yml (Redis only)**

```yaml
# backend/canvas_service/docker-compose.yml
version: "3.8"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

- [ ] **Step 4: Create main.py skeleton**

```python
# backend/canvas_service/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Redis and snapshot loop will be wired here in Task 10
    yield


app = FastAPI(title="Canvas Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 5: Install dependencies and start Redis**

```bash
cd backend/canvas_service
pip install -r requirements.txt
docker-compose up -d
```

Expected: Redis running on port 6379.

- [ ] **Step 6: Verify app starts**

```bash
uvicorn main:app --reload
```

Expected: `Application startup complete.` with no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/canvas_service/requirements.txt backend/canvas_service/.env.example backend/canvas_service/docker-compose.yml backend/canvas_service/main.py
git commit -m "feat: bootstrap canvas service project structure"
```

---

## Task 2: Core — Config

**Files:**
- Create: `backend/canvas_service/core/__init__.py`
- Create: `backend/canvas_service/core/config.py`

- [ ] **Step 1: Write failing test**

```python
# backend/canvas_service/tests/test_config.py
from app.core.config import settings

def test_settings_has_required_fields():
    assert hasattr(settings, "database_url")
    assert hasattr(settings, "redis_url")
    assert hasattr(settings, "supabase_jwt_secret")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/canvas_service
pytest tests/test_config.py -v
```

Expected: `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: Create package init files and config**

```python
# backend/canvas_service/core/__init__.py
# (empty)
```

```python
# backend/canvas_service/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str
    supabase_storage_bucket: str = "canvas-media"

    model_config = {"env_file": ".env"}


settings = Settings()
```

Also create `backend/canvas_service/__init__.py` (empty) and `backend/canvas_service/tests/__init__.py` (empty) and `backend/canvas_service/modules/__init__.py` (empty).

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_config.py -v
```

Expected: `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/canvas_service/core/ backend/canvas_service/__init__.py backend/canvas_service/tests/__init__.py backend/canvas_service/modules/__init__.py
git commit -m "feat: add core config with pydantic-settings"
```

---

## Task 3: Core — Database

**Files:**
- Create: `backend/canvas_service/core/database.py`

- [ ] **Step 1: Create database.py**

```python
# backend/canvas_service/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 2: Verify no import errors**

```bash
python -c "from app.core.database import Base, get_db, AsyncSessionLocal; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/canvas_service/core/database.py
git commit -m "feat: add async SQLAlchemy database setup"
```

---

## Task 4: Core — Redis

**Files:**
- Create: `backend/canvas_service/core/redis.py`

- [ ] **Step 1: Create redis.py**

```python
# backend/canvas_service/core/redis.py
import redis.asyncio as aioredis
from app.core.config import settings

_redis_client: aioredis.Redis | None = None


async def init_redis() -> None:
    global _redis_client
    _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None


async def get_redis() -> aioredis.Redis:
    return _redis_client
```

- [ ] **Step 2: Verify no import errors**

```bash
python -c "from app.core.redis import init_redis, close_redis, get_redis; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/canvas_service/core/redis.py
git commit -m "feat: add async Redis client"
```

---

## Task 5: Core — Auth

**Files:**
- Create: `backend/canvas_service/core/auth.py`
- Create: `backend/canvas_service/tests/test_auth.py`
- Create: `backend/canvas_service/tests/conftest.py`

- [ ] **Step 1: Create conftest.py with shared fixtures**

```python
# backend/canvas_service/tests/conftest.py
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.core.config import settings
from app.main import app

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_USER_ID_2 = "00000000-0000-0000-0000-000000000002"


def make_token(user_id: str = TEST_USER_ID, expired: bool = False) -> str:
    exp = datetime.now(timezone.utc) + (timedelta(seconds=-1) if expired else timedelta(hours=1))
    payload = {
        "sub": user_id,
        "aud": "authenticated",
        "exp": exp,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


@pytest.fixture
def valid_token() -> str:
    return make_token()


@pytest.fixture
def expired_token() -> str:
    return make_token(expired=True)


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
```

- [ ] **Step 2: Write failing auth tests**

```python
# backend/canvas_service/tests/test_auth.py
import pytest
from app.core.auth import verify_token
from tests.conftest import make_token, TEST_USER_ID


def test_verify_valid_token():
    token = make_token()
    user_id = verify_token(token)
    assert user_id == TEST_USER_ID


def test_verify_expired_token_raises():
    token = make_token(expired=True)
    with pytest.raises(ValueError, match="expired"):
        verify_token(token)


def test_verify_garbage_token_raises():
    with pytest.raises(ValueError):
        verify_token("not.a.token")
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/test_auth.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.core.auth'`

- [ ] **Step 4: Create auth.py**

```python
# backend/canvas_service/core/auth.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

security = HTTPBearer()


def verify_token(token: str) -> str:
    """Plain function — use in WebSocket handlers where FastAPI DI is unavailable."""
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub claim in token")
        return user_id
    except JWTError as exc:
        raise ValueError(str(exc))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI dependency — use in REST endpoint signatures."""
    try:
        return verify_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_auth.py -v
```

Expected: all 3 `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/canvas_service/core/auth.py backend/canvas_service/tests/conftest.py backend/canvas_service/tests/test_auth.py
git commit -m "feat: add Supabase JWT verification with tests"
```

---

## Task 6: Boards Module

**Files:**
- Create: `backend/canvas_service/modules/boards/__init__.py`
- Create: `backend/canvas_service/modules/boards/models.py`
- Create: `backend/canvas_service/modules/boards/schemas.py`
- Create: `backend/canvas_service/modules/boards/service.py`
- Create: `backend/canvas_service/modules/boards/router.py`
- Create: `backend/canvas_service/tests/test_boards.py`

- [ ] **Step 1: Write failing board tests**

```python
# backend/canvas_service/tests/test_boards.py
import pytest
from tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.asyncio


async def test_create_board(client, valid_token):
    response = await client.post(
        "/boards",
        json={"name": "My Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Board"
    assert data["owner_id"] == TEST_USER_ID


async def test_list_boards_empty(client, valid_token):
    response = await client.get(
        "/boards",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_board_not_found(client, valid_token):
    response = await client.get(
        "/boards/00000000-0000-0000-0000-000000000099",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 404


async def test_requires_auth(client):
    response = await client.get("/boards")
    assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_boards.py -v
```

Expected: `404 Not Found` for all routes (routers not registered yet)

- [ ] **Step 3: Create boards models**

```python
# backend/canvas_service/modules/boards/__init__.py
# (empty)
```

```python
# backend/canvas_service/modules/boards/models.py
import uuid
from sqlalchemy import Column, Text, DateTime, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Board(Base):
    __tablename__ = "boards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BoardMember(Base):
    __tablename__ = "board_members"

    board_id = Column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = Column(UUID(as_uuid=True), nullable=False, primary_key=True)
    role = Column(String(20), nullable=False)  # 'owner' | 'editor' | 'viewer'
```

- [ ] **Step 4: Create boards schemas**

```python
# backend/canvas_service/modules/boards/schemas.py
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Literal


class BoardCreate(BaseModel):
    name: str


class BoardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class BoardMemberAdd(BaseModel):
    user_id: UUID
    role: Literal["editor", "viewer"]
```

- [ ] **Step 5: Create boards service**

```python
# backend/canvas_service/modules/boards/service.py
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.modules.boards.models import Board, BoardMember
from app.modules.boards.schemas import BoardCreate


async def get_user_boards(db: AsyncSession, user_id: UUID) -> list[Board]:
    result = await db.execute(
        select(Board)
        .join(BoardMember, Board.id == BoardMember.board_id)
        .where(BoardMember.user_id == user_id)
    )
    return list(result.scalars().all())


async def create_board(db: AsyncSession, data: BoardCreate, owner_id: UUID) -> Board:
    board = Board(name=data.name, owner_id=owner_id)
    db.add(board)
    await db.flush()  # get board.id before adding member
    member = BoardMember(board_id=board.id, user_id=owner_id, role="owner")
    db.add(member)
    await db.commit()
    await db.refresh(board)
    return board


async def get_board(db: AsyncSession, board_id: UUID, user_id: UUID) -> Board:
    result = await db.execute(
        select(Board)
        .join(BoardMember, Board.id == BoardMember.board_id)
        .where(Board.id == board_id, BoardMember.user_id == user_id)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


async def delete_board(db: AsyncSession, board_id: UUID, user_id: UUID) -> None:
    board = await get_board(db, board_id, user_id)
    if str(board.owner_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the owner can delete this board")
    await db.execute(delete(Board).where(Board.id == board_id))
    await db.commit()


async def add_member(
    db: AsyncSession,
    board_id: UUID,
    new_user_id: UUID,
    role: str,
    requesting_user_id: UUID,
) -> BoardMember:
    await get_board(db, board_id, requesting_user_id)
    member = BoardMember(board_id=board_id, user_id=new_user_id, role=role)
    db.add(member)
    await db.commit()
    return member


async def remove_member(
    db: AsyncSession,
    board_id: UUID,
    target_user_id: UUID,
    requesting_user_id: UUID,
) -> None:
    await get_board(db, board_id, requesting_user_id)
    await db.execute(
        delete(BoardMember).where(
            BoardMember.board_id == board_id,
            BoardMember.user_id == target_user_id,
        )
    )
    await db.commit()
```

- [ ] **Step 6: Create boards router**

```python
# backend/canvas_service/modules/boards/router.py
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.auth import get_current_user
from app.modules.boards import service
from app.modules.boards.schemas import BoardCreate, BoardResponse, BoardMemberAdd

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=list[BoardResponse])
async def list_boards(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.get_user_boards(db, UUID(user_id))


@router.post("", response_model=BoardResponse, status_code=201)
async def create_board(
    data: BoardCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.create_board(db, data, UUID(user_id))


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.get_board(db, board_id, UUID(user_id))


@router.delete("/{board_id}", status_code=204)
async def delete_board(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    await service.delete_board(db, board_id, UUID(user_id))


@router.post("/{board_id}/members", status_code=201)
async def add_member(
    board_id: UUID,
    data: BoardMemberAdd,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.add_member(db, board_id, data.user_id, data.role, UUID(user_id))


@router.delete("/{board_id}/members/{target_user_id}", status_code=204)
async def remove_member(
    board_id: UUID,
    target_user_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    await service.remove_member(db, board_id, target_user_id, UUID(user_id))
```

- [ ] **Step 7: Register boards router in main.py**

```python
# backend/canvas_service/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.boards.router import router as boards_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Canvas Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(boards_router)
```

- [ ] **Step 8: Create tables in Supabase dashboard**

Open Supabase SQL editor and run:

```sql
CREATE TABLE boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE board_members (
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT CHECK (role IN ('owner', 'editor', 'viewer')),
    PRIMARY KEY (board_id, user_id)
);
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pytest tests/test_boards.py -v
```

Expected: all 4 `PASSED`

- [ ] **Step 10: Commit**

```bash
git add backend/canvas_service/modules/boards/ backend/canvas_service/tests/test_boards.py backend/canvas_service/main.py
git commit -m "feat: add boards module with CRUD endpoints and membership"
```

---

## Task 7: Canvas Objects Module (Nodes + Edges)

**Files:**
- Create: `backend/canvas_service/modules/canvas_objects/__init__.py`
- Create: `backend/canvas_service/modules/canvas_objects/models.py`
- Create: `backend/canvas_service/modules/canvas_objects/schemas.py`
- Create: `backend/canvas_service/modules/canvas_objects/service.py`
- Create: `backend/canvas_service/modules/canvas_objects/router.py`
- Create: `backend/canvas_service/tests/test_canvas_objects.py`

- [ ] **Step 1: Write failing canvas object tests**

```python
# backend/canvas_service/tests/test_canvas_objects.py
import pytest
from datetime import datetime, timezone, timedelta
from tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.asyncio

BOARD_ID = None  # set in fixture


@pytest.fixture(autouse=True)
async def board(client, valid_token):
    """Create a fresh board before each test."""
    resp = await client.post(
        "/boards",
        json={"name": "Test Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    global BOARD_ID
    BOARD_ID = resp.json()["id"]


async def test_create_node(client, valid_token):
    response = await client.post(
        f"/boards/{BOARD_ID}/nodes",
        json={
            "type": "canvas-node",
            "position": {"x": 100, "y": 200},
            "data": {"label": "Project brief", "kind": "Input", "note": "Scope and constraints"},
        },
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "canvas-node"
    assert data["position"] == {"x": 100.0, "y": 200.0}
    assert data["data"]["label"] == "Project brief"
    assert "id" in data


async def test_get_canvas_returns_nodes_and_edges(client, valid_token):
    await client.post(
        f"/boards/{BOARD_ID}/nodes",
        json={"type": "canvas-node", "position": {"x": 0, "y": 0}, "data": {"label": "Test", "kind": "Workspace", "note": ""}},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    response = await client.get(
        f"/boards/{BOARD_ID}/canvas",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) == 1


async def test_lww_rejects_stale_update(client, valid_token):
    create_resp = await client.post(
        f"/boards/{BOARD_ID}/nodes",
        json={"type": "canvas-node", "position": {"x": 0, "y": 0}, "data": {"label": "Test", "kind": "Workspace", "note": ""}},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    node_id = create_resp.json()["id"]

    stale_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    response = await client.patch(
        f"/boards/{BOARD_ID}/nodes/{node_id}",
        json={"position": {"x": 999, "y": 999}, "updated_at": stale_time},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_canvas_objects.py -v
```

Expected: 404 errors (routes not registered)

- [ ] **Step 3: Create canvas_objects models**

```python
# backend/canvas_service/modules/canvas_objects/__init__.py
# (empty)
```

```python
# backend/canvas_service/modules/canvas_objects/models.py
import uuid
from sqlalchemy import Column, Text, Float, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class CanvasNode(Base):
    __tablename__ = "canvas_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    type = Column(Text, nullable=False)  # React Flow node type, e.g. 'canvas-node' (frontend-defined)
    position = Column(JSONB, nullable=False)  # {"x": float, "y": float}
    width = Column(Float)
    height = Column(Float)
    z_index = Column(Integer, default=0)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("canvas_nodes.id"), nullable=True)
    data = Column(JSONB)
    updated_by = Column(UUID(as_uuid=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CanvasEdge(Base):
    __tablename__ = "canvas_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    source = Column(UUID(as_uuid=True), ForeignKey("canvas_nodes.id", ondelete="CASCADE"), nullable=False)
    target = Column(UUID(as_uuid=True), ForeignKey("canvas_nodes.id", ondelete="CASCADE"), nullable=False)
    source_handle = Column(Text)
    target_handle = Column(Text)
    type = Column(Text)
    animated = Column(Boolean, default=False)
    label = Column(Text)
    data = Column(JSONB)
    updated_by = Column(UUID(as_uuid=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

- [ ] **Step 4: Create canvas_objects schemas**

```python
# backend/canvas_service/modules/canvas_objects/schemas.py
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Any, Optional


class Position(BaseModel):
    x: float
    y: float


class NodeCreate(BaseModel):
    type: str  # React Flow node type (frontend-defined, e.g. "canvas-node")
    position: Position
    width: Optional[float] = None
    height: Optional[float] = None
    z_index: int = 0
    parent_id: Optional[UUID] = None
    data: Optional[dict[str, Any]] = None


class NodeUpdate(BaseModel):
    position: Optional[Position] = None
    width: Optional[float] = None
    height: Optional[float] = None
    z_index: Optional[int] = None
    data: Optional[dict[str, Any]] = None
    updated_at: datetime  # client's local timestamp — required for LWW


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    position: dict[str, float]  # {"x": ..., "y": ...}
    width: Optional[float] = None
    height: Optional[float] = None
    zIndex: int = Field(0, validation_alias="z_index")
    parentId: Optional[UUID] = Field(None, validation_alias="parent_id")
    data: Optional[dict[str, Any]] = None


class EdgeCreate(BaseModel):
    source: UUID
    target: UUID
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    type: Optional[str] = "smoothstep"
    animated: bool = False
    label: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class EdgeUpdate(BaseModel):
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    type: Optional[str] = None
    animated: Optional[bool] = None
    label: Optional[str] = None
    data: Optional[dict[str, Any]] = None
    updated_at: datetime  # required for LWW


class EdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: UUID
    target: UUID
    sourceHandle: Optional[str] = Field(None, validation_alias="source_handle")
    targetHandle: Optional[str] = Field(None, validation_alias="target_handle")
    type: Optional[str] = None
    animated: bool = False
    label: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class CanvasResponse(BaseModel):
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]
```

- [ ] **Step 5: Create canvas_objects service**

```python
# backend/canvas_service/modules/canvas_objects/service.py
import json
from datetime import timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.modules.canvas_objects.models import CanvasNode, CanvasEdge
from app.modules.canvas_objects.schemas import (
    NodeCreate, NodeUpdate, NodeResponse,
    EdgeCreate, EdgeUpdate, EdgeResponse, CanvasResponse,
)


async def get_canvas(db: AsyncSession, board_id: UUID) -> CanvasResponse:
    nodes_result = await db.execute(select(CanvasNode).where(CanvasNode.board_id == board_id))
    edges_result = await db.execute(select(CanvasEdge).where(CanvasEdge.board_id == board_id))
    return CanvasResponse(
        nodes=[NodeResponse.model_validate(n) for n in nodes_result.scalars().all()],
        edges=[EdgeResponse.model_validate(e) for e in edges_result.scalars().all()],
    )


async def create_node(
    db: AsyncSession, board_id: UUID, data: NodeCreate, user_id: UUID
) -> CanvasNode:
    node = CanvasNode(
        board_id=board_id,
        type=data.type,
        position=data.position.model_dump(),
        width=data.width,
        height=data.height,
        z_index=data.z_index,
        parent_id=data.parent_id,
        data=data.data,
        updated_by=user_id,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


async def update_node(
    db: AsyncSession, board_id: UUID, node_id: UUID, data: NodeUpdate, user_id: UUID
) -> CanvasNode:
    result = await db.execute(
        select(CanvasNode).where(CanvasNode.id == node_id, CanvasNode.board_id == board_id)
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # LWW: reject if client timestamp is not newer than DB
    client_ts = data.updated_at.replace(tzinfo=timezone.utc) if data.updated_at.tzinfo is None else data.updated_at
    db_ts = node.updated_at.replace(tzinfo=timezone.utc) if node.updated_at.tzinfo is None else node.updated_at
    if client_ts <= db_ts:
        raise HTTPException(status_code=409, detail="Conflict: a newer update already exists")

    if data.position is not None:
        node.position = data.position.model_dump()
    if data.width is not None:
        node.width = data.width
    if data.height is not None:
        node.height = data.height
    if data.z_index is not None:
        node.z_index = data.z_index
    if data.data is not None:
        node.data = data.data
    node.updated_by = user_id

    await db.commit()
    await db.refresh(node)
    return node


async def delete_node(db: AsyncSession, board_id: UUID, node_id: UUID) -> None:
    result = await db.execute(
        select(CanvasNode).where(CanvasNode.id == node_id, CanvasNode.board_id == board_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Node not found")
    await db.execute(delete(CanvasNode).where(CanvasNode.id == node_id))
    await db.commit()


async def create_edge(
    db: AsyncSession, board_id: UUID, data: EdgeCreate, user_id: UUID
) -> CanvasEdge:
    edge = CanvasEdge(
        board_id=board_id,
        source=data.source,
        target=data.target,
        source_handle=data.source_handle,
        target_handle=data.target_handle,
        type=data.type,
        animated=data.animated,
        label=data.label,
        data=data.data,
        updated_by=user_id,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


async def update_edge(
    db: AsyncSession, board_id: UUID, edge_id: UUID, data: EdgeUpdate, user_id: UUID
) -> CanvasEdge:
    result = await db.execute(
        select(CanvasEdge).where(CanvasEdge.id == edge_id, CanvasEdge.board_id == board_id)
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")

    client_ts = data.updated_at.replace(tzinfo=timezone.utc) if data.updated_at.tzinfo is None else data.updated_at
    db_ts = edge.updated_at.replace(tzinfo=timezone.utc) if edge.updated_at.tzinfo is None else edge.updated_at
    if client_ts <= db_ts:
        raise HTTPException(status_code=409, detail="Conflict: a newer update already exists")

    for field in ("source_handle", "target_handle", "type", "animated", "label", "data"):
        value = getattr(data, field)
        if value is not None:
            setattr(edge, field, value)
    edge.updated_by = user_id

    await db.commit()
    await db.refresh(edge)
    return edge


async def delete_edge(db: AsyncSession, board_id: UUID, edge_id: UUID) -> None:
    result = await db.execute(
        select(CanvasEdge).where(CanvasEdge.id == edge_id, CanvasEdge.board_id == board_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Edge not found")
    await db.execute(delete(CanvasEdge).where(CanvasEdge.id == edge_id))
    await db.commit()
```

- [ ] **Step 6: Create canvas_objects router**

REST endpoints also publish to Redis so WebSocket clients see changes made via REST (not just via WebSocket).

```python
# backend/canvas_service/modules/canvas_objects/router.py
import json
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.redis import get_redis
from app.modules.canvas_objects import service
from app.modules.canvas_objects.schemas import (
    NodeCreate, NodeUpdate, NodeResponse,
    EdgeCreate, EdgeUpdate, EdgeResponse, CanvasResponse,
)
from app.modules.collaboration.events import EventType, make_event

router = APIRouter(prefix="/boards/{board_id}", tags=["canvas"])


@router.get("/canvas", response_model=CanvasResponse)
async def get_canvas(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.get_canvas(db, board_id)


@router.post("/nodes", response_model=NodeResponse, status_code=201)
async def create_node(
    board_id: UUID,
    data: NodeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    node = await service.create_node(db, board_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.NODE_CREATED, NodeResponse.model_validate(node).model_dump(mode="json"))),
    )
    return node


@router.patch("/nodes/{node_id}", response_model=NodeResponse)
async def update_node(
    board_id: UUID,
    node_id: UUID,
    data: NodeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    node = await service.update_node(db, board_id, node_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.NODE_UPDATED, NodeResponse.model_validate(node).model_dump(mode="json"))),
    )
    return node


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(
    board_id: UUID,
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    await service.delete_node(db, board_id, node_id)
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.NODE_DELETED, {"id": str(node_id)})),
    )


@router.post("/edges", response_model=EdgeResponse, status_code=201)
async def create_edge(
    board_id: UUID,
    data: EdgeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    edge = await service.create_edge(db, board_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.EDGE_CREATED, EdgeResponse.model_validate(edge).model_dump(mode="json"))),
    )
    return edge


@router.patch("/edges/{edge_id}", response_model=EdgeResponse)
async def update_edge(
    board_id: UUID,
    edge_id: UUID,
    data: EdgeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    edge = await service.update_edge(db, board_id, edge_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.EDGE_UPDATED, EdgeResponse.model_validate(edge).model_dump(mode="json"))),
    )
    return edge


@router.delete("/edges/{edge_id}", status_code=204)
async def delete_edge(
    board_id: UUID,
    edge_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    await service.delete_edge(db, board_id, edge_id)
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.EDGE_DELETED, {"id": str(edge_id)})),
    )
```

- [ ] **Step 7: Register canvas router in main.py**

Add to `main.py`:
```python
from app.modules.canvas_objects.router import router as canvas_router
# inside app setup, after boards_router:
app.include_router(canvas_router)
```

- [ ] **Step 8: Create canvas_nodes and canvas_edges tables in Supabase**

```sql
CREATE TABLE canvas_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    position JSONB NOT NULL,
    width FLOAT,
    height FLOAT,
    z_index INT DEFAULT 0,
    parent_id UUID REFERENCES canvas_nodes(id),
    data JSONB,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE canvas_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    source UUID REFERENCES canvas_nodes(id) ON DELETE CASCADE NOT NULL,
    target UUID REFERENCES canvas_nodes(id) ON DELETE CASCADE NOT NULL,
    source_handle TEXT,
    target_handle TEXT,
    type TEXT,
    animated BOOLEAN DEFAULT false,
    label TEXT,
    data JSONB,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pytest tests/test_canvas_objects.py -v
```

Expected: all 3 `PASSED`

- [ ] **Step 10: Commit**

```bash
git add backend/canvas_service/modules/canvas_objects/ backend/canvas_service/tests/test_canvas_objects.py backend/canvas_service/main.py
git commit -m "feat: add canvas nodes and edges with LWW conflict resolution"
```

---

## Task 8: Collaboration Module (WebSockets)

**Files:**
- Create: `backend/canvas_service/modules/collaboration/__init__.py`
- Create: `backend/canvas_service/modules/collaboration/connection_manager.py`
- Create: `backend/canvas_service/modules/collaboration/events.py`
- Create: `backend/canvas_service/modules/collaboration/router.py`
- Create: `backend/canvas_service/tests/test_collaboration.py`

- [ ] **Step 1: Write failing WebSocket test**

```python
# backend/canvas_service/tests/test_collaboration.py
import pytest
import json
from tests.conftest import make_token, TEST_USER_ID

pytestmark = pytest.mark.asyncio


async def test_ws_rejects_invalid_token(client):
    with pytest.raises(Exception):
        async with client.websocket_connect("/ws/some-board-id?token=invalid"):
            pass


async def test_ws_connects_with_valid_token(client, valid_token):
    board_resp = await client.post(
        "/boards",
        json={"name": "WS Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    board_id = board_resp.json()["id"]

    async with client.websocket_connect(f"/ws/{board_id}?token={valid_token}") as ws:
        # Should receive user:joined for self or just stay connected
        assert ws is not None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_collaboration.py::test_ws_connects_with_valid_token -v
```

Expected: 404 (WS route not registered yet)

- [ ] **Step 3: Create events.py**

```python
# backend/canvas_service/modules/collaboration/__init__.py
# (empty)
```

```python
# backend/canvas_service/modules/collaboration/events.py
from enum import Enum


class EventType(str, Enum):
    NODE_CREATED = "node:created"
    NODE_UPDATED = "node:updated"
    NODE_DELETED = "node:deleted"
    EDGE_CREATED = "edge:created"
    EDGE_UPDATED = "edge:updated"
    EDGE_DELETED = "edge:deleted"
    COMMENT_CREATED = "comment:created"
    CURSOR_MOVED = "cursor:moved"
    USER_JOINED = "user:joined"
    USER_LEFT = "user:left"


def make_event(event_type: EventType, payload: dict) -> dict:
    return {"event": event_type.value, "payload": payload}
```

- [ ] **Step 4: Create connection_manager.py**

```python
# backend/canvas_service/modules/collaboration/connection_manager.py
from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, board_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[board_id].append(websocket)

    def disconnect(self, board_id: str, websocket: WebSocket) -> None:
        self._connections[board_id].remove(websocket)

    def active_boards(self) -> list[str]:
        return [bid for bid, conns in self._connections.items() if conns]

    def has_connections(self, board_id: str) -> bool:
        return bool(self._connections[board_id])


# Singleton — imported by router and snapshot service
manager = ConnectionManager()
```

- [ ] **Step 5: Create collaboration router**

```python
# backend/canvas_service/modules/collaboration/router.py
import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.auth import verify_token
from app.core.redis import get_redis
from app.core.database import AsyncSessionLocal
from app.modules.collaboration.connection_manager import manager
from app.modules.collaboration.events import EventType, make_event
from app.modules.canvas_objects import service as canvas_service
from app.modules.canvas_objects.schemas import NodeUpdate, EdgeUpdate

router = APIRouter(tags=["collaboration"])


@router.websocket("/ws/{board_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    board_id: str,
    token: str = Query(...),
):
    try:
        user_id = verify_token(token)
    except ValueError:
        await websocket.close(code=4001)
        return

    redis = await get_redis()
    await manager.connect(board_id, websocket)

    # Subscribe to Redis channel for this board
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"board:{board_id}")

    # Announce this user joined to other clients
    join_msg = json.dumps(make_event(EventType.USER_JOINED, {"user_id": user_id}))
    await redis.publish(f"board:{board_id}", join_msg)

    async def redis_listener():
        """Forward all Redis messages to this WebSocket connection."""
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    await websocket.send_text(message["data"])
                except Exception:
                    break

    listener_task = asyncio.create_task(redis_listener())

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_event(data, board_id, user_id, redis)
    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()
        manager.disconnect(board_id, websocket)
        await pubsub.unsubscribe(f"board:{board_id}")
        await pubsub.aclose()
        leave_msg = json.dumps(make_event(EventType.USER_LEFT, {"user_id": user_id}))
        await redis.publish(f"board:{board_id}", leave_msg)


async def _handle_event(data: dict, board_id: str, user_id: str, redis) -> None:
    """Persist the event (if applicable) and publish to Redis."""
    event = data.get("event")
    payload = data.get("payload", {})

    if event == EventType.CURSOR_MOVED:
        payload["user_id"] = user_id
        await redis.publish(
            f"board:{board_id}",
            json.dumps(make_event(EventType.CURSOR_MOVED, payload)),
        )
        return

    async with AsyncSessionLocal() as db:
        try:
            if event == EventType.NODE_UPDATED:
                update = NodeUpdate(**payload)
                await canvas_service.update_node(db, UUID(board_id), UUID(payload["id"]), update, UUID(user_id))

            elif event == EventType.NODE_DELETED:
                await canvas_service.delete_node(db, UUID(board_id), UUID(payload["id"]))

            elif event == EventType.EDGE_UPDATED:
                update = EdgeUpdate(**payload)
                await canvas_service.update_edge(db, UUID(board_id), UUID(payload["id"]), update, UUID(user_id))

            elif event == EventType.EDGE_DELETED:
                await canvas_service.delete_edge(db, UUID(board_id), UUID(payload["id"]))

            else:
                return  # unknown event — ignore
        except Exception:
            return  # silently drop failed persistence (LWW conflict or bad payload)

    payload["updated_by"] = user_id
    await redis.publish(f"board:{board_id}", json.dumps(make_event(event, payload)))
```

- [ ] **Step 6: Wire Redis init and collaboration router into main.py**

```python
# backend/canvas_service/main.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.redis import init_redis, close_redis
from app.modules.boards.router import router as boards_router
from app.modules.canvas_objects.router import router as canvas_router
from app.modules.collaboration.router import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    yield
    await close_redis()


app = FastAPI(title="Canvas Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(boards_router)
app.include_router(canvas_router)
app.include_router(ws_router)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pytest tests/test_collaboration.py -v
```

Expected: `PASSED`

- [ ] **Step 8: Commit**

```bash
git add backend/canvas_service/modules/collaboration/ backend/canvas_service/tests/test_collaboration.py backend/canvas_service/main.py
git commit -m "feat: add WebSocket collaboration with Redis pub/sub"
```

---

## Task 9: Comments Module

**Files:**
- Create: `backend/canvas_service/modules/comments/__init__.py`
- Create: `backend/canvas_service/modules/comments/models.py`
- Create: `backend/canvas_service/modules/comments/schemas.py`
- Create: `backend/canvas_service/modules/comments/service.py`
- Create: `backend/canvas_service/modules/comments/router.py`

- [ ] **Step 1: Create comments models**

```python
# backend/canvas_service/modules/comments/__init__.py
# (empty)
```

```python
# backend/canvas_service/modules/comments/models.py
import uuid
from sqlalchemy import Column, Text, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    object_id = Column(UUID(as_uuid=True), ForeignKey("canvas_nodes.id"), nullable=True)
    position_x = Column(Float)
    position_y = Column(Float)
    text = Column(Text, nullable=False)
    author_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Create comments schemas**

```python
# backend/canvas_service/modules/comments/schemas.py
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


class CommentCreate(BaseModel):
    text: str
    object_id: Optional[UUID] = None  # anchor to a node, or None for free-floating
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    board_id: UUID
    object_id: Optional[UUID] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    text: str
    author_id: UUID
    created_at: datetime
```

- [ ] **Step 3: Create comments service**

```python
# backend/canvas_service/modules/comments/service.py
import json
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.modules.comments.models import Comment
from app.modules.comments.schemas import CommentCreate
from app.modules.collaboration.events import EventType, make_event


async def list_comments(db: AsyncSession, board_id: UUID) -> list[Comment]:
    result = await db.execute(select(Comment).where(Comment.board_id == board_id))
    return list(result.scalars().all())


async def create_comment(
    db: AsyncSession, board_id: UUID, data: CommentCreate, author_id: UUID, redis
) -> Comment:
    comment = Comment(
        board_id=board_id,
        object_id=data.object_id,
        position_x=data.position_x,
        position_y=data.position_y,
        text=data.text,
        author_id=author_id,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    # Broadcast to WebSocket clients
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.COMMENT_CREATED, {
            "id": str(comment.id),
            "text": comment.text,
            "author_id": str(author_id),
            "object_id": str(comment.object_id) if comment.object_id else None,
            "position_x": comment.position_x,
            "position_y": comment.position_y,
        })),
    )
    return comment


async def delete_comment(db: AsyncSession, board_id: UUID, comment_id: UUID, user_id: UUID) -> None:
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.board_id == board_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if str(comment.author_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Can only delete your own comments")
    await db.execute(delete(Comment).where(Comment.id == comment_id))
    await db.commit()
```

- [ ] **Step 4: Create comments router**

```python
# backend/canvas_service/modules/comments/router.py
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.redis import get_redis
from app.modules.comments import service
from app.modules.comments.schemas import CommentCreate, CommentResponse

router = APIRouter(prefix="/boards/{board_id}/comments", tags=["comments"])


@router.get("", response_model=list[CommentResponse])
async def list_comments(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.list_comments(db, board_id)


@router.post("", response_model=CommentResponse, status_code=201)
async def create_comment(
    board_id: UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    return await service.create_comment(db, board_id, data, UUID(user_id), redis)


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    board_id: UUID,
    comment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    await service.delete_comment(db, board_id, comment_id, UUID(user_id))
```

- [ ] **Step 5: Create comments table in Supabase**

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    object_id UUID REFERENCES canvas_nodes(id),
    position_x FLOAT,
    position_y FLOAT,
    text TEXT NOT NULL,
    author_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 6: Register comments router in main.py**

Add to `main.py`:
```python
from app.modules.comments.router import router as comments_router
# after existing include_router calls:
app.include_router(comments_router)
```

- [ ] **Step 7: Verify endpoint works**

```bash
uvicorn main:app --reload
# In another terminal:
curl -X GET http://localhost:8000/boards/<board_id>/comments \
  -H "Authorization: Bearer <token>"
```

Expected: `[]` (empty list)

- [ ] **Step 8: Commit**

```bash
git add backend/canvas_service/modules/comments/ backend/canvas_service/main.py
git commit -m "feat: add comments module with WebSocket broadcast"
```

---

## Task 10: Snapshots Module

**Files:**
- Create: `backend/canvas_service/modules/snapshots/__init__.py`
- Create: `backend/canvas_service/modules/snapshots/models.py`
- Create: `backend/canvas_service/modules/snapshots/schemas.py`
- Create: `backend/canvas_service/modules/snapshots/service.py`
- Create: `backend/canvas_service/modules/snapshots/router.py`
- Create: `backend/canvas_service/tests/test_snapshots.py`

- [ ] **Step 1: Write failing snapshot unit test**

```python
# backend/canvas_service/tests/test_snapshots.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

pytestmark = pytest.mark.asyncio


async def test_take_snapshot_stores_nodes_and_edges():
    """Unit test: snapshot serializes canvas state to JSONB correctly."""
    from app.modules.snapshots.service import take_snapshot
    from app.modules.canvas_objects.models import CanvasNode, CanvasEdge

    board_id = uuid4()
    user_id = uuid4()

    mock_node = MagicMock(spec=CanvasNode)
    mock_node.id = uuid4()
    mock_node.type = "canvas-node"
    mock_node.position = {"x": 10.0, "y": 20.0}
    mock_node.width = None
    mock_node.height = None
    mock_node.z_index = 0
    mock_node.parent_id = None
    mock_node.data = {"text": "Hi"}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[mock_node])))))

    # Patch the second execute call (for edges) to return empty
    call_count = 0
    async def execute_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # nodes query
            result = MagicMock()
            result.scalars.return_value.all.return_value = [mock_node]
            return result
        else:
            # edges query
            result = MagicMock()
            result.scalars.return_value.all.return_value = []
            return result

    mock_db.execute = execute_side_effect
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    snapshot = await take_snapshot(mock_db, board_id)
    assert "nodes" in snapshot.state
    assert "edges" in snapshot.state
    assert len(snapshot.state["nodes"]) == 1
    assert snapshot.state["nodes"][0]["type"] == "canvas-node"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_snapshots.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create snapshots models**

```python
# backend/canvas_service/modules/snapshots/__init__.py
# (empty)
```

```python
# backend/canvas_service/modules/snapshots/models.py
import uuid
from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class CanvasSnapshot(Base):
    __tablename__ = "canvas_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    state = Column(JSONB, nullable=False)  # {"nodes": [...], "edges": [...]}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 4: Create snapshots schemas**

```python
# backend/canvas_service/modules/snapshots/schemas.py
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Any


class SnapshotListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    board_id: UUID
    created_at: datetime


class SnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    board_id: UUID
    state: dict[str, Any]
    created_at: datetime
```

- [ ] **Step 5: Create snapshots service**

```python
# backend/canvas_service/modules/snapshots/service.py
import asyncio
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.modules.canvas_objects.models import CanvasNode, CanvasEdge
from app.modules.canvas_objects.schemas import NodeResponse, EdgeResponse
from app.modules.snapshots.models import CanvasSnapshot
from app.modules.collaboration.connection_manager import manager


async def take_snapshot(db: AsyncSession, board_id: UUID) -> CanvasSnapshot:
    nodes_result = await db.execute(select(CanvasNode).where(CanvasNode.board_id == board_id))
    edges_result = await db.execute(select(CanvasEdge).where(CanvasEdge.board_id == board_id))

    nodes = [
        NodeResponse.model_validate(n).model_dump(mode="json")
        for n in nodes_result.scalars().all()
    ]
    edges = [
        EdgeResponse.model_validate(e).model_dump(mode="json")
        for e in edges_result.scalars().all()
    ]

    snapshot = CanvasSnapshot(board_id=board_id, state={"nodes": nodes, "edges": edges})
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)
    return snapshot


async def get_snapshots(db: AsyncSession, board_id: UUID) -> list[CanvasSnapshot]:
    result = await db.execute(
        select(CanvasSnapshot)
        .where(CanvasSnapshot.board_id == board_id)
        .order_by(CanvasSnapshot.created_at.desc())
    )
    return list(result.scalars().all())


async def get_snapshot(db: AsyncSession, board_id: UUID, snapshot_id: UUID) -> CanvasSnapshot:
    from fastapi import HTTPException
    result = await db.execute(
        select(CanvasSnapshot).where(
            CanvasSnapshot.id == snapshot_id,
            CanvasSnapshot.board_id == board_id,
        )
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


async def snapshot_loop() -> None:
    """Asyncio background task: snapshot all active boards every 5 minutes."""
    while True:
        await asyncio.sleep(300)  # 5 minutes
        for board_id_str in manager.active_boards():
            async with AsyncSessionLocal() as db:
                try:
                    await take_snapshot(db, UUID(board_id_str))
                except Exception as exc:
                    print(f"[snapshot] Failed for board {board_id_str}: {exc}")
```

- [ ] **Step 6: Create snapshots router**

```python
# backend/canvas_service/modules/snapshots/router.py
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.auth import get_current_user
from app.modules.snapshots import service
from app.modules.snapshots.schemas import SnapshotListItem, SnapshotResponse

router = APIRouter(prefix="/boards/{board_id}/snapshots", tags=["snapshots"])


@router.get("", response_model=list[SnapshotListItem])
async def list_snapshots(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.get_snapshots(db, board_id)


@router.get("/{snapshot_id}", response_model=SnapshotResponse)
async def get_snapshot(
    board_id: UUID,
    snapshot_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.get_snapshot(db, board_id, snapshot_id)


@router.post("", response_model=SnapshotResponse, status_code=201)
async def create_snapshot(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.take_snapshot(db, board_id)
```

- [ ] **Step 7: Create snapshot table in Supabase**

```sql
CREATE TABLE canvas_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 8: Wire snapshot loop and router into main.py**

```python
# backend/canvas_service/main.py  (final version)
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.redis import init_redis, close_redis
from app.modules.boards.router import router as boards_router
from app.modules.canvas_objects.router import router as canvas_router
from app.modules.collaboration.router import router as ws_router
from app.modules.comments.router import router as comments_router
from app.modules.snapshots.router import router as snapshots_router
from app.modules.snapshots.service import snapshot_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    task = asyncio.create_task(snapshot_loop())
    yield
    task.cancel()
    await close_redis()


app = FastAPI(title="Canvas Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(boards_router)
app.include_router(canvas_router)
app.include_router(ws_router)
app.include_router(comments_router)
app.include_router(snapshots_router)
```

- [ ] **Step 9: Run snapshot test to verify it passes**

```bash
pytest tests/test_snapshots.py -v
```

Expected: `PASSED`

- [ ] **Step 10: Commit**

```bash
git add backend/canvas_service/modules/snapshots/ backend/canvas_service/tests/test_snapshots.py backend/canvas_service/main.py
git commit -m "feat: add snapshots module with 5-minute background loop"
```

---

## Task 11: Media Upload

**Files:**
- Create: `backend/canvas_service/media/__init__.py`
- Create: `backend/canvas_service/media/router.py`

- [ ] **Step 1: Create media router**

```python
# backend/canvas_service/media/__init__.py
# (empty)
```

```python
# backend/canvas_service/media/router.py
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from supabase import create_client
from app.core.auth import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/media", tags=["media"])

MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    _: str = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    ext = (file.filename or "upload").rsplit(".", 1)[-1]
    file_name = f"{uuid.uuid4()}.{ext}"

    supabase = create_client(settings.supabase_url, settings.supabase_key)
    supabase.storage.from_(settings.supabase_storage_bucket).upload(
        file_name,
        content,
        {"content-type": file.content_type},
    )
    url = supabase.storage.from_(settings.supabase_storage_bucket).get_public_url(file_name)
    return {"url": url}
```

- [ ] **Step 2: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `canvas-media`
- Public: ✓ (so URLs are accessible without auth)

- [ ] **Step 3: Register media router in main.py**

Add to `main.py`:
```python
from app.media.router import router as media_router
# after other include_router calls:
app.include_router(media_router)
```

- [ ] **Step 4: Verify the app starts cleanly**

```bash
uvicorn main:app --reload
```

Expected: startup with no errors. Visit `http://localhost:8000/docs` — all routes should be visible.

- [ ] **Step 5: Commit**

```bash
git add backend/canvas_service/media/ backend/canvas_service/main.py
git commit -m "feat: add image upload to Supabase Storage"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
pytest tests/ -v
```

Expected: all tests `PASSED`, no errors.

- [ ] **Step 2: Verify all routes visible in OpenAPI docs**

Visit `http://localhost:8000/docs` and confirm all these route groups are present:
- `boards` — 6 endpoints
- `canvas` — 8 endpoints
- `collaboration` — 1 WS endpoint
- `comments` — 3 endpoints
- `snapshots` — 3 endpoints
- `media` — 1 endpoint

- [ ] **Step 3: Smoke test WebSocket manually**

```python
# Run this in a Python shell
import asyncio, websockets, json

async def test():
    token = "<your-valid-token>"
    board_id = "<a-board-id>"
    uri = f"ws://localhost:8000/ws/{board_id}?token={token}"
    async with websockets.connect(uri) as ws:
        print("Connected")
        await ws.send(json.dumps({
            "event": "cursor:moved",
            "payload": {"x": 100, "y": 200}
        }))
        msg = await asyncio.wait_for(ws.recv(), timeout=2)
        print("Received:", msg)

asyncio.run(test())
```

Expected: receive the cursor:moved event back (broadcast from Redis).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete canvas service backend — all modules wired and tested"
```
