#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF}"
command -v supabase >/dev/null || { echo 'Thiếu Supabase CLI.'; exit 1; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/supabase/migrations" "$TMP/supabase/functions"
cp "$ROOT/supabase/config.toml" "$TMP/supabase/config.toml"
cp "$ROOT/SUPABASE_PRODUCTION_SCHEMA.sql" "$TMP/supabase/migrations/20260723000000_alpha_design_erp_v452_baseline.sql"
cp -R "$ROOT/supabase/functions/invite-user" "$TMP/supabase/functions/invite-user"
(
  cd "$TMP"
  supabase link --project-ref "$SUPABASE_PROJECT_REF"
  supabase db push
  supabase functions deploy invite-user --project-ref "$SUPABASE_PROJECT_REF"
)
printf 'SUPABASE_BASELINE_AND_FUNCTION_DEPLOYED %s\n' "$SUPABASE_PROJECT_REF"
