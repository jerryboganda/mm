$ErrorActionPreference = "Continue"

Write-Host "=== Podman safe cleanup started: $(Get-Date) ==="

podman system df

Write-Host "Pruning stopped containers, unused networks, dangling images, and build cache older than 24h..."
podman system prune --force --filter "until=24h"

Write-Host "Pruning only explicitly disposable volumes..."
podman volume prune --force --filter "label=com.localdev.ephemeral=true" --filter "until=24h"

podman system df

Write-Host "=== Podman safe cleanup finished: $(Get-Date) ==="
