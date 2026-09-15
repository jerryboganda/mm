# Production VPS Deployment Guide

## Production Server Information
- **Server IP**: `185.252.233.186`
- **SSH User**: `root`
- **Port**: `22`
- **Auth**: Passwordless SSH key saved in this PC (`~/.ssh/id_ed25519` / `C:\Users\Dr Faisal Maqsood PC\.ssh\id_ed25519`)
- **Project Directory**: `/opt/docker/maternal-mind`
- **Container**: `maternal-mind-app-1`

---

## Fast Deployment Instructions

### Method 1: Local Terminal (Fastest)
From your project root on this PC, simply run:
```bash
npm run deploy:vps
```
This connects to `root@185.252.233.186` via SSH, pulls the latest `origin main`, rebuilds the Docker container, recreates it, and prints the live health status.

---

### Method 2: Manual SSH Deployment
Run the following single command in PowerShell or Git Bash:
```powershell
ssh -o BatchMode=yes root@185.252.233.186 "cd /opt/docker/maternal-mind && git pull origin main && docker compose build app && docker compose up -d --force-recreate app && curl -s http://127.0.0.1:5000/health"
```

---

### Method 3: GitHub Actions
1. Navigate to the repository on GitHub: `https://github.com/jerryboganda/mm/actions`
2. Select **Deploy to Production VPS**.
3. Click **Run workflow**.

---

## Common Maintenance Commands on VPS

### Check Container Status
```bash
ssh root@185.252.233.186 "docker ps --filter name=maternal-mind"
```

### View Live Application Logs
```bash
ssh root@185.252.233.186 "docker logs -f --tail=100 maternal-mind-app-1"
```

### Restart App Container
```bash
ssh root@185.252.233.186 "cd /opt/docker/maternal-mind && docker compose restart app"
```

### Check Database Health
```bash
ssh root@185.252.233.186 "docker exec platform-postgres pg_isready"
```
