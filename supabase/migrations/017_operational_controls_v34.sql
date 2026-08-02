-- ALPHA DESIGN ERP v3.4: project operational control, budget versions and reliable timesheet constraints.

insert into public.permissions(code,module,name,description,risk_level) values
('projects.control','projects','Kiểm soát tài chính dự án','Xem và chốt snapshot EAC/CPI/SPI của dự án','sensitive')
on conflict(code) do update set name=excluded.name,description=excluded.description,risk_level=excluded.risk_level;

alter table public.projects add column if not exists manager_employee_id uuid references public.employees(id);
alter table public.projects add column if not exists planned_start date;
alter table public.projects add column if not exists planned_end date;
alter table public.projects add column if not exists progress_percent numeric(5,2) not null default 0 check(progress_percent between 0 and 100);
alter table public.projects add column if not exists target_margin_percent numeric(5,2) check(target_margin_percent is null or target_margin_percent between -100 and 100);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='projects_date_order_v34' and conrelid='public.projects'::regclass) then
    alter table public.projects add constraint projects_date_order_v34 check(planned_end is null or planned_start is null or planned_end>=planned_start) not valid;
  end if;
end $$;
create index if not exists ix_projects_manager_status_v34 on public.projects(company_id,manager_employee_id,status);

create table if not exists public.project_budget_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version_no int not null check(version_no>0),
  version_name text not null,
  status text not null default 'draft' check(status in ('draft','submitted','approved','superseded','cancelled')),
  contract_value bigint not null default 0 check(contract_value>=0),
  direct_budget bigint not null default 0 check(direct_budget>=0),
  contingency bigint not null default 0 check(contingency>=0),
  target_margin_percent numeric(5,2) not null default 30 check(target_margin_percent between -100 and 100),
  effective_from date not null default current_date,
  approved_by uuid,
  approved_at timestamptz,
  change_reason text,
  row_version bigint not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,version_no)
);
create unique index if not exists uq_project_budget_approved_v34 on public.project_budget_versions(project_id) where status='approved';

create table if not exists public.project_budget_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_version_id uuid not null references public.project_budget_versions(id) on delete cascade,
  stage_id uuid references public.project_stages(id) on delete set null,
  discipline_id uuid references public.disciplines(id) on delete set null,
  cost_type text not null check(cost_type in ('internal_labor','collaborator','consultant','printing','travel','software','other_direct','contingency')),
  description text not null,
  quantity numeric(14,4) not null default 1 check(quantity>=0),
  unit_rate bigint not null default 0 check(unit_rate>=0),
  amount bigint generated always as (round(quantity*unit_rate)) stored,
  planned_hours numeric(12,2) not null default 0 check(planned_hours>=0),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_project_budget_lines_version_v34 on public.project_budget_lines(budget_version_id,cost_type);

create table if not exists public.project_control_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  snapshot_date date not null,
  progress_percent numeric(5,2) not null check(progress_percent between 0 and 100),
  schedule_progress_percent numeric(5,2) not null check(schedule_progress_percent between 0 and 100),
  direct_budget bigint not null check(direct_budget>=0),
  actual_labor_cost bigint not null default 0 check(actual_labor_cost>=0),
  actual_non_labor_cost bigint not null default 0 check(actual_non_labor_cost>=0),
  actual_cost bigint generated always as (actual_labor_cost+actual_non_labor_cost) stored,
  earned_value bigint not null default 0 check(earned_value>=0),
  planned_value bigint not null default 0 check(planned_value>=0),
  estimate_at_completion bigint not null default 0 check(estimate_at_completion>=0),
  collected_amount bigint not null default 0 check(collected_amount>=0),
  recognized_revenue bigint not null default 0,
  formula_version text not null default 'ALPHA-PROJECT-CONTROL-1.0',
  source_cutoff timestamptz not null,
  calculation_details jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(project_id,snapshot_date,formula_version)
);
create index if not exists ix_project_control_snapshots_company_date_v34 on public.project_control_snapshots(company_id,snapshot_date desc);

create or replace function app.enforce_project_control_tenant_v34() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare parent_company uuid;
begin
  if tg_table_name='project_budget_versions' then
    select p.company_id into parent_company from public.projects p where p.id=new.project_id;
  elsif tg_table_name='project_budget_lines' then
    select v.company_id into parent_company from public.project_budget_versions v where v.id=new.budget_version_id;
  elsif tg_table_name='project_control_snapshots' then
    select p.company_id into parent_company from public.projects p where p.id=new.project_id;
  end if;
  if parent_company is null or parent_company<>new.company_id then raise exception 'company_id does not match parent record'; end if;
  return new;
