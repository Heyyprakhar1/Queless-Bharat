"""Test Database Safety Guard.

Prevents destructive test operations (such as TRUNCATE TABLE) from executing
against non-test, development, staging, or production databases due to
misconfigured environment variables or test setups.
"""

import os
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine.url import make_url

from app.core.config import Settings, get_settings


class UnsafeDatabaseOperationError(RuntimeError):
    """Raised when an operation attempts to run destructive test actions against
    an unapproved or non-test database."""


# Databases that are NEVER permitted to be targeted by destructive test operations
FORBIDDEN_DATABASES: frozenset[str] = frozenset({
    "queless_db",
    "postgres",
    "template0",
    "template1",
    "master",
    "model",
    "msdb",
    "defaultdb",
    "main",
    "prod",
    "production",
    "staging",
})

# Explicitly approved test database names
APPROVED_EXPLICIT_TEST_DATABASES: frozenset[str] = frozenset({
    "queless_demo_test",
    "queless_test",
    "queless_pytest_tmp",
})


def is_approved_test_database_name(db_name: str | None) -> bool:
    """Verifies whether a database name strictly identifies a dedicated test database."""
    if not db_name or not isinstance(db_name, str):
        return False
    name_clean = db_name.strip().lower()
    if not name_clean:
        return False

    if name_clean in FORBIDDEN_DATABASES:
        return False

    if name_clean in APPROVED_EXPLICIT_TEST_DATABASES:
        return True

    # Dedicated test databases must end with _test, start with test_, or contain _pytest_
    if name_clean.endswith("_test"):
        return True
    if name_clean.startswith("test_"):
        return True
    if "_pytest_" in name_clean or name_clean.endswith("_pytest_tmp"):
        return True

    return False


def validate_test_database_config(
    settings: Settings | None = None,
    testing_flag: str | None = None,
) -> str:
    """Synchronously validates environment flags, environment name, and database settings.

    Returns the validated expected test database name.
    Raises UnsafeDatabaseOperationError if any check fails.
    """
    settings = settings or get_settings()

    # 1. Require explicit TESTING=true
    if testing_flag is None:
        testing_flag = os.environ.get("TESTING", "")
    testing_val = testing_flag.strip().lower()
    if testing_val not in ("true", "1", "yes"):
        raise UnsafeDatabaseOperationError(
            "Destructive test database operations aborted: "
            "Explicit test flag TESTING=true is required in environment variables. "
            f"Current TESTING value is '{testing_flag}'."
        )

    # 2. Reject production or staging environment modes
    env_name = (settings.ENVIRONMENT or "").strip().lower()
    if env_name in ("production", "staging", "prod"):
        raise UnsafeDatabaseOperationError(
            f"Destructive test database operations aborted: "
            f"Application ENVIRONMENT is set to '{settings.ENVIRONMENT}'. "
            "Test operations cannot run in production or staging mode."
        )

    # 3. Validate POSTGRES_DB configuration
    configured_db = (settings.POSTGRES_DB or "").strip()
    if not configured_db:
        raise UnsafeDatabaseOperationError(
            "Destructive test database operations aborted: POSTGRES_DB is empty or unconfigured."
        )

    if configured_db.lower() in FORBIDDEN_DATABASES:
        raise UnsafeDatabaseOperationError(
            f"Destructive test database operations aborted: Database '{configured_db}' "
            "is a protected non-test database (e.g. development/production baseline)."
        )

    if not is_approved_test_database_name(configured_db):
        raise UnsafeDatabaseOperationError(
            f"Destructive test database operations aborted: Database '{configured_db}' "
            "is not an approved test database name. Dedicated test databases must end with "
            "'_test', start with 'test_', or be an approved test database."
        )

    # 4. If DATABASE_URL is set, validate that it agrees with POSTGRES_DB
    if settings.DATABASE_URL:
        try:
            parsed_url = make_url(settings.DATABASE_URL)
            url_db = (parsed_url.database or "").strip()
        except Exception as exc:
            raise UnsafeDatabaseOperationError(
                f"Destructive test database operations aborted: Malformed DATABASE_URL: {exc}"
            ) from exc

        if not url_db:
            raise UnsafeDatabaseOperationError(
                "Destructive test database operations aborted: "
                "DATABASE_URL does not specify a database name."
            )

        if url_db.lower() in FORBIDDEN_DATABASES:
            raise UnsafeDatabaseOperationError(
                "Destructive test database operations aborted: "
                f"DATABASE_URL targets protected database '{url_db}'."
            )

        if not is_approved_test_database_name(url_db):
            raise UnsafeDatabaseOperationError(
                "Destructive test database operations aborted: "
                f"DATABASE_URL targets non-test database '{url_db}'."
            )

        if url_db.lower() != configured_db.lower():
            raise UnsafeDatabaseOperationError(
                "Destructive test database operations aborted: Ambiguous database configuration. "
                f"DATABASE_URL targets '{url_db}' while POSTGRES_DB is configured as "
                f"'{configured_db}'."
            )

    return configured_db


async def assert_safe_test_database(
    session: Any,
    settings: Settings | None = None,
    testing_flag: str | None = None,
) -> str:
    """Asynchronously validates session connection to an approved, dedicated test database.

    Queries `SELECT current_database()` from the live connection to ensure runtime connection
    target matches configured target and is strictly an approved test database.

    Raises UnsafeDatabaseOperationError if any check fails.
    """
    expected_db = validate_test_database_config(settings=settings, testing_flag=testing_flag)

    # Engine binding check (prevents reusing an engine bound to another database)
    bind = getattr(session, "bind", None)
    if bind is not None and hasattr(bind, "url"):
        raw_engine_db = getattr(bind.url, "database", None)
        if isinstance(raw_engine_db, str) and raw_engine_db.strip():
            engine_db = raw_engine_db.strip()
            if engine_db.lower() != expected_db.lower():
                raise UnsafeDatabaseOperationError(
                    f"Engine binding mismatch: Session engine is bound to database '{engine_db}', "
                    f"which does not match expected test database '{expected_db}'."
                )

    # Runtime live connection check
    try:
        result = await session.execute(text("SELECT current_database();"))
        actual_db = result.scalar()
    except Exception as exc:
        raise UnsafeDatabaseOperationError(
            f"Failed to query current database from active connection: {exc}"
        ) from exc

    if not actual_db or not isinstance(actual_db, str):
        raise UnsafeDatabaseOperationError(
            "Could not determine current database name from active connection."
        )

    actual_db_clean = actual_db.strip()

    if actual_db_clean.lower() in FORBIDDEN_DATABASES:
        raise UnsafeDatabaseOperationError(
            "SECURITY ALERT: Active database connection is connected to protected database "
            f"'{actual_db_clean}'! Refusing to execute destructive test operations."
        )

    if not is_approved_test_database_name(actual_db_clean):
        raise UnsafeDatabaseOperationError(
            f"Active database connection is connected to non-test database '{actual_db_clean}'."
        )

    if actual_db_clean.lower() != expected_db.lower():
        raise UnsafeDatabaseOperationError(
            f"Database target mismatch: Configured test database is '{expected_db}', "
            f"but active connection is connected to '{actual_db_clean}'."
        )

    return actual_db_clean
