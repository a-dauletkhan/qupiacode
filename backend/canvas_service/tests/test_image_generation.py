import logging

import pytest

from canvas_service.modules.image_generation import router, service

pytestmark = pytest.mark.asyncio


class FakeResponse:
    def __init__(self, *, status_code: int, json_data: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text

    @property
    def is_error(self) -> bool:
        return self.status_code >= 400

    def json(self) -> dict:
        if self._json_data is None:
            raise ValueError("No JSON payload configured")
        return self._json_data


class FakeAsyncClient:
    def __init__(self, *, response: FakeResponse):
        self.response = response
        self.calls: list[dict] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, url: str, *, headers: dict, json: dict):
        self.calls.append({"method": "POST", "url": url, "headers": headers, "json": json})
        return self.response

    async def get(self, url: str, *, headers: dict):
        self.calls.append({"method": "GET", "url": url, "headers": headers})
        return self.response


async def test_generate_image_submits_request(client, valid_token, monkeypatch):
    captured: dict[str, object] = {}

    async def fake_submit(data, *, user_id: str):
        captured["node_id"] = data.node_id
        captured["text"] = data.text
        captured["resolution"] = data.resolution
        captured["user_id"] = user_id
        return {"request_id": "req-abc-123"}

    monkeypatch.setattr(router, "submit_image_generation_request", fake_submit)

    response = await client.post(
        "/images/generate",
        json={
            "node_id": "image-123",
            "text": "cinematic startup office",
            "resolution": "16:9",
        },
        headers={"Authorization": f"Bearer {valid_token}"},
    )

    assert response.status_code == 202
    assert response.json() == {"status": "submitted", "request_id": "req-abc-123"}
    assert captured == {
        "node_id": "image-123",
        "text": "cinematic startup office",
        "resolution": "16:9",
        "user_id": "00000000-0000-0000-0000-000000000001",
    }


async def test_generate_image_requires_auth(client):
    response = await client.post(
        "/images/generate",
        json={
            "node_id": "image-123",
            "text": "cinematic startup office",
            "resolution": "16:9",
        },
    )

    assert response.status_code == 401


async def test_submit_image_generation_request_calls_higgsfield(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    fake_response = FakeResponse(status_code=200, json_data={"id": "job-123"})
    fake_client = FakeAsyncClient(response=fake_response)

    monkeypatch.setattr(service.settings, "higgsfield_api_key", "api-key")
    monkeypatch.setattr(service.settings, "higgsfield_api_key_secret", "api-secret")
    monkeypatch.setattr(service.settings, "higgsfield_api_url", "https://example.test/generate")
    monkeypatch.setattr(service.settings, "higgsfield_resolution", "720p")
    monkeypatch.setattr(
        service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake_client,
    )

    payload = await service.submit_image_generation_request(
        service.ImageGenerationRequest(
            node_id="image-123",
            text="cinematic startup office",
            resolution="3:2",
        ),
        user_id="user-123",
    )

    assert payload == {"id": "job-123"}
    assert fake_client.calls == [
        {
            "method": "POST",
            "url": "https://example.test/generate",
            "headers": {
                "Content-Type": "application/json",
                "hf-api-key": "api-key",
                "hf-secret": "api-secret",
            },
            "json": {
                "prompt": "cinematic startup office",
                "batch_size": 1,
                "resolution": "720p",
                "aspect_ratio": "3:2",
                "enhance_prompt": True,
                "style_strength": 1,
            },
        }
    ]
    assert "Received canvas image generation request" in caplog.text
    assert "Submitted image generation request" in caplog.text
    assert "job-123" in caplog.text


async def test_generation_status_returns_provider_response(client, valid_token, monkeypatch):
    status_payload = {
        "request_id": "123e4567-e89b-12d3-a456-426614174000",
        "status": "completed",
        "status_url": "https://example.com/status",
        "cancel_url": "https://example.com/cancel",
        "images": [{"url": "https://cdn.example.com/image.png"}],
    }

    async def fake_get_status(request_id, *, user_id):
        return status_payload

    monkeypatch.setattr(router, "get_generation_status", fake_get_status)

    response = await client.get(
        "/images/status/123e4567-e89b-12d3-a456-426614174000",
        headers={"Authorization": f"Bearer {valid_token}"},
    )

    assert response.status_code == 200
    assert response.json() == status_payload


async def test_generation_status_requires_auth(client):
    response = await client.get(
        "/images/status/123e4567-e89b-12d3-a456-426614174000",
    )

    assert response.status_code == 401


async def test_get_generation_status_calls_higgsfield(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    status_data = {
        "request_id": "abc-123",
        "status": "completed",
        "status_url": "https://hf.test/status",
        "cancel_url": "https://hf.test/cancel",
    }
    fake_response = FakeResponse(status_code=200, json_data=status_data)
    fake_client = FakeAsyncClient(response=fake_response)

    monkeypatch.setattr(service.settings, "higgsfield_api_key", "api-key")
    monkeypatch.setattr(service.settings, "higgsfield_api_key_secret", "api-secret")
    monkeypatch.setattr(service.settings, "higgsfield_api_url", "https://platform.higgsfield.ai/higgsfield-ai/soul/standard")
    monkeypatch.setattr(
        service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake_client,
    )

    result = await service.get_generation_status("abc-123", user_id="user-456")

    assert result == status_data
    assert fake_client.calls == [
        {
            "method": "GET",
            "url": "https://platform.higgsfield.ai/requests/abc-123/status",
            "headers": {
                "Content-Type": "application/json",
                "hf-api-key": "api-key",
                "hf-secret": "api-secret",
            },
        }
    ]
    assert "Polling generation status" in caplog.text
    assert "abc-123" in caplog.text


async def test_get_generation_status_propagates_error(monkeypatch):
    fake_response = FakeResponse(status_code=500, json_data={"detail": "internal error"})
    fake_client = FakeAsyncClient(response=fake_response)

    monkeypatch.setattr(service.settings, "higgsfield_api_key", "api-key")
    monkeypatch.setattr(service.settings, "higgsfield_api_key_secret", "api-secret")
    monkeypatch.setattr(service.settings, "higgsfield_api_url", "https://platform.higgsfield.ai/soul/standard")
    monkeypatch.setattr(
        service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake_client,
    )

    with pytest.raises(service.HTTPException) as exc_info:
        await service.get_generation_status("bad-id", user_id="user-456")

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "internal error"
