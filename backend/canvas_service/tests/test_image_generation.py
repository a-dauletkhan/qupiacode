import logging

import pytest

pytestmark = pytest.mark.asyncio


async def test_generate_image_logs_request(client, valid_token, caplog):
    caplog.set_level(logging.INFO)

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
    assert response.json() == {"status": "logged"}
    assert "Received canvas image generation request" in caplog.text
    assert "image-123" in caplog.text
    assert "cinematic startup office" in caplog.text
    assert "16:9" in caplog.text


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
