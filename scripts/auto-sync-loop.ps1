param(
  [int]$IntervalSeconds = 60,
  [string]$RepoRoot = ""
)

$ErrorActionPreference = "Continue"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

while ($true) {
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-now.ps1") -RepoRoot $RepoRoot
  } catch {
    Write-Host "[auto-sync-loop] sync-now failed; retrying in $IntervalSeconds s."
  }
  Start-Sleep -Seconds $IntervalSeconds
}
