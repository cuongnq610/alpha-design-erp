import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const sql=fs.readFileSync(path.join(root,'supabase/migrations/065_accounting_operations_tax_package_update_v4547.sql'),'utf8');
for(const marker of ["('4.5.47'",'create table if not exists public.tax_compliance_packages','package_sha256','effective_from date not null',"status in ('candidate','active','inactive','rejected')",'MFA AAL2 required to activate tax compliance packages','activate_tax_compliance_package',"p_release_version<>'4.5.47'",'p_migration_version<>65'])assert.ok(sql.includes(marker),`missing migration 065 marker ${marker}`);
assert.ok(/enable row level security/i.test(sql)&&/tax\.write permission required/i.test(sql));
console.log('PASS v4.5.47 tax package RLS, AAL2 activation and statutory certification binding');
