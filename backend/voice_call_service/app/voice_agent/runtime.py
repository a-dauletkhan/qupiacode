from __future__ import annotations

import time
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import quote

from livekit import rtc
from livekit.agents import inference, room_io
from livekit.rtc._proto import track_pb2

from ..core.config import Settings

TranscriptAttributionSource = Literal["participant", "diarization", "ambiguous"]


class VoiceAgentConfigurationError(RuntimeError):
    """Raised when the voice agent worker configuration is incomplete."""


ROOM_NAME_PREFIX = "canvas:"


def build_voice_agent_room_options(settings: Settings) -> room_io.RoomOptions:
    """Build room options for a non-speaking transcription agent."""
    text_output: room_io.TextOutputOptions | bool = room_io.TextOutputOptions(
        sync_transcription=False
    )
    if not settings.voice_agent_transcript_partials_enabled:
        text_output = room_io.TextOutputOptions(sync_transcription=False)

    return room_io.RoomOptions(
        text_input=False,
        audio_input=True,
        audio_output=False,
        text_output=text_output,
        close_on_disconnect=False,
    )


def build_voice_agent_instructions(settings: Settings) -> str:
    """Return the base instructions for the silent room participant."""
    return (
        "You are a silent transcription agent inside a LiveKit voice room. "
        "You never speak aloud. "
        f"Your current transcription mode is {settings.voice_agent_transcription_mode}. "
        "Your job is to listen, surface transcription events, and stay out of the way."
    )


def build_voice_agent_stt(settings: Settings) -> inference.STT | None:
    """Build the configured STT adapter, or None for mock mode."""
    if settings.voice_agent_transcription_mode == "mock":
        return None

    return inference.STT(
        model=settings.voice_agent_stt_model,
        language=settings.voice_agent_stt_language,
    )


def ensure_voice_agent_worker_configuration(settings: Settings) -> None:
    """Fail fast when required worker settings are missing."""
    if not settings.voice_agent_enabled:
        raise VoiceAgentConfigurationError(
            "VOICE_AGENT_ENABLED must be true before starting the voice agent worker."
        )

    _require_text(settings.livekit_url, "LIVEKIT_URL")
    _require_secret(settings.livekit_api_key, "LIVEKIT_API_KEY")
    _require_secret(settings.livekit_api_secret, "LIVEKIT_API_SECRET")

    if settings.voice_agent_transcription_mode == "livekit_inference":
        _require_text(settings.voice_agent_stt_model, "VOICE_AGENT_STT_MODEL")
        _require_text(settings.voice_agent_stt_language, "VOICE_AGENT_STT_LANGUAGE")

    if settings.ai_agent_service_url:
        _require_secret(settings.ai_agent_internal_token, "AI_AGENT_INTERNAL_TOKEN")

    if settings.voice_agent_recording_enabled:
        _require_text(settings.voice_agent_recording_s3_bucket, "VOICE_AGENT_RECORDING_S3_BUCKET")
        _require_text(settings.voice_agent_recording_s3_region, "VOICE_AGENT_RECORDING_S3_REGION")
        _require_secret(
            settings.voice_agent_recording_s3_access_key,
            "VOICE_AGENT_RECORDING_S3_ACCESS_KEY",
        )
        _require_secret(
            settings.voice_agent_recording_s3_secret_key,
            "VOICE_AGENT_RECORDING_S3_SECRET_KEY",
        )


def resolve_platform_room_id(room_name: str) -> str:
    """Map a LiveKit room name back to the shared project/room id."""
    if room_name.startswith(ROOM_NAME_PREFIX):
        return room_name.removeprefix(ROOM_NAME_PREFIX)
    return room_name


def build_ai_agent_transcript_ingest_url(*, settings: Settings, room_id: str) -> str | None:
    if settings.ai_agent_service_url is None:
        return None
    return f"{settings.ai_agent_service_url}/internal/rooms/{quote(room_id, safe='')}/transcripts"


def build_ai_agent_system_events_url(*, settings: Settings, room_id: str) -> str | None:
    if settings.ai_agent_service_url is None:
        return None
    return f"{settings.ai_agent_service_url}/internal/rooms/{quote(room_id, safe='')}/system-events"


def resolve_forwarder_auth_token(settings: Settings, *, use_ai_agent_target: bool) -> str | None:
    if use_ai_agent_target and settings.ai_agent_internal_token is not None:
        token = settings.ai_agent_internal_token.get_secret_value().strip()
        if token:
            return token

    if settings.voice_agent_transcript_forward_auth_token is not None:
        token = settings.voice_agent_transcript_forward_auth_token.get_secret_value().strip()
        if token:
            return token

    return None


