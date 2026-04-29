#!/bin/bash
# Comprehensive E2E API Test Suite for Maternal Mind
# Tests against production: http://185.252.233.186:5000

BASE="http://185.252.233.186:5000"
PASS=0
FAIL=0
WARN=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_api() {
    local name="$1"
    local method="$2"
    local path="$3"
    local data="$4"
    local token="$5"
    local expected="$6"
    
    TOTAL=$((TOTAL + 1))
    
    local curl_args=("-s" "-w" "\n%{http_code}" "-X" "$method" "${BASE}${path}")
    curl_args+=("-H" "Content-Type: application/json")
    if [ -n "$token" ]; then
        curl_args+=("-H" "Authorization: Bearer $token")
    fi
    if [ -n "$data" ]; then
        curl_args+=("-d" "$data")
    fi
    
    local response
    response=$(curl "${curl_args[@]}" 2>/dev/null)
    local status=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if echo "$expected" | grep -q "$status"; then
        PASS=$((PASS + 1))
        printf "[PASS] %-50s HTTP %s\n" "$name" "$status"
    else
        FAIL=$((FAIL + 1))
        printf "[FAIL] %-50s HTTP %s (expected %s)\n" "$name" "$status" "$expected"
        echo "       Response: $(echo "$body" | head -c 200)"
    fi
    
    # Store response for chaining
    LAST_BODY="$body"
    LAST_STATUS="$status"
}

echo "=============================================="
echo "  MATERNAL MIND E2E API TESTS (PRODUCTION)"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

# ═══════════════════════════════════════════════════
# HEALTH & INFRASTRUCTURE
# ═══════════════════════════════════════════════════
echo "--- HEALTH & INFRASTRUCTURE ---"
test_api "GET /health" "GET" "/health" "" "" "200"
echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"status={d[\"status\"]} uptime={d[\"uptime\"]:.0f}s db_idle={d[\"db\"][\"idleCount\"]} mem={d[\"memory\"][\"rss\"]//1048576}MB")' 2>/dev/null)"

test_api "GET /ready" "GET" "/ready" "" "" "200"

# Check response headers
HEADERS=$(curl -sI "${BASE}/health")
echo "       Headers check:"
echo "$HEADERS" | grep -qi "X-API-Version" && echo "         [OK] X-API-Version present" || echo "         [MISSING] X-API-Version"
echo "$HEADERS" | grep -qi "X-Request-Id" && echo "         [OK] X-Request-Id present" || echo "         [MISSING] X-Request-Id"
echo "$HEADERS" | grep -qi "Server-Timing" && echo "         [OK] Server-Timing present" || echo "         [MISSING] Server-Timing"
echo "$HEADERS" | grep -qi "Content-Security-Policy" && echo "         [OK] Content-Security-Policy present" || echo "         [MISSING] Content-Security-Policy"
echo "$HEADERS" | grep -qi "Permissions-Policy" && echo "         [OK] Permissions-Policy present" || echo "         [MISSING] Permissions-Policy"
echo "$HEADERS" | grep -qi "Strict-Transport-Security" && echo "         [OK] HSTS present" || echo "         [MISSING] HSTS"
echo ""

# ═══════════════════════════════════════════════════
# AUTH FLOW
# ═══════════════════════════════════════════════════
echo "--- AUTH FLOW ---"

