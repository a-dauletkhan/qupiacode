from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from canvas_service.core.config import settings

engine_kwargs: dict[str, object] = {"echo": False}
if settings.database_url.startswith("postgresql"):
    engine_kwargs["connect_args"] = {
        "ssl": "allow",
        "statement_cache_size": 0,
    }

engine = create_async_engine(settings.database_url, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
