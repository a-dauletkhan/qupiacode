from canvas_service.core.config import settings


def test_settings_has_required_fields():
    assert hasattr(settings, "supabase_url")
    assert hasattr(settings, "supabase_key")
    assert hasattr(settings, "supabase_service_role_key")
    assert hasattr(settings, "supabase_jwt_secret")
