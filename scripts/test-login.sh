#!/bin/bash
for pw in "password123" "MaternalMind123" "admin123" "Admin123" "Demo@123" "demo123" "maternalmind" "P@ssw0rd" "Admin@1234" "Maternal@123"; do
  result=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"demo@maternalmind.app\",\"password\":\"$pw\"}")
  echo "pw=$pw -> $result"
  if echo "$result" | grep -q "token"; then
    echo ">>> FOUND PASSWORD: $pw"
    break
  fi
done
