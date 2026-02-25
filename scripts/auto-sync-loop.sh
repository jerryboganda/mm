#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-60}"

while true; do
  if ! "$REPO_ROOT/scripts/sync-now.sh"; then
    echo "[auto-sync-loop] sync-now failed; retrying in ${INTERVAL_SECONDS}s."
  fi
  sleep "$INTERVAL_SECONDS"
done
