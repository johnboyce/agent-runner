# TASKS (Single Source of Truth)

This file defines the platform work required to finish **agent-runner**.
Workflows like `quarkus-bootstrap-v1` are treated as demos/regression fixtures, not core deliverables.

Rules:
- Only implement items under **Now**.
- If new ideas come up, put them in **INBOX.md** and propose them for triage.
- Keep **Now** to 1–2 items max.

---

## Now (Platform stability + completeness)

### 1) Define and enforce run/step state invariants
**Goal:** Make run + step state monotonic and consistent across API, worker, UI.

**DoD**
- Run status transitions are monotonic: QUEUED → RUNNING → (COMPLETED | FAILED | CANCELED)
- Step state never regresses (no completed → running)
- Events are strictly append-only and ordered by id
- Tests cover the invariants

**Notes**
- This is platform correctness; workflows are just inputs.

---

### 2) Standardize artifacts as first-class outputs (design first, implement minimal)
**Goal:** Every run can produce artifacts with metadata and retrieval.
We will *not* pick a final storage backend yet—start with a minimal abstraction.

**DoD**
- Artifact metadata model exists (id, run_id, name, kind, path or uri, created_at)
- API can list artifacts for a run (`GET /runs/{id}/artifacts`)
- UI can display artifacts list (even if download is v2)
- Tests cover artifact creation + listing

**Notes**
- Keep storage abstract: local filesystem ok for now.

---

## Next (Once Now is done)

- [ ] Add run cancellation (`POST /runs/{id}/cancel`) with cooperative worker checks
- [ ] Add LLM heartbeat events during long generations (great with SSE)
- [ ] Add workflow discovery endpoints (`GET /workflows`, `GET /workflows/{name}`)
- [ ] Add health endpoints (`/healthz`, `/readyz`) and basic deployment docs

---

## Later (Productization)

- [ ] Persistence strategy decision (SQLite/Postgres) + migrations
- [ ] Artifact download endpoint + durable artifact storage options
- [ ] Auth (optional)
- [ ] Provider abstraction growth (Ollama + future providers)
