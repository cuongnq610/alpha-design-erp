-- Normalized RBAC and database-level tenant isolation.

create table if not exists public.permissions (
  code text primary key,
  module text not null,
  name text not null,
  description text,
  risk_level text not null default 'normal' check(risk_level in ('normal','sensitive','critical'))
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  primary key(role_id, permission_code)
);

create table if not exists public.membership_roles (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  primary key(company_id, user_id, role_id)
);

create or replace function app.current_user_id() returns uuid
language sql stable security definer
set search_path=pg_catalog,auth,public,app as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
  )
$$;

create or replace function app.is_company_member(p_company uuid) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select p_company is not null and exists(
    select 1 from public.memberships m
    where m.company_id=p_company
      and m.user_id=app.current_user_id()
      and m.status='active'
  )
$$;

create or replace function app.current_company_id() returns uuid
language sql stable security definer
set search_path=pg_catalog,public,app,auth as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.company_id', true),'')::uuid,
    nullif(auth.jwt()->'app_metadata'->>'company_id','')::uuid,
    (select m.company_id from public.memberships m
      where m.user_id=app.current_user_id() and m.status='active'
      order by m.created_at limit 1)
  )
$$;

create or replace function app.has_permission(
  p_permission text,
  p_company uuid default app.current_company_id()
) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select app.is_company_member(p_company) and exists(
    select 1
    from public.memberships m
    join public.roles r on r.id=m.role_id and r.company_id=m.company_id
    where m.company_id=p_company
      and m.user_id=app.current_user_id()
      and m.status='active'
      and (
        p_permission=any(r.permissions)
        or 'admin'=any(r.permissions)
        or exists(
          select 1 from public.role_permissions rp
          where rp.role_id=r.id and rp.permission_code in (p_permission,'admin')
        )
      )
    union all
    select 1
    from public.membership_roles mr
    join public.roles r on r.id=mr.role_id and r.company_id=mr.company_id
    where mr.company_id=p_company
      and mr.user_id=app.current_user_id()
      and (
        p_permission=any(r.permissions)
        or 'admin'=any(r.permissions)
        or exists(
          select 1 from public.role_permissions rp
          where rp.role_id=r.id and rp.permission_code in (p_permission,'admin')
        )
      )
  )
$$;

revoke all on function app.is_company_member(uuid) from public;
revoke all on function app.has_permission(text,uuid) from public;
grant execute on function app.is_company_member(uuid) to authenticated;
grant execute on function app.has_permission(text,uuid) to authenticated;

