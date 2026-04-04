import asyncio

from canvas_service.core.config import settings
from supabase import AsyncClient, create_async_client

_supabase_admin_client: AsyncClient | None = None
_supabase_admin_client_lock = asyncio.Lock()

def get_supabase_service_role_key() -> str:
    server_key = settings.supabase_service_role_key.strip()
    if not server_key:
        raise RuntimeError(
            "Missing SUPABASE_SERVICE_ROLE_KEY. "
            "Board metadata writes must use the Supabase service-role key."
        )
    return server_key


async def get_supabase_admin_client() -> AsyncClient:
    global _supabase_admin_client

    if _supabase_admin_client is not None:
        return _supabase_admin_client

    async with _supabase_admin_client_lock:
        if _supabase_admin_client is None:
            _supabase_admin_client = await create_async_client(
                settings.supabase_url,
                get_supabase_service_role_key(),
            )

    return _supabase_admin_client
