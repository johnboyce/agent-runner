# 📚 Documentation Index - Start Here!

Welcome! This file helps you navigate the documentation for **Agent Runner**.

---

## 🚀 **Quick Start** (For Impatient Developers)

**Want to just run it?** Use this:

### Using Makefile (Recommended)
```bash
# Install dependencies
make install

# Start all services (background mode)
make start

# Or start in foreground (see logs directly)
make start-agent    # Terminal 1
make start-console  # Terminal 2

# View all commands
make help
```

### Manual Start (Alternative)
```bash
# Terminal 1 - Backend
cd agent-runner && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend  
cd console && npm run dev -- -p 3001
```

### Create Test Data
```bash
# Using test script (recommended)
./scripts/test-create-run-api.sh

# Or manually create project
curl -X POST "http://localhost:8000/projects?name=demo&local_path=/tmp/demo"

# Then create run (NEW JSON format)
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "goal": "Write a hello world script"}'

# Or use the UI!
# Just click "Create Run" button in the Console
```

**Open browser:** http://localhost:3000 or http://localhost:3001


---

## 📖 **Documentation Guide**

### 🎯 If You Want To...

#### **Understand what this project is about**
→ Read the main `README.md` in the root  
→ Philosophy, goals, and vision

#### **See the architecture and current state**
→ Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)  
→ Service overview, system diagrams, data flows  
→ Component details and integration points

#### **Start using it quickly**
→ Read [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md)  
→ All commands, ports, API endpoints  
→ Troubleshooting guide

#### **Manage Agent Tasks and Roadmap**
→ Read [`docs/agents/TASKS.md`](docs/agents/TASKS.md)  
→ Current tasks, next steps, and long-term roadmap

#### **Get a Quick Project Status Handoff**
→ Read [`docs/agents/STATUS.md`](docs/agents/STATUS.md)  
→ What works, known risks, and canonical run commands

#### **Propose New Agent Tasks/Ideas**
→ Add to [`docs/agents/INBOX.md`](docs/agents/INBOX.md)  
→ Scratchpad for new ideas, outputs, logs, and notes

#### **Understand the Create Run feature**
→ Read [`docs/CREATE_RUN_MODAL_IMPLEMENTATION.md`](docs/CREATE_RUN_MODAL_IMPLEMENTATION.md)  
→ Complete feature documentation  
→ API changes and migration guide

#### **Run tests**
→ Read [`docs/TESTING.md`](docs/TESTING.md)  
→ Test structure and commands  
→ Coverage reports

#### **See agent execution in action**
→ Read [`docs/AGENT_QUICKSTART.md`](docs/AGENT_QUICKSTART.md)  
→ One-command demo  
→ What to expect

#### **Review development history**
→ See [`docs/_analysis/`](docs/_analysis/) directory  
→ Time-stamped analysis from development sessions

---

## 📑 **All Documentation Files**

### Root Level
- **`README.md`** - Project overview, philosophy, getting started
- **`DOCS_INDEX.md`** - This file (navigation guide)

### `/docs` Directory

