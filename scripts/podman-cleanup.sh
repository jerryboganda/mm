#!/usr/bin/env bash
set -euo pipefail

echo "=== Podman safe cleanup started: $(date) ==="

podman system df || true

podman system prune --force --filter until=24h || true

podman volume prune --force \
  --filter label=com.localdev.ephemeral=true \
  --filter until=24h || true

podman system df || true

echo "=== Podman safe cleanup finished: $(date) ==="
