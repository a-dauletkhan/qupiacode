from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from modules.boards.router import router as boards_router
from modules.auth.router import router as auth_router
from modules.liveblocks.router import router as liveblocks_router

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
app.include_router(liveblocks_router)
