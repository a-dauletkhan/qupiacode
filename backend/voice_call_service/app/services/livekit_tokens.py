import logging
from dataclasses import dataclass
from datetime import timedelta

from livekit import api
from pydantic import SecretStr

from ..core.config import Settings
from ..models.voice import VoiceAgentMetadata, VoiceTokenResponse

logger = logging.getLogger(__name__)

ROOM_NAME_PREFIX = "canvas:"
PARTICIPANT_IDENTITY_PREFIX = "user:"


class LiveKitConfigurationError(RuntimeError):
    """Raised when required LiveKit configuration is missing."""


@dataclass(frozen=True, slots=True)
class ParticipantPermissions:
    """Permissions for a LiveKit participant."""

    can_publish: bool = True
    can_subscribe: bool = True
    moderator: bool = False


def build_canvas_room_name(canvas_id: str) -> str:
    """Build the LiveKit room name for a canvas."""
    return f"{ROOM_NAME_PREFIX}{canvas_id}"


def build_participant_identity(user_id: str) -> str:
    """Build a stable LiveKit participant identity from the platform user ID."""
    return f"{PARTICIPANT_IDENTITY_PREFIX}{user_id}"


def create_voice_token(
    *,
    settings: Settings,
    canvas_id: str,
    user_id: str,
    participant_name: str | None,
    permissions: ParticipantPermissions | None = None,
) -> VoiceTokenResponse:
    """Create a room-scoped LiveKit access token for a canvas voice session."""
    effective_permissions = permissions or ParticipantPermissions()

    server_url = _require_text(settings.livekit_url, "LIVEKIT_URL")
    api_key = _require_secret(settings.livekit_api_key, "LIVEKIT_API_KEY")
    api_secret = _require_secret(settings.livekit_api_secret, "LIVEKIT_API_SECRET")
    room_name = build_canvas_room_name(canvas_id)
    participant_identity = build_participant_identity(user_id)

    access_token = (
        api.AccessToken(api_key, api_secret)
        .with_identity(participant_identity)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=effective_permissions.can_publish,
                can_subscribe=effective_permissions.can_subscribe,
                room_admin=effective_permissions.moderator,
            )
        )
        .with_ttl(timedelta(seconds=settings.voice_token_ttl_seconds))
    )
    if participant_name is not None:
        access_token = access_token.with_name(participant_name)

    token = access_token.to_jwt()
    logger.info(
        "Issued LiveKit token for room_name=%s participant_identity=%s",
        room_name,
        participant_identity,
    )
    return VoiceTokenResponse(
        server_url=server_url,
        room_name=room_name,
        participant_identity=participant_identity,
        participant_name=participant_name,
        agent=build_voice_agent_metadata(settings),
        token=token,
    )


def build_voice_agent_metadata(settings: Settings) -> VoiceAgentMetadata:
    """Build frontend-visible metadata for the text-only room agent."""
    return VoiceAgentMetadata(
        enabled=settings.voice_agent_enabled,
        name=settings.voice_agent_name,
        wake_phrases=settings.voice_agent_wake_phrases,
        transcription_mode=settings.voice_agent_transcription_mode,
        transcript_forwarding_enabled=bool(
            settings.voice_agent_transcript_forward_url or settings.ai_agent_service_url
        ),
        transcript_partials_enabled=settings.voice_agent_transcript_partials_enabled,
        diarization_enabled=settings.voice_agent_diarization_enabled,
    )


def _require_text(value: str | None, setting_name: str) -> str:
    if value is None or not value.strip():
        logger.error("Required setting %s is missing for LiveKit token issuance", setting_name)
        raise LiveKitConfigurationError("Missing required LiveKit configuration.")
    return value.strip()


def _require_secret(secret: SecretStr | None, setting_name: str) -> str:
    if secret is None:
        logger.error("Required setting %s is missing for LiveKit token issuance", setting_name)
        raise LiveKitConfigurationError("Missing required LiveKit configuration.")

    secret_value = secret.get_secret_value()
    if not isinstance(secret_value, str) or not secret_value.strip():
        logger.error("Required setting %s is missing for LiveKit token issuance", setting_name)
        raise LiveKitConfigurationError("Missing required LiveKit configuration.")
    return secret_value.strip()
