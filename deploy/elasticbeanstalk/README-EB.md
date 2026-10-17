# QueuelessBharat — Elastic Beanstalk Compose bundle

## Contents
- `docker-compose.yml`: frontend and backend; PostgreSQL stays on private RDS.
- `.env.example`: placeholders only; no real credentials.
- `README-EB.md`: deployment notes.

## .ebextensions
Not inherently mandatory for a Compose-capable Docker platform if default platform settings are sufficient. This bundle omits them. Configure the EB health-check path in the environment settings if required; `/healthz` is the frontend health endpoint. Add .ebextensions only for specific EB option settings/customizations.

## Secrets
Never add a real `.env` to Git or the EB ZIP. Configure ordinary values as EB environment properties and secrets as supported Secrets Manager/Parameter Store references. Grant the EB EC2 instance profile least-privilege access. Names must match the variables referenced by Compose. Required secrets include `POSTGRES_PASSWORD` and `AUTH_SECRET_KEY`. Keep Google auth disabled unless configured.

## Private RDS
- RDS inbound TCP 5432 should allow only the EB instance security group.
- Verify VPC routing and connectivity to the private endpoint.
- Do not expose PostgreSQL publicly.

## Reproducibility
Images use explicit versioned tags rather than `latest`. Tags can still be overwritten; for strict reproducibility, verify the intended images and pin their immutable digests (`repository@sha256:...`). Do not guess digests. The bundle does not build or publish images. Ensure images are publicly pullable or configure registry authentication.

## Validate locally
Copy `.env.example` to `.env`, replace placeholders with safe local/test values, then run:
```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env pull
docker compose --env-file .env ps
```
Review resolved config privately because it may contain credentials. Never paste it into tickets/logs. The EB ZIP must have `docker-compose.yml` at its root and must not contain `.env`.

## Frontend build-time configuration
Vite `VITE_*` values are normally compiled into static assets. Setting them in EB at runtime may not change the already-built frontend. Build/publish the frontend with the correct public API base URL and Google client ID when applicable.
