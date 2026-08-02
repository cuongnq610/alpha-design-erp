-- ALPHA DESIGN ERP Cloud v3.6 - Production hardening and operational validation.
-- PostgreSQL is the authoritative business-data store. Browser storage is only a transient cache/queue.

alter table public.companies
  add column if not exists require_mfa_for_privileged boolean not null default true,
  add column if not exists production_mode boolean not null default false,
  add column if not exists backup_policy jsonb not null default '{"daily":true,"offsite":true,"restore_drill_days":90}'::jsonb;

create or replace function app.current_aal() returns text
language sql stable security definer
set search_path=pg_catalog,public,app,auth as $$
  select coalesce(auth.jwt()->>'aal','aal1')
$$;

create or replace function app.permission_is_privileged(p_permission text) returns boolean
language sql immutable as $$
  select p_permission in (
    'admin','accounting.post','accounting.close','accounting.period.lock',
    'users.manage','roles.manage','reports.import','backup.restore','security.manage'
  )
$$;


create or replace function app.user_is_privileged(p_company uuid default app.current_company_id()) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select exists(
    select 1 from public.memberships m join public.roles r on r.id=m.role_id
    where m.company_id=p_company and m.user_id=app.current_user_id() and m.status='active'
      and ('admin'=any(r.permissions) or exists(select 1 from public.role_permissions rp where rp.role_id=r.id and rp.permission_code in ('admin','security.manage','backup.restore','users.manage','accounting.post','accounting.close')))
    union all
    select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id
    where mr.company_id=p_company and mr.user_id=app.current_user_id()
      and ('admin'=any(r.permissions) or exists(select 1 from public.role_permissions rp where rp.role_id=r.id and rp.permission_code in ('admin','security.manage','backup.restore','users.manage','accounting.post','accounting.close')))
  )
$$;
revoke all on function app.user_is_privileged(uuid) from public,anon;
grant execute on function app.user_is_privileged(uuid) to authenticated;

create or replace function app.has_permission(
  p_permission text,
  p_company uuid default app.current_company_id()
) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app,auth as $$
  with base as (
    select exists(
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
    ) as granted
  )
  select app.is_company_member(p_company)
    and base.granted
    and (
      not app.permission_is_privileged(p_permission)
      or not coalesce((select require_mfa_for_privileged from public.companies where id=p_company),true)
      or app.current_aal()='aal2'
    )
  from base
$$;

revoke all on function app.current_aal() from public,anon;
revoke all on function app.permission_is_privileged(text) from public,anon;
grant execute on function app.current_aal() to authenticated;
grant execute on function app.permission_is_privileged(text) to authenticated;

create table if not exists public.entity_records (
  company_id uuid not null references public.companies(id) on delete cascade,
  collection text not null,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  row_version bigint not null default 1 check(row_version>0),
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid,
  primary key(company_id,collection,record_id),
  check(length(collection) between 1 and 80),
  check(length(record_id) between 1 and 180),
  check(jsonb_typeof(data)='object')
);

create index if not exists ix_entity_records_pull
  on public.entity_records(company_id,updated_at,collection,record_id);
