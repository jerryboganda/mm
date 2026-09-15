# AGENT OPERATIONAL RULES FOR MATERNAL MIND

## Critical Mandatory Build & Deployment Global Rules
1. **PRODUCTION SERVER DEPLOYMENT (VPS: 185.252.233.186)**:
   - Production server IP is `185.252.233.186` (Ubuntu VPS, Docker container `maternal-mind-app-1`).
   - Deployments to the production server are managed via passwordless SSH access saved in this PC (`ssh root@185.252.233.186` or GitHub Actions workflow dispatch `deploy-vps.yml`).
   - Production web bundles, API, and admin panel are built and deployed directly on the VPS (`cd /opt/docker/maternal-mind && git pull origin main && docker compose build app && docker compose up -d --force-recreate app` or `npm run deploy:vps`).

2. **MOBILE APP BUILDS**:
   - Mobile app store builds (Android APK/AAB and iOS) MUST use **EAS ONLY** (`npx eas-cli build` / `npm run build:android:store`).
   - NEVER attempt manual local native Android or iOS store packaging.
