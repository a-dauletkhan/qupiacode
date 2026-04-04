from typing import cast

import httpx
import pytest

from canvas_service.modules.liveblocks import service

pytestmark = pytest.mark.asyncio


class _FakeResponse:
    def __init__(self, *, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    @property
    def is_error(self) -> bool:
        return self.status_code >= 400

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    def __init__(self, response: _FakeResponse):
        self.response = response
        self.calls: list[tuple[str, dict[str, str]]] = []

    async def get(self, url: str, headers: dict[str, str]) -> _FakeResponse:
        self.calls.append((url, headers))
        return self.response


async def test_resolve_user_info_uses_supabase_service_role_key(monkeypatch):
    fake_client = _FakeClient(
        _FakeResponse(
            status_code=200,
            payload={
                "user_metadata": {"name": "Dauletkhan", "avatar_url": "https://example.com/a.png"},
                "email": "d@example.com",
            },
        )
    )

    monkeypatch.setattr(service, "get_supabase_service_role_key", lambda: "sb_secret_test")

    result = await service._resolve_user_info(cast(httpx.AsyncClient, fake_client), "user-123")

    assert result == {
        "name": "Dauletkhan",
        "avatar": "https://example.com/a.png",
    }
    assert fake_client.calls == [
        (
            f"{service._SUPABASE_AUTH_URL}/admin/users/user-123",
            {
                "apikey": "sb_secret_test",
                "Authorization": "Bearer sb_secret_test",
                "Content-Type": "application/json",
            },
        )
    ]


async def test_resolve_user_info_falls_back_when_admin_lookup_fails(monkeypatch):
    fake_client = _FakeClient(_FakeResponse(status_code=401, payload={}))

    monkeypatch.setattr(service, "get_supabase_service_role_key", lambda: "sb_secret_test")

    result = await service._resolve_user_info(cast(httpx.AsyncClient, fake_client), "user-123")

    assert result == {
        "name": "user-123",
        "avatar": "",
    }
