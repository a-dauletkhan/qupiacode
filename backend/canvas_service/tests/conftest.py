import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-supabase-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-supabase-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret")
os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "canvas-media")

from canvas_service.core.config import settings

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_USER_ID_2 = "00000000-0000-0000-0000-000000000002"


class FakeSupabaseResponse:
    def __init__(self, data):
        self.data = data


class FakeSupabaseQuery:
    def __init__(self, store: dict[str, list[dict]], table_name: str):
        self._store = store
        self._table_name = table_name
        self._action = "select"
        self._filters: list[tuple[str, str, object]] = []
        self._order_by: tuple[str, bool] | None = None
        self._limit: int | None = None
        self._payload: dict | list[dict] | None = None

    def select(self, *_columns, **_kwargs):
        self._action = "select"
        return self

    def insert(self, payload, **_kwargs):
        self._action = "insert"
        self._payload = payload
        return self

    def delete(self, **_kwargs):
        self._action = "delete"
        return self

    def eq(self, column: str, value: object):
        self._filters.append(("eq", column, value))
        return self

    def in_(self, column: str, values):
        self._filters.append(("in", column, list(values)))
        return self

    def order(self, column: str, *, desc: bool = False, **_kwargs):
        self._order_by = (column, desc)
        return self

    def limit(self, size: int, **_kwargs):
        self._limit = size
        return self

    def _matches(self, row: dict) -> bool:
        for operator, column, value in self._filters:
            if operator == "eq" and row.get(column) != value:
                return False
            if operator == "in":
                if not isinstance(value, list) or row.get(column) not in value:
                    return False
        return True

    async def execute(self):
        rows = self._store[self._table_name]

        if self._action == "insert":
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            inserted_rows: list[dict] = []
            for payload in payloads:
                row = dict(payload or {})
                if self._table_name == "boards":
                    timestamp = datetime.now(timezone.utc).isoformat()
                    row.setdefault("id", str(uuid4()))
                    row.setdefault("created_at", timestamp)
                    row.setdefault("updated_at", timestamp)
                inserted_rows.append(row)
                rows.append(row)
            return FakeSupabaseResponse(inserted_rows)

        if self._action == "delete":
            deleted_rows = [dict(row) for row in rows if self._matches(row)]
            self._store[self._table_name] = [
                row for row in rows if not self._matches(row)
            ]
            return FakeSupabaseResponse(deleted_rows)

        selected_rows = [dict(row) for row in rows if self._matches(row)]
        if self._order_by is not None:
            column, desc = self._order_by
            selected_rows.sort(key=lambda row: row.get(column) or "", reverse=desc)
        if self._limit is not None:
            selected_rows = selected_rows[: self._limit]
        return FakeSupabaseResponse(selected_rows)


class FakeSupabaseClient:
    def __init__(self):
        self.store: dict[str, list[dict]] = {
            "boards": [],
            "board_members": [],
        }

    def table(self, table_name: str) -> FakeSupabaseQuery:
        return FakeSupabaseQuery(self.store, table_name)


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch):
    from canvas_service.modules.boards import service

    client = FakeSupabaseClient()

    async def _fake_get_supabase_admin_client():
        return client

    monkeypatch.setattr(service, "get_supabase_admin_client", _fake_get_supabase_admin_client)
    return client


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
async def client():
    from canvas_service.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
