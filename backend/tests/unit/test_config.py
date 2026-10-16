"""Unit tests for configuration loading and validation."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings, _parse_origins


def test_default_settings() -> None:
    """Verifies default configuration properties are appropriately initialized."""
    settings = Settings()
    assert settings.PROJECT_NAME == "QueuelessBharat"
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

    # Production with GOOGLE_AUTH_ENABLED=True but missing client ID fails closed
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            AUTH_SECRET_KEY="production-secure-random-token-minimum-32-chars!",
            GOOGLE_AUTH_ENABLED=True,
            GOOGLE_CLIENT_ID=None,
        )
    assert "GOOGLE_CLIENT_ID" in str(exc.value)

    # Production with GOOGLE_AUTH_ENABLED=True and valid client ID succeeds
    prod_google_settings = Settings(
        ENVIRONMENT="production",
        AUTH_SECRET_KEY="production-secure-random-token-minimum-32-chars!",
        GOOGLE_AUTH_ENABLED=True,
        GOOGLE_CLIENT_ID="valid-google-client-id.apps.googleusercontent.com",
    )
    assert prod_google_settings.GOOGLE_AUTH_ENABLED is True
    expected_id = "valid-google-client-id.apps.googleusercontent.com"
    assert prod_google_settings.GOOGLE_CLIENT_ID == expected_id


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


def test_database_url_special_characters_quoted() -> None:
    """Verifies that special characters in credentials are safely URL-encoded."""
    settings = Settings(
        POSTGRES_SERVER="db.example.internal",
        POSTGRES_PORT=5432,
        POSTGRES_USER="user@domain",
        POSTGRES_PASSWORD="p@ss:w/ord#1?",
        POSTGRES_DB="testdb",
    )
    assert (
        settings.async_database_url
        == "postgresql+asyncpg://user%40domain:p%40ss%3Aw%2Ford%231%3F@db.example.internal:5432/testdb"
    )
    assert (
        settings.sync_database_url
        == "postgresql+psycopg://user%40domain:p%40ss%3Aw%2Ford%231%3F@db.example.internal:5432/testdb"
    )


def test_database_url_override_schemes() -> None:
    """Verifies that direct DATABASE_URL supports postgres:// and postgresql:// schemes."""
    # Test postgres:// scheme normalization
    s_postgres = Settings(DATABASE_URL="postgres://user:pass@host:5432/db")
    assert s_postgres.async_database_url == "postgresql+asyncpg://user:pass@host:5432/db"
    assert s_postgres.sync_database_url == "postgresql+psycopg://user:pass@host:5432/db"

    # Test postgresql:// scheme
    s_psql = Settings(DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require")
    assert (
        s_psql.async_database_url == "postgresql+asyncpg://user:pass@host:5432/db?sslmode=require"
    )
    assert s_psql.sync_database_url == "postgresql+psycopg://user:pass@host:5432/db?sslmode=require"

    # Test asyncpg scheme input
    s_async = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db")
    assert s_async.async_database_url == "postgresql+asyncpg://user:pass@host:5432/db"
    assert s_async.sync_database_url == "postgresql+psycopg://user:pass@host:5432/db"


def test_alembic_config_escapes_percent_encoded_credentials() -> None:
    """Verifies that URLs with percent-encoded credentials (%23, etc.) configure Alembic without
    ConfigParser error.
    """
    from alembic.config import Config
    from sqlalchemy import engine_from_config, pool

    # Dummy test credentials containing characters that URL-encode to %23, %25
    settings = Settings(
        POSTGRES_SERVER="db.example.internal",
        POSTGRES_PORT=5432,
        POSTGRES_USER="test_admin",
        POSTGRES_PASSWORD="Dummy#Pass%123",
        POSTGRES_DB="queless_db",
    )
    raw_url = settings.sync_database_url
    assert "%23" in raw_url  # '#' encoded as %23
    assert "%25" in raw_url  # '%' encoded as %25

    alembic_cfg = Config("alembic.ini")
    # Escaping '%' as '%%' prevents ConfigParser from raising ValueError
    alembic_cfg.set_main_option("sqlalchemy.url", raw_url.replace("%", "%%"))

    # Verify ConfigParser resolves it back to the exact unescaped URL
    resolved_main_option = alembic_cfg.get_main_option("sqlalchemy.url")
    assert resolved_main_option == raw_url

    section = alembic_cfg.get_section(alembic_cfg.config_ini_section, {})
    assert section.get("sqlalchemy.url") == raw_url

    # Verify SQLAlchemy engine_from_config correctly decodes the credentials
    engine = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    assert engine.url.password == "Dummy#Pass%123"
    assert engine.url.username == "test_admin"
