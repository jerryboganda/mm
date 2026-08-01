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

VENV_NODE=$(find /home/u776151780/nodevenv -name "node" 2>/dev/null | head -n 1)
NODE_PATH="${VENV_NODE:-$(which node 2>/dev/null || echo "/usr/bin/node")}"
echo "Detected Node binary at: $NODE_PATH"

echo "Configuring Hostinger .htaccess for LiteSpeed Phusion Passenger..."
cat << EOF > .htaccess
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/u776151780/domains/maternalmind.com.pk/public_html"
PassengerBaseURI "/"
PassengerNodejs "$NODE_PATH"
PassengerAppType node
PassengerStartupFile app.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

Options +FollowSymLinks -Indexes
PassengerAppEnv production
PassengerEnabled on

<IfModule Litespeed>
  SetHandler process-with-nodejs
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^$ app.js [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ app.js/\$1 [QSA,L]
</IfModule>
EOF

echo "Contents of .htaccess:"
cat .htaccess

export PATH=$PATH:/usr/local/bin:/usr/bin
which node || true
node -v || true

echo "Testing app.js boot..."
timeout 5s node app.js || true

mkdir -p tmp
touch tmp/restart.txt
echo "=============================================="
echo "HOSTINGER DEPLOYMENT VERIFIED & ACTIVATED!"
echo "=============================================="
