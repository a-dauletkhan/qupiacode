from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str
    supabase_storage_bucket: str = "canvas-media"

    model_config = {"env_file": ".env"}


settings = Settings()
