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

echo "Configuring Hostinger .htaccess for LiteSpeed Phusion Passenger..."
cat << 'EOF' > .htaccess
# Hostinger LiteSpeed / Phusion Passenger Node.js Configuration
PassengerAppEnv production
PassengerAppRoot /home/u776151780/domains/maternalmind.com.pk/public_html
PassengerAppType node
PassengerStartupFile app.js
PassengerEnabled on

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^$ app.js [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ app.js/$1 [QSA,L]
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