create index if not exists ix_entity_records_active_collection
  on public.entity_records(company_id,collection,record_id) where deleted_at is null;

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
    when p_collection in ('finance')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('accounts','journalEntries','openingBalances','accountingPeriods','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection in ('documents')
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection in ('settings')
      then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system'
      then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

create or replace function app.entity_record_guard() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare permission_code text;
begin
  permission_code:=app.collection_permission(new.collection,true);
  if permission_code is null then
    raise exception 'unsupported collection: %',new.collection using errcode='22023';
  end if;
  perform app.assert_company_access(new.company_id);
  if coalesce((select require_mfa_for_privileged from public.companies where id=new.company_id),true)
     and app.user_is_privileged(new.company_id) and app.current_aal()<>'aal2' then
    raise exception 'MFA AAL2 required for privileged write' using errcode='42501';
  end if;
  if not app.has_permission(permission_code,new.company_id)
     and not app.has_permission('data.write',new.company_id) then
    raise exception 'permission denied for collection %',new.collection using errcode='42501';
  end if;
  if tg_op='INSERT' then
    new.created_by:=coalesce(new.created_by,app.current_user_id());
    new.created_at:=coalesce(new.created_at,clock_timestamp());
  end if;
  new.updated_by:=app.current_user_id();
  new.updated_at:=clock_timestamp();
  return new;
end $$;

drop trigger if exists trg_entity_record_guard on public.entity_records;
create trigger trg_entity_record_guard
before insert or update on public.entity_records
for each row execute function app.entity_record_guard();

alter table public.entity_records enable row level security;
drop policy if exists entity_records_select_v36 on public.entity_records;
create policy entity_records_select_v36 on public.entity_records for select
using(
  app.is_company_member(company_id)
  and (
    app.has_permission(coalesce(app.collection_permission(collection,false),'data.read'),company_id)
    or app.has_permission('data.read',company_id)
    or app.has_permission('admin',company_id)
  )
);
drop policy if exists entity_records_insert_v36 on public.entity_records;
create policy entity_records_insert_v36 on public.entity_records for insert
with check(app.is_company_member(company_id));
drop policy if exists entity_records_update_v36 on public.entity_records;
create policy entity_records_update_v36 on public.entity_records for update
using(app.is_company_member(company_id)) with check(app.is_company_member(company_id));

revoke all on public.entity_records from public,anon;
grant select,insert,update on public.entity_records to authenticated;


create or replace function app.begin_idempotent_request(
  p_company uuid,p_request_id uuid,p_operation text,p_request_payload jsonb
) returns table(is_new boolean,status text,response_payload jsonb)
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare v_hash text; r public.idempotency_keys; inserted boolean:=false;
begin
  perform app.assert_company_access(p_company);
  v_hash:=encode(digest(convert_to(coalesce(p_request_payload,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
  insert into public.idempotency_keys(company_id,request_id,operation,request_hash,created_by)
  values(p_company,p_request_id,p_operation,v_hash,app.current_user_id())
  on conflict(company_id,request_id) do nothing
  returning true into inserted;
  select * into r from public.idempotency_keys where company_id=p_company and request_id=p_request_id for update;
  if r.request_hash<>v_hash or r.operation<>p_operation then
    raise exception 'idempotency key reused with a different request' using errcode='22023';
  end if;
  return query select coalesce(inserted,false),r.status,r.response_payload;
end $$;

create or replace function app.apply_entity_change(
  p_company uuid,
  p_collection text,
  p_record_id text,
  p_payload jsonb,
  p_deleted boolean,
  p_expected_version bigint,
  p_idempotency_key uuid
) returns table(
  ok boolean,
  conflict boolean,
  row_version bigint,
  data jsonb,
  deleted boolean,
  server_data jsonb,
  server_deleted boolean,
  server_version bigint
)
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare
  r public.entity_records;
  next_version bigint;
  permission_code text;
  idem record;
  response jsonb;
begin
  perform app.assert_company_access(p_company);
  if coalesce((select require_mfa_for_privileged from public.companies where id=p_company),true)
     and app.user_is_privileged(p_company) and app.current_aal()<>'aal2' then
    raise exception 'MFA AAL2 required for privileged write' using errcode='42501';
  end if;
  permission_code:=app.collection_permission(p_collection,true);
  if permission_code is null then raise exception 'unsupported collection' using errcode='22023'; end if;
  if not app.has_permission(permission_code,p_company)
     and not app.has_permission('data.write',p_company) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'payload must be a JSON object' using errcode='22023'; end if;

  select * into idem from app.begin_idempotent_request(
    p_company,p_idempotency_key,'entity.change',
    jsonb_build_object('collection',p_collection,'record_id',p_record_id,'payload',p_payload,'deleted',p_deleted,'expected_version',p_expected_version)
  );
  if idem.status='completed' and idem.response_payload is not null then
    return query select
      coalesce((idem.response_payload->>'ok')::boolean,false),
      coalesce((idem.response_payload->>'conflict')::boolean,false),
      coalesce((idem.response_payload->>'row_version')::bigint,0),
      coalesce(idem.response_payload->'data','{}'::jsonb),
      coalesce((idem.response_payload->>'deleted')::boolean,false),
      idem.response_payload->'server_data',
      coalesce((idem.response_payload->>'server_deleted')::boolean,false),
      coalesce((idem.response_payload->>'server_version')::bigint,0);
    return;
  end if;
  if not coalesce(idem.is_new,false) and idem.status='processing' then
    raise exception 'idempotent request is already processing' using errcode='40001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|'||p_collection||'|'||p_record_id,0));
  select * into r from public.entity_records
    where company_id=p_company and collection=p_collection and record_id=p_record_id
    for update;

  if found and r.row_version<>coalesce(p_expected_version,0) then
    response:=jsonb_build_object(
      'ok',false,'conflict',true,'row_version',r.row_version,
      'data',r.data,'deleted',r.deleted_at is not null,
      'server_data',r.data,'server_deleted',r.deleted_at is not null,'server_version',r.row_version
    );
    perform app.complete_idempotent_request(p_company,p_idempotency_key,response);
    return query select false,true,r.row_version,r.data,(r.deleted_at is not null),r.data,(r.deleted_at is not null),r.row_version;
    return;
  end if;

  if not found and coalesce(p_expected_version,0)<>0 then
    response:=jsonb_build_object('ok',false,'conflict',true,'row_version',0,'data','{}'::jsonb,'deleted',true,'server_data','{}'::jsonb,'server_deleted',true,'server_version',0);
    perform app.complete_idempotent_request(p_company,p_idempotency_key,response);
    return query select false,true,0,'{}'::jsonb,true,'{}'::jsonb,true,0;
    return;
  end if;

  next_version:=coalesce(r.row_version,0)+1;
  insert into public.entity_records(company_id,collection,record_id,data,row_version,deleted_at)
  values(p_company,p_collection,p_record_id,p_payload,next_version,case when p_deleted then clock_timestamp() else null end)
  on conflict(company_id,collection,record_id) do update set
    data=excluded.data,row_version=excluded.row_version,deleted_at=excluded.deleted_at;

  response:=jsonb_build_object('ok',true,'conflict',false,'row_version',next_version,'data',p_payload,'deleted',p_deleted,'server_data',null,'server_deleted',false,'server_version',next_version);
  perform app.complete_idempotent_request(p_company,p_idempotency_key,response);
  perform app.append_audit(p_company,'entity_records',p_collection||':'||p_record_id,case when p_deleted then 'SOFT_DELETE' else 'UPSERT' end,to_jsonb(r),response);
  return query select true,false,next_version,p_payload,p_deleted,null::jsonb,false,next_version;
end $$;


create or replace function public.apply_entity_change(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb,p_deleted boolean,p_expected_version bigint,p_idempotency_key uuid
) returns table(ok boolean,conflict boolean,row_version bigint,data jsonb,deleted boolean,server_data jsonb,server_deleted boolean,server_version bigint)
language sql security definer set search_path=pg_catalog,public,app as $$
  select * from app.apply_entity_change(p_company,p_collection,p_record_id,p_payload,p_deleted,p_expected_version,p_idempotency_key)
$$;
revoke all on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) from public,anon;
grant execute on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) to authenticated;

revoke all on function app.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) from public,anon;
grant execute on function app.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) to authenticated;

