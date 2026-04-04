import pytest
from unittest.mock import patch, AsyncMock
from starlette.testclient import TestClient
from tests.conftest import make_token, TEST_USER_ID, _override_get_db, _override_get_redis

import fakeredis.aioredis
from core.database import get_db
from core.redis import get_redis

pytestmark = pytest.mark.asyncio

_fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)


def _make_test_client():
    """Create a TestClient with lifespan disabled (no real Redis connection)."""
    from main import app

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_redis] = _override_get_redis
    # Patch the redis module so WebSocket handler (which calls get_redis()
    # directly, outside FastAPI DI) gets a fake instance.
    with patch("core.redis._redis_client", _fake_redis), \
         patch("core.redis.init_redis", new_callable=AsyncMock), \
         patch("core.redis.close_redis", new_callable=AsyncMock):
        with TestClient(app) as c:
            yield c
    app.dependency_overrides.clear()


async def test_ws_rejects_invalid_token(client):
    for c in _make_test_client():
        with pytest.raises(Exception):
            with c.websocket_connect("/ws/some-board-id?token=invalid"):
                pass


async def test_ws_connects_with_valid_token(client, valid_token):
    board_resp = await client.post(
        "/boards",
        json={"name": "WS Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    board_id = board_resp.json()["id"]

    for c in _make_test_client():
        with c.websocket_connect(f"/ws/{board_id}?token={valid_token}") as ws:
            assert ws is not None
