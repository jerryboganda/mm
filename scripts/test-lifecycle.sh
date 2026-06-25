#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@maternalmind.app","password":"Demo@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")

BASE="http://localhost:5000/api"

# Get the premium package ID and its first price ID
echo "--- Getting Premium package with prices ---"
PACKAGES=$(curl -s "$BASE/admin/subscriptions/packages" -H "Authorization: Bearer $TOKEN")
PKG_INFO=$(echo "$PACKAGES" | python3 -c "
import sys, json
pkgs = json.load(sys.stdin)
for p in pkgs:
    if p['slug'] == 'premium':
        prices = p.get('prices', [])
        pid = prices[0]['id'] if prices else ''
        print(p['id'] + '|' + pid)
        break
" 2>/dev/null)

PKG_ID=$(echo "$PKG_INFO" | cut -d'|' -f1)
PRICE_ID=$(echo "$PKG_INFO" | cut -d'|' -f2)

echo "Package ID: $PKG_ID"
echo "Price ID: $PRICE_ID"

if [ -z "$PRICE_ID" ] || [ "$PRICE_ID" = "" ]; then
  echo "No price on premium package, creating one..."
  PRICE_RESP=$(curl -s -X POST "$BASE/admin/subscriptions/$PKG_ID/prices" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"packageId\":\"$PKG_ID\",\"billingCycle\":\"monthly\",\"price\":\"4.99\",\"currency\":\"USD\",\"isActive\":true}")
  PRICE_ID=$(echo "$PRICE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
  echo "Created price: $PRICE_ID"
fi

echo ""
echo "--- Provision via admin manual grant (RevenueCat removed; /subscribe no longer exists) ---"
SUB_RESP=$(curl -s -X POST "$BASE/admin/manual-payments/grant" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"demo@maternalmind.app\",\"packageId\":\"$PKG_ID\",\"priceId\":\"$PRICE_ID\"}")
echo "$SUB_RESP" | python3 -m json.tool 2>/dev/null | head -30
echo ""

echo "--- Check my subscription after subscribing ---"
MY_SUB=$(curl -s "$BASE/subscriptions/my-subscription" -H "Authorization: Bearer $TOKEN")
echo "$MY_SUB" | python3 -m json.tool 2>/dev/null | head -20
echo ""

echo "--- Check subscription history ---"
HIST=$(curl -s "$BASE/subscriptions/history" -H "Authorization: Bearer $TOKEN")
echo "$HIST" | python3 -m json.tool 2>/dev/null | head -20
echo ""

echo "--- Check audit log ---"
AUDIT=$(curl -s "$BASE/admin/subscriptions/audit-log?limit=10" -H "Authorization: Bearer $TOKEN")
AUDIT_COUNT=$(echo "$AUDIT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "Audit entries: $AUDIT_COUNT"
echo "$AUDIT" | python3 -m json.tool 2>/dev/null | head -20
echo ""

echo "--- Test Pause ---"
PAUSE_RESP=$(curl -s -X POST "$BASE/subscriptions/pause" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
echo "Pause: $PAUSE_RESP" | head -c 200
echo ""

echo "--- Test Resume ---"
RESUME_RESP=$(curl -s -X POST "$BASE/subscriptions/resume" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
echo "Resume: $RESUME_RESP" | head -c 200
echo ""

echo "--- Test Cancel ---"
CANCEL_RESP=$(curl -s -X POST "$BASE/subscriptions/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"immediate":false,"reason":"Testing cancel flow"}')
echo "Cancel: $CANCEL_RESP" | head -c 200
echo ""

echo "--- Final subscription state ---"
curl -s "$BASE/subscriptions/my-subscription" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20
echo ""

echo "=== LIFECYCLE TEST COMPLETE ==="
