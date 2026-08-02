-- Enterprise concurrency, idempotency, transactional outbox and verifiable audit chain.

create table if not exists public.idempotency_keys (
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  request_hash text not null,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  response_payload jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(company_id,request_id)
);

create table if not exists public.outbox_events (
  id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  payload jsonb not null,
  row_version bigint,
  occurred_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  publish_attempts int not null default 0,
  last_error text
);

create table if not exists public.device_registrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  device_id uuid not null,
  device_name text,
  platform text,
  push_subscription jsonb,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id,user_id,device_id)
);

create table if not exists public.sync_checkpoints (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  device_id uuid not null,
  entity_type text not null,
  last_event_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(company_id,user_id,device_id,entity_type)
);

create index if not exists ix_outbox_unpublished on public.outbox_events(company_id,id) where published_at is null;
create index if not exists ix_device_last_seen on public.device_registrations(company_id,user_id,last_seen_at desc);

alter table public.audit_events add column if not exists event_uuid uuid not null default gen_random_uuid();
alter table public.audit_events add column if not exists chain_version smallint not null default 2;
alter table public.audit_events add column if not exists request_id uuid;
alter table public.audit_events add column if not exists payload_json jsonb;
alter table public.audit_events add column if not exists client_ip inet;
alter table public.audit_events add column if not exists user_agent text;
create unique index if not exists uq_audit_event_uuid on public.audit_events(event_uuid);

create or replace function app.request_header(p_name text) returns text
language plpgsql stable security definer set search_path=pg_catalog,public,app as $$
declare h jsonb;
begin
  begin
    h:=nullif(current_setting('request.headers',true),'')::jsonb;
  exception when others then
    h:='{}'::jsonb;
  end;
  return h->>lower(p_name);
end $$;

