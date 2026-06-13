# Reventa

Full-stack application with React, FastAPI, and PostgreSQL, containerized with Docker.

## Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | React 18, TypeScript, Vite        |
| Backend  | FastAPI, SQLAlchemy (async), Alembic |
| Database | PostgreSQL 16                     |
| Infra    | Docker, Docker Compose            |

## Project Structure

```
reventa/
├── frontend/          # React + TypeScript (Vite)
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level components
│       ├── hooks/         # Custom React hooks
│       ├── services/      # API communication layer
│       └── types/         # TypeScript type definitions
├── backend/           # FastAPI application
│   └── app/
│       ├── api/v1/        # Route handlers (versioned)
│       ├── core/          # Config, DB connection, security
│       ├── models/        # SQLAlchemy ORM models
│       ├── schemas/       # Pydantic request/response schemas
│       ├── services/      # Business logic layer
│       └── repositories/  # Data access layer
├── docker-compose.yml
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites

- Docker >= 24
- Docker Compose >= 2.20

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 2. Start all services

```bash
docker compose up --build
```

| Service  | URL                         |
| -------- | --------------------------- |
| Frontend | http://localhost:5173       |
| Backend  | http://localhost:8000       |
| API Docs | http://localhost:8000/docs  |

### 3. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

## Development

### Backend only

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend only

```bash
cd frontend
npm install
npm run dev
```

## Useful Commands

```bash
# View logs
docker compose logs -f backend

# Create a new Alembic migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# Open a psql shell
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
```
