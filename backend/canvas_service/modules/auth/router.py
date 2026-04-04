import httpx
from fastapi import APIRouter, HTTPException
from core.config import settings
from .schemas import LoginRequest, SignUpRequest

router = APIRouter(prefix="/auth", tags=["auth"])

SUPABASE_AUTH_URL = f"{settings.supabase_url}/auth/v1"
HEADERS = {
    "apikey": settings.supabase_key,
    "Content-Type": "application/json",
}


@router.post("/login")
async def login(body: LoginRequest):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_AUTH_URL}/token?grant_type=password",
            headers=HEADERS,
            json={"email": body.email, "password": body.password},
        )
    if resp.status_code != 200:
        detail = resp.json().get("error_description", resp.text)
        raise HTTPException(status_code=resp.status_code, detail=detail)
    data = resp.json()
    user_meta = data.get("user", {}).get("user_metadata", {})
    data["name"] = user_meta.get("name", "")
    return data


@router.post("/signup")
async def signup(body: SignUpRequest):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_AUTH_URL}/signup",
            headers=HEADERS,
            json={
                "email": body.email,
                "password": body.password,
                "data": {"name": body.name},
            },
        )
    if resp.status_code not in (200, 201):
        detail = resp.json().get("msg", resp.text)
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()
