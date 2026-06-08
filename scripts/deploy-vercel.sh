#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

require_env() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing required env var: $1" >&2
    echo "See docs/ENVIRONMENT.md" >&2
    exit 1
  fi
}

require_env VERCEL_TOKEN

echo "Deploying to Vercel production..."
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"

echo "Vercel deploy complete."
