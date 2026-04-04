from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.redis import init_redis, close_redis
from modules.boards.router import router as boards_router
from modules.canvas_objects.router import router as canvas_router
from modules.collaboration.router import router as ws_router
from modules.auth.router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    yield
    await close_redis()


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
app.include_router(ws_router)
