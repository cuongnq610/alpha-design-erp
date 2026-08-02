import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/064_sticky_table_workflow_formula_hardened_v4546.sql','utf8');
const schema=fs.readFileSync('SUPABASE_PRODUCTION_SCHEMA.sql','utf8');
for(const marker of ["('4.5.46'","p_release_version<>'4.5.46'",'p_migration_version<>64','superseded by release 4.5.46']) assert.ok(sql.includes(marker),`missing migration 064 marker ${marker}`);
assert.ok(schema.includes('-- SOURCE: 064_sticky_table_workflow_formula_hardened_v4546.sql')&&schema.includes(sql.trim()),'consolidated schema must include exact migration 064 before later migrations');
console.log('PASS v4.5.46 statutory certification binding and migration ordering');
