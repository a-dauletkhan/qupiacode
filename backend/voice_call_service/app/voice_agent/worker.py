from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Coroutine

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AgentStateChangedEvent,
    CloseEvent,
    ErrorEvent,
    JobContext,
    UserInputTranscribedEvent,
)

from ..core.config import get_settings
from ..core.logging import configure_logging
from .forwarder import VoiceAgentTranscriptForwarder
from .runtime import (
    build_forwarded_transcript_payload,
    build_mock_transcript_text,
    build_mock_transcription,
    build_transcript_dispatch_key,
    build_voice_agent_instructions,
    build_voice_agent_room_options,
    build_voice_agent_stt,
    ensure_voice_agent_worker_configuration,
    is_microphone_publication,
    should_forward_transcript_segment,
)

load_dotenv()

settings = get_settings()
configure_logging(settings)

logger = logging.getLogger(__name__)
server = AgentServer()


class CanvasCompanionAgent(Agent):
    """Silent helper participant for collaborative voice rooms."""

    def __init__(self) -> None:
        super().__init__(instructions=build_voice_agent_instructions(settings))


def build_voice_agent_session() -> AgentSession:
    """Build the reusable LiveKit AgentSession configuration."""
    session_kwargs: dict[str, object] = {
        "preemptive_generation": False,
    }

    stt = build_voice_agent_stt(settings)
    if stt is not None:
        session_kwargs["stt"] = stt

    return AgentSession(**session_kwargs)


@server.rtc_session(agent_name=settings.voice_agent_name)
async def run_voice_agent(ctx: JobContext) -> None:
    """Join a LiveKit room as a silent transcription participant."""
    ensure_voice_agent_worker_configuration(settings)

    ctx.log_context_fields = {
        "room": ctx.room.name,
        "transcription_mode": settings.voice_agent_transcription_mode,
    }

    logger.info(
        "Starting voice agent room=%s transcription_mode=%s forward_url_configured=%s",
        ctx.room.name,
        settings.voice_agent_transcription_mode,
        bool(settings.voice_agent_transcript_forward_url),
    )

    session = build_voice_agent_session()
    forwarder = VoiceAgentTranscriptForwarder(
        target_url=settings.voice_agent_transcript_forward_url,
        auth_token=(
            settings.voice_agent_transcript_forward_auth_token.get_secret_value()
            if settings.voice_agent_transcript_forward_auth_token is not None
            else None
        ),
    )

    background_tasks: set[asyncio.Task[object]] = set()
    forwarded_segment_keys: set[str] = set()
    emitted_mock_track_keys: set[str] = set()

    def schedule_task(coro: Coroutine[object, object, None]) -> None:
        task = asyncio.create_task(coro)
        background_tasks.add(task)
        task.add_done_callback(background_tasks.discard)

    register_voice_agent_callbacks(session=session)

    await session.start(
        agent=CanvasCompanionAgent(),
        room=ctx.room,
        room_options=build_voice_agent_room_options(settings),
    )
    await ctx.connect()

    register_room_callbacks(
        room=ctx.room,
        forwarder=forwarder,
        forwarded_segment_keys=forwarded_segment_keys,
        emitted_mock_track_keys=emitted_mock_track_keys,
        schedule_task=schedule_task,
    )

    emit_mock_transcripts_for_existing_participants(
        room=ctx.room,
        forwarder=forwarder,
        forwarded_segment_keys=forwarded_segment_keys,
        emitted_mock_track_keys=emitted_mock_track_keys,
        schedule_task=schedule_task,
    )


def register_voice_agent_callbacks(*, session: AgentSession) -> None:
    """Register session-level callbacks used by the transcription worker."""

    @session.on("user_input_transcribed")
    def _on_user_input_transcribed(event: UserInputTranscribedEvent) -> None:
        logger.info(
            "STT event final=%s speaker_id=%s language=%s chars=%s",
            event.is_final,
            event.speaker_id or "-",
            event.language or "-",
            len(event.transcript),
        )

    @session.on("agent_state_changed")
    def _on_agent_state_changed(event: AgentStateChangedEvent) -> None:
        logger.info("Agent state changed old=%s new=%s", event.old_state, event.new_state)

    @session.on("error")
    def _on_error(event: ErrorEvent) -> None:
        recoverable = getattr(event.error, "recoverable", None)
        logger.warning(
            "Voice agent error source=%s recoverable=%s detail=%s",
            type(event.source).__name__,
            recoverable,
            event.error,
        )

    @session.on("close")
    def _on_close(event: CloseEvent) -> None:
        logger.info("Voice agent session closed reason=%s error=%s", event.reason, event.error)


