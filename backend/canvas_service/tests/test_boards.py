import pytest
from tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.asyncio


async def test_create_board(client, valid_token):
    response = await client.post(
        "/boards",
        json={"name": "My Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Board"
    assert data["owner_id"] == TEST_USER_ID


async def test_list_boards_empty(client, valid_token):
    response = await client.get(
        "/boards",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_board_not_found(client, valid_token):
    response = await client.get(
        "/boards/00000000-0000-0000-0000-000000000099",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 404


async def test_requires_auth(client):
    response = await client.get("/boards")
    assert response.status_code == 403
