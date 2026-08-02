import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/062_global_table_grid_alignment_v4544.sql',import.meta.url),'utf8');
for(const marker of ["('4.5.44'","p_release_version<>'4.5.44'",'p_migration_version<>62','certify_tt133_release'])assert.ok(sql.includes(marker),`missing migration 062 marker ${marker}`);
console.log('PASS migration 062 global table grid release marker and statutory certification binding');
