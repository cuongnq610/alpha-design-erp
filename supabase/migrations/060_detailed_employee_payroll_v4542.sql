-- ALPHA DESIGN ERP Cloud v4.5.42
-- Detailed employee payroll, immutable approval workflow and reporting view.

insert into public.schema_versions(version,description) values
('4.5.42','Detailed employee payroll by period and employee, timesheet linkage, deductions, PIT, employer cost and project recovery')
on conflict(version) do update set description=excluded.description;


-- The browser sync stream keeps payroll data available offline and uses the same
-- optimistic-concurrency contract as other operational collections.
create or replace function app.collection_permission(p_collection text,p_write boolean default false)
returns text language sql immutable as $$
  select case
    when p_collection in ('projects','projectStages','tasks','resourcePlans','commitments','projectBudgetVersions','projectBudgetLines')
      then case when p_write then 'projects.write' else 'projects.read' end
    when p_collection in ('clients','quotes','contracts','billingMilestones','paymentAllocations')
      then case when p_write then 'crm.write' else 'crm.read' end
    when p_collection in ('people')
      then case when p_write then 'hr.write' else 'hr.read' end
    when p_collection in ('timesheets')
      then case when p_write then 'timesheet.write' else 'timesheet.read' end
    when p_collection in ('payrollPeriods','payrollItems')
      then case when p_write then 'payroll.write' else 'payroll.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','accountingPeriods','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection in ('documents')
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings' then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system' then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

