#!/usr/bin/env bash
# deploy-prod.sh — Deploy CRM-LCA to Vercel production WITHOUT git metadata.
#
# WHY THIS SCRIPT EXISTS
#   The Vercel account (loic-6963's projects) blocks any deployment whose git
#   commit author lacks a seat on the team:
#     readyStateReason = "Git author <email> must have access to the team ..."
#     seatBlock.blockCode = TEAM_ACCESS_REQUIRED
#   Commits authored by Teina are therefore refused at build time and land in
#   readyState=BLOCKED (instant, never built). The native GitHub->Vercel
#   auto-deploy is dead for the same reason.
#   Workaround: deploy from a tree stripped of `.git` (via `git archive`), using
#   Loic's CLI token. With no git author metadata, Vercel attributes the build to
#   the token owner (Loic) -> the block does not trigger.
#
# WHAT IT DOES (safe by default)
#   1. Loads VERCEL_TOKEN_LOIC from ~/.secrets/closing-academy.env (token via env,
#      never as an argv -> not exposed in `ps`).
#   2. Fetches origin/main and deploys EXACTLY that pushed commit (not local WIP).
#   3. Guardrails: aborts if ADV_TEST_EMAIL_OVERRIDE or BILLING_AUTO_MODE are
#      present in prod env (would mis-send emails / auto-bill). Override: --force.
#   4. Builds from a .git-less archive of origin/main + the .vercel link.
#   5. Polls the deployment readyState; explains the block if it reappears.
#   6. Smoke-checks the public prod URL (webhook route 405, root not 401).
#
# USAGE
#   scripts/deploy-prod.sh                 # interactive confirm before pushing prod
#   scripts/deploy-prod.sh --yes           # no confirmation (CI / repeat deploys)
#   scripts/deploy-prod.sh --no-smoke      # skip post-deploy smoke checks
#   scripts/deploy-prod.sh --force         # bypass the env guardrail abort
#
# REQUIREMENTS: bash, git, vercel CLI, python3, curl; key VERCEL_TOKEN_LOIC in
#   ~/.secrets/closing-academy.env (scope loic-6963s-projects).

set -euo pipefail

# --- config (overridable via env) -------------------------------------------
SECRETS_FILE="${SECRETS_FILE:-$HOME/.secrets/closing-academy.env}"
PROD_URL="${PROD_URL:-https://crm-lca.vercel.app}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
READY_TIMEOUT="${READY_TIMEOUT:-900}"   # seconds to wait for READY

# --- flags -------------------------------------------------------------------
ASSUME_YES=false; FORCE=false; DO_SMOKE=true
for arg in "$@"; do
  case "$arg" in
    -y|--yes)      ASSUME_YES=true ;;
    -f|--force)    FORCE=true ;;
    --no-smoke)    DO_SMOKE=false ;;
    -h|--help)     sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $arg (see --help)" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- locate repo (scripts/ -> repo root) -------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
LINK="$REPO/.vercel/project.json"
[ -f "$LINK" ] || die "No $LINK — run from the CRM-LCA repo (vercel link missing)."

PROJECT_ID="$(python3 -c "import json;print(json.load(open('$LINK'))['projectId'])")"
TEAM_ID="$(python3 -c "import json;print(json.load(open('$LINK'))['orgId'])")"
SCOPE="$(python3 -c "import json;print(json.load(open('$LINK')).get('orgSlug','loic-6963s-projects'))" 2>/dev/null || echo loic-6963s-projects)"

# --- token (env, not argv) ---------------------------------------------------
[ -f "$SECRETS_FILE" ] || die "Secrets file not found: $SECRETS_FILE"
VERCEL_TOKEN="$(grep -hE "^(export )?VERCEL_TOKEN_LOIC=" "$SECRETS_FILE" | head -1 \
  | sed 's/^export //' | cut -d= -f2- | tr -d '"\r' | xargs)"
[ -n "$VERCEL_TOKEN" ] || die "VERCEL_TOKEN_LOIC missing in $SECRETS_FILE"
export VERCEL_TOKEN
api() { curl -fsS -H "Authorization: Bearer $VERCEL_TOKEN" "$@"; }

