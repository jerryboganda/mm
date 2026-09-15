# Production VPS Deployment Guide & Architecture

This document provides a permanent, complete technical reference for deploying and operating the **Maternal Mind** application on the **Production VPS (`185.252.233.186`)**.

---

## 🏗️ 1. Architecture Overview

Maternal Mind is deployed inside Docker containers on an Ubuntu Production VPS:

| Component | Path / Route | Description |
| :--- | :--- | :--- |
| **Express API** | `/api/*` | Node.js Express 5 API server (`server_dist/index.js`) |
| **Expo OTA Updates** | `/updates/*` | Self-hosted Expo mobile app updates (`updates/`) |
| **Marketing Website** | `/` | Static HTML/JS frontend SPA (`website_dist`) |
| **Admin Dashboard** | `/admin/*` | React 19 SPA (`admin_dist`) |
| **User Web App** | `/app/*` | React Native Expo Web SPA (`web_dist`) |
| **Uploads** | `/uploads/*` | Content images & payment proofs (host bind-mount + MinIO) |
| **Health Check** | `/health` | Live DB pool status & memory telemetry |

---

## ⚙️ 2. Server & Container Specifications

- **Server IP**: `185.252.233.186`
- **Hostname**: `vmi2997708`
- **SSH Access**: Passwordless SSH key saved on this PC (`ssh root@185.252.233.186`)
- **Working Directory**: `/opt/docker/maternal-mind`
- **Compose Service**: `app` (Container: `maternal-mind-app-1`)
- **Port**: Host `127.0.0.1:5000` -> Container `5000`
- **Reverse Proxy**: Nginx Proxy Manager (`nginx-proxy-manager-app-1`) routing `maternalmind.com.pk` and `admin.maternalmind.com.pk` to `maternal-mind-app-1:5000` with automated Let's Encrypt SSL/TLS termination.
- **Database**: PostgreSQL (`platform-postgres:5432/maternal_mind`)
- **Object Storage**: MinIO S3-compatible service (`platform-minio:9000`, bucket: `maternal-mind`)
- **Cache**: Redis (`platform-redis:6379/2`)

---

## 🚀 3. Deployment Methods

### Method 1: Local NPM Script
```bash
npm run deploy:vps
```

### Method 2: Shell Script
```bash
bash scripts/deploy_vps.sh
```

### Method 3: PowerShell Script
```powershell
.\scripts\deploy_vps.ps1
```

### Method 4: GitHub Actions
Workflow file: `.github/workflows/deploy-vps.yml`
Triggered manually via `workflow_dispatch`.

---

## 🔍 4. Verification & Diagnostics

### Health Check
```bash
ssh root@185.252.233.186 "curl -s http://127.0.0.1:5000/health"
```

### Container Logs
```bash
ssh root@185.252.233.186 "docker logs -f --tail=100 maternal-mind-app-1"
```

### Container Status
```bash
ssh root@185.252.233.186 "docker ps --filter name=maternal-mind"
```
