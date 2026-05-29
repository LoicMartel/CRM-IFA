#!/usr/bin/env bash
# Smoke test ADV endpoints — requires Next dev server running (http://localhost:3000)
# Usage:
#   BASE_URL=http://localhost:3000 \
#   AUTH_COOKIE='sb-...' \
#   DEAL_ID=<uuid> \
#   ./scripts/smoke-test-adv.sh
#
# AUTH_COOKIE: copy from a logged-in browser session DevTools (entire Cookie header)
# DEAL_ID: a real deal UUID in stage opportunities OR quote_to_send

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_COOKIE="${AUTH_COOKIE:-}"
DEAL_ID="${DEAL_ID:-}"

if [[ -z "$AUTH_COOKIE" ]]; then
  echo "ERROR: AUTH_COOKIE env var manquante. Copier depuis browser DevTools." >&2
  exit 1
fi
if [[ -z "$DEAL_ID" ]]; then
  echo "ERROR: DEAL_ID env var manquante." >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq requis (brew install jq)." >&2
  exit 1
fi

pass=0
fail=0

run_test() {
  local label="$1"
  local expected_ok="$2"  # "true" si on attend ok:true, "false" si on attend une erreur 4xx/5xx
  local status="$3"
  local body="$4"

  echo
  echo "── $label"
  echo "   HTTP $status"
  echo "   Body: $(echo "$body" | jq -c . 2>/dev/null || echo "$body")"

  if [[ "$expected_ok" == "true" && "$status" =~ ^2 ]]; then
    echo "   ✓ PASS"
    pass=$((pass + 1))
  elif [[ "$expected_ok" == "false" && ! "$status" =~ ^2 ]]; then
    echo "   ✓ PASS (erreur attendue : $status)"
    pass=$((pass + 1))
  else
    echo "   ✗ FAIL (status $status, expected_ok=$expected_ok)"
    fail=$((fail + 1))
  fi
}

call() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local args=(-s -o /tmp/smoke-adv-body -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Cookie: $AUTH_COOKIE" -H "Content-Type: application/json")
  if [[ -n "$data" ]]; then args+=(--data "$data"); fi
  local status
  status=$(curl "${args[@]}")
  local body
  body=$(cat /tmp/smoke-adv-body)
  echo "$status|$body"
}

echo "=== ADV endpoints smoke test ==="
echo "Base: $BASE_URL"
echo "Deal: $DEAL_ID"

# Test 1: GET status (should always work for any team_member)
out=$(call GET "/api/deals/$DEAL_ID/adv-status")
status="${out%%|*}"; body="${out#*|}"
run_test "GET /api/deals/{id}/adv-status" "true" "$status" "$body"

# Test 2: GET status on bogus deal (expected 404)
out=$(call GET "/api/deals/00000000-0000-0000-0000-000000000000/adv-status")
status="${out%%|*}"; body="${out#*|}"
run_test "GET adv-status on bogus deal (expect 404)" "false" "$status" "$body"

# Test 3: POST create quote without body (expect 400)
out=$(call POST "/api/quotes/create-from-deal" "{}")
status="${out%%|*}"; body="${out#*|}"
run_test "POST create-quote sans deal_id (expect 400)" "false" "$status" "$body"

# Test 4: POST create invoice without permission stage mismatch (expect 409 if stage != quote_signed/opco_deposit/closed_won)
# Note: ce test peut PASS ou être refused selon le stage actuel du deal
out=$(call POST "/api/invoices/create-from-deal" "{\"deal_id\":\"$DEAL_ID\"}")
status="${out%%|*}"; body="${out#*|}"
echo
echo "── POST invoice on $DEAL_ID (status dépend du stage actuel)"
echo "   HTTP $status"
echo "   Body: $(echo "$body" | jq -c . 2>/dev/null || echo "$body")"

# Test 5: POST create quote sur le deal réel (déclenche n8n — destructif !)
if [[ "${RUN_DESTRUCTIVE:-0}" == "1" ]]; then
  out=$(call POST "/api/quotes/create-from-deal" "{\"deal_id\":\"$DEAL_ID\"}")
  status="${out%%|*}"; body="${out#*|}"
  run_test "POST create-quote DESTRUCTIVE (déclenche n8n)" "true" "$status" "$body"
else
  echo
  echo "── Test destructif skip (set RUN_DESTRUCTIVE=1 pour activer)"
fi

echo
echo "=== Résultat ==="
echo "Pass: $pass  Fail: $fail"
[[ $fail -eq 0 ]]
