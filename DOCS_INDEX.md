# 📚 Documentation Index - Start Here!

Welcome! This file helps you navigate the documentation for **AI Dev Factory**.

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
# Using Makefile
make seed

# Or manually
PROJECT_RESPONSE=$(curl -s -X POST "http://localhost:8000/projects?name=demo&local_path=/tmp/demo")
PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
curl -X POST "http://localhost:8000/runs?project_id=${PROJECT_ID}&goal=Test%20goal"
```

**Open browser:** http://localhost:3001


---

## 📖 **Documentation Guide**

### 🎯 If You Want To...

#### **Understand what this project is about**
→ Read the main `README.md` in the root  
→ Philosophy, goals, and vision

#### **See the architecture**
→ Read `docs/ARCHITECTURE.md`  
→ System diagrams and data flows  
→ Component details and integration points

#### **Start implementing features**
→ Read `docs/NEXT_STEPS.md`  
→ Step-by-step with code examples  
→ Phased implementation guide

#### **Look up commands or troubleshoot**
→ Use `docs/QUICK_REFERENCE.md`  
→ Cheat sheet for daily work  
→ All commands, ports, endpoints

#### **Review development history**
→ See `docs/_analysis/` directory  
→ Time-stamped analysis from development sessions

---

## 📑 **All Documentation Files**

### Root Level
- **`README.md`** - Project overview, philosophy, getting started
- **`DOCS_INDEX.md`** - This file (navigation guide)

### `/docs` Directory

| File | Size | Purpose | When to Read |
|------|------|---------|--------------|
| **README.md** | 8KB | Complete overview | Start here |
| **PROJECT_STATUS.md** | 31KB | Full analysis | Deep dive |
| **NEXT_STEPS.md** | 11KB | Action plan | Before coding |
| **QUICK_REFERENCE.md** | 6KB | Daily cheat sheet | Daily use |
| File | Purpose | When to Read |
|------|---------|--------------|
| **README.md** | Overview and development context | Start here |
| **NEXT_STEPS.md** | Implementation guide | Before coding |
| **QUICK_REFERENCE.md** | Daily cheat sheet | Daily use |
| **ARCHITECTURE.md** | System design | Understanding flow |
| **milestone-01-local-stack.md** | Infrastructure setup | Historical |
| **milestone-03-console-mvp.md** | Current milestone | Context |
| **_analysis/** | Time-stamped development notes | Reference only |

---

## 🎓 **Learning Path**

### For New Team Members
1. Read root `README.md`
2. Read `docs/ARCHITECTURE.md`
3. Try Quick Start above
4. Bookmark `docs/QUICK_REFERENCE.md`

### For Continuing Development
1. Read `docs/NEXT_STEPS.md` - Implementation guide
2. Use `docs/QUICK_REFERENCE.md` as needed
3. Refer to `docs/_analysis/` for historical context if needed

---

## 🔍 **Quick Reference Table**

| Need | File | Section |
|------|------|---------|
| Start services | `docs/QUICK_REFERENCE.md` | "Start Everything" |
| API endpoints | `docs/QUICK_REFERENCE.md` | "API Endpoints" |
| Architecture | `docs/ARCHITECTURE.md` | All diagrams |
| What's broken | `docs/PROJECT_STATUS.md` | "Current Issues & Gaps" |
| Next tasks | `docs/NEXT_STEPS.md` | Any phase |
| System design | `docs/ARCHITECTURE.md` | All diagrams |
| Data flow | `docs/ARCHITECTURE.md` | "Data Flow" |
| Troubleshooting | `docs/QUICK_REFERENCE.md` | "Troubleshooting" |
| Philosophy | Root `README.md` | "Development Philosophy" |
| Vision | Root `README.md` | "Long-Term Vision" |

---

## ✅ **What's Working Right Now**

Based on implemented code:
- ✅ Agent Runner API (REST endpoints)
- ✅ Console UI (home + run detail pages)
- ✅ Database (SQLite with 3 tables)
- ✅ Environment config
- ✅ API connections with CORS
- ✅ Infrastructure (Forgejo + Taiga)

---

## 🚧 **What Needs Work**

Known gaps:
- ❌ Agent execution (runs tracked but don't execute)
- ❌ LLM integration (Ollama connection)
- ❌ File operations (can't modify repos)
- ❌ Creation UIs (can't create from web)
- ❌ Git integration (no branch management)
- ❌ Auto-refresh (must reload manually)

**See `docs/NEXT_STEPS.md` for implementation guide**

---

## 🚀 **Your Next Move**

### Right Now
Test the current setup:
```bash
# See "Quick Start" at top of this file
```

### Next Steps
Choose your development path:
- Polish UI - Add creation forms (Phase 2)
- Core execution - Implement agent loop (Phase 3)

See `docs/NEXT_STEPS.md` for detailed implementation guide.

---

## 💬 **Need Help?**

**For quick lookups:**  
→ `docs/QUICK_REFERENCE.md`

**For understanding:**  
→ `docs/PROJECT_STATUS.md`

**For implementing:**  
→ `docs/NEXT_STEPS.md`

**For debugging:**  
→ `docs/QUICK_REFERENCE.md` → Troubleshooting section

---

## 📌 **Bookmark These**

Most useful for daily work:
1. `docs/QUICK_REFERENCE.md` - Commands and API
2. `docs/NEXT_STEPS.md` - Implementation guide
3. Root `README.md` - Project philosophy

Most useful for understanding:
1. `docs/ARCHITECTURE.md` - Technical design
2. `docs/README.md` - Overview and context
3. `docs/_analysis/` - Historical development notes

---

*Start with the Quick Start section above, then explore based on what you need!*