create or replace function app.current_user_context() returns jsonb
language sql stable security definer
set search_path=pg_catalog,public,app,auth as $$
  select jsonb_build_object(
    'user_id',p.user_id,
    'full_name',p.full_name,
    'email',p.email,
    'company_id',m.company_id,
    'company_code',c.code,
    'company_name',c.name,
    'role_id',r.id,
    'role_code',r.code,
    'role_name',r.name,
    'permissions',(
      select coalesce(jsonb_agg(distinct permission_code),'[]'::jsonb)
      from (
        select unnest(r.permissions) permission_code
        union all select rp.permission_code from public.role_permissions rp where rp.role_id=r.id
        union all select unnest(r2.permissions) from public.membership_roles mr join public.roles r2 on r2.id=mr.role_id where mr.company_id=m.company_id and mr.user_id=m.user_id
        union all select rp2.permission_code from public.membership_roles mr2 join public.role_permissions rp2 on rp2.role_id=mr2.role_id where mr2.company_id=m.company_id and mr2.user_id=m.user_id
      ) q
    ),
    'aal',app.current_aal(),
    'mfa_required',c.require_mfa_for_privileged,
    'production_mode',c.production_mode
  )
  from public.memberships m
  join public.profiles p on p.user_id=m.user_id
  join public.companies c on c.id=m.company_id
  join public.roles r on r.id=m.role_id
  where m.user_id=app.current_user_id() and m.status='active' and p.status='active'
  order by m.created_at
  limit 1
