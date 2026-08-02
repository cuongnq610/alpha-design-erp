-- Schema versioning and ALPHA DESIGN reference-data bootstrap.

create table if not exists public.schema_versions (
  version text primary key,
  description text not null,
  applied_at timestamptz not null default now(),
  checksum text
);
insert into public.schema_versions(version,description) values
('3.2.0','Normalized multi-device database: business domains, RBAC, accounting subledgers, audit, sync and integrity gates')
on conflict(version) do nothing;

create or replace function app.seed_alpha_design_reference(p_company uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare v_main_branch uuid; v_admin_department uuid; v_count int;
begin
  perform app.assert_company_access(p_company);
  if not app.has_permission('admin',p_company) then raise exception 'permission denied'; end if;

  insert into public.branches(company_id,code,name) values(p_company,'HQ','Trụ sở chính')
  on conflict(company_id,code) do update set name=excluded.name
  returning id into v_main_branch;

  insert into public.disciplines(company_id,code,name,sort_order) values
    (p_company,'ARC','Kiến trúc',10),(p_company,'STR','Kết cấu',20),
    (p_company,'MEP','Cơ điện',30),(p_company,'PLN','Quy hoạch',40),
    (p_company,'LAN','Cảnh quan',50),(p_company,'INT','Nội thất',60),
    (p_company,'PM','Quản lý dự án',70),(p_company,'ADM','Hành chính - Kế toán',80)
  on conflict(company_id,code) do update set name=excluded.name,sort_order=excluded.sort_order,active=true;

  insert into public.departments(company_id,branch_id,code,name) values
    (p_company,v_main_branch,'BOARD','Ban Giám đốc'),
    (p_company,v_main_branch,'DESIGN','Khối Thiết kế'),
    (p_company,v_main_branch,'PM','Quản lý dự án'),
    (p_company,v_main_branch,'FIN','Tài chính - Kế toán'),
    (p_company,v_main_branch,'ADMIN','Hành chính - Nhân sự')
  on conflict(company_id,code) do update set name=excluded.name,branch_id=excluded.branch_id,active=true;

  select id into v_admin_department from public.departments where company_id=p_company and code='FIN';
  insert into public.cost_centers(company_id,department_id,code,name) values
    (p_company,v_admin_department,'OVERHEAD','Chi phí quản lý chung'),
    (p_company,v_admin_department,'SALES','Chi phí phát triển kinh doanh'),
    (p_company,v_admin_department,'RND','Nghiên cứu và phát triển')
  on conflict(company_id,code) do update set name=excluded.name,department_id=excluded.department_id,active=true;

  perform app.seed_tt133_accounts(p_company);

  -- Create standard roles while keeping permissions relational and auditable.
  insert into public.roles(company_id,code,name,permissions) values
    (p_company,'DIRECTOR','Giám đốc',array['dashboard.read']),
    (p_company,'CHIEF_ACCOUNTANT','Kế toán trưởng',array['dashboard.read']),
    (p_company,'ACCOUNTANT','Kế toán viên',array['dashboard.read']),
    (p_company,'PROJECT_MANAGER','Quản lý dự án',array['dashboard.read']),
    (p_company,'DISCIPLINE_LEAD','Trưởng bộ môn',array['dashboard.read']),
    (p_company,'EMPLOYEE','Nhân viên',array['dashboard.read']),
    (p_company,'COLLABORATOR','Cộng tác viên',array['dashboard.read']),
    (p_company,'AUDITOR','Kiểm tra viên',array['dashboard.read'])
  on conflict(company_id,code) do update set name=excluded.name;

  insert into public.role_permissions(role_id,permission_code)
  select r.id,p.permission_code
  from public.roles r
  cross join lateral unnest(case r.code
    when 'DIRECTOR' then array['admin']::text[]
    when 'CHIEF_ACCOUNTANT' then array['accounting.read','accounting.write','accounting.post','accounting.close','tax.read','tax.write','payroll.read','payroll.approve','audit.read','documents.read']::text[]
    when 'ACCOUNTANT' then array['accounting.read','accounting.write','tax.read','tax.write','payroll.read','procurement.read','documents.read','documents.write']::text[]
    when 'PROJECT_MANAGER' then array['projects.read','projects.write','crm.read','timesheet.read','timesheet.approve','procurement.read','documents.read','documents.write']::text[]
    when 'DISCIPLINE_LEAD' then array['projects.read','projects.write','timesheet.read','timesheet.approve','documents.read','documents.write']::text[]
    when 'EMPLOYEE' then array['projects.read','timesheet.read','timesheet.write','documents.read']::text[]
    when 'COLLABORATOR' then array['projects.read','timesheet.read','timesheet.write','documents.read']::text[]
    when 'AUDITOR' then array['accounting.read','tax.read','audit.read','documents.read']::text[]
    else array[]::text[] end) p(permission_code)
  where r.company_id=p_company
  on conflict do nothing;

  select count(*) into v_count from public.disciplines where company_id=p_company;
  return jsonb_build_object('company_id',p_company,'disciplines',v_count,'accounting_regime','TT133','schema_version','3.2.0');
end $$;

create or replace function app.database_health() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); integrity jsonb; audit_result jsonb;
begin
  perform app.assert_company_access(cid);
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into integrity from app.validate_database_integrity(cid) x;
  select to_jsonb(x) into audit_result from app.verify_audit_chain(cid) x;
  return jsonb_build_object(
    'schema_version',(select max(version) from public.schema_versions),
    'company_id',cid,
    'server_time',clock_timestamp(),
    'integrity_checks',integrity,
    'audit_chain',audit_result,
    'open_periods',(select count(*) from public.accounting_periods where company_id=cid and status='open'),
    'unpublished_outbox',(select count(*) from public.outbox_events where company_id=cid and published_at is null),
    'active_devices',(select count(*) from public.device_registrations where company_id=cid and revoked_at is null and last_seen_at>now()-interval '30 days')
  );
end $$;

grant execute on function app.seed_alpha_design_reference(uuid) to authenticated;
grant execute on function app.database_health() to authenticated;
grant execute on function app.validate_database_integrity(uuid,date,date) to authenticated;
grant execute on function app.create_journal_entry_atomic(uuid,date,text,text,text,uuid,jsonb,boolean,uuid,text) to authenticated;
grant execute on function app.update_timesheet_versioned(uuid,bigint,numeric,numeric,text,text) to authenticated;
grant execute on function app.approve_timesheet(uuid,bigint,boolean,text) to authenticated;
grant execute on function app.generate_report_snapshot(text,date,date,jsonb) to authenticated;
grant execute on function app.close_accounting_period_strict(uuid,bigint,boolean) to authenticated;
