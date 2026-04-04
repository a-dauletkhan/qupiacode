import json
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from canvas_service.core.auth import get_current_user
from canvas_service.core.database import get_db
from canvas_service.core.redis import get_redis
from canvas_service.modules.canvas_objects import service
from canvas_service.modules.canvas_objects.schemas import (
    CanvasResponse,
    EdgeCreate,
    EdgeResponse,
    EdgeUpdate,
    NodeCreate,
    NodeResponse,
    NodeUpdate,
)
from canvas_service.modules.collaboration.events import EventType, make_event

router = APIRouter(prefix="/boards/{board_id}", tags=["canvas"])


@router.get("/canvas", response_model=CanvasResponse)
async def get_canvas(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.get_canvas(db, board_id)


@router.post("/nodes", response_model=NodeResponse, status_code=201)
async def create_node(
    board_id: UUID,
    data: NodeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    node = await service.create_node(db, board_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.NODE_CREATED, NodeResponse.model_validate(node).model_dump(mode="json"))),
    )
    return node


@router.patch("/nodes/{node_id}", response_model=NodeResponse)
async def update_node(
    board_id: UUID,
    node_id: UUID,
    data: NodeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    node = await service.update_node(db, board_id, node_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.NODE_UPDATED, NodeResponse.model_validate(node).model_dump(mode="json"))),
    )
    return node


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(
    board_id: UUID,
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    await service.delete_node(db, board_id, node_id)
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.NODE_DELETED, {"id": str(node_id)})),
    )


@router.post("/edges", response_model=EdgeResponse, status_code=201)
async def create_edge(
    board_id: UUID,
    data: EdgeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    edge = await service.create_edge(db, board_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.EDGE_CREATED, EdgeResponse.model_validate(edge).model_dump(mode="json"))),
    )
    return edge


@router.patch("/edges/{edge_id}", response_model=EdgeResponse)
async def update_edge(
    board_id: UUID,
    edge_id: UUID,
    data: EdgeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    edge = await service.update_edge(db, board_id, edge_id, data, UUID(user_id))
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.EDGE_UPDATED, EdgeResponse.model_validate(edge).model_dump(mode="json"))),
    )
    return edge


@router.delete("/edges/{edge_id}", status_code=204)
async def delete_edge(
    board_id: UUID,
    edge_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    await service.delete_edge(db, board_id, edge_id)
    await redis.publish(
        f"board:{board_id}",
        json.dumps(make_event(EventType.EDGE_DELETED, {"id": str(edge_id)})),
    )
