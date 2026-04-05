from fastapi import APIRouter, Depends, status

from canvas_service.core.auth import get_current_user
from canvas_service.modules.image_generation.schemas import (
    GenerationStatusResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
)
from canvas_service.modules.image_generation.service import (
    get_generation_status,
    submit_image_generation_request,
)

router = APIRouter(prefix="/images", tags=["images"])


@router.post(
    "/generate",
    response_model=ImageGenerationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_image(
    data: ImageGenerationRequest,
    user_id: str = Depends(get_current_user),
):
    result = await submit_image_generation_request(data, user_id=user_id)
    return ImageGenerationResponse(
        status=str(result.get("status", "submitted")),
        request_id=result.get("request_id", ""),
    )


@router.get(
    "/status/{request_id}",
    response_model=GenerationStatusResponse,
)
async def generation_status(
    request_id: str,
    user_id: str = Depends(get_current_user),
):
    return await get_generation_status(request_id, user_id=user_id)
