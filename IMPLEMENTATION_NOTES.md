# Implementation Notes: LLM Timeout and Heartbeat Improvements

## Summary
This PR implements two critical improvements to address LLM timeout issues and provide better visibility during long-running operations:

1. **Step-level timeout configuration** - Different workflow steps can now have different timeout values
2. **Heartbeat events** - Periodic progress updates are emitted during LLM generation to show the system is still alive

## Changes Made

### 1. Step-Level Timeout Configuration

#### Problem
Previously, all workflow steps shared a single global timeout value (300 seconds by default). This meant that complex code generation tasks (which can take 10-30 minutes) would timeout prematurely, while simple planning tasks would have unnecessarily long timeouts.

#### Solution
- Added `timeout` field to `WorkflowStep` dataclass (optional, defaults to engine-level timeout)
- Updated `WorkflowEngine._execute_llm_step()` to use step-specific timeout if provided
- Updated the Quarkus workflow definition:
  - **Planner step**: 300 seconds (5 minutes) - suitable for planning tasks
  - **Coder step**: 1800 seconds (30 minutes) - suitable for complex code generation
- Updated `apply_model_overrides()` to preserve timeout settings when applying model overrides

#### Configuration
```python
# In workflow definition
WorkflowStep(
    name="coder",
    step_type=WorkflowStepType.LLM_GENERATE,
    model="qwen3-coder:latest",
    timeout=1800  # 30 minutes for code generation
)
```

### 2. Heartbeat Events During LLM Generation

#### Problem
Long-running LLM operations would appear frozen to users. There was no indication whether the system was:
- Still processing
- Stuck/wedged
- Actually making progress

This was especially problematic with local models like qwen3-coder which can take significant time.

#### Solution
- Added `HEARTBEAT` event type to `EventType` enum in providers.py
- Implemented background heartbeat thread in `OllamaProvider.generate()`:
  - Emits heartbeat events at configurable intervals (default: 15 seconds)
  - Includes elapsed time in heartbeat messages
  - Automatically stops when generation completes or fails
- Added `heartbeat_interval` parameter to:
  - `OllamaProvider.generate()` (default: 15 seconds)
  - `WorkflowEngine` constructor (default: 15 seconds, configurable via env var)
- Updated error messages to include elapsed time for better debugging

#### Configuration
```bash
# In .env file
OLLAMA_HEARTBEAT_INTERVAL=15  # Emit heartbeat every 15 seconds
```

```python
# Programmatically
engine = WorkflowEngine(workspace_path, heartbeat_interval=20)
```

#### Event Format
Heartbeat events are emitted through the SSE stream:
```
event: LLM_HEARTBEAT
data: {"type": "LLM_HEARTBEAT", "payload": "Still waiting on qwen3-coder:latest... 45s elapsed"}
```

### 3. Environment Variables

Added new environment variable:
- `OLLAMA_HEARTBEAT_INTERVAL` - Interval in seconds for heartbeat events (default: 15)

Updated .env.example to include this new variable.

### 4. Comprehensive Test Coverage

Added 13 new tests:
- **Step-Level Timeout Tests** (4 tests):
  - Step-specific timeout overrides engine default
  - Steps without timeout use engine default
  - Quarkus workflow has different timeouts
  - Model overrides preserve timeout settings

- **Heartbeat Event Tests** (9 tests):
  - Heartbeat event type exists
  - Heartbeat events emitted during generation
  - Heartbeat includes elapsed time
  - Heartbeat interval can be disabled (set to 0)
  - Engine passes heartbeat interval to provider
  - Engine respects OLLAMA_HEARTBEAT_INTERVAL env var
  - Engine uses default heartbeat interval
  - Timeout errors include elapsed time
  - Request errors include elapsed time

All 75 tests pass successfully.

## Benefits

### 1. Improved Reliability
- Complex code generation tasks can now run for 30 minutes without timing out
- Planning tasks still have appropriate shorter timeouts
- Each workflow step can be tuned independently

### 2. Better User Experience
- Users can see the system is still working during long operations
- Elapsed time provides feedback on progress
- Clear distinction between "still processing" and "frozen"

### 3. Easier Debugging
- Error messages now include elapsed time
- Heartbeat events help identify when the system actually stalled
- Database event log shows exactly when things happened

### 4. Flexible Configuration
- Timeouts can be configured:
  - Per workflow step (in code)
  - Per workflow engine instance (in code)
  - Globally via environment variables
- Heartbeat interval can be adjusted based on needs

## Backward Compatibility

All changes are backward compatible:
- Existing workflows continue to work with default timeouts
- Heartbeat functionality is additive (doesn't break existing SSE consumers)
- Environment variables have sensible defaults
- No breaking changes to APIs or interfaces

## Future Enhancements

Potential future improvements (not in scope for this PR):
1. Split large coder steps into smaller sub-steps
2. Add progress percentage estimation
3. Support streaming responses from Ollama
4. Add configurable timeout per run (via run options)
5. Add metrics/telemetry for timeout and duration tracking
