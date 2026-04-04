from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LiveKitWebhookAck(BaseModel):
    """Basic acknowledgement returned for accepted webhook events."""

    status: str = "ok"


class StoredWebhookEvent(BaseModel):
    """Normalized in-memory representation of a recently received webhook."""

    model_config = ConfigDict(extra="forbid")

    received_at: datetime
    event: str | None = None
    room_name: str | None = None
    participant_identity: str | None = None
    payload: dict[str, object]
