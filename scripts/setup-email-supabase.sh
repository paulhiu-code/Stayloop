#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-glmzeapxusbsuhixhbqw}"
SUPABASE_URL="${SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN."
  echo "Create one at https://supabase.com/dashboard/account/tokens"
  echo "Then run: SUPABASE_ACCESS_TOKEN=sbp_... ./scripts/setup-email-supabase.sh"
  exit 1
fi

if [[ -z "${RESEND_API_KEY:-}" ]]; then
  echo "Missing RESEND_API_KEY in environment or .env"
  exit 1
fi

EMAIL_FROM="${EMAIL_FROM:-StayLoop <onboarding@resend.dev>}"
EMAIL_REPLY_TO="${EMAIL_REPLY_TO:-alpha.media.solutions@outlook.com}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  echo "Missing SUPABASE_SERVICE_ROLE_KEY in environment or .env"
  exit 1
fi

CLI="${SUPABASE_CLI:-supabase}"
if ! command -v "$CLI" >/dev/null 2>&1; then
  CLI="/tmp/supabase"
fi

echo "Setting Edge Function secrets for project ${PROJECT_REF}..."
"$CLI" secrets set \
  "RESEND_API_KEY=${RESEND_API_KEY}" \
  "EMAIL_FROM=${EMAIL_FROM}" \
  "EMAIL_REPLY_TO=${EMAIL_REPLY_TO}" \
  "STAYLOOP_SUPABASE_URL=${SUPABASE_URL}" \
  "STAYLOOP_SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}" \
  --project-ref "$PROJECT_REF"

echo "Deploying send-email function..."
"$CLI" functions deploy send-email --project-ref "$PROJECT_REF" --no-verify-jwt

echo "Running health check..."
curl -s "${SUPABASE_URL}/functions/v1/send-email" | jq . 2>/dev/null || \
  curl -s "${SUPABASE_URL}/functions/v1/send-email"

echo
echo "Sending test email..."
curl -s "${SUPABASE_URL}/functions/v1/send-email" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"test\",\"to\":\"${EMAIL_REPLY_TO}\"}" | jq . 2>/dev/null || true

echo
echo "Done."
