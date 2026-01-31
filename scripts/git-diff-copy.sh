#!/bin/bash
# Helper script to show git diff and copy to clipboard
# Usage: ./scripts/git-diff-copy.sh [options]

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Generating git diff...${NC}"

# Generate the diff
DIFF_OUTPUT=$(git diff --cached 2>&1)

if [ -z "$DIFF_OUTPUT" ]; then
    echo "No staged changes to diff"
    exit 0
fi

# Show statistics
echo -e "\n${GREEN}Files changed:${NC}"
git diff --cached --stat

# Count lines
LINES=$(echo "$DIFF_OUTPUT" | wc -l)
echo -e "\n${GREEN}Total diff lines: ${LINES}${NC}"

# Copy to clipboard
echo "$DIFF_OUTPUT" | pbcopy

echo -e "\n${GREEN}✅ Diff copied to clipboard!${NC}"
echo -e "Paste with ${BLUE}Cmd+V${NC} or run ${BLUE}pbpaste${NC} to see it"

# Optionally save to file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="/tmp/git-diff-${TIMESTAMP}.txt"
echo "$DIFF_OUTPUT" > "$FILENAME"
echo -e "Also saved to: ${BLUE}${FILENAME}${NC}"
