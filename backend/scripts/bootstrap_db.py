from __future__ import annotations

import asyncio

import canvas_service.modules.boards.models  # noqa: F401
import canvas_service.modules.canvas_objects.models  # noqa: F401
from canvas_service.core.database import Base, engine


async def main() -> None:
    """Create the current SQLAlchemy tables for local Docker Compose."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
