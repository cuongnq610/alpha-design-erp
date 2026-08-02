#!/usr/bin/env bash
set -euo pipefail
: "${BACKUP_FILE:?Set BACKUP_FILE to a .dump file}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to an EMPTY scratch PostgreSQL database}"
sha256sum -c "$BACKUP_FILE.sha256"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Journal entries must balance.
do $$ begin
 if exists(
  select 1 from journal_entries je join journal_lines jl on jl.entry_id=je.id
  where je.status='posted' group by je.id having sum(jl.debit)<>sum(jl.credit) or sum(jl.debit)<=0
 ) then raise exception 'RESTORE_VERIFY_FAIL: unbalanced posted journals'; end if;
end $$;
-- Posted records must have hashes and no orphan lines.
do $$ begin
 if exists(select 1 from journal_entries where status='posted' and posting_hash is null) then
  raise exception 'RESTORE_VERIFY_FAIL: posted journal missing hash'; end if;
 if exists(select 1 from journal_lines jl left join journal_entries je on je.id=jl.entry_id where je.id is null) then
  raise exception 'RESTORE_VERIFY_FAIL: orphan journal lines'; end if;
end $$;
select 'ROW_COUNTS' label,
 (select count(*) from journal_entries) journal_entries,
 (select count(*) from journal_lines) journal_lines,
 (select count(*) from audit_events) audit_events,
 (select count(*) from files_metadata) files_metadata;
SQL
printf 'RESTORE_VERIFY_OK %s\n' "$BACKUP_FILE"
