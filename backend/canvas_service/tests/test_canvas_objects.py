import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.asyncio

BOARD_ID = None  # set in fixture


@pytest_asyncio.fixture(autouse=True)
async def board(client, valid_token):
    """Create a fresh board before each test."""
    resp = await client.post(
        "/boards",
        json={"name": "Test Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    global BOARD_ID
    BOARD_ID = resp.json()["id"]


async def test_create_node(client, valid_token):
    response = await client.post(
        f"/boards/{BOARD_ID}/nodes",
        json={
            "type": "canvas-node",
            "position": {"x": 100, "y": 200},
            "data": {"label": "Project brief", "kind": "Input", "note": "Scope and constraints"},
        },
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "canvas-node"
    assert data["position"] == {"x": 100.0, "y": 200.0}
    assert data["data"]["label"] == "Project brief"
    assert "id" in data


async def test_get_canvas_returns_nodes_and_edges(client, valid_token):
    await client.post(
        f"/boards/{BOARD_ID}/nodes",
        json={"type": "canvas-node", "position": {"x": 0, "y": 0}, "data": {"label": "Test", "kind": "Workspace", "note": ""}},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    response = await client.get(
        f"/boards/{BOARD_ID}/canvas",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) == 1


async def test_lww_rejects_stale_update(client, valid_token):
    create_resp = await client.post(
        f"/boards/{BOARD_ID}/nodes",
        json={"type": "canvas-node", "position": {"x": 0, "y": 0}, "data": {"label": "Test", "kind": "Workspace", "note": ""}},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    node_id = create_resp.json()["id"]

    stale_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    response = await client.patch(
        f"/boards/{BOARD_ID}/nodes/{node_id}",
        json={"position": {"x": 999, "y": 999}, "updated_at": stale_time},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 409
