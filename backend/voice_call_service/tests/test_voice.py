from typing import Any, cast

from fastapi.testclient import TestClient


def test_issue_voice_token_returns_room_scoped_credentials(client: TestClient) -> None:
    response = client.post(
        "/api/voice/token",
        json={
            "canvas_id": "canvas-123",
            "user_id": "user-456",
            "display_name": "Ava",
        },
    )

    assert response.status_code == 200
    data = cast(dict[str, Any], response.json())
    assert data["server_url"] == "ws://localhost:7880"
    assert data["room_name"] == "canvas:canvas-123"
    assert data["participant_identity"] == "user:user-456"
    assert data["participant_name"] == "Ava"
    assert data["agent"] == {
        "enabled": False,
        "name": "Qupia Agent",
        "wake_phrases": ["agent", "hey agent", "ai agent"],
        "transcription_mode": "mock",
        "transcript_forwarding_enabled": False,
        "transcript_partials_enabled": True,
        "diarization_enabled": False,
    }
    assert isinstance(data["token"], str)
    assert len(data["token"].split(".")) == 3


def test_issue_voice_token_rejects_invalid_input(client: TestClient) -> None:
    response = client.post(
        "/api/voice/token",
        json={
            "canvas_id": "   ",
            "user_id": "user-456",
            "display_name": "Ava",
        },
    )

    assert response.status_code == 422
