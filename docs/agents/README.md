# Agent Tasking Operating Model

This directory (`docs/agents/`) serves as the central coordination point for all development work on the Agent Runner platform. It establishes a clear and enforceable process to prevent "tool/agent drift" and ensure consistent progress.

Our workflow for tasking and tracking work is built around three core documents: `INBOX.md`, `TASKS.md`, and `STATUS.md`.

## The Operating Model

### 📥 `INBOX.md` (Raw Dump / Scratchpad)
- **Purpose**: This is a free-form scratchpad for all new ideas, raw observations, agent outputs, logs, and any unprocessed thoughts related to the platform.
- **Process**: New ideas or findings are initially dumped here without judgment or formatting. It's a place for rapid capture, not organization.
- **Enforcement**: Nothing in `INBOX.md` is considered actionable work. It must be triaged and formally moved to `TASKS.md` before any agent or developer can begin work on it.

### ✅ `TASKS.md` (Single Source of Truth / Project Plan)
- **Purpose**: This document defines all current and future platform development work. It is the **single source of truth** for the project roadmap.
- **Structure**: Tasks are categorized into "Now", "Next", and "Later".
- **Process**:
    - Only tasks explicitly listed under the "Now" section are considered active and can be worked on.
    - New tasks, after being triaged from `INBOX.md`, are prioritized into "Now", "Next", or "Later".
    - Each task must include a clear "Definition of Done" (DoD) and verifiable "Validation Commands".
- **Enforcement**:
    - **No platform code modifications are permitted without a corresponding task in `TASKS.md` under the "Now" section.**
    - The "Now" section must contain a maximum of 1-2 active tasks at any given time to maintain focus.

### 🚦 `STATUS.md` (Run & Verify / Handoff)
- **Purpose**: This document provides a quick overview of the platform's current state, how to run it, and commands to verify its functionality. It acts as a concise handoff document.
- **Content**: Includes canonical commands for starting services, running tests, and checking system health. It also summarizes what's currently working and any known critical issues or follow-ups.
- **Process**:
    - `STATUS.md` is updated *after* tasks in `TASKS.md` are completed and verified, reflecting the new operational state of the platform.
    - All commands listed must be directly executable and align with the project's `Makefile` or standard practices.
- **Enforcement**:
    - The information in `STATUS.md` **must always be accurate and up-to-date** with the deployed or most recently stable state of the platform.
    - Any changes to core operational commands (e.g., in `Makefile`) must be reflected here.
