# Quick Reference - Agent Runner

## 🚀 Start Everything

### Using Makefile (Recommended)
```bash
# Install dependencies (first time only)
make install

# Start all services
make start

# Stop all services
make stop

# Restart all services
make restart

# Check status
make status

# View logs
make logs

# See all commands
make help
```

### Manual Start (Alternative)

**Terminal 1: Agent Runner (Backend)**
```bash
cd /Users/johnboyce/working/John-AI/ai-dev-factory/agent-runner
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```
Should see: `Application startup complete` and `Uvicorn running on http://127.0.0.1:8000`

### Terminal 2: Console (Frontend)
```bash
cd /Users/johnboyce/working/John-AI/ai-dev-factory/console
npm run dev -- -p 3001
```
Should see: `Ready started server on 0.0.0.0:3001`

### Terminal 3: Test Data (Optional)
```bash
# Create test project
curl -X POST "http://localhost:8000/projects?name=demo-project&local_path=/tmp/demo"

# Create test run (new JSON format)
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "goal": "Write a hello world script"}'

# List all projects
curl http://localhost:8000/projects

# List all runs
curl http://localhost:8000/runs
```

### Browser
Open: http://localhost:3001

---

## 📡 Ports

| Service | Port | URL |
|---------|------|-----|
| Console (UI) | 3001 | http://localhost:3001 |
| Forgejo (Git) | 3000 | http://localhost:3000 |
| Agent Runner (API) | 8000 | http://localhost:8000 |
| Taiga (PM) | 9000 | http://localhost:9000 |
| Ollama (LLM) | 11434 | http://localhost:11434 (not yet integrated) |

---

## 🔍 API Endpoints

### Projects
- `GET /projects` - List all projects
- `POST /projects?name={name}&local_path={path}` - Create project

### Runs
- `GET /runs` - List all runs (newest first)
- `GET /runs/{id}` - Get run details
- `POST /runs` - Create run (JSON body required - see below)
- `POST /runs/{id}/{action}` - Control run (pause|resume|stop)

### Events
- `GET /runs/{id}/events` - List events for run
- `POST /runs/{id}/directive` - Add directive event (JSON body: `{"text": "..."}`)

### Worker
- `GET /worker/status` - Get background worker status
- `POST /worker/process` - Manually trigger run processing

### Health
- `GET /health` - Health check endpoint
- `GET /docs` - Interactive API documentation (Swagger UI)

### Creating a Run (New Format)

**Minimal:**
```bash
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "goal": "Write a hello world script"
  }'
```

**Full Featured:**
```bash
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "My Custom Run",
    "goal": "Write a hello world script",
    "run_type": "agent",
    "options": {
      "dry_run": false,
      "verbose": true,
      "max_steps": 10
    },
    "metadata": {
      "priority": "high",
      "environment": "staging"
    }
  }'
```

**Note:** The old query parameter format (`POST /runs?project_id=X&goal=Y`) is no longer supported. Use JSON body instead.

---

## 🛠️ Troubleshooting

### Console shows "Loading..." forever
- **Check**: Is agent runner running on port 8000?
- **Check**: Open browser DevTools (F12) → Console tab for errors
- **Common issue**: CORS error - make sure you restarted agent runner after CORS was added
- **Fix**: Stop both services and restart (see below)

### Console shows "Failed to fetch data"
- Check: Is agent runner running on port 8000?
- Check: `.env.local` exists with `NEXT_PUBLIC_AGENT_RUNNER_URL=http://localhost:8000`
- Check: Browser console (F12) for CORS or network errors
- **Fix**: Restart console if .env.local was just created

### Agent runner won't start
- Check: Python virtual environment activated? (`source .venv/bin/activate`)
- Check: Dependencies installed? (`pip install -r requirements.txt`)
- Check: Port 8000 available? (`lsof -i :8000`)

### Console won't start
- Check: Node modules installed? (`npm install`)
- Check: Port 3001 available? (`lsof -i :3001`)
- **Port conflict with Forgejo?** Both use port 3000 by default
  - Solution: Run console on 3001: `npm run dev -- -p 3001`
  - Or change Forgejo port in `docker/forgejo/docker-compose.yml`

