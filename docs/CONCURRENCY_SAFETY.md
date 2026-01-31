# Concurrency & Production Readiness

## Critical Fixes Applied (January 31, 2026)

This document explains the concurrency and production-readiness improvements made to the agent execution system.

---

## 1. Atomic Run Claiming ✅

**Problem:** With uvicorn `--reload` or `--workers > 1`, multiple processes could pick up the same QUEUED run and execute it twice.

**Solution:** Atomic claim using conditional database update.

```python
# Old (unsafe):
run = db.query(Run).filter(Run.id == run_id).first()
if run.status == "QUEUED":
    run.status = "RUNNING"
    db.commit()

# New (safe):
updated = db.query(Run).filter(
    Run.id == run_id,
    Run.status == "QUEUED"
).update(
    {"status": "RUNNING", "current_iteration": 0},
    synchronize_session=False
)
db.commit()

if updated != 1:
    # Someone else claimed it first
    return False
```

**Benefits:**
- ✅ Safe with multiple workers
- ✅ Safe with `--reload` mode
- ✅ Foundation for future scale-out
- ✅ No risk of double execution

---

## 2. Transaction Consistency ✅

**Problem:** Events were committed independently from status changes. A status update could succeed while an event insert failed (or vice versa), leaving inconsistent state.

**Solution:** Batch events and status updates in single transactions.

**Old pattern:**
```python
run.status = "RUNNING"
db.commit()
_log_event(...)  # This commits internally
```

**New pattern:**
```python
run.status = "RUNNING"
_log_event(...)  # Add event, no commit
db.commit()  # Commit both together
```

**Benefits:**
- ✅ Consistent database state
- ✅ Fewer commits = better performance
- ✅ Events always match run status
- ✅ Proper rollback on errors

---

## 3. Clean Shutdown ✅

**Problem:** Worker thread was daemon and would be killed when process exited, with no cleanup.

**Solution:** Added shutdown hook to stop worker gracefully.

```python
@app.on_event("shutdown")
async def shutdown_event():
    stop_worker()
    logging.info("Agent runner shutting down")
```

**Benefits:**
- ✅ Clean resource cleanup
- ✅ Proper thread termination
- ✅ Foundation for future resource management (locks, connections)
- ✅ Better for testing and development

---

## 4. Configurable Check Interval ✅

**Problem:** Check interval was hardcoded to 5 seconds.

**Solution:** Environment variable `WORKER_CHECK_INTERVAL`.

```bash
# Default: 5 seconds
make start-agent

# Fast polling for testing
WORKER_CHECK_INTERVAL=1 make start-agent

# Slow polling for production
WORKER_CHECK_INTERVAL=10 make start-agent
```

**Benefits:**
- ✅ Tune for your workload
- ✅ Fast iteration during development
- ✅ Conserve resources in production
- ✅ No code changes needed

---

## 5. Portable Clipboard Copy ✅

**Problem:** `pbcopy` is macOS-only, making `make git-diff` fail on Linux.

**Solution:** Fallback chain for clipboard operations.

```bash
git diff | (pbcopy 2>/dev/null || xclip -selection clipboard 2>/dev/null || true)
```

**Benefits:**
- ✅ Works on macOS (pbcopy)
- ✅ Works on Linux (xclip)
- ✅ Fails gracefully if neither available
- ✅ Still saves to `/tmp/git-diff-latest.txt`

---

## Production Deployment Notes

### Multi-Worker Setup

**Safe to use now:**
```bash
# Multiple workers - safe due to atomic claiming
uvicorn app.main:app --workers 4 --port 8000
```

**Each worker will:**
- Start its own background thread
- Poll for QUEUED runs
- Atomically claim runs (only one worker succeeds)
- Process independently

### Scaling Considerations

**Current approach handles:**
- Multiple workers on same machine ✅
- Multiple machines with shared database ✅ (SQLite won't work for this)
- Horizontal scaling with proper DB ✅

**For true multi-machine:**
- Use PostgreSQL instead of SQLite
- Atomic claim pattern already works
- Consider adding `SELECT ... FOR UPDATE SKIP LOCKED` (Postgres-specific, even better)

### Database Backends

**SQLite (current):**
- ✅ Fine for single machine
- ✅ Works with multiple workers (atomic updates)
- ❌ Cannot share across machines

**PostgreSQL (future):**
- ✅ Full multi-machine support
- ✅ Better concurrency primitives
- ✅ `FOR UPDATE SKIP LOCKED` for even better performance

```python
# PostgreSQL-optimized claim (future):
run = db.query(Run).filter(
    Run.id == run_id,
    Run.status == "QUEUED"
).with_for_update(skip_locked=True).first()

if run:
    run.status = "RUNNING"
    db.commit()
```

---

## Testing Concurrency

### Test 1: Restart Worker While Processing

```bash
# Terminal 1: Start agent runner
make start-agent

# Terminal 2: Create a long-running test
curl -X POST "http://localhost:8000/runs?project_id=1&goal=Long%20test"

# Terminal 1: Ctrl+C and restart
# Observe: Run completes or restarts cleanly, not duplicated
```

### Test 2: Manual Process Trigger During Execution

```bash
# While worker is processing a run
curl -X POST "http://localhost:8000/worker/process"

# Result: No double execution (claim prevents it)
```

### Test 3: Multiple Workers (Future)

```bash
# Start with multiple workers
uvicorn app.main:app --workers 4

# Create multiple runs
for i in {1..10}; do
  curl -X POST "http://localhost:8000/runs?project_id=1&goal=Test%20$i"
done

# Result: Each run processed exactly once
```

---

## Migration Path to Celery/RQ (Future)

The current design is **ready** for migration to a proper task queue:

**Current:**
- Background thread polls database
- Executes runs synchronously
- Works great for MVP

**Future with Celery:**
```python
@celery_app.task
def execute_run_task(run_id: int):
    agent = SimpleAgent()
    agent.execute_run(run_id)

# Worker finds QUEUED run
execute_run_task.delay(run_id)
```

**Benefits of migration:**
- Better concurrency (true parallel execution)
- Retry logic built-in
- Better monitoring
- Distributed across machines

**When to migrate:**
- When runs take >30 seconds
- When you need parallel execution
- When you outgrow single-machine

---

## Summary

**Before these fixes:**
- ❌ Double execution possible with multiple workers
- ❌ Inconsistent database state possible
- ❌ No clean shutdown
- ❌ Hardcoded polling interval

**After these fixes:**
- ✅ Safe for multi-worker deployment
- ✅ Consistent database transactions
- ✅ Clean shutdown hooks
- ✅ Configurable via environment
- ✅ Ready for production use
- ✅ Foundation for future scaling

**Next steps for production:**
- Consider PostgreSQL for multi-machine
- Add retry logic for failed runs
- Add run timeout detection
- Add metrics/monitoring
- Consider Celery for long-running tasks

---

**Status:** Production-ready for single-machine deployment  
**Multi-worker:** ✅ Safe  
**Multi-machine:** ✅ Safe (with PostgreSQL)  
**Scale-out ready:** ✅ Yes
