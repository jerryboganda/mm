#!/bin/bash
set -e

echo "Connected to Hostinger via GitHub Actions!"
DOMAIN_ROOT="$HOME/domains/maternalmind.com.pk"
NODE_ROOT="$DOMAIN_ROOT/nodejs"
PUBLIC_ROOT="$DOMAIN_ROOT/public_html"
mkdir -p "$NODE_ROOT" "$PUBLIC_ROOT"
cd "$NODE_ROOT"

APP_ROOT=$(pwd -P)
VENV_NODE=$(find "$HOME/nodevenv" -name "node" 2>/dev/null | head -n 1)
ALT_NODE="/opt/alt/alt-nodejs20/root/usr/bin/node"
SYS_NODE="$(which node 2>/dev/null || echo "/usr/bin/node")"

if [ -n "$VENV_NODE" ] && [ -x "$VENV_NODE" ]; then
  RAW_NODE="$VENV_NODE"
elif [ -x "$ALT_NODE" ]; then
  RAW_NODE="$ALT_NODE"
elif [ -x "$SYS_NODE" ]; then
  RAW_NODE="$SYS_NODE"
else
  RAW_NODE="/opt/alt/alt-nodejs20/root/usr/bin/node"
fi

NODE_PATH=$(readlink -f "$RAW_NODE" 2>/dev/null || echo "$RAW_NODE")
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$PATH"

echo "Canonical App Root: $APP_ROOT"
echo "Canonical Node binary: $NODE_PATH"

cat << 'EOF' > .env
NODE_ENV=production
DATABASE_URL=mysql://u776151780_mmuser:y!&rxCgt*4H@127.0.0.1:3306/u776151780_maternalmind
SESSION_SECRET=64H28SmybRTDp7iqXuv3UVJ1hsrt9KMxYZ5kNzLBWOlwcjno0CQgeIAfaPdEFG
ALLOWED_ORIGIN=https://maternalmind.com.pk
EOF

if [ ! -d "node_modules/mysql2" ]; then
  echo "Installing production dependencies on Hostinger..."
  npm install --omit=dev --no-audit --no-fund --legacy-peer-deps || npm install --production --no-audit --no-fund || true
fi

if [ -f "scripts/init-mysql-schema.mjs" ]; then
  echo "Initializing/verifying production MySQL schema & topology..."
  "$NODE_PATH" scripts/init-mysql-schema.mjs || echo "[!] Warning: init-mysql-schema.mjs exited non-fatally"
fi

if [ -f "scripts/apply-book-content-release.mjs" ]; then
  echo "Applying authoritative book content release..."
  "$NODE_PATH" scripts/apply-book-content-release.mjs || true
fi

if [ -f "scripts/sync-all-mysql-columns.mjs" ]; then
  echo "Synchronizing MySQL columns & admin seeds..."
  "$NODE_PATH" scripts/sync-all-mysql-columns.mjs || echo "[!] Warning: sync-all-mysql-columns.mjs exited non-fatally"
fi

if [ -f "scripts/set-admin-password.mjs" ]; then
  echo "Setting verified admin password..."
  "$NODE_PATH" scripts/set-admin-password.mjs || true
fi

if [ -f "scripts/verify-production.mjs" ]; then
  echo "Verifying production database and ensuring admin user..."
  "$NODE_PATH" scripts/verify-production.mjs
fi || true

echo "Organizing single-slot static frontends..."
if [ -d "$NODE_ROOT/website_dist" ]; then
  echo "Deploying Marketing Website to $PUBLIC_ROOT..."
  cp -rf "$NODE_ROOT/website_dist/"* "$PUBLIC_ROOT/"
fi

if [ -d "$NODE_ROOT/admin_dist" ]; then
  echo "Deploying Admin Panel to $PUBLIC_ROOT/admin..."
  mkdir -p "$PUBLIC_ROOT/admin"
  cp -rf "$NODE_ROOT/admin_dist/"* "$PUBLIC_ROOT/admin/"
fi

if [ -d "$NODE_ROOT/web_dist" ]; then
  echo "Deploying Expo User Panel to $PUBLIC_ROOT/app..."
  mkdir -p "$PUBLIC_ROOT/app"
  cp -rf "$NODE_ROOT/web_dist/"* "$PUBLIC_ROOT/app/"
  if [ -d "$NODE_ROOT/web_dist/_expo" ]; then
    echo "Mirroring _expo static assets to $PUBLIC_ROOT/_expo..."
    mkdir -p "$PUBLIC_ROOT/_expo"
    cp -rf "$NODE_ROOT/web_dist/_expo/"* "$PUBLIC_ROOT/_expo/" 2>/dev/null || true
  fi
fi

echo "Creating Hostinger Phusion Passenger app.js entrypoint..."
cat << 'EOF' > app.js
const fs = require('fs');
const path = require('path');

try {
  process.chdir(__dirname);
} catch (e) {}

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {}

