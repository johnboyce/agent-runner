#!/bin/bash
# Demo script to show how to create and execute a Quarkus bootstrap workflow run

set -e

API_URL="${AGENT_RUNNER_URL:-http://localhost:8000}"

echo "🚀 Quarkus Bootstrap Workflow Demo"
echo "===================================="
echo ""
echo "API URL: $API_URL"
echo ""

# 1. Create project
echo "1. Creating project..."
PROJECT_RESPONSE=$(curl -s -X POST "${API_URL}/projects?name=quarkus-demo&local_path=/tmp/quarkus-demo")
PROJECT_ID=$(echo $PROJECT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "✅ Project created with ID: $PROJECT_ID"
echo "   Path: /tmp/quarkus-demo"
echo ""

# 2. Create workflow run
echo "2. Creating workflow run..."
RUN_RESPONSE=$(curl -s -X POST "${API_URL}/runs" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": $PROJECT_ID,
    \"goal\": \"Generate Quarkus GraphQL + OpenTelemetry project\",
    \"run_type\": \"workflow\",
    \"options\": {\"workflow_name\": \"quarkus-bootstrap-v1\"}
  }")

RUN_ID=$(echo $RUN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "✅ Workflow run created with ID: $RUN_ID"
echo ""
echo "Run details:"
echo $RUN_RESPONSE | python3 -m json.tool
echo ""

# 3. Show how to trigger execution (requires worker or manual trigger)
echo "3. Workflow execution:"
echo "   The workflow is now QUEUED and will execute when:"
echo "   a) Background worker is enabled (default)"
echo "   b) Manual trigger via: POST ${API_URL}/worker/process"
echo ""
echo "   To manually trigger processing now:"
echo "   curl -X POST ${API_URL}/worker/process"
echo ""

# 4. Show how to check events
echo "4. View run progress:"
echo "   GET ${API_URL}/runs/${RUN_ID}"
echo "   GET ${API_URL}/runs/${RUN_ID}/events"
echo ""
echo "   Console UI: http://localhost:3001"
echo ""

echo "📋 Expected workflow steps:"
echo "   1. Planner (gemma3:27b) - Creates PLAN.md"
echo "   2. Coder (qwen3-coder:latest) - Generates Maven Quarkus project"
echo "   3. Maven test - Runs 'mvn test' and saves output"
echo ""

echo "📁 Generated files will be in: /tmp/quarkus-demo/"
echo ""

echo "✅ Demo complete!"
echo ""
echo "Note: Workflow requires Ollama to be running at ${OLLAMA_BASE_URL:-http://localhost:11434}"
echo "      Install Ollama: https://ollama.ai"
echo "      Pull models: ollama pull gemma3:27b && ollama pull qwen3-coder:latest"
