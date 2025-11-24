#!/usr/bin/env bash
# Pre-push hook to prevent private files from being pushed to the public remote (upstream)
# List of private paths (relative to repo root) that must never be pushed to upstream
PRIVATE_PATHS=(
  "src/oauth/"
  "README_PRIVATE.md"
  ".env"
)

# Determine which remote is being pushed to
REMOTE_NAME=$(git rev-parse --symbolic-full-name "$1")
REMOTE_NAME=${REMOTE_NAME#refs/heads/}

# If pushing to upstream, check for private files in the push
if [[ "$REMOTE_NAME" == "upstream" ]]; then
  # Get list of files being pushed
  FILES=$(git diff --cached --name-only)
  for PRIVATE in "${PRIVATE_PATHS[@]}"; do
    if echo "$FILES" | grep -q "^$PRIVATE"; then
      echo "ERROR: Attempting to push private path '$PRIVATE' to upstream remote. Push aborted."
      exit 1
    fi
  done
fi

# Allow push
exit 0
