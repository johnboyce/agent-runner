# AI Dev Factory

> A local-first AI development environment for designing, running, and iterating on autonomous AI agents.

**AI Dev Factory** is a factory floor for AI agents where humans define goals, agents execute work, and everything runs locally with full visibility and control.

## 🚀 Quick Start

```bash
# Install dependencies
make install

# Configure environment (optional, defaults provided)
# Edit console/.env.local or agent-runner/.env if needed

# Start all services
make start

# Or start services in foreground (recommended for development)
# Terminal 1
make start-agent

# Terminal 2
make start-console

# View at: http://localhost:3001
```

For all available commands: `make help`

📚 **Full documentation:** See [`DOCS_INDEX.md`](DOCS_INDEX.md) for guides, troubleshooting, and architecture details.

---

## Features

- **Automatic agent execution** — Background worker processes runs automatically ✨ NEW
- **Read and modify real codebases** — Agents work on actual Git repositories
- **Expose HTTP APIs** — RESTful endpoints for control and inspection
- **Coordinate multi-step tasks** — Orchestrate complex workflows
- **Power a modern web console** — Next.js UI for visibility and control
- **Operate safely under human supervision** — Human-in-the-loop by design

**Status:** Runs now execute automatically! Create a run and watch it transition through QUEUED → RUNNING → COMPLETED.

**Test it:** `make test-agent` (requires agent runner to be running)

---

## High-Level Goals

### 🤖 Agent-Centric Development
- Agents are first-class actors, not background scripts
- Each agent has a defined role, API surface, and execution lifecycle

### 👤 Human-in-the-Loop Control
- No "runaway AI"
- Every action is observable, inspectable, and stoppable
- Humans decide when changes are committed

### 💻 Local-First, Cloud-Ready
- Runs entirely on a developer machine (Mac/Linux)
- No required cloud dependencies
- Can later be deployed to servers or CI if desired

### 📦 Real Code, Real Repos
- Agents work on actual Git repositories
- Git history is sacred
- No hidden side effects

### 🔧 Composable and Evolvable
- Swap LLM backends (Ollama today, others later)
- Add new agent types incrementally
- Extend the console without rewriting the backend

---

## What This Is (and Isn't)

### ✅ This Is
- A local AI agent runtime
- A Next.js web console for visibility and control
- A framework for iterative AI-assisted software development
- A safe playground for agent workflows
- A foundation for future automation

### ❌ This Is Not
- A SaaS product
- A "push button, ship to prod" AI
- A black-box prompt playground
- A replacement for human judgment

## Configuration

The system is highly configurable via environment variables.

### Console (Frontend)
Edit `console/.env.local` to configure:
- `NEXT_PUBLIC_AGENT_RUNNER_URL`: URL of the backend API (default: `http://localhost:8000`)
- `NEXT_PUBLIC_FORGEJO_URL`: URL of the Forgejo instance (default: `http://localhost:3000`)
- `NEXT_PUBLIC_TAIGA_URL`: URL of the Taiga instance (default: `http://localhost:9000`)
- `NEXT_PUBLIC_POLLING_INTERVAL_FAST`: Polling speed for active runs (ms) (default: `1500`)
- `NEXT_PUBLIC_EVENT_MAX_BUFFER`: Max events to keep in browser memory (default: `1000`)

### Verification
You can verify the connection between the Console and the Agent Runner by running:
```bash
make test-cors
```
This script simulates browser requests (including CORS preflights) and ensures the backend is correctly configured.

### Agent Runner (Backend)
Edit `agent-runner/.env` to configure:
- `CORS_ORIGINS`: Allowed origins for CORS (default: `http://localhost:3001,http://127.0.0.1:3001,http://0.0.0.0:3001`)
- `DATABASE_URL`: SQLAlchemy database URL (default: `sqlite:///./db/platform.db`)
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR) (default: `INFO`)
- `WORKER_CHECK_INTERVAL`: Seconds between worker polls (default: `5`)
- `WORKER_BATCH_SIZE`: Max runs to process per cycle (default: `10`)

