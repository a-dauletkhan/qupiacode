import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _get_settings():
    from app.core.config import get_settings

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
    get_settings = _get_settings()
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client
