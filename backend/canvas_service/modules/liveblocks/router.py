from fastapi import APIRouter, Depends, Request

from canvas_service.core.auth import get_current_user
from canvas_service.modules.liveblocks.service import create_liveblocks_session

router = APIRouter(prefix="/api/liveblocks", tags=["liveblocks"])


@router.post("/auth")
async def liveblocks_auth(request: Request, user_id: str = Depends(get_current_user)):
    try:
        body = await request.json()
    except Exception:
        body = {}
    room_id = body.get("room")
    user_name = body.get("userName", "User")

    result = await create_liveblocks_session(
        user_id=str(user_id),
        user_name=user_name,
        room_id=room_id,
    )
    return result
