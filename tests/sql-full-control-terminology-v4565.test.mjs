import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/073_full_control_terminology_release_v4565.sql',import.meta.url),'utf8');
const migration74=readFileSync(new URL('../supabase/migrations/074_recycle_bin_restore_v4566.sql',import.meta.url),'utf8');
const schema=readFileSync(new URL('../SUPABASE_PRODUCTION_SCHEMA.sql',import.meta.url),'utf8');

for(const marker of [
  "('4.5.65','Display complete Vietnamese names for operational-control metrics",
  "active_release_version set default '4.5.65'",
  "active_release_version is null or active_release_version='4.5.64'",
  "superseded by release 4.5.65",
  "p_release_version<>'4.5.65' or p_migration_version<>73",
  'certify_tt133_release'
]) assert.ok(migration.includes(marker),`Migration 073 is missing ${marker}`);

assert.ok(schema.includes('SOURCE: 073_full_control_terminology_release_v4565.sql'));
assert.ok(schema.indexOf(migration.trim())<schema.indexOf(migration74.trim()),'Migration 073 must remain ordered before migration 074');

console.log('PASS v4.5.65 migration 073 release binding and certification guard');
