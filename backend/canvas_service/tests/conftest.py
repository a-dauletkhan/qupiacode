import os
from datetime import datetime, timedelta, timezone

import fakeredis.aioredis
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/qupia_test",
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-supabase-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret")
os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "canvas-media")

from canvas_service.core.config import settings
from canvas_service.core.database import Base, get_db
from canvas_service.core.redis import get_redis

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_USER_ID_2 = "00000000-0000-0000-0000-000000000002"

# ---------------------------------------------------------------------------
# In-memory SQLite engine with PostgreSQL type compilation overrides
# ---------------------------------------------------------------------------
test_engine = create_async_engine("sqlite+aiosqlite://", echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


@event.listens_for(test_engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"

@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _dispose_engine():
    """Dispose the async engine after the entire test session."""
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    """Create all tables before each test, drop after."""
    # Import models so they register with Base.metadata
    import canvas_service.modules.boards.models  # noqa: F401
    import canvas_service.modules.canvas_objects.models  # noqa: F401

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_get_db():
    async with TestSessionLocal() as session:
        yield session


async def _override_get_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Test client with dependency overrides
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client(_setup_db):
    from canvas_service.main import app

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_redis] = _override_get_redis

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
