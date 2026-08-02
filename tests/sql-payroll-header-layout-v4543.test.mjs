import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/061_payroll_header_layout_refinement_v4543.sql',import.meta.url),'utf8');
for(const marker of ["('4.5.43'","p_release_version<>'4.5.43'","p_migration_version<>61",'certify_tt133_release'])assert.ok(sql.includes(marker),`missing migration 061 marker ${marker}`);
console.log('PASS migration 061 release marker and statutory certification binding');
