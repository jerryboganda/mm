#!/bin/bash
set -e

echo "Connected to Hostinger via GitHub Actions!"
cd ~/domains/maternalmind.com.pk/public_html || cd ~/public_html || cd ~

cat << 'EOF' > .env
NODE_ENV=production
DATABASE_URL=mysql://u776151780_mmuser:y!&rxCgt*4H@localhost:3306/u776151780_maternalmind
SESSION_SECRET=64H28SmybRTDp7iqXuv3UVJ1hsrt9KMxYZ5kNzLBWOlwcjno0CQgeIAfaPdEFG
ALLOWED_ORIGIN=https://maternalmind.com.pk
EOF

if [ -f "scripts/maternal_mind_mysql.sql" ]; then
  echo "Importing production database dump into Hostinger MySQL..."
  mysql -u u776151780_mmuser -p'y!&rxCgt*4H' u776151780_maternalmind < scripts/maternal_mind_mysql.sql 2>/dev/null || true
fi

echo "Organizing single-slot static frontends..."
if [ -d "$TARGET_DIR/website_dist" ]; then
  echo "Deploying Marketing Website to $TARGET_DIR..."
  cp -rf "$TARGET_DIR/website_dist/"* "$TARGET_DIR/" 2>/dev/null || true
fi

if [ -d "$TARGET_DIR/admin_dist" ]; then
  echo "Deploying Admin Panel to $TARGET_DIR/admin..."
  mkdir -p "$TARGET_DIR/admin"
  cp -rf "$TARGET_DIR/admin_dist/"* "$TARGET_DIR/admin/" 2>/dev/null || true
fi

if [ -d "$TARGET_DIR/web_dist" ]; then
  echo "Deploying Expo User Panel to $TARGET_DIR/app..."
  mkdir -p "$TARGET_DIR/app"
  cp -rf "$TARGET_DIR/web_dist/"* "$TARGET_DIR/app/" 2>/dev/null || true
fi

APP_ROOT=$(pwd -P)
VENV_NODE=$(find /home/u776151780/nodevenv -name "node" 2>/dev/null | head -n 1)
RAW_NODE="${VENV_NODE:-$(which node 2>/dev/null || echo "/usr/bin/node")}"
NODE_PATH=$(readlink -f "$RAW_NODE" 2>/dev/null || echo "$RAW_NODE")

echo "Canonical App Root: $APP_ROOT"
echo "Canonical Node binary: $NODE_PATH"

echo "Creating Hostinger Phusion Passenger app.js entrypoint..."
cat << 'EOF' > app.js
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config();
} catch (e) {}

const logFile = path.join(__dirname, 'passenger_error.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
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

echo "Configuring Hostinger .htaccess for Phusion Passenger Node.js + Static SPAs..."
cat << EOF > .htaccess
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
EOF

echo "Setting directory and file permissions for Hostinger LiteSpeed..."
chmod -R 755 . 2>/dev/null || true
chmod 644 .htaccess 2>/dev/null || true

echo "Contents of .htaccess:"
cat .htaccess

mkdir -p tmp
touch tmp/restart.txt

echo "Verifying the Node entrypoint can start before Passenger reload..."
rm -f passenger_error.log
set +e
timeout 12 "$NODE_PATH" app.js > /tmp/maternal-mind-startup.log 2>&1
STARTUP_STATUS=$?
set -e
cat /tmp/maternal-mind-startup.log
if [ "$STARTUP_STATUS" -ne 0 ] && [ "$STARTUP_STATUS" -ne 124 ]; then
  echo "Node entrypoint failed with exit code $STARTUP_STATUS"
  exit "$STARTUP_STATUS"
fi

sleep 2
echo "Warming up Passenger Node app via domain host..."
HEALTHY=0
for i in 1 2 3; do
  echo "Request $i:"
  STATUS=$(curl -sS -k -o /tmp/maternal-mind-response.txt -w '%{http_code}' \
    "https://maternalmind.com.pk/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}' || true)
  cat /tmp/maternal-mind-response.txt
  echo "HTTP status: $STATUS"
  if [ "$STATUS" = "401" ]; then
    HEALTHY=1
    break
  fi
  echo ""
  sleep 1
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
