import httpx

from canvas_service.core.config import settings

_LIVEBLOCKS_HEADERS = {
    "Authorization": f"Bearer {settings.liveblocks_secret_key}",
    "Content-Type": "application/json",
}


async def _ensure_room(client: httpx.AsyncClient, room_id: str) -> None:
    """Create the Liveblocks room if it doesn't already exist."""
    resp = await client.post(
        "https://api.liveblocks.io/v2/rooms",
        headers=_LIVEBLOCKS_HEADERS,
        json={
            "id": room_id,
            "defaultAccesses": ["room:write"],
        },
    )
    # 409 = room already exists — that's fine
    if resp.status_code != 409:
        resp.raise_for_status()


async def create_liveblocks_session(
    user_id: str, user_name: str, room_id: str
) -> dict:
    """Generate a Liveblocks session token for the given user and room."""
    async with httpx.AsyncClient() as client:
        await _ensure_room(client, room_id)

        response = await client.post(
            "https://api.liveblocks.io/v2/identify-user",
            headers=_LIVEBLOCKS_HEADERS,
            json={
                "userId": user_id,
                "groupIds": [room_id],
                "userInfo": {
                    "name": user_name,
                },
            },
        )
        response.raise_for_status()
        return response.json()
