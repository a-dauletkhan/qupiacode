# pyright: reportAttributeAccessIssue=false, reportGeneralTypeIssues=false

from datetime import timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from canvas_service.modules.canvas_objects.models import CanvasEdge, CanvasNode
from canvas_service.modules.canvas_objects.schemas import (
    CanvasResponse,
    EdgeCreate,
    EdgeResponse,
    EdgeUpdate,
    NodeCreate,
    NodeResponse,
    NodeUpdate,
)


async def get_canvas(db: AsyncSession, board_id: UUID) -> CanvasResponse:
    nodes_result = await db.execute(select(CanvasNode).where(CanvasNode.board_id == board_id))
    edges_result = await db.execute(select(CanvasEdge).where(CanvasEdge.board_id == board_id))
    return CanvasResponse(
        nodes=[NodeResponse.model_validate(n) for n in nodes_result.scalars().all()],
        edges=[EdgeResponse.model_validate(e) for e in edges_result.scalars().all()],
    )


async def create_node(
    db: AsyncSession, board_id: UUID, data: NodeCreate, user_id: UUID
) -> CanvasNode:
    node = CanvasNode(
        board_id=board_id,
        type=data.type,
        position=data.position.model_dump(),
        width=data.width,
        height=data.height,
        z_index=data.z_index,
        parent_id=data.parent_id,
        data=data.data,
        updated_by=user_id,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


async def update_node(
    db: AsyncSession, board_id: UUID, node_id: UUID, data: NodeUpdate, user_id: UUID
) -> CanvasNode:
    result = await db.execute(
        select(CanvasNode).where(CanvasNode.id == node_id, CanvasNode.board_id == board_id)
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # LWW: reject if client timestamp is not newer than DB
    client_ts = data.updated_at.replace(tzinfo=timezone.utc) if data.updated_at.tzinfo is None else data.updated_at
    db_ts = node.updated_at.replace(tzinfo=timezone.utc) if node.updated_at.tzinfo is None else node.updated_at
    if client_ts <= db_ts:
        raise HTTPException(status_code=409, detail="Conflict: a newer update already exists")

    if data.position is not None:
        node.position = data.position.model_dump()
    if data.width is not None:
        node.width = data.width
    if data.height is not None:
        node.height = data.height
    if data.z_index is not None:
        node.z_index = data.z_index
    if data.data is not None:
        node.data = data.data
    node.updated_by = user_id

    await db.commit()
    await db.refresh(node)
    return node


async def delete_node(db: AsyncSession, board_id: UUID, node_id: UUID) -> None:
    result = await db.execute(
        select(CanvasNode).where(CanvasNode.id == node_id, CanvasNode.board_id == board_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Node not found")
    await db.execute(delete(CanvasNode).where(CanvasNode.id == node_id))
    await db.commit()


async def create_edge(
    db: AsyncSession, board_id: UUID, data: EdgeCreate, user_id: UUID
) -> CanvasEdge:
    edge = CanvasEdge(
        board_id=board_id,
        source=data.source,
        target=data.target,
        source_handle=data.source_handle,
        target_handle=data.target_handle,
        type=data.type,
        animated=data.animated,
        label=data.label,
        data=data.data,
        updated_by=user_id,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


async def update_edge(
    db: AsyncSession, board_id: UUID, edge_id: UUID, data: EdgeUpdate, user_id: UUID
) -> CanvasEdge:
    result = await db.execute(
        select(CanvasEdge).where(CanvasEdge.id == edge_id, CanvasEdge.board_id == board_id)
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")

    client_ts = data.updated_at.replace(tzinfo=timezone.utc) if data.updated_at.tzinfo is None else data.updated_at
    db_ts = edge.updated_at.replace(tzinfo=timezone.utc) if edge.updated_at.tzinfo is None else edge.updated_at
    if client_ts <= db_ts:
        raise HTTPException(status_code=409, detail="Conflict: a newer update already exists")

    for field in ("source_handle", "target_handle", "type", "animated", "label", "data"):
        value = getattr(data, field)
        if value is not None:
            setattr(edge, field, value)
    edge.updated_by = user_id

    await db.commit()
    await db.refresh(edge)
    return edge


async def delete_edge(db: AsyncSession, board_id: UUID, edge_id: UUID) -> None:
    result = await db.execute(
        select(CanvasEdge).where(CanvasEdge.id == edge_id, CanvasEdge.board_id == board_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Edge not found")
    await db.execute(delete(CanvasEdge).where(CanvasEdge.id == edge_id))
    await db.commit()
