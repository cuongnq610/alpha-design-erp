import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/057_company_profile_dynamic_reporting_period_v4539.sql',import.meta.url),'utf8');
assert.match(sql,/\('4\.5\.39','Company profile propagation/);
assert.match(sql,/p_release_version<>'4\.5\.39' or p_migration_version<>57/);
assert.match(sql,/superseded by release 4\.5\.39/);
assert.match(sql,/create or replace function app\.certify_tt133_release/);
assert.match(sql,/create or replace function public\.certify_tt133_release/);
console.log('PASS v4.5.39 SQL release binding migration 057');
