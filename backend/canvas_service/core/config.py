from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str
    supabase_storage_bucket: str = "canvas-media"
    liveblocks_secret_key: str = ""
    ai_agent_service_url: str = "http://ai-agent:3001"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # pyright: ignore[reportCallIssue]
