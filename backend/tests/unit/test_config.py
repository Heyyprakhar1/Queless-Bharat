"""Unit tests for configuration loading and validation."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings, _parse_origins


def test_default_settings() -> None:
    """Verifies default configuration properties are appropriately initialized."""
    settings = Settings()
    assert settings.PROJECT_NAME == "QueueLess Bharat"
    assert settings.API_V1_STR == "/api/v1"
    assert settings.ENVIRONMENT in {"development", "staging", "production"}
    assert isinstance(settings.ALLOWED_ORIGINS, list)
    assert len(settings.ALLOWED_ORIGINS) >= 1


def test_environment_validation() -> None:
    """Verifies environment validation accepts valid values and rejects invalid ones."""
    valid_settings = Settings(
        ENVIRONMENT="staging",
        AUTH_SECRET_KEY="valid-staging-secret-key-min-32-chars-long!",
    )
    assert valid_settings.ENVIRONMENT == "staging"

    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="invalid_env_name")


def test_production_secret_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifies production and staging fail closed if AUTH_SECRET_KEY is default or too short."""
    monkeypatch.delenv("AUTH_SECRET_KEY", raising=False)

    # Production with default dev key fails
    with pytest.raises(ValidationError) as exc:
        Settings(ENVIRONMENT="production")
    assert "AUTH_SECRET_KEY" in str(exc.value)

    # Explicit default dev key also fails
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            AUTH_SECRET_KEY="dev-insecure-secret-key-replace-in-production-min-32-chars-long!",
        )
    assert "AUTH_SECRET_KEY" in str(exc.value)

    # Staging with default dev key fails
    with pytest.raises(ValidationError) as exc:
        Settings(ENVIRONMENT="staging")
    assert "AUTH_SECRET_KEY" in str(exc.value)

    # Staging with short key (< 32 chars) fails
    with pytest.raises(ValidationError) as exc:
        Settings(ENVIRONMENT="staging", AUTH_SECRET_KEY="short-secret-key")
    assert "at least 32 characters" in str(exc.value)

    # Development allows default key for local convenience
    dev_settings = Settings(ENVIRONMENT="development")
    assert dev_settings.ENVIRONMENT == "development"

    # Production succeeds with strong key >= 32 chars
    prod_settings = Settings(
        ENVIRONMENT="production",
        AUTH_SECRET_KEY="production-secure-random-token-minimum-32-chars!",
    )
    assert prod_settings.ENVIRONMENT == "production"


def test_cors_origin_parsing() -> None:
    """Verifies CORS origin parser handles strings, lists, and JSON arrays safely."""
    # List of strings
    origins_list = ["http://localhost:3000", "http://localhost:5173"]
    assert _parse_origins(origins_list) == origins_list

    # Comma-separated string
    origins_str = "http://localhost:3000, http://example.com"
    assert _parse_origins(origins_str) == ["http://localhost:3000", "http://example.com"]

    # JSON array string
    origins_json = '["https://queless.example.com", "https://app.example.com"]'
    assert _parse_origins(origins_json) == [
        "https://queless.example.com",
        "https://app.example.com",
    ]


def test_database_url_generation() -> None:
    """Verifies async and sync connection strings are formatted correctly."""
    settings = Settings(
        POSTGRES_SERVER="db.example.internal",
        POSTGRES_PORT=5432,
        POSTGRES_USER="testuser",
        POSTGRES_PASSWORD="testpassword",
        POSTGRES_DB="testdb",
    )
    assert (
        settings.async_database_url
        == "postgresql+asyncpg://testuser:testpassword@db.example.internal:5432/testdb"
    )
    assert (
        settings.sync_database_url
        == "postgresql+psycopg://testuser:testpassword@db.example.internal:5432/testdb"
    )
