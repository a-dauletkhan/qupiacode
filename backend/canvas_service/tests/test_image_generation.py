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
        self.calls.append({"url": url, "headers": headers, "json": json})
        return self.response


async def test_generate_image_submits_request(client, valid_token, monkeypatch):
    captured: dict[str, object] = {}

    async def fake_submit(data, *, user_id: str):
        captured["node_id"] = data.node_id
        captured["text"] = data.text
        captured["resolution"] = data.resolution
        captured["user_id"] = user_id
        return {"job_id": "job-123"}

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
    assert response.json() == {"status": "submitted"}
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
            "url": "https://example.test/generate",
            "headers": {
                "Authorization": "Key api-key:api-secret",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            "json": {
                "prompt": "cinematic startup office",
                "aspect_ratio": "16:9",
                "resolution": "720p",
            },
        }
    ]
    assert "Received canvas image generation request" in caplog.text
    assert "Submitted image generation request" in caplog.text
    assert "job-123" in caplog.text
