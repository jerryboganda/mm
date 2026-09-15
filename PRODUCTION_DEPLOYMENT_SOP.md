# Standard Operating Procedure (SOP): Maternal Mind Production VPS Deployment

> **Goal**: Deploy updates to the Production VPS (`185.252.233.186`) reliably with zero downtime.

---

## 🏗️ Production Infrastructure & Architecture

All Maternal Mind production workloads run on the **Production Ubuntu VPS**:

- **Production Server IP**: `185.252.233.186`
- **SSH User**: `root`
- **SSH Port**: `22`
- **SSH Authentication**: Passwordless SSH key saved on this PC (`ssh -o BatchMode=yes root@185.252.233.186`)
- **Deployment Location**: `/opt/docker/maternal-mind`
- **Reverse Proxy**: Nginx Proxy Manager (`nginx-proxy-manager-app-1`)
- **Main Container**: `maternal-mind-app-1` (Docker Compose project `maternal-mind`, port 5000)
- **Database**: PostgreSQL (`platform-postgres:5432`, database: `maternal_mind`)
- **Object Storage**: MinIO (`platform-minio:9000`)
- **Cache & Queue**: Redis (`platform-redis:6379/2`)
- **Public Domain**: `https://maternalmind.com.pk`
  - Marketing Website: `https://maternalmind.com.pk/`
  - Express API: `https://maternalmind.com.pk/api/`
  - Admin Panel: `https://maternalmind.com.pk/admin/`
  - User Web App: `https://maternalmind.com.pk/app/`
  - OTA Updates: `https://maternalmind.com.pk/updates/`
  - Health Check: `https://maternalmind.com.pk/health`

---

## ⚡ Deployment Workflow (3-Step Checklist)

### Step 1: Local Verification & Commit
Before pushing code, ensure everything compiles cleanly:
```bash
# 1. Type check all projects
npm run check:types

# 2. Add, commit and push to main
git add .
git commit -m "feat/fix: description of changes"
git push origin main
```

---

### Step 2: Deploy to Production VPS (`185.252.233.186`)

#### Option 1: One-Click Local NPM Command (Recommended)
```bash
npm run deploy:vps
# or
npm run deploy
```

#### Option 2: Direct SSH from Terminal
```bash
ssh -o BatchMode=yes root@185.252.233.186 "cd /opt/docker/maternal-mind && git pull origin main && docker compose build app && docker compose up -d --force-recreate app && sleep 3 && curl -s http://127.0.0.1:5000/health"
```

#### Option 3: GitHub Actions Workflow Dispatch
1. Open [GitHub Actions](https://github.com/jerryboganda/mm/actions).
2. Select **Deploy to Production VPS** (`deploy-vps.yml`).
3. Click **Run workflow** -> `rebuild_and_restart`.

---

### Step 3: Production Health Verification
Check that the live service is responsive:
```bash
# Direct HTTP check to container on VPS:
ssh root@185.252.233.186 "curl -s http://127.0.0.1:5000/health"

# Public HTTPS check:
curl.exe -k --resolve maternalmind.com.pk:443:185.252.233.186 https://maternalmind.com.pk/health
```
Expected response:
```json
{"status":"healthy","timestamp":"...","uptime":...,"version":"1.0.0","db":{"totalCount":1,"idleCount":1,"waitingCount":0},"memory":{...}}
```

---

## 🔑 Production Environment Variables (`.env`)

On the Production VPS at `/opt/docker/maternal-mind/.env`:
- `DATABASE_URL`: Connection string to shared PostgreSQL `platform-postgres`
- `SESSION_SECRET`: Secure session secret key
- `ALLOWED_ORIGIN`: `https://maternalmind.com.pk`
- `PLATFORM_REDIS_URL`: Connection string to `platform-redis`
- `PLATFORM_S3_*`: Object storage credentials for `platform-minio`
- `BREVO_*`: SMTP email dispatch credentials
