import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/072_prepaint_table_viewport_release_v4564.sql',import.meta.url),'utf8');
const migration73=readFileSync(new URL('../supabase/migrations/073_full_control_terminology_release_v4565.sql',import.meta.url),'utf8');
const schema=readFileSync(new URL('../SUPABASE_PRODUCTION_SCHEMA.sql',import.meta.url),'utf8');

for(const marker of [
  "('4.5.64','Restore every table viewport synchronously before first browser paint",
  "active_release_version set default '4.5.64'",
  "active_release_version='4.5.63'",
  "superseded by release 4.5.64",
  "p_release_version<>'4.5.64' or p_migration_version<>72",
  'financial_reports.certify permission required',
  "app.current_aal()<>'aal2'"
]) assert.ok(migration.includes(marker),`Migration 072 is missing ${marker}`);

assert.ok(schema.includes(migration.trim()),'Consolidated schema must contain exact migration 072 source');
assert.ok(schema.indexOf(migration.trim())<schema.indexOf(migration73.trim()),'Migration 072 must remain ordered before migration 073');

console.log('PASS v4.5.64 migration 072 release binding and certification guard');
