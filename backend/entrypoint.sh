#!/bin/sh
set -e

# Run database migrations if requested
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Applying database migrations via Alembic..."
    alembic upgrade head
    echo "Database migrations applied successfully."
fi

# Run seed script if requested
if [ "${SEED_DATA:-false}" = "true" ]; then
    echo "Seeding initial platform data..."
    python scripts/seed_data.py || echo "Seed script completed or skipped."
fi

# Execute main container command with PID 1 signal propagation
exec "$@"
