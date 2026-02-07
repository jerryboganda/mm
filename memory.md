# 🧠 Maternal Mind - Project Memory (A-Z)

## 🌐 Infrastructure & Deployment

### 🖥️ VPS Backend (Live)

- **IP Address**: `185.252.233.186`
- **Port**: `5000`
- **Stack**: Docker Compose (Node.js App + PostgreSQL)
- **Directory**: `/root/maternalmind`

### 📜 Server Shortcuts

```bash
# SSH into VPS
ssh root@185.252.233.186

# Check Logs
cd /root/maternalmind && docker compose logs -f app

# Restart Backend (after code changes)
cd /root/maternalmind && docker compose up -d --build app

# Run Migrations
cd /root/maternalmind && docker compose exec app npm run db:push
```

## 🏗️ Android Build System (EAS Cloud)

Due to local Windows environment constraints (path length limits and NDK setup), we transitioned to **EAS Build** (Expo Application Services).

- **EAS Project ID**: `fc2a8779-9dbb-407c-9622-d02c88e300de`
- **Build Profile**: `preview` (Outputs a standalone **APK**)
- **Build Command**: `npx eas-cli build --profile preview --platform android`
- **Dashboard**: [Expo Dashboard](https://expo.dev/accounts/egjerrys-organization/projects/maternalmind/builds)

### 🛠️ Critical Network & Schema Fixes (Android)

To resolve "Network request failed" and schema errors:

1. **Cleartext Traffic**: Enabled via `expo-build-properties` plugin in `app.json` (required for HTTP connections to the VPS).
2. **CORS**: Server `index.ts` updated with a robust policy to allow mobile app platform origins.
3. **Dependency Fix**: Ran `npx expo install --fix` to align all packages with the Expo SDK.

## 📂 Source Control

- **GitHub Repository**: `https://github.com/jerryboganda/mm`
- **Status**: Synced and pushed.

## 🧪 Development Workflow

1. **Mobile Testing**: Use EAS for builds. Avoid local `gradlew assemble` on this machine due to environment conflicts.
2. **Native Configuration**: Any Android manifest or system changes must be added to `app.json` -> `plugins` -> `expo-build-properties`.
3. **Emulator Troubleshooting**: The local emulator requires **Windows Hypervisor Platform** or **HAXM** to be enabled in BIOS/Windows Features for x86_64 acceleration. Since virtualization is disabled in BIOS on this machine, use **Expo Go**, **Web Testing**, or **EAS Builds** (standalone APKs) for previewing changes.

## ✨ UI, Navigation & Visibility Improvements (Jan 2026)

Recent updates have focused on refining the Android user experience and app-wide aesthetics.

### 🎨 Design & Visibility

- **High-Contrast Glass**: Tripled the base opacity for all "glass" elements in `theme.ts`.
- **Visibility Boost**: Updated `GlassCard`, `BentoCard`, `StatCard`, and `GlassInput` to ensure crisp readability against deep black backgrounds.
- **Dashboard Layout**: Resolved squashing issues on the Home screen cards. Fixed flexbox constraints and container widths for animated items.
- **Hero Stats**: Fixed indexing logic so the first stat card ("Topics Read") correctly uses the wide "hero" layout.

### 🗺️ Navigation & Platform UX

- **Android System Bar**: Implemented dynamic safe area handling in `MainTabNavigator.tsx`. The bottom tab bar now respects the Android system navigation bar, preventing UI overlap across different display modes.
- **Reliable Navigation**: Updated the "Sign In" link in the registration flow to use explicit `navigation.navigate("Login")` instead of `goBack()`, ensuring a consistent path for users.

### 🚀 Build History

- **Last Build (0380c558-14bb-46f9-9cbe-eb5f4284e2eb)**: Full APK including UI, Contrast, and Navigation fixes.
- **Status**: Active and downloadable via [Expo Projects](https://expo.dev/accounts/egjerrys-organization/projects/maternalmind/builds).
