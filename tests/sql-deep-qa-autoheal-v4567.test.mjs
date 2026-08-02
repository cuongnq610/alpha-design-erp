import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/075_deep_qa_autoheal_v4567.sql',import.meta.url),'utf8');
for(const token of ["('4.5.67','Deep accounting and financial QA", "active_release_version set default '4.5.67'", "p_release_version<>'4.5.67' or p_migration_version<>75", 'financial_reports.certify', "app.current_aal()<>'aal2'"]){assert.ok(sql.includes(token),`Missing migration 075 contract: ${token}`);}
assert.ok(!sql.includes("active_release_version='4.5.65'"),'Migration 075 may only upgrade from the immediate v4.5.66 release');
console.log('PASS v4.5.67 migration 075 release binding, MFA certification and immediate-version upgrade contract');
