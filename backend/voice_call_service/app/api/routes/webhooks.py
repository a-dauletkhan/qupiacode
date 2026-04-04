import logging

from fastapi import APIRouter, HTTPException, Request, status

from ...models.webhooks import LiveKitWebhookAck
from ...services.livekit_webhooks import InvalidWebhookPayloadError, ingest_livekit_webhook

logger = logging.getLogger(__name__)
router = APIRouter(tags=["webhooks"])


@router.post(
    "/webhooks/livekit",
    response_model=LiveKitWebhookAck,
    status_code=status.HTTP_200_OK,
)
async def handle_livekit_webhook(request: Request) -> LiveKitWebhookAck:
    """Accept LiveKit webhook events for local development."""
    body = await request.body()
    try:
        ingest_livekit_webhook(body=body, headers=request.headers)
    except InvalidWebhookPayloadError as exc:
        logger.warning("Rejected invalid LiveKit webhook payload: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload.",
        ) from exc

    return LiveKitWebhookAck()
