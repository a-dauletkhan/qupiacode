from typing import cast
from uuid import UUID

from fastapi import HTTPException
from postgrest.exceptions import APIError

from canvas_service.core.supabase import get_supabase_admin_client
from canvas_service.modules.boards.schemas import BoardCreate, BoardResponse

BoardRow = dict[str, object]


def _rows(data: object) -> list[BoardRow]:
    if not isinstance(data, list):
        return []
    return [cast(BoardRow, row) for row in data if isinstance(row, dict)]


def _string_field(row: BoardRow, key: str) -> str:
    value = row.get(key)
    if not isinstance(value, str):
        raise HTTPException(
            status_code=502,
            detail=f"Supabase returned an invalid `{key}` field.",
        )
    return value


def _normalize_board(row: BoardRow) -> BoardResponse:
    return BoardResponse.model_validate(row)


def _api_error_message(error: APIError) -> str:
    if error.message:
        return error.message
    if error.details:
        return error.details
    return "Supabase request failed."


async def _require_membership(board_id: UUID, user_id: UUID) -> BoardRow:
    client = await get_supabase_admin_client()
    membership_response = await (
        client.table("board_members")
        .select("board_id,user_id,role")
        .eq("board_id", str(board_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    membership_rows = _rows(membership_response.data)
    if not membership_rows:
        raise HTTPException(status_code=404, detail="Board not found")

    return membership_rows[0]


async def _get_board_row(board_id: UUID) -> BoardRow:
    client = await get_supabase_admin_client()
    response = await (
        client.table("boards")
        .select("id,name,owner_id,created_at,updated_at")
        .eq("id", str(board_id))
        .limit(1)
        .execute()
    )
    rows = _rows(response.data)
    if not rows:
        raise HTTPException(status_code=404, detail="Board not found")
    return rows[0]


async def get_user_boards(user_id: UUID) -> list[BoardResponse]:
    client = await get_supabase_admin_client()
    memberships_response = await (
        client.table("board_members")
        .select("board_id")
        .eq("user_id", str(user_id))
        .execute()
    )

    board_ids = [_string_field(row, "board_id") for row in _rows(memberships_response.data)]
    if not board_ids:
        return []

    boards_response = await (
        client.table("boards")
        .select("id,name,owner_id,created_at,updated_at")
        .in_("id", board_ids)
        .order("updated_at", desc=True)
        .execute()
    )
    return [_normalize_board(row) for row in _rows(boards_response.data)]


async def create_board(data: BoardCreate, owner_id: UUID) -> BoardResponse:
    client = await get_supabase_admin_client()
    owner_id_str = str(owner_id)
    board_row: BoardRow | None = None

    try:
        board_response = await (
            client.table("boards")
            .insert(
                {
                    "name": data.name,
                    "owner_id": owner_id_str,
                }
            )
            .execute()
        )
        board_rows = _rows(board_response.data)
        if not board_rows:
            raise HTTPException(status_code=502, detail="Supabase did not return the created board")

        board_row = board_rows[0]

        await (
            client.table("board_members")
            .insert(
                {
                    "board_id": _string_field(board_row, "id"),
                    "user_id": owner_id_str,
                    "role": "owner",
                }
            )
            .execute()
        )
    except APIError as error:
        if board_row is not None:
            try:
                await (
                    client.table("board_members")
                    .delete()
                    .eq("board_id", _string_field(board_row, "id"))
                    .execute()
                )
                await (
                    client.table("boards")
                    .delete()
                    .eq("id", _string_field(board_row, "id"))
                    .execute()
                )
            except APIError:
                pass
        raise HTTPException(status_code=502, detail=_api_error_message(error)) from error

    if board_row is None:
        raise HTTPException(status_code=502, detail="Supabase did not return the created board")

    return _normalize_board(board_row)


async def get_board(board_id: UUID, user_id: UUID) -> BoardResponse:
    await _require_membership(board_id, user_id)
    return _normalize_board(await _get_board_row(board_id))


async def delete_board(board_id: UUID, user_id: UUID) -> None:
    board = await get_board(board_id, user_id)
    if str(board.owner_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the owner can delete this board")

    client = await get_supabase_admin_client()
    try:
        await client.table("board_members").delete().eq("board_id", str(board_id)).execute()
        await client.table("boards").delete().eq("id", str(board_id)).execute()
    except APIError as error:
        raise HTTPException(status_code=502, detail=_api_error_message(error)) from error


async def add_member(
    board_id: UUID,
    new_user_id: UUID,
    role: str,
    requesting_user_id: UUID,
) -> dict:
    if new_user_id == requesting_user_id:
        await _get_board_row(board_id)
    else:
        await get_board(board_id, requesting_user_id)

    client = await get_supabase_admin_client()

    existing_response = await (
        client.table("board_members")
        .select("board_id,user_id,role")
        .eq("board_id", str(board_id))
        .eq("user_id", str(new_user_id))
        .limit(1)
        .execute()
    )
    existing_rows = _rows(existing_response.data)
    if existing_rows:
        return existing_rows[0]

    try:
        response = await (
            client.table("board_members")
            .insert(
                {
                    "board_id": str(board_id),
                    "user_id": str(new_user_id),
                    "role": role,
                }
            )
            .execute()
        )
    except APIError as error:
        raise HTTPException(status_code=502, detail=_api_error_message(error)) from error

    rows = _rows(response.data)
    return (
        rows[0]
        if rows
        else {"board_id": str(board_id), "user_id": str(new_user_id), "role": role}
    )


async def remove_member(
    board_id: UUID,
    target_user_id: UUID,
    requesting_user_id: UUID,
) -> None:
    await get_board(board_id, requesting_user_id)
    client = await get_supabase_admin_client()
    try:
        await (
            client.table("board_members")
            .delete()
            .eq("board_id", str(board_id))
            .eq("user_id", str(target_user_id))
            .execute()
        )
    except APIError as error:
        raise HTTPException(status_code=502, detail=_api_error_message(error)) from error