def register_room_callbacks(
    *,
    room: rtc.Room,
    forwarder: VoiceAgentTranscriptForwarder,
    forwarded_segment_keys: set[str],
    emitted_mock_track_keys: set[str],
    schedule_task: Callable[[Coroutine[object, object, None]], None],
) -> None:
    """Register room callbacks for forwarding transcript segments and mock mode."""

    @room.on("transcription_received")
    def _on_transcription_received(
        segments: list[rtc.TranscriptionSegment],
        participant: rtc.Participant | None,
        publication: rtc.TrackPublication | None,
    ) -> None:
        for segment in segments:
            dispatch_transcript_segment(
                room=room,
                participant=participant,
                publication=publication,
                segment=segment,
                forwarder=forwarder,
                forwarded_segment_keys=forwarded_segment_keys,
                schedule_task=schedule_task,
            )

    @room.on("participant_connected")
    def _on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        maybe_emit_mock_transcripts_for_participant(
            room=room,
            participant=participant,
            forwarder=forwarder,
            forwarded_segment_keys=forwarded_segment_keys,
            emitted_mock_track_keys=emitted_mock_track_keys,
            schedule_task=schedule_task,
        )

    @room.on("track_published")
    def _on_track_published(
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        maybe_emit_mock_transcript_for_publication(
            room=room,
            participant=participant,
            publication=publication,
            forwarder=forwarder,
            forwarded_segment_keys=forwarded_segment_keys,
            emitted_mock_track_keys=emitted_mock_track_keys,
            schedule_task=schedule_task,
        )


def emit_mock_transcripts_for_existing_participants(
    *,
    room: rtc.Room,
    forwarder: VoiceAgentTranscriptForwarder,
    forwarded_segment_keys: set[str],
    emitted_mock_track_keys: set[str],
    schedule_task: Callable[[Coroutine[object, object, None]], None],
) -> None:
    """Emit placeholder transcripts for participants already in the room."""
    for participant in room.remote_participants.values():
        maybe_emit_mock_transcripts_for_participant(
            room=room,
            participant=participant,
            forwarder=forwarder,
            forwarded_segment_keys=forwarded_segment_keys,
            emitted_mock_track_keys=emitted_mock_track_keys,
            schedule_task=schedule_task,
        )


def maybe_emit_mock_transcripts_for_participant(
    *,
    room: rtc.Room,
    participant: rtc.RemoteParticipant,
    forwarder: VoiceAgentTranscriptForwarder,
    forwarded_segment_keys: set[str],
    emitted_mock_track_keys: set[str],
    schedule_task: Callable[[Coroutine[object, object, None]], None],
) -> None:
    """Emit mock transcripts for all eligible participant microphone tracks."""
    if settings.voice_agent_transcription_mode != "mock":
        return

    for publication in participant.track_publications.values():
        maybe_emit_mock_transcript_for_publication(
            room=room,
            participant=participant,
            publication=publication,
            forwarder=forwarder,
            forwarded_segment_keys=forwarded_segment_keys,
            emitted_mock_track_keys=emitted_mock_track_keys,
            schedule_task=schedule_task,
        )


def maybe_emit_mock_transcript_for_publication(
    *,
    room: rtc.Room,
    participant: rtc.RemoteParticipant,
    publication: rtc.TrackPublication,
    forwarder: VoiceAgentTranscriptForwarder,
    forwarded_segment_keys: set[str],
    emitted_mock_track_keys: set[str],
    schedule_task: Callable[[Coroutine[object, object, None]], None],
) -> None:
    """Emit one placeholder transcript per participant microphone track."""
    if settings.voice_agent_transcription_mode != "mock":
        return

    if not is_microphone_publication(publication):
        return

    participant_identity = participant.identity
    track_sid = publication.sid
    if not participant_identity or not track_sid:
        return

    track_key = f"{participant_identity}:{track_sid}"
    if track_key in emitted_mock_track_keys:
        return

    emitted_mock_track_keys.add(track_key)
    transcription = build_mock_transcription(
        participant_identity=participant_identity,
        track_sid=track_sid,
        text=build_mock_transcript_text(
            template=settings.voice_agent_mock_transcript_template,
            participant_name=participant.name,
            participant_identity=participant_identity,
            room_name=room.name,
        ),
        language=settings.voice_agent_stt_language,
    )
    schedule_task(room.local_participant.publish_transcription(transcription))

    for segment in transcription.segments:
        dispatch_transcript_segment(
            room=room,
            participant=participant,
            publication=publication,
            segment=segment,
            forwarder=forwarder,
            forwarded_segment_keys=forwarded_segment_keys,
            schedule_task=schedule_task,
        )


def dispatch_transcript_segment(
    *,
    room: rtc.Room,
    participant: rtc.Participant | None,
    publication: rtc.TrackPublication | None,
    segment: rtc.TranscriptionSegment,
    forwarder: VoiceAgentTranscriptForwarder,
    forwarded_segment_keys: set[str],
    schedule_task: Callable[[Coroutine[object, object, None]], None],
) -> None:
    """Log and optionally forward a structured transcript segment."""
    if not should_forward_transcript_segment(is_final=segment.final, settings=settings):
        return

    participant_identity = participant.identity if participant else None
    track_sid = publication.sid if publication else None
    dispatch_key = build_transcript_dispatch_key(
        participant_identity=participant_identity,
        track_sid=track_sid,
        segment_id=segment.id,
    )
    if dispatch_key in forwarded_segment_keys:
        return

    forwarded_segment_keys.add(dispatch_key)
    payload = build_forwarded_transcript_payload(
        room_name=room.name,
        participant=participant,
        publication=publication,
        segment=segment,
        transcription_mode=settings.voice_agent_transcription_mode,
    )

    logger.info(
        "Transcript segment room=%s participant=%s final=%s chars=%s",
        room.name,
        participant_identity or "-",
        segment.final,
        len(segment.text),
    )

    if forwarder.enabled:
        schedule_task(forwarder.forward(payload))
