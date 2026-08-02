-- ALPHA DESIGN ERP v3.5: algorithm-first project control.
-- Separates posted accounting, invoices/AR, cash and forecast planning.

alter table public.project_stages
  add column if not exists weight_percent numeric(7,4)
  check(weight_percent is null or weight_percent between 0 and 100);

alter table public.tax_invoices add column if not exists due_date date;
alter table public.project_budget_versions add column if not exists expected_risk_cost bigint not null default 0 check(expected_risk_cost>=0);

create table if not exists public.project_resource_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  stage_id uuid references public.project_stages(id) on delete set null,
  plan_month date not null check(plan_month=date_trunc('month',plan_month)::date),
  planned_hours numeric(12,2) not null default 0 check(planned_hours>=0),
  cost_rate bigint not null default 0 check(cost_rate>=0),
  status text not null default 'draft' check(status in ('draft','submitted','approved','superseded','cancelled')),
  notes text,
  row_version bigint not null default 1,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,employee_id,stage_id,plan_month)
);
create index if not exists ix_resource_plan_project_month_v35 on public.project_resource_plans(company_id,project_id,plan_month,status);

create table if not exists public.project_commitments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  commitment_type text not null check(commitment_type in ('collaborator','consultant','printing','survey','travel','software','other_direct')),
  reference_no text,
  description text not null,
  amount bigint not null check(amount>=0),
  recognized_amount bigint not null default 0 check(recognized_amount>=0 and recognized_amount<=amount),
  due_date date,
  status text not null default 'approved' check(status in ('draft','submitted','approved','partially_recognized','fully_recognized','cancelled','rejected')),
  row_version bigint not null default 1,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_commitments_project_status_v35 on public.project_commitments(company_id,project_id,status,due_date);

alter table public.project_control_snapshots add column if not exists posted_cost bigint not null default 0 check(posted_cost>=0);
alter table public.project_control_snapshots add column if not exists unposted_labor_cost bigint not null default 0 check(unposted_labor_cost>=0);
alter table public.project_control_snapshots add column if not exists remaining_labor_cost bigint not null default 0 check(remaining_labor_cost>=0);
alter table public.project_control_snapshots add column if not exists committed_cost bigint not null default 0 check(committed_cost>=0);
alter table public.project_control_snapshots add column if not exists expected_risk_cost bigint not null default 0 check(expected_risk_cost>=0);
alter table public.project_control_snapshots add column if not exists invoiced_net bigint not null default 0 check(invoiced_net>=0);
alter table public.project_control_snapshots add column if not exists invoiced_gross bigint not null default 0 check(invoiced_gross>=0);
alter table public.project_control_snapshots add column if not exists collected_net bigint not null default 0 check(collected_net>=0);
alter table public.project_control_snapshots add column if not exists collected_gross bigint not null default 0 check(collected_gross>=0);
alter table public.project_control_snapshots add column if not exists receivable_gross bigint not null default 0 check(receivable_gross>=0);
alter table public.project_control_snapshots add column if not exists backlog bigint not null default 0 check(backlog>=0);
alter table public.project_control_snapshots add column if not exists actual_profit bigint not null default 0;
alter table public.project_control_snapshots add column if not exists forecast_profit bigint not null default 0;
alter table public.project_control_snapshots add column if not exists eac_method text not null default 'statistical_fallback';
alter table public.project_control_snapshots add column if not exists eac_confidence text not null default 'low' check(eac_confidence in ('low','medium','high'));
alter table public.project_control_snapshots alter column formula_version set default 'ALPHA-PROJECT-CONTROL-2.0';

create or replace function app.enforce_algorithm_first_tenant_v35() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare project_company uuid; employee_company uuid; contract_company uuid;
begin
  select company_id into project_company from public.projects where id=new.project_id;
  if project_company is null or project_company<>new.company_id then
    raise exception 'company_id does not match project';
  end if;
  if tg_table_name='project_resource_plans' then
    select company_id into employee_company from public.employees where id=new.employee_id;
    if employee_company is null or employee_company<>new.company_id then raise exception 'employee does not belong to company'; end if;
  elsif tg_table_name='project_commitments' and new.contract_id is not null then
    select company_id into contract_company from public.contracts where id=new.contract_id;
    if contract_company is null or contract_company<>new.company_id then raise exception 'contract does not belong to company'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_resource_plan_tenant_v35 on public.project_resource_plans;
create trigger trg_resource_plan_tenant_v35 before insert or update of company_id,project_id,employee_id on public.project_resource_plans for each row execute function app.enforce_algorithm_first_tenant_v35();
drop trigger if exists trg_commitment_tenant_v35 on public.project_commitments;
create trigger trg_commitment_tenant_v35 before insert or update of company_id,project_id,contract_id on public.project_commitments for each row execute function app.enforce_algorithm_first_tenant_v35();

drop trigger if exists trg_resource_plan_touch_v35 on public.project_resource_plans;
create trigger trg_resource_plan_touch_v35 before update on public.project_resource_plans for each row execute function app.touch_row();
drop trigger if exists trg_commitment_touch_v35 on public.project_commitments;
create trigger trg_commitment_touch_v35 before update on public.project_commitments for each row execute function app.touch_row();

alter table public.project_resource_plans enable row level security;
alter table public.project_commitments enable row level security;

drop policy if exists project_resource_plans_select_v35 on public.project_resource_plans;
create policy project_resource_plans_select_v35 on public.project_resource_plans for select
using(app.is_company_member(company_id) and (app.has_permission('projects.read',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));
drop policy if exists project_resource_plans_write_v35 on public.project_resource_plans;
create policy project_resource_plans_write_v35 on public.project_resource_plans for all
using(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)))
with check(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));

drop policy if exists project_commitments_select_v35 on public.project_commitments;
create policy project_commitments_select_v35 on public.project_commitments for select
using(app.is_company_member(company_id) and (app.has_permission('projects.read',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));
drop policy if exists project_commitments_write_v35 on public.project_commitments;
create policy project_commitments_write_v35 on public.project_commitments for all
using(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)))
with check(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));

create or replace view public.v_project_commitments_outstanding with (security_invoker=true) as
select c.*,
  greatest(c.amount-c.recognized_amount,0)::bigint as outstanding_amount
from public.project_commitments c
where c.status not in ('cancelled','rejected','fully_recognized');

insert into public.schema_versions(version,description) values
('3.5.0','Algorithm-first control: separate posted actuals, invoice AR, paid cash and plan-based EAC with resource plans and commitments')
on conflict(version) do update set description=excluded.description,applied_at=now();
