# Contributing to Agent Runner

Thank you for your interest in contributing to Agent Runner!

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 20+
- Make (for build commands)
- Docker and Docker Compose (for Forgejo/Taiga)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd ai-dev-factory

# Install all dependencies
make install

# Start development environment
make dev
```

This will start both the agent runner (port 8000) and console (port 3001).

---

## Project Structure

```
ai-dev-factory/
├── agent-runner/          # Python FastAPI backend
│   ├── app/
│   │   ├── main.py       # Entry point, CORS config
│   │   ├── routes.py     # API endpoints
│   │   ├── models.py     # Database models
│   │   └── database.py   # Database configuration
│   ├── db/               # SQLite database (gitignored in runtime)
│   └── requirements.txt  # Python dependencies
│
├── console/              # Next.js frontend
│   ├── src/
│   │   ├── app/          # Next.js App Router (pages)
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Hardened polling hooks (useRun, etc.)
│   │   └── lib/          # Utilities (timeout, etc.)
│   ├── package.json
│   └── .env.local        # Environment variables
│
├── docs/                 # Active documentation
│   ├── README.md         # Documentation overview
│   ├── ARCHITECTURE.md   # System design
│   ├── QUICK_REFERENCE.md # Daily commands
│   ├── NEXT_STEPS.md     # Implementation roadmap
│   └── _analysis/        # Historical development notes
│
├── docker/               # Infrastructure services
│   ├── forgejo/          # Git forge
│   └── taiga/            # Project management
│
├── scripts/              # Utility scripts (deprecated - use Makefile)
├── Makefile              # Development commands
└── README.md             # Project overview
```

---

## Development Workflow

### Starting Services

```bash
# Start all services in background
make start

# Or start individually in foreground (see logs)
make start-agent     # Terminal 1
make start-console   # Terminal 2

# Check what's running
make status
```

### Making Changes

1. **Create a branch** for your feature
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style below

3. **Configure environment** if needed (see `README.md` for details)
   ```bash
   # Create .env files from templates
   cp console/.env.example console/.env.local
   cp agent-runner/.env.example agent-runner/.env
   ```

### Testing Your Changes

Automated tests are required for new logic.

```bash
# Run all tests
make test

# Run specific tests
make test-verbose
make test-coverage

# Verify E2E agent flow
make test-agent

# Verify CORS configuration
make test-cors
```

4. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve issue"
   git commit -m "docs: update documentation"
   ```

### Stopping Services

```bash
# Stop all services
make stop

# Clean build artifacts
make clean
```

---

## Code Style

### Python (Agent Runner)

- Follow PEP 8
- Use type hints
- Use FastAPI best practices:
  - Return 404 for missing resources
  - Validate inputs with Pydantic
  - Use proper HTTP status codes
  - Include error messages in responses

**Example:**
```python
@router.get("/runs/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
```

### TypeScript (Console)

- Use TypeScript strict mode
- Use functional components with hooks
- **Polling Logic**: Use existing hardened hooks (`usePolling`, `useRun`, `useRunEvents`). These hooks handle visibility changes, aborting in-flight requests, and stale closure protection via refs.
- Handle loading and error states explicitly (loading state should settle to `false` even on errors).
- Use proper types (no `any` unless absolutely necessary).

**Example:**
```typescript
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### Database Changes

- Models are in `agent-runner/app/models.py`
- Database is SQLite (created automatically)
- To reset: `make db-reset`
- To inspect: `make db-shell`

---

## Documentation

### When to Update Documentation

**Always update when:**
- Adding new API endpoints → Update `ARCHITECTURE.md`
- Changing commands → Update `QUICK_REFERENCE.md`
- Adding features → Update `NEXT_STEPS.md`
- Changing setup → Update `README.md`

**Use `docs/_analysis/` for:**
- Session-specific troubleshooting notes
- Major debugging writeups
- Code review resolutions
- Decision rationale that needs historical context

**Naming convention:** `DESCRIPTION_YYYY-MM-DD.md`

### Documentation Style

- Be concise and clear
- Include code examples
- Use proper markdown formatting
- Link between related documents

---

## Testing

### Automated Testing

We use `pytest` for the Python backend and `Jest` for the TypeScript frontend.

```bash
# Run all tests
make test

# Backend only
cd agent-runner && pytest

# Frontend only
cd console && npm test
```

### Manual Testing

```bash
# Create test data
make seed

# Verify E2E flow (requires agent runner to be running)
make test-agent

# Verify CORS (simulates browser requests)
make test-cors

# Test in browser
open http://localhost:3001
```

---

## Common Tasks

### Adding a New API Endpoint

1. Add endpoint to `agent-runner/app/routes.py`
2. Add proper error handling (404s, validation)
3. Update `docs/ARCHITECTURE.md` with new endpoint
4. Test with curl
5. Update console if needed

### Adding a New Console Page

1. Create page in `console/src/app/`
2. Add navigation links
3. Handle loading/error states
4. Update `docs/ARCHITECTURE.md` if significant

### Database Changes

1. Update models in `agent-runner/app/models.py`
2. Reset database: `make db-reset`
3. Restart agent runner: `make restart`

---

## Infrastructure Services

### Forgejo (Git Forge)

```bash
make start-forgejo  # http://localhost:3000
make stop-forgejo
```

### Taiga (Project Management)

```bash
make start-taiga    # http://localhost:9000
make stop-taiga
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check what's using the ports
make status

# Stop everything
make stop

# Clean and restart
make clean
make start
```

### Database Issues

```bash
# Reset database (WARNING: deletes all data)
make db-reset

# Inspect database
make db-shell
```

### Console Shows "Loading..." Forever

1. Check agent runner is running: `make status`
2. Check for CORS errors in browser console (F12)
3. Run `make test-cors` to verify backend configuration
4. Verify `.env.local` exists in `console/` and `.env` exists in `agent-runner/`
5. See `docs/_analysis/FIX_LOADING_ISSUE_2026-01-31.md`

---

## Getting Help

- **Quick commands:** See `make help`
- **Daily reference:** Read `docs/QUICK_REFERENCE.md`
- **Architecture:** Read `docs/ARCHITECTURE.md`
- **Next steps:** Read `docs/NEXT_STEPS.md`
- **Historical issues:** Check `docs/_analysis/`

---

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Update documentation
5. Write clear commit messages
6. Open a pull request with:
   - Description of changes
   - Why the change is needed
   - How to test it
   - Any breaking changes

---

## Philosophy Reminder

This project follows these principles:

- **Human-in-the-loop** - No runaway AI
- **Local-first** - Runs on developer machines
- **Observable** - Everything is visible and inspectable
- **Git-centric** - Real repos, real history
- **Incremental** - Visibility → Guardrails → Autonomy

Keep these in mind when contributing!

---

**Thank you for contributing to Agent Runner!** 🎉
