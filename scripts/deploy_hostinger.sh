#!/bin/bash
set -e

echo "Connected to Hostinger via GitHub Actions!"
DOMAIN_ROOT="$HOME/domains/maternalmind.com.pk"
NODE_ROOT="$DOMAIN_ROOT/nodejs"
PUBLIC_ROOT="$DOMAIN_ROOT/public_html"
mkdir -p "$NODE_ROOT" "$PUBLIC_ROOT"
cd "$NODE_ROOT"

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
chmod 755 "$NODE_ROOT" "$PUBLIC_ROOT"
find "$NODE_ROOT" "$PUBLIC_ROOT" -type d -exec chmod 755 {} +
find "$NODE_ROOT" "$PUBLIC_ROOT" -type f -exec chmod 644 {} +
chmod 644 "$PUBLIC_ROOT/.htaccess"

echo "Contents of .htaccess:"
cat "$PUBLIC_ROOT/.htaccess"

mkdir -p tmp

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
