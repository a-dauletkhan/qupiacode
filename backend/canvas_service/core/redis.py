import redis.asyncio as aioredis

from canvas_service.core.config import settings

_redis_client: aioredis.Redis | None = None


async def init_redis() -> None:
    global _redis_client
    _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None


async def get_redis() -> aioredis.Redis:
    if _redis_client is None:
        raise RuntimeError("Redis client is not initialized.")
    return _redis_client
