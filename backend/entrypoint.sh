#!/bin/sh
set -e

# Wait for database connectivity if migrations or seeding are requested
if [ "${RUN_MIGRATIONS:-false}" = "true" ] || [ "${SEED_DATA:-false}" = "true" ]; then
    echo "Verifying database readiness..."
    MAX_RETRIES=${DB_MAX_RETRIES:-30}
    RETRY_INTERVAL=${DB_RETRY_INTERVAL:-2}
    RETRIES=0

    until python -c "
import sys
from app.core.config import get_settings
from sqlalchemy import create_engine, text

settings = get_settings()
try:
    engine = create_engine(settings.sync_database_url, connect_args={'connect_timeout': 3})
    with engine.connect() as conn:
        conn.execute(text('SELECT 1;'))
    sys.exit(0)
except Exception:
    sys.exit(1)
" > /dev/null 2>&1; do
        RETRIES=$((RETRIES + 1))
        if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
            echo "Database readiness check timed out after $MAX_RETRIES attempts. Exiting."
            exit 1
        fi
        echo "Database not ready yet (attempt $RETRIES/$MAX_RETRIES). Retrying in ${RETRY_INTERVAL}s..."
        sleep "$RETRY_INTERVAL"
    done
    echo "Database connection verified."
fi

# Run database migrations if requested
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Applying database migrations via Alembic..."
    alembic upgrade head
    echo "Database migrations applied successfully."
fi

# Run seed script if requested
if [ "${SEED_DATA:-false}" = "true" ]; then
    echo "Seeding initial platform data..."
    python scripts/seed_data.py
    echo "Platform data seeded successfully."
fi

# Execute main container command with PID 1 signal propagation
exec "$@"
