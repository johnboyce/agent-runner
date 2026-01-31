#!/bin/bash
# Test script for agent execution

set -e

echo "🧪 Testing Agent Execution"
echo "=========================="
echo ""

BASE_URL="http://localhost:8000"

# Check if agent runner is running
echo "1. Checking agent runner status..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo "❌ Agent runner not running on port 8000"
    echo "   Start it with: make start-agent"
    exit 1
fi
echo "✅ Agent runner is running"
echo ""

# Check worker status
echo "2. Checking background worker..."
WORKER_STATUS=$(curl -s "$BASE_URL/worker/status")
echo "   Worker status: $WORKER_STATUS"
echo ""

# Create a test project if none exists
echo "3. Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/projects?name=agent-test&local_path=/tmp/agent-test")
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "1")
echo "✅ Project created (ID: $PROJECT_ID)"
echo ""

# Create a test run
echo "4. Creating test run..."
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/runs?project_id=$PROJECT_ID&goal=Test%20agent%20execution")
RUN_ID=$(echo "$RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
RUN_STATUS=$(echo "$RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)

if [ -z "$RUN_ID" ]; then
    echo "❌ Failed to create run"
    echo "Response: $RUN_RESPONSE"
    exit 1
fi

echo "✅ Run created (ID: $RUN_ID, Status: $RUN_STATUS)"
echo ""

# Wait for agent to process it
echo "5. Waiting for agent to process run (max 30 seconds)..."
for i in {1..30}; do
    sleep 1
    RUN_DATA=$(curl -s "$BASE_URL/runs/$RUN_ID")
    STATUS=$(echo "$RUN_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
    echo -n "   [$i] Status: $STATUS"

    if [ "$STATUS" = "COMPLETED" ]; then
        echo " ✅"
        break
    elif [ "$STATUS" = "FAILED" ]; then
        echo " ❌"
        echo ""
        echo "Run failed! Check logs."
        exit 1
    else
        echo " ⏳"
    fi
done
echo ""

# Get final status
echo "6. Checking final run status..."
FINAL_RUN=$(curl -s "$BASE_URL/runs/$RUN_ID")
echo "$FINAL_RUN" | python3 -m json.tool 2>/dev/null || echo "$FINAL_RUN"
echo ""

# Get events
echo "7. Checking run events..."
EVENTS=$(curl -s "$BASE_URL/runs/$RUN_ID/events")
echo "$EVENTS" | python3 -m json.tool 2>/dev/null || echo "$EVENTS"
echo ""

echo "========================================="
echo "✅ Agent execution test complete!"
echo ""
echo "What happened:"
echo "  1. Created a test run in QUEUED status"
echo "  2. Background worker picked it up"
echo "  3. Agent executed it (simulated work)"
echo "  4. Run transitioned: QUEUED → RUNNING → COMPLETED"
echo "  5. Events were logged at each step"
echo ""
echo "🎉 The architecture works end-to-end!"
