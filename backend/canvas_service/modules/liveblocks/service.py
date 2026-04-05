import asyncio
import logging

import httpx
from fastapi import HTTPException

from canvas_service.core.config import settings
from canvas_service.core.supabase import get_supabase_service_role_key

logger = logging.getLogger(__name__)


_LIVEBLOCKS_HEADERS = {
    "Authorization": f"Bearer {settings.liveblocks_secret_key}",
    "Content-Type": "application/json",
}
_SUPABASE_AUTH_URL = f"{settings.supabase_url}/auth/v1"


def _liveblocks_headers() -> dict[str, str]:
    key = settings.liveblocks_secret_key
    if not key:
        raise HTTPException(status_code=503, detail="LIVEBLOCKS_SECRET_KEY is not configured")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _supabase_admin_headers() -> dict[str, str]:
    key = get_supabase_service_role_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _ai_agent_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.ai_agent_internal_token}",
        "Content-Type": "application/json",
    }


async def _ensure_room(client: httpx.AsyncClient, room_id: str) -> None:
    """Create the Liveblocks room if it doesn't already exist."""
    resp = await client.post(
        "https://api.liveblocks.io/v2/rooms",
        headers=_liveblocks_headers(),
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
            headers=_liveblocks_headers(),
            json=payload,
        )
        response.raise_for_status()

        # Fire-and-forget: notify AI agent service to join this room
        if room_id:
            try:
                await client.post(
                    f"{settings.ai_agent_service_url.rstrip('/')}/internal/rooms/{room_id}/join",
                    headers=_ai_agent_headers(),
                    timeout=2.0,
                )
            except Exception as exc:
                logger.warning("Failed to notify AI agent service for room %s: %s", room_id, exc)

        return response.json()


def _fallback_user_info(user_id: str) -> dict:
    if user_id == "ai-agent":
        return {
            "name": "AI Agent",
            "avatar": "",
        }
    return {
        "name": user_id,
        "avatar": "",
    }


async def _resolve_user_info(
    client: httpx.AsyncClient,
    user_id: str,
) -> dict:
    try:
        headers = _supabase_admin_headers()
    except RuntimeError as exc:
        logger.warning("Failed to resolve Liveblocks user %s: %s", user_id, exc)
        return _fallback_user_info(user_id)

    resp = await client.get(f"{_SUPABASE_AUTH_URL}/admin/users/{user_id}", headers=headers)
    if resp.is_error:
        logger.warning(
            "Failed to resolve Liveblocks user %s from Supabase admin API: %s",
            user_id,
            resp.status_code,
        )
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
