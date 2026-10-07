# ==============================================================================
# Stage 1: Dependency builder
# ==============================================================================
FROM python:3.12-slim AS builder

# Install uv binary from official image for deterministic resolution
COPY --from=ghcr.io/astral-sh/uv:0.6.14 /uv /bin/uv

WORKDIR /app

# Enable bytecode compilation and standalone copy mode
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Install production dependencies strictly using uv.lock
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# ==============================================================================
# Stage 2: Minimal unprivileged production runtime
# ==============================================================================
FROM python:3.12-slim AS runner

WORKDIR /app

# Create unprivileged system group and user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Copy virtualenv from builder
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv

# Copy application source, migrations, scripts, and configuration
COPY --chown=appuser:appuser app/ /app/app/
COPY --chown=appuser:appuser scripts/ /app/scripts/
COPY --chown=appuser:appuser alembic.ini entrypoint.sh /app/

# Ensure entrypoint is executable
RUN chmod +x /app/entrypoint.sh

# Set environment PATH to use virtualenv directly
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
