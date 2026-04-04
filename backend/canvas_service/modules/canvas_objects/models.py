import uuid
from sqlalchemy import Column, Text, Float, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from core.database import Base


class CanvasNode(Base):
    __tablename__ = "canvas_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    type = Column(Text, nullable=False)  # React Flow node type, e.g. 'canvas-node' (frontend-defined)
    position = Column(JSONB, nullable=False)  # {"x": float, "y": float}
    width = Column(Float)
    height = Column(Float)
    z_index = Column(Integer, default=0)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("canvas_nodes.id"), nullable=True)
    data = Column(JSONB)
    updated_by = Column(UUID(as_uuid=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CanvasEdge(Base):
    __tablename__ = "canvas_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    source = Column(UUID(as_uuid=True), ForeignKey("canvas_nodes.id", ondelete="CASCADE"), nullable=False)
    target = Column(UUID(as_uuid=True), ForeignKey("canvas_nodes.id", ondelete="CASCADE"), nullable=False)
    source_handle = Column(Text)
    target_handle = Column(Text)
    type = Column(Text)
    animated = Column(Boolean, default=False)
    label = Column(Text)
    data = Column(JSONB)
    updated_by = Column(UUID(as_uuid=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