insert into public.permissions(code,module,name,description,risk_level) values
('admin','system','Quản trị toàn hệ thống','Toàn quyền trong công ty','critical'),
('data.write','system','Cập nhật dữ liệu chung','Quyền tương thích cho dữ liệu vận hành','sensitive'),
('dashboard.read','dashboard','Xem dashboard','Xem chỉ số tổng quan','normal'),
('projects.read','projects','Xem dự án','Xem dự án, giai đoạn, nhiệm vụ','normal'),
('projects.write','projects','Cập nhật dự án','Tạo và cập nhật dự án, nhiệm vụ','sensitive'),
('crm.read','crm','Xem CRM','Xem khách hàng, hợp đồng','normal'),
('crm.write','crm','Cập nhật CRM','Tạo và cập nhật khách hàng, hợp đồng','sensitive'),
('hr.read','hr','Xem nhân sự','Xem hồ sơ nhân sự cơ bản','sensitive'),
('hr.write','hr','Cập nhật nhân sự','Cập nhật hồ sơ nhân sự','critical'),
('timesheet.read','timesheet','Xem chấm công','Xem timesheet theo phạm vi','normal'),
('timesheet.write','timesheet','Nhập chấm công','Nhập và gửi timesheet','normal'),
('timesheet.approve','timesheet','Duyệt chấm công','Duyệt hoặc từ chối timesheet','sensitive'),
('payroll.read','payroll','Xem bảng lương','Xem thông tin lương','critical'),
('payroll.write','payroll','Tính bảng lương','Tạo và tính bảng lương','critical'),
('payroll.approve','payroll','Phê duyệt bảng lương','Khóa và phê duyệt bảng lương','critical'),
('procurement.read','procurement','Xem mua hàng','Xem đề nghị và đơn mua hàng','normal'),
('procurement.write','procurement','Cập nhật mua hàng','Tạo đề nghị và đơn mua hàng','sensitive'),
('procurement.approve','procurement','Duyệt mua hàng','Duyệt đề nghị và đơn mua hàng','critical'),
('accounting.read','accounting','Xem kế toán','Xem sổ và báo cáo kế toán','sensitive'),
('accounting.write','accounting','Nhập chứng từ','Tạo chứng từ kế toán nháp','critical'),
('accounting.post','accounting','Ghi sổ kế toán','Ghi sổ và đảo bút toán','critical'),
('accounting.close','accounting','Khóa kỳ kế toán','Khóa/mở kỳ kế toán','critical'),
('tax.read','tax','Xem thuế','Xem hóa đơn và nghĩa vụ thuế','sensitive'),
('tax.write','tax','Cập nhật thuế','Cập nhật hóa đơn và tờ khai','critical'),
('documents.read','documents','Xem hồ sơ','Xem tài liệu theo phân loại','normal'),
('documents.write','documents','Quản lý hồ sơ','Tải lên và tạo phiên bản tài liệu','sensitive'),
('audit.read','audit','Xem nhật ký','Xem audit log bất biến','critical'),
('integrations.manage','integrations','Quản lý tích hợp','Cấu hình ngân hàng, hóa đơn, chữ ký số','critical')
on conflict(code) do update set module=excluded.module,name=excluded.name,description=excluded.description,risk_level=excluded.risk_level;

