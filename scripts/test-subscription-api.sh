#!/bin/bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZW1vLXVzZXItMDAxIiwiaWF0IjoxNzc2MzU5NTA5LCJleHAiOjE3NzY5NjQzMDl9.KBqLNHVFVmjwFQHabT26nswODN2kZAUeejQ3wHH4sd4"
BASE="http://localhost:5000/api"

echo "=== TESTING SUBSCRIPTION SYSTEM ENDPOINTS ==="
echo ""

# 1. Analytics endpoints
echo "--- Analytics ---"
echo -n "GET /admin/subscriptions/analytics/kpis -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/analytics/kpis" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "GET /admin/subscriptions/analytics/revenue-by-package -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/analytics/revenue-by-package" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "GET /admin/subscriptions/analytics/subscriber-growth -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/analytics/subscriber-growth?days=30" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "GET /admin/subscriptions/analytics/events -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/analytics/events?limit=5" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

# 2. Packages CRUD
echo "--- Packages CRUD ---"
echo -n "GET /admin/subscriptions/packages -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/packages" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "POST /admin/subscriptions/packages (create) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json -X POST "$BASE/admin/subscriptions/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Free Plan","slug":"free","description":"Basic free access","status":"active","displayOrder":0,"trialDays":0,"gracePeriodDays":0,"maxSubscribers":0,"isVisibleToUsers":true,"trialRequiresPaymentMethod":false}'
echo " $(cat /tmp/resp.json | head -c 300)"
echo ""

echo -n "POST /admin/subscriptions/packages (Premium) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json -X POST "$BASE/admin/subscriptions/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Premium Plan","slug":"premium","description":"Full access to all content and MCQs","status":"active","displayOrder":1,"trialDays":7,"gracePeriodDays":3,"maxSubscribers":0,"isVisibleToUsers":true,"trialRequiresPaymentMethod":false}'
echo " $(cat /tmp/resp.json | head -c 300)"
echo ""

echo -n "GET /admin/subscriptions/packages (verify created) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/packages" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 400)"
echo ""

# 3. Coupons
echo "--- Coupons ---"
echo -n "GET /admin/subscriptions/coupons -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/coupons" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "POST /admin/subscriptions/coupons (create) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json -X POST "$BASE/admin/subscriptions/coupons" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"LAUNCH50","description":"50% off launch discount","discountType":"percentage","discountValue":"50.00","maxUsesPerUser":1,"maxTotalUses":100,"isActive":true}'
echo " $(cat /tmp/resp.json | head -c 300)"
echo ""

# 4. User-facing endpoints
echo "--- User-Facing ---"
echo -n "GET /subscriptions/packages (public) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/subscriptions/packages"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "GET /subscriptions/packages/compare (public) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/subscriptions/packages/compare"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "GET /subscriptions/my-subscription (auth) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/subscriptions/my-subscription" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "GET /subscriptions/invoices (auth) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/subscriptions/invoices" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

echo -n "GET /subscriptions/history (auth) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/subscriptions/history" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

# 5. Manual payment flow
echo "--- Manual Payments ---"
echo -n "GET /subscriptions/payment-instructions -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/subscriptions/payment-instructions"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""
echo -n "GET /subscriptions/my-proofs (auth) -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/subscriptions/my-proofs" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""
echo -n "GET /admin/manual-payments?status=pending -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/manual-payments?status=pending" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

# 6. Audit log
echo "--- Audit Log ---"
echo -n "GET /admin/subscriptions/audit-log -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/audit-log?limit=5" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

# 7. Add-ons
echo "--- Add-ons ---"
echo -n "GET /admin/subscriptions/add-ons -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/add-ons" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 200)"
echo ""

# 8. Subscribers
echo "--- Subscribers ---"
echo -n "GET /admin/subscriptions/subscribers -> "
curl -s -w "%{http_code}" -o /tmp/resp.json "$BASE/admin/subscriptions/subscribers" -H "Authorization: Bearer $TOKEN"
echo " $(cat /tmp/resp.json | head -c 400)"
echo ""

echo "=== ALL TESTS COMPLETE ==="