def resolve_transcript_attribution_source(
    *,
    participant_identity: str | None,
    speaker_id: str | None,
) -> TranscriptAttributionSource:
    """Resolve the best available attribution source for transcript metadata."""
    if participant_identity:
        return "participant"
    if speaker_id:
        return "diarization"
    return "ambiguous"


def should_forward_transcript_segment(*, is_final: bool, settings: Settings) -> bool:
    """Return True when the transcript segment should be forwarded externally."""
    return is_final or settings.voice_agent_transcript_forward_partials_enabled


def build_transcript_dispatch_key(
    *,
    participant_identity: str | None,
    track_sid: str | None,
    segment_id: str,
) -> str:
    """Build a stable key for deduplicating forwarded transcript segments."""
    return f"{participant_identity or 'unknown'}:{track_sid or 'unknown'}:{segment_id}"


def build_forwarded_transcript_payload(
    *,
    room_name: str,
    room_id: str,
    participant: rtc.Participant | None,
    publication: rtc.TrackPublication | None,
    segment: rtc.TranscriptionSegment,
    speaker_id: str | None = None,
    received_at: float | None = None,
) -> dict[str, object]:
    """Build the JSON payload sent to the downstream transcript service."""
    participant_identity = participant.identity if participant else None
    received_at_epoch = received_at if received_at is not None else time.time()
    received_at_iso = datetime.fromtimestamp(received_at_epoch, UTC).isoformat()
    speaker_name = (
        participant.name
        if participant and participant.name
        else participant_identity or "Unknown"
    )

    return {
        "room_id": room_id,
        "room_name": room_name,
        "utterance_id": segment.id,
        "segment_id": segment.id,
        "participant_identity": participant_identity,
        "speaker_id": speaker_id,
        "speaker_name": speaker_name,
        "text": segment.text,
        "is_final": segment.final,
        "start_time_ms": segment.start_time,
        "end_time_ms": segment.end_time,
        "occurred_at": received_at_iso,
        "source": "livekit",
        "track": {
            "sid": publication.sid if publication else None,
            "name": publication.name if publication else None,
            "source": _format_track_source(publication.source if publication else None),
            "language": segment.language,
        },
        "attribution_source": resolve_transcript_attribution_source(
            participant_identity=participant_identity,
            speaker_id=speaker_id,
        ),
    }


def build_mock_transcription(
    *,
    participant_identity: str,
    track_sid: str,
    text: str,
    language: str,
    timestamp_ms: int | None = None,
) -> rtc.Transcription:
    """Build a single-segment mock transcription event for testing."""
    resolved_timestamp_ms = timestamp_ms if timestamp_ms is not None else int(time.time() * 1000)
    segment_id = f"mock:{participant_identity}:{track_sid}:{resolved_timestamp_ms}"

    return rtc.Transcription(
        participant_identity=participant_identity,
        track_sid=track_sid,
        segments=[
            rtc.TranscriptionSegment(
                id=segment_id,
                text=text,
                start_time=resolved_timestamp_ms,
                end_time=resolved_timestamp_ms + 1_000,
                language=language,
                final=True,
            )
        ],
    )


def build_mock_transcript_text(
    *,
    template: str,
    participant_name: str | None,
    participant_identity: str,
    room_name: str,
) -> str:
    """Render a placeholder transcript for mock mode."""
    template_context: Mapping[str, str] = {
        "participant_name": participant_name or participant_identity,
        "participant_identity": participant_identity,
        "room_name": room_name,
    }
    try:
        rendered = template.format(**template_context).strip()
    except KeyError:
        rendered = ""

    if rendered:
        return rendered

    fallback_name = template_context["participant_name"]
    return f"[mock] {fallback_name} shared a prototype update."


def is_microphone_publication(publication: rtc.TrackPublication | None) -> bool:
    """Return True when the publication is a microphone track."""
    if publication is None:
        return False

    return publication.source == track_pb2.TrackSource.SOURCE_MICROPHONE


def _format_track_source(source: track_pb2.TrackSource.ValueType | None) -> str | None:
    if source is None:
        return None

    try:
        source_name = track_pb2.TrackSource.Name(source)
    except ValueError:
        return str(source)

    return source_name.removeprefix("SOURCE_").lower()


def _require_text(value: str | None, setting_name: str) -> str:
    if value is None or not value.strip():
        raise VoiceAgentConfigurationError(f"{setting_name} is required for the voice agent.")
    return value.strip()


def _require_secret(secret: object, setting_name: str) -> str:
    secret_value = getattr(secret, "get_secret_value", lambda: None)()
    if not isinstance(secret_value, str) or not secret_value.strip():
        raise VoiceAgentConfigurationError(f"{setting_name} is required for the voice agent.")
    return secret_value.strip()
