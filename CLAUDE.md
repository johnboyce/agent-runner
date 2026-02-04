# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Runner is a production-grade agent execution control plane with a modern web console. It provides observability, lifecycle control, and resilience for AI agent runs - not magic abstractions.

**Key concepts:**
- **Run**: A unit of agent execution with lifecycle states (QUEUED → RUNNING → COMPLETED/FAILED)
- **Event**: Immutable timeline entries for audit trail and observability
- **Worker**: Background processor that claims and executes queued runs
- **Console**: Human-facing control plane for monitoring and controlling runs

## Commands

### Service Management (via Makefile)
```bash
make install         # Install all dependencies (first time)
make start           # Start backend (8000) + frontend (3001)
make stop            # Stop all services
make restart         # Restart all services
make status          # Check service status
make logs            # View service logs
```

### Individual Services
```bash
make start-agent     # Start backend only (foreground)
make start-console   # Start frontend only
```

### Testing
```bash
# Backend (pytest)
make test                    # Run all backend tests
make test-verbose            # Verbose output
make test-coverage           # With coverage report

# Run specific test
cd agent-runner && source .venv/bin/activate
pytest tests/test_routes.py::test_create_run
pytest tests/test_agent.py -k "atomic"

# Frontend (Jest)
cd console && npm test       # Run all tests
npm run test:watch           # Watch mode
npm run test:coverage        # With coverage

# E2E
make test-agent              # End-to-end agent execution
make test-cors               # Verify CORS configuration
```

### Database
```bash
make db-shell        # Open SQLite shell
make db-reset        # Reset database (prompts for confirmation)
```

## Architecture

```
agent-runner/        # FastAPI backend (Python 3.11)
├── app/
│   ├── main.py      # Entry point, CORS, lifespan
│   ├── routes.py    # REST API endpoints
│   ├── models.py    # SQLAlchemy models (Project, Run, Event)
│   ├── database.py  # SQLite configuration
│   ├── agent.py     # SimpleAgent execution logic
│   ├── worker.py    # BackgroundWorker thread
│   ├── workflows.py # Workflow execution (LLM integration)
│   └── providers.py # LLM provider abstraction
├── tests/           # pytest tests
└── db/platform.db   # SQLite database

console/             # Next.js 16 frontend (TypeScript)
├── src/
│   ├── app/         # App Router pages
│   │   ├── page.tsx           # Dashboard
│   │   └── runs/[id]/page.tsx # Run detail
│   ├── components/  # React components
│   ├── hooks/       # Custom hooks (useRun, useRunEvents, usePolling)
│   └── lib/         # API client utilities
└── package.json

docs/                # Documentation
├── ARCHITECTURE.md  # System diagrams
├── API_REFERENCE.md # REST API docs
├── TESTING.md       # Test guide
└── WORKFLOWS.md     # Workflow system
```

## Key Patterns

### Backend (FastAPI)
- **Atomic run claiming**: Worker uses `UPDATE ... WHERE status='QUEUED'` to prevent double execution
- **Event logging**: All state changes logged as immutable events
- **Session management**: Routes use `get_db()` dependency; agent/worker manage own sessions
- **Run lifecycle**: QUEUED → RUNNING → PAUSED/STOPPED/COMPLETED/FAILED

### Frontend (Next.js)
- **Hardened polling**: `usePolling` hook with abort signals, timeouts, visibility-aware pausing
- **SSE support**: `useRunEventsSSE` for real-time event streaming
- **Adaptive intervals**: Fast polling (1.5s) when active, slow (5s) when idle
- **Cursor-based events**: Incremental event fetching with deduplication

### API Endpoints
- `POST /runs` - Create run (JSON body: `{project_id, goal, name?, run_type?, options?, metadata?}`)
- `GET /runs/{id}` - Get run details
- `GET /runs/{id}/events` - Get events (supports `?after=cursor` for incremental)
- `POST /runs/{id}/{action}` - Control (pause/resume/stop)
- `GET /worker/status` - Background worker status

## Ports
| Service | Port |
|---------|------|
| Console UI | 3001 |
| Agent Runner API | 8000 |
| API Docs (Swagger) | 8000/docs |
| Forgejo (optional) | 3000 |
| Taiga (optional) | 9000 |

## Environment

Backend (`agent-runner/.env`):
```
DATABASE_URL=sqlite:///./db/platform.db
WORKER_CHECK_INTERVAL=5
```

Frontend (`console/.env.local`):
```
NEXT_PUBLIC_AGENT_RUNNER_URL=http://localhost:8000
```
