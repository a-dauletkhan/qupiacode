from canvas_service.core.config import settings


def test_settings_has_required_fields():
    assert hasattr(settings, "database_url")
    assert hasattr(settings, "redis_url")
    assert hasattr(settings, "supabase_jwt_secret")
