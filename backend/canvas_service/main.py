from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from canvas_service.core.redis import close_redis, init_redis
from canvas_service.modules.auth.router import router as auth_router
from canvas_service.modules.boards.router import router as boards_router
from canvas_service.modules.canvas_objects.router import router as canvas_router
from canvas_service.modules.collaboration.router import router as collaboration_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_redis()
    yield
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(title="Canvas Service", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth_router)
    app.include_router(boards_router)
    app.include_router(canvas_router)
    app.include_router(collaboration_router)
    return app


app = create_app()
