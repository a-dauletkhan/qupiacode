import asyncio

import httpx
from canvas_service.core.config import settings

_LIVEBLOCKS_HEADERS = {
    "Authorization": f"Bearer {settings.liveblocks_secret_key}",
    "Content-Type": "application/json",
}
_SUPABASE_AUTH_URL = f"{settings.supabase_url}/auth/v1"
_SUPABASE_HEADERS = {
    "apikey": settings.supabase_key,
    "Authorization": f"Bearer {settings.supabase_key}",
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


async def create_liveblocks_session(user_id: str, user_name: str, room_id: str | None) -> dict:
    """Generate a Liveblocks session token for the given user and room."""
    async with httpx.AsyncClient() as client:
        if room_id:
            await _ensure_room(client, room_id)

        payload: dict = {
            "userId": user_id,
            "userInfo": {
                "name": user_name,
            },
        }
        if room_id:
            payload["groupIds"] = [room_id]

        response = await client.post(
            "https://api.liveblocks.io/v2/identify-user",
            headers=_LIVEBLOCKS_HEADERS,
            json=payload,
        )
        response.raise_for_status()
        return response.json()


def _fallback_user_info(user_id: str) -> dict:
    return {
        "name": user_id,
        "avatar": "",
    }


async def _resolve_user_info(
    client: httpx.AsyncClient,
    user_id: str,
) -> dict:
    resp = await client.get(
        f"{_SUPABASE_AUTH_URL}/admin/users/{user_id}",
        headers=_SUPABASE_HEADERS,
    )
    if resp.is_error:
        return _fallback_user_info(user_id)

    user_data = resp.json()
    user_metadata = user_data.get("user_metadata") or {}
    name = user_metadata.get("name") or user_data.get("email") or user_id
    avatar = user_metadata.get("avatar_url") or user_metadata.get("avatar") or ""

    return {
        "name": name,
        "avatar": avatar,
    }


async def resolve_liveblocks_users(user_ids: list[str]) -> list[dict]:
    """Resolve Liveblocks user IDs to display metadata in the same order."""
    async with httpx.AsyncClient() as client:
        return await asyncio.gather(
            *(_resolve_user_info(client, user_id) for user_id in user_ids)
        )
