import pytest

from canvas_service.core.auth import verify_token
from canvas_service.tests.conftest import TEST_USER_ID, make_token


def test_verify_valid_token():
    token = make_token()
    user_id = verify_token(token)
    assert user_id == TEST_USER_ID


def test_verify_expired_token_raises():
    token = make_token(expired=True)
    with pytest.raises(ValueError, match="expired"):
        verify_token(token)


def test_verify_garbage_token_raises():
    with pytest.raises(ValueError):
        verify_token("not.a.token")
