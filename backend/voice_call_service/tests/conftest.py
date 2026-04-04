from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient


def _get_settings():
    from voice_call_service.app.core.config import get_settings

    return get_settings


@pytest.fixture(autouse=True)
def _configure_test_environment(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("APP_HOST", "127.0.0.1")
    monkeypatch.setenv("APP_PORT", "8000")
    monkeypatch.setenv("LIVEKIT_URL", "ws://localhost:7880")
    monkeypatch.setenv("LIVEKIT_API_KEY", "test-api-key")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "test-api-secret-that-is-at-least-32-bytes")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("VOICE_TOKEN_TTL_SECONDS", "3600")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "")
    monkeypatch.setenv("CORS_ALLOWED_ORIGIN_REGEX", "")
    monkeypatch.setenv("VOICE_AGENT_ENABLED", "false")
    monkeypatch.setenv("VOICE_AGENT_NAME", "Qupia Agent")
    monkeypatch.setenv("VOICE_AGENT_WAKE_PHRASES", "agent,hey agent,ai agent")
    monkeypatch.setenv("VOICE_AGENT_TRANSCRIPTION_MODE", "mock")
    monkeypatch.setenv("VOICE_AGENT_STT_MODEL", "assemblyai/universal-streaming")
    monkeypatch.setenv("VOICE_AGENT_STT_LANGUAGE", "en")
    monkeypatch.setenv("VOICE_AGENT_TRANSCRIPT_FORWARD_URL", "")
    monkeypatch.setenv("VOICE_AGENT_TRANSCRIPT_FORWARD_AUTH_TOKEN", "")
    monkeypatch.setenv("VOICE_AGENT_TRANSCRIPT_FORWARD_PARTIALS_ENABLED", "false")
    monkeypatch.setenv(
        "VOICE_AGENT_MOCK_TRANSCRIPT_TEMPLATE",
        "[mock] {participant_name} shared a prototype update.",
    )
    monkeypatch.setenv("VOICE_AGENT_TRANSCRIPT_PARTIALS_ENABLED", "true")
    monkeypatch.setenv("VOICE_AGENT_DIARIZATION_ENABLED", "false")
    get_settings = _get_settings()
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    from voice_call_service.app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client
