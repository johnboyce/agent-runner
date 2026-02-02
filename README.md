# Agent Runner

**Agent Runner** is a production-grade **agent execution control plane** with a modern web console for creating, monitoring, and controlling AI agent runs.

It focuses on **observability, lifecycle control, and resilience** — not magic abstractions.

---

## What Agent Runner Does

- Create and manage **agent runs**
- Observe **real-time execution via event timelines**
- Pause, resume, and stop runs safely
- Handle flaky networks and tab switching without breaking state
- Provide operators full visibility into what agents are doing

This repo contains the **Console UI** that talks to an Agent Runner API.

---

## Features

### Console UI
- Run dashboard with search + filtering
- Run detail page with full event timeline
- Manual controls: pause / resume / stop
- Copy-to-clipboard for event payloads
- Auto-scroll with manual override

### Production-Grade Polling
- Abortable requests everywhere
- Hard timeouts (no hanging fetches)
- Visibility-aware (pauses when tab hidden)
- Adaptive polling intervals
- Zero overlapping requests
- React Strict Mode safe

### Event Streaming
- Cursor-based incremental fetching
- Deduplication across retries
- Monotonic ordering
- Final fetch on terminal transitions
- Bounded memory buffer

---

## Architecture (High Level)

```mermaid
graph TB
    subgraph "Browser"
        U[User/Operator]
    end
    
    subgraph "Frontend - Port 3001"
        UI[Agent Runner Console<br/>Next.js + React]
        UI_DASH[Dashboard<br/>Runs List]
        UI_DETAIL[Run Detail<br/>Events Timeline]
        UI_CREATE[Create Run<br/>Modal]
        
        UI --> UI_DASH
        UI --> UI_DETAIL
        UI --> UI_CREATE
    end
    
    subgraph "Backend - Port 8000"
        API[Agent Runner API<br/>FastAPI]
        WORKER[Background Worker<br/>Thread]
        AGENT[Simple Agent<br/>Execution Logic]
        
        API -.-> WORKER
        WORKER --> AGENT
    end
    
    subgraph "Storage"
        DB[(SQLite DB<br/>platform.db)]
        DB_P[Projects Table]
        DB_R[Runs Table]
        DB_E[Events Table]
        
        DB --> DB_P
        DB --> DB_R
        DB --> DB_E
    end
    
    subgraph "Optional Services"
        FORGE[Forgejo<br/>Git Server<br/>Port 3000]
        TAIGA[Taiga<br/>Project Management<br/>Port 9000]
        LLM[Ollama<br/>LLM Server<br/>Port 11434]
    end
    
    U -->|HTTPS| UI
    UI -->|REST API| API
    API -->|SQL| DB
    WORKER -->|SQL| DB
    AGENT -->|SQL| DB
    
    API -.-|Future| FORGE
    API -.-|Future| TAIGA
    AGENT -.-|Future| LLM
    
    style UI fill:#4A90E2
    style API fill:#50C878
    style DB fill:#FFD700
    style WORKER fill:#E67E22
    style FORGE fill:#ddd
    style TAIGA fill:#ddd
    style LLM fill:#ddd
```

**Key concepts**
- **Run**: a unit of agent execution with lifecycle states
- **Event**: immutable execution timeline entries (audit trail)
- **Console**: human-facing control plane for observability
- **Worker**: background processor that claims and executes queued runs
- **Agent**: execution logic that orchestrates run workflows

---

## Run Lifecycle

```mermaid
stateDiagram-v2
    [*] --> QUEUED: Run Created
    QUEUED --> RUNNING: Worker Claims
    RUNNING --> PAUSED: User Pauses
    PAUSED --> RUNNING: User Resumes
    RUNNING --> STOPPED: User Stops
    RUNNING --> COMPLETED: Success
    RUNNING --> FAILED: Error
    STOPPED --> [*]
    COMPLETED --> [*]
    FAILED --> [*]
    
    note right of QUEUED
        Waiting for worker
        to pick up
    end note
    
    note right of RUNNING
        Active execution
        Events streaming
    end note
    
    note right of PAUSED
        Execution suspended
        Can be resumed
    end note
    
    note right of COMPLETED
        Terminal state
        Success
    end note
    
    note right of FAILED
        Terminal state
        Error occurred
    end note
```

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **UI:** React, Tailwind CSS
- **Icons:** lucide-react
- **Behavior:** hardened polling + event streaming
- **Language:** TypeScript

---

## Getting Started

### Prerequisites
- Node.js 18+
- Agent Runner API running locally or remotely

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_AGENT_RUNNER_URL=http://localhost:8000

# Optional service health indicators
NEXT_PUBLIC_FORGEJO_URL=http://localhost:3000
NEXT_PUBLIC_TAIGA_URL=http://localhost:9000

# Optional tuning
NEXT_PUBLIC_POLLING_INTERVAL_FAST=1500
NEXT_PUBLIC_POLLING_MAX_BACKOFF=30000
NEXT_PUBLIC_EVENT_MAX_BUFFER=1000
```

### Run the Console

```bash
npm install
npm run dev
```

Open: http://localhost:3000

---

## Design Philosophy

- **Observability first** — timelines over logs
- **Fail fast, recover cleanly** — aborts + timeouts everywhere
- **Explicit over clever** — readable state machines
- **Human-in-the-loop friendly** — operators stay in control
- **Production realism** — handles tab switches, reloads, flaky APIs

---

## Status

This project is **actively evolving**.
The core run → execution → event loop is complete and hardened.

---

## License

MIT
