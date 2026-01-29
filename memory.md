# Session Memory: Android APK Build

> **Created**: 2026-01-29
> **Topic**: Building React Native Expo Android APK on Windows

## 🎯 Objective

Build a standalone Android APK for the "MaternalMind" React Native Expo project to allow testing on a physical device without a development server.

## 🛠️ Key Challenges & Solutions

### 1. Windows Path Length Limit (Max 260 Characters)

* **Issue**: The default project path on the desktop was too long, causing `ninja` and `CMake` errors during native module compilation (specifically `react-native-keyboard-controller` and `reanimated`).
* **Failed Attempts**: Creating a directory junction (`C:\Users\Admin\MM`) was insufficient because some build tasks still resolved the absolute canonical path.
* **Solution**: Moved the entire project to a top-level temporary directory: **`C:\M`**. This shortened the paths enough to bypass the limit.

### 2. NDK & CMake Configuration

* **Issue**: Gradle could not find the installed NDK or CMake versions.
* **Solution**: Manually configured `android/local.properties` with absolute paths using forward slashes:

    ```properties
    sdk.dir=C:/Users/Admin/AppData/Local/Android/Sdk
    ndk.dir=C:/Users/Admin/AppData/Local/Android/Sdk/ndk/27.1.12297006
    ```

### 3. Splash Screen Freeze (Debug vs. Release)

* **Issue**: The initial `app-debug.apk` installed successfully but froze on the splash screen.
* **Root Cause**: Debug builds in React Native expect a running Metro bundler server to fetch the JavaScript bundle. Without it, the app waits indefinitely.
* **Solution**: Generated a **Release** build (`assembleRelease`). Release builds bundle the JavaScript assets inside the APK, allowing it to run standalone.

### 4. Asset Embedding in Release Build

* **Issue**: Standard `assembleRelease` sometimes misses Expo assets in a hybrid setup.
* **Solution**: Manually copied the compiled JS bundle and assets before final packaging:
  * JS Bundle: `dist/_expo/static/js/android/*.hbc` -> `src/main/assets/index.android.bundle`
  * Resources: `dist/assets` -> `src/main/res`

## 📂 Critical Paths

* **Original Project**: `c:\Users\Admin\Desktop\MM React + Expo App`
* **Build Workspace**: `C:\M` (Temporary, used for building)
* **Final APK**: `c:\Users\Admin\Desktop\MM React + Expo App\app-release.apk`

## 📜 Key Commands Executed

```powershell
# 1. Clean Deep
Remove-Item -Path "node_modules", ".cxx", "build" -Recurse -Force
npm install

# 2. Build Release (at C:\M)
cmd /c "gradlew assembleRelease"
```

## 📦 Final Deliverable

* **File**: `app-release.apk` (~104 MB)
* **Status**: Verifed build success (Exit Code 0). Copied to user desktop.

## 🚀 Backend Deployment (VPS)
>
> **Deployed**: 2026-01-29
> **Host**: `185.252.233.186` (User: root)

### 📂 Directory Structure

* **Path**: `/root/maternalmind`
* **Files**: `docker-compose.yml`, `Dockerfile`, `package.json`, `server/`, `shared/`

### 🔧 Configuration

* **Port**: `5000` (Mapped to host 5000:5000)
* **Database**: Postgres 15 (Docker container `maternalmind-db-1`)
* **Runtime**: Node.js 20 + `tsx` (Modified Dockerfile to handle path aliases)

### 📜 Shortcuts

```bash
# SSH into VPS
ssh root@185.252.233.186

# Check Logs
cd /root/maternalmind && docker compose logs -f app

# Run Migrations
cd /root/maternalmind && docker compose exec app npm run db:push
```

## 🛠️ Project Status & Sync

* **GitHub Repo**: `https://github.com/jerryboganda/mm` (Synced)
* **API Configuration**: Client is hardcoded to `http://185.252.233.186:5000` in `client/lib/query-client.ts`.
* **Latest APK**: Rebuilding with live API connection...
