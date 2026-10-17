# Queueless Bharat

**Know before you go.** Queueless Bharat is a civic-tech queue management platform for discovering public facilities, exploring their services and counters, and viewing queue-related information.

## Live Demo

[Open Queueless Bharat](http://queuelessbharat.ap-south-1.elasticbeanstalk.com/)

> **Demo environment:** The current deployment uses simulated seed data for demonstration and testing. Queue-session counts and wait estimates should not be interpreted as live telemetry from real facilities.

## Features

- **Facility explorer:** Browse demo facilities and services across Indian cities.
- **Queue workflows:** Demo queue sessions and token lifecycle support.
- **Queue estimates:** Deterministic wait projections with uncertainty bounds and confidence labels, including fallback states when data is insufficient.
- **Authentication and roles:** Google sign-in and role-based citizen, operator, and admin workflows.
- **Accessible UI:** English, Hindi, and Marathi; light/dark themes.
- **Maps:** OpenStreetMap-based location discovery.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Containers:** Docker, Docker Compose
- **Cloud:** AWS Elastic Beanstalk (Mumbai, `ap-south-1`), EC2, Amazon RDS
- **Registry:** Docker Hub

## Architecture

```text
Browser
  └── React frontend
        └── FastAPI backend
              └── PostgreSQL on Amazon RDS

Docker Compose packages the frontend and backend for the Elastic Beanstalk environment.
```

## Run Locally

**Prerequisites:** Docker and Docker Compose.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
docker compose down
```

Local endpoints:
- Web app: http://localhost:80
- API docs: http://localhost:8001/docs
- Health check: http://localhost:8001/api/v1/health

For development, the backend also supports migrations and demo seeding; see the scripts and configuration under `backend/`. Keep secrets in environment variables and never commit production credentials.

## Validation

```bash
cd backend
uv run alembic upgrade head
uv run python scripts/seed_data.py
uv run pytest

cd ../frontend
npm install
npm run lint
npm run build
npx playwright test
``

## Roadmap

- Strengthen automated tests and CI/CD.
- Improve production monitoring, backups, and deployment security.
- Validate real-time queue workflows and notifications end to end.

## Contributing

Open an issue or submit a pull request with a clear description of the change. Preserve transparent queue calculations and clearly label simulated data.

## License

No formal license file is currently included. All rights remain with the project authors and contributors.
