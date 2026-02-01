#!/bin/bash
# Test script for the enhanced Create Run API

API_URL="${AGENT_RUNNER_URL:-http://localhost:8000}"

echo "🧪 Testing Enhanced Create Run API"
echo "===================================="
echo ""

# 1. Create a test project
echo "1. Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST "${API_URL}/projects?name=test-enhanced-run&local_path=/tmp/test-enhanced")
PROJECT_ID=$(echo $PROJECT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "✅ Project created with ID: $PROJECT_ID"
echo ""

# 2. Create a basic run (minimal)
echo "2. Creating basic run (minimal fields)..."
curl -s -X POST "${API_URL}/runs" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": $PROJECT_ID,
    \"goal\": \"Test basic run creation\"
  }" | python3 -m json.tool
echo ""

# 3. Create a fully-featured run
echo "3. Creating enhanced run (all fields)..."
curl -s -X POST "${API_URL}/runs" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": $PROJECT_ID,
    \"name\": \"My Custom Run Name\",
    \"goal\": \"Test all the enhanced features\",
    \"run_type\": \"workflow\",
    \"options\": {
      \"dry_run\": true,
      \"verbose\": true,
      \"max_steps\": 10
    },
    \"metadata\": {
      \"priority\": \"high\",
      \"environment\": \"staging\",
      \"tags\": [\"test\", \"enhanced\"]
    }
  }" | python3 -m json.tool
echo ""

# 4. List all runs
echo "4. Listing all runs..."
curl -s "${API_URL}/runs" | python3 -m json.tool | head -50
echo ""

echo "✅ API test complete!"
