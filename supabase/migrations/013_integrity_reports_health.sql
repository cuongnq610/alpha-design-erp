-- Data-quality gates, report snapshots and strict accounting-period close.

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_code text not null,
  period_from date not null,
  period_to date not null,
  parameters jsonb not null default '{}'::jsonb,
  report_data jsonb not null,
  data_hash text not null,
  generated_by uuid,
  generated_at timestamptz not null default clock_timestamp(),
  status text not null default 'generated' check(status in ('generated','reviewed','signed','superseded')),
  row_version bigint not null default 1,
  updated_at timestamptz not null default now(),
  signed_by uuid,
  signed_at timestamptz,
  signature_reference text,
  unique(company_id,report_code,period_from,period_to,data_hash)
);

alter table public.report_snapshots enable row level security;
create policy report_snapshots_select_v3 on public.report_snapshots for select
using(app.is_company_member(company_id) and app.has_permission('accounting.read',company_id));
create policy report_snapshots_insert_v3 on public.report_snapshots for insert
with check(app.is_company_member(company_id) and app.has_permission('accounting.write',company_id));
create policy report_snapshots_update_v3 on public.report_snapshots for update
using(app.is_company_member(company_id) and app.has_permission('accounting.close',company_id))
with check(app.is_company_member(company_id));
grant select,insert,update on public.report_snapshots to authenticated;

create or replace view public.v_project_financials with (security_invoker=true) as
with revenue as (
  select jl.company_id,coalesce(jl.project_id,je.project_id) project_id,
    sum(jl.credit-jl.debit)::bigint amount
  from public.journal_lines jl
  join public.journal_entries je on je.id=jl.entry_id and je.status='posted'
  join public.accounts a on a.id=jl.account_id and a.code like '511%'
  group by jl.company_id,coalesce(jl.project_id,je.project_id)
), cost as (
  select jl.company_id,coalesce(jl.project_id,je.project_id) project_id,
    sum(jl.debit-jl.credit)::bigint amount
  from public.journal_lines jl
  join public.journal_entries je on je.id=jl.entry_id and je.status='posted'
  join public.accounts a on a.id=jl.account_id and (a.code like '632%' or a.code like '154%')
  group by jl.company_id,coalesce(jl.project_id,je.project_id)
), labor as (
  select company_id,project_id,sum(cost_amount)::bigint labor_cost,
    sum(recoverable_revenue)::bigint recoverable_revenue,
    sum(hours)::numeric(14,2) hours,sum(billable_hours)::numeric(14,2) billable_hours
  from public.timesheets where status in ('approved','locked') group by company_id,project_id
)
select p.company_id,p.id project_id,p.code,p.name,p.status,p.contract_value,p.direct_budget,
  coalesce(r.amount,0)::bigint recognized_revenue,
  coalesce(c.amount,0)::bigint accounting_cost,
  coalesce(l.labor_cost,0)::bigint management_labor_cost,
  coalesce(l.recoverable_revenue,0)::bigint recoverable_revenue,
  coalesce(l.hours,0)::numeric(14,2) approved_hours,
  coalesce(l.billable_hours,0)::numeric(14,2) billable_hours,
  (coalesce(r.amount,0)-coalesce(c.amount,0))::bigint accounting_profit,
  case when coalesce(r.amount,0)=0 then 0 else round((coalesce(r.amount,0)-coalesce(c.amount,0))*100.0/r.amount,2) end profit_margin_percent,
  case when coalesce(l.hours,0)=0 then 0 else round(l.billable_hours*100.0/l.hours,2) end utilization_percent
from public.projects p
left join revenue r on r.company_id=p.company_id and r.project_id=p.id
left join cost c on c.company_id=p.company_id and c.project_id=p.id
left join labor l on l.company_id=p.company_id and l.project_id=p.id;

