from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from canvas_service.modules.ai_agent.router import router as ai_agent_router
from canvas_service.modules.auth.router import router as auth_router
from canvas_service.modules.boards.router import router as boards_router
from canvas_service.modules.image_generation.router import router as image_generation_router
from canvas_service.modules.liveblocks.router import router as liveblocks_router
from voice_call_service.app.api.routes import dev, health, voice, webhooks
from voice_call_service.app.core.config import get_settings as get_voice_settings
from voice_call_service.app.core.logging import configure_logging


def create_app() -> FastAPI:
    """Create and configure the unified backend application."""
    voice_settings = get_voice_settings()
    configure_logging(voice_settings)

    app = FastAPI(
        title="Qupia Backend",
        version="0.1.0",
        summary="Unified canvas and voice backend.",
        description=(
            "Combined FastAPI application that serves the canvas backend and the "
            "LiveKit voice/token service from a single Railway deployment root."
        ),
    )

    if voice_settings.cors_allowed_origins or voice_settings.cors_allowed_origin_regex:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=voice_settings.cors_allowed_origins,
            allow_origin_regex=voice_settings.cors_allowed_origin_regex,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(auth_router)
    app.include_router(boards_router)
<<<<<<< Updated upstream
    app.include_router(image_generation_router)
=======
    app.include_router(ai_agent_router)
>>>>>>> Stashed changes
    app.include_router(liveblocks_router)

    if voice_settings.app_env != "production":
        app.include_router(dev.router)
    app.include_router(health.router)
    app.include_router(voice.router)
    app.include_router(webhooks.router)
    return app


app = create_app()
