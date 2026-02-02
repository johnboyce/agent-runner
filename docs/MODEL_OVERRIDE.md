# Model Override Feature - Quick Reference

## Overview

The agent-runner now supports flexible model selection for workflow execution through three priority levels:

1. **Per-run options** (highest priority)
2. **Environment variables** (medium priority)  
3. **Workflow defaults** (lowest priority)

This allows you to use lighter/faster models instead of heavy defaults like gemma3:27b (18GB).

## Usage Examples

### Option 1: Override via API Request

```bash
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "goal": "Generate Quarkus project",
    "run_type": "workflow",
    "options": {
      "workflow": "quarkus-bootstrap-v1",
      "models": {
        "planner": "llama2:latest",
        "coder": "codellama:latest"
      },
      "timeout_seconds": 900
    }
  }'
```

### Option 2: Override via Environment Variables

```bash
# In .env file or shell
export OLLAMA_PLANNER_MODEL=llama2:latest
export OLLAMA_CODER_MODEL=codellama:latest
export OLLAMA_TIMEOUT_SECONDS=900

# Then create run without model overrides - env vars will be used
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "goal": "Generate Quarkus project",
    "run_type": "workflow",
    "options": {
      "workflow": "quarkus-bootstrap-v1"
    }
  }'
```

### Option 3: Use Defaults

```bash
# No overrides - uses gemma3:27b and qwen3-coder:latest
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "goal": "Generate Quarkus project",
    "run_type": "workflow",
    "options": {
      "workflow": "quarkus-bootstrap-v1"
    }
  }'
```

## Event Changes

When using model overrides, the event messages reflect the chosen model:

### Before (default gemma3:27b)
```
"Create project plan using Gemma3"
"Loading model: gemma3:27b"
```

### After (with llama2 override)
```
"Create project plan using llama2"
"Loading model: llama2:latest"
```

## Configuration Priority

The system checks for models in this order:

1. `options.models.planner` / `options.models.coder` in the run request
2. `OLLAMA_PLANNER_MODEL` / `OLLAMA_CODER_MODEL` environment variables
3. Hardcoded defaults in workflow definition

This means:
- Request options always win
- Env vars are used if no request options
- Defaults are used if neither is specified

## Timeout Configuration

Similar priority for timeouts:

1. `options.timeout_seconds` in run request (highest)
2. `OLLAMA_TIMEOUT_SECONDS` environment variable
3. Default: 300 seconds

## Use Cases

### Resource-Constrained Systems
Use lighter models on systems with limited RAM:
```json
{
  "models": {
    "planner": "llama2:latest",      // ~4GB instead of 18GB
    "coder": "codellama:7b"           // ~4GB instead of default
  }
}
```

### Testing
Quickly test with small models:
```json
{
  "models": {
    "planner": "tinyllama:latest",
    "coder": "tinyllama:latest"
  },
  "timeout_seconds": 60
}
```

### Production
Use larger models for better quality:
```json
{
  "models": {
    "planner": "gemma3:27b",
    "coder": "qwen3-coder:32b"
  },
  "timeout_seconds": 1800
}
```

## Demo Script

Run the included demo script to see the feature in action:

```bash
./scripts/demo-model-override.sh
```

This creates a workflow run with lightweight model overrides and shows how to monitor the events.

## Testing

All tests pass (60 total):
```bash
cd agent-runner
pytest tests/test_workflows.py -v
pytest tests/test_model_override_integration.py -v
```

## Backward Compatibility

This feature is **100% backward compatible**:
- Existing runs without model overrides work exactly as before
- Default behavior unchanged if no overrides specified
- All existing tests pass
