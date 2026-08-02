-- ALPHA DESIGN ERP Cloud v4.0.0 Procurement & Asset Control
-- Adds end-to-end purchase classification, CCDC register, fixed-asset lineage and deterministic schedules.

alter table public.companies alter column active_release_version set default '4.0.0';
update public.companies
set active_release_version='4.0.0',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version in ('3.9.0','3.9.1','3.9.2')
  and operational_mode in ('pilot','parallel','maintenance');

alter table public.purchase_orders
  add column if not exists invoice_date date,
  add column if not exists payment_method text not null default 'payable',
  add column if not exists classification text,
  add column if not exists useful_life_months int,
  add column if not exists allocation_months int,
  add column if not exists residual_value bigint not null default 0,
  add column if not exists journal_entry_id uuid references public.journal_entries(id),
  add column if not exists recognized_at timestamptz;

alter table public.purchase_orders drop constraint if exists purchase_orders_classification_check;
alter table public.purchase_orders add constraint purchase_orders_classification_check
  check (classification is null or classification in ('expense','tool','fixed_asset'));

alter table public.purchase_order_lines
  add column if not exists purchase_category text,
  add column if not exists useful_life_months int,
  add column if not exists direct_project boolean not null default false;

alter table public.fixed_assets
  add column if not exists purchase_order_id uuid references public.purchase_orders(id),
  add column if not exists custodian_id uuid references public.employees(id),
  add column if not exists asset_category text,
  add column if not exists serial_number text,
  add column if not exists location text;

create table if not exists public.tools_and_equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tool_code text not null,
  tool_name text not null,
  purchase_order_id uuid references public.purchase_orders(id),
  department_id uuid references public.departments(id),
  project_id uuid references public.projects(id),
  custodian_id uuid references public.employees(id),
  start_date date not null,
  original_cost bigint not null check(original_cost > 0),
  allocation_months int not null check(allocation_months between 1 and 120),
  prepaid_account_id uuid references public.accounts(id),
  expense_account_id uuid references public.accounts(id),
  status text not null default 'active' check(status in ('draft','active','stored','transferred','disposed')),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,tool_code)
);

create table if not exists public.tool_allocation_schedule (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tool_id uuid not null references public.tools_and_equipment(id) on delete cascade,
  period_id uuid not null references public.accounting_periods(id),
  allocation_amount bigint not null check(allocation_amount >= 0),
  journal_entry_id uuid references public.journal_entries(id),
  status text not null default 'calculated' check(status in ('calculated','reviewed','posted','reversed')),
  created_at timestamptz not null default now(),
  unique(tool_id,period_id)
);

create index if not exists ix_tools_company_status on public.tools_and_equipment(company_id,status);
create index if not exists ix_tools_purchase_order on public.tools_and_equipment(purchase_order_id);
create index if not exists ix_tool_schedule_company_status on public.tool_allocation_schedule(company_id,status);
create index if not exists ix_fixed_assets_purchase_order on public.fixed_assets(purchase_order_id);
create unique index if not exists ux_purchase_order_auto_journal
  on public.purchase_orders(company_id,journal_entry_id)
  where journal_entry_id is not null;

alter table public.tools_and_equipment enable row level security;
alter table public.tool_allocation_schedule enable row level security;

do $$
declare r record;
begin
  for r in select * from (values
    ('tools_and_equipment','procurement.read','procurement.write'),
    ('tool_allocation_schedule','accounting.read','accounting.write')
  ) v(table_name,read_permission,write_permission)
  loop
    execute format('drop policy if exists %I on public.%I',r.table_name||'_select_v4',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_insert_v4',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_update_v4',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_delete_v4',r.table_name);
    execute format(
      'create policy %I on public.%I for select using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_select_v4',r.table_name,r.read_permission
    );
    execute format(
      'create policy %I on public.%I for insert with check (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_insert_v4',r.table_name,r.write_permission
    );
    execute format(
      'create policy %I on public.%I for update using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id))) with check (app.is_company_member(company_id))',
      r.table_name||'_update_v4',r.table_name,r.write_permission
    );
    execute format(
      'create policy %I on public.%I for delete using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_delete_v4',r.table_name,r.write_permission
    );
  end loop;
end $$;

insert into public.permissions(code,module,name,description,risk_level) values
('assets.read','assets','Xem CCDC và TSCĐ','Xem danh mục CCDC, TSCĐ và lịch phân bổ/khấu hao','normal'),
('assets.write','assets','Cập nhật CCDC và TSCĐ','Tạo và cập nhật thẻ tài sản, lịch phân bổ/khấu hao','sensitive')
on conflict(code) do update set
  module=excluded.module,
  name=excluded.name,
  description=excluded.description,
  risk_level=excluded.risk_level;

insert into public.schema_versions(version,description) values
('4.0.0','Procurement & Asset Control: purchase requests/orders, accounting classification, CCDC register, fixed-asset lineage, deterministic straight-line schedules and draft journal generation')
on conflict(version) do nothing;