# Login
test_api "Login (valid credentials)" "POST" "/api/auth/login" '{"email":"e2e.test.1776446869103@maternalmind.com","password":"TestPass1234"}' "" "200"
TOKEN=$(echo "$LAST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])' 2>/dev/null)
REFRESH=$(echo "$LAST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["refreshToken"])' 2>/dev/null)
USER_ID=$(echo "$LAST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["user"]["id"])' 2>/dev/null)
USER_NAME=$(echo "$LAST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["user"]["name"])' 2>/dev/null)
echo "       User: $USER_NAME | ID: $USER_ID"

test_api "Login (wrong password)" "POST" "/api/auth/login" '{"email":"e2e.test.1776446869103@maternalmind.com","password":"wrong"}' "" "401"
test_api "Login (nonexistent email)" "POST" "/api/auth/login" '{"email":"nobody@nowhere.com","password":"Test1234"}' "" "401"
test_api "Register (weak password)" "POST" "/api/auth/register" '{"name":"Weak","email":"weak@test.com","password":"123","confirmPassword":"123"}' "" "400"
test_api "Register (no uppercase)" "POST" "/api/auth/register" '{"name":"Test","email":"test2@test.com","password":"testpass1234","confirmPassword":"testpass1234"}' "" "400"

# Auth - protected routes without token
test_api "GET /api/books (no auth)" "GET" "/api/books" "" "" "401"
test_api "GET /api/progress (no auth)" "GET" "/api/progress" "" "" "401"

# Auth - me endpoint
test_api "GET /api/auth/me" "GET" "/api/auth/me" "" "$TOKEN" "200"
echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"name={d[\"name\"]} email={d[\"email\"]} role={d[\"role\"]} verified={d[\"isEmailVerified\"]}")' 2>/dev/null)"

# Token refresh
test_api "Token refresh" "POST" "/api/auth/refresh" "{\"refreshToken\":\"$REFRESH\"}" "$TOKEN" "200"
NEW_TOKEN=$(echo "$LAST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("accessToken",""))' 2>/dev/null)
if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "" ]; then
    TOKEN="$NEW_TOKEN"
    echo "       New token obtained"
fi
echo ""

# ═══════════════════════════════════════════════════
# CONTENT BROWSING
# ═══════════════════════════════════════════════════
echo "--- CONTENT BROWSING ---"
test_api "GET /api/books" "GET" "/api/books" "" "$TOKEN" "200"
BOOK_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get("books",d.get("data",[]))))' 2>/dev/null)
BOOK_ID=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); books=d if isinstance(d,list) else d.get("books",d.get("data",[])); print(books[0]["id"] if books else "")' 2>/dev/null)
BOOK_TITLE=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); books=d if isinstance(d,list) else d.get("books",d.get("data",[])); print(books[0].get("title","?") if books else "none")' 2>/dev/null)
echo "       Books: $BOOK_COUNT | First: $BOOK_TITLE"

if [ -n "$BOOK_ID" ]; then
    test_api "GET /api/books/:id/chapters" "GET" "/api/books/$BOOK_ID/chapters" "" "$TOKEN" "200"
    CHAP_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get("chapters",d.get("data",[]))))' 2>/dev/null)
    CHAP_ID=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); c=d if isinstance(d,list) else d.get("chapters",d.get("data",[])); print(c[0]["id"] if c else "")' 2>/dev/null)
    echo "       Chapters: $CHAP_COUNT"
    
    if [ -n "$CHAP_ID" ]; then
        test_api "GET /api/chapters/:id/topics" "GET" "/api/chapters/$CHAP_ID/topics" "" "$TOKEN" "200"
        TOPIC_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); t=d if isinstance(d,list) else d.get("topics",d.get("data",[])); print(len(t))' 2>/dev/null)
        TOPIC_ID=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); t=d if isinstance(d,list) else d.get("topics",d.get("data",[])); print(t[0]["id"] if t else "")' 2>/dev/null)
        echo "       Topics: $TOPIC_COUNT"
        
        if [ -n "$TOPIC_ID" ]; then
            test_api "GET /api/topics/:id (content)" "GET" "/api/topics/$TOPIC_ID" "" "$TOKEN" "200"
            TOPIC_TITLE=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("title",d.get("topic",{}).get("title","?")))' 2>/dev/null)
            BLOCK_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("contentBlocks",d.get("content_blocks",[]))))' 2>/dev/null)
            echo "       Topic: $TOPIC_TITLE | Content blocks: $BLOCK_COUNT"
        fi
    fi
fi

test_api "Search (query=pregnancy)" "GET" "/api/search?q=pregnancy" "" "$TOKEN" "200"
SEARCH_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d if isinstance(d,list) else d.get("results",d.get("data",[])); print(len(r))' 2>/dev/null)
echo "       Search results: $SEARCH_COUNT"

