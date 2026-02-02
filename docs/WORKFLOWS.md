# Workflow System

The Agent Runner includes a workflow execution system that enables multi-step, LLM-powered automation tasks.

## Overview

Workflows are predefined sequences of steps that can:
- Generate content using LLMs (via Ollama)
- Write files to the project workspace
- Execute shell commands
- Run build tools like Maven

Each workflow step emits events that are tracked in the run timeline, providing full observability.

## Built-in Workflows

### quarkus-bootstrap-v1

Generates a complete Quarkus project with GraphQL and OpenTelemetry support.

**Steps:**
1. **Planner** (gemma3:27b) - Creates a detailed project plan in PLAN.md
2. **Coder** (qwen3-coder:latest) - Generates Maven project files (pom.xml, Java sources, tests)
3. **Maven Test** - Runs `mvn test` and saves output as an artifact

**Requirements:**
- Ollama running at `http://localhost:11434` (configurable via `OLLAMA_BASE_URL`)
- Models installed: `gemma3:27b` and `qwen3-coder:latest`

**Example:**
```bash
# Create project
curl -X POST "http://localhost:8000/projects?name=my-project&local_path=/tmp/my-project"

# Create workflow run
curl -X POST "http://localhost:8000/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "goal": "Generate Quarkus GraphQL + OpenTelemetry project",
    "run_type": "workflow",
    "options": {"workflow_name": "quarkus-bootstrap-v1"}
  }'
```

## Workflow Execution

Workflows execute in the project's `local_path` workspace. All file writes and commands run within this directory.

### Execution Flow

1. Run is created with `run_type: "workflow"` and `workflow_name` in options
2. Background worker picks up the run (or manual trigger via `/worker/process`)
3. Agent routes to workflow executor
4. Workflow engine executes steps sequentially
5. Events are emitted for each step: STEP_STARTED, STEP_COMPLETED, ARTIFACT_CREATED
6. Run completes with COMPLETED or FAILED status

### Event Types

Workflows emit these event types:
- `WORKFLOW_STARTED` - Workflow begins execution
- `WORKFLOW_LOOKUP` - Looking up workflow definition
- `STEP_STARTED` - Individual step begins
- `LLM_LOADING_MODEL` - LLM provider loading model
- `LLM_GENERATING` - LLM generating content
- `LLM_DONE` - LLM generation complete
- `SHELL_EXECUTING` - Shell command running
- `ARTIFACT_CREATED` - File artifact created
- `STEP_COMPLETED` - Individual step completes
- `WORKFLOW_COMPLETED` - Workflow completes successfully
- `WORKFLOW_FAILED` - Workflow failed with error

## Configuration

### Environment Variables

```bash
# Ollama API base URL (default: http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# Default model for planner steps (optional, can be overridden per run)
OLLAMA_PLANNER_MODEL=gemma3:27b

# Default model for coder steps (optional, can be overridden per run)
OLLAMA_CODER_MODEL=qwen3-coder:latest

# Timeout for LLM operations in seconds (default: 300)
OLLAMA_TIMEOUT_SECONDS=300

# Background worker (default: enabled)
DISABLE_WORKER=false

# Worker check interval in seconds (default: 5)
WORKER_CHECK_INTERVAL=5
```

### Model Override Configuration

You can override the default models used by workflow steps in three ways (in priority order):

1. **Per-run options** (highest priority):
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

2. **Environment variables** (medium priority):
```bash
export OLLAMA_PLANNER_MODEL=llama2:latest
export OLLAMA_CODER_MODEL=codellama:latest
export OLLAMA_TIMEOUT_SECONDS=900
```

3. **Workflow defaults** (lowest priority):
   - Defined in the workflow definition itself
   - Used if no overrides are provided

This flexibility allows you to:
- Use lighter/faster models on resource-constrained systems (e.g., llama2 instead of gemma3:27b on an 18GB Mac)
- Test different models without modifying code
- Set system-wide defaults via environment variables
- Override models for specific runs as needed

**Example event changes with model override:**
```
Before: "Create project plan using Gemma3"
        "Loading model: gemma3:27b"

After:  "Create project plan using llama2"
        "Loading model: llama2:latest"
```

### Project Setup

Projects define the workspace where workflows execute:

```python
# Create project with local workspace path
POST /projects?name=my-project&local_path=/tmp/my-project

# All workflow files will be written to /tmp/my-project/
```

## Creating Custom Workflows

See `app/workflows.py` for examples. A workflow consists of:

```python
from app.workflows import Workflow, WorkflowStep, WorkflowStepType

my_workflow = Workflow(
    name="my-workflow-v1",
    version="1.0.0",
    description="My custom workflow",
    steps=[
        WorkflowStep(
            name="generate_plan",
            step_type=WorkflowStepType.LLM_GENERATE,
            description="Generate project plan",
            model="gemma3:27b",
            prompt="Create a project plan for...",
            output_file="PLAN.md",
            save_artifact=True
        ),
        WorkflowStep(
            name="build",
            step_type=WorkflowStepType.SHELL_COMMAND,
            description="Build project",
            command="make build",
            save_artifact=True
        )
    ]
)

# Register workflow
WORKFLOW_REGISTRY["my-workflow-v1"] = my_workflow
```

## Testing

Run workflow tests:
```bash
cd agent-runner
pytest tests/test_workflows.py -v
```

Integration test with mocked Ollama:
```bash
pytest tests/test_workflows.py::TestWorkflowEngine::test_execute_workflow_with_events -v
```

## Observability

All workflow execution is visible in the Console UI:

1. **Run Dashboard** - Shows all workflow runs with status
2. **Run Detail** - Timeline of all events with timestamps
3. **Artifacts** - Links to generated files and command outputs

Events can also be queried via API:
```bash
# Get all events for a run
curl http://localhost:8000/runs/{run_id}/events
```

## Demo

Run the demo script to see workflow creation:
```bash
./scripts/demo-quarkus-workflow.sh
```

This creates a workflow run that will:
1. Generate a Quarkus project plan
2. Create Maven project files
3. Run tests and save output

View progress in the Console UI at http://localhost:3001

## Troubleshooting

### Ollama Connection Failed

```
Error: Ollama API request failed: Connection refused
```

**Solution:** Ensure Ollama is running:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if needed (varies by OS)
# macOS: Open Ollama.app
# Linux: systemctl start ollama
```

### Model Not Found

```
Error: model 'gemma3:27b' not found
```

**Solution:** Pull the required models:
```bash
ollama pull gemma3:27b
ollama pull qwen3-coder:latest
```

### Workflow Not Executing

**Check:**
1. Background worker is enabled (`DISABLE_WORKER` not set to `true`)
2. Run status is `QUEUED` (not `PAUSED` or `STOPPED`)
3. Check logs: `tail -f /tmp/agent-runner.log`

**Manual trigger:**
```bash
curl -X POST http://localhost:8000/worker/process
```

## Architecture

```
┌─────────────┐
│   Console   │
│   (UI/API)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Routes    │
│ (FastAPI)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│   Agent     │─────▶│   Workflow   │
│  Executor   │      │    Engine    │
└─────────────┘      └──────┬───────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
            ┌─────▼──────┐    ┌──────▼───────┐
            │  Ollama    │    │   Shell      │
            │  Provider  │    │   Commands   │
            └────────────┘    └──────────────┘
```

## Future Enhancements

- [ ] Streaming LLM responses
- [ ] Conditional step execution
- [ ] Parallel step execution
- [ ] Workflow templates with parameters
- [ ] Step retry logic
- [ ] Custom step types
- [ ] Workflow versioning and migration
