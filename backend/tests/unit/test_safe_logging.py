"""Unit tests verifying safe error logging and credential/token redaction."""

from app.core.logging import redact_sensitive_data, sanitize_sensitive_text


def test_database_password_in_error_text_is_redacted():
    """Database connection strings with credentials in exception text must have passwords stripped."""
    raw_error = "Connection failed to postgresql://queless_user:SuperSecretPassword123!@localhost:5432/queless_db"
    sanitized = sanitize_sensitive_text(raw_error)

    assert "SuperSecretPassword123!" not in sanitized
    assert "[REDACTED_DB_PASS]" in sanitized
    assert "postgresql://queless_user:[REDACTED_DB_PASS]@localhost:5432/queless_db" in sanitized


def test_bearer_jwt_tokens_in_error_text_are_redacted():
    """Bearer tokens and JWT strings in exception traces must be redacted."""
    raw_error = (
        "Auth failed for header Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
    )
    sanitized = sanitize_sensitive_text(raw_error)

    assert "eyJzdWIiOiIxMjM0NTY3ODkwIn0" not in sanitized
    assert "Bearer [REDACTED_JWT]" in sanitized


def test_password_parameters_in_error_text_are_redacted():
    """Freeform exception strings containing password assignments must be redacted."""
    raw_error = "Validation failed for user credentials: password='VerySecretPassword!', role='CITIZEN'"
    sanitized = sanitize_sensitive_text(raw_error)

    assert "VerySecretPassword!" not in sanitized
    assert "password='[REDACTED]'" in sanitized
    assert "role='CITIZEN'" in sanitized


def test_structured_log_event_dict_redaction():
    """Structured event dictionaries must redact both sensitive keys and embedded strings."""
    event_dict = {
        "event": "login_attempt",
        "username": "citizen@example.com",
        "password": "RawPlaintextPassword!",
        "authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc",
        "error": "Failed connecting to postgresql+asyncpg://admin:db_secret_pass@db.internal:5432/db",
        "nested": {
            "token": "sensitive-token-value",
            "safe_field": "ok_value",
        },
    }

    redacted = redact_sensitive_data(None, "error", event_dict)

    assert redacted["password"] == "[REDACTED]"
    assert redacted["authorization"] == "[REDACTED]"
    assert "db_secret_pass" not in redacted["error"]
    assert "[REDACTED_DB_PASS]" in redacted["error"]
    assert redacted["nested"]["token"] == "[REDACTED]"
    assert redacted["nested"]["safe_field"] == "ok_value"
