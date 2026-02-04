# STATUS

This file is the quick **handoff + truth source** for the **agent-runner** platform.
If something here disagrees with reality, **update this file**.

---

## Current state

### What works
- **Agent Runner API** (FastAPI) runs locally and behind nginx.
- **Console UI** (Next.js) uses React Query; spinner deadlocks resolved.
- **Activity ticker** shows live UI activity without SSR hydration issues.
- **Events**
    - REST: `GET /runs/{id}/events`
    - **SSE**: `GET /runs/{id}/events/stream`
        - Supports `Last-Event-ID` header and `?after_id=`
        - Includes keepalive comments
- **Model overrides**, provider timeouts, and workflow execution are functional.
- **Forgejo** and **Taiga** can be run locally for dev/PM support.

### Known risks / follow-ups
- Long local LLM generations (Ollama) can still stall or time out depending on model size and RAM.
- Artifact storage is currently filesystem-based; durability strategy TBD.
- Cancellation semantics are not yet fully implemented.

---

## How to run (canonical)

> **Use Make targets**. Manual commands are fallback only.

### Discover commands
```bash
make help
```

---

## Typical development workflow

### Install dependencies (first time)
```bash
make install
```

### Start everything (agent-runner + console)
```bash
make start
# or
make dev
```

Endpoints after start:
- Agent Runner API: http://localhost:8000
- Console UI:       http://localhost:3001

### Stop services
```bash
make stop
```

### Restart services
```bash
make restart
```

### View status
```bash
make status
```

### View logs
```bash
make logs
```

---

## Individual services

### Agent Runner only
```bash
make start-agent
make stop-agent
```

### Console only
```bash
make start-console
make stop-console
```

---

## Testing

### Run all unit tests
```bash
make test
```

### Verbose tests
```bash
make test-verbose
```

### Coverage
```bash
make test-coverage
```

### End-to-end agent execution
```bash
make test-agent
```

### Verify CORS (console ↔ API)
```bash
make test-cors
```

---

## Database (local SQLite)

### Reset database
```bash
make db-reset
```

### Open SQLite shell
```bash
make db-shell
```

Database file:
- `agent-runner/db/platform.db`

---

## Infrastructure (local dev)

### Forgejo (Git)
```bash
make start-forgejo
make stop-forgejo
# http://localhost:3000
```

### Taiga (Project Management)
```bash
make start-taiga
make stop-taiga
# http://localhost:9000
```

---

## Key API endpoints

- Create project: `POST /projects`
- Create run: `POST /runs`
- List runs: `GET /runs`
- List events: `GET /runs/{id}/events`
- Stream events (SSE): `GET /runs/{id}/events/stream`
- Seed demo data: `make seed`

---

## Quick verification

### Stream events live (SSE)
```bash
curl -N "http://localhost:8000/runs/<id>/events/stream"
```

### Resume from an event id
```bash
curl -N -H "Last-Event-ID: 70" "http://localhost:8000/runs/<id>/events/stream"
# or
curl -N "http://localhost:8000/runs/<id>/events/stream?after_id=70"
```

### View last 10 events (REST)
```bash
curl -sS "http://localhost:8000/runs/<id>/events" | jq '.[-10:]'
```

---

## Nginx notes (GEEKOM / Ubuntu)

For SSE, nginx **must not buffer** the stream:

- `proxy_buffering off;`
- `proxy_read_timeout 3600s;`
- `gzip off;`

See `docs/DEPLOYMENT.md` for full config examples.

---

## Change log (optional)

- Add a short bullet here when landing major platform features
  (e.g. SSE, cancellation, artifacts, persistence).