$$;


create or replace function public.current_user_context() returns jsonb
language sql stable security definer
set search_path=pg_catalog,public,app,auth as $$
  select app.current_user_context()
$$;
revoke all on function public.current_user_context() from public,anon;
grant execute on function public.current_user_context() to authenticated;

create or replace function public.get_my_context() returns jsonb
language sql stable security definer
set search_path=pg_catalog,public,app,auth as $$
  select app.current_user_context()
$$;
revoke all on function public.get_my_context() from public,anon;
grant execute on function public.get_my_context() to authenticated;

create or replace function public.provision_company(p_code text,p_name text,p_full_name text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare uid uuid:=app.current_user_id(); cid uuid; rid uuid;
begin
  if uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if exists(select 1 from public.memberships where user_id=uid and status='active') then
    raise exception 'user already belongs to a company' using errcode='23505';
  end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then
    raise exception 'company code and name are required' using errcode='22023';
  end if;
  insert into public.companies(code,name,production_mode,require_mfa_for_privileged)
  values(upper(trim(p_code)),trim(p_name),false,true) returning id into cid;
  insert into public.profiles(user_id,full_name,email,status)
  values(uid,coalesce(nullif(trim(p_full_name),''),'ALPHA DESIGN User'),auth.jwt()->>'email','active')
  on conflict(user_id) do update set full_name=excluded.full_name,email=coalesce(excluded.email,public.profiles.email),status='active';
  insert into public.roles(company_id,code,name,permissions)
  values(cid,'director','Giám đốc',array['admin']) returning id into rid;
  insert into public.memberships(company_id,user_id,role_id,status) values(cid,uid,rid,'active');
  return app.current_user_context();
end $$;
revoke all on function public.provision_company(text,text,text) from public,anon;
grant execute on function public.provision_company(text,text,text) to authenticated;

revoke all on function app.current_user_context() from public,anon;
grant execute on function app.current_user_context() to authenticated;

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid,
  event_type text not null,
  severity text not null default 'info' check(severity in ('info','warning','critical')),
  success boolean not null default true,
  request_id uuid,
  ip_address inet,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists ix_security_events_company_time on public.security_events(company_id,occurred_at desc);
alter table public.security_events enable row level security;
create policy security_events_read_v36 on public.security_events for select
using(company_id is not null and app.has_permission('security.manage',company_id));
revoke all on public.security_events from public,anon;
grant select on public.security_events to authenticated;

create or replace function app.log_security_event(p_event_type text,p_success boolean,p_severity text default 'info',p_details jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare event_id bigint; company uuid:=app.current_company_id(); request_uuid uuid; ip inet;
begin
  begin request_uuid:=nullif(app.request_header('x-request-id'),'')::uuid; exception when others then request_uuid:=null; end;
  begin ip:=nullif(split_part(coalesce(app.request_header('x-forwarded-for'),''),',',1),'')::inet; exception when others then ip:=null; end;
  insert into public.security_events(company_id,user_id,event_type,severity,success,request_id,ip_address,user_agent,details)
  values(company,app.current_user_id(),left(p_event_type,120),case when p_severity in ('info','warning','critical') then p_severity else 'warning' end,p_success,request_uuid,ip,app.request_header('user-agent'),coalesce(p_details,'{}'::jsonb))
  returning id into event_id;
  return event_id;
end $$;
revoke all on function app.log_security_event(text,boolean,text,jsonb) from public,anon;
grant execute on function app.log_security_event(text,boolean,text,jsonb) to authenticated;

create or replace function public.log_security_event(p_event_type text,p_success boolean,p_severity text default 'info',p_details jsonb default '{}'::jsonb)
returns bigint language sql security definer set search_path=pg_catalog,public,app as $$
  select app.log_security_event(p_event_type,p_success,p_severity,p_details)
$$;
revoke all on function public.log_security_event(text,boolean,text,jsonb) from public,anon;
grant execute on function public.log_security_event(text,boolean,text,jsonb) to authenticated;


create table if not exists public.golden_dataset_cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_code text not null,
  formula_version text not null,
  input_hash text not null,
  expected_output jsonb not null,
  tolerance jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id,case_code,formula_version)
);
create table if not exists public.golden_dataset_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid not null references public.golden_dataset_cases(id) on delete cascade,
  release_version text not null,
  actual_output jsonb not null,
  differences jsonb not null default '[]'::jsonb,
  passed boolean not null,
  executed_by uuid,
  executed_at timestamptz not null default clock_timestamp()
);
create table if not exists public.operational_validation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  validation_type text not null check(validation_type in ('golden_dataset','parallel_run','backup','restore','load','security','go_live')),
  release_version text not null,
  environment text not null check(environment in ('staging','production')),
  status text not null check(status in ('passed','failed','warning','running')),
  summary jsonb not null default '{}'::jsonb,
  evidence_uri text,
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  executed_by uuid
);
create table if not exists public.backup_manifests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  backup_type text not null check(backup_type in ('logical','physical','pitr','storage')),
  file_name text,
  checksum_sha256 text,
  size_bytes bigint check(size_bytes is null or size_bytes>=0),
  database_version text,
  storage_location text,
  status text not null default 'completed' check(status in ('started','completed','failed','verified')),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  created_by uuid
);
create table if not exists public.restore_drills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  backup_id uuid references public.backup_manifests(id),
  target_environment text not null default 'isolated-staging',
  status text not null check(status in ('passed','failed','running')),
  rto_minutes numeric(12,2),
  rpo_minutes numeric(12,2),
  integrity_result jsonb not null default '{}'::jsonb,
  notes text,
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  executed_by uuid
);


