# Auto Sync Policy (VPS + Localhost + GitHub)

This repository now uses automatic sync scripts so GitHub stays the latest source of truth.

## Policy
1. Work directly only on `main`.
2. Keep auto-sync running on both VPS and localhost.
3. Do not edit during unresolved merge/rebase conflicts.
4. If auto-sync reports rebase conflict, resolve manually, then continue.

## What is configured
- `scripts/sync-now.sh` (Linux/VPS): add/commit/push current changes.
- `scripts/sync-now.ps1` (Windows): add/commit/push current changes.
- `scripts/auto-sync-loop.sh`: runs sync every 15 minutes by default.
- `scripts/auto-sync-loop.ps1`: runs sync every 15 minutes by default.
- `.githooks/post-commit`: pushes right after each manual commit.

## Manual sync commands
- VPS/Linux:
  - `bash scripts/sync-now.sh`
- Windows PowerShell:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-now.ps1`

## Continuous auto-sync commands
- VPS/Linux:
  - `INTERVAL_SECONDS=900 bash scripts/auto-sync-loop.sh`
- Windows PowerShell:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\auto-sync-loop.ps1 -IntervalSeconds 900`

## Safety notes
- `.env` remains ignored by git.
- Auto-sync creates timestamped commits: `chore(sync): auto-sync ...`.
- If push is rejected, script tries `git pull --rebase` then push.
