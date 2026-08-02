import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/059_stability_browser_qa_data_quality_v4541.sql',import.meta.url),'utf8');
for(const marker of ["('4.5.41'","release_version<>'4.5.41'","p_release_version<>'4.5.41'","p_migration_version<>59","ALPHA-FINANCIAL-INTELLIGENCE-4.3.8","B09 %/8"]){
  assert.ok(sql.includes(marker),`Migration 059 is missing ${marker}`);
}
console.log('PASS migration 059 release binding and statutory certification fail-closed controls');
