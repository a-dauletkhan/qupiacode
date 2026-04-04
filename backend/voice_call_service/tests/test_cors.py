from collections.abc import Generator
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


@contextmanager
def _client_with_fresh_settings() -> Generator[TestClient, None, None]:
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            yield client
    finally:
        get_settings.cache_clear()


def test_cors_allows_exact_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    origin = "https://voice.qupia.app"
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", origin)

    with _client_with_fresh_settings() as client:
        response = client.options(
            "/api/voice/token",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "POST" in response.headers["access-control-allow-methods"]


def test_cors_allows_matching_preview_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    origin = "https://feature-123-qupia.vercel.app"
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGIN_REGEX",
        r"^https://.*-qupia\.vercel\.app$",
    )

    with _client_with_fresh_settings() as client:
        response = client.options(
            "/api/voice/token",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_cors_rejects_disallowed_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://voice.qupia.app")
    disallowed_origin = "https://not-allowed.example.com"

    with _client_with_fresh_settings() as client:
        response = client.options(
            "/api/voice/token",
            headers={
                "Origin": disallowed_origin,
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
