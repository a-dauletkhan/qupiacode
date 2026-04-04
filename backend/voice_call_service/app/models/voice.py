from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
DisplayName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=120),
]


class VoiceAgentMetadata(BaseModel):
    """Agent metadata returned alongside the human participant token."""

    enabled: bool
    name: str
    wake_phrases: list[str]
    transcription_mode: str
    transcript_forwarding_enabled: bool
    transcript_partials_enabled: bool
    diarization_enabled: bool


class VoiceTokenRequest(BaseModel):
    """Input payload for requesting a canvas voice token."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "canvas_id": "canvas-123",
                "user_id": "user-456",
                "display_name": "Ava",
            }
        },
    )

    canvas_id: Identifier = Field(description="Canvas identifier used to derive the room name.")
    user_id: Identifier = Field(description="Stable platform user identifier.")
    display_name: DisplayName | None = Field(
        default=None,
        description="Optional participant display name to embed in the LiveKit token.",
    )


class VoiceTokenResponse(BaseModel):
    """Response payload returned after token creation."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "server_url": "ws://localhost:7880",
                "room_name": "canvas:canvas-123",
                "participant_identity": "user:user-456",
                "participant_name": "Ava",
                "agent": {
                    "enabled": True,
                    "name": "Qupia Agent",
                    "wake_phrases": ["agent", "hey agent", "ai agent"],
                    "transcription_mode": "mock",
                    "transcript_forwarding_enabled": False,
                    "transcript_partials_enabled": True,
                    "diarization_enabled": False,
                },
                "token": "<livekit-jwt>",
            }
        }
    )

    server_url: str
    room_name: str
    participant_identity: str
    participant_name: str | None
    agent: VoiceAgentMetadata | None = None
    token: str
