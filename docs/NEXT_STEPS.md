# Immediate Action Plan - AI Dev Factory

**Generated:** January 31, 2026  
**Priority:** Critical Path to Working System

---

## 🎯 Goal
Get from "display-only UI" to "working agent system" in minimal steps.

---

## ✅ Phase 1: Fix Critical Issues (30 minutes)

### Task 1.1: Create Console Environment File (5 min)
```bash
cd console
cat > .env.local << EOF
NEXT_PUBLIC_AGENT_RUNNER_URL=http://localhost:8000
EOF
```

### Task 1.2: Fix API URL Inconsistency (5 min)
**File:** `console/src/app/runs/[id]/page.tsx`

Find these two lines:
```typescript
const response = await fetch(`${process.env.AGENT_RUNNER_URL}/runs/${params.id}/${action}`, {
```
```typescript
const response = await fetch(`${process.env.AGENT_RUNNER_URL}/runs/${params.id}/directive?text=${encodeURIComponent(directiveText)}`, {
```

Replace with:
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/runs/${params.id}/${action}`, {
```
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/runs/${params.id}/directive?text=${encodeURIComponent(directiveText)}`, {
```

### Task 1.3: Test End-to-End (20 min)

**Terminal 1 - Start Agent Runner:**
```bash
cd agent-runner
source .venv/bin/activate  # or: . .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Start Console:**
```bash
cd console
npm run dev -- -p 3001
```

**Browser:**
1. Open http://localhost:3001
2. Check console for errors (F12)
3. Verify "Loading..." → data appears
4. Check Network tab for API calls

**API Test:**
```bash
# Create a test project
curl -X POST "http://localhost:8000/projects?name=test-project&local_path=/tmp/test"

# Create a test run
curl -X POST "http://localhost:8000/runs?project_id=1&goal=Test%20goal"

# Refresh browser - should see project and run
```

---

## 🎨 Phase 2: Add Creation Forms (2-3 hours)

### Task 2.1: Create Project Form (45 min)

**File:** `console/src/app/projects/new/page.tsx` (NEW)

Key features:
- Form with `name` and `local_path` fields
- POST to `/projects`
- Success: redirect to home
- Error: display message

### Task 2.2: Create Run Form (45 min)

**File:** `console/src/app/runs/new/page.tsx` (NEW)

Key features:
- Fetch projects for dropdown
- Form with `project_id` (dropdown) and `goal` (textarea)
- POST to `/runs`
- Success: redirect to `/runs/{id}`
- Error: display message

### Task 2.3: Add Navigation Links (30 min)

**Files to update:**
- `console/src/app/page.tsx` - Add "New Project" and "New Run" buttons
- `console/src/app/layout.tsx` - Add nav bar if needed

### Task 2.4: Add Auto-Refresh (30 min)

**File:** `console/src/app/runs/[id]/page.tsx`

```typescript
// Add to component
const [autoRefresh, setAutoRefresh] = useState(true);

useEffect(() => {
  if (!autoRefresh) return;
  
  const interval = setInterval(() => {
    // Refetch run and events
  }, 5000); // 5 seconds
  
  return () => clearInterval(interval);
}, [autoRefresh, params.id]);
```

Add toggle button to UI.

---

## 🤖 Phase 3: Implement Agent Execution (1-2 days)

### Task 3.1: Create Agent Module (2 hours)

**File:** `agent-runner/app/agent.py` (NEW)

```python
from sqlalchemy.orm import Session
from .models import Run, Event
import time

class AgentRunner:
    def __init__(self, db: Session):
        self.db = db
    
    def execute_run(self, run_id: int):
        """Execute a single run"""
        run = self.db.query(Run).filter(Run.id == run_id).first()
        
        # Update status
        run.status = "RUNNING"
        self.db.commit()
        self._log_event(run_id, "RUN_STARTED", "Agent execution started")
        
        try:
            # TODO: Actual agent logic here
            # For now, just simulate work
            time.sleep(2)
            
            run.status = "COMPLETED"
            self.db.commit()
            self._log_event(run_id, "RUN_COMPLETED", "Agent execution completed")
            
        except Exception as e:
            run.status = "FAILED"
            self.db.commit()
            self._log_event(run_id, "RUN_FAILED", str(e))
    
    def _log_event(self, run_id: int, event_type: str, payload: str):
        event = Event(run_id=run_id, type=event_type, payload=payload)
        self.db.add(event)
        self.db.commit()
```

### Task 3.2: Add Background Execution (2 hours)

**Option A - Simple Threading:**
```python
# In routes.py
import threading
from .agent import AgentRunner

