import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from canvas_service.core.auth import verify_token
from canvas_service.core.database import AsyncSessionLocal
from canvas_service.core.redis import get_redis
from canvas_service.modules.canvas_objects import service as canvas_service
from canvas_service.modules.canvas_objects.schemas import EdgeUpdate, NodeUpdate
from canvas_service.modules.collaboration.connection_manager import manager
from canvas_service.modules.collaboration.events import EventType, make_event

router = APIRouter(tags=["collaboration"])


@router.websocket("/ws/{board_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    board_id: str,
    token: str = Query(...),
):
    try:
        user_id = verify_token(token)
    except ValueError:
        await websocket.close(code=4001)
        return

    redis = await get_redis()
    await manager.connect(board_id, websocket)

    # Subscribe to Redis channel for this board
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"board:{board_id}")

    # Announce this user joined to other clients
    join_msg = json.dumps(make_event(EventType.USER_JOINED, {"user_id": user_id}))
    await redis.publish(f"board:{board_id}", join_msg)

    async def redis_listener():
        """Forward all Redis messages to this WebSocket connection."""
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    await websocket.send_text(message["data"])
                except Exception:
                    break

    listener_task = asyncio.create_task(redis_listener())

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_event(data, board_id, user_id, redis)
    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()
        manager.disconnect(board_id, websocket)
        await pubsub.unsubscribe(f"board:{board_id}")
        await pubsub.aclose()
        leave_msg = json.dumps(make_event(EventType.USER_LEFT, {"user_id": user_id}))
        await redis.publish(f"board:{board_id}", leave_msg)


async def _handle_event(data: dict, board_id: str, user_id: str, redis) -> None:
    """Persist the event (if applicable) and publish to Redis."""
    event = data.get("event")
    payload = data.get("payload", {})

    if event == EventType.CURSOR_MOVED:
        payload["user_id"] = user_id
        await redis.publish(
            f"board:{board_id}",
            json.dumps(make_event(EventType.CURSOR_MOVED, payload)),
        )
        return

    async with AsyncSessionLocal() as db:
        try:
            if event == EventType.NODE_UPDATED:
                update = NodeUpdate(**payload)
                await canvas_service.update_node(db, UUID(board_id), UUID(payload["id"]), update, UUID(user_id))

            elif event == EventType.NODE_DELETED:
                await canvas_service.delete_node(db, UUID(board_id), UUID(payload["id"]))

            elif event == EventType.EDGE_UPDATED:
                update = EdgeUpdate(**payload)
                await canvas_service.update_edge(db, UUID(board_id), UUID(payload["id"]), update, UUID(user_id))

            elif event == EventType.EDGE_DELETED:
                await canvas_service.delete_edge(db, UUID(board_id), UUID(payload["id"]))

            else:
                return  # unknown event — ignore
        except Exception:
            return  # silently drop failed persistence (LWW conflict or bad payload)

    payload["updated_by"] = user_id
    await redis.publish(f"board:{board_id}", json.dumps(make_event(event, payload)))
