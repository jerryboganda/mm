# AGENT OPERATIONAL RULES FOR MATERNAL MIND

## Critical Mandatory Build & Deployment Global Rules
1. **WEB BUNDLES & HOSTINGER DEPLOYMENT**:
   - Web bundles MUST always be built and deployed through **GitHub Actions** (`.github/workflows/deploy-hostinger.yml`).
   - NEVER manually build web bundles locally for production deployment.
   - Any updates to the web app, marketing website, or admin panel must be pushed to `main` and deployed via GitHub Actions workflow dispatch.

2. **MOBILE APP BUILDS**:
   - Mobile app store builds (Android APK/AAB and iOS) MUST use **EAS ONLY** (`npx eas-cli build` / `npm run build:android:store`).
   - NEVER attempt manual local native Android or iOS store packaging.
