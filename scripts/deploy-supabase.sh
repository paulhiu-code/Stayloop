#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-glmzeapxusbsuhixhbqw}"

require_env() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing required env var: $1" >&2
    echo "See docs/ENVIRONMENT.md" >&2
    exit 1
  fi
}

require_env SUPABASE_ACCESS_TOKEN
require_env SUPABASE_DB_PASSWORD

echo "Linking Supabase project ${PROJECT_REF}..."
npx supabase link --project-ref "$PROJECT_REF" --yes

echo "Pushing database migrations..."
npx supabase db push --yes

echo "Deploying Edge Functions..."
JWT_FUNCTIONS=(
  pms-guesty-sync
  pms-ownerrez-sync
)
NO_JWT_FUNCTIONS=(
  pms-webhook-receiver
  pms-scheduled-sync
  send-email
)

for fn in "${JWT_FUNCTIONS[@]}"; do
  echo "  → ${fn}"
  npx supabase functions deploy "$fn"
done

for fn in "${NO_JWT_FUNCTIONS[@]}"; do
  echo "  → ${fn} (--no-verify-jwt)"
  npx supabase functions deploy "$fn" --no-verify-jwt
done

echo "Supabase deploy complete."
