from fastapi import APIRouter, Depends, status

from canvas_service.core.auth import get_current_user
from canvas_service.modules.image_generation.schemas import (
    ImageGenerationRequest,
    ImageGenerationResponse,
)
from canvas_service.modules.image_generation.service import (
    log_image_generation_request,
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
    await log_image_generation_request(data, user_id=user_id)
    return ImageGenerationResponse(status="logged")

