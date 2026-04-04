from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

AppEnv = Literal["development", "test", "staging", "production"]
LogLevel = Literal["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"]
VoiceAgentTranscriptionMode = Literal["livekit_inference", "mock"]


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: AppEnv = "development"
    app_host: str = Field(default="0.0.0.0", min_length=1)
    app_port: int = Field(default=8000, ge=1, le=65535)
    livekit_url: str | None = None
    livekit_api_key: SecretStr | None = None
    livekit_api_secret: SecretStr | None = None
    log_level: LogLevel = "INFO"
    voice_token_ttl_seconds: int = Field(default=3600, ge=60, le=86_400)
    cors_allowed_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    cors_allowed_origin_regex: str | None = None
    voice_agent_enabled: bool = False
    voice_agent_name: str = Field(default="Qupia Agent", min_length=1, max_length=120)
    voice_agent_wake_phrases: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["agent", "hey agent", "ai agent"]
    )
    voice_agent_transcription_mode: VoiceAgentTranscriptionMode = "mock"
    voice_agent_stt_model: str = Field(
        default="assemblyai/universal-streaming",
        min_length=1,
    )
    voice_agent_stt_language: str = Field(
        default="en",
        min_length=1,
        max_length=32,
    )
    voice_agent_transcript_forward_url: str | None = None
    voice_agent_transcript_forward_auth_token: SecretStr | None = None
    voice_agent_transcript_forward_partials_enabled: bool = False
    voice_agent_mock_transcript_template: str = Field(
        default="[mock] {participant_name} shared a prototype update.",
        min_length=1,
        max_length=500,
    )
    voice_agent_transcript_partials_enabled: bool = True
    voice_agent_diarization_enabled: bool = False

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _parse_cors_allowed_origins(cls, value: object) -> list[str]:
        if value is None:
            return []

        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]

        if isinstance(value, list):
            return [
                origin.strip() for origin in value if isinstance(origin, str) and origin.strip()
            ]

        return []

    @field_validator("voice_agent_wake_phrases", mode="before")
    @classmethod
    def _parse_voice_agent_wake_phrases(cls, value: object) -> list[str]:
        if value is None:
            return []

        if isinstance(value, str):
            return [phrase.strip() for phrase in value.split(",") if phrase.strip()]

        if isinstance(value, list):
            return [
                phrase.strip() for phrase in value if isinstance(phrase, str) and phrase.strip()
            ]

        return []

    @field_validator("cors_allowed_origin_regex", mode="before")
    @classmethod
    def _normalize_cors_allowed_origin_regex(cls, value: object) -> str | None:
        if not isinstance(value, str):
            return None

        normalized = value.strip()
        return normalized or None

    @field_validator("voice_agent_transcript_forward_url", mode="before")
    @classmethod
    def _normalize_voice_agent_transcript_forward_url(cls, value: object) -> str | None:
        if not isinstance(value, str):
            return None

        normalized = value.strip()
        return normalized or None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()
