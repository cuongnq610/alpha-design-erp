-- ALPHA DESIGN ERP Cloud v4.1.0 Financial Analytics & Forecast
-- Adds governed scenarios, immutable analysis snapshots and cross-module linkage audit evidence.

alter table public.companies alter column active_release_version set default '4.1.0';
update public.companies
set active_release_version='4.1.0',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version in ('3.9.0','3.9.1','3.9.2','4.0.0')
  and operational_mode in ('pilot','parallel','maintenance');

insert into public.permissions(code,module,name,description,risk_level) values
('financial_analytics.read','financial_analytics','Xem phân tích và dự báo tài chính','Xem hệ số tài chính, cơ cấu, tăng trưởng, forecast và ma trận liên kết','sensitive'),
('financial_analytics.write','financial_analytics','Quản trị kịch bản dự báo tài chính','Tạo/sửa giả định, chốt snapshot và thực hiện sửa liên kết chắc chắn','sensitive')
on conflict(code) do update set
  module=excluded.module,
  name=excluded.name,
  description=excluded.description,
  risk_level=excluded.risk_level;

create table if not exists public.financial_forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scenario_code text not null,
  scenario_name text not null,
  status text not null default 'active' check(status in ('draft','active','archived')),
  horizon_months int not null default 12 check(horizon_months between 3 and 36),
  assumptions jsonb not null default '{}'::jsonb,
  policy_version text not null default 'ALPHA-FINANCE-ANALYTICS-2026.01',
  approved_by uuid,
  approved_at timestamptz,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,scenario_code),
  check(jsonb_typeof(assumptions)='object')
);

create table if not exists public.financial_analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_date date not null,
  period_from date not null,
  period_to date not null,
  scenario_id uuid references public.financial_forecast_scenarios(id) on delete set null,
  formula_version text not null,
  data_quality_score numeric(5,2) not null default 0 check(data_quality_score between 0 and 100),
  linkage_score numeric(5,2) not null default 0 check(linkage_score between 0 and 100),
  source_checksum text,
  position jsonb not null default '{}'::jsonb,
  ratios jsonb not null default '[]'::jsonb,
  forecast jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  check(period_to >= period_from),
  check(jsonb_typeof(position)='object'),
  check(jsonb_typeof(ratios)='array'),
  check(jsonb_typeof(forecast)='object')
);

create table if not exists public.financial_link_audit_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_date timestamptz not null default now(),
  period_from date,
  period_to date,
  score numeric(5,2) not null check(score between 0 and 100),
  critical_issues int not null default 0 check(critical_issues >= 0),
  warning_issues int not null default 0 check(warning_issues >= 0),
  repairs_applied int not null default 0 check(repairs_applied >= 0),
  audit_rows jsonb not null default '[]'::jsonb,
  repair_evidence jsonb not null default '[]'::jsonb,
  formula_version text not null,
  executed_by uuid,
  created_at timestamptz not null default now(),
  check(period_to is null or period_from is null or period_to >= period_from),
  check(jsonb_typeof(audit_rows)='array'),
  check(jsonb_typeof(repair_evidence)='array')
);

create index if not exists ix_financial_scenarios_company_status on public.financial_forecast_scenarios(company_id,status);
create index if not exists ix_financial_snapshots_company_period on public.financial_analysis_snapshots(company_id,period_to desc);
create index if not exists ix_financial_link_audit_company_date on public.financial_link_audit_runs(company_id,audit_date desc);

alter table public.financial_forecast_scenarios enable row level security;
alter table public.financial_analysis_snapshots enable row level security;
alter table public.financial_link_audit_runs enable row level security;

do $$
declare r record;
begin
  for r in select * from (values
    ('financial_forecast_scenarios','financial_analytics.read','financial_analytics.write'),
    ('financial_analysis_snapshots','financial_analytics.read','financial_analytics.write'),
    ('financial_link_audit_runs','financial_analytics.read','financial_analytics.write')
  ) v(table_name,read_permission,write_permission)
  loop
    execute format('drop policy if exists %I on public.%I',r.table_name||'_select_v410',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_insert_v410',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_update_v410',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_delete_v410',r.table_name);
    execute format(
      'create policy %I on public.%I for select using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''reports.read'',company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_select_v410',r.table_name,r.read_permission
    );
    execute format(
      'create policy %I on public.%I for insert with check (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_insert_v410',r.table_name,r.write_permission
    );
    execute format(
      'create policy %I on public.%I for update using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id))) with check (app.is_company_member(company_id))',
      r.table_name||'_update_v410',r.table_name,r.write_permission
    );
    execute format(
      'create policy %I on public.%I for delete using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_delete_v410',r.table_name,r.write_permission
    );
  end loop;
end $$;

drop trigger if exists trg_financial_scenario_touch_v410 on public.financial_forecast_scenarios;
create trigger trg_financial_scenario_touch_v410 before update on public.financial_forecast_scenarios for each row execute function app.touch_row();

insert into public.role_permissions(role_id,permission_code)
select r.id,p.permission_code
from public.roles r
cross join (values ('financial_analytics.read')) p(permission_code)
where upper(r.code) in ('ADMIN','DIRECTOR','CEO','CFO','CHIEF_ACCOUNTANT','ACCOUNTANT','AUDITOR')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_code)
select r.id,p.permission_code
from public.roles r
cross join (values ('financial_analytics.write')) p(permission_code)
where upper(r.code) in ('ADMIN','DIRECTOR','CEO','CFO','CHIEF_ACCOUNTANT')
on conflict do nothing;

insert into public.schema_versions(version,description) values
('4.1.0','Financial Analytics & Forecast: posted-ledger ratios, prior-period growth and structure analysis, governed scenarios, 3-36 month P&L/cash forecast, immutable snapshots and cross-module linkage audit evidence')
on conflict(version) do nothing;
