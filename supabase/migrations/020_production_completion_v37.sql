-- ALPHA DESIGN ERP Cloud v3.7 - Production completion gates and controlled go-live.
-- This migration converts deployment checklists into enforceable database state.

alter table public.companies
  add column if not exists active_release_version text not null default '3.7.0',
  add column if not exists operational_mode text not null default 'pilot',
  add column if not exists production_writes_enabled boolean not null default false,
  add column if not exists require_dual_signoff boolean not null default true,
  add column if not exists go_live_status text not null default 'blocked',
  add column if not exists go_live_approved_at timestamptz,
  add column if not exists go_live_approved_by uuid;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='companies_operational_mode_v37') then
    alter table public.companies add constraint companies_operational_mode_v37
      check(operational_mode in ('pilot','parallel','production','maintenance','suspended'));
  end if;
  if not exists(select 1 from pg_constraint where conname='companies_go_live_status_v37') then
    alter table public.companies add constraint companies_go_live_status_v37
      check(go_live_status in ('blocked','ready_for_approval','approved','revoked'));
  end if;
end $$;

create table if not exists public.release_gate_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  release_version text not null,
  gate_code text not null,
  evidence_key text not null default 'latest',
  status text not null check(status in ('passed','failed','warning','running','blocked')),
  summary jsonb not null default '{}'::jsonb,
  evidence_uri text,
  checksum_sha256 text,
  executed_by uuid,
  executed_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(company_id,release_version,gate_code,evidence_key),
  check(length(gate_code) between 2 and 80),
  check(length(release_version) between 3 and 40)
);
create index if not exists ix_release_gate_company_release
  on public.release_gate_evidence(company_id,release_version,gate_code,executed_at desc);

create table if not exists public.release_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  release_version text not null,
  approval_type text not null check(approval_type in ('accounting','director')),
  status text not null default 'approved' check(status in ('approved','revoked')),
  note text,
  approved_by uuid not null,
  approved_at timestamptz not null default clock_timestamp(),
  revoked_by uuid,
  revoked_at timestamptz,
  unique(company_id,release_version,approval_type)
);

alter table public.release_gate_evidence enable row level security;
alter table public.release_approvals enable row level security;
select app.drop_all_policies('release_gate_evidence');
select app.drop_all_policies('release_approvals');
create policy release_gate_read_v37 on public.release_gate_evidence for select
  using(app.is_company_member(company_id));
create policy release_approval_read_v37 on public.release_approvals for select
  using(app.is_company_member(company_id));
-- Evidence and approvals are read-only to authenticated users. Evidence is written only by
-- the signed validation pipeline (service_role), and approvals only through MFA-protected RPCs.
revoke all on public.release_gate_evidence,public.release_approvals from public,anon,authenticated;
grant select on public.release_gate_evidence,public.release_approvals to authenticated;
grant all on public.release_gate_evidence,public.release_approvals to service_role;

create or replace function app.required_release_gates()
returns table(gate_code text,gate_name text,critical boolean,max_age interval)
language sql immutable as $$
  values
    ('deployment','Triển khai migration và API staging',true,interval '30 days'),
    ('rls','Kiểm thử RLS và cô lập công ty',true,interval '30 days'),
    ('mfa','Kiểm thử MFA AAL2 end-to-end',true,interval '30 days'),
    ('golden_dataset','Golden dataset đúng công thức',true,interval '30 days'),
    ('backup','Backup mã hóa có checksum',true,interval '36 hours'),
    ('restore','Restore drill trên database cô lập',true,interval '90 days'),
    ('load','Load test nhiều vai trò đạt ngưỡng',true,interval '30 days'),
    ('parallel_run','Đối chiếu tối thiểu hai kỳ đã khóa',true,interval '120 days'),
    ('browser_smoke','Browser smoke test các phân hệ',true,interval '30 days'),
    ('secret_scan','Quét secret và cấu hình phát hành',true,interval '30 days')
$$;

create or replace function app.assert_operational_write_allowed(p_company uuid)
returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare c public.companies;
begin
  select * into c from public.companies where id=p_company;
  if c.id is null then raise exception 'company not found' using errcode='P0002'; end if;
  if c.operational_mode in ('maintenance','suspended') then
    raise exception 'system is in % mode; writes are blocked',c.operational_mode using errcode='55000';
  end if;
  if c.operational_mode='production' and not c.production_writes_enabled then
    raise exception 'production writes are disabled' using errcode='55000';
  end if;
end $$;
revoke all on function app.assert_operational_write_allowed(uuid) from public,anon;
grant execute on function app.assert_operational_write_allowed(uuid) to authenticated;

