import httpx
from core.config import settings


async def create_liveblocks_session(user_id: str, user_name: str, room_id: str) -> dict:
    """Generate a Liveblocks session token for the given user and room."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.liveblocks.io/v2/identify-user",
            headers={
                "Authorization": f"Bearer {settings.liveblocks_secret_key}",
                "Content-Type": "application/json",
            },
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