end $$;

drop trigger if exists trg_budget_version_tenant_v34 on public.project_budget_versions;
create trigger trg_budget_version_tenant_v34 before insert or update of company_id,project_id on public.project_budget_versions for each row execute function app.enforce_project_control_tenant_v34();
drop trigger if exists trg_budget_line_tenant_v34 on public.project_budget_lines;
create trigger trg_budget_line_tenant_v34 before insert or update of company_id,budget_version_id on public.project_budget_lines for each row execute function app.enforce_project_control_tenant_v34();
drop trigger if exists trg_control_snapshot_tenant_v34 on public.project_control_snapshots;
create trigger trg_control_snapshot_tenant_v34 before insert or update of company_id,project_id on public.project_control_snapshots for each row execute function app.enforce_project_control_tenant_v34();

drop trigger if exists trg_budget_version_touch_v34 on public.project_budget_versions;
create trigger trg_budget_version_touch_v34 before update on public.project_budget_versions for each row execute function app.touch_row();
drop trigger if exists trg_budget_line_touch_v34 on public.project_budget_lines;
create trigger trg_budget_line_touch_v34 before update on public.project_budget_lines for each row execute function app.touch_row();

create or replace function app.project_control_snapshot_immutable_v34() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
begin
  raise exception 'project control snapshots are immutable; create a new snapshot/formula version';
end $$;
drop trigger if exists trg_control_snapshot_immutable_v34 on public.project_control_snapshots;
create trigger trg_control_snapshot_immutable_v34 before update or delete on public.project_control_snapshots for each row execute function app.project_control_snapshot_immutable_v34();

create or replace function app.validate_timesheet_daily_hours_v34() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare total_hours numeric(8,2);
begin
  if new.hours<=0 or new.hours>24 then raise exception 'timesheet hours must be > 0 and <= 24'; end if;
  if new.billable_hours<0 or new.billable_hours>new.hours then raise exception 'billable hours must be between 0 and hours'; end if;
  select coalesce(sum(t.hours),0)+new.hours into total_hours
  from public.timesheets t
  where t.employee_id=new.employee_id and t.work_date=new.work_date and t.id<>new.id and t.status<>'rejected';
  if total_hours>24 then raise exception 'daily timesheet total exceeds 24 hours'; end if;
  return new;
end $$;
drop trigger if exists trg_validate_timesheet_daily_hours_v34 on public.timesheets;
create trigger trg_validate_timesheet_daily_hours_v34 before insert or update of employee_id,work_date,hours,billable_hours,status on public.timesheets for each row execute function app.validate_timesheet_daily_hours_v34();

alter table public.project_budget_versions enable row level security;
alter table public.project_budget_lines enable row level security;
alter table public.project_control_snapshots enable row level security;

drop policy if exists project_budget_versions_select_v34 on public.project_budget_versions;
create policy project_budget_versions_select_v34 on public.project_budget_versions for select using(app.is_company_member(company_id) and (app.has_permission('projects.read',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));
drop policy if exists project_budget_versions_write_v34 on public.project_budget_versions;
create policy project_budget_versions_write_v34 on public.project_budget_versions for all using(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('admin',company_id))) with check(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('admin',company_id)));

drop policy if exists project_budget_lines_select_v34 on public.project_budget_lines;
create policy project_budget_lines_select_v34 on public.project_budget_lines for select using(app.is_company_member(company_id) and (app.has_permission('projects.read',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));
drop policy if exists project_budget_lines_write_v34 on public.project_budget_lines;
create policy project_budget_lines_write_v34 on public.project_budget_lines for all using(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('admin',company_id))) with check(app.is_company_member(company_id) and (app.has_permission('projects.write',company_id) or app.has_permission('admin',company_id)));

drop policy if exists project_control_snapshots_select_v34 on public.project_control_snapshots;
create policy project_control_snapshots_select_v34 on public.project_control_snapshots for select using(app.is_company_member(company_id) and (app.has_permission('projects.read',company_id) or app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));
drop policy if exists project_control_snapshots_insert_v34 on public.project_control_snapshots;
create policy project_control_snapshots_insert_v34 on public.project_control_snapshots for insert with check(app.is_company_member(company_id) and (app.has_permission('projects.control',company_id) or app.has_permission('admin',company_id)));

insert into public.schema_versions(version,description) values
('3.4.0','Operational control: project budget versions, EAC/CPI/SPI snapshots, strict daily timesheet validation and production environment separation')
on conflict(version) do update set description=excluded.description,applied_at=now();
