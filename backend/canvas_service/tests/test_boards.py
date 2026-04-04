import pytest

from canvas_service.tests.conftest import TEST_USER_ID, TEST_USER_ID_2, make_token

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


async def test_list_boards_returns_created_board(client, valid_token):
    await client.post(
        "/boards",
        json={"name": "Shared Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )

    response = await client.get(
        "/boards",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200
    boards = response.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "Shared Board"


async def test_get_board_not_found(client, valid_token):
    response = await client.get(
        "/boards/00000000-0000-0000-0000-000000000099",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 404


async def test_join_board_allows_self_invite_accept(client, valid_token):
    create_response = await client.post(
        "/boards",
        json={"name": "Invite Board"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert create_response.status_code == 201
    board_id = create_response.json()["id"]

    invited_token = make_token(TEST_USER_ID_2)
    join_response = await client.post(
        f"/boards/{board_id}/members",
        json={"user_id": TEST_USER_ID_2, "role": "editor"},
        headers={"Authorization": f"Bearer {invited_token}"},
    )
    assert join_response.status_code == 201
    assert join_response.json()["user_id"] == TEST_USER_ID_2

    repeat_join_response = await client.post(
        f"/boards/{board_id}/members",
        json={"user_id": TEST_USER_ID_2, "role": "editor"},
        headers={"Authorization": f"Bearer {invited_token}"},
    )
    assert repeat_join_response.status_code == 201
    assert repeat_join_response.json()["user_id"] == TEST_USER_ID_2


async def test_requires_auth(client):
    response = await client.get("/boards")
    assert response.status_code == 401
