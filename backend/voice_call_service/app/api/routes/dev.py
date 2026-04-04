from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import Settings, get_settings

router = APIRouter(tags=["dev"])

VOICE_TEST_PAGE = Path(__file__).resolve().parents[2] / "static" / "voice_test.html"


@router.get("/dev/voice-test", response_class=FileResponse)
def get_voice_test_page(
    settings: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    """Serve a tiny local-dev page for testing two-tab LiveKit audio."""
    if settings.app_env == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return FileResponse(VOICE_TEST_PAGE, media_type="text/html")