create or replace function app.release_gate_status(p_company uuid,p_release text)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,app as $$
  with required as (
    select * from app.required_release_gates()
  ), latest as (
    select distinct on (e.gate_code)
      e.gate_code,e.status,e.summary,e.evidence_uri,e.checksum_sha256,e.executed_at,e.expires_at
    from public.release_gate_evidence e
    where e.company_id=p_company and e.release_version=p_release
    order by e.gate_code,e.executed_at desc
  ), rows as (
    select r.gate_code,r.gate_name,r.critical,r.max_age,
      coalesce(l.status,'blocked') as status,l.summary,l.evidence_uri,l.checksum_sha256,l.executed_at,l.expires_at,
      (
        l.status='passed'
        and l.executed_at is not null
        and l.executed_at>clock_timestamp()-r.max_age
        and (l.expires_at is null or l.expires_at>clock_timestamp())
      ) as passed
    from required r left join latest l using(gate_code)
  )
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(to_jsonb(rows) order by gate_code),'[]'::jsonb),
    'total',count(*),
    'passed',count(*) filter(where passed),
    'failed',count(*) filter(where not passed),
    'critical_passed',coalesce(bool_and(passed) filter(where critical),false)
  ) from rows
$$;

create or replace function app.production_readiness() returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare
  company uuid:=app.current_company_id();
  c public.companies;
  release text;
  schema_version text;
  gate_state jsonb;
  accounting_approval jsonb;
  director_approval jsonb;
  dual_ok boolean:=false;
  can_go_live boolean:=false;
begin
  perform app.assert_company_access(company);
  select * into c from public.companies where id=company;
  select version into schema_version from public.schema_versions order by applied_at desc,version desc limit 1;
  release:=coalesce(nullif(c.active_release_version,''),schema_version,'3.7.0');
  gate_state:=app.release_gate_status(company,release);

  select to_jsonb(a) into accounting_approval from public.release_approvals a
    where a.company_id=company and a.release_version=release and a.approval_type='accounting' and a.status='approved';
  select to_jsonb(a) into director_approval from public.release_approvals a
    where a.company_id=company and a.release_version=release and a.approval_type='director' and a.status='approved';
  dual_ok:=accounting_approval is not null and director_approval is not null
    and (not c.require_dual_signoff or accounting_approval->>'approved_by'<>director_approval->>'approved_by');
  can_go_live:=coalesce((gate_state->>'critical_passed')::boolean,false) and dual_ok;

  return jsonb_build_object(
    'company_id',company,
    'release_version',release,
    'schema_version',schema_version,
    'operational_mode',c.operational_mode,
    'production_writes_enabled',c.production_writes_enabled,
    'go_live_status',c.go_live_status,
    'auth_context',app.current_user_id() is not null,
    'membership',app.is_company_member(company),
    'aal',app.current_aal(),
    'mfa_required',c.require_mfa_for_privileged,
    'gates',gate_state,
    'approvals',jsonb_build_object('accounting',accounting_approval,'director',director_approval,'dual_signoff_passed',dual_ok),
    'can_go_live',can_go_live,
    'entity_records_count',(select count(*) from public.entity_records where company_id=company and deleted_at is null),
    'generated_at',clock_timestamp()
  );
end $$;

-- Release evidence is intentionally not writable by authenticated users.
-- The service-role-only pipeline RPC is defined later in this migration.

create or replace function app.approve_release(p_release text,p_approval_type text,p_note text default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); existing public.release_approvals; row public.release_approvals; c public.companies;
begin
  perform app.assert_company_access(cid);
  select * into c from public.companies where id=cid;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required' using errcode='42501'; end if;
  if p_approval_type='accounting' then
    if not app.has_permission('accounting.close',cid) then raise exception 'accounting sign-off requires accounting.close permission' using errcode='42501'; end if;
  elsif p_approval_type='director' then
    if not app.has_permission('release.approve',cid) then raise exception 'director sign-off requires release.approve permission' using errcode='42501'; end if;
  else raise exception 'invalid approval type' using errcode='22023';
  end if;
  if not coalesce((app.release_gate_status(cid,p_release)->>'critical_passed')::boolean,false) then
    raise exception 'all critical release gates must pass before approval' using errcode='55000';
  end if;
  select * into existing from public.release_approvals
    where company_id=cid and release_version=p_release and status='approved' and approval_type<>p_approval_type;
  if c.require_dual_signoff and existing.id is not null and existing.approved_by=app.current_user_id() then
    raise exception 'dual sign-off requires two different users' using errcode='42501';
  end if;
  insert into public.release_approvals(company_id,release_version,approval_type,status,note,approved_by,approved_at)
  values(cid,p_release,p_approval_type,'approved',p_note,app.current_user_id(),clock_timestamp())
  on conflict(company_id,release_version,approval_type) do update set
    status='approved',note=excluded.note,approved_by=excluded.approved_by,approved_at=excluded.approved_at,
    revoked_by=null,revoked_at=null
  returning * into row;
  perform app.append_audit(cid,'release_approvals',row.id::text,'APPROVE_RELEASE',null,to_jsonb(row));
  return to_jsonb(row);
