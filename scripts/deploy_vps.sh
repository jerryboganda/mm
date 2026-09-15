#!/usr/bin/env bash
set -e

VPS_IP="185.252.233.186"
VPS_USER="root"
PROJECT_DIR="/opt/docker/maternal-mind"

echo "=========================================="
echo "  Deploying to Production VPS ($VPS_IP)   "
echo "=========================================="

echo "Connecting via SSH..."
ssh -o BatchMode=yes -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" bash -c "'
  set -e
  cd ${PROJECT_DIR}
  echo \"==> Pulling latest changes from main...\"
  git pull origin main
  echo \"==> Building application container...\"
  docker compose build app
  echo \"==> Recreating app container...\"
  docker compose up -d --force-recreate app
  echo \"==> Verifying container health...\"
  sleep 4
  curl -s -f http://127.0.0.1:5000/health || (echo \"Health check failed!\" && exit 1)
  echo \"\"
  echo \"==> Container status:\"
  docker compose ps app
'"

echo ""
echo "=========================================="
echo "  Deployment to VPS $VPS_IP Complete!    "
echo "=========================================="
