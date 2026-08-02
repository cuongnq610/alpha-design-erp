import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/071_table_scroll_continuity_release_v4563.sql',import.meta.url),'utf8');
const schema=readFileSync(new URL('../SUPABASE_PRODUCTION_SCHEMA.sql',import.meta.url),'utf8');

for(const marker of [
  "('4.5.63','Preserve vertical and horizontal table viewport",
  "active_release_version set default '4.5.63'",
  "active_release_version='4.5.62'",
  "superseded by release 4.5.63",
  "p_release_version<>'4.5.63' or p_migration_version<>71",
  'financial_reports.certify permission required',
  "app.current_aal()<>'aal2'"
]) assert.ok(migration.includes(marker),`Migration 071 is missing ${marker}`);

assert.ok(schema.includes(migration.trim()),'Consolidated schema must contain exact migration 071 source');

console.log('PASS inherited v4.5.63 migration 071 release binding and certification guard');
