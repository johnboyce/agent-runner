# Agent Runner API - Bruno Collection

This directory contains a [Bruno](https://www.usebruno.com/) API collection for testing and interacting with the Agent Runner API.

## What is Bruno?

Bruno is an open-source, Git-friendly API client similar to Postman but stores collections as plain text files that can be version controlled. It's lightweight, fast, and privacy-focused (no cloud sync required).

## Installation

### Option 1: Desktop App (Recommended)
Download Bruno from [https://www.usebruno.com/downloads](https://www.usebruno.com/downloads)

### Option 2: CLI (for CI/CD)
```bash
npm install -g @usebruno/cli
```

## Usage

### With Bruno Desktop App

1. **Open Collection**
   - Launch Bruno
   - Click "Open Collection"
   - Navigate to this `bruno` directory and select it

2. **Select Environment**
   - In Bruno, select the "local" environment from the environment dropdown
   - This sets `baseUrl` to `http://localhost:8000`

3. **Start the Agent Runner API**
   ```bash
   # From the repository root
   make start-agent
   ```

4. **Run Requests**
   - Browse through the folders (Projects, Runs, Worker)
   - Click on any request to view/edit it
   - Click "Send" to execute the request
   - View the response in the right panel

### With Bruno CLI

```bash
# Run all requests in the collection
bru run --env local

# Run a specific folder
bru run --env local --folder Projects

# Run a specific request
bru run --env local --filename "Projects/Create Project.bru"
```

## Collection Structure

```
bruno/
├── bruno.json                    # Collection metadata
├── collection.bru                # Collection configuration
├── environments/
│   └── local.bru                 # Local environment variables
├── Health Check.bru              # Health check endpoint
├── Projects/
│   ├── Create Project.bru        # POST /projects
│   └── List Projects.bru         # GET /projects
├── Runs/
│   ├── Create Run.bru            # POST /runs
│   ├── List Runs.bru             # GET /runs
│   ├── Get Run Details.bru       # GET /runs/{id}
│   ├── Get Run Events.bru        # GET /runs/{id}/events
│   ├── Send Directive to Run.bru # POST /runs/{id}/directive
│   ├── Pause Run.bru             # POST /runs/{id}/pause
│   ├── Resume Run.bru            # POST /runs/{id}/resume
│   └── Stop Run.bru              # POST /runs/{id}/stop
└── Worker/
    ├── Get Worker Status.bru     # GET /worker/status
    └── Trigger Worker Processing.bru # POST /worker/process
```

## API Endpoints Overview

### Projects
- **Create Project**: Add a new project to track
- **List Projects**: Get all registered projects

### Runs
- **Create Run**: Start a new agent run with a goal
- **List Runs**: View all runs (most recent first)
- **Get Run Details**: View specific run information
- **Get Run Events**: View logs and events for a run
- **Send Directive**: Send instructions to a running agent
- **Pause/Resume/Stop Run**: Control run execution

### Worker
- **Get Worker Status**: Check if background worker is running
- **Trigger Processing**: Manually trigger run processing

## Quick Start Example

1. **Create a Project**
   ```
   POST /projects?name=my-project&local_path=/path/to/project
   ```

2. **Create a Run**
   ```json
   POST /runs
   {
     "project_id": 1,
     "goal": "Add unit tests for the user service",
     "run_type": "agent",
     "options": {
       "verbose": true,
       "max_steps": 50
     }
   }
   ```

3. **Monitor Progress**
   ```
   GET /runs/1
   GET /runs/1/events
   ```

4. **Control the Run**
   ```
   POST /runs/1/pause
   POST /runs/1/resume
   POST /runs/1/stop
   ```

## Customizing Environments

You can create additional environments (e.g., `production.bru`, `staging.bru`) in the `environments/` directory:

```
vars {
  baseUrl: https://api.example.com
  apiKey: your-api-key
}
```

## Tips

- **Request IDs**: Update the run_id in URLs (e.g., `/runs/1`) to match your actual run IDs
- **Project Paths**: Update the `local_path` parameter in "Create Project" to match your system
- **Metadata**: Customize the `metadata` field in "Create Run" to track whatever you need
- **Documentation**: Each request has a `docs` section explaining parameters and responses

## OpenAPI/Swagger

The API also has auto-generated documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Support

For issues or questions:
- Agent Runner: See main repository README
- Bruno: https://docs.usebruno.com/
