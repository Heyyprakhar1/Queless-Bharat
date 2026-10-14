"""Regression tests for the test database safety guard."""

from unittest.mock import AsyncMock, MagicMock
import pytest

from app.core.config import Settings
from app.core.test_safety import (
    UnsafeDatabaseOperationError,
    assert_safe_test_database,
    is_approved_test_database_name,
    validate_test_database_config,
)


def _build_test_settings(
    db_name: str = "queless_demo_test",
    env: str = "development",
    database_url: str | None = None,
) -> Settings:
    return Settings(
        ENVIRONMENT=env,
        POSTGRES_DB=db_name,
        DATABASE_URL=database_url,
        AUTH_SECRET_KEY="mock-secure-test-secret-key-that-is-at-least-32-characters-long!",
    )


def test_approved_test_database_name_recognition():
    """Verifies whitelist and pattern matching for test database names."""
    # Approved test databases
    assert is_approved_test_database_name("queless_demo_test") is True
    assert is_approved_test_database_name("queless_test") is True
    assert is_approved_test_database_name("queless_pytest_tmp") is True
    assert is_approved_test_database_name("my_app_test") is True
    assert is_approved_test_database_name("test_catalog") is True
    assert is_approved_test_database_name("queless_pytest_12345") is True

    # Forbidden and non-test databases
    assert is_approved_test_database_name("queless_db") is False
    assert is_approved_test_database_name("postgres") is False
    assert is_approved_test_database_name("template1") is False
    assert is_approved_test_database_name("production") is False
    assert is_approved_test_database_name("queless_dev") is False
    assert is_approved_test_database_name("queless") is False
    assert is_approved_test_database_name("") is False
    assert is_approved_test_database_name(None) is False


def test_missing_testing_flag_blocks_destructive_cleanup():
    """Fails closed when TESTING environment variable is missing or false."""
    settings = _build_test_settings(db_name="queless_demo_test")

    # Missing / empty TESTING flag
    with pytest.raises(UnsafeDatabaseOperationError, match="Explicit test flag TESTING=true is required"):
        validate_test_database_config(settings=settings, testing_flag="")

    # False / invalid TESTING flag
    with pytest.raises(UnsafeDatabaseOperationError, match="Explicit test flag TESTING=true is required"):
        validate_test_database_config(settings=settings, testing_flag="false")

    with pytest.raises(UnsafeDatabaseOperationError, match="Explicit test flag TESTING=true is required"):
        validate_test_database_config(settings=settings, testing_flag="0")


def test_normal_development_database_queless_db_is_rejected():
    """Fails closed if the database target is a development/production database, even with TESTING=true."""
    settings = _build_test_settings(db_name="queless_db")

    with pytest.raises(UnsafeDatabaseOperationError, match="protected non-test database"):
        validate_test_database_config(settings=settings, testing_flag="true")


def test_other_protected_databases_are_rejected():
    """Fails closed if target is postgres, template1, or other protected system databases."""
    for forbidden in ["postgres", "template1", "template0", "master", "defaultdb"]:
        settings = _build_test_settings(db_name=forbidden)
        with pytest.raises(UnsafeDatabaseOperationError, match="protected non-test database"):
            validate_test_database_config(settings=settings, testing_flag="true")


def test_non_test_naming_pattern_is_rejected():
    """Fails closed if the database name is not protected but does not indicate a test database."""
    settings = _build_test_settings(db_name="queless_dev_catalog")
    with pytest.raises(UnsafeDatabaseOperationError, match="not an approved test database name"):
        validate_test_database_config(settings=settings, testing_flag="true")


def test_approved_dedicated_test_database_accepted_with_explicit_flag():
    """Accepts approved test databases when TESTING=true is explicitly set."""
    for approved_db in ["queless_demo_test", "queless_test", "queless_pytest_tmp", "service_unit_test"]:
        settings = _build_test_settings(db_name=approved_db)
        validated = validate_test_database_config(settings=settings, testing_flag="true")
        assert validated == approved_db

    # Also accepts numeric "1" or "yes"
    settings = _build_test_settings(db_name="queless_demo_test")
    assert validate_test_database_config(settings=settings, testing_flag="1") == "queless_demo_test"
    assert validate_test_database_config(settings=settings, testing_flag="yes") == "queless_demo_test"


def test_production_and_staging_environments_are_rejected():
    """Fails closed if ENVIRONMENT is production or staging, regardless of flags."""
    for env in ["production", "staging"]:
        settings = _build_test_settings(db_name="queless_demo_test", env=env)
        with pytest.raises(UnsafeDatabaseOperationError, match="Test operations cannot run in production or staging"):
            validate_test_database_config(settings=settings, testing_flag="true")


def test_empty_or_whitespace_postgres_db_fails_closed():
    """Fails closed if POSTGRES_DB is empty or unconfigured."""
    settings = _build_test_settings(db_name="   ")
    with pytest.raises(UnsafeDatabaseOperationError, match="POSTGRES_DB is empty or unconfigured"):
        validate_test_database_config(settings=settings, testing_flag="true")