-- Apply row-version and timestamp triggers consistently.
do $$
declare t text;
begin
  foreach t in array array[
    'branches','departments','cost_centers','disciplines','contacts','employees',
    'project_stages','project_assignments','contracts','contract_milestones','tasks',
    'timesheets','payroll_periods','payroll_items','bank_accounts','bank_transactions',
    'bank_reconciliations','purchase_requests','purchase_orders','expense_claims',
    'integration_connections'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_'||t||'_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function app.touch_row()', 'trg_'||t||'_touch', t);
  end loop;
end $$;

-- Tenant consistency for child records.
create or replace function app.guard_child_company_match() returns trigger
language plpgsql set search_path=pg_catalog,public,app as $$
declare parent_company uuid;
begin
  if tg_table_name='task_assignments' then
    select company_id into parent_company from public.tasks where id=new.task_id;
  elsif tg_table_name='purchase_order_lines' then
    select company_id into parent_company from public.purchase_orders where id=new.purchase_order_id;
  end if;
  if parent_company is null or parent_company<>new.company_id then
    raise exception 'child record tenant mismatch' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_task_assignments_company on public.task_assignments;
create trigger trg_task_assignments_company before insert or update on public.task_assignments
for each row execute function app.guard_child_company_match();
drop trigger if exists trg_purchase_order_lines_company on public.purchase_order_lines;
create trigger trg_purchase_order_lines_company before insert or update on public.purchase_order_lines
for each row execute function app.guard_child_company_match();

-- Audit business-critical tables using the existing immutable audit chain.
do $$
declare t text;
begin
  foreach t in array array[
    'branches','departments','cost_centers','disciplines','contacts','employees',
    'project_stages','project_assignments','contracts','contract_milestones','tasks',
    'task_assignments','timesheets','payroll_periods','payroll_items','bank_accounts',
    'bank_transactions','bank_reconciliations','purchase_requests','purchase_orders',
    'purchase_order_lines','expense_claims','document_versions','integration_connections'
  ] loop
    execute format('drop trigger if exists %I on public.%I','trg_audit_'||t,t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.audit_row_change()','trg_audit_'||t,t);
  end loop;
end $$;

-- RLS policies mapped to module permissions.
do $$
declare r record;
begin
  for r in select * from (values
    ('branches','dashboard.read','admin'),
    ('departments','hr.read','hr.write'),
    ('cost_centers','accounting.read','accounting.write'),
    ('disciplines','projects.read','projects.write'),
    ('contacts','crm.read','crm.write'),
    ('employees','hr.read','hr.write'),
    ('project_stages','projects.read','projects.write'),
    ('project_assignments','projects.read','projects.write'),
    ('contracts','crm.read','crm.write'),
    ('contract_milestones','crm.read','crm.write'),
    ('tasks','projects.read','projects.write'),
    ('task_assignments','projects.read','projects.write'),
    ('timesheets','timesheet.read','timesheet.write'),
    ('payroll_periods','payroll.read','payroll.write'),
    ('payroll_items','payroll.read','payroll.write'),
    ('bank_accounts','accounting.read','accounting.write'),
    ('bank_transactions','accounting.read','accounting.write'),
    ('bank_reconciliations','accounting.read','accounting.write'),
    ('purchase_requests','procurement.read','procurement.write'),
    ('purchase_orders','procurement.read','procurement.write'),
    ('purchase_order_lines','procurement.read','procurement.write'),
    ('expense_claims','procurement.read','procurement.write'),
    ('document_versions','documents.read','documents.write'),
    ('integration_connections','integrations.manage','integrations.manage')
  ) v(table_name,read_permission,write_permission)
  loop
    execute format('alter table public.%I enable row level security',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_select_v2',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_insert_v2',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_update_v2',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_delete_v2',r.table_name);
    execute format(
      'create policy %I on public.%I for select using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_select_v2',r.table_name,r.read_permission
    );
    execute format(
      'create policy %I on public.%I for insert with check (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_insert_v2',r.table_name,r.write_permission
    );
    execute format(
      'create policy %I on public.%I for update using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id))) with check (app.is_company_member(company_id))',
      r.table_name||'_update_v2',r.table_name,r.write_permission
    );
    execute format(
      'create policy %I on public.%I for delete using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',
      r.table_name||'_delete_v2',r.table_name,r.write_permission
    );
  end loop;
end $$;

alter table public.notifications enable row level security;
drop policy if exists notifications_select_v2 on public.notifications;
create policy notifications_select_v2 on public.notifications for select
using(app.is_company_member(company_id) and (user_id=app.current_user_id() or app.has_permission('admin',company_id)));
drop policy if exists notifications_update_v2 on public.notifications;
create policy notifications_update_v2 on public.notifications for update
using(app.is_company_member(company_id) and user_id=app.current_user_id())
with check(app.is_company_member(company_id) and user_id=app.current_user_id());

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select using(app.current_user_id() is not null);
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select
using(exists(select 1 from public.roles r where r.id=role_id and app.is_company_member(r.company_id)));
drop policy if exists role_permissions_manage on public.role_permissions;
create policy role_permissions_manage on public.role_permissions for all
using(exists(select 1 from public.roles r where r.id=role_id and app.has_permission('admin',r.company_id)))
with check(exists(select 1 from public.roles r where r.id=role_id and app.has_permission('admin',r.company_id)));
drop policy if exists membership_roles_read on public.membership_roles;
create policy membership_roles_read on public.membership_roles for select using(app.is_company_member(company_id));
drop policy if exists membership_roles_manage on public.membership_roles;
create policy membership_roles_manage on public.membership_roles for all
using(app.has_permission('admin',company_id)) with check(app.has_permission('admin',company_id));

-- Browser/API roles receive table privileges; RLS remains the enforcement boundary.
grant select on public.permissions to authenticated;
grant select,insert,update,delete on public.role_permissions,public.membership_roles to authenticated;
grant select,insert,update,delete on
  public.branches,public.departments,public.cost_centers,public.disciplines,public.contacts,
  public.employees,public.project_stages,public.project_assignments,public.contracts,
  public.contract_milestones,public.tasks,public.task_assignments,public.timesheets,
  public.payroll_periods,public.payroll_items,public.bank_accounts,public.bank_transactions,
  public.bank_reconciliations,public.purchase_requests,public.purchase_orders,
  public.purchase_order_lines,public.expense_claims,public.document_versions,
  public.integration_connections
  to authenticated;
grant select,update on public.notifications to authenticated;
