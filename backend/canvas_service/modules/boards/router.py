from uuid import UUID

from fastapi import APIRouter, Depends

from canvas_service.core.auth import get_current_user
from canvas_service.modules.boards import service
from canvas_service.modules.boards.schemas import BoardCreate, BoardMemberAdd, BoardResponse

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=list[BoardResponse])
async def list_boards(
    user_id: str = Depends(get_current_user),
):
    return await service.get_user_boards(UUID(user_id))


@router.post("", response_model=BoardResponse, status_code=201)
async def create_board(
    data: BoardCreate,
    user_id: str = Depends(get_current_user),
):
    return await service.create_board(data, UUID(user_id))


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(
    board_id: UUID,
    user_id: str = Depends(get_current_user),
):
    return await service.get_board(board_id, UUID(user_id))


@router.delete("/{board_id}", status_code=204)
async def delete_board(
    board_id: UUID,
    user_id: str = Depends(get_current_user),
):
    await service.delete_board(board_id, UUID(user_id))


@router.post("/{board_id}/members", status_code=201)
async def add_member(
    board_id: UUID,
    data: BoardMemberAdd,
    user_id: str = Depends(get_current_user),
):
    return await service.add_member(board_id, data.user_id, data.role, UUID(user_id))


@router.delete("/{board_id}/members/{target_user_id}", status_code=204)
async def remove_member(
    board_id: UUID,
    target_user_id: UUID,
    user_id: str = Depends(get_current_user),
):
    await service.remove_member(board_id, target_user_id, UUID(user_id))
