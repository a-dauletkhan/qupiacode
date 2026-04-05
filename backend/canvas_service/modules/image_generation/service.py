import logging
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException

from canvas_service.core.config import settings
from canvas_service.modules.image_generation.schemas import ImageGenerationRequest

logger = logging.getLogger(__name__)
_HIGGSFIELD_ASPECT_RATIO = "16:9"


def _higgsfield_headers() -> dict[str, str]:
    if not settings.higgsfield_api_key or not settings.higgsfield_api_key_secret:
        raise HTTPException(
            status_code=503,
            detail="HIGGSFIELD_API_KEY and HIGGSFIELD_API_KEY_SECRET must be configured",
        )

    return {
        "Authorization": f"Key {settings.higgsfield_api_key}:{settings.higgsfield_api_key_secret}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        for key in ("detail", "message", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value

    return response.text or "Image generation provider request failed"


async def submit_image_generation_request(
    data: ImageGenerationRequest,
    *,
    user_id: str,
) -> dict:
    logger.info(
        "Received canvas image generation request user_id=%s node_id=%s text=%s resolution=%s",
        user_id,
        data.node_id,
        data.text,
        data.resolution,
    )

    payload = {
        "prompt": data.text,
        "aspect_ratio": _HIGGSFIELD_ASPECT_RATIO,
        "resolution": settings.higgsfield_resolution,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            settings.higgsfield_api_url,
            headers=_higgsfield_headers(),
            json=payload,
        )

    if response.is_error:
        detail = _error_detail(response)
        logger.warning(
            "Higgsfield image generation request failed user_id=%s node_id=%s status=%s detail=%s",
            user_id,
            data.node_id,
            response.status_code,
            detail,
        )
        raise HTTPException(status_code=502, detail=detail)

    provider_payload = response.json()
    logger.info(
        "Submitted image generation request user_id=%s node_id=%s aspect_ratio=%s response=%s",
        user_id,
        data.node_id,
        _HIGGSFIELD_ASPECT_RATIO,
        provider_payload,
    )
    return provider_payload if isinstance(provider_payload, dict) else {"status": "submitted"}


def _higgsfield_base_url() -> str:
    parsed = urlparse(settings.higgsfield_api_url)
    return f"{parsed.scheme}://{parsed.netloc}"


async def get_generation_status(request_id: str, *, user_id: str) -> dict:
    url = urljoin(f"{_higgsfield_base_url()}/", f"requests/{request_id}/status")

    logger.info(
        "Polling generation status user_id=%s request_id=%s",
        user_id,
        request_id,
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=_higgsfield_headers())

    if response.is_error:
        detail = _error_detail(response)
        logger.warning(
            "Generation status request failed user_id=%s request_id=%s status=%s detail=%s",
            user_id,
            request_id,
            response.status_code,
            detail,
        )
        raise HTTPException(status_code=502, detail=detail)

    payload = response.json()
    logger.info(
        "Generation status user_id=%s request_id=%s response=%s",
        user_id,
        request_id,
        payload,
    )
    return payload
