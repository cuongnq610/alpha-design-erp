import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/074_recycle_bin_restore_v4566.sql'),'utf8');
const schema=fs.readFileSync(path.join(root,'SUPABASE_PRODUCTION_SCHEMA.sql'),'utf8');

for(const marker of [
  "('4.5.66','Recycle bin with original payload",
  "when p_collection='trashEntries'",
  "collection='trashEntries' and (app.has_permission('security.manage'",
  'TRASH_SOURCE_MISMATCH',
  'AUTHORITATIVE_TRASH_RETENTION',
  'TRASH_ENTRY_IMMUTABLE',
  'MFA_AAL2_REQUIRED_FOR_TRASH_MANAGEMENT',
  'finalize_trash_entry_v4566',
  'purge_expired_trash_entries_v4566',
  'alpha-recycle-bin-30-day-purge',
  "p_release_version<>'4.5.66' or p_migration_version<>74"
])assert.ok(migration.includes(marker),`Missing migration marker ${marker}`);
assert.ok(migration.includes("expires_at_value<deleted_at_value+interval '30 days'")&&migration.includes("retentionDays')::numeric,0)<>30"),'Server must enforce the exact 30-day retention contract');
assert.ok(migration.includes("delete from public.entity_records r where r.company_id=new.company_id and r.collection=new.data->>'entityType'")&&migration.includes("r.deleted_at is not null"),'Permanent purge must hard-delete only a still-deleted source record');
assert.ok(schema.includes('-- SOURCE: 074_recycle_bin_restore_v4566.sql')&&schema.includes(migration.trim()),'Consolidated schema must contain exact migration 074 before later release-binding migrations');
console.log('PASS v4.5.66 migration 074 recycle-bin RLS, payload/source validation, MFA restore/purge and automatic retention');
