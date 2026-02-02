#!/bin/bash
#
# Demo script showing model override functionality
# This demonstrates how to use lighter models instead of the heavy defaults
#

set -e

API_URL="${API_URL:-http://localhost:8000}"

echo "=================================================="
echo "Model Override Demo for Agent Runner"
echo "=================================================="
echo ""

# Check if server is running
if ! curl -s "${API_URL}/worker/status" > /dev/null 2>&1; then
    echo "❌ Error: Agent Runner server is not running at ${API_URL}"
    echo "   Start the server first: cd agent-runner && uvicorn app.main:app"
    exit 1
fi

echo "✓ Server is running at ${API_URL}"
echo ""

# Create a project
echo "1. Creating demo project..."
PROJECT_ID=$(curl -s -X POST "${API_URL}/projects?name=model-override-demo&local_path=/tmp/model-override-demo" \
    | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "   ✓ Project created with ID: ${PROJECT_ID}"
echo ""

# Create run with model overrides
echo "2. Creating workflow run with lightweight model overrides..."
echo "   Default models: gemma3:27b (18GB) and qwen3-coder:latest"
echo "   Override models: llama2:latest and codellama:latest (lighter)"
echo ""

RUN_ID=$(curl -s -X POST "${API_URL}/runs" \
    -H "Content-Type: application/json" \
    -d '{
        "project_id": '"${PROJECT_ID}"',
        "goal": "Generate Quarkus project with lightweight models",
        "run_type": "workflow",
        "options": {
            "workflow": "quarkus-bootstrap-v1",
            "models": {
                "planner": "llama2:latest",
                "coder": "codellama:latest"
            },
            "timeout_seconds": 900
        }
    }' | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "   ✓ Run created with ID: ${RUN_ID}"
echo ""

# Trigger processing
echo "3. Triggering workflow processing..."
curl -s -X POST "${API_URL}/worker/process" > /dev/null
echo "   ✓ Processing triggered"
echo ""

echo "=================================================="
echo "Demo run created successfully!"
echo "=================================================="
echo ""
echo "Run ID: ${RUN_ID}"
echo "Project path: /tmp/model-override-demo"
echo ""
echo "Monitor progress:"
echo "  API: curl ${API_URL}/runs/${RUN_ID}/events | jq"
echo "  UI:  http://localhost:3001 (if console is running)"
echo ""
echo "Expected events will show:"
echo "  - 'Create project plan using llama2' (instead of 'using Gemma3')"
echo "  - 'Loading model: llama2:latest' (instead of 'gemma3:27b')"
echo "  - 'Generate Maven Quarkus project using codellama' (instead of 'using Qwen3')"
echo ""
echo "To view events in real-time:"
echo "  watch -n 2 \"curl -s ${API_URL}/runs/${RUN_ID}/events | jq '.[] | {type, payload}'\""
echo ""
