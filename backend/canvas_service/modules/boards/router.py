from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.auth import get_current_user
from modules.boards import service
from modules.boards.schemas import BoardCreate, BoardResponse, BoardMemberAdd

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=list[BoardResponse])
async def list_boards(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.get_user_boards(db, UUID(user_id))


@router.post("", response_model=BoardResponse, status_code=201)
async def create_board(
    data: BoardCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.create_board(db, data, UUID(user_id))


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.get_board(db, board_id, UUID(user_id))


@router.delete("/{board_id}", status_code=204)
async def delete_board(
    board_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    await service.delete_board(db, board_id, UUID(user_id))


@router.post("/{board_id}/members", status_code=201)
async def add_member(
    board_id: UUID,
    data: BoardMemberAdd,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await service.add_member(db, board_id, data.user_id, data.role, UUID(user_id))


@router.delete("/{board_id}/members/{target_user_id}", status_code=204)
async def remove_member(
    board_id: UUID,
    target_user_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    await service.remove_member(db, board_id, target_user_id, UUID(user_id))