@router.post("/runs")
def create_run(project_id: int, goal: str, db: Session = Depends(get_db)):
    # ... existing code ...
    
    # Start agent in background
    def run_agent():
        agent = AgentRunner(SessionLocal())
        agent.execute_run(run.id)
    
    thread = threading.Thread(target=run_agent)
    thread.daemon = True
    thread.start()
    
    return run
```

**Option B - FastAPI Background Tasks (Better):**
```python
from fastapi import BackgroundTasks

@router.post("/runs")
def create_run(
    project_id: int, 
    goal: str, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # ... existing code ...
    
    # Start agent in background
    background_tasks.add_task(run_agent_task, run.id)
    
    return run

def run_agent_task(run_id: int):
    db = SessionLocal()
    agent = AgentRunner(db)
    agent.execute_run(run_id)
    db.close()
```

### Task 3.3: Add Ollama Integration (3-4 hours)

**File:** `agent-runner/app/llm.py` (NEW)

```python
import requests
from typing import Optional

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
    
    def generate(self, prompt: str, model: str = "llama2") -> Optional[str]:
        """Send prompt to Ollama and get response"""
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=60
            )
            response.raise_for_status()
            return response.json().get("response")
        except Exception as e:
            raise Exception(f"Ollama error: {str(e)}")
    
    def is_available(self) -> bool:
        """Check if Ollama is running"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False
```

**Update agent.py:**
```python
from .llm import OllamaClient

class AgentRunner:
    def __init__(self, db: Session):
        self.db = db
        self.llm = OllamaClient()
    
    def execute_run(self, run_id: int):
        # ... existing code ...
        
        try:
            # Check LLM availability
            if not self.llm.is_available():
                raise Exception("Ollama is not running")
            
            # Get goal
            run = self.db.query(Run).filter(Run.id == run_id).first()
            goal = run.goal
            
            # Ask LLM to plan
            prompt = f"Create a plan to achieve this goal: {goal}"
            plan = self.llm.generate(prompt)
            
            self._log_event(run_id, "PLAN_GENERATED", plan)
            
            # TODO: Execute plan steps
            
            # ... rest of execution ...
```

### Task 3.4: Add File System Operations (2-3 hours)

**File:** `agent-runner/app/filesystem.py` (NEW)

```python
import os
from pathlib import Path
from typing import Optional

class FileSystemAgent:
    def __init__(self, project_path: str):
        self.project_path = Path(project_path).resolve()
        
        # Safety check
        if not self.project_path.exists():
            raise ValueError(f"Project path does not exist: {project_path}")
    
    def read_file(self, relative_path: str) -> str:
        """Read file content from project"""
        file_path = self._resolve_path(relative_path)
        with open(file_path, 'r') as f:
            return f.read()
    
    def write_file(self, relative_path: str, content: str):
        """Write content to file in project"""
        file_path = self._resolve_path(relative_path)
        
        # Create directories if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'w') as f:
            f.write(content)
    
    def list_files(self, relative_path: str = ".") -> list[str]:
        """List files in directory"""
        dir_path = self._resolve_path(relative_path)
        return [str(p.relative_to(self.project_path)) 
                for p in dir_path.rglob("*") if p.is_file()]
    
    def _resolve_path(self, relative_path: str) -> Path:
        """Resolve and validate path is within project"""
        full_path = (self.project_path / relative_path).resolve()
        
        # Security: ensure path is within project
        if not str(full_path).startswith(str(self.project_path)):
            raise ValueError(f"Path outside project: {relative_path}")
        
        return full_path
```

---

## 📋 Acceptance Criteria

### Phase 1 Complete When:
- [ ] Console loads without errors
- [ ] Projects list displays
- [ ] Runs list displays  
- [ ] Run detail page displays
- [ ] Control buttons clickable
- [ ] Directive form submits

### Phase 2 Complete When:
- [ ] Can create project from UI
- [ ] Can create run from UI
- [ ] Run detail auto-refreshes every 5s
- [ ] Can toggle auto-refresh off/on

### Phase 3 Complete When:
- [ ] Creating run triggers background execution
- [ ] Run status changes: QUEUED → RUNNING → COMPLETED
- [ ] Events logged for each step
- [ ] Ollama integration working
- [ ] Agent can read/write project files
- [ ] Errors caught and logged

---

## 🚀 Quick Start Commands

```bash
# Phase 1 setup
cd /Users/johnboyce/working/John-AI/ai-dev-factory
cd console && echo 'NEXT_PUBLIC_AGENT_RUNNER_URL=http://localhost:8000' > .env.local

# Start everything
# Terminal 1
cd agent-runner && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000

# Terminal 2  
cd console && npm run dev -- -p 3001

# Browser
open http://localhost:3001
```

---

## 📚 References

- Full analysis: `docs/PROJECT_STATUS.md`
- Milestone 3 doc: `docs/milestone-03-console-mvp.md`
- README: `README.md`

---

*Generated: January 31, 2026*
