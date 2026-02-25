param(
  [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Set-Location $RepoRoot

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[sync-now] Not a git repository: $RepoRoot"
  exit 1
}

# Skip if git operation is in progress.
if (
  (Test-Path ".git\rebase-merge") -or
  (Test-Path ".git\rebase-apply") -or
  (Test-Path ".git\MERGE_HEAD") -or
  (Test-Path ".git\CHERRY_PICK_HEAD")
) {
  Write-Host "[sync-now] Git operation in progress. Skipping."
  exit 0
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -eq "HEAD") {
  Write-Host "[sync-now] Detached HEAD. Skipping."
  exit 0
}

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $hostName = $env:COMPUTERNAME
  if ([string]::IsNullOrWhiteSpace($hostName)) { $hostName = "unknown-host" }
  git commit -m "chore(sync): auto-sync $ts ($hostName)"
}

git push origin $branch
if ($LASTEXITCODE -ne 0) {
  Write-Host "[sync-now] Push failed. Trying rebase + push."
  git pull --rebase origin $branch
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[sync-now] Rebase failed. Resolve conflicts manually."
    exit 1
  }
  git push origin $branch
}

Write-Host "[sync-now] Synced branch $branch"
