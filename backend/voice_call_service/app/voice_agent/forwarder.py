from __future__ import annotations

import asyncio
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


class VoiceAgentTranscriptForwarder:
    """POST transcript payloads to an external HTTP service."""

    def __init__(
        self,
        *,
        target_url: str | None,
        auth_token: str | None,
        timeout_seconds: float = 5.0,
    ) -> None:
        self._target_url = target_url.strip() if isinstance(target_url, str) else None
        self._auth_token = auth_token.strip() if isinstance(auth_token, str) else None
        self._timeout_seconds = timeout_seconds

    @property
    def enabled(self) -> bool:
        return bool(self._target_url)

    async def forward(self, payload: dict[str, object]) -> None:
        """Forward the payload when an external endpoint is configured."""
        if not self.enabled or self._target_url is None:
            return

        await asyncio.to_thread(self._post, payload)

    def _post(self, payload: dict[str, object]) -> None:
        if self._target_url is None:
            return

        request_headers = {
            "Content-Type": "application/json",
        }
        if self._auth_token:
            request_headers["Authorization"] = f"Bearer {self._auth_token}"

        request = Request(
            self._target_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=request_headers,
            method="POST",
        )

        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                response.read()
        except HTTPError as exc:
            logger.warning(
                "Transcript forward failed status=%s url=%s",
                exc.code,
                self._target_url,
            )
        except URLError as exc:
            logger.warning("Transcript forward failed url=%s detail=%s", self._target_url, exc)
        except Exception:
            logger.exception("Unexpected transcript forward failure url=%s", self._target_url)
