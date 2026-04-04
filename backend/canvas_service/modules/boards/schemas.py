from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BoardCreate(BaseModel):
    name: str


class BoardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class BoardMemberAdd(BaseModel):
    user_id: UUID
    role: Literal["editor", "viewer"]
