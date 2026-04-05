from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from canvas_service.modules.ai_agent.router import router as ai_agent_router
from canvas_service.modules.auth.router import router as auth_router
from canvas_service.modules.boards.router import router as boards_router
from canvas_service.modules.image_generation.router import router as image_generation_router
from canvas_service.modules.liveblocks.router import router as liveblocks_router


def create_app() -> FastAPI:
    app = FastAPI(title="Canvas Service")
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
    return app

app = create_app()
