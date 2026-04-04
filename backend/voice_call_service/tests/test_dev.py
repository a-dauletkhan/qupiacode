from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


def test_voice_test_page_is_available_in_test_env(client: TestClient) -> None:
    response = client.get("/dev/voice-test")

    assert response.status_code == 200
    assert "Join and Unmute" in response.text
    assert "/api/voice/token" in response.text


def test_voice_test_page_is_not_registered_in_production(
    monkeypatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()

    try:
        with TestClient(create_app()) as client:
            response = client.get("/dev/voice-test")
    finally:
        get_settings.cache_clear()

    assert response.status_code == 404
