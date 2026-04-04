from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from canvas_service.modules.boards.models import Board, BoardMember
from canvas_service.modules.boards.schemas import BoardCreate


async def get_user_boards(db: AsyncSession, user_id: UUID) -> list[Board]:
    result = await db.execute(
        select(Board)
        .join(BoardMember, Board.id == BoardMember.board_id)
        .where(BoardMember.user_id == user_id)
    )
    return list(result.scalars().all())


async def create_board(db: AsyncSession, data: BoardCreate, owner_id: UUID) -> Board:
    board = Board(name=data.name, owner_id=owner_id)
    db.add(board)
    await db.flush()  # get board.id before adding member
    member = BoardMember(board_id=board.id, user_id=owner_id, role="owner")
    db.add(member)
    await db.commit()
    await db.refresh(board)
    return board


async def get_board(db: AsyncSession, board_id: UUID, user_id: UUID) -> Board:
    result = await db.execute(
        select(Board)
        .join(BoardMember, Board.id == BoardMember.board_id)
        .where(Board.id == board_id, BoardMember.user_id == user_id)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


async def delete_board(db: AsyncSession, board_id: UUID, user_id: UUID) -> None:
    board = await get_board(db, board_id, user_id)
    if str(board.owner_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the owner can delete this board")
    await db.execute(delete(Board).where(Board.id == board_id))
    await db.commit()


async def add_member(
    db: AsyncSession,
    board_id: UUID,
    new_user_id: UUID,
    role: str,
    requesting_user_id: UUID,
) -> BoardMember:
    await get_board(db, board_id, requesting_user_id)
    member = BoardMember(board_id=board_id, user_id=new_user_id, role=role)
    db.add(member)
    await db.commit()
    return member


async def remove_member(
    db: AsyncSession,
    board_id: UUID,
    target_user_id: UUID,
    requesting_user_id: UUID,
) -> None:
    await get_board(db, board_id, requesting_user_id)
    await db.execute(
        delete(BoardMember).where(
            BoardMember.board_id == board_id,
            BoardMember.user_id == target_user_id,
        )
    )
    await db.commit()
