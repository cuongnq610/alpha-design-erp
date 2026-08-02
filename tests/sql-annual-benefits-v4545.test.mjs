import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/063_annual_bonus_travel_fund_v4545.sql',import.meta.url),'utf8');
for(const marker of ["('4.5.45'","annualBenefitBudgets","p_release_version<>'4.5.45'",'p_migration_version<>63','guard_annual_benefit_budget_entity_v4545','MFA AAL2 required for annual benefit approval/lock','Reviewer and approver must be different users'])assert.ok(sql.includes(marker),`missing migration 063 marker ${marker}`);
assert.ok(sql.includes("when p_collection in ('payrollPeriods','payrollItems','annualBenefitBudgets')"),'annual benefit collection permission missing');
assert.ok(sql.includes("old_status='locked'")&&sql.includes("old_status='approved'"),'immutable approved/locked workflow guard missing');
console.log('PASS v4.5.45 annual benefit Supabase validation, workflow and certification binding');