create or replace view public.v_payroll_summary with (security_invoker=true) as
select pp.company_id,pp.id payroll_period_id,pp.period_code,pp.date_from,pp.date_to,pp.status,
  count(pi.id)::int employee_count,
  coalesce(sum(pi.gross_salary),0)::bigint gross_salary,
  coalesce(sum(pi.allowances+pi.overtime),0)::bigint additions,
  coalesce(sum(pi.employee_insurance+pi.personal_income_tax+pi.other_deductions),0)::bigint employee_deductions,
  coalesce(sum(pi.employer_insurance),0)::bigint employer_insurance,
  coalesce(sum(pi.net_salary),0)::bigint net_salary,
  coalesce(sum(pi.total_employer_cost),0)::bigint total_employer_cost
from public.payroll_periods pp left join public.payroll_items pi on pi.payroll_period_id=pp.id
group by pp.id;

create or replace function app.validate_database_integrity(
  p_company uuid,p_from date default null,p_to date default null
) returns table(check_code text,check_name text,status text,issue_count bigint,details jsonb)
language plpgsql stable security definer set search_path=pg_catalog,public,app as $$
declare d_from date:=coalesce(p_from,date_trunc('year',current_date)::date); d_to date:=coalesce(p_to,current_date); n bigint; diff bigint; audit_ok boolean; audit_broken bigint; audit_reason text;
begin
  perform app.assert_company_access(p_company);

  select count(*) into n from public.journal_entries je
  where je.company_id=p_company and je.status='posted' and not exists(
    select 1 from public.journal_lines jl where jl.entry_id=je.id
    group by jl.entry_id having sum(jl.debit)=sum(jl.credit) and sum(jl.debit)>0 and count(*)>=2
  );
  return query select 'JOURNAL_BALANCE','Chứng từ đã ghi sổ cân Nợ/Có',case when n=0 then 'PASS' else 'FAIL' end,n,jsonb_build_object('period_from',d_from,'period_to',d_to);

  select abs(coalesce(sum(jl.debit),0)-coalesce(sum(jl.credit),0))::bigint into diff
  from public.journal_lines jl join public.journal_entries je on je.id=jl.entry_id
  where je.company_id=p_company and je.status='posted' and je.document_date between d_from and d_to;
  return query select 'TRIAL_BALANCE','Tổng phát sinh Nợ bằng Có',case when diff=0 then 'PASS' else 'FAIL' end,diff,jsonb_build_object('difference',diff);

  select count(*) into n from public.journal_entries je
  where je.company_id=p_company and je.status='posted' and je.document_date between d_from and d_to
    and exists(select 1 from public.accounting_periods p where p.company_id=je.company_id and je.document_date between p.date_from and p.date_to and p.status='hard_locked' and je.posted_at>p.locked_at);
  return query select 'LOCKED_PERIOD','Không ghi sổ sau khi khóa cứng',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select count(*) into n from public.tax_invoices ti
  where ti.company_id=p_company and ti.invoice_date between d_from and d_to
    and ti.total_amount<>ti.tax_base+ti.vat_amount;
  return query select 'VAT_ARITHMETIC','Tổng hóa đơn bằng giá tính thuế cộng VAT',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select count(*) into n from (
    select a.payment_id
    from public.payment_allocations a join public.payments p on p.id=a.payment_id
    where a.company_id=p_company
    group by a.payment_id,p.amount
    having sum(a.allocated_amount)>p.amount
  ) over_allocated;
  return query select 'PAYMENT_ALLOCATION','Không phân bổ vượt số tiền thanh toán',case when coalesce(n,0)=0 then 'PASS' else 'FAIL' end,coalesce(n,0),'{}'::jsonb;

  select count(*) into n from public.timesheets t
  where t.company_id=p_company and t.work_date between d_from and d_to and (t.billable_hours>t.hours or t.hours<=0 or t.hours>24);
  return query select 'TIMESHEET_HOURS','Giờ billable không vượt tổng giờ',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select count(*) into n from public.payroll_items pi
  where pi.company_id=p_company and pi.net_salary<0;
  return query select 'PAYROLL_NET','Lương thực nhận không âm',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select valid,broken_at,reason into audit_ok,audit_broken,audit_reason from app.verify_audit_chain(p_company);
  return query select 'AUDIT_CHAIN','Chuỗi audit bất biến hợp lệ',case when audit_ok then 'PASS' else 'FAIL' end,case when audit_ok then 0 else 1 end,jsonb_build_object('broken_at',audit_broken,'reason',audit_reason);
