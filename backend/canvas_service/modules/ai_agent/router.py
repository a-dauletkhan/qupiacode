from __future__ import annotations

import json
from collections.abc import Mapping

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from canvas_service.core.auth import get_current_user
from canvas_service.core.config import settings

router = APIRouter(prefix="/api/ai", tags=["ai-agent"])


def _internal_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.ai_agent_internal_token}",
        "Content-Type": "application/json",
    }


async def _forward_request(
    *,
    method: str,
    path: str,
    json_body: object | None = None,
    query_params: Mapping[str, str] | None = None,
    timeout: float = 15.0,
) -> Response:
    target_url = f"{settings.ai_agent_service_url.rstrip('/')}{path}"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            upstream = await client.request(
                method,
                target_url,
                headers=_internal_headers(),
                params=query_params,
                json=json_body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail="AI agent service is unavailable.",
        ) from exc

    content_type = upstream.headers.get("content-type", "")
    if "application/json" in content_type.lower():
        try:
            payload = upstream.json()
        except json.JSONDecodeError:
            payload = {"message": upstream.text}
        return Response(
            content=json.dumps(payload),
            media_type="application/json",
            status_code=upstream.status_code,
        )

    return Response(
        content=upstream.text,
        media_type=content_type or "text/plain",
        status_code=upstream.status_code,
    )


@router.post("/rooms/{room_id}/command")
async def proxy_command(
    room_id: str,
    request: Request,
    user_id: str = Depends(get_current_user),
) -> Response:
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    body["userId"] = user_id
    return await _forward_request(
        method="POST",
        path=f"/api/ai/rooms/{room_id}/command",
        json_body=body,
        timeout=90.0,
    )


@router.post("/rooms/{room_id}/events")
async def proxy_events(
    room_id: str,
    request: Request,
    user_id: str = Depends(get_current_user),
) -> Response:
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    body["userId"] = user_id
    return await _forward_request(
        method="POST",
        path=f"/api/ai/rooms/{room_id}/events",
        json_body=body,
    )


@router.post("/rooms/{room_id}/feedback")
async def proxy_feedback(
    room_id: str,
    request: Request,
    user_id: str = Depends(get_current_user),
) -> Response:
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    body["userId"] = user_id
    return await _forward_request(
        method="POST",
        path=f"/api/ai/rooms/{room_id}/feedback",
        json_body=body,
    )


@router.get("/rooms/{room_id}/queue")
async def proxy_queue(
    room_id: str,
    _: str = Depends(get_current_user),
) -> Response:
    return await _forward_request(
        method="GET",
        path=f"/api/ai/rooms/{room_id}/queue",
    )