test_api "Search (empty query)" "GET" "/api/search?q=" "" "$TOKEN" "200 400"
test_api "Recommended topics" "GET" "/api/recommended-topics" "" "$TOKEN" "200"
test_api "Mobile app content" "GET" "/api/mobile-content" "" "" "200"
echo ""

# ═══════════════════════════════════════════════════
# PROGRESS TRACKING
# ═══════════════════════════════════════════════════
echo "--- PROGRESS TRACKING ---"
test_api "GET /api/progress" "GET" "/api/progress" "" "$TOKEN" "200"
echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"completed={d.get(\"completedTopics\",d.get(\"completed\",\"?\"))} total={d.get(\"totalTopics\",d.get(\"total\",\"?\"))}")' 2>/dev/null)"

if [ -n "$TOPIC_ID" ]; then
    test_api "Mark topic complete" "POST" "/api/progress/complete" "{\"topicId\":\"$TOPIC_ID\"}" "$TOKEN" "200 201"
    test_api "GET /api/progress (after complete)" "GET" "/api/progress" "" "$TOKEN" "200"
    test_api "Mark topic uncomplete" "POST" "/api/progress/uncomplete" "{\"topicId\":\"$TOPIC_ID\"}" "$TOKEN" "200"
fi
echo ""

# ═══════════════════════════════════════════════════
# BOOKMARKS
# ═══════════════════════════════════════════════════
echo "--- BOOKMARKS ---"
if [ -n "$TOPIC_ID" ]; then
    test_api "Toggle bookmark (add)" "POST" "/api/bookmarks/toggle" "{\"topicId\":\"$TOPIC_ID\"}" "$TOKEN" "200 201"
    test_api "Get bookmarks list" "GET" "/api/bookmarks" "" "$TOKEN" "200"
    BM_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); b=d if isinstance(d,list) else d.get("bookmarks",d.get("data",[])); print(len(b))' 2>/dev/null)
    echo "       Bookmarks: $BM_COUNT"
    test_api "Toggle bookmark (remove)" "POST" "/api/bookmarks/toggle" "{\"topicId\":\"$TOPIC_ID\"}" "$TOKEN" "200"
fi
echo ""

# ═══════════════════════════════════════════════════
# QUIZ SYSTEM
# ═══════════════════════════════════════════════════
echo "--- QUIZ SYSTEM ---"
test_api "Start quiz (mixed mode)" "GET" "/api/quiz/start/mixed" "" "$TOKEN" "200"
QUIZ_ID=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("quizId",""))' 2>/dev/null)
Q_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("questions",[])))' 2>/dev/null)
echo "       Quiz: $QUIZ_ID | Questions: $Q_COUNT"

if [ -n "$QUIZ_ID" ] && [ "$Q_COUNT" != "0" ]; then
    # Build answers - answer first 3 questions
    ANSWERS=$(echo "$LAST_BODY" | python3 -c '
import sys,json
d=json.load(sys.stdin)
answers={}
for q in d["questions"][:3]:
    qid = q["id"]
    opts = q.get("options",[])
    if isinstance(opts, list) and len(opts)>0:
        if isinstance(opts[0], dict):
            answers[qid] = opts[0].get("label","A")
        else:
            answers[qid] = "A"
    else:
        answers[qid] = "A"
print(json.dumps(answers))
' 2>/dev/null)
    
    SUBMIT_DATA="{\"quizId\":\"$QUIZ_ID\",\"answers\":$ANSWERS,\"mode\":\"mixed\"}"
    test_api "Submit quiz" "POST" "/api/quiz/submit" "$SUBMIT_DATA" "$TOKEN" "200 201"
    ATTEMPT_ID=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("id",d.get("attemptId","")))' 2>/dev/null)
    SCORE=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("score","?"))' 2>/dev/null)
    echo "       Score: $SCORE | Attempt: $ATTEMPT_ID"
fi

test_api "Quiz stats" "GET" "/api/quiz/stats" "" "$TOKEN" "200"
echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"totalAttempts={d.get(\"totalAttempts\",\"?\")} avgScore={d.get(\"averageScore\",\"?\")}")' 2>/dev/null)"

