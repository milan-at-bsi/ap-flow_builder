# Protocol Builder

A visual flow builder application with a PostgreSQL backend for storing and managing protocol flows. Build protocol diagrams visually and automatically generate PlanSpace YAML.

## Features

- **Visual Flow Builder**: Drag-and-drop interface for creating protocol flows
- **PlanSpace Generation**: Automatically generates PlanSpace YAML from flow diagrams
- **Flow Management**: Create, save, open, and delete flows via a top ribbon toolbar
- **PostgreSQL Backend**: Persistent storage with full CRUD API
- **Swagger/OpenAPI Documentation**: Interactive API documentation
- **Theme Support**: Toggle between light and dark themes
- **Docker Support**: Easy deployment with Docker Compose

---

## Quick Start with Docker

The easiest way to run the entire application stack:

### Prerequisites
- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

### Start All Services

```bash
# Clone or navigate to the project directory
cd protocol_builder

# Start all services (PostgreSQL, API, Frontend)
docker-compose up -d

# View logs (optional)
docker-compose logs -f

# View logs for specific service
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f db
```

### Access the Application

Once running, access the services at:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | Visual flow builder UI |
| **API** | http://localhost:3001 | Backend REST API |
| **Swagger UI** | http://localhost:3001/api-docs | Interactive API documentation |
| **PostgreSQL** | localhost:5432 | Database (credentials below) |

### Stop Services

```bash
# Stop all services (preserves data)
docker-compose down

# Stop and remove all data
docker-compose down -v
```

### Rebuild After Code Changes

```bash
# Rebuild specific service
docker-compose up -d --build api
docker-compose up -d --build frontend

# Rebuild all services
docker-compose up -d --build
```

---

## Local Development Setup

For development with hot-reloading, run services locally.

### Prerequisites

- Node.js 20+ (recommended: use `nvm` or `fnm`)
- PostgreSQL 15+ (can use Docker just for database)
- npm or yarn

### Option 1: Database in Docker, Code Locally

```bash
# Start only the database in Docker
docker-compose up -d db

# Wait for database to be healthy
docker-compose logs -f db
```

Then run API and Frontend locally (see below).

### Option 2: Full Local Setup

#### 1. Database Setup

Install PostgreSQL locally and run:

```bash
# Create database
psql -U postgres -c "CREATE DATABASE protocol_builder;"

# Initialize schema and seed data
psql -U postgres -d protocol_builder -f init.sql
```

#### 2. API Setup

```bash
cd api

# Install dependencies
npm install

# Start development server with hot-reload
npm run dev
```

The API runs at http://localhost:3001

#### 3. Frontend Setup

```bash
cd app

# Install dependencies
npm install

# Start development server with hot-reload
npm run dev
```

The frontend runs at http://localhost:5173 (or next available port)

---

## Development Guide

### Project Structure

```
protocol_builder/
├── api/                      # Backend API (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── index.ts         # Entry point, Express setup, Swagger UI
│   │   ├── db.ts            # Database connection & queries
│   │   └── routes/
│   │       └── flows.ts     # Flow CRUD routes
│   ├── openapi.yaml         # OpenAPI/Swagger specification
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── app/                      # Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── App.tsx          # Main app with ribbon toolbar
│   │   ├── api.ts           # API client
│   │   ├── index.css        # Theme CSS variables
│   │   └── blocks/          # Block components & logic
│   │       ├── ContainerBlock.tsx
│   │       ├── LeafBlock.tsx
│   │       ├── layout.ts
│   │       ├── serialization.ts
│   │       └── planspaceTransformer.ts
│   ├── public/
│   │   ├── workspaces.yaml      # Workspace definitions
│   │   ├── workspace_*.yaml     # Block definitions per workspace
│   │   └── block_definitions.yaml
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml        # Docker orchestration
├── init.sql                  # Database schema & seed data
└── README.md
```

### Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, ReactFlow |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 15 |
| API Docs | OpenAPI 3.0, Swagger UI |
| Containerization | Docker, Docker Compose |

### Making Changes

#### Frontend Changes

1. Edit files in `app/src/`
2. Changes auto-reload in dev mode (`npm run dev`)
3. For production, rebuild: `docker-compose up -d --build frontend`

#### Backend Changes

1. Edit files in `api/src/`
2. In dev mode (`npm run dev`), changes auto-reload via `tsx watch`
3. For production, rebuild: `docker-compose up -d --build api`

#### API Documentation Changes

1. Edit `api/openapi.yaml`
2. Rebuild API: `docker-compose up -d --build api`
3. View at http://localhost:3001/api-docs

#### Database Schema Changes

1. Edit `init.sql`
2. For fresh database: `docker-compose down -v && docker-compose up -d`
3. Or run migrations manually in PostgreSQL

### Adding New Block Types

1. Edit `app/public/workspace_*.yaml` to add new block definitions
2. Blocks automatically appear in the toolbox after refresh

### Theme Customization

Edit CSS variables in `app/src/index.css`:

```css
/* Dark theme */
:root {
  --bg-primary: #0f172a;
  --text-primary: #ffffff;
  /* ... */
}

/* Light theme */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #0f172a;
  /* ... */
}
```

---

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flows` | List all flows |
| POST | `/api/flows` | Create new flow |
| GET | `/api/flows/external/{externalId}` | Get flow by external ID |
| GET | `/api/flows/{id}` | Get flow by database ID |
| PUT | `/api/flows/{id}` | Update flow |
| DELETE | `/api/flows/{id}` | Delete flow |
| GET | `/health` | Health check |
| GET | `/api-docs` | Swagger UI |
| GET | `/openapi.json` | OpenAPI spec as JSON |

### Example: Fetch Flow by External ID

```bash
curl http://localhost:3001/api/flows/external/vehicle-access-v1
```

### Example: Create a Flow

```bash
curl -X POST http://localhost:3001/api/flows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Protocol",
    "external_id": "my-protocol-v1",
    "flow_yaml": "diagram:\n  Protocol: []",
    "plan_yaml": "PlanSpace:\n  Actions: []"
  }'
```

---

## Environment Variables

### API

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | protocol_builder | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `PORT` | 3001 | API server port |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | http://localhost:3001 | API base URL |

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
netstat -ano | findstr :5173
netstat -ano | findstr :3001

# Kill process by PID
taskkill /PID <PID> /F
```

### Database Connection Issues

```bash
# Check if database is running
docker-compose ps

# View database logs
docker-compose logs db

# Reset database
docker-compose down -v
docker-compose up -d
```

### Container Won't Start

```bash
# View detailed logs
docker-compose logs -f api

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## Seed Data

The database is seeded with a sample "Vehicle Access Protocol" flow on first startup:

- **Name**: Vehicle Access Protocol
- **External ID**: `vehicle-access-v1`
- **Contains**: Sample flow with Fill Data, Switch, Case, and Access Decision blocks

Fetch it with:
```bash
curl http://localhost:3001/api/flows/external/vehicle-access-v1
```

---

## License

MIT