alter function app.validate_entity_payload(uuid,text,text,jsonb) rename to validate_entity_payload_pre_v4542;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare status_value text; gross numeric; deductions numeric;
begin
  if p_collection='payrollPeriods' then
    perform app.assert_required_text(p_payload,'payrollPeriods.periodCode',120,'periodCode','period_code');
    perform app.assert_json_month(p_payload,'payrollPeriods.month',true,'month','monthKey','month_key');
    perform app.assert_json_date(p_payload,'payrollPeriods.dateFrom',true,'dateFrom','date_from');
    perform app.assert_json_date(p_payload,'payrollPeriods.dateTo',true,'dateTo','date_to');
    status_value:=lower(app.assert_required_text(p_payload,'payrollPeriods.status',30,'status'));
    if status_value not in ('draft','reviewed','approved','locked','open','calculating','posted') then
      raise exception 'INVALID_ENUM: payrollPeriods.status' using errcode='22023';
    end if;
    return;
  elsif p_collection='payrollItems' then
    perform app.assert_entity_ref(p_company,'payrollPeriods',app.json_text(p_payload,'payrollPeriodId','payroll_period_id'),true,'payrollItems.payrollPeriodId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'personId','employeeId','employee_id'),true,'payrollItems.personId');
    perform app.assert_json_number(p_payload,'payrollItems.unpaidLeaveDays',0,31,false,'unpaidLeaveDays','unpaid_leave_days');
    perform app.assert_json_number(p_payload,'payrollItems.allowances',0,null::numeric,false,'allowances');
    perform app.assert_json_number(p_payload,'payrollItems.overtimePay',0,null::numeric,false,'overtimePay','overtime');
    perform app.assert_json_number(p_payload,'payrollItems.bonus',0,null::numeric,false,'bonus');
    perform app.assert_json_number(p_payload,'payrollItems.otherIncome',0,null::numeric,false,'otherIncome','other_income');
    perform app.assert_json_number(p_payload,'payrollItems.employeeInsurance',0,null::numeric,false,'employeeInsurance','employee_insurance');
    perform app.assert_json_number(p_payload,'payrollItems.employerInsurance',0,null::numeric,false,'employerInsurance','employer_insurance');
    perform app.assert_json_number(p_payload,'payrollItems.personalIncomeTax',0,null::numeric,false,'personalIncomeTax','personal_income_tax');
    perform app.assert_json_number(p_payload,'payrollItems.advanceDeduction',0,null::numeric,false,'advanceDeduction','advance_deduction');
    perform app.assert_json_number(p_payload,'payrollItems.otherDeductions',0,null::numeric,false,'otherDeductions','other_deductions');
    gross:=coalesce(app.json_number(p_payload,'grossIncome','gross_income'),0);
    deductions:=coalesce(app.json_number(p_payload,'employeeInsurance','employee_insurance'),0)+coalesce(app.json_number(p_payload,'personalIncomeTax','personal_income_tax'),0)+coalesce(app.json_number(p_payload,'advanceDeduction','advance_deduction'),0)+coalesce(app.json_number(p_payload,'otherDeductions','other_deductions'),0);
    if gross>0 and deductions>gross then raise exception 'NEGATIVE_NET_PAY: deductions exceed gross income' using errcode='23514'; end if;
    return;
  end if;
  perform app.validate_entity_payload_pre_v4542(p_company,p_collection,p_record_id,p_payload);
end $$;

revoke all on function app.validate_entity_payload_pre_v4542(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

alter table public.payroll_periods
  add column if not exists month_key text,
  add column if not exists prepared_by uuid,
  add column if not exists prepared_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists locked_at timestamptz,
  add column if not exists calculation_version text not null default 'ALPHA-PAYROLL-4.5.42',
  add column if not exists workflow_history jsonb not null default '[]'::jsonb;

update public.payroll_periods
set month_key=to_char(date_from,'YYYY-MM')
where month_key is null or month_key='';

alter table public.payroll_items
  add column if not exists standard_workdays numeric(8,2) not null default 0,
  add column if not exists payable_workdays numeric(8,2) not null default 0,
  add column if not exists unpaid_leave_days numeric(8,2) not null default 0,
  add column if not exists approved_hours numeric(10,2) not null default 0,
  add column if not exists billable_hours numeric(10,2) not null default 0,
  add column if not exists base_salary bigint not null default 0,
  add column if not exists bonus bigint not null default 0,
  add column if not exists other_income bigint not null default 0,
  add column if not exists advance_deduction bigint not null default 0,
  add column if not exists project_allocated_cost bigint not null default 0,
  add column if not exists recoverable_revenue bigint not null default 0,
  add column if not exists utilization_percent numeric(9,4) not null default 0,
  add column if not exists chargeability_percent numeric(9,4) not null default 0,
  add column if not exists recovery_ratio_percent numeric(9,4) not null default 0,
  add column if not exists pit_mode text not null default 'Manual review',
  add column if not exists notes text not null default '',
  add column if not exists calculation_version text not null default 'ALPHA-PAYROLL-4.5.42';

do $$ begin
  alter table public.payroll_items add constraint payroll_items_v4542_nonnegative check(
    standard_workdays>=0 and payable_workdays>=0 and unpaid_leave_days>=0 and approved_hours>=0 and billable_hours>=0
    and base_salary>=0 and bonus>=0 and other_income>=0 and advance_deduction>=0
    and project_allocated_cost>=0 and recoverable_revenue>=0 and utilization_percent>=0
    and chargeability_percent>=0 and recovery_ratio_percent>=0
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.payroll_items add constraint payroll_items_v4542_days_valid check(payable_workdays<=standard_workdays and unpaid_leave_days<=standard_workdays);
exception when duplicate_object then null; end $$;

create or replace function app.guard_payroll_item_mutation_v4542()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare period_status text;
begin
  select status into period_status from public.payroll_periods where id=coalesce(new.payroll_period_id,old.payroll_period_id);
  if period_status in ('approved','posted','locked') then
    raise exception 'payroll period is immutable after approval' using errcode='55000';
  end if;
  if tg_op<>'DELETE' then
    if coalesce(new.base_salary,0)+coalesce(new.allowances,0)+coalesce(new.overtime,0)+coalesce(new.bonus,0)+coalesce(new.other_income,0)
       < coalesce(new.employee_insurance,0)+coalesce(new.personal_income_tax,0)+coalesce(new.advance_deduction,0)+coalesce(new.other_deductions,0) then
      raise exception 'payroll net pay cannot be negative' using errcode='23514';
    end if;
    new.calculation_version='ALPHA-PAYROLL-4.5.42';
    new.updated_at=clock_timestamp();
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists trg_guard_payroll_item_mutation_v4542 on public.payroll_items;
create trigger trg_guard_payroll_item_mutation_v4542
before insert or update or delete on public.payroll_items
for each row execute function app.guard_payroll_item_mutation_v4542();

create or replace function app.guard_payroll_period_workflow_v4542()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app as $$
begin
  if tg_op='UPDATE' and new.status is distinct from old.status then
    if not ((old.status in ('open','calculating') and new.status='reviewed') or
            (old.status='reviewed' and new.status='approved') or
            (old.status='approved' and new.status in ('posted','locked')) or
            (old.status='posted' and new.status='locked')) then
      raise exception 'invalid payroll workflow transition: % -> %',old.status,new.status using errcode='22023';
    end if;
    if new.status='reviewed' then
      new.reviewed_by=coalesce(new.reviewed_by,app.current_user_id());new.reviewed_at=coalesce(new.reviewed_at,clock_timestamp());
    elsif new.status='approved' then
      if old.reviewed_by is not null and old.reviewed_by=coalesce(new.approved_by,app.current_user_id()) then raise exception 'payroll approver must differ from reviewer' using errcode='42501'; end if;
      new.approved_by=coalesce(new.approved_by,app.current_user_id());new.approved_at=coalesce(new.approved_at,clock_timestamp());
    elsif new.status='locked' then
      new.locked_by=coalesce(new.locked_by,app.current_user_id());new.locked_at=coalesce(new.locked_at,clock_timestamp());
    end if;
    new.workflow_history=coalesce(old.workflow_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('action',upper(new.status),'at',clock_timestamp(),'by',app.current_user_id()));
  end if;
  new.month_key=coalesce(nullif(new.month_key,''),to_char(new.date_from,'YYYY-MM'));
  new.calculation_version='ALPHA-PAYROLL-4.5.42';new.updated_at=clock_timestamp();
  return new;
end $$;

drop trigger if exists trg_guard_payroll_period_workflow_v4542 on public.payroll_periods;
create trigger trg_guard_payroll_period_workflow_v4542
before insert or update on public.payroll_periods
for each row execute function app.guard_payroll_period_workflow_v4542();

create or replace view public.v_payroll_employee_detail_v4542
with (security_invoker=true) as
select
  pp.company_id,pp.id payroll_period_id,pp.period_code,pp.month_key,pp.date_from,pp.date_to,pp.status period_status,
  pi.id payroll_item_id,pi.employee_id,e.employee_no employee_code,e.full_name,d.name department,e.job_title,e.employment_type,
  pi.standard_workdays,pi.payable_workdays,pi.unpaid_leave_days,pi.approved_hours,pi.billable_hours,
  pi.base_salary,pi.allowances,pi.overtime overtime_pay,pi.bonus,pi.other_income,
  (pi.base_salary+pi.allowances+pi.overtime+pi.bonus+pi.other_income) gross_income,
  pi.employee_insurance,pi.personal_income_tax,pi.advance_deduction,pi.other_deductions,
  (pi.base_salary+pi.allowances+pi.overtime+pi.bonus+pi.other_income-pi.employee_insurance-pi.personal_income_tax-pi.advance_deduction-pi.other_deductions) net_pay,
  pi.employer_insurance,
  (pi.base_salary+pi.allowances+pi.overtime+pi.bonus+pi.other_income+pi.employer_insurance) total_employer_cost,
  pi.project_allocated_cost,pi.recoverable_revenue,pi.utilization_percent,pi.chargeability_percent,pi.recovery_ratio_percent,
  pi.pit_mode,pi.notes,pi.calculation_version,pi.updated_at
from public.payroll_items pi
join public.payroll_periods pp on pp.id=pi.payroll_period_id
join public.employees e on e.id=pi.employee_id and e.company_id=pi.company_id
left join public.departments d on d.id=e.department_id and d.company_id=e.company_id;

grant select on public.v_payroll_employee_detail_v4542 to authenticated;

-- Rebind statutory certification to the current release and migration.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.42'
where status='active' and release_version<>'4.5.42';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.42' or p_migration_version<>60 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;
