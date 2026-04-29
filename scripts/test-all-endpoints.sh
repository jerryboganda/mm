#!/bin/bash
# Re-login first to get fresh token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@maternalmind.app","password":"Demo@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")

if [ -z "$TOKEN" ]; then
  echo "FAILED to login"
  exit 1
fi
echo "Logged in. Token: ${TOKEN:0:20}..."
echo ""

BASE="http://localhost:5000/api"
PASS=0
FAIL=0

test_endpoint() {
  local method=$1
  local path=$2
  local data=$3
  local expect_code=$4
  
  if [ -n "$data" ]; then
    code=$(curl -s -w "%{http_code}" -o /tmp/resp.json -X "$method" "$BASE$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    code=$(curl -s -w "%{http_code}" -o /tmp/resp.json -X "$method" "$BASE$path" \
      -H "Authorization: Bearer $TOKEN")
  fi
  
  body=$(cat /tmp/resp.json | head -c 150)
  
  if [ "$code" = "$expect_code" ]; then
    echo "PASS $method $path -> $code"
    PASS=$((PASS+1))
  else
    echo "FAIL $method $path -> $code (expected $expect_code) $body"
    FAIL=$((FAIL+1))
  fi
}

test_public() {
  local path=$1
  local expect_code=$2
  code=$(curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE$path")
  body=$(cat /tmp/resp.json | head -c 150)
  if [ "$code" = "$expect_code" ]; then
    echo "PASS GET $path -> $code"
    PASS=$((PASS+1))
  else
    echo "FAIL GET $path -> $code (expected $expect_code) $body"
    FAIL=$((FAIL+1))
  fi
}

echo "=== ADMIN ANALYTICS ==="
test_endpoint GET "/admin/subscriptions/analytics/kpis" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/revenue-by-package" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/subscriber-growth?days=30" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/events?limit=5" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/overview" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/revenue" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/growth?period=30d" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/churn?period=30d" "" "200"
test_endpoint GET "/admin/subscriptions/analytics/coupon-overview" "" "200"

echo ""
echo "=== ADMIN PACKAGES ==="
test_endpoint GET "/admin/subscriptions/packages" "" "200"
test_endpoint GET "/admin/subscriptions/" "" "200"
test_endpoint GET "/admin/subscriptions/comparison" "" "200"

echo ""
echo "=== ADMIN COUPONS ==="
test_endpoint GET "/admin/subscriptions/coupons" "" "200"

echo ""
echo "=== ADMIN ADD-ONS ==="
test_endpoint GET "/admin/subscriptions/add-ons" "" "200"

echo ""
echo "=== ADMIN SUBSCRIBERS ==="
test_endpoint GET "/admin/subscriptions/subscribers" "" "200"

echo ""
echo "=== ADMIN AUDIT LOG ==="
test_endpoint GET "/admin/subscriptions/audit-log?limit=5" "" "200"

echo ""
echo "=== USER-FACING (PUBLIC) ==="
test_public "/subscriptions/packages" "200"
test_public "/subscriptions/packages/compare" "200"

echo ""
echo "=== USER-FACING (AUTH) ==="
test_endpoint GET "/subscriptions/my-subscription" "" "200"
test_endpoint GET "/subscriptions/invoices" "" "200"
test_endpoint GET "/subscriptions/history" "" "200"

echo ""
echo "=== WEBHOOK ==="
code=$(curl -s -w "%{http_code}" -o /tmp/resp.json -X POST "$BASE/../api/webhooks/revenuecat" \
  -H "Content-Type: application/json" \
  -d '{"api_version":"4.0","event":{"type":"TEST","app_user_id":"test","product_id":"test","period_type":"NORMAL","purchased_at_ms":1234567890000,"expiration_at_ms":null,"environment":"SANDBOX","store":"APP_STORE","original_app_user_id":"test"}}')
if [ "$code" = "200" ]; then
  echo "PASS POST /webhooks/revenuecat -> $code"
  PASS=$((PASS+1))
else
  echo "FAIL POST /webhooks/revenuecat -> $code"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=============================="
echo "RESULTS: $PASS passed, $FAIL failed"
echo "=============================="