end $$;

create or replace function public.approve_release(p_release text,p_approval_type text,p_note text default null)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.approve_release(p_release,p_approval_type,p_note)
$$;
revoke all on function public.approve_release(text,text,text) from public,anon;
grant execute on function public.approve_release(text,text,text) to authenticated;
revoke all on function app.approve_release(text,text,text) from public,anon,authenticated;

create or replace function app.set_operational_mode(p_mode text,p_release text default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); readiness jsonb; old_row jsonb; new_row jsonb; release text;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('release.approve',cid) then raise exception 'release.approve permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required' using errcode='42501'; end if;
  if p_mode not in ('pilot','parallel','production','maintenance','suspended') then raise exception 'invalid operational mode' using errcode='22023'; end if;
  select to_jsonb(c),coalesce(nullif(p_release,''),c.active_release_version) into old_row,release from public.companies c where c.id=cid for update;
  if p_mode='production' then
    update public.companies set active_release_version=release where id=cid;
    readiness:=app.production_readiness();
    if not coalesce((readiness->>'can_go_live')::boolean,false) then raise exception 'go-live gates or dual approvals are incomplete' using errcode='55000'; end if;
    update public.companies set operational_mode='production',production_mode=true,production_writes_enabled=true,
      go_live_status='approved',go_live_approved_at=clock_timestamp(),go_live_approved_by=app.current_user_id()
    where id=cid;
  else
    update public.companies set operational_mode=p_mode,
      production_writes_enabled=case when p_mode in ('maintenance','suspended') then false else production_writes_enabled end,
      go_live_status=case when p_mode='suspended' then 'revoked' else go_live_status end
    where id=cid;
  end if;
  select to_jsonb(c) into new_row from public.companies c where c.id=cid;
  perform app.append_audit(cid,'companies',cid::text,'SET_OPERATIONAL_MODE',old_row,new_row);
  return new_row;
end $$;

create or replace function public.set_operational_mode(p_mode text,p_release text default null)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.set_operational_mode(p_mode,p_release)
$$;
revoke all on function public.set_operational_mode(text,text) from public,anon;
grant execute on function public.set_operational_mode(text,text) to authenticated;
revoke all on function app.set_operational_mode(text,text) from public,anon,authenticated;

-- Sensitive go-live fields cannot be changed through direct table updates.
create or replace function app.guard_company_operational_fields() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
begin
  if (new.active_release_version,new.operational_mode,new.production_writes_enabled,new.require_dual_signoff,new.go_live_status,
      new.go_live_approved_at,new.go_live_approved_by)
     is distinct from
     (old.active_release_version,old.operational_mode,old.production_writes_enabled,old.require_dual_signoff,old.go_live_status,
      old.go_live_approved_at,old.go_live_approved_by)
     and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'operational release fields may only be changed through protected RPCs' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_company_operational_fields on public.companies;
create trigger trg_guard_company_operational_fields before update on public.companies
for each row execute function app.guard_company_operational_fields();
revoke all on function app.guard_company_operational_fields() from public,anon,authenticated;

-- Enforce the operational kill switch on the authoritative entity stream.
create or replace function app.entity_record_guard() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare permission_code text;
begin
  perform app.assert_operational_write_allowed(new.company_id);
  permission_code:=app.collection_permission(new.collection,true);
  if permission_code is null then raise exception 'unsupported collection: %',new.collection using errcode='22023'; end if;
  perform app.assert_company_access(new.company_id);
  if coalesce((select require_mfa_for_privileged from public.companies where id=new.company_id),true)
     and app.user_is_privileged(new.company_id) and app.current_aal()<>'aal2' then
    raise exception 'MFA AAL2 required for privileged write' using errcode='42501';
  end if;
  if not app.has_permission(permission_code,new.company_id) and not app.has_permission('data.write',new.company_id) then
    raise exception 'permission denied for collection %',new.collection using errcode='42501';
  end if;
  if tg_op='INSERT' then new.created_by:=coalesce(new.created_by,app.current_user_id());new.created_at:=coalesce(new.created_at,clock_timestamp());end if;
  new.updated_by:=app.current_user_id();new.updated_at:=clock_timestamp();return new;
end $$;