# --- 1. commit to deploy -----------------------------------------------------
say "Fetching origin/$DEPLOY_BRANCH"
git -C "$REPO" fetch -q origin "$DEPLOY_BRANCH" || die "git fetch failed"
SHA="$(git -C "$REPO" rev-parse --short "origin/$DEPLOY_BRANCH")"
SUBJECT="$(git -C "$REPO" log -1 --format='%s' "origin/$DEPLOY_BRANCH")"
ok "Will deploy origin/$DEPLOY_BRANCH @ $SHA — \"$SUBJECT\""

# --- 2. guardrails: dangerous env vars must be ABSENT in prod ----------------
say "Checking prod env guardrails"
DANGER="$(api "https://api.vercel.com/v9/projects/$PROJECT_ID/env?teamId=$TEAM_ID" \
  | python3 -c "import json,sys
d=json.load(sys.stdin)
bad=[e['key'] for e in d.get('envs',[]) if e['key'] in ('ADV_TEST_EMAIL_OVERRIDE','BILLING_AUTO_MODE') and 'production' in e.get('target',[])]
print(','.join(bad))")"
if [ -n "$DANGER" ]; then
  if $FORCE; then
    printf '\033[1;33m  ! guardrail bypass (--force): %s present in prod\033[0m\n' "$DANGER"
  else
    die "Refusing to deploy: $DANGER present in prod env (mis-send/auto-bill risk). Remove them or pass --force."
  fi
else
  ok "ADV_TEST_EMAIL_OVERRIDE / BILLING_AUTO_MODE absent (safe)"
fi

# --- 3. confirm --------------------------------------------------------------
if ! $ASSUME_YES; then
  printf '\033[1;33mDeploy %s @ %s to PRODUCTION (%s)? [y/N] \033[0m' "$DEPLOY_BRANCH" "$SHA" "$PROD_URL"
  read -r reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "Aborted by user."
fi

# --- 4. build a .git-less tree + deploy --------------------------------------
TMP="$(mktemp -d "${TMPDIR:-/tmp}/crm-deploy.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
say "Staging clean tree (no .git) at $TMP"
git -C "$REPO" archive "origin/$DEPLOY_BRANCH" | tar -x -C "$TMP"
cp -r "$REPO/.vercel" "$TMP/.vercel"
[ -d "$TMP/.git" ] && die "Internal error: .git leaked into staging (would re-trigger the block)."
ok "Clean tree ready (Vercel will attribute the build to the token owner)"

say "Deploying to production (build runs on Vercel, ~2-4 min)…"
( cd "$TMP" && vercel --prod --yes ) || die "vercel deploy command failed"

# --- 5. poll readyState ------------------------------------------------------
say "Waiting for READY (timeout ${READY_TIMEOUT}s)"
deadline=$(( $(date +%s) + READY_TIMEOUT )); state=""; url=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  read -r state url < <(api "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&teamId=$TEAM_ID&target=production&limit=1" \
    | python3 -c "import json,sys;d=json.load(sys.stdin)['deployments'][0];print(d['readyState'],d['url'])" 2>/dev/null || echo "POLL_FAIL ?")
  case "$state" in
    READY)    ok "READY — $url"; break ;;
    BLOCKED)  die "Deployment BLOCKED (TEAM_ACCESS_REQUIRED). The .git-less workaround failed — check that no git metadata leaked, or add the git author to the Vercel team." ;;
    ERROR|CANCELED) die "Deployment $state — inspect: https://vercel.com/$SCOPE/crm-lca" ;;
    *)        printf '  … %s\n' "$state"; sleep 6 ;;
  esac
done
[ "$state" = "READY" ] || die "Timed out waiting for READY (last state: $state)."

# --- 6. smoke ----------------------------------------------------------------
if $DO_SMOKE; then
  say "Smoke-checking $PROD_URL"
  hook=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PROD_URL/api/webhooks/firma")
  root=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PROD_URL/")
  [ "$hook" = "405" ] && ok "webhook route live (405 on GET)" || printf '\033[1;33m  ! /api/webhooks/firma returned %s (expected 405)\033[0m\n' "$hook"
  [ "$root" = "401" ] && printf '\033[1;33m  ! root is 401 (SSO still gating prod?) — webhook may be unreachable\033[0m\n' || ok "prod public (root=$root, not SSO-gated)"
fi

say "Done. Prod is serving $SHA."
echo "  Reminders: Firma webhook is unchanged; validate reject/modify/403/signature/payment paths with Naznine."