> **Note:** The Agent Runner binds to `0.0.0.0` by default to ensure it is reachable via both IPv4 and IPv6 loopback addresses (`localhost` vs `127.0.0.1` vs `::1`).
- `DISABLE_WORKER`: Set to `true` to disable the background worker (default: `false`)

### Makefile
You can also override ports directly in the `Makefile` or via environment variables when running `make`:
- `PORT_AGENT` (default: 8000)
- `PORT_CONSOLE` (default: 3001)
- `PORT_FORGEJO` (default: 3000)
- `PORT_TAIGA` (default: 9000)

Example: `PORT_CONSOLE=4000 make start-console`

---

## Architecture Overview

The system is split into two major components:

```
ai-dev-factory/
├── agent-runner/     # Python backend that runs AI agents
├── console/          # Next.js web UI for humans
├── docs/             # Milestones, plans, design notes
└── docker/           # Optional local infrastructure services
```

### 1. Agent Runner (Backend)

A Python service responsible for:
- Executing AI agents
- Managing agent runs
- Tracking run state and outputs
- Exposing REST endpoints for control and inspection

**Key Characteristics:**
- Runs on `localhost:8000`
- Designed for FastAPI-style APIs
- Uses local models (via Ollama) by default
- Keeps execution deterministic and observable

**Conceptually, the Agent Runner answers:**
- What agent is running right now?
- What task is it performing?
- What files did it touch?
- Did it succeed or fail?

### 2. Console (Frontend)

A Next.js application that provides:
- A clean UI for viewing agent runs
- Navigation through run history
- Human-readable summaries of agent actions
- A foundation for approvals, retries, and supervision

**Key Characteristics:**
- Runs on `localhost:3001`
- Built with Next.js App Router
- Designed for clarity over cleverness
- Meant to scale from "MVP console" → "control center"

> The console is intentionally read-only first — control features are layered in carefully.

---

## Development Philosophy

This repo follows a few strong opinions:

### 1. Git Is the Source of Truth
- Agents may propose changes
- Humans commit changes
- Accidental commits are undone, not rationalized

### 2. Milestones > Big Bang
Development proceeds via clearly defined milestones:
- **Milestone 1:** Agent execution basics
- **Milestone 2:** Local model integration
- **Milestone 3:** Console MVP + Agent Runner endpoints
- **Milestone 4+:** Multi-agent coordination, approvals, persistence

Each milestone is documented in `docs/`.

### 3. Incremental Automation
Automation is earned, not assumed.

**First:**
- Visibility
- Logs
- Determinism

**Then:**
- Guardrails
- Constraints
- Approvals

**Only later:**
- Autonomy

---

## Current Status (Milestone 3)

### ✅ Agent Runner
- HTTP API endpoints
- Runnable local service
- Structured agent runs
- Integration with local LLMs (Ollama)

### ✅ Console MVP
- Next.js application
- Run listing pages
- Run detail views
- Clean baseline UI

### 🚧 In Progress / Next
- Persisted run history
- Agent metadata
- Run replay / retry
- Approval workflows
- Multi-agent orchestration

---

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+
- Ollama (for local LLM support)

### Agent Runner

```bash
cd agent-runner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Console

```bash
cd console
npm install
npm run dev -- -p 3001
```

### Access the Services

- **Agent Runner API:** http://localhost:8000
- **Console UI:** http://localhost:3001

---

## Why This Exists

This repo exists because:
- AI agents are powerful but dangerous without structure
- Prompt-only workflows don't scale
- Real software development needs:
  - History
  - Review
  - Context
  - Intent

**AI Dev Factory** is an attempt to give AI agents a factory floor instead of a free-range wilderness.

---

## Long-Term Vision

Longer term, this project could evolve into:
- A multi-agent orchestration platform
- A local "AI coworker" environment
- A CI-integrated agent system
- A foundation for AI-assisted DevOps
- A reusable framework across multiple projects

**But it always remains:**
> Human-directed. Local-first. Observable.

---

## Final Note

This repo is intentionally not over-abstracted.

- **Clarity** beats cleverness.
- **Control** beats autonomy.
- **Understanding** beats speed.

If you're reading this and it feels deliberate — that's the point.


