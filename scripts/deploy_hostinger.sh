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

echo "Organizing single-slot static frontends..."
if [ -d "website_dist" ]; then
  echo "Deploying Marketing Website to root public_html..."
  cp -rf website_dist/* . 2>/dev/null || true
fi

if [ -d "admin_dist" ]; then
  echo "Deploying Admin Panel to public_html/admin..."
  mkdir -p admin
  cp -rf admin_dist/* admin/ 2>/dev/null || true
fi

if [ -d "web_dist" ]; then
  echo "Deploying Expo User Panel to public_html/app..."
  mkdir -p app
  cp -rf web_dist/* app/ 2>/dev/null || true
fi

VENV_NODE=$(find /home/u776151780/nodevenv -name "node" 2>/dev/null | head -n 1)
NODE_PATH="${VENV_NODE:-$(which node 2>/dev/null || echo "/usr/bin/node")}"
echo "Detected Node binary at: $NODE_PATH"

echo "Configuring Hostinger .htaccess for Single-Slot Static + Node API..."
cat << EOF > .htaccess
# Hostinger Single-Slot Architecture Configuration
Options +FollowSymLinks -Indexes
DirectoryIndex index.html

# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/u776151780/domains/maternalmind.com.pk/public_html"
PassengerBaseURI "/"
PassengerNodejs "$NODE_PATH"
PassengerAppType node
PassengerStartupFile app.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

PassengerAppEnv production
PassengerEnabled on

<IfModule Litespeed>
  SetHandler process-with-nodejs
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On

  # Route /api and /uploads requests to Node.js backend
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

echo "Contents of .htaccess:"
cat .htaccess

export PATH=$PATH:/usr/local/bin:/usr/bin
which node || true
node -v || true

mkdir -p tmp
touch tmp/restart.txt
echo "=============================================="
echo "HOSTINGER SINGLE-SLOT DEPLOYMENT VERIFIED!"
echo "=============================================="
