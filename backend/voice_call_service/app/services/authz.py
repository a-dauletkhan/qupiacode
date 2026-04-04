from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class VoiceAccessDecision:
    """Authorization decision for joining a canvas voice room."""

    allowed: bool
    reason: str | None = None


def authorize_canvas_voice_access(*, canvas_id: str, user_id: str) -> VoiceAccessDecision:
    """Stub authorization hook for canvas voice access."""
    del canvas_id, user_id
    # TODO: Replace this with real canvas membership and permission checks.
    return VoiceAccessDecision(allowed=True)
