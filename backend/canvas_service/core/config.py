from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str
    supabase_storage_bucket: str = "canvas-media"
    liveblocks_secret_key: str = ""
    ai_agent_service_url: str = "http://ai-agent:3001"
<<<<<<< Updated upstream
    higgsfield_api_url: str = "https://platform.higgsfield.ai/higgsfield-ai/soul/standard"
    higgsfield_api_key: str = ""
    higgsfield_api_key_secret: str = ""
    higgsfield_resolution: str = "720p"
=======
    ai_agent_internal_token: str = "dev-ai-agent-token"
>>>>>>> Stashed changes

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # pyright: ignore[reportCallIssue]
