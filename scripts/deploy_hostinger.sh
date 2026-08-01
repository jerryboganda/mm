#!/bin/bash
set -e

echo "Connected to Hostinger via GitHub Actions!"
cd ~/domains/maternalmind.com.pk/public_html || cd ~/public_html || cd ~

cat << 'EOF' > .env
NODE_ENV=production
DATABASE_URL=mysql://u776151780_mmuser:y!&rxCgt*4H@127.0.0.1:3306/u776151780_maternalmind
SESSION_SECRET=64H28SmybRTDp7iqXuv3UVJ1hsrt9KMxYZ5kNzLBWOlwcjno0CQgeIAfaPdEFG
ALLOWED_ORIGIN=https://maternalmind.com.pk
EOF

if [ -f "scripts/maternal_mind_mysql.sql" ]; then
  echo "Importing production database dump into Hostinger MySQL..."
  mysql -u u776151780_mmuser -p'y!&rxCgt*4H' u776151780_maternalmind < scripts/maternal_mind_mysql.sql 2>/dev/null || true
fi

TARGET_DIR=$(pwd)
echo "Current deployment working directory: $TARGET_DIR"

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

VENV_NODE=$(find /home/u776151780/nodevenv -name "node" 2>/dev/null | head -n 1)
NODE_PATH="${VENV_NODE:-$(which node 2>/dev/null || echo "/usr/bin/node")}"
echo "Detected Node binary at: $NODE_PATH"

echo "Configuring Hostinger .htaccess for Static SPAs + Passenger Node API..."
cat << EOF > .htaccess
# Hostinger Single-Slot Architecture Configuration
DirectoryIndex index.html index.php
Options +FollowSymLinks -Indexes

# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/u776151780/domains/maternalmind.com.pk/public_html"
PassengerBaseURI "/"
PassengerNodejs "$NODE_PATH"
PassengerAppType node
PassengerStartupFile app.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

PassengerAppEnv production
PassengerEnabled on

<IfModule mod_rewrite.c>
  RewriteEngine On

  # Route /api and /uploads requests to Node.js Express API server
  RewriteRule ^api(?:/.*)?$ app.js/\$0 [QSA,L]
  RewriteRule ^uploads(?:/.*)?$ app.js/\$0 [QSA,L]

  # SPA Routing for Admin (/admin)
  RewriteCond %{REQUEST_URI} ^/admin
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^admin(?:/.*)?$ /admin/index.html [L]

  # SPA Routing for User Panel (/app)
  RewriteCond %{REQUEST_URI} ^/app
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^app(?:/.*)?$ /app/index.html [L]

  # SPA Routing for Marketing Website (/)
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^.*$ /index.html [L]
</IfModule>
EOF

echo "Setting directory and file permissions for Hostinger LiteSpeed..."
chmod -R 755 . 2>/dev/null || true
chmod 644 .htaccess 2>/dev/null || true

echo "Contents of .htaccess:"
cat .htaccess

mkdir -p tmp
touch tmp/restart.txt
echo "=============================================="
echo "HOSTINGER SINGLE-SLOT DEPLOYMENT COMPLETE!"
echo "=============================================="
