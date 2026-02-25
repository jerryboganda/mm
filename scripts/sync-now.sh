#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[sync-now] Not a git repository: $REPO_ROOT"
  exit 1
fi

# Skip if git operation is in progress.
if [[ -d .git/rebase-merge || -d .git/rebase-apply || -f .git/MERGE_HEAD || -f .git/CHERRY_PICK_HEAD ]]; then
  echo "[sync-now] Git operation in progress. Skipping."
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  echo "[sync-now] Detached HEAD. Skipping."
  exit 0
fi

git add -A

if ! git diff --cached --quiet; then
  TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  HOST="$(hostname 2>/dev/null || echo unknown-host)"
  git commit -m "chore(sync): auto-sync ${TS} (${HOST})"
fi

if ! git push origin "$BRANCH"; then
  echo "[sync-now] Push failed. Trying rebase + push."
  if git pull --rebase origin "$BRANCH"; then
    git push origin "$BRANCH"
  else
    echo "[sync-now] Rebase failed. Resolve conflicts manually."
    exit 1
  fi
fi

echo "[sync-now] Synced branch ${BRANCH}"