end $$;

create or replace function app.generate_report_snapshot(
  p_report_code text,p_from date,p_to date,p_parameters jsonb default '{}'::jsonb
) returns public.report_snapshots
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); payload jsonb; h text; r public.report_snapshots;
begin
  if not app.has_permission('accounting.write',cid) then raise exception 'permission denied'; end if;
  if upper(p_report_code) not in ('B01A-DNN','B02-DNN','B03-DNN','B09-DNN','F01-DNN') then raise exception 'unsupported report code'; end if;
  payload:=case upper(p_report_code)
    when 'B01A-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b01a_dnn(p_from,p_to) x)
    when 'B02-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b02_dnn(p_from,p_to) x)
    when 'B03-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b03_dnn(p_from,p_to) x)
    when 'B09-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b09_dnn(p_from,p_to) x)
    when 'F01-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_f01_dnn(p_from,p_to) x)
    else null
  end;
  payload:=coalesce(payload,'[]'::jsonb);
  h:=encode(extensions.digest(convert_to(jsonb_build_object('report',upper(p_report_code),'from',p_from,'to',p_to,'parameters',p_parameters,'data',payload)::text,'UTF8'),'sha256'),'hex');
  insert into public.report_snapshots(company_id,report_code,period_from,period_to,parameters,report_data,data_hash,generated_by)
  values(cid,upper(p_report_code),p_from,p_to,p_parameters,payload,h,app.current_user_id()) returning * into r;
  perform app.append_audit(cid,'report_snapshots',r.id::text,'SIGNOFF',null,to_jsonb(r));
  return r;
end $$;

create or replace function app.close_accounting_period_strict(
  p_period uuid,p_expected_version bigint,p_hard boolean default true
) returns public.accounting_periods
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare r public.accounting_periods; c record; failures text[]:='{}';
begin
  select * into r from public.accounting_periods where id=p_period for update;
  if not found or not app.has_permission('accounting.close',r.company_id) then raise exception 'permission denied'; end if;
  if r.row_version<>p_expected_version then raise exception 'concurrent update' using errcode='40001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('period-close|'||r.company_id::text||'|'||r.date_from::text,0));
  if exists(select 1 from public.journal_entries where company_id=r.company_id and document_date between r.date_from and r.date_to and status='draft') then failures:=array_append(failures,'Còn chứng từ nháp'); end if;
  if exists(select 1 from app.validate_database_integrity(r.company_id,r.date_from,r.date_to) where status='FAIL') then failures:=array_append(failures,'Kiểm tra toàn vẹn dữ liệu chưa đạt'); end if;
  if exists(select 1 from public.bank_reconciliations where company_id=r.company_id and period_end=r.date_to and status not in ('approved','locked')) then failures:=array_append(failures,'Đối chiếu ngân hàng chưa phê duyệt'); end if;
  if cardinality(failures)>0 then raise exception 'period close rejected: %',array_to_string(failures,'; '); end if;
  update public.accounting_periods set status=case when p_hard then 'hard_locked' else 'soft_locked' end,locked_at=clock_timestamp(),locked_by=app.current_user_id()
  where id=r.id returning * into r;
  perform app.append_audit(r.company_id,'accounting_periods',r.id::text,'LOCK',null,to_jsonb(r));
  return r;
end $$;