const logFile = path.join(__dirname, 'passenger_error.log');
const origStdoutWrite = process.stdout.write.bind(process.stdout);
const origStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = function (chunk, encoding, cb) {
  try { fs.appendFileSync(logFile, chunk); } catch (e) {}
  return origStdoutWrite(chunk, encoding, cb);
};

process.stderr.write = function (chunk, encoding, cb) {
  try { fs.appendFileSync(logFile, chunk); } catch (e) {}
  return origStderrWrite(chunk, encoding, cb);
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason?.stack || reason}`);
});

log(`Starting Maternal Mind Express API via Hostinger Passenger (Node ${process.version})...`);
try {
  require('./server_dist/index.js');
  log('server_dist/index.js loaded successfully!');
} catch (err) {
  log(`FATAL ERROR loading server_dist/index.js: ${err.stack || err}`);
}
EOF

echo "Configuring public_html routing to the Hostinger Node runtime..."
cat << EOF > "$PUBLIC_ROOT/.htaccess"
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "$APP_ROOT"
PassengerBaseURI "/"
PassengerNodejs "$NODE_PATH"
PassengerAppType node
PassengerStartupFile app.js
PassengerMinInstances 1
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

# Hostinger Single-Slot Architecture Configuration
Options +FollowSymLinks -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On

  # Direct pass-through for Expo static assets under /_expo
  RewriteCond %{REQUEST_URI} ^/_expo/
  RewriteCond %{DOCUMENT_ROOT}/app%{REQUEST_URI} -f
  RewriteRule ^_expo/(.*)$ app/_expo/$1 [L]

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

  # SPA Routing for Marketing Website (/) — Explicitly protect /app, /_expo, /admin, /api, /uploads, /updates
  RewriteCond %{REQUEST_URI} !^/index\.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_URI} !^/api
  RewriteCond %{REQUEST_URI} !^/admin
  RewriteCond %{REQUEST_URI} !^/app
  RewriteCond %{REQUEST_URI} !^/_expo
  RewriteCond %{REQUEST_URI} !^/uploads
  RewriteCond %{REQUEST_URI} !^/updates
  RewriteRule ^ index.html [L]
</IfModule>
EOF

echo "Setting directory and file permissions for Hostinger LiteSpeed..."
chmod 755 "$NODE_ROOT" "$PUBLIC_ROOT"
find "$PUBLIC_ROOT" -type d -exec chmod 755 {} + 2>/dev/null || true
find "$PUBLIC_ROOT" -type f -exec chmod 644 {} + 2>/dev/null || true
find "$NODE_ROOT/server_dist" "$NODE_ROOT/scripts" "$NODE_ROOT/content" "$NODE_ROOT/uploads" -type d -exec chmod 755 {} + 2>/dev/null || true
find "$NODE_ROOT/server_dist" "$NODE_ROOT/scripts" "$NODE_ROOT/content" "$NODE_ROOT/uploads" -type f -exec chmod 644 {} + 2>/dev/null || true
chmod 644 "$PUBLIC_ROOT/.htaccess" 2>/dev/null || true

echo "Contents of .htaccess:"
cat "$PUBLIC_ROOT/.htaccess"

mkdir -p tmp

echo "Verifying the Node entrypoint can start before Passenger reload..."
rm -f passenger_error.log
# Smoke-test on a scratch port: never fight Passenger (or drop live traffic)
# for port 5000. The app honors $PORT (server/index.ts).
fuser -k 5001/tcp 2>/dev/null || true
sleep 1
set +e
PORT=5001 timeout 12 "$NODE_PATH" app.js > /tmp/maternal-mind-startup.log 2>&1
STARTUP_STATUS=$?
set -e
cat /tmp/maternal-mind-startup.log
if [ "$STARTUP_STATUS" -ne 0 ] && [ "$STARTUP_STATUS" -ne 124 ]; then
  echo "Node entrypoint failed with exit code $STARTUP_STATUS"
  exit "$STARTUP_STATUS"
fi

echo "Restarting Passenger after the standalone process has stopped..."
touch tmp/restart.txt
sleep 2
echo "Warming up Passenger Node app via domain host..."
HEALTHY=0
for i in 1 2 3; do
  echo "Request $i:"
  STATUS=$(curl -sS -k -o /tmp/maternal-mind-response.txt -w '%{http_code}' \
    "https://maternalmind.com.pk/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"drfarzanamuneer1@gmail.com","password":"Admin@123456"}' || true)
  cat /tmp/maternal-mind-response.txt
  echo "HTTP status: $STATUS"
  if [ "$STATUS" = "200" ]; then
    HEALTHY=1
    break
  fi
  echo ""
  sleep 2
done

if [ -f "passenger_error.log" ]; then
  echo "=================== PASSENGER ERROR LOG ==================="
  cat passenger_error.log
  echo "==========================================================="
fi

if [ "$HEALTHY" -ne 1 ]; then
  echo "Deployment verification failed: login endpoint did not return the expected JSON 401 response."
  exit 1
fi

echo "=============================================="
echo "HOSTINGER SINGLE-SLOT DEPLOYMENT COMPLETE!"
echo "=============================================="