alter table public.golden_dataset_cases enable row level security;
alter table public.golden_dataset_results enable row level security;
alter table public.operational_validation_runs enable row level security;
alter table public.backup_manifests enable row level security;
alter table public.restore_drills enable row level security;

create policy golden_cases_read_v36 on public.golden_dataset_cases for select using(app.is_company_member(company_id));
create policy golden_cases_manage_v36 on public.golden_dataset_cases for all using(app.has_permission('admin',company_id)) with check(app.has_permission('admin',company_id));
create policy golden_results_read_v36 on public.golden_dataset_results for select using(app.is_company_member(company_id));
create policy golden_results_write_v36 on public.golden_dataset_results for insert with check(app.has_permission('admin',company_id) or app.has_permission('reports.import',company_id));
create policy validation_runs_read_v36 on public.operational_validation_runs for select using(app.is_company_member(company_id));
create policy validation_runs_manage_v36 on public.operational_validation_runs for all using(app.has_permission('admin',company_id)) with check(app.has_permission('admin',company_id));
create policy backup_read_v36 on public.backup_manifests for select using(app.has_permission('admin',company_id));
create policy backup_manage_v36 on public.backup_manifests for all using(app.has_permission('admin',company_id)) with check(app.has_permission('admin',company_id));
create policy restore_read_v36 on public.restore_drills for select using(app.has_permission('admin',company_id));
create policy restore_manage_v36 on public.restore_drills for all using(app.has_permission('backup.restore',company_id) or app.has_permission('admin',company_id)) with check(app.has_permission('backup.restore',company_id) or app.has_permission('admin',company_id));

