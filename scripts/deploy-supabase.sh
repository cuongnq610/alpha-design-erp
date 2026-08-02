#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF}"
command -v supabase >/dev/null || { echo 'Install Supabase CLI first.'; exit 1; }
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
printf 'SUPABASE_MIGRATIONS_APPLIED\n'
