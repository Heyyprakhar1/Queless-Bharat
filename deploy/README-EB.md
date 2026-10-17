# Elastic Beanstalk Docker Compose deployment

## Bundle and platform
Use a Compose-capable Elastic Beanstalk Docker platform branch (for example, a supported Docker on 64-bit Amazon Linux 2023 release). The EB application source ZIP must have `docker-compose.yml` at its archive root. The existing root `docker-compose.yml` is for local development and includes PostgreSQL; do not replace it with the EB configuration.

For an EB bundle, copy `deploy/docker-compose.eb.yml` to the bundle root as `docker-compose.yml`. This file runs frontend and backend containers and uses private RDS; it does not start a database container.

## Secrets and environment
Never put a real `.env` file in Git or the EB ZIP. Use EB environment properties for non-secret configuration and supported Secrets Manager / Parameter Store references for sensitive values. The EB EC2 instance profile needs least-privilege read permissions. Variable names must match those referenced in Compose.

Required: `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_SECRET_KEY`, and production `ALLOWED_ORIGINS`. Also set `POSTGRES_PORT`, `POSTGRES_DB`, and any OAuth variables as applicable. Keep `GOOGLE_AUTH_ENABLED=false` unless OAuth is configured. `SEED_DATA=false` is the production default. Review `RUN_MIGRATIONS` before each release.

## Private RDS
Allow inbound TCP 5432 on the RDS security group from the EB instance security group only. Confirm VPC routes and test connectivity from EB. Do not make RDS public.

## Image tags and releases
The deployment convention is the fixed tag `:eb` for both backend and frontend. Build and push both images to these exact repositories/tags before deploying:
- `heyyprakhar1/queuelessbharat-backend:eb`
- `heyyprakhar1/queuelessbharat-frontend:eb`

A fixed tag is convenient, but **it is mutable**: pushing a new image to `:eb` changes what that tag points to. For release traceability, record the source commit and preferably pin verified image digests (`repository@sha256:...`) for production releases. Never assume the `:eb` tags exist until registry pull is verified. Ensure images are publicly pullable or configure supported private-registry authentication. After pushing updated images, ensure EB actually pulls/recreates containers rather than continuing to run cached images.

## Validation
With Docker Compose v2 and a safe local validation env file:
```bash
docker compose --env-file /path/to/eb-validation.env -f deploy/docker-compose.eb.yml config --quiet
docker compose --env-file /path/to/eb-validation.env -f deploy/docker-compose.eb.yml pull
```
Do not print or share resolved Compose output because it can contain secrets. `pull` checks registry access, not runtime health or RDS reachability.

## .ebextensions
Not inherently mandatory when the selected platform defaults and EB console settings suffice. Configure the EB health-check path in environment settings (the frontend exposes `/healthz`) if needed. Use `.ebextensions` only for platform option settings or customizations that are actually required.
