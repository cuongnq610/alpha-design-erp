-- ALPHA DESIGN ERP v3.3: enterprise export center, server-side job queue and immutable export audit.

insert into public.permissions(code,module,name,description,risk_level) values
('reports.export','reports','Kết xuất báo cáo','Kết xuất Excel, PDF, CSV, XML, JSON, DOCX và gói hồ sơ','sensitive'),
('reports.import','reports','Nhập dữ liệu','Nhập danh mục, số dư và chứng từ từ mẫu được kiểm soát','critical')
on conflict(code) do update set module=excluded.module,name=excluded.name,description=excluded.description,risk_level=excluded.risk_level;

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requested_by uuid not null default auth.uid(),
  report_code text not null,
  format text not null check(format in ('xlsx','pdf','csv','xml','json','docx','zip')),
  filters jsonb not null default '{}'::jsonb,
  selected_columns jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check(status in ('queued','running','completed','failed','expired')),
  row_count bigint not null default 0 check(row_count>=0),
  storage_path text,
  content_type text,
  file_size bigint check(file_size is null or file_size>=0),
  checksum_sha256 text,
  error_message text,
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_export_jobs_company_created on public.export_jobs(company_id,created_at desc);
create index if not exists ix_export_jobs_status on public.export_jobs(status,created_at) where status in ('queued','running');

create table if not exists public.export_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  export_job_id uuid references public.export_jobs(id) on delete set null,
  user_id uuid default auth.uid(),
  event_type text not null,
  report_code text,
  format text,
  row_count bigint,
  details jsonb not null default '{}'::jsonb,
  request_id uuid,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists ix_export_events_company_created on public.export_events(company_id,created_at desc);

alter table public.export_jobs enable row level security;
alter table public.export_events enable row level security;

drop policy if exists export_jobs_select on public.export_jobs;
create policy export_jobs_select on public.export_jobs for select using(
  app.is_company_member(company_id) and (requested_by=auth.uid() or app.has_permission('reports.export',company_id) or app.has_permission('admin',company_id))
);
drop policy if exists export_jobs_insert on public.export_jobs;
create policy export_jobs_insert on public.export_jobs for insert with check(
  app.is_company_member(company_id) and requested_by=auth.uid() and (app.has_permission('reports.export',company_id) or app.has_permission('admin',company_id))
);
drop policy if exists export_jobs_update on public.export_jobs;
create policy export_jobs_update on public.export_jobs for update using(
  app.is_company_member(company_id) and (app.has_permission('reports.export',company_id) or app.has_permission('admin',company_id))
) with check(app.is_company_member(company_id));

drop policy if exists export_events_select on public.export_events;
create policy export_events_select on public.export_events for select using(
  app.is_company_member(company_id) and (app.has_permission('reports.export',company_id) or app.has_permission('admin',company_id))
);
drop policy if exists export_events_insert on public.export_events;
create policy export_events_insert on public.export_events for insert with check(
  app.is_company_member(company_id) and user_id=auth.uid()
);

create or replace function app.prevent_export_event_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,app as $$
begin
  raise exception 'export_events is append-only';
end $$;

drop trigger if exists trg_export_events_immutable on public.export_events;
create trigger trg_export_events_immutable before update or delete on public.export_events
for each row execute function app.prevent_export_event_mutation();

create or replace function app.request_export(
  p_company uuid,
  p_report_code text,
  p_format text,
  p_filters jsonb default '{}'::jsonb,
  p_selected_columns jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare v_id uuid;
begin
  if not app.has_permission('reports.export',p_company) and not app.has_permission('admin',p_company) then
    raise exception 'permission denied: reports.export';
  end if;
  insert into public.export_jobs(company_id,requested_by,report_code,format,filters,selected_columns)
  values(p_company,auth.uid(),p_report_code,lower(p_format),coalesce(p_filters,'{}'::jsonb),coalesce(p_selected_columns,'[]'::jsonb))
  returning id into v_id;
  insert into public.export_events(company_id,export_job_id,user_id,event_type,report_code,format,details)
  values(p_company,v_id,auth.uid(),'requested',p_report_code,lower(p_format),jsonb_build_object('filters',p_filters));
  return v_id;
end $$;

revoke all on function app.request_export(uuid,text,text,jsonb,jsonb) from public;
grant execute on function app.request_export(uuid,text,text,jsonb,jsonb) to authenticated;


insert into public.schema_versions(version,description) values
('3.3.0','Full export/import center: XLSX, PDF, CSV, XML, DOCX, JSON, ZIP, controlled templates, server export jobs and immutable export audit')
on conflict(version) do nothing;

-- Grant export permission to accounting/project-management roles; import remains admin/accounting approval only.
update public.roles
set permissions = case when not ('reports.export'=any(permissions)) then array_append(permissions,'reports.export') else permissions end
where code in ('OWNER','DIRECTOR','CHIEF_ACCOUNTANT','ACCOUNTANT','PROJECT_MANAGER');

insert into public.role_permissions(role_id,permission_code)
select r.id,'reports.export' from public.roles r
where r.code in ('OWNER','DIRECTOR','CHIEF_ACCOUNTANT','ACCOUNTANT','PROJECT_MANAGER')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_code)
select r.id,'reports.import' from public.roles r
where r.code in ('OWNER','DIRECTOR','CHIEF_ACCOUNTANT')
on conflict do nothing;