revoke all on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,public.backup_manifests,public.restore_drills from public,anon;
grant select on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,public.backup_manifests,public.restore_drills to authenticated;
grant insert,update,delete on public.golden_dataset_cases,public.operational_validation_runs,public.backup_manifests,public.restore_drills to authenticated;
grant insert on public.golden_dataset_results to authenticated;

create or replace function app.production_readiness() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,app as $$
declare
  company uuid:=app.current_company_id();
  last_backup timestamptz;
  last_restore timestamptz;
  last_golden timestamptz;
  golden_pass boolean:=false;
  schema_version text;
begin
  perform app.assert_company_access(company);
  select max(completed_at) into last_backup from public.backup_manifests where company_id=company and status in ('completed','verified');
  select max(completed_at) into last_restore from public.restore_drills where company_id=company and status='passed';
  select max(executed_at),coalesce(bool_and(passed),false) into last_golden,golden_pass
    from public.golden_dataset_results where company_id=company and release_version='3.6.0';
  select max(version) into schema_version from public.schema_versions;
  return jsonb_build_object(
    'company_id',company,
    'schema_version',schema_version,
    'auth_context',app.current_user_id() is not null,
    'membership',app.is_company_member(company),
    'aal',app.current_aal(),
    'mfa_required',(select require_mfa_for_privileged from public.companies where id=company),
    'last_backup_at',last_backup,
    'backup_fresh',last_backup is not null and last_backup>clock_timestamp()-interval '36 hours',
    'last_restore_drill_at',last_restore,
    'restore_drill_fresh',last_restore is not null and last_restore>clock_timestamp()-interval '90 days',
    'golden_dataset_last_run',last_golden,
    'golden_dataset_passed',golden_pass,
    'entity_records_count',(select count(*) from public.entity_records where company_id=company and deleted_at is null)
  );
end $$;
revoke all on function app.production_readiness() from public,anon;
grant execute on function app.production_readiness() to authenticated;

create or replace function public.production_readiness() returns jsonb
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select app.production_readiness()
$$;
revoke all on function public.production_readiness() from public,anon;
grant execute on function public.production_readiness() to authenticated;



-- Privileged user administration is server-controlled and MFA-aware.
select app.drop_all_policies('roles');
alter table public.roles enable row level security;
create policy roles_select_v36 on public.roles for select using(app.is_company_member(company_id));
create policy roles_manage_v36 on public.roles for all
using(app.has_permission('roles.manage',company_id) or app.has_permission('admin',company_id))
with check(app.has_permission('roles.manage',company_id) or app.has_permission('admin',company_id));

select app.drop_all_policies('memberships');
alter table public.memberships enable row level security;
create policy memberships_select_v36 on public.memberships for select using(app.is_company_member(company_id));
create policy memberships_manage_v36 on public.memberships for all
using(app.has_permission('users.manage',company_id) or app.has_permission('admin',company_id))
with check(app.has_permission('users.manage',company_id) or app.has_permission('admin',company_id));

create or replace function app.list_company_users() returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); result jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('users.manage',cid) and not app.has_permission('admin',cid) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',m.user_id,'full_name',p.full_name,'email',p.email,
    'membership_status',m.status,'profile_status',p.status,
    'role_id',r.id,'role_code',r.code,'role_name',r.name,'created_at',m.created_at
  ) order by p.full_name),'[]'::jsonb)
  into result
  from public.memberships m
  join public.profiles p on p.user_id=m.user_id
  join public.roles r on r.id=m.role_id
  where m.company_id=cid;
  return result;
end $$;
revoke all on function app.list_company_users() from public,anon;
grant execute on function app.list_company_users() to authenticated;

