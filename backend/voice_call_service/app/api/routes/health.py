from fastapi import APIRouter

from ...models.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    """Return a simple liveness response."""
    return HealthResponse(status="ok")