create or replace function app.append_audit(
  p_company uuid,p_table text,p_record text,p_action text,p_old jsonb,p_new jsonb
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare
  v_prev text;
  v_time timestamptz:=clock_timestamp();
  v_actor uuid:=app.current_user_id();
  v_txid bigint:=txid_current();
  v_request uuid;
  v_payload jsonb;
  v_hash text;
  v_ip inet;
  v_ua text;
begin
  perform app.assert_company_access(p_company);
  perform pg_advisory_xact_lock(hashtextextended('audit|'||p_company::text,0));
  select event_hash into v_prev from public.audit_events
    where company_id=p_company order by id desc limit 1 for update;
  begin v_request:=nullif(app.request_header('x-request-id'),'')::uuid; exception when others then v_request:=null; end;
  begin v_ip:=nullif(split_part(coalesce(app.request_header('x-forwarded-for'),''),',',1),'')::inet; exception when others then v_ip:=null; end;
  v_ua:=app.request_header('user-agent');
  v_payload:=jsonb_build_object(
    'chain_version',2,
    'company_id',p_company,
    'event_time',to_char(v_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actor_id',v_actor,
    'txid',v_txid,
    'table_name',p_table,
    'record_id',p_record,
    'action',p_action,
    'old_data',p_old,
    'new_data',p_new,
    'previous_hash',v_prev,
    'request_id',v_request
  );
  v_hash:=encode(digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.audit_events(
    company_id,event_time,actor_id,txid,table_name,record_id,action,
    old_data,new_data,previous_hash,event_hash,chain_version,request_id,
    payload_json,client_ip,user_agent
  ) values(
    p_company,v_time,v_actor,v_txid,p_table,p_record,p_action,
    p_old,p_new,v_prev,v_hash,2,v_request,v_payload,v_ip,v_ua
  );
end $$;

drop function if exists app.verify_audit_chain(uuid);
create or replace function app.verify_audit_chain(p_company uuid)
returns table(valid boolean,broken_at bigint,reason text)
language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare r record; v_prev text:=null; v_expected text;
begin
  perform app.assert_company_access(p_company);
  for r in select * from public.audit_events where company_id=p_company order by id loop
    if r.previous_hash is distinct from v_prev then
      return query select false,r.id,'previous_hash mismatch'; return;
    end if;
    if coalesce(r.chain_version,1)>=2 then
      if r.payload_json is null then
        return query select false,r.id,'missing canonical payload'; return;
      end if;
      v_expected:=encode(digest(convert_to(r.payload_json::text,'UTF8'),'sha256'),'hex');
      if r.event_hash is distinct from v_expected then
        return query select false,r.id,'event_hash mismatch'; return;
      end if;
    end if;
    v_prev:=r.event_hash;
  end loop;
  return query select true,null::bigint,null::text;
end $$;

create or replace function app.begin_idempotent_request(
  p_company uuid,p_request_id uuid,p_operation text,p_request_payload jsonb
) returns table(is_new boolean,status text,response_payload jsonb)
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare v_hash text; r public.idempotency_keys;
begin
  perform app.assert_company_access(p_company);
  v_hash:=encode(digest(convert_to(coalesce(p_request_payload,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
  insert into public.idempotency_keys(company_id,request_id,operation,request_hash,created_by)
  values(p_company,p_request_id,p_operation,v_hash,app.current_user_id())
  on conflict(company_id,request_id) do nothing;
  select * into r from public.idempotency_keys where company_id=p_company and request_id=p_request_id for update;
  if r.request_hash<>v_hash or r.operation<>p_operation then
    raise exception 'idempotency key reused with a different request' using errcode='22023';
  end if;
  return query select (r.status='processing' and r.response_payload is null and r.created_by=app.current_user_id()),r.status,r.response_payload;
end $$;

create or replace function app.complete_idempotent_request(
  p_company uuid,p_request_id uuid,p_response jsonb
) returns void
language plpgsql security definer set search_path=pg_catalog,public,app as $$
begin
  perform app.assert_company_access(p_company);
  update public.idempotency_keys set status='completed',response_payload=p_response,completed_at=clock_timestamp(),error_message=null
  where company_id=p_company and request_id=p_request_id;
  if not found then raise exception 'idempotency key not found'; end if;
end $$;

create or replace function app.enqueue_outbox_event() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare j jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
declare cid uuid; rid text; ver bigint;
begin
  cid:=(j->>'company_id')::uuid;
  rid:=coalesce(j->>'id',j->>'task_id',j->>'request_id','');
  begin ver:=nullif(j->>'row_version','')::bigint; exception when others then ver:=null; end;
  insert into public.outbox_events(company_id,aggregate_type,aggregate_id,event_type,payload,row_version)
  values(cid,tg_table_name,rid,tg_op,j,ver);
  return coalesce(new,old);
end $$;

-- Publish changes only after the business row is committed because outbox shares the same ACID transaction.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_stages','tasks','timesheets','contracts','contract_milestones',
    'journal_entries','tax_invoices','payments','subledger_documents','notifications',
    'files_metadata','document_versions'
  ] loop
    execute format('drop trigger if exists %I on public.%I','trg_outbox_'||t,t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.enqueue_outbox_event()','trg_outbox_'||t,t);
  end loop;
end $$;

create or replace function app.update_timesheet_versioned(
  p_id uuid,p_expected_version bigint,p_hours numeric,p_billable_hours numeric,
  p_description text,p_status text
) returns public.timesheets
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare r public.timesheets;
begin
  select * into r from public.timesheets where id=p_id for update;
  if not found or not app.is_company_member(r.company_id) then raise exception 'timesheet not found'; end if;
  if r.row_version<>p_expected_version then raise exception 'concurrent update' using errcode='40001'; end if;
  if r.status in ('approved','locked') then raise exception 'approved/locked timesheet is immutable'; end if;
  if r.employee_id<>(select id from public.employees where user_id=app.current_user_id() and company_id=r.company_id)
     and not app.has_permission('timesheet.approve',r.company_id) then raise exception 'permission denied'; end if;
  update public.timesheets set hours=p_hours,billable_hours=p_billable_hours,description=p_description,status=p_status
  where id=p_id returning * into r;
  return r;
end $$;

create or replace function app.approve_timesheet(
  p_id uuid,p_expected_version bigint,p_approve boolean,p_reason text default null
) returns public.timesheets
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare r public.timesheets;
begin
  select * into r from public.timesheets where id=p_id for update;
  if not found or not app.has_permission('timesheet.approve',r.company_id) then raise exception 'permission denied'; end if;
  if r.row_version<>p_expected_version then raise exception 'concurrent update' using errcode='40001'; end if;
  if r.status not in ('submitted','rejected') then raise exception 'invalid approval state'; end if;
  update public.timesheets set status=case when p_approve then 'approved' else 'rejected' end,
    approved_at=case when p_approve then clock_timestamp() else null end,
    approved_by=case when p_approve then app.current_user_id() else null end,
    description=case when not p_approve and p_reason is not null then coalesce(description,'')||E'\n[Từ chối] '||p_reason else description end
  where id=p_id returning * into r;
  return r;
end $$;

-- New and old clients can use one atomic RPC to create a balanced journal entry.
create or replace function app.create_journal_entry_atomic(
  p_company uuid,p_document_date date,p_document_no text,p_description text,
  p_source_type text,p_project uuid,p_lines jsonb,p_post boolean default false,
  p_client_request_id uuid default null,p_cash_flow_code text default null
) returns public.journal_entries
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare e public.journal_entries; l jsonb; i int:=0; a public.accounts; d bigint:=0; c bigint:=0; p public.accounting_periods;
begin
  perform app.assert_company_access(p_company);
  if not app.has_permission('accounting.write',p_company) then raise exception 'permission denied'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'at least two lines required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('journal|'||p_company::text||'|'||p_document_date::text,0));
  if p_client_request_id is not null then
    select * into e from public.journal_entries where company_id=p_company and client_request_id=p_client_request_id;
    if found then return e; end if;
  end if;
  select * into p from public.accounting_periods where company_id=p_company and p_document_date between date_from and date_to order by date_from desc limit 1 for share;
  if p.id is null then raise exception 'accounting period is not configured'; end if;
  if p.status<>'open' then raise exception 'accounting period is locked'; end if;
  insert into public.journal_entries(company_id,accounting_period_id,document_no,document_date,source_type,description,status,project_id,created_by,updated_by,client_request_id,cash_flow_code)
  values(p_company,p.id,p_document_no,p_document_date,p_source_type,p_description,'draft',p_project,app.current_user_id(),app.current_user_id(),p_client_request_id,p_cash_flow_code)
  returning * into e;
  for l in select value from jsonb_array_elements(p_lines) loop
    i:=i+1;
    select * into a from public.accounts where company_id=p_company and code=l->>'account_code' and active and postable for share;
    if a.id is null then raise exception 'invalid account code: %',l->>'account_code'; end if;
    d:=d+coalesce((l->>'debit')::bigint,0); c:=c+coalesce((l->>'credit')::bigint,0);
    insert into public.journal_lines(company_id,entry_id,line_no,account_id,debit,credit,description,project_id,partner_type,partner_id,department_id,cost_center_id,employee_id,contract_id,tax_invoice_id,bank_transaction_id)
    values(p_company,e.id,i,a.id,coalesce((l->>'debit')::bigint,0),coalesce((l->>'credit')::bigint,0),l->>'description',
      coalesce(nullif(l->>'project_id','')::uuid,p_project),nullif(l->>'partner_type',''),nullif(l->>'partner_id','')::uuid,
      nullif(l->>'department_id','')::uuid,nullif(l->>'cost_center_id','')::uuid,nullif(l->>'employee_id','')::uuid,
      nullif(l->>'contract_id','')::uuid,nullif(l->>'tax_invoice_id','')::uuid,nullif(l->>'bank_transaction_id','')::uuid);
  end loop;
  if d<=0 or d<>c then raise exception 'unbalanced entry: debit %, credit %',d,c; end if;
  if p_post then
    if not app.has_permission('accounting.post',p_company) then raise exception 'posting permission denied'; end if;
    e:=app.post_journal_entry(e.id,e.row_version);
  end if;
  return e;
end $$;

-- RLS for synchronization tables.
alter table public.idempotency_keys enable row level security;
alter table public.outbox_events enable row level security;
alter table public.device_registrations enable row level security;
alter table public.sync_checkpoints enable row level security;
create policy idempotency_select_v2 on public.idempotency_keys for select using(app.is_company_member(company_id));
create policy outbox_select_v2 on public.outbox_events for select using(app.is_company_member(company_id));
create policy devices_own_v2 on public.device_registrations for all
using(app.is_company_member(company_id) and (user_id=app.current_user_id() or app.has_permission('admin',company_id)))
with check(app.is_company_member(company_id) and (user_id=app.current_user_id() or app.has_permission('admin',company_id)));
create policy checkpoints_own_v2 on public.sync_checkpoints for all
using(app.is_company_member(company_id) and user_id=app.current_user_id())
with check(app.is_company_member(company_id) and user_id=app.current_user_id());
grant select on public.idempotency_keys,public.outbox_events to authenticated;
grant select,insert,update,delete on public.device_registrations,public.sync_checkpoints to authenticated;

-- Realtime publication for cross-device synchronization.
do $$
declare t text;
begin
  foreach t in array array['projects','project_stages','tasks','timesheets','contracts','contract_milestones','journal_entries','tax_invoices','notifications','files_metadata'] loop
    begin execute format('alter publication supabase_realtime add table public.%I',t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
end $$;
