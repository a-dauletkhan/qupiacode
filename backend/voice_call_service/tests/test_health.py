from typing import Any, cast

from fastapi.testclient import TestClient


def test_healthz_returns_ok(client: TestClient) -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    data = cast(dict[str, Any], response.json())
    assert data == {"status": "ok"}
