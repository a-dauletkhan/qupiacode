import json
import logging
from collections import deque
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import cast

from google.protobuf.json_format import MessageToDict, ParseDict, ParseError
from livekit import api

from app.models.webhooks import StoredWebhookEvent

logger = logging.getLogger(__name__)

RECENT_WEBHOOK_LIMIT = 50
recent_webhook_events: deque[StoredWebhookEvent] = deque(maxlen=RECENT_WEBHOOK_LIMIT)


class InvalidWebhookPayloadError(ValueError):
    """Raised when a webhook body is not valid JSON."""


def ingest_livekit_webhook(
    *,
    body: bytes,
    headers: Mapping[str, str],
) -> StoredWebhookEvent:
    """Parse, normalize, and record a LiveKit webhook event."""
    payload = _parse_json_object(body)
    normalized_payload = _normalize_payload(payload)

    # TODO: Verify the webhook signature with LiveKit's WebhookReceiver in production
    # before trusting the payload. The request headers are threaded through so the
    # verification step can be added without changing the route contract.
    has_authorization_header = any(key.lower() == "authorization" for key in headers)

    event = StoredWebhookEvent(
        received_at=datetime.now(tz=UTC),
        event=_extract_text(normalized_payload.get("event")),
        room_name=_extract_nested_text(normalized_payload, "room", "name"),
        participant_identity=_extract_nested_text(normalized_payload, "participant", "identity"),
        payload=normalized_payload,
    )
    recent_webhook_events.append(event)

    logger.info(
        (
            "Received LiveKit webhook event=%s room_name=%s "
            "participant_identity=%s authorization_header_present=%s"
        ),
        event.event or "unknown",
        event.room_name or "-",
        event.participant_identity or "-",
        has_authorization_header,
    )
    return event


def list_recent_webhook_events() -> tuple[StoredWebhookEvent, ...]:
    """Return recent webhook events recorded in memory."""
    return tuple(recent_webhook_events)


def _parse_json_object(body: bytes) -> dict[str, object]:
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise InvalidWebhookPayloadError("Webhook body must be valid JSON.") from exc

    if not isinstance(parsed, dict):
        raise InvalidWebhookPayloadError("Webhook body must be a JSON object.")

    return cast(dict[str, object], parsed)


def _normalize_payload(payload: dict[str, object]) -> dict[str, object]:
    webhook_event = api.WebhookEvent()
    try:
        ParseDict(payload, webhook_event, ignore_unknown_fields=True)
    except (ParseError, TypeError, ValueError):
        return payload

    normalized = MessageToDict(webhook_event, preserving_proto_field_name=True)
    if not isinstance(normalized, dict):
        return payload
    return cast(dict[str, object], normalized)


def _extract_nested_text(payload: dict[str, object], parent_key: str, child_key: str) -> str | None:
    nested = payload.get(parent_key)
    if not isinstance(nested, dict):
        return None
    return _extract_text(nested.get(child_key))


def _extract_text(value: object) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None
