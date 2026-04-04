import httpx
import jwt as pyjwt
from jwt.algorithms import ECAlgorithm
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings

security = HTTPBearer()

JWKS_URL = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"

_cached_key = None


def _get_public_key():
    global _cached_key
    if _cached_key is None:
        resp = httpx.get(JWKS_URL)
        resp.raise_for_status()
        jwks = resp.json()
        key_data = jwks["keys"][0]
        _cached_key = ECAlgorithm(ECAlgorithm.SHA256).from_jwk(key_data)
    return _cached_key


def verify_token(token: str) -> str:
    """Plain function — use in WebSocket handlers where FastAPI DI is unavailable."""
    try:
        public_key = _get_public_key()
        payload = pyjwt.decode(
            token,
            public_key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub claim in token")
        return user_id
    except pyjwt.PyJWTError as exc:
        raise ValueError(str(exc))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI dependency — use in REST endpoint signatures."""
    try:
        return verify_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