test_api "Get attempts (paginated)" "GET" "/api/attempts?page=1&pageSize=5" "" "$TOKEN" "200"
echo ""

# ═══════════════════════════════════════════════════
# SPACED REVIEW
# ═══════════════════════════════════════════════════
echo "--- SPACED REVIEW ---"
test_api "Due review count" "GET" "/api/review/due-count" "" "$TOKEN" "200"
echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"dueCount={d.get(\"count\",\"?\")}")' 2>/dev/null)"

test_api "Get due reviews" "GET" "/api/review/due" "" "$TOKEN" "200"

# Enqueue wrong answers from quiz attempt
if [ -n "$ATTEMPT_ID" ]; then
    test_api "Enqueue for review" "POST" "/api/review/enqueue" "{\"attemptId\":\"$ATTEMPT_ID\"}" "$TOKEN" "200"
    echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"enqueued={d.get(\"enqueued\",\"?\")}")' 2>/dev/null)"
fi
echo ""

# ═══════════════════════════════════════════════════
# USER PROFILE
# ═══════════════════════════════════════════════════
echo "--- USER PROFILE ---"
test_api "Get profile" "GET" "/api/auth/me" "" "$TOKEN" "200"
test_api "Update profile name" "PATCH" "/api/user/profile" '{"name":"E2E Test Student Updated"}' "$TOKEN" "200"
echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"name={d.get(\"name\",d.get(\"user\",{}).get(\"name\",\"?\"))}")' 2>/dev/null)"

test_api "Restore profile name" "PATCH" "/api/user/profile" '{"name":"E2E Test Student"}' "$TOKEN" "200"
test_api "Get recent activity" "GET" "/api/profile/recent-activity" "" "$TOKEN" "200"
ACTIVITY_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); a=d if isinstance(d,list) else d.get("activities",d.get("data",[])); print(len(a))' 2>/dev/null)
echo "       Recent activities: $ACTIVITY_COUNT"
echo ""

# ═══════════════════════════════════════════════════
# SUBSCRIPTIONS
# ═══════════════════════════════════════════════════
echo "--- SUBSCRIPTIONS ---"
test_api "Get packages" "GET" "/api/subscriptions/packages" "" "" "200"
PKG_COUNT=$(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("packages",[])))' 2>/dev/null)
echo "       Packages: $PKG_COUNT"

test_api "Package comparison" "GET" "/api/subscriptions/packages/compare" "" "" "200"
test_api "My subscription" "GET" "/api/subscriptions/my-subscription" "" "$TOKEN" "200"
echo "       $(echo "$LAST_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); s=d.get("subscription"); print(f"status={s[\"status\"]}" if s else "subscription=none")' 2>/dev/null)"
test_api "Invoice history" "GET" "/api/subscriptions/invoices" "" "$TOKEN" "200"
test_api "Subscription history" "GET" "/api/subscriptions/history" "" "$TOKEN" "200"
echo ""

# ═══════════════════════════════════════════════════
# SUPPORT & REPORTS
# ═══════════════════════════════════════════════════
echo "--- SUPPORT & REPORTS ---"
test_api "Get announcements" "GET" "/api/announcements" "" "$TOKEN" "200"
test_api "Get support contact" "GET" "/api/support/contact" "" "$TOKEN" "200"
echo ""

# ═══════════════════════════════════════════════════
# SECURITY TESTS
# ═══════════════════════════════════════════════════
echo "--- SECURITY TESTS ---"
test_api "Invalid token" "GET" "/api/books" "" "invalid.token.here" "401"
test_api "Admin route (student)" "GET" "/api/admin/email-settings" "" "$TOKEN" "403"
test_api "XSS in search" "GET" "/api/search?q=<script>alert(1)</script>" "" "$TOKEN" "200 400"
echo ""

# ═══════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════
echo "=============================================="
echo "  TEST RESULTS"
echo "=============================================="
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
echo "  TOTAL:  $TOTAL"
echo "  RATE:   $(( PASS * 100 / TOTAL ))%"
echo "=============================================="

# Cleanup: delete test user
echo ""
echo "Cleanup: Test user will remain for future tests."

exit $FAIL
