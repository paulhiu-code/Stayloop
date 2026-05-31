#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN before running this script."
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-glmzeapxusbsuhixhbqw}"
URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

apply_file() {
  local file="$1"
  echo "Applying $(basename "$file")..."
  python3 - "$file" <<'PY'
import json, re, sys, time, urllib.request
access = __import__('os').environ['SUPABASE_ACCESS_TOKEN']
project = __import__('os').environ.get('SUPABASE_PROJECT_REF', 'glmzeapxusbsuhixhbqw')
url = f'https://api.supabase.com/v1/projects/{project}/database/query'
path = sys.argv[1]
sql = open(path).read()
blocks = [b.strip() for b in re.split(r';\s*\n', sql) if b.strip()]
for i, block in enumerate(blocks, 1):
    query = block if block.rstrip().endswith(';') else block + ';'
    payload = json.dumps({'query': query}).encode()
    req = urllib.request.Request(url, data=payload, headers={'Authorization': f'Bearer {access}', 'Content-Type': 'application/json'}, method='POST')
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                resp.read()
            print(f'  block {i}/{len(blocks)} OK')
            break
        except Exception as exc:
            if attempt == 5:
                raise
            time.sleep(2 * (attempt + 1))
    time.sleep(1.2)
PY
}

apply_file "$ROOT/supabase/migrations/20260531170000_email_cms.sql"
apply_file "$ROOT/supabase/migrations/20260531170100_email_cms_seed.sql"

echo "Email CMS migrations applied."