### Database errors
- Location: `agent-runner/db/platform.db`
- Reset: Delete the file and restart agent runner (will recreate)

---

## 📂 Project Structure

```
ai-dev-factory/
├── agent-runner/          # Python FastAPI backend
│   ├── app/
│   │   ├── main.py       # Entry point
│   │   ├── routes.py     # API endpoints
│   │   ├── models.py     # Database models
│   │   └── database.py   # DB config
│   ├── db/
│   │   └── platform.db   # SQLite database
│   ├── .venv/            # Python virtual env
│   └── requirements.txt
│
├── console/              # Next.js frontend
│   ├── src/app/
│   │   ├── page.tsx      # Home (lists)
│   │   └── runs/[id]/
│   │       └── page.tsx  # Run detail
│   ├── .env.local        # Environment config
│   └── package.json
│
├── docs/
│   ├── PROJECT_STATUS.md      # Full analysis
│   ├── NEXT_STEPS.md          # Action plan
│   ├── ANALYSIS_SUMMARY.md    # This summary
│   ├── QUICK_REFERENCE.md     # This file
│   ├── milestone-01-local-stack.md
│   └── milestone-03-console-mvp.md
│
├── docker/
│   ├── forgejo/          # Git forge
│   └── taiga/            # Project management
│
└── README.md
```

---

## 🎯 What Works Now

✅ Agent Runner API running
✅ Console UI running
✅ Console can fetch projects/runs
✅ Console can display run details
✅ Control buttons (pause/resume/stop) work
✅ Directive submission works
✅ Event logging works

---

## 🚧 What Doesn't Work Yet

❌ Runs don't actually execute (just track state)
❌ No LLM integration (Ollama not connected)
❌ No Git operations
❌ No project/run creation from UI
❌ No auto-refresh
❌ No file system operations

---

## 📋 Next Tasks

See `docs/NEXT_STEPS.md` for detailed plan:

**Phase 2** (2-3 hours):
- Add project creation form
- Add run creation form
- Add auto-refresh to run detail

**Phase 3** (1-2 days):
- Implement agent execution loop
- Integrate Ollama
- Add file system operations

---

## 🧪 Testing Checklist

- [ ] Agent runner starts without errors
- [ ] Console starts without errors
- [ ] Browser loads http://localhost:3001
- [ ] Can see empty projects list
- [ ] Can see empty runs list (or test data if created)
- [ ] Can click on a run
- [ ] Can see run details page
- [ ] Can see events list
- [ ] Pause button changes run status
- [ ] Resume button changes run status
- [ ] Stop button changes run status
- [ ] Can submit directive
- [ ] Directive appears in events list (after refresh)

---

## 💾 Git Status

**Uncommitted files:**
- `console/` (entire new directory)
- `agent-runner/app/routes.py`
- `agent-runner/db/`
- `docs/milestone-03-console-mvp.md`
- `docs/PROJECT_STATUS.md`
- `docs/NEXT_STEPS.md`
- `docs/ANALYSIS_SUMMARY.md`
- `.gitignore`
- `README.md`

**Untracked (ignored):**
- `.aider.*` files
- `agent-runner/.venv/`
- `console/node_modules/`
- `console/.next/`
- `docker/forgejo/data/`

---

## 🔗 Useful Commands

```bash
# Check what's running on ports
lsof -i :3000  # Forgejo
lsof -i :3001  # Console
lsof -i :8000  # Agent Runner
lsof -i :9000  # Taiga

# Kill a process on a port
kill -9 $(lsof -ti:8000)

# View database
sqlite3 agent-runner/db/platform.db
sqlite> .tables
sqlite> SELECT * FROM runs;
sqlite> .quit

# Check Python packages
cd agent-runner
source .venv/bin/activate
pip list

# Check Node packages
cd console
npm list --depth=0

# View logs
# Agent Runner: Look at terminal output
# Console: Check browser console (F12) + terminal output
```

---

*Last updated: January 31, 2026*