| File | Purpose | When to Read |
|------|---------|--------------|
| **[README.md](docs/README.md)** | Documentation index and overview | Start here |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | System architecture, diagrams, data flows | Understanding the system |
| **[API_REFERENCE.md](docs/API_REFERENCE.md)** | Complete REST API documentation with examples | Working with the API |
| **[QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** | Commands, ports, API reference | Daily development |
| **[CREATE_RUN_MODAL_IMPLEMENTATION.md](docs/CREATE_RUN_MODAL_IMPLEMENTATION.md)** | Create Run feature documentation | Understanding new features |
| **[TESTING.md](docs/TESTING.md)** | Testing guide and coverage | Running tests |
| **[AGENT_QUICKSTART.md](docs/AGENT_QUICKSTART.md)** | Quick agent execution demo | Seeing it in action |
| **[AGENT_EXECUTION.md](docs/AGENT_EXECUTION.md)** | Agent execution deep dive | Understanding worker logic |
| **[ARCHITECTURE_UPDATE_2026-02-01.md](docs/ARCHITECTURE_UPDATE_2026-02-01.md)** | Latest architectural changes | Recent updates |
| **[milestone-01-local-stack.md](docs/milestone-01-local-stack.md)** | Milestone 1 documentation | Project history |
| **[milestone-03-console-mvp.md](docs/milestone-03-console-mvp.md)** | Milestone 3 documentation | Console MVP details |

### `/docs/agents` Directory
- **`INBOX.md`** - Scratchpad for new ideas, notes, agent output, logs.
- **`TASKS.md`** - The definitive list of platform work and roadmap.
- **`STATUS.md`** - Handoff document with current state and canonical run commands.

### `/docs/_analysis` Directory
Historical analysis and development notes (timestamped):
- `PROJECT_STATUS_2026-01-31.md`
- `ANALYSIS_SUMMARY_2026-01-31.md`
- `CODE_REVIEW_FIXES_2026-01-31.md`
- And more...

---

## 🎓 **Learning Path**

### Documentation Navigation Map

```mermaid
flowchart TD
    START([New to Agent Runner?]) --> README[README.md<br/>Project Overview]

    README --> ROLE{What's your goal?}

    ROLE -->|Understand System| ARCH[ARCHITECTURE.md<br/>System Design & Diagrams]
    ROLE -->|Quick Start| QS[Quick Start Section<br/>in DOCS_INDEX.md]
    ROLE -->|Daily Development & Tasks| TASKS[docs/agents/TASKS.md<br/>Current Work & Roadmap]
    ROLE -->|See It Work| DEMO[AGENT_QUICKSTART.md<br/>One-Command Demo]
    ROLE -->|Quick Status Check| STATUS[docs/agents/STATUS.md<br/>Current State & Run Commands]

    QS --> INSTALL[make install]
    INSTALL --> START_SERV[make start]
    START_SERV --> BROWSER[Open localhost:3001]
    BROWSER --> CREATE[Create a Run]
    CREATE --> OBSERVE[Observe Execution]

    ARCH --> UNDERSTAND{Need More Detail?}
    UNDERSTAND -->|Data Flow| SEQ[Sequence Diagrams]
    UNDERSTAND -->|Database| ERD[ER Diagram]
    UNDERSTAND -->|Components| COMP[Component Details]

    DEMO --> TRY[Try Creating Runs]
    TRY --> DEEP{Want Deeper Understanding?}

    DEEP -->|Testing| TEST[TESTING.md<br/>Test Structure]
    DEEP -->|Contributing| CONTRIB[CONTRIBUTING.md<br/>Development Guide]
    DEEP -->|Features| FEATURES[Feature Docs]

    TASKS --> DAILY[Daily Development Work]
    TEST --> DAILY
    CONTRIB --> DAILY
    STATUS --> DAILY

    FEATURES --> MODAL[CREATE_RUN_MODAL.md]
    FEATURES --> EXEC[AGENT_EXECUTION.md]

    DAILY --> NEED{Need Historical Context?}
    NEED -->|Yes| ANALYSIS[docs/_analysis/<br/>Session Notes]
    NEED -->|No| WORK[Continue Development]

    style START fill:#FFD700
    style README fill:#87CEEB
    style ARCH fill:#90EE90
    style TASKS fill:#ADD8E6
    style STATUS fill:#ADD8E6
    style QUICK fill:#DDA0DD
    style DAILY fill:#98FB98
    style WORK fill:#32CD32
```

### For New Team Members
1. Read root [`README.md`](README.md)
2. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
3. Try Quick Start above
4. Read [`docs/agents/TASKS.md`](docs/agents/TASKS.md) for the project roadmap and current tasks.
5. Bookmark [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) and [`docs/agents/STATUS.md`](docs/agents/STATUS.md)

### For Continuing Development
1. Use [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) for daily reference
2. Refer to [`docs/agents/TASKS.md`](docs/agents/TASKS.md) for current tasks and roadmap.
3. Read [`docs/CREATE_RUN_MODAL_IMPLEMENTATION.md`](docs/CREATE_RUN_MODAL_IMPLEMENTATION.md) for latest features
4. Refer to [`docs/_analysis/`](docs/_analysis/) for historical context if needed

---

## 🔍 **Quick Reference Table**

| Need | File | Section |
|------|------|---------|
| Start services | [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) | "Start Everything" |
| API endpoints | [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | "Endpoints" |
| API examples | [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | "Examples" |
| Architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | All sections |
| System design | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Diagrams |
| Data flow | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | "Data Flow" |
| Troubleshooting | [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) | "Troubleshooting" |
| Testing | [`docs/TESTING.md`](docs/TESTING.md) | All sections |
| Create Run feature | [`docs/CREATE_RUN_MODAL_IMPLEMENTATION.md`](docs/CREATE_RUN_MODAL_IMPLEMENTATION.md) | Complete guide |
| Philosophy | Root [`README.md`](README.md) | "Development Philosophy" |
| **Current Tasks / Roadmap** | [`docs/agents/TASKS.md`](docs/agents/TASKS.md) | "Now", "Next", "Later" |
| **Project Status Handoff** | [`docs/agents/STATUS.md`](docs/agents/STATUS.md) | "What works", "Known risks" |
| **Propose New Ideas** | [`docs/agents/INBOX.md`](docs/agents/INBOX.md) | All sections |

## 🚀 **Your Next Move**

### Test Current Features
```bash
# Start services
make start-agent    # Terminal 1
make start-console  # Terminal 2

# Test agent execution
make test-agent

# Open browser
open http://localhost:3000
```

### Explore Documentation
- **Quick reference:** [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Testing:** [`docs/TESTING.md`](docs/TESTING.md)

---

## 💬 **Need Help?**

**For quick lookups:**
→ [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md)

**For understanding the system:**
→ [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

**For testing:**
→ [`docs/TESTING.md`](docs/TESTING.md)

**For debugging:**
→ [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) → Troubleshooting section

---

## 📌 **Bookmark These**

Most useful for daily work:
1. [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) - Commands and shortcuts
2. [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) - Complete API documentation
3. [`docs/agents/TASKS.md`](docs/agents/TASKS.md) - The definitive list of platform work and roadmap.
4. [`docs/agents/STATUS.md`](docs/agents/STATUS.md) - Handoff document with current state and canonical run commands.
5. [`GEMINI.md`](GEMINI.md) - Guide for working with Gemini Code Assistant.
6. [`CLAUDE.md`](CLAUDE.md) - Guide for working with Claude Code.

Most useful for understanding:
1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - Technical design
2. Root [`README.md`](README.md) - Project overview and philosophy
3. [`docs/_analysis/`](docs/_analysis/) - Historical development notes

---

*Last updated: February 1, 2026*

*Start with the Quick Start section above, then explore based on what you need!*
