from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime

from livekit import api, rtc

from ..core.config import Settings
from .forwarder import VoiceAgentHttpForwarder

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ActiveRecording:
    recording_id: str
    egress_id: str
    object_path: str
    started_at: str


class VoiceRoomRecordingManager:
    """Manage room-scoped LiveKit recordings and forward lifecycle events."""

    def __init__(
        self,
        *,
        settings: Settings,
        room_name: str,
        room_id: str,
        forwarder: VoiceAgentHttpForwarder,
    ) -> None:
        self._settings = settings
        self._room_name = room_name
        self._room_id = room_id
        self._forwarder = forwarder
        self._active: ActiveRecording | None = None
        self._lock = asyncio.Lock()

    def _api_credentials(self) -> tuple[str | None, str | None]:
        api_key = (
            self._settings.livekit_api_key.get_secret_value()
            if self._settings.livekit_api_key
            else None
        )
        api_secret = (
            self._settings.livekit_api_secret.get_secret_value()
            if self._settings.livekit_api_secret
            else None
        )
        return api_key, api_secret

    @property
    def enabled(self) -> bool:
        return self._settings.voice_agent_recording_enabled

    async def sync_for_room(self, room: rtc.Room) -> None:
        if not self.enabled:
            return

        remote_count = len(room.remote_participants)
        if remote_count > 0:
            await self.start_if_needed()
        else:
            await self.stop_if_active(reason="room_empty")

    async def start_if_needed(self) -> None:
        if not self.enabled:
            return

        async with self._lock:
            if self._active is not None:
                return

            occurred_at = datetime.now(tz=UTC).isoformat()
            object_path = self._build_object_path()

            try:
                api_key, api_secret = self._api_credentials()
                async with api.LiveKitAPI(
                    self._settings.livekit_url,
                    api_key,
                    api_secret,
                ) as client:
                    request = api.RoomCompositeEgressRequest(
                        room_name=self._room_name,
                        audio_only=True,
                        file=api.EncodedFileOutput(
                            file_type=api.EncodedFileType.OGG,
                            filepath=object_path,
                            s3=self._build_s3_upload(),
                        ),
                    )
                    response = await client.egress.start_room_composite_egress(request)

                egress_id = response.egress_id or f"egress-{int(time.time())}"
                recording = ActiveRecording(
                    recording_id=egress_id,
                    egress_id=egress_id,
                    object_path=object_path,
                    started_at=occurred_at,
                )
                self._active = recording
                await self._emit_event(
                    event_type="recording.started",
                    occurred_at=occurred_at,
                    recording=recording,
                    status="started",
                    metadata={},
                )
                logger.info(
                    "Started room recording room=%s egress_id=%s",
                    self._room_name,
                    egress_id,
                )
            except Exception as exc:
                logger.warning(
                    "Failed to start room recording room=%s detail=%s",
                    self._room_name,
                    exc,
                )
                await self._emit_event(
                    event_type="recording.failed",
                    occurred_at=occurred_at,
                    recording=ActiveRecording(
                        recording_id=f"failed-{int(time.time())}",
                        egress_id="",
                        object_path=object_path,
                        started_at=occurred_at,
                    ),
                    status="failed",
                    metadata={"error": str(exc), "phase": "start"},
                )

    async def stop_if_active(self, *, reason: str) -> None:
        if not self.enabled:
            return

        async with self._lock:
            if self._active is None:
                return

            recording = self._active
            occurred_at = datetime.now(tz=UTC).isoformat()
            try:
                api_key, api_secret = self._api_credentials()
                async with api.LiveKitAPI(
                    self._settings.livekit_url,
                    api_key,
                    api_secret,
                ) as client:
                    await client.egress.stop_egress(
                        api.StopEgressRequest(egress_id=recording.egress_id)
                    )

                await self._emit_event(
                    event_type="recording.completed",
                    occurred_at=occurred_at,
                    recording=recording,
                    status="completed",
                    metadata={"reason": reason},
                )
                logger.info(
                    "Stopped room recording room=%s egress_id=%s",
                    self._room_name,
                    recording.egress_id,
                )
            except Exception as exc:
                logger.warning(
                    "Failed to stop room recording room=%s detail=%s",
                    self._room_name,
                    exc,
                )
                await self._emit_event(
                    event_type="recording.failed",
                    occurred_at=occurred_at,
                    recording=recording,
                    status="failed",
                    metadata={"error": str(exc), "reason": reason, "phase": "stop"},
                )
            finally:
                self._active = None

    def _build_object_path(self) -> str:
        prefix = self._settings.voice_agent_recording_prefix.strip("/")
        timestamp = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
        return f"{prefix}/{self._room_id}/{timestamp}.ogg"

    def _build_s3_upload(self) -> api.S3Upload:
        upload = api.S3Upload(
            bucket=self._settings.voice_agent_recording_s3_bucket or "",
            region=self._settings.voice_agent_recording_s3_region or "",
            access_key=(
                self._settings.voice_agent_recording_s3_access_key.get_secret_value()
                if self._settings.voice_agent_recording_s3_access_key
                else ""
            ),
            secret=(
                self._settings.voice_agent_recording_s3_secret_key.get_secret_value()
                if self._settings.voice_agent_recording_s3_secret_key
                else ""
            ),
            force_path_style=self._settings.voice_agent_recording_s3_force_path_style,
        )
        if self._settings.voice_agent_recording_s3_endpoint:
            upload.endpoint = self._settings.voice_agent_recording_s3_endpoint
        return upload

    async def _emit_event(
        self,
        *,
        event_type: str,
        occurred_at: str,
        recording: ActiveRecording,
        status: str,
        metadata: dict[str, object],
    ) -> None:
        await self._forwarder.forward(
            {
                "room_id": self._room_id,
                "room_name": self._room_name,
                "event_type": event_type,
                "occurred_at": occurred_at,
                "recording_id": recording.recording_id,
                "egress_id": recording.egress_id or None,
                "status": status,
                "storage_provider": "s3",
                "storage_bucket": self._settings.voice_agent_recording_s3_bucket,
                "object_path": recording.object_path,
                "playback_url": None,
                "metadata": metadata,
            }
        )
