from enum import Enum


class EventType(str, Enum):
    NODE_CREATED = "node:created"
    NODE_UPDATED = "node:updated"
    NODE_DELETED = "node:deleted"
    EDGE_CREATED = "edge:created"
    EDGE_UPDATED = "edge:updated"
    EDGE_DELETED = "edge:deleted"
    COMMENT_CREATED = "comment:created"
    CURSOR_MOVED = "cursor:moved"
    USER_JOINED = "user:joined"
    USER_LEFT = "user:left"


def make_event(event_type: EventType, payload: dict) -> dict:
    return {"event": event_type.value, "payload": payload}
