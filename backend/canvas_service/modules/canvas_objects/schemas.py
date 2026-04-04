from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Position(BaseModel):
    x: float
    y: float


class NodeCreate(BaseModel):
    type: str  # React Flow node type (frontend-defined, e.g. "canvas-node")
    position: Position
    width: Optional[float] = None
    height: Optional[float] = None
    z_index: int = 0
    parent_id: Optional[UUID] = None
    data: Optional[dict[str, Any]] = None


class NodeUpdate(BaseModel):
    position: Optional[Position] = None
    width: Optional[float] = None
    height: Optional[float] = None
    z_index: Optional[int] = None
    data: Optional[dict[str, Any]] = None
    updated_at: datetime  # client's local timestamp — required for LWW


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    position: dict[str, float]  # {"x": ..., "y": ...}
    width: Optional[float] = None
    height: Optional[float] = None
    zIndex: int = Field(0, validation_alias="z_index")
    parentId: Optional[UUID] = Field(None, validation_alias="parent_id")
    data: Optional[dict[str, Any]] = None


class EdgeCreate(BaseModel):
    source: UUID
    target: UUID
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    type: Optional[str] = "smoothstep"
    animated: bool = False
    label: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class EdgeUpdate(BaseModel):
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    type: Optional[str] = None
    animated: Optional[bool] = None
    label: Optional[str] = None
    data: Optional[dict[str, Any]] = None
    updated_at: datetime  # required for LWW


class EdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: UUID
    target: UUID
    sourceHandle: Optional[str] = Field(None, validation_alias="source_handle")
    targetHandle: Optional[str] = Field(None, validation_alias="target_handle")
    type: Optional[str] = None
    animated: bool = False
    label: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class CanvasResponse(BaseModel):
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]
