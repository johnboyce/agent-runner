# Analysis Archive

This directory contains **time-stamped analysis and troubleshooting documents** from development sessions.

## Purpose

**For future developers and AI assistants:**

This archive preserves the reasoning, problem-solving, and decision-making context from specific development sessions. When returning to this project after time away, or when onboarding new team members (human or AI), these documents provide:

- **Historical context** - Why certain decisions were made
- **Problem resolution patterns** - How issues were diagnosed and fixed
- **Development evolution** - How the system progressed over time
- **Troubleshooting guides** - Solutions to specific problems encountered

## Important Notes

⚠️ **Analysis files are NOT committed to git by default:**
- This directory structure is tracked (via this README)
- Individual analysis markdown files are gitignored
- This keeps the repo clean while preserving local context
- You can explicitly commit important analysis if needed with `git add -f`

⚠️ **These documents are snapshots, not living documentation:**
- They reflect specific moments in time
- They are NOT kept current
- They may reference code that has since changed
- Use them for context, not as current instructions

✅ **For current, maintained documentation, see `/docs` (parent directory)**

## When to Add Here

Add new time-stamped analysis documents when:
- Completing a major debugging session
- Receiving significant code reviews
- Making architectural decisions that need context
- Solving complex problems that may recur

**Naming convention:** `DESCRIPTION_YYYY-MM-DD.md`

Analysis files will remain local unless explicitly committed.

## Example Contents

Your local `_analysis/` directory might contain:
- `PROJECT_STATUS_2026-01-31.md` - Project analysis snapshot
- `ANALYSIS_SUMMARY_2026-01-31.md` - Session summary
- `CODE_REVIEW_FIXES_2026-01-31.md` - Review resolutions
- `FIX_LOADING_ISSUE_2026-01-31.md` - CORS troubleshooting
- `ISSUE_RESOLUTION_CORS_2026-01-31.md` - Detailed fix docs

These stay on your machine for reference but don't bloat the repository.

---

**For AI assistants working on this project:**

When starting a new session:
1. Check this local directory for recent analysis files
2. Use them to understand recent context and decisions
3. Add your own analysis files here for continuity
4. These files help maintain context across sessions without cluttering git history

This directory serves as your "session memory" - local, useful, but not in the permanent record.