-- Re-wrap apply_entity_change so every synchronized business write passes the kill switch.
create or replace function public.apply_entity_change(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb,p_deleted boolean,p_expected_version bigint,p_idempotency_key uuid
) returns table(ok boolean,conflict boolean,row_version bigint,data jsonb,deleted boolean,server_data jsonb,server_deleted boolean,server_version bigint)
language plpgsql security definer set search_path=pg_catalog,public,app as $$
begin
  perform app.assert_operational_write_allowed(p_company);
  return query select * from app.apply_entity_change(p_company,p_collection,p_record_id,p_payload,p_deleted,p_expected_version,p_idempotency_key);
end $$;
revoke all on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) from public,anon;
grant execute on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) to authenticated;


-- Extend the authenticated context so the browser guard can enforce maintenance and production state.
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
    'production_mode',c.production_mode,
    'operational_mode',c.operational_mode,
    'production_writes_enabled',c.production_writes_enabled,
    'active_release_version',c.active_release_version,
    'go_live_status',c.go_live_status
  )
  from public.memberships m
  join public.profiles p on p.user_id=m.user_id
  join public.companies c on c.id=m.company_id
  join public.roles r on r.id=m.role_id
  where m.user_id=app.current_user_id() and m.status='active' and p.status='active'
  order by m.created_at
  limit 1
$$;
revoke all on function app.current_user_context() from public,anon;
grant execute on function app.current_user_context() to authenticated;

create or replace function public.current_user_context() returns jsonb
language sql stable security definer set search_path=pg_catalog,public,app,auth as $$ select app.current_user_context() $$;
create or replace function public.get_my_context() returns jsonb
language sql stable security definer set search_path=pg_catalog,public,app,auth as $$ select app.current_user_context() $$;
revoke all on function public.current_user_context() from public,anon;
revoke all on function public.get_my_context() from public,anon;
grant execute on function public.current_user_context() to authenticated;
grant execute on function public.get_my_context() to authenticated;

insert into public.permissions(code,module,name,description,risk_level) values
('release.approve','release','Phê duyệt phát hành','Ký xác nhận cấp Giám đốc và chuyển chế độ vận hành','critical')
on conflict(code) do update set module=excluded.module,name=excluded.name,description=excluded.description,risk_level=excluded.risk_level;
insert into public.role_permissions(role_id,permission_code)
select r.id,'release.approve' from public.roles r where r.code in ('OWNER','DIRECTOR')
on conflict(role_id,permission_code) do nothing;

alter table public.project_control_snapshots alter column formula_version set default 'ALPHA-PROJECT-CONTROL-2.2';

insert into public.schema_versions(version,description) values
('3.7.0','Production completion: enforceable release gates, dual sign-off, operational kill switch and controlled go-live')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

-- Validation evidence may only be written by the trusted backend pipeline using service_role.
create or replace function public.record_release_gate_pipeline(
  p_company uuid,p_release text,p_gate_code text,p_status text,p_summary jsonb default '{}'::jsonb,
  p_evidence_uri text default null,p_checksum_sha256 text default null,p_expires_at timestamptz default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare row public.release_gate_evidence;
begin
  if auth.role()<>'service_role' then raise exception 'validation pipeline service role required' using errcode='42501'; end if;
  if not exists(select 1 from public.companies where id=p_company) then raise exception 'company not found' using errcode='P0002'; end if;
  if not exists(select 1 from app.required_release_gates() where gate_code=p_gate_code) then raise exception 'unsupported release gate: %',p_gate_code using errcode='22023'; end if;
  if p_status not in ('passed','failed','warning','running','blocked') then raise exception 'invalid gate status' using errcode='22023'; end if;
  insert into public.release_gate_evidence(company_id,release_version,gate_code,evidence_key,status,summary,evidence_uri,checksum_sha256,executed_by,executed_at,expires_at)
  values(p_company,p_release,p_gate_code,'latest',p_status,coalesce(p_summary,'{}'::jsonb),p_evidence_uri,p_checksum_sha256,null,clock_timestamp(),p_expires_at)
  on conflict(company_id,release_version,gate_code,evidence_key) do update set
    status=excluded.status,summary=excluded.summary,evidence_uri=excluded.evidence_uri,
    checksum_sha256=excluded.checksum_sha256,executed_by=null,executed_at=excluded.executed_at,expires_at=excluded.expires_at
  returning * into row;
  perform app.append_audit(p_company,'release_gate_evidence',row.id::text,'PIPELINE_GATE',null,to_jsonb(row));
  return to_jsonb(row);
end $$;
revoke all on function public.record_release_gate_pipeline(uuid,text,text,text,jsonb,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_release_gate_pipeline(uuid,text,text,text,jsonb,text,text,timestamptz) to service_role;

-- Defense in depth: authenticated users cannot mutate evidence or approvals directly.
revoke insert,update,delete,truncate,references,trigger on public.release_gate_evidence,public.release_approvals from authenticated;
