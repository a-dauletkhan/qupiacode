import logging

from canvas_service.modules.image_generation.schemas import ImageGenerationRequest

logger = logging.getLogger(__name__)


async def log_image_generation_request(
    data: ImageGenerationRequest,
    *,
    user_id: str,
) -> None:
    logger.info(
        "Received canvas image generation request user_id=%s node_id=%s text=%s resolution=%s",
        user_id,
        data.node_id,
        data.text,
        data.resolution,
    )
