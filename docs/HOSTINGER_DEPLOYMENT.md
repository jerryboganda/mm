# Hostinger Production Deployment Guide & Architecture

This document provides a permanent, complete technical reference for deploying the **Maternal Mind** application on **Hostinger Cloud / Shared Hosting** via **Phusion Passenger**.

---

## 🏗️ 1. Architecture Overview

Maternal Mind is deployed using a **Unified Single-Slot Architecture** on Hostinger under LiteSpeed / Apache with CloudLinux Phusion Passenger.

| Component | Path / Route | Description |
| :--- | :--- | :--- |
| **Express API** | `/api/*` | Node.js Express server (`server_dist/index.js`) |
| **Expo OTA Updates** | `/updates/*` | Self-hosted Expo mobile app updates |
| **Marketing Website** | `/` | Static HTML/JS frontend (`website_dist`) |
| **Admin Dashboard** | `/admin/*` | React SPA (`admin_dist`) |
| **User Web App** | `/app/*` | React SPA (`app_dist`) |

---

## ⚙️ 2. Key Technical Rules for Hostinger Phusion Passenger

### A. Synchronous `server.listen()` Execution
- **Requirement**: Phusion Passenger intercepts `http.Server.prototype.listen()` during module evaluation.
- **Rule**: `server.listen(port)` in `server/index.ts` **MUST run synchronously** at top-level module load time.
- **DO NOT** wrap `server.listen()` inside an `async` IIFE function `(async () => { await ...; server.listen() })()`. Asynchronous listen calls cause Passenger to time out and return `503 Service Unavailable`.

### B. Early `.env` Loading in `app.js`
- **Requirement**: Environment variables must be available before bundled server modules evaluate top-level getters.
- **Rule**: `app.js` must call `require('dotenv').config()` at the very top before requiring `./server_dist/index.js`.

### C. MySQL Driver Compatibility (No `.returning()`)
- **Requirement**: Hostinger uses **MySQL / MariaDB**.
- **Rule**: Drizzle ORM queries **must not** call `.returning()` on MySQL tables, as `.returning()` is only supported in PostgreSQL/SQLite and will throw a fatal runtime `TypeError`. Always use `isMysql` checks in `server/storage.ts` and `server/lib/device-sessions.ts`.

### D. MySQL Keep-Alive & Pool Management
- **Requirement**: Hostinger drops idle database connections after inactivity.
- **Rule**: `server/db.ts` configures MySQL pool options:
  - `enableKeepAlive: true`
  - `keepAliveInitialDelay: 10000`
  - `connectTimeout: 5000`
  - Connection host set to `localhost` (or `127.0.0.1`).

### E. Passenger Uptime (`PassengerMinInstances 1`)
- **Requirement**: Prevent Passenger from shutting down the Node.js process during idle periods.
- **Rule**: `.htaccess` includes `PassengerMinInstances 1` to ensure at least 1 Node process remains continuously active in RAM.

---

## 📁 3. Critical Server Files

### `app.js` (Passenger Entrypoint)
```javascript
const fs = require("fs");
const path = require("path");

// 1. Load environment variables BEFORE loading server bundle
try {
  require("dotenv").config();
} catch (e) {}

const logFile = path.join(__dirname, "passenger_error.log");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
}

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});

process.on("unhandledRejection", (reason) => {
  log(`UNHANDLED REJECTION: ${reason?.stack || reason}`);
});

log(`Starting Maternal Mind Express API via Hostinger Passenger (Node ${process.version})...`);
try {
  require("./server_dist/index.js");
  log("server_dist/index.js loaded successfully!");
} catch (err) {
  log(`FATAL ERROR loading server_dist/index.js: ${err.stack || err}`);
}
```

### `.htaccess` Configuration
```apache
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "$APP_ROOT"
PassengerBaseURI "/"
PassengerNodejs "$NODE_PATH"
PassengerAppType node
PassengerStartupFile app.js
PassengerMinInstances 1
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

Options +FollowSymLinks -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On

  # SPA Routing for Admin (/admin)
  RewriteCond %{REQUEST_URI} ^/admin
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^admin(?:/.*)?$ admin/index.html [L]

  # SPA Routing for User Panel (/app)
  RewriteCond %{REQUEST_URI} ^/app
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^app(?:/.*)?$ app/index.html [L]

  # SPA Routing for Marketing Website (/)
  RewriteCond %{REQUEST_URI} !^/index\.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_URI} !^/api
  RewriteCond %{REQUEST_URI} !^/uploads
  RewriteRule ^ index.html [L]
</IfModule>
```

---

## 🚀 4. Automated Deployment Flow (CI/CD)

Deployments are executed automatically via GitHub Actions (`.github/workflows/deploy-hostinger.yml`).

### Steps Executed in Workflow:
1. **Build Artifacts**:
   - `npm run check:types`
   - `npm run build:all` (bundles `server_dist/index.js` with `--target=node16`, builds Expo Web, Admin, and Website SPAs).
2. **SCP Artifact Transfer**:
   - Transferred via `appleboy/scp-action` to `~/domains/maternalmind.com.pk/public_html`.
3. **Hostinger SSH Execution**:
   - Runs `scripts/deploy_hostinger.sh`:
     - Creates/verifies `.env` with production `DATABASE_URL` and `SESSION_SECRET`.
     - Generates `.htaccess` with Passenger directives and SPA rewrite rules.
     - Creates `app.js` entrypoint.
     - Sets permissions to `755`.
     - Touches `tmp/restart.txt` to trigger Phusion Passenger reload.

---

## 🛠️ 5. Troubleshooting & Restarting Server

### Manually Restarting Passenger on Hostinger:
To reload the Node.js application without re-deploying, run via SSH:
```bash
cd ~/domains/maternalmind.com.pk/public_html
mkdir -p tmp
touch tmp/restart.txt
```

### Inspecting Error Logs on Hostinger:
If errors occur, inspect the Passenger error log via SSH:
```bash
cat ~/domains/maternalmind.com.pk/public_html/passenger_error.log
```

---

## ✅ Summary of Verified Working State
- **Domain**: `https://maternalmind.com.pk`
- **API Endpoint**: `https://maternalmind.com.pk/api`
- **Mobile Auth Endpoint**: `https://maternalmind.com.pk/api/auth/login`
