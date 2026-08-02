import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/060_detailed_employee_payroll_v4542.sql',import.meta.url),'utf8');
for(const marker of ["('4.5.42'",'standard_workdays','payable_workdays','approved_hours','billable_hours','base_salary','project_allocated_cost','recoverable_revenue','utilization_percent','pit_mode','guard_payroll_item_mutation_v4542','guard_payroll_period_workflow_v4542','v_payroll_employee_detail_v4542',"p_release_version<>'4.5.42'",'p_migration_version<>60']) assert.ok(sql.includes(marker),`missing SQL marker ${marker}`);
assert.ok(/payroll approver must differ from reviewer/.test(sql));
assert.ok(/payroll period is immutable after approval/.test(sql));
console.log('PASS migration 060 detailed payroll schema, validation, workflow and release binding');