create or replace function public.list_company_users() returns jsonb
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select app.list_company_users()
$$;
revoke all on function public.list_company_users() from public,anon;
grant execute on function public.list_company_users() to authenticated;

create or replace function app.update_company_user(
  p_user uuid,p_role_code text,p_status text,p_full_name text default null
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); rid uuid; old_row jsonb; new_row jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('users.manage',cid) and not app.has_permission('admin',cid) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  if p_status not in ('active','disabled') then raise exception 'invalid status' using errcode='22023'; end if;
  if p_user=app.current_user_id() and p_status='disabled' then
    raise exception 'cannot disable the current user' using errcode='22023';
  end if;
  select id into rid from public.roles where company_id=cid and code=p_role_code;
  if rid is null then raise exception 'role not found' using errcode='22023'; end if;
  select jsonb_build_object('membership',to_jsonb(m),'profile',to_jsonb(p)) into old_row
  from public.memberships m join public.profiles p on p.user_id=m.user_id
  where m.company_id=cid and m.user_id=p_user for update of m,p;
  if old_row is null then raise exception 'user membership not found' using errcode='P0002'; end if;
  update public.memberships set role_id=rid,status=p_status where company_id=cid and user_id=p_user;
  update public.profiles set status=p_status,full_name=coalesce(nullif(trim(p_full_name),''),full_name) where user_id=p_user;
  select jsonb_build_object('user_id',m.user_id,'full_name',p.full_name,'email',p.email,
    'membership_status',m.status,'profile_status',p.status,'role_id',r.id,'role_code',r.code,'role_name',r.name)
  into new_row from public.memberships m join public.profiles p on p.user_id=m.user_id join public.roles r on r.id=m.role_id
  where m.company_id=cid and m.user_id=p_user;
  perform app.append_audit(cid,'memberships',p_user::text,'UPDATE_ACCESS',old_row,new_row);
  return new_row;
end $$;
revoke all on function app.update_company_user(uuid,text,text,text) from public,anon;
grant execute on function app.update_company_user(uuid,text,text,text) to authenticated;

create or replace function public.update_company_user(
  p_user uuid,p_role_code text,p_status text,p_full_name text default null
) returns jsonb
language sql security definer set search_path=pg_catalog,public,app as $$
  select app.update_company_user(p_user,p_role_code,p_status,p_full_name)
$$;
revoke all on function public.update_company_user(uuid,text,text,text) from public,anon;
grant execute on function public.update_company_user(uuid,text,text,text) to authenticated;

insert into public.permissions(code,module,name,description,risk_level) values
('security.manage','security','Quản trị an toàn','Xem sự kiện bảo mật và cấu hình kiểm soát','critical'),
('users.manage','security','Quản trị người dùng','Mời, khóa và gán vai trò người dùng','critical'),
('roles.manage','security','Quản trị vai trò','Tạo và thay đổi vai trò, quyền truy cập','critical'),
('backup.restore','backup','Khôi phục dữ liệu','Thực hiện và xác nhận diễn tập khôi phục','critical'),
('data.read','system','Đọc dữ liệu đồng bộ','Đọc bản ghi vận hành qua lớp đồng bộ','critical'),
('data.write','system','Ghi dữ liệu đồng bộ','Ghi bản ghi hệ thống/khởi tạo dữ liệu qua lớp đồng bộ','critical'),
('reports.read','reports','Xem báo cáo','Xem báo cáo và kết quả kiểm định','normal')
on conflict(code) do update set module=excluded.module,name=excluded.name,description=excluded.description,risk_level=excluded.risk_level;

insert into public.schema_versions(version,description) values
('3.6.0','Production hardening: authenticated server APIs, authoritative PostgreSQL entity store, MFA-aware permissions, golden datasets, backup/restore and operational validation')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

-- Publish the authoritative generic entity stream for cross-device synchronization.
do $$ begin
  begin alter publication supabase_realtime add table public.entity_records;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;
