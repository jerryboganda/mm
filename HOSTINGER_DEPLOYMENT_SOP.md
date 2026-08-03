# Standard Operating Procedure (SOP): Maternal Mind Hostinger Deployment

> **Goal**: Deploy updates to production on Hostinger in under 1 minute without delays.

---

## 🏗️ Production Hosting Architecture

All Maternal Mind production deployments run on **Hostinger** under a single parent **Hostinger Business Hosting Account**:

1. **Marketing Landing Page Website**:
   - **URL**: `https://maternalmind.com.pk/`
   - **Source Directory**: `Maternal Mind Website/`
   - **Hosting**: Separate Hostinger Website deployment.

2. **Unified Web Application (Single-Slot Deployment)**:
   - **API Server**: `https://maternalmind.com.pk/api/`
   - **Admin Panel**: `https://maternalmind.com.pk/admin/`
   - **User Web App**: `https://maternalmind.com.pk/app/`
   - **Source Directory**: `server/`, `admin/`, `client/`
   - **Hosting**: Separate Hostinger Web App deployment on port 5000 / proxy.

---

## ⚡ Fast Deployment Workflow (3-Step Checklist)

### Step 1: Local Verification & Commit
Before pushing code, ensure everything compiles locally:
```bash
# 1. Type check all projects
npm run check:types

# 2. Add, commit and push
git add .
git commit -m "your update message"
git push origin main
```

---

### Step 2: Manual Trigger Options for Hostinger

#### Option 1: Hostinger hPanel (Instant — Recommended)
1. Go to **Hostinger hPanel** > **Git / Deployments**.
2. Click **Deploy**.
3. Hostinger pulls `origin main` and publishes updates instantly.

#### Option 2: GitHub Actions Manual Trigger
1. Go to [GitHub Actions](https://github.com/jerryboganda/mm/actions).
2. Click **Manual Deploy to Hostinger**.
3. Select **Run workflow** -> `all` / `website` / `app_and_admin`.

#### Option 3: Local CLI Command
```bash
npm run deploy:hostinger
```

---

## 🔑 GitHub Actions Secrets Reference

If using GitHub Actions SCP upload, ensure these 4 secrets are configured in `https://github.com/jerryboganda/mm/settings/secrets/actions`:

| Secret Name | Value Description | Example |
|---|---|---|
| `HOSTINGER_HOST` | Hostinger SSH Host / Domain | `maternalmind.com.pk` |
| `HOSTINGER_PORT` | SSH Port | `6588` or `22` |
| `HOSTINGER_USER` | Hostinger SSH Username | `u776151780` |
| `HOSTINGER_SSH_KEY` | Private SSH Key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

---

## 🛠️ Direct Hostinger Server Environment Variables (`.env`)

For Hostinger Node.js environments, the `.env` file at `~/domains/maternalmind.com.pk/public_html/.env` contains:

```env
NODE_ENV=production
DATABASE_URL=mysql://u776151780_mmuser:y!&rxCgt*4H@127.0.0.1:3306/u776151780_maternalmind
SESSION_SECRET=64H28SmybRTDp7iqXuv3UVJ1hsrt9KMxYZ5kNzLBWOlwcjno0CQgeIAfaPdEFG
ALLOWED_ORIGIN=https://maternalmind.com.pk
```
