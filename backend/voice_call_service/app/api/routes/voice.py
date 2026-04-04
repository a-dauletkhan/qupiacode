import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.models.voice import VoiceTokenRequest, VoiceTokenResponse
from app.services.authz import authorize_canvas_voice_access
from app.services.livekit_tokens import LiveKitConfigurationError, create_voice_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/token", response_model=VoiceTokenResponse)
def issue_voice_token(
    request: VoiceTokenRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> VoiceTokenResponse:
    """Issue a LiveKit access token for the canvas-scoped voice room."""
    decision = authorize_canvas_voice_access(
        canvas_id=request.canvas_id,
        user_id=request.user_id,
    )
    if not decision.allowed:
        logger.warning(
            "Denied LiveKit token request for canvas_id=%s user_id=%s",
            request.canvas_id,
            request.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=decision.reason or "You cannot join this canvas voice room.",
        )

    try:
        return create_voice_token(
            settings=settings,
            canvas_id=request.canvas_id,
            user_id=request.user_id,
            participant_name=request.display_name,
        )
    except LiveKitConfigurationError as exc:
        logger.exception("LiveKit token service is not configured correctly")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice token service is not configured.",
        ) from exc