def test_database_url_validation_and_disagreement():
    """Fails closed if DATABASE_URL is malformed or disagrees with POSTGRES_DB."""
    # Malformed URL
    settings_malformed = _build_test_settings(
        db_name="queless_demo_test",
        database_url="not a valid url :/// ???",
    )
    with pytest.raises(UnsafeDatabaseOperationError, match="Malformed DATABASE_URL"):
        validate_test_database_config(settings=settings_malformed, testing_flag="true")

    # DATABASE_URL targets protected database
    settings_protected_url = _build_test_settings(
        db_name="queless_demo_test",
        database_url="postgresql://user:pass@localhost:5432/queless_db",
    )
    with pytest.raises(UnsafeDatabaseOperationError, match="DATABASE_URL targets protected database"):
        validate_test_database_config(settings=settings_protected_url, testing_flag="true")

    # Disagreement between DATABASE_URL and POSTGRES_DB
    settings_disagree = _build_test_settings(
        db_name="queless_demo_test",
        database_url="postgresql://user:pass@localhost:5432/queless_other_test",
    )
    with pytest.raises(UnsafeDatabaseOperationError, match="Ambiguous database configuration"):
        validate_test_database_config(settings=settings_disagree, testing_flag="true")

    # Agreement on approved test database
    settings_agree = _build_test_settings(
        db_name="queless_demo_test",
        database_url="postgresql://user:pass@localhost:5432/queless_demo_test",
    )
    assert validate_test_database_config(settings=settings_agree, testing_flag="true") == "queless_demo_test"


@pytest.mark.asyncio
async def test_guard_rejects_when_active_connection_disagrees_with_config():
    """Fails closed if live database connection returns a different database than configured."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    # Live database connection returns queless_db instead of queless_demo_test!
    mock_result.scalar.return_value = "queless_db"
    mock_session.execute.return_value = mock_result

    settings = _build_test_settings(db_name="queless_demo_test")

    with pytest.raises(UnsafeDatabaseOperationError, match="Active database connection is connected to protected database 'queless_db'"):
        await assert_safe_test_database(mock_session, settings=settings, testing_flag="true")


@pytest.mark.asyncio
async def test_guard_rejects_when_active_connection_returns_unapproved_db():
    """Fails closed if live database connection returns an unapproved database name."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = "queless_analytics_dev"
    mock_session.execute.return_value = mock_result

    # Config is queless_demo_test, but connection says queless_analytics_dev
    settings = _build_test_settings(db_name="queless_demo_test")

    with pytest.raises(UnsafeDatabaseOperationError, match="Active database connection is connected to non-test database"):
        await assert_safe_test_database(mock_session, settings=settings, testing_flag="true")


@pytest.mark.asyncio
async def test_guard_passes_when_config_and_connection_agree_on_approved_db():
    """Passes cleanly when both configuration and active connection match an approved test database."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = "queless_demo_test"
    mock_session.execute.return_value = mock_result

    settings = _build_test_settings(db_name="queless_demo_test")

    result = await assert_safe_test_database(mock_session, settings=settings, testing_flag="true")
    assert result == "queless_demo_test"


@pytest.mark.asyncio
async def test_guard_fails_when_current_database_query_fails():
    """Fails closed if the database connection cannot be verified via SELECT current_database()."""
    mock_session = AsyncMock()
    mock_session.execute.side_effect = RuntimeError("Connection closed")

    settings = _build_test_settings(db_name="queless_demo_test")

    with pytest.raises(UnsafeDatabaseOperationError, match="Failed to query current database from active connection"):
        await assert_safe_test_database(mock_session, settings=settings, testing_flag="true")


@pytest.mark.asyncio
async def test_guard_rejects_when_engine_binding_disagrees_with_config():
    """Fails closed if the session engine is bound to a different database than configured."""
    mock_session = AsyncMock()
    mock_bind = MagicMock()
    mock_url = MagicMock()
    mock_url.database = "queless_db"  # Bound to queless_db!
    mock_bind.url = mock_url
    mock_session.bind = mock_bind

    settings = _build_test_settings(db_name="queless_demo_test")

    with pytest.raises(UnsafeDatabaseOperationError, match="Engine binding mismatch"):
        await assert_safe_test_database(mock_session, settings=settings, testing_flag="true")


@pytest.mark.asyncio
async def test_guard_passes_when_engine_binding_and_connection_match():
    """Passes cleanly when engine binding, configuration, and live connection all agree."""
    mock_session = AsyncMock()
    mock_bind = MagicMock()
    mock_url = MagicMock()
    mock_url.database = "queless_demo_test"
    mock_bind.url = mock_url
    mock_session.bind = mock_bind

    mock_result = MagicMock()
    mock_result.scalar.return_value = "queless_demo_test"
    mock_session.execute.return_value = mock_result

    settings = _build_test_settings(db_name="queless_demo_test")

    result = await assert_safe_test_database(mock_session, settings=settings, testing_flag="true")
    assert result == "queless_demo_test"
