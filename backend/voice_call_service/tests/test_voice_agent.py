from typing import cast

from livekit import rtc
from livekit.agents import inference, room_io

from voice_call_service.app.core.config import Settings
from voice_call_service.app.voice_agent.runtime import (
    VoiceAgentConfigurationError,
    build_forwarded_transcript_payload,
    build_mock_transcript_text,
    build_mock_transcription,
    build_transcript_dispatch_key,
    build_voice_agent_room_options,
    build_voice_agent_stt,
    ensure_voice_agent_worker_configuration,
    resolve_transcript_attribution_source,
    should_forward_transcript_segment,
)


def _build_settings(**overrides: object) -> Settings:
    settings_data: dict[str, object] = {
        "app_env": "test",
        "app_host": "127.0.0.1",
        "app_port": 8000,
        "livekit_url": "ws://localhost:7880",
        "livekit_api_key": "test-api-key",
        "livekit_api_secret": "test-api-secret-that-is-at-least-32-bytes",
        "log_level": "DEBUG",
        "voice_token_ttl_seconds": 3600,
        "cors_allowed_origins": [],
        "cors_allowed_origin_regex": None,
        "voice_agent_enabled": True,
        "voice_agent_name": "Qupia Agent",
        "voice_agent_wake_phrases": ["agent", "hey agent", "ai agent"],
        "voice_agent_transcription_mode": "mock",
        "voice_agent_stt_model": "assemblyai/universal-streaming",
        "voice_agent_stt_language": "en",
        "voice_agent_transcript_forward_url": None,
        "voice_agent_transcript_forward_auth_token": None,
        "voice_agent_transcript_forward_partials_enabled": False,
        "voice_agent_mock_transcript_template": (
            "[mock] {participant_name} shared a prototype update."
        ),
        "voice_agent_transcript_partials_enabled": True,
        "voice_agent_diarization_enabled": False,
    }
    settings_data.update(overrides)
    return Settings.model_validate(settings_data)


def test_build_room_options_disables_audio_output_and_text_input() -> None:
    options = build_voice_agent_room_options(_build_settings())

    assert isinstance(options, room_io.RoomOptions)
    assert options.get_audio_output_options() is None
    assert options.get_text_input_options() is None
    text_output = options.get_text_output_options()
    assert text_output is not None
    assert text_output.sync_transcription is False


def test_build_voice_agent_stt_returns_none_for_mock_mode() -> None:
    assert build_voice_agent_stt(_build_settings(voice_agent_transcription_mode="mock")) is None


def test_build_voice_agent_stt_uses_livekit_inference_when_enabled() -> None:
    stt = build_voice_agent_stt(
        _build_settings(
            voice_agent_transcription_mode="livekit_inference",
            voice_agent_stt_model="assemblyai/universal-streaming",
            voice_agent_stt_language="en",
        )
    )

    assert isinstance(stt, inference.STT)


def test_should_forward_transcript_segment_defaults_to_finals_only() -> None:
    settings = _build_settings(voice_agent_transcript_forward_partials_enabled=False)

    assert not should_forward_transcript_segment(is_final=False, settings=settings)
    assert should_forward_transcript_segment(is_final=True, settings=settings)


def test_should_forward_transcript_segment_can_include_partials() -> None:
    settings = _build_settings(voice_agent_transcript_forward_partials_enabled=True)

    assert should_forward_transcript_segment(is_final=False, settings=settings)


def test_build_transcript_dispatch_key_is_stable() -> None:
    assert (
        build_transcript_dispatch_key(
            participant_identity="user:123",
            track_sid="TR_123",
            segment_id="seg-1",
        )
        == "user:123:TR_123:seg-1"
    )


def test_build_mock_transcript_text_uses_template_context() -> None:
    assert (
        build_mock_transcript_text(
            template="[mock] {participant_name} spoke in {room_name}",
            participant_name="Alice",
            participant_identity="user:alice",
            room_name="canvas:demo",
        )
        == "[mock] Alice spoke in canvas:demo"
    )


