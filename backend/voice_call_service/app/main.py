from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import dev, health, voice, webhooks
from app.core.config import get_settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    configure_logging(settings)

    app = FastAPI(
        title="Voice Call Service",
        version="0.1.0",
        summary="Canvas-scoped LiveKit voice token service.",
        description=(
            "Minimal FastAPI backend that maps each canvas to a LiveKit room and "
            "issues room-scoped voice access tokens."
        ),
    )
    if settings.cors_allowed_origins or settings.cors_allowed_origin_regex:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_allowed_origins,
            allow_origin_regex=settings.cors_allowed_origin_regex,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    if settings.app_env != "production":
        app.include_router(dev.router)
    app.include_router(health.router)
    app.include_router(voice.router)
    app.include_router(webhooks.router)
    return app


app = create_app()
