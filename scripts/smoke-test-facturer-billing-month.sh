#!/usr/bin/env bash
# Smoke test: POST /api/billing-months/[id]/facturer
#
# Vérifie le contrat d'API (auth, validation, propagation n8n).
# Usage: ./scripts/smoke-test-facturer-billing-month.sh <base_url> <session_cookie>
#
# Exemple:
#   ./scripts/smoke-test-facturer-billing-month.sh https://localhost:3000 "<session-cookie>"
#
# Pré-requis :
#   - serveur lancé (npm run dev)
#   - un billing_month avec status='non_fait' en DB (récupérer son id)
#   - un deal lié + cookie de session admin/finance

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
COOKIE="${2:-}"
BM_ID="${BM_ID:-test-bm-uuid-here}"
DEAL_ID="${DEAL_ID:-test-deal-uuid-here}"

echo "=== Smoke test: POST /api/billing-months/$BM_ID/facturer ==="
echo "Base URL: $BASE_URL"
echo

if [ -z "$COOKIE" ]; then
  echo "⚠️  Pas de cookie fourni → test 401 attendu"
fi

echo "[1] Test 401 Unauthorized (sans cookie)"
curl -sS -X POST "$BASE_URL/api/billing-months/$BM_ID/facturer" \
  -H "Content-Type: application/json" \
  -d "{\"dealId\":\"$DEAL_ID\"}" \
  -w "\nHTTP %{http_code}\n" || true
echo

if [ -n "$COOKIE" ]; then
  echo "[2] Test happy path (cookie + dealId valide)"
  curl -sS -X POST "$BASE_URL/api/billing-months/$BM_ID/facturer" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d "{\"dealId\":\"$DEAL_ID\"}" \
    -w "\nHTTP %{http_code}\n"
  echo

  echo "[3] Test idempotency (re-trigger sur même billing_month → 409)"
  curl -sS -X POST "$BASE_URL/api/billing-months/$BM_ID/facturer" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d "{\"dealId\":\"$DEAL_ID\"}" \
    -w "\nHTTP %{http_code}\n"
  echo

  echo "[4] Test dealId manquant (400)"
  curl -sS -X POST "$BASE_URL/api/billing-months/$BM_ID/facturer" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d "{}" \
    -w "\nHTTP %{http_code}\n"
  echo

  echo "[5] Test billing_month inexistant (404)"
  curl -sS -X POST "$BASE_URL/api/billing-months/00000000-0000-0000-0000-000000000000/facturer" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d "{\"dealId\":\"$DEAL_ID\"}" \
    -w "\nHTTP %{http_code}\n"
fi

echo
echo "=== Smoke test terminé ==="