def test_build_mock_transcript_text_falls_back_when_template_is_invalid() -> None:
    assert (
        build_mock_transcript_text(
            template="{missing_key}",
            participant_name="Alice",
            participant_identity="user:alice",
            room_name="canvas:demo",
        )
        == "[mock] Alice shared a prototype update."
    )


def test_build_mock_transcription_creates_final_single_segment() -> None:
    transcription = build_mock_transcription(
        participant_identity="user:alice",
        track_sid="TR_123",
        text="placeholder transcript",
        language="en",
        timestamp_ms=1_234,
    )

    assert transcription.participant_identity == "user:alice"
    assert transcription.track_sid == "TR_123"
    assert len(transcription.segments) == 1
    segment = transcription.segments[0]
    assert segment.id == "mock:user:alice:TR_123:1234"
    assert segment.text == "placeholder transcript"
    assert segment.language == "en"
    assert segment.final is True
    assert segment.start_time == 1_234
    assert segment.end_time == 2_234


def test_build_forwarded_transcript_payload_includes_attribution_and_track_data() -> None:
    participant = type(
        "ParticipantStub",
        (),
        {
            "identity": "user:alice",
            "name": "Alice",
            "sid": "PA_123",
        },
    )()
    publication = type(
        "PublicationStub",
        (),
        {
            "sid": "TR_123",
            "name": "microphone",
            "source": 2,
        },
    )()
    segment = rtc.TranscriptionSegment(
        id="seg-1",
        text="hello world",
        start_time=100,
        end_time=250,
        language="en",
        final=True,
    )

    payload = build_forwarded_transcript_payload(
        room_name="canvas:demo",
        participant=cast(rtc.Participant, participant),
        publication=cast(rtc.TrackPublication, publication),
        segment=segment,
        transcription_mode="mock",
        received_at=1_700_000_000.0,
    )

    assert payload["event_type"] == "voice.transcript.segment"
    assert payload["room_name"] == "canvas:demo"
    assert payload["transcription_mode"] == "mock"
    assert payload["participant"] == {
        "identity": "user:alice",
        "name": "Alice",
        "sid": "PA_123",
    }
    assert payload["track"] == {
        "sid": "TR_123",
        "name": "microphone",
        "source": "microphone",
    }
    assert payload["segment"] == {
        "id": "seg-1",
        "text": "hello world",
        "language": "en",
        "is_final": True,
        "start_time_ms": 100,
        "end_time_ms": 250,
    }
    assert payload["speaker_id"] is None
    assert payload["attribution_source"] == "participant"


def test_resolve_transcript_attribution_prefers_participant_identity() -> None:
    assert (
        resolve_transcript_attribution_source(
            participant_identity="user:123",
            speaker_id="speaker-1",
        )
        == "participant"
    )
    assert (
        resolve_transcript_attribution_source(
            participant_identity=None,
            speaker_id="speaker-1",
        )
        == "diarization"
    )
    assert (
        resolve_transcript_attribution_source(
            participant_identity=None,
            speaker_id=None,
        )
        == "ambiguous"
    )


def test_worker_configuration_requires_livekit_credentials() -> None:
    settings = _build_settings(livekit_api_secret=None)

    try:
        ensure_voice_agent_worker_configuration(settings)
    except VoiceAgentConfigurationError as exc:
        assert "LIVEKIT_API_SECRET" in str(exc)
    else:
        raise AssertionError("Expected VoiceAgentConfigurationError for missing LIVEKIT_API_SECRET")


def test_worker_configuration_accepts_mock_mode_without_external_forwarder() -> None:
    ensure_voice_agent_worker_configuration(_build_settings(voice_agent_transcription_mode="mock"))


def test_worker_configuration_requires_stt_model_for_livekit_inference() -> None:
    settings = _build_settings(
        voice_agent_transcription_mode="livekit_inference",
        voice_agent_stt_model="   ",
    )

    try:
        ensure_voice_agent_worker_configuration(settings)
    except VoiceAgentConfigurationError as exc:
        assert "VOICE_AGENT_STT_MODEL" in str(exc)
    else:
        raise AssertionError("Expected VoiceAgentConfigurationError for missing STT model")
