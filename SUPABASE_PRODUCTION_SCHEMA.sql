-- ALPHA DESIGN ERP Cloud v4.5.67 — Consolidated Production Schema
-- Generated from ordered migrations. Apply only to a new database; existing databases must run migrations incrementally.


-- ============================================================================
-- SOURCE: 001_core_tt133.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.0 - Core schema
-- PostgreSQL / Supabase. All monetary columns are bigint VND.
create extension if not exists pgcrypto;
create schema if not exists app;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tax_code text,
  accounting_regime text not null default 'TT133/2016/TT-BTC',
  fiscal_year_start smallint not null default 1 check (fiscal_year_start between 1 and 12),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key,
  full_name text not null,
  email text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  permissions text[] not null default '{}',
  unique(company_id, code)
);

create table if not exists public.memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role_id uuid not null references public.roles(id),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  primary key(company_id, user_id)
);

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_name text not null,
  date_from date not null,
  date_to date not null,
  status text not null default 'open' check (status in ('open','soft_locked','hard_locked')),
  locked_at timestamptz,
  locked_by uuid,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from),
  unique(company_id, date_from, date_to)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('Asset','Liability','Equity','Revenue','Expense')),
  normal_side text not null check (normal_side in ('Debit','Credit')),
  parent_code text,
  postable boolean not null default true,
  active boolean not null default true,
  regime text not null default 'TT133',
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.document_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  sequence_code text not null,
  fiscal_year int not null,
  next_value bigint not null default 1 check(next_value > 0),
  primary key(company_id, sequence_code, fiscal_year)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  tax_code text,
  status text not null default 'active',
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  tax_code text,
  vendor_type text not null default 'company',
  status text not null default 'active',
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  client_id uuid references public.clients(id),
  status text not null default 'proposal',
  contract_value bigint not null default 0 check(contract_value >= 0),
  direct_budget bigint not null default 0 check(direct_budget >= 0),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_no text not null,
  document_date date not null,
  source_type text,
  description text not null,
  status text not null default 'draft' check(status in ('draft','posted','cancelled')),
  project_id uuid references public.projects(id),
  partner_type text check(partner_type is null or partner_type in ('client','vendor','employee','other')),
  partner_id uuid,
  posted_at timestamptz,
  posted_by uuid,
  posting_hash text,
  row_version bigint not null default 1,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_journal_document_active on public.journal_entries(company_id, lower(document_no)) where status <> 'cancelled';
create index if not exists ix_journal_company_date on public.journal_entries(company_id, document_date);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no int not null check(line_no > 0),
  account_id uuid not null references public.accounts(id),
  debit bigint not null default 0 check(debit >= 0),
  credit bigint not null default 0 check(credit >= 0),
  description text,
  project_id uuid references public.projects(id),
  partner_type text,
  partner_id uuid,
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  unique(entry_id, line_no)
);
create index if not exists ix_lines_account on public.journal_lines(company_id, account_id);
create index if not exists ix_lines_project on public.journal_lines(company_id, project_id);

create table if not exists public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fiscal_year int not null,
  account_id uuid not null references public.accounts(id),
  debit bigint not null default 0 check(debit >= 0),
  credit bigint not null default 0 check(credit >= 0),
  partner_type text,
  partner_id uuid,
  project_id uuid references public.projects(id),
  check(not(debit > 0 and credit > 0)),
  unique(company_id, fiscal_year, account_id, partner_type, partner_id, project_id)
);

create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  direction text not null check(direction in ('input','output')),
  invoice_date date not null,
  serial text not null,
  invoice_no text not null,
  partner_tax_code text,
  tax_base bigint not null check(tax_base >= 0),
  vat_rate numeric(5,2) not null check(vat_rate >= 0 and vat_rate <= 100),
  vat_amount bigint not null check(vat_amount >= 0),
  total_amount bigint not null check(total_amount >= 0),
  deductible boolean not null default false,
  status text not null default 'valid',
  journal_entry_id uuid references public.journal_entries(id),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(total_amount = tax_base + vat_amount),
  unique(company_id, direction, serial, invoice_no, partner_tax_code)
);

create table if not exists public.files_metadata (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id),
  bucket text not null default 'company-files',
  object_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check(size_bytes >= 0),
  sha256 text,
  classification text not null default 'internal' check(classification in ('public','internal','confidential','restricted')),
  uploaded_by uuid,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, object_path)
);

create table if not exists public.edit_locks (
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  locked_by uuid not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(company_id, entity_type, entity_id)
);

create table if not exists public.parallel_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  metric_code text not null,
  legacy_value bigint not null default 0,
  alpha_value bigint not null default 0,
  difference bigint generated always as (alpha_value - legacy_value) stored,
  status text not null default 'open' check(status in ('open','explained','approved')),
  explanation text,
  approved_by uuid,
  approved_at timestamptz,
  unique(company_id, period_from, period_to, metric_code)
);

create table if not exists public.report_signoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_code text not null,
  period_from date not null,
  period_to date not null,
  report_hash text not null,
  prepared_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  prepared_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  status text not null default 'draft' check(status in ('draft','prepared','reviewed','approved','rejected')),
  unique(company_id, report_code, period_from, period_to, report_hash)
);

-- ============================================================================
-- SOURCE: 002_security_transactions_audit.sql
-- ============================================================================
-- Security, ACID posting, concurrency control and immutable audit trail.
create or replace function app.current_user_id() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
create or replace function app.current_company_id() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.company_id', true),'')::uuid
$$;
create or replace function app.has_permission(p_permission text, p_company uuid default app.current_company_id()) returns boolean
language sql stable security definer set search_path=public,app as $$
  select exists(
    select 1 from memberships m join roles r on r.id=m.role_id
    where m.company_id=p_company and m.user_id=app.current_user_id() and m.status='active'
      and (p_permission=any(r.permissions) or 'admin'=any(r.permissions))
  )
$$;

create or replace function app.touch_row() returns trigger language plpgsql as $$
begin
  new.updated_at=now();
  new.row_version=coalesce(old.row_version,0)+1;
  if to_jsonb(new) ? 'updated_by' then new.updated_by=app.current_user_id(); end if;
  return new;
end $$;

create trigger trg_period_touch before update on accounting_periods for each row execute function app.touch_row();
create trigger trg_account_touch before update on accounts for each row execute function app.touch_row();
create trigger trg_client_touch before update on clients for each row execute function app.touch_row();
create trigger trg_vendor_touch before update on vendors for each row execute function app.touch_row();
create trigger trg_project_touch before update on projects for each row execute function app.touch_row();
create trigger trg_journal_touch before update on journal_entries for each row execute function app.touch_row();
create trigger trg_tax_invoice_touch before update on tax_invoices for each row execute function app.touch_row();
create trigger trg_file_touch before update on files_metadata for each row execute function app.touch_row();

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  event_time timestamptz not null default clock_timestamp(),
  actor_id uuid,
  txid bigint not null default txid_current(),
  table_name text not null,
  record_id text not null,
  action text not null check(action in ('INSERT','UPDATE','DELETE','POST','UNPOST','LOCK','UNLOCK','SIGNOFF')),
  old_data jsonb,
  new_data jsonb,
  previous_hash text,
  event_hash text not null
);
create index if not exists ix_audit_company_time on audit_events(company_id,event_time desc);

create or replace function app.prevent_audit_mutation() returns trigger language plpgsql as $$
begin raise exception 'audit_events is append-only'; end $$;
create trigger trg_audit_immutable before update or delete on audit_events for each row execute function app.prevent_audit_mutation();

create or replace function app.append_audit(p_company uuid,p_table text,p_record text,p_action text,p_old jsonb,p_new jsonb) returns void
language plpgsql security definer set search_path=public,app as $$
declare prev text; payload text; h text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_company::text,0));
  select event_hash into prev from audit_events where company_id=p_company order by id desc limit 1;
  payload:=concat_ws('|',p_company::text,clock_timestamp()::text,coalesce(app.current_user_id()::text,''),txid_current()::text,p_table,p_record,p_action,coalesce(p_old::text,''),coalesce(p_new::text,''),coalesce(prev,''));
  h:=encode(digest(payload,'sha256'),'hex');
  insert into audit_events(company_id,actor_id,table_name,record_id,action,old_data,new_data,previous_hash,event_hash)
  values(p_company,app.current_user_id(),p_table,p_record,p_action,p_old,p_new,prev,h);
end $$;

create or replace function app.audit_row_change() returns trigger language plpgsql security definer set search_path=public,app as $$
declare cid uuid; rid text;
begin
  cid:=coalesce((to_jsonb(new)->>'company_id')::uuid,(to_jsonb(old)->>'company_id')::uuid);
  rid:=coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id','');
  perform app.append_audit(cid,tg_table_name,rid,tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;

create trigger trg_audit_period after insert or update or delete on accounting_periods for each row execute function app.audit_row_change();
create trigger trg_audit_account after insert or update or delete on accounts for each row execute function app.audit_row_change();
create trigger trg_audit_client after insert or update or delete on clients for each row execute function app.audit_row_change();
create trigger trg_audit_vendor after insert or update or delete on vendors for each row execute function app.audit_row_change();
create trigger trg_audit_project after insert or update or delete on projects for each row execute function app.audit_row_change();
create trigger trg_audit_journal after insert or update or delete on journal_entries for each row execute function app.audit_row_change();
create trigger trg_audit_line after insert or update or delete on journal_lines for each row execute function app.audit_row_change();
create trigger trg_audit_invoice after insert or update or delete on tax_invoices for each row execute function app.audit_row_change();
create trigger trg_audit_file after insert or update or delete on files_metadata for each row execute function app.audit_row_change();
create trigger trg_audit_recon after insert or update or delete on parallel_reconciliations for each row execute function app.audit_row_change();
create trigger trg_audit_signoff after insert or update or delete on report_signoffs for each row execute function app.audit_row_change();

create or replace function app.next_document_no(p_company uuid,p_sequence text,p_year int,p_prefix text) returns text
language plpgsql security definer set search_path=public,app as $$
declare n bigint;
begin
  if not app.has_permission('accounting.write',p_company) then raise exception 'permission denied'; end if;
  insert into document_sequences(company_id,sequence_code,fiscal_year,next_value) values(p_company,p_sequence,p_year,2)
  on conflict(company_id,sequence_code,fiscal_year) do update set next_value=document_sequences.next_value+1
  returning next_value-1 into n;
  return p_prefix||'-'||p_year::text||'-'||lpad(n::text,6,'0');
end $$;

create or replace function app.acquire_edit_lock(p_company uuid,p_entity text,p_id uuid,p_ttl_seconds int default 300) returns table(acquired boolean,locked_by uuid,expires_at timestamptz)
language plpgsql security definer set search_path=public,app as $$
declare u uuid:=app.current_user_id();
begin
  if u is null then raise exception 'authentication required'; end if;
  delete from edit_locks l where l.company_id=p_company and l.entity_type=p_entity and l.entity_id=p_id and l.expires_at<=now();
  insert into edit_locks(company_id,entity_type,entity_id,locked_by,expires_at)
  values(p_company,p_entity,p_id,u,now()+make_interval(secs=>greatest(30,p_ttl_seconds)))
  on conflict(company_id,entity_type,entity_id) do nothing;
  return query select (l.locked_by=u),l.locked_by,l.expires_at from edit_locks l where l.company_id=p_company and l.entity_type=p_entity and l.entity_id=p_id;
end $$;

create or replace function app.release_edit_lock(p_company uuid,p_entity text,p_id uuid) returns boolean
language plpgsql security definer set search_path=public,app as $$
declare c int;
begin
  delete from edit_locks where company_id=p_company and entity_type=p_entity and entity_id=p_id and (locked_by=app.current_user_id() or app.has_permission('admin',p_company));
  get diagnostics c=row_count; return c>0;
end $$;

create or replace function app.update_journal_header(
  p_entry uuid,p_expected_version bigint,p_document_date date,p_document_no text,p_description text,p_source_type text,p_project uuid
) returns journal_entries language plpgsql security definer set search_path=public,app as $$
declare r journal_entries;
begin
  select * into r from journal_entries where id=p_entry and company_id=app.current_company_id() for update;
  if not found then raise exception 'journal entry not found'; end if;
  if r.status<>'draft' then raise exception 'only draft entries can be edited'; end if;
  if r.row_version<>p_expected_version then raise exception 'concurrent update: expected %, current %',p_expected_version,r.row_version using errcode='40001'; end if;
  update journal_entries set document_date=p_document_date,document_no=p_document_no,description=p_description,source_type=p_source_type,project_id=p_project
  where id=p_entry returning * into r;
  return r;
end $$;

create or replace function app.post_journal_entry(p_entry uuid,p_expected_version bigint) returns journal_entries
language plpgsql security definer set search_path=public,app as $$
declare r journal_entries; d bigint; c bigint; line_count int; period_status text; payload text;
begin
  if not app.has_permission('accounting.post') then raise exception 'permission denied'; end if;
  select * into r from journal_entries where id=p_entry and company_id=app.current_company_id() for update;
  if not found then raise exception 'journal entry not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.company_id::text||'|'||r.document_date::text,0));
  if r.row_version<>p_expected_version then raise exception 'concurrent update: expected %, current %',p_expected_version,r.row_version using errcode='40001'; end if;
  if r.status<>'draft' then raise exception 'entry is not draft'; end if;
  select status into period_status from accounting_periods where company_id=r.company_id and r.document_date between date_from and date_to order by date_from desc limit 1 for share;
  if period_status in ('soft_locked','hard_locked') then raise exception 'accounting period is locked'; end if;
  select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into line_count,d,c from journal_lines where entry_id=r.id;
  if line_count<2 then raise exception 'at least two journal lines are required'; end if;
  if d<=0 or d<>c then raise exception 'unbalanced entry: debit %, credit %',d,c; end if;
  if exists(select 1 from journal_lines jl join accounts a on a.id=jl.account_id where jl.entry_id=r.id and (a.company_id<>r.company_id or not a.active or not a.postable)) then raise exception 'invalid or non-postable account'; end if;
  payload:=r.id::text||'|'||r.document_no||'|'||r.document_date::text||'|'||r.description||'|'||(select string_agg(a.code||':'||jl.debit||':'||jl.credit,'|' order by jl.line_no) from journal_lines jl join accounts a on a.id=jl.account_id where jl.entry_id=r.id);
  update journal_entries set status='posted',posted_at=clock_timestamp(),posted_by=app.current_user_id(),posting_hash=encode(digest(payload,'sha256'),'hex') where id=r.id returning * into r;
  perform app.append_audit(r.company_id,'journal_entries',r.id::text,'POST',null,to_jsonb(r));
  return r;
end $$;

create or replace function app.lock_accounting_period(p_period uuid,p_expected_version bigint,p_hard boolean default false) returns accounting_periods
language plpgsql security definer set search_path=public,app as $$
declare r accounting_periods;
begin
  if not app.has_permission('accounting.close') then raise exception 'permission denied'; end if;
  select * into r from accounting_periods where id=p_period and company_id=app.current_company_id() for update;
  if not found then raise exception 'period not found'; end if;
  if r.row_version<>p_expected_version then raise exception 'concurrent update' using errcode='40001'; end if;
  if exists(select 1 from journal_entries j where j.company_id=r.company_id and j.document_date between r.date_from and r.date_to and j.status='draft') then raise exception 'draft journal entries remain in period'; end if;
  update accounting_periods set status=case when p_hard then 'hard_locked' else 'soft_locked' end,locked_at=now(),locked_by=app.current_user_id() where id=r.id returning * into r;
  perform app.append_audit(r.company_id,'accounting_periods',r.id::text,'LOCK',null,to_jsonb(r)); return r;
end $$;

-- Row-level security. Every tenant-owned row is restricted by membership and permission.
do $$ declare t text; begin
  foreach t in array array['accounting_periods','accounts','clients','vendors','projects','journal_entries','journal_lines','opening_balances','tax_invoices','files_metadata','edit_locks','parallel_reconciliations','report_signoffs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I_select on public.%I for select using (company_id=app.current_company_id() and exists(select 1 from memberships m where m.company_id=%I.company_id and m.user_id=app.current_user_id() and m.status=''active''))',t||'_sel',t,t);
    execute format('create policy %I_insert on public.%I for insert with check (company_id=app.current_company_id() and app.has_permission(''data.write'',company_id))',t||'_ins',t);
    execute format('create policy %I_update on public.%I for update using (company_id=app.current_company_id() and app.has_permission(''data.write'',company_id)) with check (company_id=app.current_company_id())',t||'_upd',t);
  end loop;
end $$;

alter table audit_events enable row level security;
create policy audit_select on audit_events for select using(company_id=app.current_company_id() and app.has_permission('audit.read',company_id));
-- No INSERT/UPDATE/DELETE policy for clients. Only SECURITY DEFINER audit functions can append.

-- ============================================================================
-- SOURCE: 003_tt133_reports.sql
-- ============================================================================
-- Server-side statutory report functions for TT133.
create or replace function app.account_balance_at(p_company uuid,p_prefix text,p_to date,p_side text default 'debit') returns bigint
language sql stable security definer set search_path=public,app as $$
with mov as (
 select coalesce(sum(case when p_side='credit' then jl.credit-jl.debit else jl.debit-jl.credit end),0)::bigint v
 from journal_lines jl join journal_entries je on je.id=jl.entry_id join accounts a on a.id=jl.account_id
 where je.company_id=p_company and je.status='posted' and je.document_date<=p_to and a.code like p_prefix||'%'
), op as (
 select coalesce(sum(case when p_side='credit' then ob.credit-ob.debit else ob.debit-ob.credit end),0)::bigint v
 from opening_balances ob join accounts a on a.id=ob.account_id
 where ob.company_id=p_company and a.code like p_prefix||'%'
)
select greatest(0,(select v from mov)+(select v from op))::bigint
$$;

create or replace function app.account_movement(p_company uuid,p_prefix text,p_from date,p_to date,p_side text default 'debit') returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when p_side='credit' then jl.credit-jl.debit else jl.debit-jl.credit end),0)::bigint
from journal_lines jl join journal_entries je on je.id=jl.entry_id join accounts a on a.id=jl.account_id
where je.company_id=p_company and je.status='posted' and je.document_date between p_from and p_to and a.code like p_prefix||'%'
$$;

create or replace function app.report_f01_dnn(p_from date,p_to date)
returns table(account_code text,account_name text,opening_debit bigint,opening_credit bigint,movement_debit bigint,movement_credit bigint,ending_debit bigint,ending_credit bigint)
language sql stable security definer set search_path=public,app as $$
with m as (
 select a.id,a.code,a.name,
 coalesce(sum(jl.debit) filter(where je.document_date<p_from),0)+coalesce(sum(ob.debit),0) od,
 coalesce(sum(jl.credit) filter(where je.document_date<p_from),0)+coalesce(sum(ob.credit),0) oc,
 coalesce(sum(jl.debit) filter(where je.document_date between p_from and p_to),0) md,
 coalesce(sum(jl.credit) filter(where je.document_date between p_from and p_to),0) mc
 from accounts a
 left join journal_lines jl on jl.account_id=a.id
 left join journal_entries je on je.id=jl.entry_id and je.status='posted' and je.company_id=app.current_company_id()
 left join opening_balances ob on ob.account_id=a.id and ob.company_id=a.company_id
 where a.company_id=app.current_company_id()
 group by a.id,a.code,a.name
)
select code,name,greatest(od-oc,0)::bigint,greatest(oc-od,0)::bigint,md::bigint,mc::bigint,
 greatest((od+md)-(oc+mc),0)::bigint,greatest((oc+mc)-(od+md),0)::bigint
from m where od<>0 or oc<>0 or md<>0 or mc<>0 order by code
$$;

create or replace function app.report_b02_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint) language plpgsql stable security definer set search_path=public,app as $$
declare sales bigint; deductions bigint; cogs bigint; fin_income bigint; fin_cost bigint; management bigint; other_income bigint; other_cost bigint; tax bigint;
begin
 sales:=app.account_movement(app.current_company_id(),'511',p_from,p_to,'credit');
 deductions:=app.account_movement(app.current_company_id(),'521',p_from,p_to,'debit');
 cogs:=app.account_movement(app.current_company_id(),'632',p_from,p_to,'debit');
 fin_income:=app.account_movement(app.current_company_id(),'515',p_from,p_to,'credit');
 fin_cost:=app.account_movement(app.current_company_id(),'635',p_from,p_to,'debit');
 management:=app.account_movement(app.current_company_id(),'642',p_from,p_to,'debit');
 other_income:=app.account_movement(app.current_company_id(),'711',p_from,p_to,'credit');
 other_cost:=app.account_movement(app.current_company_id(),'811',p_from,p_to,'debit');
 tax:=app.account_movement(app.current_company_id(),'821',p_from,p_to,'debit');
 return query values
 ('01','Doanh thu bán hàng và cung cấp dịch vụ',sales),('02','Các khoản giảm trừ doanh thu',deductions),('10','Doanh thu thuần',sales-deductions),('11','Giá vốn hàng bán',cogs),('20','Lợi nhuận gộp',sales-deductions-cogs),('21','Doanh thu hoạt động tài chính',fin_income),('22','Chi phí tài chính',fin_cost),('24','Chi phí quản lý kinh doanh',management),('30','Lợi nhuận thuần từ hoạt động kinh doanh',sales-deductions-cogs+fin_income-fin_cost-management),('31','Thu nhập khác',other_income),('32','Chi phí khác',other_cost),('40','Lợi nhuận khác',other_income-other_cost),('50','Tổng lợi nhuận kế toán trước thuế',sales-deductions-cogs+fin_income-fin_cost-management+other_income-other_cost),('51','Chi phí thuế TNDN',tax),('60','Lợi nhuận sau thuế TNDN',sales-deductions-cogs+fin_income-fin_cost-management+other_income-other_cost-tax);
end $$;

create or replace function app.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint) language plpgsql stable security definer set search_path=public,app as $$
declare cid uuid:=app.current_company_id(); begin
 return query
 with d as (select p_from-1 s,p_to e), r as (
 select * from (values
 ('110','Tiền và các khoản tương đương tiền',app.account_balance_at(cid,'111',(select s from d))+app.account_balance_at(cid,'112',(select s from d)),app.account_balance_at(cid,'111',(select e from d))+app.account_balance_at(cid,'112',(select e from d))),
 ('131','Phải thu ngắn hạn của khách hàng',app.account_balance_at(cid,'131',(select s from d)),app.account_balance_at(cid,'131',(select e from d))),
 ('132','Trả trước cho người bán',app.account_balance_at(cid,'331',(select s from d),'debit'),app.account_balance_at(cid,'331',(select e from d),'debit')),
 ('140','Hàng tồn kho và chi phí SXKD dở dang',app.account_balance_at(cid,'15',(select s from d)),app.account_balance_at(cid,'15',(select e from d))),
 ('151','Thuế GTGT được khấu trừ',app.account_balance_at(cid,'133',(select s from d)),app.account_balance_at(cid,'133',(select e from d))),
 ('220','Tài sản cố định',app.account_balance_at(cid,'211',(select s from d))-app.account_balance_at(cid,'214',(select s from d),'credit'),app.account_balance_at(cid,'211',(select e from d))-app.account_balance_at(cid,'214',(select e from d),'credit')),
 ('240','Xây dựng cơ bản dở dang',app.account_balance_at(cid,'241',(select s from d)),app.account_balance_at(cid,'241',(select e from d))),
 ('260','Tài sản dài hạn khác',app.account_balance_at(cid,'242',(select s from d)),app.account_balance_at(cid,'242',(select e from d))),
 ('311','Phải trả người bán',app.account_balance_at(cid,'331',(select s from d),'credit'),app.account_balance_at(cid,'331',(select e from d),'credit')),
 ('312','Người mua trả tiền trước',app.account_balance_at(cid,'131',(select s from d),'credit'),app.account_balance_at(cid,'131',(select e from d),'credit')),
 ('313','Thuế và các khoản phải nộp Nhà nước',app.account_balance_at(cid,'333',(select s from d),'credit'),app.account_balance_at(cid,'333',(select e from d),'credit')),
 ('314','Phải trả người lao động',app.account_balance_at(cid,'334',(select s from d),'credit'),app.account_balance_at(cid,'334',(select e from d),'credit')),
 ('315','Phải trả khác',app.account_balance_at(cid,'338',(select s from d),'credit'),app.account_balance_at(cid,'338',(select e from d),'credit')),
 ('316','Vay và nợ thuê tài chính',app.account_balance_at(cid,'341',(select s from d),'credit'),app.account_balance_at(cid,'341',(select e from d),'credit')),
 ('411','Vốn góp của chủ sở hữu',app.account_balance_at(cid,'411',(select s from d),'credit'),app.account_balance_at(cid,'411',(select e from d),'credit')),
 ('417','Lợi nhuận sau thuế chưa phân phối',app.account_balance_at(cid,'421',(select s from d),'credit'),app.account_balance_at(cid,'421',(select e from d),'credit'))
 ) v(code,label,opening_amount,ending_amount)
 ) select * from r;
end $$;

create or replace function app.verify_audit_chain(p_company uuid) returns table(valid boolean,broken_at bigint)
language plpgsql stable security definer set search_path=public,app as $$
declare r record; prev text:=null; expected text;
begin
 for r in select * from audit_events where company_id=p_company order by id loop
   if r.previous_hash is distinct from prev then return query select false,r.id; return; end if;
   prev:=r.event_hash;
 end loop;
 return query select true,null::bigint;
end $$;

-- ============================================================================
-- SOURCE: 004_seed_tt133_and_storage.sql
-- ============================================================================
-- Seed the TT133 chart of accounts relevant to ALPHA DESIGN.
create or replace function app.seed_tt133_accounts(p_company uuid) returns int
language plpgsql security definer set search_path=public,app as $$
declare c int;
begin
  insert into accounts(company_id,code,name,account_type,normal_side,parent_code,postable,regime) values
  (p_company,'111','Tiền mặt','Asset','Debit',null,false,'TT133'),
  (p_company,'1111','Tiền Việt Nam','Asset','Debit','111',true,'TT133'),
  (p_company,'112','Tiền gửi ngân hàng','Asset','Debit',null,false,'TT133'),
  (p_company,'1121','Tiền Việt Nam gửi ngân hàng','Asset','Debit','112',true,'TT133'),
  (p_company,'121','Chứng khoán kinh doanh','Asset','Debit',null,true,'TT133'),
  (p_company,'128','Đầu tư nắm giữ đến ngày đáo hạn','Asset','Debit',null,true,'TT133'),
  (p_company,'131','Phải thu của khách hàng','Asset','Debit',null,true,'TT133'),
  (p_company,'133','Thuế GTGT được khấu trừ','Asset','Debit',null,false,'TT133'),
  (p_company,'1331','Thuế GTGT được khấu trừ của hàng hóa, dịch vụ','Asset','Debit','133',true,'TT133'),
  (p_company,'138','Phải thu khác','Asset','Debit',null,true,'TT133'),
  (p_company,'141','Tạm ứng','Asset','Debit',null,true,'TT133'),
  (p_company,'152','Nguyên liệu, vật liệu','Asset','Debit',null,true,'TT133'),
  (p_company,'153','Công cụ, dụng cụ','Asset','Debit',null,true,'TT133'),
  (p_company,'154','Chi phí sản xuất, kinh doanh dở dang','Asset','Debit',null,true,'TT133'),
  (p_company,'211','Tài sản cố định','Asset','Debit',null,false,'TT133'),
  (p_company,'2112','Máy móc, thiết bị','Asset','Debit','211',true,'TT133'),
  (p_company,'214','Hao mòn tài sản cố định','Asset','Credit',null,false,'TT133'),
  (p_company,'2141','Hao mòn TSCĐ hữu hình','Asset','Credit','214',true,'TT133'),
  (p_company,'228','Đầu tư góp vốn vào đơn vị khác','Asset','Debit',null,true,'TT133'),
  (p_company,'229','Dự phòng tổn thất tài sản','Asset','Credit',null,true,'TT133'),
  (p_company,'241','Xây dựng cơ bản dở dang','Asset','Debit',null,true,'TT133'),
  (p_company,'242','Chi phí trả trước','Asset','Debit',null,true,'TT133'),
  (p_company,'244','Cầm cố, thế chấp, ký quỹ, ký cược','Asset','Debit',null,true,'TT133'),
  (p_company,'331','Phải trả cho người bán','Liability','Credit',null,true,'TT133'),
  (p_company,'333','Thuế và các khoản phải nộp Nhà nước','Liability','Credit',null,false,'TT133'),
  (p_company,'33311','Thuế GTGT đầu ra','Liability','Credit','333',true,'TT133'),
  (p_company,'3334','Thuế thu nhập doanh nghiệp','Liability','Credit','333',true,'TT133'),
  (p_company,'3335','Thuế thu nhập cá nhân','Liability','Credit','333',true,'TT133'),
  (p_company,'334','Phải trả người lao động','Liability','Credit',null,true,'TT133'),
  (p_company,'335','Chi phí phải trả','Liability','Credit',null,true,'TT133'),
  (p_company,'338','Phải trả, phải nộp khác','Liability','Credit',null,false,'TT133'),
  (p_company,'3383','Bảo hiểm xã hội','Liability','Credit','338',true,'TT133'),
  (p_company,'3384','Bảo hiểm y tế','Liability','Credit','338',true,'TT133'),
  (p_company,'3386','Bảo hiểm thất nghiệp','Liability','Credit','338',true,'TT133'),
  (p_company,'341','Vay và nợ thuê tài chính','Liability','Credit',null,true,'TT133'),
  (p_company,'352','Dự phòng phải trả','Liability','Credit',null,true,'TT133'),
  (p_company,'353','Quỹ khen thưởng, phúc lợi','Liability','Credit',null,true,'TT133'),
  (p_company,'411','Vốn đầu tư của chủ sở hữu','Equity','Credit',null,false,'TT133'),
  (p_company,'4111','Vốn góp của chủ sở hữu','Equity','Credit','411',true,'TT133'),
  (p_company,'413','Chênh lệch tỷ giá hối đoái','Equity','Credit',null,true,'TT133'),
  (p_company,'418','Các quỹ thuộc vốn chủ sở hữu','Equity','Credit',null,true,'TT133'),
  (p_company,'419','Cổ phiếu quỹ','Equity','Debit',null,true,'TT133'),
  (p_company,'421','Lợi nhuận sau thuế chưa phân phối','Equity','Credit',null,false,'TT133'),
  (p_company,'4212','Lợi nhuận sau thuế chưa phân phối năm nay','Equity','Credit','421',true,'TT133'),
  (p_company,'511','Doanh thu bán hàng và cung cấp dịch vụ','Revenue','Credit',null,false,'TT133'),
  (p_company,'5113','Doanh thu cung cấp dịch vụ thiết kế','Revenue','Credit','511',true,'TT133'),
  (p_company,'515','Doanh thu hoạt động tài chính','Revenue','Credit',null,true,'TT133'),
  (p_company,'521','Các khoản giảm trừ doanh thu','Revenue','Debit',null,true,'TT133'),
  (p_company,'632','Giá vốn hàng bán và dịch vụ','Expense','Debit',null,true,'TT133'),
  (p_company,'635','Chi phí tài chính','Expense','Debit',null,true,'TT133'),
  (p_company,'642','Chi phí quản lý kinh doanh','Expense','Debit',null,false,'TT133'),
  (p_company,'6421','Chi phí bán hàng','Expense','Debit','642',true,'TT133'),
  (p_company,'6422','Chi phí quản lý doanh nghiệp','Expense','Debit','642',true,'TT133'),
  (p_company,'711','Thu nhập khác','Revenue','Credit',null,true,'TT133'),
  (p_company,'811','Chi phí khác','Expense','Debit',null,true,'TT133'),
  (p_company,'821','Chi phí thuế TNDN','Expense','Debit',null,false,'TT133'),
  (p_company,'8211','Chi phí thuế TNDN hiện hành','Expense','Debit','821',true,'TT133'),
  (p_company,'911','Xác định kết quả kinh doanh','Equity','Credit',null,true,'TT133')
  on conflict(company_id,code) do update set name=excluded.name,account_type=excluded.account_type,normal_side=excluded.normal_side,parent_code=excluded.parent_code,postable=excluded.postable,regime='TT133',active=true;
  get diagnostics c=row_count; return c;
end $$;

-- Supabase Storage policies are applied after creating a private bucket named company-files.
-- Folder convention: {company_id}/{project_id-or-general}/{uuid}/{filename}
-- Example policy expression for storage.objects:
-- bucket_id='company-files' and (storage.foldername(name))[1]::uuid=app.current_company_id()

-- ============================================================================
-- SOURCE: 005_enterprise_hardening.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.0 - enterprise hardening
-- Applies immutable accounting records, deterministic audit hashes, tenant RLS,
-- optimistic concurrency and period controls on PostgreSQL/Supabase.

create or replace function app.current_user_id() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true),'')::uuid,
    auth.uid()
  )
$$;

create or replace function app.current_company_id() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.company_id', true),'')::uuid,
    nullif(auth.jwt()->'app_metadata'->>'company_id','')::uuid
  )
$$;

create or replace function app.assert_company_access(p_company uuid) returns void
language plpgsql stable security definer set search_path=public,app as $$
begin
  if p_company is null or not exists(
    select 1 from memberships m
    where m.company_id=p_company and m.user_id=app.current_user_id() and m.status='active'
  ) then
    raise exception 'tenant access denied' using errcode='42501';
  end if;
end $$;

create or replace function app.append_audit(
  p_company uuid,p_table text,p_record text,p_action text,p_old jsonb,p_new jsonb
) returns void
language plpgsql security definer set search_path=public,app as $$
declare
  v_prev text;
  v_time timestamptz:=clock_timestamp();
  v_actor uuid:=app.current_user_id();
  v_txid bigint:=txid_current();
  v_payload text;
  v_hash text;
begin
  perform app.assert_company_access(p_company);
  perform pg_advisory_xact_lock(hashtextextended('audit|'||p_company::text,0));
  select event_hash into v_prev
  from audit_events where company_id=p_company order by id desc limit 1 for update;

  v_payload:=concat_ws('|',
    p_company::text,
    to_char(v_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(v_actor::text,''),v_txid::text,p_table,p_record,p_action,
    coalesce(p_old::text,''),coalesce(p_new::text,''),coalesce(v_prev,'')
  );
  v_hash:=encode(digest(convert_to(v_payload,'UTF8'),'sha256'),'hex');

  insert into audit_events(
    company_id,event_time,actor_id,txid,table_name,record_id,action,
    old_data,new_data,previous_hash,event_hash
  ) values(
    p_company,v_time,v_actor,v_txid,p_table,p_record,p_action,
    p_old,p_new,v_prev,v_hash
  );
end $$;

create or replace function app.verify_audit_chain(p_company uuid)
returns table(valid boolean,broken_at bigint)
language plpgsql stable security definer set search_path=public,app as $$
declare
  r record;
  v_prev text:=null;
  v_payload text;
  v_expected text;
begin
  perform app.assert_company_access(p_company);
  for r in select * from audit_events where company_id=p_company order by id loop
    if r.previous_hash is distinct from v_prev then
      return query select false,r.id; return;
    end if;
    v_payload:=concat_ws('|',
      r.company_id::text,
      to_char(r.event_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      coalesce(r.actor_id::text,''),r.txid::text,r.table_name,r.record_id,r.action,
      coalesce(r.old_data::text,''),coalesce(r.new_data::text,''),coalesce(r.previous_hash,'')
    );
    v_expected:=encode(digest(convert_to(v_payload,'UTF8'),'sha256'),'hex');
    if r.event_hash is distinct from v_expected then
      return query select false,r.id; return;
    end if;
    v_prev:=r.event_hash;
  end loop;
  return query select true,null::bigint;
end $$;

-- Posted journals are immutable. Corrections must be made through reversing entries.
create or replace function app.guard_posted_journal_header() returns trigger
language plpgsql set search_path=public,app as $$
begin
  if tg_op='DELETE' and old.status='posted' then
    raise exception 'posted journal entries cannot be deleted; create a reversing entry';
  end if;
  if tg_op='UPDATE' and old.status='posted' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'posted journal entries are immutable; create a reversing entry';
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists trg_guard_posted_journal_header on journal_entries;
create trigger trg_guard_posted_journal_header
before update or delete on journal_entries for each row execute function app.guard_posted_journal_header();

create or replace function app.guard_posted_journal_line() returns trigger
language plpgsql set search_path=public,app as $$
declare v_entry uuid:=coalesce(new.entry_id,old.entry_id); v_status text;
begin
  select status into v_status from journal_entries where id=v_entry for share;
  if v_status='posted' then
    raise exception 'lines of a posted journal entry are immutable; create a reversing entry';
  end if;
  if tg_op<>'DELETE' and exists(
    select 1 from journal_entries je
    where je.id=new.entry_id and je.company_id<>new.company_id
  ) then
    raise exception 'journal line tenant mismatch';
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists trg_guard_posted_journal_line on journal_lines;
create trigger trg_guard_posted_journal_line
before insert or update or delete on journal_lines for each row execute function app.guard_posted_journal_line();

create or replace function app.guard_locked_period() returns trigger
language plpgsql set search_path=public,app as $$
declare v_status text;
begin
  select status into v_status from accounting_periods
  where company_id=new.company_id and new.document_date between date_from and date_to
  order by date_from desc limit 1;
  if v_status in ('soft_locked','hard_locked') then
    raise exception 'document date belongs to a locked accounting period';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_locked_period on journal_entries;
create trigger trg_guard_locked_period
before insert or update of document_date on journal_entries
for each row when (new.status='draft') execute function app.guard_locked_period();

-- Safe reversal: never mutates the original posted entry.
create or replace function app.reverse_journal_entry(
  p_entry uuid,p_reversal_date date,p_document_no text,p_reason text
) returns journal_entries
language plpgsql security definer set search_path=public,app as $$
declare src journal_entries; rev journal_entries; v_period text;
begin
  if not app.has_permission('accounting.post') then raise exception 'permission denied'; end if;
  select * into src from journal_entries
  where id=p_entry and company_id=app.current_company_id() for share;
  if not found or src.status<>'posted' then raise exception 'a posted source entry is required'; end if;
  select status into v_period from accounting_periods
  where company_id=src.company_id and p_reversal_date between date_from and date_to limit 1;
  if v_period in ('soft_locked','hard_locked') then raise exception 'reversal period is locked'; end if;

  insert into journal_entries(company_id,document_no,document_date,source_type,description,status,
    project_id,partner_type,partner_id,created_by,updated_by)
  values(src.company_id,p_document_no,p_reversal_date,'REVERSAL',
    'Đảo bút toán '||src.document_no||': '||p_reason,'draft',src.project_id,src.partner_type,src.partner_id,
    app.current_user_id(),app.current_user_id()) returning * into rev;

  insert into journal_lines(company_id,entry_id,line_no,account_id,debit,credit,description,project_id,partner_type,partner_id)
  select company_id,rev.id,line_no,account_id,credit,debit,
    coalesce(description,'')||' [Đảo '||src.document_no||']',project_id,partner_type,partner_id
  from journal_lines where entry_id=src.id order by line_no;

  return app.post_journal_entry(rev.id,rev.row_version);
end $$;

-- Explicit optimistic update pattern for project records.
create or replace function app.update_project_versioned(
  p_id uuid,p_expected_version bigint,p_name text,p_status text,
  p_contract_value bigint,p_direct_budget bigint
) returns projects
language plpgsql security definer set search_path=public,app as $$
declare r projects;
begin
  if not app.has_permission('data.write') then raise exception 'permission denied'; end if;
  update projects set name=p_name,status=p_status,contract_value=p_contract_value,direct_budget=p_direct_budget
  where id=p_id and company_id=app.current_company_id() and row_version=p_expected_version
  returning * into r;
  if not found then raise exception 'concurrent update or record not found' using errcode='40001'; end if;
  return r;
end $$;

-- Tenant tables not covered by the earlier generic policy block.
alter table companies enable row level security;
alter table profiles enable row level security;
alter table roles enable row level security;
alter table memberships enable row level security;
alter table document_sequences enable row level security;

drop policy if exists companies_select on companies;
create policy companies_select on companies for select
using(id=app.current_company_id() and exists(select 1 from memberships m where m.company_id=id and m.user_id=app.current_user_id() and m.status='active'));

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
using(user_id=app.current_user_id() or exists(select 1 from memberships me join memberships other_m on other_m.company_id=me.company_id where me.user_id=app.current_user_id() and other_m.user_id=profiles.user_id and me.status='active'));

drop policy if exists roles_select on roles;
create policy roles_select on roles for select using(company_id=app.current_company_id());
drop policy if exists roles_write on roles;
create policy roles_write on roles for all using(company_id=app.current_company_id() and app.has_permission('admin',company_id)) with check(company_id=app.current_company_id());

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships for select using(company_id=app.current_company_id());
drop policy if exists memberships_write on memberships;
create policy memberships_write on memberships for all using(company_id=app.current_company_id() and app.has_permission('admin',company_id)) with check(company_id=app.current_company_id());

drop policy if exists sequences_select on document_sequences;
create policy sequences_select on document_sequences for select using(company_id=app.current_company_id());

-- Direct writes to audit log remain impossible for authenticated users.
revoke insert,update,delete on audit_events from anon,authenticated;
grant select on audit_events to authenticated;

-- ============================================================================
-- SOURCE: 006_tt133_complete_reports.sql
-- ============================================================================
-- Complete TT133 reporting support: B01a-DNN, B02-DNN, B03-DNN,
-- B09-DNN disclosures and F01-DNN trial balance.

alter table journal_entries add column if not exists cash_flow_code text;

create table if not exists public.cash_flow_codes (
  code text primary key,
  label text not null,
  activity text not null check(activity in ('operating','investing','financing','fx')),
  expected_direction text not null check(expected_direction in ('inflow','outflow','either')),
  sort_order int not null
);
insert into cash_flow_codes(code,label,activity,expected_direction,sort_order) values
('01','Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác','operating','inflow',1),
('02','Tiền chi trả cho người cung cấp hàng hóa và dịch vụ','operating','outflow',2),
('03','Tiền chi trả cho người lao động','operating','outflow',3),
('04','Tiền lãi vay đã trả','operating','outflow',4),
('05','Thuế thu nhập doanh nghiệp đã nộp','operating','outflow',5),
('06','Tiền thu khác từ hoạt động kinh doanh','operating','inflow',6),
('07','Tiền chi khác cho hoạt động kinh doanh','operating','outflow',7),
('21','Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác','investing','outflow',21),
('22','Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác','investing','inflow',22),
('23','Tiền chi cho vay, mua các công cụ nợ của đơn vị khác','investing','outflow',23),
('24','Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác','investing','inflow',24),
('25','Tiền chi đầu tư góp vốn vào đơn vị khác','investing','outflow',25),
('26','Tiền thu hồi đầu tư góp vốn vào đơn vị khác','investing','inflow',26),
('27','Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia','investing','inflow',27),
('31','Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu','financing','inflow',31),
('32','Tiền trả lại vốn góp, mua lại cổ phiếu đã phát hành','financing','outflow',32),
('33','Tiền thu từ đi vay','financing','inflow',33),
('34','Tiền trả nợ gốc vay','financing','outflow',34),
('35','Tiền trả nợ gốc thuê tài chính','financing','outflow',35),
('36','Cổ tức, lợi nhuận đã trả cho chủ sở hữu','financing','outflow',36),
('61','Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ','fx','either',61)
on conflict(code) do update set label=excluded.label,activity=excluded.activity,expected_direction=excluded.expected_direction,sort_order=excluded.sort_order;

alter table journal_entries drop constraint if exists journal_entries_cash_flow_code_fkey;
alter table journal_entries add constraint journal_entries_cash_flow_code_fkey foreign key(cash_flow_code) references cash_flow_codes(code);

create or replace function app.require_cash_flow_code_on_post() returns trigger
language plpgsql set search_path=public,app as $$
begin
  if old.status='draft' and new.status='posted'
     and exists(
       select 1 from journal_lines jl join accounts a on a.id=jl.account_id
       where jl.entry_id=new.id and (a.code like '111%' or a.code like '112%')
     )
     and new.cash_flow_code is null then
    raise exception 'cash_flow_code is required for a posted cash or bank entry';
  end if;
  return new;
end $$;
drop trigger if exists trg_require_cash_flow_code on journal_entries;
create trigger trg_require_cash_flow_code before update of status on journal_entries
for each row execute function app.require_cash_flow_code_on_post();

create table if not exists public.report_notes_tt133 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  section_code text not null,
  section_title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check(status in ('draft','prepared','reviewed','approved')),
  row_version bigint not null default 1,
  prepared_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  updated_at timestamptz not null default now(),
  unique(company_id,period_from,period_to,section_code)
);
create trigger trg_notes_touch before update on report_notes_tt133 for each row execute function app.touch_row();
create trigger trg_audit_notes after insert or update or delete on report_notes_tt133 for each row execute function app.audit_row_change();
alter table report_notes_tt133 enable row level security;
create policy notes_select on report_notes_tt133 for select using(company_id=app.current_company_id());
create policy notes_write on report_notes_tt133 for all using(company_id=app.current_company_id() and app.has_permission('accounting.write',company_id)) with check(company_id=app.current_company_id());

create or replace function app.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint,level int,is_total boolean)
language plpgsql stable security definer set search_path=public,app as $$
declare
  cid uuid:=app.current_company_id();
  s date:=p_from-1;
  e date:=p_to;
  o_cash bigint; x_cash bigint; o_short bigint; x_short bigint; o_ar bigint; x_ar bigint;
  o_adv bigint; x_adv bigint; o_other_ar bigint; x_other_ar bigint; o_inv bigint; x_inv bigint;
  o_other_ca bigint; x_other_ca bigint; o_fixed bigint; x_fixed bigint; o_cip bigint; x_cip bigint;
  o_long_inv bigint; x_long_inv bigint; o_other_la bigint; x_other_la bigint;
  o_liab bigint; x_liab bigint; o_equity bigint; x_equity bigint; o_pnl bigint; x_pnl bigint;
begin
  perform app.assert_company_access(cid);
  o_cash:=app.account_balance_at(cid,'111',s)+app.account_balance_at(cid,'112',s);
  x_cash:=app.account_balance_at(cid,'111',e)+app.account_balance_at(cid,'112',e);
  o_short:=app.account_balance_at(cid,'121',s)+app.account_balance_at(cid,'128',s)-app.account_balance_at(cid,'2291',s,'credit');
  x_short:=app.account_balance_at(cid,'121',e)+app.account_balance_at(cid,'128',e)-app.account_balance_at(cid,'2291',e,'credit');
  o_ar:=app.account_balance_at(cid,'131',s); x_ar:=app.account_balance_at(cid,'131',e);
  o_adv:=app.account_balance_at(cid,'331',s,'debit'); x_adv:=app.account_balance_at(cid,'331',e,'debit');
  o_other_ar:=app.account_balance_at(cid,'136',s)+app.account_balance_at(cid,'138',s)+app.account_balance_at(cid,'141',s)+app.account_balance_at(cid,'244',s)-app.account_balance_at(cid,'2293',s,'credit');
  x_other_ar:=app.account_balance_at(cid,'136',e)+app.account_balance_at(cid,'138',e)+app.account_balance_at(cid,'141',e)+app.account_balance_at(cid,'244',e)-app.account_balance_at(cid,'2293',e,'credit');
  o_inv:=app.account_balance_at(cid,'15',s)-app.account_balance_at(cid,'2294',s,'credit');
  x_inv:=app.account_balance_at(cid,'15',e)-app.account_balance_at(cid,'2294',e,'credit');
  o_other_ca:=app.account_balance_at(cid,'133',s)+app.account_balance_at(cid,'242',s);
  x_other_ca:=app.account_balance_at(cid,'133',e)+app.account_balance_at(cid,'242',e);
  o_fixed:=app.account_balance_at(cid,'211',s)-app.account_balance_at(cid,'214',s,'credit');
  x_fixed:=app.account_balance_at(cid,'211',e)-app.account_balance_at(cid,'214',e,'credit');
  o_cip:=app.account_balance_at(cid,'241',s); x_cip:=app.account_balance_at(cid,'241',e);
  o_long_inv:=app.account_balance_at(cid,'217',s)+app.account_balance_at(cid,'228',s)-app.account_balance_at(cid,'2292',s,'credit');
  x_long_inv:=app.account_balance_at(cid,'217',e)+app.account_balance_at(cid,'228',e)-app.account_balance_at(cid,'2292',e,'credit');
  o_other_la:=app.account_balance_at(cid,'242',s)+app.account_balance_at(cid,'244',s);
  x_other_la:=app.account_balance_at(cid,'242',e)+app.account_balance_at(cid,'244',e);

  o_liab:=app.account_balance_at(cid,'331',s,'credit')+app.account_balance_at(cid,'131',s,'credit')+
    app.account_balance_at(cid,'333',s,'credit')+app.account_balance_at(cid,'334',s,'credit')+
    app.account_balance_at(cid,'335',s,'credit')+app.account_balance_at(cid,'336',s,'credit')+
    app.account_balance_at(cid,'338',s,'credit')+app.account_balance_at(cid,'341',s,'credit')+
    app.account_balance_at(cid,'352',s,'credit')+app.account_balance_at(cid,'353',s,'credit')+
    app.account_balance_at(cid,'356',s,'credit');
  x_liab:=app.account_balance_at(cid,'331',e,'credit')+app.account_balance_at(cid,'131',e,'credit')+
    app.account_balance_at(cid,'333',e,'credit')+app.account_balance_at(cid,'334',e,'credit')+
    app.account_balance_at(cid,'335',e,'credit')+app.account_balance_at(cid,'336',e,'credit')+
    app.account_balance_at(cid,'338',e,'credit')+app.account_balance_at(cid,'341',e,'credit')+
    app.account_balance_at(cid,'352',e,'credit')+app.account_balance_at(cid,'353',e,'credit')+
    app.account_balance_at(cid,'356',e,'credit');

  select coalesce(amount,0) into o_pnl from app.report_b02_dnn(date_trunc('year',s)::date,s) where code='60';
  select coalesce(amount,0) into x_pnl from app.report_b02_dnn(date_trunc('year',e)::date,e) where code='60';
  o_equity:=app.account_balance_at(cid,'411',s,'credit')+app.account_balance_at(cid,'413',s,'credit')-
    app.account_balance_at(cid,'413',s)+app.account_balance_at(cid,'418',s,'credit')-
    app.account_balance_at(cid,'419',s)+app.account_balance_at(cid,'421',s,'credit')-
    app.account_balance_at(cid,'421',s)+o_pnl;
  x_equity:=app.account_balance_at(cid,'411',e,'credit')+app.account_balance_at(cid,'413',e,'credit')-
    app.account_balance_at(cid,'413',e)+app.account_balance_at(cid,'418',e,'credit')-
    app.account_balance_at(cid,'419',e)+app.account_balance_at(cid,'421',e,'credit')-
    app.account_balance_at(cid,'421',e)+x_pnl;

  return query values
  ('100','TÀI SẢN NGẮN HẠN',o_cash+o_short+o_ar+o_adv+o_other_ar+o_inv+o_other_ca,x_cash+x_short+x_ar+x_adv+x_other_ar+x_inv+x_other_ca,0,true),
  ('110','Tiền và các khoản tương đương tiền',o_cash,x_cash,1,false),
  ('120','Đầu tư tài chính ngắn hạn',o_short,x_short,1,false),
  ('130','Các khoản phải thu ngắn hạn',o_ar+o_adv+o_other_ar,x_ar+x_adv+x_other_ar,1,false),
  ('131','Phải thu ngắn hạn của khách hàng',o_ar,x_ar,2,false),
  ('132','Trả trước cho người bán ngắn hạn',o_adv,x_adv,2,false),
  ('134','Phải thu ngắn hạn khác',o_other_ar,x_other_ar,2,false),
  ('140','Hàng tồn kho',o_inv,x_inv,1,false),
  ('150','Tài sản ngắn hạn khác',o_other_ca,x_other_ca,1,false),
  ('200','TÀI SẢN DÀI HẠN',o_fixed+o_cip+o_long_inv+o_other_la,x_fixed+x_cip+x_long_inv+x_other_la,0,true),
  ('220','Tài sản cố định',o_fixed,x_fixed,1,false),
  ('240','Xây dựng cơ bản dở dang',o_cip,x_cip,1,false),
  ('250','Đầu tư tài chính dài hạn',o_long_inv,x_long_inv,1,false),
  ('260','Tài sản dài hạn khác',o_other_la,x_other_la,1,false),
  ('270','TỔNG CỘNG TÀI SẢN',o_cash+o_short+o_ar+o_adv+o_other_ar+o_inv+o_other_ca+o_fixed+o_cip+o_long_inv+o_other_la,x_cash+x_short+x_ar+x_adv+x_other_ar+x_inv+x_other_ca+x_fixed+x_cip+x_long_inv+x_other_la,0,true),
  ('300','NỢ PHẢI TRẢ',o_liab,x_liab,0,true),
  ('400','VỐN CHỦ SỞ HỮU',o_equity,x_equity,0,true),
  ('440','TỔNG CỘNG NGUỒN VỐN',o_liab+o_equity,x_liab+x_equity,0,true);
end $$;

create or replace function app.report_b03_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint,level int,is_total boolean)
language plpgsql stable security definer set search_path=public,app as $$
declare cid uuid:=app.current_company_id(); op bigint; inv bigint; fin bigint; fx bigint; opening bigint; closing bigint;
begin
  perform app.assert_company_access(cid);
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into op
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  join cash_flow_codes c on c.code=je.cash_flow_code
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and c.activity='operating' and (a.code like '111%' or a.code like '112%');
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into inv
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  join cash_flow_codes c on c.code=je.cash_flow_code
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and c.activity='investing' and (a.code like '111%' or a.code like '112%');
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into fin
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  join cash_flow_codes c on c.code=je.cash_flow_code
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and c.activity='financing' and (a.code like '111%' or a.code like '112%');
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into fx
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and je.cash_flow_code='61' and (a.code like '111%' or a.code like '112%');
  opening:=app.account_balance_at(cid,'111',p_from-1)+app.account_balance_at(cid,'112',p_from-1);
  closing:=app.account_balance_at(cid,'111',p_to)+app.account_balance_at(cid,'112',p_to);

  return query
  with detail as (
    select c.code,c.label,coalesce(sum(case when a.id is not null then jl.debit-jl.credit else 0 end),0)::bigint amount,1 level,false is_total,c.sort_order
    from cash_flow_codes c
    left join journal_entries je on je.cash_flow_code=c.code and je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to
    left join journal_lines jl on jl.entry_id=je.id
    left join accounts a on a.id=jl.account_id and (a.code like '111%' or a.code like '112%')
    where c.code<>'61'
    group by c.code,c.label,c.sort_order
  ), totals as (
    select * from (values
      ('20','Lưu chuyển tiền thuần từ hoạt động kinh doanh',op,0,true,20),
      ('30','Lưu chuyển tiền thuần từ hoạt động đầu tư',inv,0,true,30),
      ('40','Lưu chuyển tiền thuần từ hoạt động tài chính',fin,0,true,40),
      ('50','Lưu chuyển tiền thuần trong kỳ',op+inv+fin,0,true,50),
      ('60','Tiền và tương đương tiền đầu kỳ',opening,0,true,60),
      ('61','Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ',fx,1,false,61),
      ('70','Tiền và tương đương tiền cuối kỳ',closing,0,true,70)
    ) v(code,label,amount,level,is_total,sort_order)
  )
  select q.code,q.label,q.amount,q.level,q.is_total from (select * from detail union all select * from totals) q order by q.sort_order;
end $$;

create or replace function app.report_b09_dnn(p_from date,p_to date)
returns table(section_code text,section_title text,status text,content jsonb)
language sql stable security definer set search_path=public,app as $$
with required(section_code,section_title,sort_order) as (values
 ('I','Đặc điểm hoạt động của doanh nghiệp',1),
 ('II','Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán',2),
 ('III','Chuẩn mực và chế độ kế toán áp dụng',3),
 ('IV','Các chính sách kế toán áp dụng',4),
 ('V','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính',5),
 ('VI','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh',6),
 ('VII','Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ',7),
 ('VIII','Những thông tin khác',8)
)
select r.section_code,r.section_title,coalesce(n.status,'draft'),coalesce(n.content,'{}'::jsonb)
from required r left join report_notes_tt133 n
 on n.company_id=app.current_company_id() and n.period_from=p_from and n.period_to=p_to and n.section_code=r.section_code
order by r.sort_order
$$;

create or replace function app.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language plpgsql stable security definer set search_path=public,app as $$
declare a bigint; s bigint; cf_close bigint; ledger_close bigint; note_count int;
begin
  select ending_amount into a from app.report_b01a_dnn(p_from,p_to) where code='270';
  select ending_amount into s from app.report_b01a_dnn(p_from,p_to) where code='440';
  select amount into cf_close from app.report_b03_dnn(p_from,p_to) where code='70';
  ledger_close:=app.account_balance_at(app.current_company_id(),'111',p_to)+app.account_balance_at(app.current_company_id(),'112',p_to);
  select count(*) into note_count from app.report_b09_dnn(p_from,p_to) where status in ('prepared','reviewed','approved');
  return query values
    ('B01_BALANCE',a=s,format('Tài sản=%s; Nguồn vốn=%s',a,s)),
    ('F01_BALANCE',not exists(select 1 from app.report_f01_dnn(p_from,p_to) r where r.ending_debit<0 or r.ending_credit<0),'Số dư Nợ/Có không âm'),
    ('B03_RECONCILE',cf_close=ledger_close,format('B03=%s; Sổ cái 111/112=%s',cf_close,ledger_close)),
    ('B09_COMPLETENESS',note_count=8,format('Đã chuẩn bị %s/8 phần thuyết minh',note_count));
end $$;

-- ============================================================================
-- SOURCE: 007_balance_engine_corrections.sql
-- ============================================================================
-- Correct year-aware opening balance and exact-account calculations.
-- Prevents double counting when the database contains multiple fiscal years.

create or replace function app.fiscal_year_start_date(p_company uuid,p_date date) returns date
language sql stable security definer set search_path=public,app as $$
  select make_date(
    case when extract(month from p_date)::int >= fiscal_year_start then extract(year from p_date)::int else extract(year from p_date)::int-1 end,
    fiscal_year_start,1
  ) from companies where id=p_company
$$;

create or replace function app.account_exact_balance_at(
  p_company uuid,p_account uuid,p_to date
) returns table(ending_debit bigint,ending_credit bigint)
language sql stable security definer set search_path=public,app as $$
with fy as (
  select app.fiscal_year_start_date(p_company,p_to) d
), opening as (
  select coalesce(sum(ob.debit),0)::bigint debit,coalesce(sum(ob.credit),0)::bigint credit
  from opening_balances ob,fy
  where ob.company_id=p_company and ob.account_id=p_account
    and ob.fiscal_year=extract(year from fy.d)::int
), movement as (
  select coalesce(sum(jl.debit),0)::bigint debit,coalesce(sum(jl.credit),0)::bigint credit
  from journal_lines jl join journal_entries je on je.id=jl.entry_id,fy
  where je.company_id=p_company and jl.account_id=p_account and je.status='posted'
    and je.document_date between fy.d and p_to
), net as (
  select (opening.debit+movement.debit)-(opening.credit+movement.credit) v from opening,movement
)
select greatest(v,0)::bigint,greatest(-v,0)::bigint from net
$$;

create or replace function app.account_balance_at(
  p_company uuid,p_prefix text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company and a.code like p_prefix||'%'
$$;

create or replace function app.report_f01_dnn(p_from date,p_to date)
returns table(account_code text,account_name text,opening_debit bigint,opening_credit bigint,movement_debit bigint,movement_credit bigint,ending_debit bigint,ending_credit bigint)
language sql stable security definer set search_path=public,app as $$
with base as (
  select a.id,a.code,a.name,o.ending_debit od,o.ending_credit oc,
    coalesce(sum(jl.debit) filter(where je.document_date between p_from and p_to),0)::bigint md,
    coalesce(sum(jl.credit) filter(where je.document_date between p_from and p_to),0)::bigint mc
  from accounts a
  cross join lateral app.account_exact_balance_at(a.company_id,a.id,p_from-1) o
  left join journal_lines jl on jl.account_id=a.id
  left join journal_entries je on je.id=jl.entry_id and je.status='posted' and je.company_id=a.company_id
  where a.company_id=app.current_company_id() and a.postable
  group by a.id,a.code,a.name,o.ending_debit,o.ending_credit
), calc as (
  select *, (od+md)-(oc+mc) net from base
)
select code,name,od,oc,md,mc,greatest(net,0)::bigint,greatest(-net,0)::bigint
from calc where od<>0 or oc<>0 or md<>0 or mc<>0 order by code
$$;

-- NULLS NOT DISTINCT makes dimensional opening balances genuinely unique.
drop index if exists uq_opening_balance_dimensions;
create unique index uq_opening_balance_dimensions on opening_balances
(company_id,fiscal_year,account_id,partner_type,partner_id,project_id) nulls not distinct;

drop index if exists uq_tax_invoice_identity;
create unique index uq_tax_invoice_identity on tax_invoices
(company_id,direction,serial,invoice_no,partner_tax_code) nulls not distinct;

-- ============================================================================
-- SOURCE: 008_business_domain_database.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.2
-- Business-domain database expansion for architecture/design consulting operations.
-- Designed as an incremental migration on top of v3.1.

create extension if not exists citext;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  tax_location_code text,
  active boolean not null default true,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id),
  parent_id uuid references public.departments(id),
  code text not null,
  name text not null,
  active boolean not null default true,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id),
  code text not null,
  name text not null,
  active boolean not null default true,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.disciplines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  full_name text not null,
  title text,
  email citext,
  phone text,
  is_primary boolean not null default false,
  notes text,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((client_id is not null)::int + (vendor_id is not null)::int = 1)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid,
  employee_no text not null,
  full_name text not null,
  email citext,
  phone text,
  employment_type text not null default 'employee' check(employment_type in ('employee','part_time','collaborator','intern')),
  department_id uuid references public.departments(id),
  discipline_id uuid references public.disciplines(id),
  job_title text,
  join_date date,
  leave_date date,
  monthly_salary bigint not null default 0 check(monthly_salary >= 0),
  hourly_cost bigint not null default 0 check(hourly_cost >= 0),
  billing_rate bigint not null default 0 check(billing_rate >= 0),
  standard_monthly_hours numeric(8,2) not null default 176 check(standard_monthly_hours > 0),
  status text not null default 'active' check(status in ('active','probation','inactive','terminated')),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, employee_no),
  unique(company_id, user_id)
);

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  sequence_no int not null default 1 check(sequence_no > 0),
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  status text not null default 'not_started' check(status in ('not_started','in_progress','on_hold','completed','cancelled')),
  progress_percent numeric(5,2) not null default 0 check(progress_percent between 0 and 100),
  budget_hours numeric(12,2) not null default 0 check(budget_hours >= 0),
  budget_cost bigint not null default 0 check(budget_cost >= 0),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, code)
);

create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  discipline_id uuid references public.disciplines(id),
  role_name text,
  allocation_percent numeric(5,2) not null default 100 check(allocation_percent between 0 and 200),
  start_date date,
  end_date date,
  active boolean not null default true,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, employee_id, discipline_id)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id),
  client_id uuid references public.clients(id),
  vendor_id uuid references public.vendors(id),
  contract_no text not null,
  contract_type text not null default 'customer' check(contract_type in ('customer','vendor','collaborator','employment','other')),
  signed_date date,
  effective_date date,
  expiry_date date,
  value_excl_vat bigint not null default 0 check(value_excl_vat >= 0),
  vat_rate numeric(5,2) not null default 0 check(vat_rate between 0 and 100),
  vat_amount bigint generated always as (round(value_excl_vat * vat_rate / 100.0)) stored,
  total_value bigint generated always as (value_excl_vat + round(value_excl_vat * vat_rate / 100.0)) stored,
  currency_code char(3) not null default 'VND',
  status text not null default 'draft' check(status in ('draft','active','completed','suspended','terminated','expired')),
  owner_employee_id uuid references public.employees(id),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, contract_no)
);

create table if not exists public.contract_milestones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  milestone_no int not null check(milestone_no > 0),
  name text not null,
  due_date date,
  percentage numeric(7,4) not null default 0 check(percentage between 0 and 100),
  amount_excl_vat bigint not null default 0 check(amount_excl_vat >= 0),
  acceptance_required boolean not null default true,
  invoice_status text not null default 'not_invoiced' check(invoice_status in ('not_invoiced','partially_invoiced','invoiced','cancelled')),
  payment_status text not null default 'unpaid' check(payment_status in ('unpaid','partial','paid','overdue','cancelled')),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contract_id, milestone_no)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  stage_id uuid references public.project_stages(id) on delete set null,
  parent_id uuid references public.tasks(id) on delete cascade,
  task_no text,
  title text not null,
  description text,
  priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
  status text not null default 'todo' check(status in ('todo','in_progress','review','blocked','done','cancelled')),
  planned_start date,
  due_date date,
  completed_at timestamptz,
  planned_hours numeric(12,2) not null default 0 check(planned_hours >= 0),
  progress_percent numeric(5,2) not null default 0 check(progress_percent between 0 and 100),
  created_by uuid,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, task_no)
);

create table if not exists public.task_assignments (
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  assignment_role text not null default 'assignee' check(assignment_role in ('owner','assignee','reviewer','watcher')),
  assigned_at timestamptz not null default now(),
  primary key(task_id, employee_id, assignment_role)
);

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  project_id uuid references public.projects(id),
  task_id uuid references public.tasks(id),
  work_date date not null,
  hours numeric(6,2) not null check(hours > 0 and hours <= 24),
  billable_hours numeric(6,2) not null default 0 check(billable_hours >= 0 and billable_hours <= hours),
  description text,
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','locked')),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  cost_rate bigint not null default 0 check(cost_rate >= 0),
  billing_rate bigint not null default 0 check(billing_rate >= 0),
  cost_amount bigint generated always as (round(hours * cost_rate)) stored,
  recoverable_revenue bigint generated always as (round(billable_hours * billing_rate)) stored,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date, project_id, task_id)
);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_code text not null,
  date_from date not null,
  date_to date not null,
  status text not null default 'open' check(status in ('open','calculating','reviewed','approved','posted','locked')),
  approved_by uuid,
  approved_at timestamptz,
  journal_entry_id uuid references public.journal_entries(id),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(date_to >= date_from),
  unique(company_id, period_code)
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  gross_salary bigint not null default 0 check(gross_salary >= 0),
  allowances bigint not null default 0 check(allowances >= 0),
  overtime bigint not null default 0 check(overtime >= 0),
  employee_insurance bigint not null default 0 check(employee_insurance >= 0),
  employer_insurance bigint not null default 0 check(employer_insurance >= 0),
  personal_income_tax bigint not null default 0 check(personal_income_tax >= 0),
  other_deductions bigint not null default 0 check(other_deductions >= 0),
  net_salary bigint generated always as (gross_salary + allowances + overtime - employee_insurance - personal_income_tax - other_deductions) stored,
  total_employer_cost bigint generated always as (gross_salary + allowances + overtime + employer_insurance) stored,
  calculation_details jsonb not null default '{}'::jsonb,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payroll_period_id, employee_id)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id),
  account_code text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  currency_code char(3) not null default 'VND',
  ledger_account_id uuid references public.accounts(id),
  active boolean not null default true,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, account_number)
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  external_id text,
  transaction_date date not null,
  value_date date,
  description text,
  debit_amount bigint not null default 0 check(debit_amount >= 0),
  credit_amount bigint not null default 0 check(credit_amount >= 0),
  running_balance bigint,
  counterparty_name text,
  counterparty_account text,
  match_status text not null default 'unmatched' check(match_status in ('unmatched','suggested','matched','ignored')),
  journal_entry_id uuid references public.journal_entries(id),
  imported_at timestamptz not null default now(),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0)),
  unique(company_id, bank_account_id, external_id)
);

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id),
  period_end date not null,
  statement_balance bigint not null,
  ledger_balance bigint not null,
  difference bigint generated always as (statement_balance - ledger_balance) stored,
  status text not null default 'draft' check(status in ('draft','reviewed','approved','locked')),
  prepared_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bank_account_id, period_end)
);

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_no text not null,
  requested_by uuid,
  department_id uuid references public.departments(id),
  project_id uuid references public.projects(id),
  request_date date not null default current_date,
  required_date date,
  purpose text not null,
  estimated_amount bigint not null default 0 check(estimated_amount >= 0),
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','ordered','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, request_no)
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_request_id uuid references public.purchase_requests(id),
  vendor_id uuid not null references public.vendors(id),
  project_id uuid references public.projects(id),
  order_no text not null,
  order_date date not null default current_date,
  expected_date date,
  status text not null default 'draft' check(status in ('draft','approved','sent','partially_received','received','cancelled','closed')),
  subtotal bigint not null default 0 check(subtotal >= 0),
  vat_amount bigint not null default 0 check(vat_amount >= 0),
  total_amount bigint generated always as (subtotal + vat_amount) stored,
  currency_code char(3) not null default 'VND',
  approved_by uuid,
  approved_at timestamptz,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, order_no)
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  line_no int not null check(line_no > 0),
  description text not null,
  quantity numeric(14,4) not null default 1 check(quantity > 0),
  unit text,
  unit_price bigint not null default 0 check(unit_price >= 0),
  vat_rate numeric(5,2) not null default 0 check(vat_rate between 0 and 100),
  line_subtotal bigint generated always as (round(quantity * unit_price)) stored,
  line_vat bigint generated always as (round(quantity * unit_price * vat_rate / 100.0)) stored,
  project_id uuid references public.projects(id),
  cost_center_id uuid references public.cost_centers(id),
  unique(purchase_order_id, line_no)
);

create table if not exists public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  claim_no text not null,
  employee_id uuid references public.employees(id),
  project_id uuid references public.projects(id),
  claim_date date not null default current_date,
  description text not null,
  amount_excl_vat bigint not null default 0 check(amount_excl_vat >= 0),
  vat_amount bigint not null default 0 check(vat_amount >= 0),
  total_amount bigint generated always as (amount_excl_vat + vat_amount) stored,
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','paid','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  journal_entry_id uuid references public.journal_entries(id),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, claim_no)
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  file_id uuid not null references public.files_metadata(id) on delete cascade,
  version_no int not null check(version_no > 0),
  object_path text not null,
  size_bytes bigint not null default 0 check(size_bytes >= 0),
  sha256 text,
  change_note text,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  unique(file_id, version_no),
  unique(company_id, object_path)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  notification_type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  integration_type text not null check(integration_type in ('e_invoice','bank','digital_signature','email','webhook','other')),
  provider_code text not null,
  display_name text not null,
  status text not null default 'disconnected' check(status in ('disconnected','configuring','connected','error','disabled')),
  encrypted_config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, integration_type, provider_code)
);

create index if not exists ix_employees_company_status on public.employees(company_id,status);
create index if not exists ix_project_stages_project on public.project_stages(project_id,sequence_no);
create index if not exists ix_tasks_project_status on public.tasks(company_id,project_id,status,due_date);
create index if not exists ix_timesheets_employee_date on public.timesheets(company_id,employee_id,work_date);
create index if not exists ix_timesheets_project_date on public.timesheets(company_id,project_id,work_date);
create index if not exists ix_contracts_project on public.contracts(company_id,project_id,status);
create index if not exists ix_contract_milestones_due on public.contract_milestones(company_id,due_date,payment_status);
create index if not exists ix_payroll_items_period on public.payroll_items(payroll_period_id);
create index if not exists ix_bank_tx_date on public.bank_transactions(company_id,bank_account_id,transaction_date);
create index if not exists ix_notifications_user_unread on public.notifications(company_id,user_id,created_at desc) where read_at is null;
create index if not exists ix_document_versions_file on public.document_versions(file_id,version_no desc);

-- ============================================================================
-- SOURCE: 009_rbac_rls_database.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 010_accounting_subledgers_tax.sql
-- ============================================================================
-- Accounting subledgers, statutory dimensions and tax data model for TT133.

alter table public.journal_entries add column if not exists branch_id uuid references public.branches(id);
alter table public.journal_entries add column if not exists accounting_period_id uuid references public.accounting_periods(id);
alter table public.journal_entries add column if not exists client_request_id uuid;
alter table public.journal_entries add column if not exists reversal_of uuid references public.journal_entries(id);
alter table public.journal_entries add column if not exists approval_status text not null default 'approved';
alter table public.journal_entries add column if not exists approved_by uuid;
alter table public.journal_entries add column if not exists approved_at timestamptz;
create unique index if not exists uq_journal_client_request on public.journal_entries(company_id,client_request_id) where client_request_id is not null;
create index if not exists ix_journal_period_status on public.journal_entries(company_id,accounting_period_id,status);

alter table public.journal_lines add column if not exists department_id uuid references public.departments(id);
alter table public.journal_lines add column if not exists cost_center_id uuid references public.cost_centers(id);
alter table public.journal_lines add column if not exists employee_id uuid references public.employees(id);
alter table public.journal_lines add column if not exists contract_id uuid references public.contracts(id);
alter table public.journal_lines add column if not exists tax_invoice_id uuid references public.tax_invoices(id);
alter table public.journal_lines add column if not exists bank_transaction_id uuid references public.bank_transactions(id);
create index if not exists ix_journal_lines_dimensions on public.journal_lines(company_id,project_id,cost_center_id,department_id);
create index if not exists ix_journal_lines_partner on public.journal_lines(company_id,partner_type,partner_id);

alter table public.tax_invoices add column if not exists client_id uuid references public.clients(id);
alter table public.tax_invoices add column if not exists vendor_id uuid references public.vendors(id);
alter table public.tax_invoices add column if not exists project_id uuid references public.projects(id);
alter table public.tax_invoices add column if not exists contract_id uuid references public.contracts(id);
alter table public.tax_invoices add column if not exists payment_method text;
alter table public.tax_invoices add column if not exists payment_status text not null default 'unpaid';
alter table public.tax_invoices add column if not exists validation_status text not null default 'pending';
alter table public.tax_invoices add column if not exists validation_message text;
alter table public.tax_invoices add column if not exists external_invoice_id text;
alter table public.tax_invoices add column if not exists source_payload jsonb not null default '{}'::jsonb;

create table if not exists public.subledger_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null check(document_type in ('receivable','payable','advance_receivable','advance_payable')),
  document_no text not null,
  document_date date not null,
  due_date date,
  client_id uuid references public.clients(id),
  vendor_id uuid references public.vendors(id),
  employee_id uuid references public.employees(id),
  project_id uuid references public.projects(id),
  contract_id uuid references public.contracts(id),
  tax_invoice_id uuid references public.tax_invoices(id),
  journal_entry_id uuid references public.journal_entries(id),
  currency_code char(3) not null default 'VND',
  original_amount bigint not null check(original_amount >= 0),
  status text not null default 'open' check(status in ('open','partial','settled','overdue','cancelled','written_off')),
  description text,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((client_id is not null)::int + (vendor_id is not null)::int + (employee_id is not null)::int >= 1),
  unique(company_id,document_type,document_no)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_no text not null,
  payment_date date not null,
  direction text not null check(direction in ('receipt','payment')),
  payment_method text not null check(payment_method in ('cash','bank','offset','other')),
  bank_account_id uuid references public.bank_accounts(id),
  client_id uuid references public.clients(id),
  vendor_id uuid references public.vendors(id),
  employee_id uuid references public.employees(id),
  amount bigint not null check(amount > 0),
  currency_code char(3) not null default 'VND',
  description text,
  status text not null default 'draft' check(status in ('draft','approved','posted','cancelled')),
  journal_entry_id uuid references public.journal_entries(id),
  client_request_id uuid,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,payment_no),
  unique(company_id,client_request_id)
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  subledger_document_id uuid not null references public.subledger_documents(id),
  allocated_amount bigint not null check(allocated_amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id,subledger_document_id)
);

create or replace view public.v_subledger_outstanding with (security_invoker=true) as
select d.*,
  greatest(d.original_amount-coalesce(sum(a.allocated_amount),0),0)::bigint as outstanding_amount,
  case
    when d.status='cancelled' then 'cancelled'
    when greatest(d.original_amount-coalesce(sum(a.allocated_amount),0),0)=0 then 'settled'
    when d.due_date is not null and d.due_date<current_date then 'overdue'
    when coalesce(sum(a.allocated_amount),0)>0 then 'partial'
    else 'open'
  end as calculated_status
from public.subledger_documents d
left join public.payment_allocations a on a.subledger_document_id=d.id
group by d.id;

create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_code text not null,
  asset_name text not null,
  department_id uuid references public.departments(id),
  project_id uuid references public.projects(id),
  acquisition_date date not null,
  in_service_date date,
  original_cost bigint not null check(original_cost >= 0),
  residual_value bigint not null default 0 check(residual_value >= 0),
  useful_life_months int not null check(useful_life_months > 0),
  depreciation_method text not null default 'straight_line' check(depreciation_method in ('straight_line')),
  asset_account_id uuid references public.accounts(id),
  accumulated_depreciation_account_id uuid references public.accounts(id),
  expense_account_id uuid references public.accounts(id),
  status text not null default 'active' check(status in ('pending','active','suspended','disposed')),
  disposal_date date,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,asset_code),
  check(residual_value<=original_cost)
);

create table if not exists public.fixed_asset_depreciation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fixed_asset_id uuid not null references public.fixed_assets(id) on delete cascade,
  period_id uuid not null references public.accounting_periods(id),
  depreciation_amount bigint not null check(depreciation_amount >= 0),
  journal_entry_id uuid references public.journal_entries(id),
  status text not null default 'calculated' check(status in ('calculated','reviewed','posted','reversed')),
  created_at timestamptz not null default now(),
  unique(fixed_asset_id,period_id)
);

create table if not exists public.prepaid_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  prepaid_code text not null,
  description text not null,
  start_date date not null,
  end_date date not null,
  original_amount bigint not null check(original_amount > 0),
  allocation_method text not null default 'monthly_straight_line',
  prepaid_account_id uuid references public.accounts(id),
  expense_account_id uuid references public.accounts(id),
  department_id uuid references public.departments(id),
  project_id uuid references public.projects(id),
  status text not null default 'active' check(status in ('draft','active','completed','cancelled')),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,prepaid_code),
  check(end_date>=start_date)
);

create table if not exists public.prepaid_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  prepaid_expense_id uuid not null references public.prepaid_expenses(id) on delete cascade,
  period_id uuid not null references public.accounting_periods(id),
  allocation_amount bigint not null check(allocation_amount >= 0),
  journal_entry_id uuid references public.journal_entries(id),
  status text not null default 'calculated' check(status in ('calculated','reviewed','posted','reversed')),
  created_at timestamptz not null default now(),
  unique(prepaid_expense_id,period_id)
);

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  tax_type text not null check(tax_type in ('VAT','PIT','CIT','LICENSE_FEE','OTHER')),
  rule_code text not null,
  effective_from date not null,
  effective_to date,
  rate numeric(9,4),
  threshold_amount bigint,
  rule_payload jsonb not null default '{}'::jsonb,
  legal_reference text,
  status text not null default 'active' check(status in ('draft','active','expired','disabled')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id,tax_type,rule_code,effective_from),
  check(effective_to is null or effective_to>=effective_from)
);

create table if not exists public.tax_declarations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tax_type text not null check(tax_type in ('VAT','PIT','CIT','LICENSE_FEE','OTHER')),
  declaration_form text not null,
  period_from date not null,
  period_to date not null,
  filing_frequency text not null default 'quarterly' check(filing_frequency in ('monthly','quarterly','annual','ad_hoc')),
  filing_deadline date,
  payment_deadline date,
  taxable_base bigint not null default 0,
  tax_amount bigint not null default 0,
  paid_amount bigint not null default 0,
  status text not null default 'draft' check(status in ('draft','reviewed','submitted','accepted','rejected','amended','closed')),
  submission_reference text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  prepared_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(period_to>=period_from),
  unique(company_id,tax_type,declaration_form,period_from,period_to)
);

create table if not exists public.tax_declaration_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tax_declaration_id uuid not null references public.tax_declarations(id) on delete cascade,
  line_code text not null,
  label text not null,
  amount bigint not null default 0,
  source_type text,
  source_query jsonb not null default '{}'::jsonb,
  unique(tax_declaration_id,line_code)
);

create table if not exists public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tax_declaration_id uuid references public.tax_declarations(id),
  payment_date date not null,
  payment_reference text,
  amount bigint not null check(amount > 0),
  bank_transaction_id uuid references public.bank_transactions(id),
  journal_entry_id uuid references public.journal_entries(id),
  created_at timestamptz not null default now(),
  unique(company_id,payment_reference)
);

create index if not exists ix_subledger_due on public.subledger_documents(company_id,document_type,due_date,status);
create index if not exists ix_allocations_document on public.payment_allocations(company_id,subledger_document_id);
create index if not exists ix_fixed_assets_company_status on public.fixed_assets(company_id,status);
create index if not exists ix_tax_declarations_due on public.tax_declarations(company_id,filing_deadline,payment_deadline,status);
create index if not exists ix_tax_invoice_validation on public.tax_invoices(company_id,validation_status,invoice_date);

-- Keep subledger allocation within both payment and document values.
create or replace function app.validate_payment_allocation() returns trigger
language plpgsql set search_path=pg_catalog,public,app as $$
declare payment_total bigint; allocated_payment bigint; doc_total bigint; allocated_doc bigint;
begin
  select amount into payment_total from public.payments where id=new.payment_id and company_id=new.company_id;
  select original_amount into doc_total from public.subledger_documents where id=new.subledger_document_id and company_id=new.company_id;
  if payment_total is null or doc_total is null then raise exception 'payment allocation tenant mismatch'; end if;
  select coalesce(sum(allocated_amount),0) into allocated_payment from public.payment_allocations where payment_id=new.payment_id and id<>coalesce(new.id,gen_random_uuid());
  select coalesce(sum(allocated_amount),0) into allocated_doc from public.payment_allocations where subledger_document_id=new.subledger_document_id and id<>coalesce(new.id,gen_random_uuid());
  if allocated_payment+new.allocated_amount>payment_total then raise exception 'payment is over-allocated'; end if;
  if allocated_doc+new.allocated_amount>doc_total then raise exception 'subledger document is over-allocated'; end if;
  return new;
end $$;
drop trigger if exists trg_validate_payment_allocation on public.payment_allocations;
create trigger trg_validate_payment_allocation before insert or update on public.payment_allocations
for each row execute function app.validate_payment_allocation();

-- Deterministic straight-line depreciation amount for a single full month.
create or replace function app.monthly_straight_line_depreciation(p_asset uuid) returns bigint
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select case when useful_life_months>0 then round((original_cost-residual_value)::numeric/useful_life_months)::bigint else 0 end
  from public.fixed_assets
  where id=p_asset and app.is_company_member(company_id)
$$;

-- ============================================================================
-- SOURCE: 011_concurrency_audit_sync.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 012_core_rls_and_immutability.sql
-- ============================================================================
-- Replace legacy tenant policies with membership-based RLS and add immutable workflow guards.

create or replace function app.drop_all_policies(p_table text) returns void
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename=p_table loop
    execute format('drop policy if exists %I on public.%I',p.policyname,p_table);
  end loop;
end $$;

-- Core tenant tables with module-level permissions.
do $$
declare r record;
begin
  for r in select * from (values
    ('accounting_periods','accounting.read','accounting.close'),
    ('accounts','accounting.read','accounting.write'),
    ('clients','crm.read','crm.write'),
    ('vendors','procurement.read','procurement.write'),
    ('projects','projects.read','projects.write'),
    ('journal_entries','accounting.read','accounting.write'),
    ('journal_lines','accounting.read','accounting.write'),
    ('opening_balances','accounting.read','accounting.write'),
    ('tax_invoices','tax.read','tax.write'),
    ('files_metadata','documents.read','documents.write'),
    ('parallel_reconciliations','accounting.read','accounting.write'),
    ('report_signoffs','accounting.read','accounting.close'),
    ('report_notes_tt133','accounting.read','accounting.write'),
    ('subledger_documents','accounting.read','accounting.write'),
    ('payments','accounting.read','accounting.write'),
    ('payment_allocations','accounting.read','accounting.write'),
    ('fixed_assets','accounting.read','accounting.write'),
    ('fixed_asset_depreciation','accounting.read','accounting.write'),
    ('prepaid_expenses','accounting.read','accounting.write'),
    ('prepaid_allocations','accounting.read','accounting.write'),
    ('tax_declarations','tax.read','tax.write'),
    ('tax_declaration_lines','tax.read','tax.write'),
    ('tax_payments','tax.read','tax.write')
  ) v(table_name,read_permission,write_permission)
  loop
    perform app.drop_all_policies(r.table_name);
    execute format('alter table public.%I enable row level security',r.table_name);
    execute format('create policy %I on public.%I for select using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',r.table_name||'_select_v3',r.table_name,r.read_permission);
    execute format('create policy %I on public.%I for insert with check (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',r.table_name||'_insert_v3',r.table_name,r.write_permission);
    execute format('create policy %I on public.%I for update using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id))) with check (app.is_company_member(company_id))',r.table_name||'_update_v3',r.table_name,r.write_permission);
    execute format('create policy %I on public.%I for delete using (app.is_company_member(company_id) and (app.has_permission(%L,company_id) or app.has_permission(''admin'',company_id)))',r.table_name||'_delete_v3',r.table_name,r.write_permission);
  end loop;
end $$;

-- Company, identity and role policies.
select app.drop_all_policies('companies');
alter table public.companies enable row level security;
create policy companies_select_v3 on public.companies for select using(app.is_company_member(id));
create policy companies_update_v3 on public.companies for update using(app.has_permission('admin',id)) with check(app.has_permission('admin',id));

select app.drop_all_policies('profiles');
alter table public.profiles enable row level security;
create policy profiles_select_v3 on public.profiles for select using(
  user_id=app.current_user_id() or exists(
    select 1 from public.memberships me join public.memberships other_m on other_m.company_id=me.company_id
    where me.user_id=app.current_user_id() and me.status='active' and other_m.user_id=profiles.user_id
  )
);
create policy profiles_update_own_v3 on public.profiles for update using(user_id=app.current_user_id()) with check(user_id=app.current_user_id());

select app.drop_all_policies('roles');
alter table public.roles enable row level security;
create policy roles_select_v3 on public.roles for select using(app.is_company_member(company_id));
create policy roles_manage_v3 on public.roles for all using(app.has_permission('admin',company_id)) with check(app.has_permission('admin',company_id));

select app.drop_all_policies('memberships');
alter table public.memberships enable row level security;
create policy memberships_select_v3 on public.memberships for select using(app.is_company_member(company_id));
create policy memberships_manage_v3 on public.memberships for all using(app.has_permission('admin',company_id)) with check(app.has_permission('admin',company_id));

select app.drop_all_policies('document_sequences');
alter table public.document_sequences enable row level security;
create policy sequences_select_v3 on public.document_sequences for select using(app.is_company_member(company_id) and app.has_permission('accounting.read',company_id));
-- Direct sequence mutation is intentionally absent; SECURITY DEFINER functions own numbering.

select app.drop_all_policies('edit_locks');
alter table public.edit_locks enable row level security;
create policy edit_locks_select_v3 on public.edit_locks for select using(app.is_company_member(company_id));
-- Direct mutation is intentionally absent; acquire/release RPCs own locks.

select app.drop_all_policies('audit_events');
alter table public.audit_events enable row level security;
create policy audit_events_select_v3 on public.audit_events for select using(app.is_company_member(company_id) and app.has_permission('audit.read',company_id));

-- Reference cash-flow codes are read-only for authenticated users.
select app.drop_all_policies('cash_flow_codes');
alter table public.cash_flow_codes enable row level security;
create policy cash_flow_codes_read_v3 on public.cash_flow_codes for select using(app.current_user_id() is not null);

-- Tax rules can be global (company_id NULL) or tenant-specific.
select app.drop_all_policies('tax_rules');
alter table public.tax_rules enable row level security;
create policy tax_rules_select_v3 on public.tax_rules for select using(company_id is null or (app.is_company_member(company_id) and app.has_permission('tax.read',company_id)));
create policy tax_rules_manage_v3 on public.tax_rules for all using(company_id is not null and app.has_permission('tax.write',company_id)) with check(company_id is not null and app.has_permission('tax.write',company_id));

-- Workflow immutability.
create or replace function app.guard_payroll_locked() returns trigger
language plpgsql set search_path=pg_catalog,public,app as $$
declare s text;
begin
  if tg_table_name='payroll_periods' then
    if tg_op='DELETE' and old.status in ('approved','posted','locked') then raise exception 'approved/posted payroll period is immutable'; end if;
    if tg_op='UPDATE' and old.status in ('posted','locked') and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'posted/locked payroll period is immutable'; end if;
  else
    select status into s from public.payroll_periods where id=coalesce(new.payroll_period_id,old.payroll_period_id) for share;
    if s in ('approved','posted','locked') then raise exception 'payroll items are immutable after approval'; end if;
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists trg_guard_payroll_period on public.payroll_periods;
create trigger trg_guard_payroll_period before update or delete on public.payroll_periods for each row execute function app.guard_payroll_locked();
drop trigger if exists trg_guard_payroll_item on public.payroll_items;
create trigger trg_guard_payroll_item before insert or update or delete on public.payroll_items for each row execute function app.guard_payroll_locked();

create or replace function app.guard_tax_declaration_closed() returns trigger
language plpgsql set search_path=pg_catalog,public,app as $$
begin
  if old.status in ('accepted','closed') and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'accepted/closed tax declaration is immutable; create an amendment';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_tax_declaration_closed on public.tax_declarations;
create trigger trg_guard_tax_declaration_closed before update on public.tax_declarations for each row execute function app.guard_tax_declaration_closed();

create or replace function app.guard_approved_bank_reconciliation() returns trigger
language plpgsql set search_path=pg_catalog,public,app as $$
begin
  if old.status in ('approved','locked') and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'approved bank reconciliation is immutable';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_bank_reconciliation on public.bank_reconciliations;
create trigger trg_guard_bank_reconciliation before update on public.bank_reconciliations for each row execute function app.guard_approved_bank_reconciliation();

-- Direct API privileges. RLS and workflow guards are still authoritative.
grant select,insert,update,delete on
  public.subledger_documents,public.payments,public.payment_allocations,
  public.fixed_assets,public.fixed_asset_depreciation,public.prepaid_expenses,
  public.prepaid_allocations,public.tax_declarations,public.tax_declaration_lines,
  public.tax_payments,public.tax_rules to authenticated;
grant select on public.cash_flow_codes to authenticated;
revoke insert,update,delete on public.audit_events,public.document_sequences,public.edit_locks from anon,authenticated;

-- ============================================================================
-- SOURCE: 013_integrity_reports_health.sql
-- ============================================================================
-- Data-quality gates, report snapshots and strict accounting-period close.

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_code text not null,
  period_from date not null,
  period_to date not null,
  parameters jsonb not null default '{}'::jsonb,
  report_data jsonb not null,
  data_hash text not null,
  generated_by uuid,
  generated_at timestamptz not null default clock_timestamp(),
  status text not null default 'generated' check(status in ('generated','reviewed','signed','superseded')),
  row_version bigint not null default 1,
  updated_at timestamptz not null default now(),
  signed_by uuid,
  signed_at timestamptz,
  signature_reference text,
  unique(company_id,report_code,period_from,period_to,data_hash)
);

alter table public.report_snapshots enable row level security;
create policy report_snapshots_select_v3 on public.report_snapshots for select
using(app.is_company_member(company_id) and app.has_permission('accounting.read',company_id));
create policy report_snapshots_insert_v3 on public.report_snapshots for insert
with check(app.is_company_member(company_id) and app.has_permission('accounting.write',company_id));
create policy report_snapshots_update_v3 on public.report_snapshots for update
using(app.is_company_member(company_id) and app.has_permission('accounting.close',company_id))
with check(app.is_company_member(company_id));
grant select,insert,update on public.report_snapshots to authenticated;

create or replace view public.v_project_financials with (security_invoker=true) as
with revenue as (
  select jl.company_id,coalesce(jl.project_id,je.project_id) project_id,
    sum(jl.credit-jl.debit)::bigint amount
  from public.journal_lines jl
  join public.journal_entries je on je.id=jl.entry_id and je.status='posted'
  join public.accounts a on a.id=jl.account_id and a.code like '511%'
  group by jl.company_id,coalesce(jl.project_id,je.project_id)
), cost as (
  select jl.company_id,coalesce(jl.project_id,je.project_id) project_id,
    sum(jl.debit-jl.credit)::bigint amount
  from public.journal_lines jl
  join public.journal_entries je on je.id=jl.entry_id and je.status='posted'
  join public.accounts a on a.id=jl.account_id and (a.code like '632%' or a.code like '154%')
  group by jl.company_id,coalesce(jl.project_id,je.project_id)
), labor as (
  select company_id,project_id,sum(cost_amount)::bigint labor_cost,
    sum(recoverable_revenue)::bigint recoverable_revenue,
    sum(hours)::numeric(14,2) hours,sum(billable_hours)::numeric(14,2) billable_hours
  from public.timesheets where status in ('approved','locked') group by company_id,project_id
)
select p.company_id,p.id project_id,p.code,p.name,p.status,p.contract_value,p.direct_budget,
  coalesce(r.amount,0)::bigint recognized_revenue,
  coalesce(c.amount,0)::bigint accounting_cost,
  coalesce(l.labor_cost,0)::bigint management_labor_cost,
  coalesce(l.recoverable_revenue,0)::bigint recoverable_revenue,
  coalesce(l.hours,0)::numeric(14,2) approved_hours,
  coalesce(l.billable_hours,0)::numeric(14,2) billable_hours,
  (coalesce(r.amount,0)-coalesce(c.amount,0))::bigint accounting_profit,
  case when coalesce(r.amount,0)=0 then 0 else round((coalesce(r.amount,0)-coalesce(c.amount,0))*100.0/r.amount,2) end profit_margin_percent,
  case when coalesce(l.hours,0)=0 then 0 else round(l.billable_hours*100.0/l.hours,2) end utilization_percent
from public.projects p
left join revenue r on r.company_id=p.company_id and r.project_id=p.id
left join cost c on c.company_id=p.company_id and c.project_id=p.id
left join labor l on l.company_id=p.company_id and l.project_id=p.id;

create or replace view public.v_payroll_summary with (security_invoker=true) as
select pp.company_id,pp.id payroll_period_id,pp.period_code,pp.date_from,pp.date_to,pp.status,
  count(pi.id)::int employee_count,
  coalesce(sum(pi.gross_salary),0)::bigint gross_salary,
  coalesce(sum(pi.allowances+pi.overtime),0)::bigint additions,
  coalesce(sum(pi.employee_insurance+pi.personal_income_tax+pi.other_deductions),0)::bigint employee_deductions,
  coalesce(sum(pi.employer_insurance),0)::bigint employer_insurance,
  coalesce(sum(pi.net_salary),0)::bigint net_salary,
  coalesce(sum(pi.total_employer_cost),0)::bigint total_employer_cost
from public.payroll_periods pp left join public.payroll_items pi on pi.payroll_period_id=pp.id
group by pp.id;

create or replace function app.validate_database_integrity(
  p_company uuid,p_from date default null,p_to date default null
) returns table(check_code text,check_name text,status text,issue_count bigint,details jsonb)
language plpgsql stable security definer set search_path=pg_catalog,public,app as $$
declare d_from date:=coalesce(p_from,date_trunc('year',current_date)::date); d_to date:=coalesce(p_to,current_date); n bigint; diff bigint; audit_ok boolean; audit_broken bigint; audit_reason text;
begin
  perform app.assert_company_access(p_company);

  select count(*) into n from public.journal_entries je
  where je.company_id=p_company and je.status='posted' and not exists(
    select 1 from public.journal_lines jl where jl.entry_id=je.id
    group by jl.entry_id having sum(jl.debit)=sum(jl.credit) and sum(jl.debit)>0 and count(*)>=2
  );
  return query select 'JOURNAL_BALANCE','Chứng từ đã ghi sổ cân Nợ/Có',case when n=0 then 'PASS' else 'FAIL' end,n,jsonb_build_object('period_from',d_from,'period_to',d_to);

  select abs(coalesce(sum(jl.debit),0)-coalesce(sum(jl.credit),0))::bigint into diff
  from public.journal_lines jl join public.journal_entries je on je.id=jl.entry_id
  where je.company_id=p_company and je.status='posted' and je.document_date between d_from and d_to;
  return query select 'TRIAL_BALANCE','Tổng phát sinh Nợ bằng Có',case when diff=0 then 'PASS' else 'FAIL' end,diff,jsonb_build_object('difference',diff);

  select count(*) into n from public.journal_entries je
  where je.company_id=p_company and je.status='posted' and je.document_date between d_from and d_to
    and exists(select 1 from public.accounting_periods p where p.company_id=je.company_id and je.document_date between p.date_from and p.date_to and p.status='hard_locked' and je.posted_at>p.locked_at);
  return query select 'LOCKED_PERIOD','Không ghi sổ sau khi khóa cứng',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select count(*) into n from public.tax_invoices ti
  where ti.company_id=p_company and ti.invoice_date between d_from and d_to
    and ti.total_amount<>ti.tax_base+ti.vat_amount;
  return query select 'VAT_ARITHMETIC','Tổng hóa đơn bằng giá tính thuế cộng VAT',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select count(*) into n from (
    select a.payment_id
    from public.payment_allocations a join public.payments p on p.id=a.payment_id
    where a.company_id=p_company
    group by a.payment_id,p.amount
    having sum(a.allocated_amount)>p.amount
  ) over_allocated;
  return query select 'PAYMENT_ALLOCATION','Không phân bổ vượt số tiền thanh toán',case when coalesce(n,0)=0 then 'PASS' else 'FAIL' end,coalesce(n,0),'{}'::jsonb;

  select count(*) into n from public.timesheets t
  where t.company_id=p_company and t.work_date between d_from and d_to and (t.billable_hours>t.hours or t.hours<=0 or t.hours>24);
  return query select 'TIMESHEET_HOURS','Giờ billable không vượt tổng giờ',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select count(*) into n from public.payroll_items pi
  where pi.company_id=p_company and pi.net_salary<0;
  return query select 'PAYROLL_NET','Lương thực nhận không âm',case when n=0 then 'PASS' else 'FAIL' end,n,'{}'::jsonb;

  select valid,broken_at,reason into audit_ok,audit_broken,audit_reason from app.verify_audit_chain(p_company);
  return query select 'AUDIT_CHAIN','Chuỗi audit bất biến hợp lệ',case when audit_ok then 'PASS' else 'FAIL' end,case when audit_ok then 0 else 1 end,jsonb_build_object('broken_at',audit_broken,'reason',audit_reason);
end $$;

create or replace function app.generate_report_snapshot(
  p_report_code text,p_from date,p_to date,p_parameters jsonb default '{}'::jsonb
) returns public.report_snapshots
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); payload jsonb; h text; r public.report_snapshots;
begin
  if not app.has_permission('accounting.write',cid) then raise exception 'permission denied'; end if;
  payload:=case upper(p_report_code)
    when 'B01A-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b01a_dnn(p_from,p_to) x)
    when 'B02-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b02_dnn(p_from,p_to) x)
    when 'B03-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b03_dnn(p_from,p_to) x)
    when 'B09-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_b09_dnn(p_from,p_to) x)
    when 'F01-DNN' then (select jsonb_agg(to_jsonb(x)) from app.report_f01_dnn(p_from,p_to) x)
    else raise exception 'unsupported report code'
  end;
  payload:=coalesce(payload,'[]'::jsonb);
  h:=encode(digest(convert_to(jsonb_build_object('report',upper(p_report_code),'from',p_from,'to',p_to,'parameters',p_parameters,'data',payload)::text,'UTF8'),'sha256'),'hex');
  insert into public.report_snapshots(company_id,report_code,period_from,period_to,parameters,report_data,data_hash,generated_by)
  values(cid,upper(p_report_code),p_from,p_to,p_parameters,payload,h,app.current_user_id()) returning * into r;
  perform app.append_audit(cid,'report_snapshots',r.id::text,'SIGNOFF',null,to_jsonb(r));
  return r;
end $$;

create or replace function app.close_accounting_period_strict(
  p_period uuid,p_expected_version bigint,p_hard boolean default true
) returns public.accounting_periods
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare r public.accounting_periods; c record; failures text[]:='{}';
begin
  select * into r from public.accounting_periods where id=p_period for update;
  if not found or not app.has_permission('accounting.close',r.company_id) then raise exception 'permission denied'; end if;
  if r.row_version<>p_expected_version then raise exception 'concurrent update' using errcode='40001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('period-close|'||r.company_id::text||'|'||r.date_from::text,0));
  if exists(select 1 from public.journal_entries where company_id=r.company_id and document_date between r.date_from and r.date_to and status='draft') then failures:=array_append(failures,'Còn chứng từ nháp'); end if;
  if exists(select 1 from app.validate_database_integrity(r.company_id,r.date_from,r.date_to) where status='FAIL') then failures:=array_append(failures,'Kiểm tra toàn vẹn dữ liệu chưa đạt'); end if;
  if exists(select 1 from public.bank_reconciliations where company_id=r.company_id and period_end=r.date_to and status not in ('approved','locked')) then failures:=array_append(failures,'Đối chiếu ngân hàng chưa phê duyệt'); end if;
  if cardinality(failures)>0 then raise exception 'period close rejected: %',array_to_string(failures,'; '); end if;
  update public.accounting_periods set status=case when p_hard then 'hard_locked' else 'soft_locked' end,locked_at=clock_timestamp(),locked_by=app.current_user_id()
  where id=r.id returning * into r;
  perform app.append_audit(r.company_id,'accounting_periods',r.id::text,'LOCK',null,to_jsonb(r));
  return r;
end $$;

-- ============================================================================
-- SOURCE: 014_seed_reference_and_version.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 015_triggers_storage_consistency.sql
-- ============================================================================
-- Cross-table consistency triggers, audit coverage and Supabase Storage policies.

-- Touch/audit coverage for accounting subledgers.
do $$
declare t text;
begin
  foreach t in array array[
    'subledger_documents','payments','fixed_assets','prepaid_expenses',
    'tax_declarations','report_snapshots'
  ] loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_touch',t);
    execute format('create trigger %I before update on public.%I for each row execute function app.touch_row()','trg_'||t||'_touch',t);
  end loop;
  foreach t in array array[
    'subledger_documents','payments','payment_allocations','fixed_assets',
    'fixed_asset_depreciation','prepaid_expenses','prepaid_allocations',
    'tax_declarations','tax_declaration_lines','tax_payments','report_snapshots'
  ] loop
    execute format('drop trigger if exists %I on public.%I','trg_audit_'||t,t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.audit_row_change()','trg_audit_'||t,t);
  end loop;
end $$;

create or replace function app.guard_accounting_child_tenant() returns trigger
language plpgsql set search_path=pg_catalog,public,app as $$
declare cid uuid;
begin
  if tg_table_name='payment_allocations' then
    select p.company_id into cid from public.payments p where p.id=new.payment_id;
    if cid<>new.company_id or not exists(select 1 from public.subledger_documents d where d.id=new.subledger_document_id and d.company_id=new.company_id) then raise exception 'payment allocation tenant mismatch'; end if;
  elsif tg_table_name='fixed_asset_depreciation' then
    select company_id into cid from public.fixed_assets where id=new.fixed_asset_id;
    if cid<>new.company_id then raise exception 'depreciation tenant mismatch'; end if;
  elsif tg_table_name='prepaid_allocations' then
    select company_id into cid from public.prepaid_expenses where id=new.prepaid_expense_id;
    if cid<>new.company_id then raise exception 'prepaid allocation tenant mismatch'; end if;
  elsif tg_table_name='tax_declaration_lines' then
    select company_id into cid from public.tax_declarations where id=new.tax_declaration_id;
    if cid<>new.company_id then raise exception 'tax declaration line tenant mismatch'; end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['payment_allocations','fixed_asset_depreciation','prepaid_allocations','tax_declaration_lines'] loop
    execute format('drop trigger if exists %I on public.%I','trg_tenant_'||t,t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function app.guard_accounting_child_tenant()','trg_tenant_'||t,t);
  end loop;
end $$;

create or replace function app.recalculate_purchase_order(p_order uuid) returns public.purchase_orders
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare r public.purchase_orders; s bigint; v bigint;
begin
  select * into r from public.purchase_orders where id=p_order for update;
  if not found then raise exception 'purchase order not found'; end if;
  select coalesce(sum(line_subtotal),0),coalesce(sum(line_vat),0) into s,v from public.purchase_order_lines where purchase_order_id=p_order;
  update public.purchase_orders set subtotal=s,vat_amount=v where id=p_order returning * into r;
  return r;
end $$;

create or replace function app.purchase_order_line_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,app as $$
begin
  perform app.recalculate_purchase_order(coalesce(new.purchase_order_id,old.purchase_order_id));
  return coalesce(new,old);
end $$;
drop trigger if exists trg_po_line_recalculate on public.purchase_order_lines;
create trigger trg_po_line_recalculate after insert or update or delete on public.purchase_order_lines
for each row execute function app.purchase_order_line_changed();

-- Store current document version number in files_metadata metadata through a view.
create or replace view public.v_files_latest with (security_invoker=true) as
select f.*,v.id latest_version_id,v.version_no,v.object_path latest_object_path,
  v.size_bytes latest_size_bytes,v.sha256 latest_sha256,v.created_at latest_uploaded_at
from public.files_metadata f
left join lateral (
  select dv.* from public.document_versions dv where dv.file_id=f.id order by dv.version_no desc limit 1
) v on true;

-- Supabase private storage bucket. Path convention:
-- {company_id}/{project_id-or-general}/{file_id}/{version_no}/{filename}
do $$
begin
  if exists(select 1 from information_schema.schemata where schema_name='storage') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('company-files','company-files',false,1073741824,null)
    on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

    drop policy if exists company_files_read_v3 on storage.objects;
    create policy company_files_read_v3 on storage.objects for select to authenticated
    using(bucket_id='company-files'
      and app.is_company_member(((storage.foldername(name))[1])::uuid)
      and app.has_permission('documents.read',((storage.foldername(name))[1])::uuid));

    drop policy if exists company_files_insert_v3 on storage.objects;
    create policy company_files_insert_v3 on storage.objects for insert to authenticated
    with check(bucket_id='company-files'
      and app.is_company_member(((storage.foldername(name))[1])::uuid)
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid));

    drop policy if exists company_files_update_v3 on storage.objects;
    create policy company_files_update_v3 on storage.objects for update to authenticated
    using(bucket_id='company-files'
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid))
    with check(bucket_id='company-files'
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid));

    drop policy if exists company_files_delete_v3 on storage.objects;
    create policy company_files_delete_v3 on storage.objects for delete to authenticated
    using(bucket_id='company-files'
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid));
  end if;
end $$;

-- ============================================================================
-- SOURCE: 016_export_center.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 017_operational_controls_v34.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 018_algorithm_first_v35.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 019_production_hardening_v36.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 020_production_completion_v37.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 021_final_release_hardening_v371.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.7.1 - Final release hardening.
-- Fixes release permission alignment, locks legacy validation evidence, and advances formula/release versions.

alter table public.companies alter column active_release_version set default '3.7.1';
update public.companies
set active_release_version='3.7.1',go_live_status='blocked',go_live_approved_at=null,go_live_approved_by=null
where active_release_version='3.7.0' and operational_mode in ('pilot','parallel');

alter table public.project_control_snapshots
  alter column formula_version set default 'ALPHA-PROJECT-CONTROL-2.3';

-- Internal helper functions are not direct client APIs. Public wrappers retain the required access checks.
revoke all on function app.required_release_gates() from public,anon,authenticated;
revoke all on function app.release_gate_status(uuid,text) from public,anon,authenticated;
revoke all on function app.assert_operational_write_allowed(uuid) from public,anon,authenticated;
revoke all on function app.production_readiness() from public,anon,authenticated;
revoke all on function app.current_user_context() from public,anon,authenticated;

-- Legacy validation tables are evidence stores, not user-editable business records.
revoke insert,update,delete,truncate,references,trigger
  on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,
     public.backup_manifests,public.restore_drills
  from authenticated;
grant select on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,
     public.backup_manifests,public.restore_drills to authenticated;
grant all on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,
     public.backup_manifests,public.restore_drills to service_role;

insert into public.schema_versions(version,description) values
('3.7.1','Final release hardening: cash/allocation separation, approved risk baseline, API permission alignment, live browser gate and secret scan')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

-- ============================================================================
-- SOURCE: 022_deep_audit_patch2.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.7.1 Deep Audit Patch 2
-- Correct operational-mode state transitions when leaving production.

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
    update public.companies set
      operational_mode=p_mode,
      production_mode=false,
      production_writes_enabled=false,
      go_live_status=case when p_mode='suspended' then 'revoked' else 'blocked' end,
      go_live_approved_at=null,
      go_live_approved_by=null
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

insert into public.schema_versions(version,description) values
('3.7.1-patch2','Deep audit patch 2: accounting reports, date validation, upstream timeout and safe operational-mode transitions')
on conflict(version) do nothing;

-- ============================================================================
-- SOURCE: 023_long_term_core_v380.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.8.0 Long-term Core
-- Align document identity, immutable posting hashes and release metadata.

alter table public.companies alter column active_release_version set default '3.8.0';
update public.companies
set active_release_version='3.8.0',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version in ('3.7.0','3.7.1','3.7.1-patch2')
  and operational_mode in ('pilot','parallel','maintenance');

-- Document numbers are unique within company, source book and fiscal calendar year.
-- This matches normal accounting practice while allowing the same sequence in separate books.
drop index if exists public.uq_journal_document_active;
create unique index if not exists uq_journal_document_source_year_active
on public.journal_entries(
  company_id,
  coalesce(lower(nullif(btrim(source_type),'')),'general'),
  extract(year from document_date),
  lower(btrim(document_no))
)
where status <> 'cancelled';

-- New/updated Posted documents must carry a SHA-256 digest. NOT VALID preserves safe migration
-- for legacy rows; the application upgrades verified legacy hashes before re-saving them.
alter table public.journal_entries
  drop constraint if exists ck_journal_posted_sha256_v380;
alter table public.journal_entries
  add constraint ck_journal_posted_sha256_v380
  check (status <> 'posted' or posting_hash ~ '^[0-9a-f]{64}$') not valid;

alter table public.tax_invoices
  drop constraint if exists ck_tax_invoice_due_date_v380;
alter table public.tax_invoices
  add constraint ck_tax_invoice_due_date_v380
  check (due_date is null or due_date >= invoice_date) not valid;

create index if not exists ix_journal_source_year_document_v380
on public.journal_entries(company_id,source_type,document_date,document_no);
create index if not exists ix_tax_invoice_project_date_status_v380
on public.tax_invoices(company_id,project_id,invoice_date,status);

insert into public.schema_versions(version,description) values
('3.8.0','Long-term core: source/year document identity, SHA-256 posting integrity, due-date validation, optimized accounting engine and unified ALPHA UI')
on conflict(version) do nothing;

-- ============================================================================
-- SOURCE: 024_final_release_audit.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.8.0 Final Release Audit
-- Align the private storage bucket used by the web client with database policies and enforce the UI's 100 MB limit server-side.

do $$
begin
  if exists(select 1 from information_schema.schemata where schema_name='storage') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('company-files','company-files',false,104857600,null)
    on conflict(id) do update
      set public=false,
          file_size_limit=excluded.file_size_limit;
  end if;
end $$;

comment on table public.files_metadata is 'ALPHA DESIGN company file metadata. Binary objects are stored in private bucket company-files under a company-id-prefixed path.';

-- ============================================================================
-- SOURCE: 025_smart_control_engine_v390.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v3.9.0 Smart Control Engine
-- Advances release metadata and invalidates prior go-live approvals because the project-control formula changed materially.

alter table public.companies alter column active_release_version set default '3.9.0';

update public.companies
set active_release_version='3.9.0',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='3.8.0'
  and operational_mode in ('pilot','parallel','maintenance');

alter table public.project_control_snapshots
  alter column formula_version set default 'ALPHA-SMART-CONTROL-4.0';

insert into public.schema_versions(version,description) values
('3.9.0','Smart Control Engine: committed contract and pipeline separation, cutoff-aware approved budgets, conservative EAC, direct-cost lineage, invoice allocation and unapplied-cash controls')
on conflict(version) do nothing;

-- ============================================================================
-- SOURCE: 026_procurement_asset_control_v400.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 027_financial_analytics_forecast_v410.sql
-- ============================================================================
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

-- ============================================================================
-- SOURCE: 028_ui_rbac_linkage_audit_v420.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.2.0 UI, Director-managed module RBAC and linkage controls.

alter table public.companies alter column active_release_version set default '4.2.0';
update public.companies
set active_release_version='4.2.0', go_live_status='blocked', go_live_approved_at=null, go_live_approved_by=null
where active_release_version='4.1.0' and operational_mode in ('pilot','parallel','maintenance');

create or replace function app.current_user_is_director(p_company uuid default app.current_company_id()) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select exists(
    select 1
    from public.memberships m
    join public.roles r on r.id=m.role_id
    where m.company_id=p_company
      and m.user_id=app.current_user_id()
      and m.status='active'
      and (upper(r.code)='DIRECTOR' or 'admin'=any(coalesce(r.permissions,array[]::text[])))
  )
$$;
revoke all on function app.current_user_is_director(uuid) from public,anon;
grant execute on function app.current_user_is_director(uuid) to authenticated;

create or replace function app.list_company_roles() returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); result jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('users.manage',cid)
     and not app.has_permission('roles.manage',cid)
     and not app.has_permission('admin',cid) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'role_id',r.id,
    'role_code',r.code,
    'role_name',r.name,
    'role_description',coalesce(r.description,''),
    'is_admin',(upper(r.code)='DIRECTOR' or 'admin'=any(coalesce(r.permissions,array[]::text[]))),
    'permissions',(
      select to_jsonb(array(
        select distinct pcode from (
          select unnest(coalesce(r.permissions,array[]::text[])) pcode
          union all
          select rp.permission_code from public.role_permissions rp where rp.role_id=r.id
        ) q where nullif(trim(pcode),'') is not null order by pcode
      ))
    )
  ) order by r.name),'[]'::jsonb)
  into result
  from public.roles r
  where r.company_id=cid;
  return result;
end $$;
revoke all on function app.list_company_roles() from public,anon;
grant execute on function app.list_company_roles() to authenticated;

create or replace function public.list_company_roles() returns jsonb
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select app.list_company_roles()
$$;
revoke all on function public.list_company_roles() from public,anon;
grant execute on function public.list_company_roles() to authenticated;

create or replace function app.update_role_module_permissions(p_role_code text,p_permissions text[]) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare
  cid uuid:=app.current_company_id();
  rid uuid;
  old_permissions text[];
  clean_permissions text[];
  invalid_permissions text[];
begin
  perform app.assert_company_access(cid);
  if not app.current_user_is_director(cid) then
    raise exception 'only Director can change role module access' using errcode='42501';
  end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required' using errcode='42501'; end if;
  select id,coalesce(permissions,array[]::text[]) into rid,old_permissions
  from public.roles where company_id=cid and code=p_role_code for update;
  if rid is null then raise exception 'role not found' using errcode='P0002'; end if;
  if upper(p_role_code)='DIRECTOR' or 'admin'=any(old_permissions) then
    raise exception 'Director permissions are fixed and cannot be reduced' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct trim(x) order by trim(x)),array[]::text[])
  into clean_permissions
  from unnest(coalesce(p_permissions,array[]::text[])) x
  where nullif(trim(x),'') is not null;
  if not 'dashboard.read'=any(clean_permissions) then
    clean_permissions:=array_append(clean_permissions,'dashboard.read');
  end if;
  select coalesce(array_agg(x),array[]::text[]) into invalid_permissions
  from unnest(clean_permissions) x
  where not exists(select 1 from public.permissions p where p.code=x);
  if cardinality(invalid_permissions)>0 then
    raise exception 'unknown permissions: %',array_to_string(invalid_permissions,', ') using errcode='22023';
  end if;
  delete from public.role_permissions where role_id=rid;
  insert into public.role_permissions(role_id,permission_code)
  select rid,x from unnest(clean_permissions) x;
  update public.roles set permissions=clean_permissions where id=rid;
  perform app.append_audit(cid,'roles',rid::text,'UPDATE_MODULE_ACCESS',to_jsonb(old_permissions),to_jsonb(clean_permissions));
  return jsonb_build_object('role_code',p_role_code,'permissions',clean_permissions);
end $$;
revoke all on function app.update_role_module_permissions(text,text[]) from public,anon;
grant execute on function app.update_role_module_permissions(text,text[]) to authenticated;

create or replace function public.update_role_module_permissions(p_role_code text,p_permissions text[]) returns jsonb
language sql security definer set search_path=pg_catalog,public,app as $$
  select app.update_role_module_permissions(p_role_code,p_permissions)
$$;
revoke all on function public.update_role_module_permissions(text,text[]) from public,anon;
grant execute on function public.update_role_module_permissions(text,text[]) to authenticated;

insert into public.schema_versions(version,description) values
('4.2.0','UI display fixes, safe contract deletion, Director-managed module access, contract KPI filtering and cross-module linkage audit')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

-- ============================================================================
-- SOURCE: 029_ui_icon_formula_linkage_audit_v430.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.3.0 UI icon, dashboard formula and cross-module linkage audit.
-- No destructive schema change. This migration advances the controlled release marker only.

alter table public.companies alter column active_release_version set default '4.3.0';

update public.companies
set active_release_version='4.3.0',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.2.0'
  and operational_mode in ('pilot','parallel','maintenance');

insert into public.schema_versions(version,description) values
('4.3.0','Sidebar compact-mode stabilization, distinct navigation icons, notification icon redesign, legacy display cleanup, procurement-journal bootstrap on every data ingress, and full dashboard/formula/linkage regression audit')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

-- ============================================================================
-- SOURCE: 030_notification_ui_formula_audit_v440.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.4.0
-- Notification navigation and UI/formula audit release marker.
begin;
alter table public.companies alter column active_release_version set default '4.4.0';
update public.companies
set active_release_version='4.4.0'
where active_release_version is null or active_release_version in ('4.0.0','4.1.0','4.2.0','4.3.0');
insert into public.schema_versions(version, description)
values ('4.4.0','Notification read-state/navigation, refined contract actions, planning scope separation, UI cleanup and full formula/linkage regression audit')
on conflict (version) do update set description=excluded.description, applied_at=clock_timestamp();
commit;

-- ============================================================================
-- SOURCE: 031_responsive_mobile_tablet_v450.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.0
-- Responsive Mobile & Tablet release marker. No destructive schema change.
begin;
alter table public.companies alter column active_release_version set default '4.5.0';
update public.companies
set active_release_version='4.5.0'
where active_release_version is null or active_release_version='4.4.0';
insert into public.schema_versions(version, description)
values ('4.5.0','Responsive Mobile & Tablet: certified layouts at 360, 390, 430, 768, 820 and 1024 px; touch-safe navigation, forms, drawers, upload and local table scrolling')
on conflict (version) do update set description=excluded.description, applied_at=clock_timestamp();
commit;

-- ============================================================================
-- SOURCE: 032_deep_security_offline_sync_v452.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.2
-- Deep security/offline audit: complete entity_records permission mapping for every browser collection.
begin;

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
    when p_collection in ('finance','accounts','journalEntries','openingBalances','accountingPeriods','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection in ('documents')
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection in ('notificationReads')
      then 'dashboard.read'
    when p_collection in ('settings')
      then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system'
      then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;


-- Keep the database MFA boundary aligned with every critical permission used by the browser and release APIs.
create or replace function app.permission_is_privileged(p_permission text) returns boolean
language sql immutable
set search_path=pg_catalog,public,app as $$
  select p_permission in (
    'admin','accounting.post','accounting.close','accounting.period.lock',
    'users.manage','roles.manage','reports.import','backup.restore',
    'security.manage','release.approve'
  )
$$;

create or replace function app.user_is_privileged(p_company uuid default app.current_company_id()) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select exists(
    select 1
    from public.memberships m
    join public.roles r on r.id=m.role_id and r.company_id=m.company_id
    where m.company_id=p_company
      and m.user_id=app.current_user_id()
      and m.status='active'
      and (
        'admin'=any(coalesce(r.permissions,array[]::text[]))
        or exists(
          select 1 from unnest(coalesce(r.permissions,array[]::text[])) p(code)
          where app.permission_is_privileged(p.code)
        )
        or exists(
          select 1 from public.role_permissions rp
          where rp.role_id=r.id
            and (rp.permission_code='admin' or app.permission_is_privileged(rp.permission_code))
        )
      )
    union all
    select 1
    from public.membership_roles mr
    join public.roles r on r.id=mr.role_id and r.company_id=mr.company_id
    where mr.company_id=p_company
      and mr.user_id=app.current_user_id()
      and (
        'admin'=any(coalesce(r.permissions,array[]::text[]))
        or exists(
          select 1 from unnest(coalesce(r.permissions,array[]::text[])) p(code)
          where app.permission_is_privileged(p.code)
        )
        or exists(
          select 1 from public.role_permissions rp
          where rp.role_id=r.id
            and (rp.permission_code='admin' or app.permission_is_privileged(rp.permission_code))
        )
      )
  )
$$;
revoke all on function app.permission_is_privileged(text) from public,anon;
revoke all on function app.user_is_privileged(uuid) from public,anon;
grant execute on function app.permission_is_privileged(text) to authenticated;
grant execute on function app.user_is_privileged(uuid) to authenticated;

alter table public.companies alter column active_release_version set default '4.5.2';
update public.companies
set active_release_version='4.5.2'
where active_release_version is null or active_release_version in ('4.4.0','4.5.0');

insert into public.schema_versions(version,description) values
('4.5.2','Deep security and offline audit: complete Cloud sync/RPC permission coverage, strict production read-only behavior when disconnected, CSV formula-injection mitigation and risky upload blocking')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 033_entity_payload_integrity_v453.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.3
-- Deep server-side integrity validation for the generic entity_records stream.
-- This migration restores the operational kill switch, keeps helper functions private,
-- validates all synchronized collections and blocks unsafe master-data deletion.
begin;

-- notificationReads is the only synchronized singleton whose payload is an array.
-- Preserve any legacy wrapper shape before replacing the original object-only check.
alter table public.entity_records drop constraint if exists entity_records_data_check;
alter table public.entity_records drop constraint if exists entity_records_data_type_v453_check;
update public.entity_records
set data=case
  when jsonb_typeof(data)='array' then data
  when jsonb_typeof(data->'items')='array' then data->'items'
  when jsonb_typeof(data->'values')='array' then data->'values'
  else '[]'::jsonb
end
where collection='notificationReads' and jsonb_typeof(data)<>'array';
alter table public.entity_records add constraint entity_records_data_type_v453_check check(
  (collection='notificationReads' and jsonb_typeof(data)='array')
  or (collection<>'notificationReads' and jsonb_typeof(data)='object')
);

create or replace function app.entity_ref_exists(p_company uuid,p_collection text,p_record_id text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select p_record_id is not null and btrim(p_record_id)<>'' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null
  )
$$;

create or replace function app.entity_account_code_exists(p_company uuid,p_code text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select p_code is not null and btrim(p_code)<>'' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='accounts' and r.deleted_at is null
      and r.data->>'code'=p_code
  )
$$;

create or replace function app.json_text(p_payload jsonb,variadic p_keys text[])
returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare k text; v text;
begin
  foreach k in array p_keys loop
    v:=nullif(btrim(coalesce(p_payload->>k,'')),'');
    if v is not null then return v; end if;
  end loop;
  return null;
end $$;

create or replace function app.is_iso_date_text(p_value text)
returns boolean language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare d date;
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  begin d:=p_value::date; exception when others then return false; end;
  return to_char(d,'YYYY-MM-DD')=p_value;
end $$;

create or replace function app.json_number(p_payload jsonb,variadic p_keys text[])
returns numeric language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then return null; end if;
  if length(v)>80 or v !~ '^[+-]?[0-9]+([.][0-9]+)?$' then
    raise exception 'INVALID_NUMBER: numeric value is malformed' using errcode='22023';
  end if;
  return v::numeric;
end $$;

create or replace function app.assert_required_text(
  p_payload jsonb,p_label text,p_max_length integer,variadic p_keys text[]
) returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then raise exception 'REQUIRED_FIELD: % is required',p_label using errcode='22023'; end if;
  if length(v)>p_max_length then raise exception 'FIELD_TOO_LONG: % exceeds % characters',p_label,p_max_length using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_json_date(
  p_payload jsonb,p_label text,p_required boolean,variadic p_keys text[]
) returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then
    if p_required then raise exception 'REQUIRED_DATE: % is required',p_label using errcode='22023'; end if;
    return null;
  end if;
  if not app.is_iso_date_text(v) then raise exception 'INVALID_DATE: % must be YYYY-MM-DD',p_label using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_json_month(
  p_payload jsonb,p_label text,p_required boolean,variadic p_keys text[]
) returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then
    if p_required then raise exception 'REQUIRED_PERIOD: % is required',p_label using errcode='22023'; end if;
    return null;
  end if;
  if v !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_PERIOD: % must be YYYY-MM',p_label using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_json_number(
  p_payload jsonb,p_label text,p_min numeric,p_max numeric,p_required boolean,variadic p_keys text[]
) returns numeric language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v numeric;
begin
  v:=app.json_number(p_payload,variadic p_keys);
  if v is null then
    if p_required then raise exception 'REQUIRED_NUMBER: % is required',p_label using errcode='22023'; end if;
    return null;
  end if;
  if p_min is not null and v<p_min then raise exception 'NUMBER_OUT_OF_RANGE: % is below minimum',p_label using errcode='22023'; end if;
  if p_max is not null and v>p_max then raise exception 'NUMBER_OUT_OF_RANGE: % exceeds maximum',p_label using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_entity_ref(
  p_company uuid,p_target_collection text,p_target_id text,p_required boolean,p_label text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  if p_target_id is null or btrim(p_target_id)='' then
    if p_required then raise exception 'REQUIRED_REFERENCE: % is required',p_label using errcode='23503'; end if;
    return;
  end if;
  if not app.entity_ref_exists(p_company,p_target_collection,p_target_id) then
    raise exception 'INVALID_REFERENCE: % does not exist',p_label using errcode='23503';
  end if;
end $$;

create or replace function app.assert_account_code(
  p_company uuid,p_code text,p_required boolean,p_label text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  if p_code is null or btrim(p_code)='' then
    if p_required then raise exception 'REQUIRED_REFERENCE: % is required',p_label using errcode='23503'; end if;
    return;
  end if;
  if not app.entity_account_code_exists(p_company,p_code) then
    raise exception 'INVALID_REFERENCE: % account code does not exist',p_label using errcode='23503';
  end if;
end $$;

create or replace function app.assert_unique_entity_text(
  p_company uuid,p_collection text,p_record_id text,p_value text,p_label text,variadic p_keys text[]
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  if p_value is null or btrim(p_value)='' then return; end if;
  if exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection and r.deleted_at is null
      and r.record_id<>p_record_id
      and exists(select 1 from unnest(p_keys) k where lower(btrim(coalesce(r.data->>k,'')))=lower(btrim(p_value)))
  ) then raise exception 'DUPLICATE_KEY: % already exists',p_label using errcode='23505'; end if;
end $$;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare v_code text;
begin
  if p_collection='projects' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null and r.record_id<>p_record_id
      and r.collection=any(array['tasks','timesheets','finance','quotes','approvals','documents','contracts','taxInvoices','billingMilestones','projectBudgetVersions','resourcePlans','commitments','projectStages','purchaseRequests','purchaseOrders','tools','fixedAssets','citAdjustments'])
      and coalesce(r.data->>'projectId',r.data->>'project_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: project is referenced by active records' using errcode='23503'; end if;

  if p_collection='people' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection='projects' and coalesce(r.data->>'pmId',r.data->>'pm_id')=p_record_id)
        or (r.collection='tasks' and coalesce(r.data->>'assigneeId',r.data->>'assignee_id')=p_record_id)
        or (r.collection='timesheets' and coalesce(r.data->>'personId',r.data->>'person_id')=p_record_id)
        or (r.collection='approvals' and coalesce(r.data->>'requesterId',r.data->>'requester_id')=p_record_id)
        or (r.collection='documents' and coalesce(r.data->>'ownerId',r.data->>'owner_id')=p_record_id)
        or (r.collection='contracts' and coalesce(r.data->>'ownerId',r.data->>'owner_id')=p_record_id)
        or (r.collection='resourcePlans' and coalesce(r.data->>'personId',r.data->>'person_id')=p_record_id)
        or (r.collection='purchaseRequests' and coalesce(r.data->>'requesterId',r.data->>'requester_id')=p_record_id)
        or (r.collection=any(array['purchaseOrders','tools','fixedAssets']) and coalesce(r.data->>'custodianId',r.data->>'custodian_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: person is referenced by active records' using errcode='23503'; end if;

  if p_collection='clients' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection=any(array['projects','quotes','contracts'])
      and coalesce(r.data->>'clientId',r.data->>'client_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: client is referenced by active records' using errcode='23503'; end if;

  if p_collection='vendors' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection='purchaseOrders' and coalesce(r.data->>'vendorId',r.data->>'vendor_id')=p_record_id)
        or (r.collection='pitWithholdings' and lower(coalesce(r.data->>'recipientType',r.data->>'recipient_type',''))='vendor' and coalesce(r.data->>'recipientId',r.data->>'recipient_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: vendor is referenced by active records' using errcode='23503'; end if;

  if p_collection='contracts' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection=any(array['taxInvoices','billingMilestones'])
      and coalesce(r.data->>'contractId',r.data->>'contract_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: contract is referenced by active records' using errcode='23503'; end if;

  if p_collection='taxInvoices' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection='billingMilestones' and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=p_record_id)
        or (r.collection='paymentAllocations' and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: invoice is referenced by active records' using errcode='23503'; end if;

  if p_collection='finance' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='paymentAllocations' and coalesce(r.data->>'paymentId',r.data->>'payment_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: payment is allocated to invoices' using errcode='23503'; end if;

  if p_collection='journalEntries' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection=any(array['finance','taxInvoices','pitWithholdings','purchaseOrders']) and coalesce(r.data->>'journalEntryId',r.data->>'journal_entry_id',r.data->>'postingId',r.data->>'posting_id')=p_record_id)
        or (r.collection=any(array['toolAllocationSchedules','depreciationSchedules']) and coalesce(r.data->>'journalEntryId',r.data->>'journal_entry_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: journal entry is referenced by active records' using errcode='23503'; end if;

  if p_collection='projectBudgetVersions' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='projectBudgetLines' and coalesce(r.data->>'budgetVersionId',r.data->>'budget_version_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: budget version has detail lines' using errcode='23503'; end if;

  if p_collection='purchaseRequests' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='purchaseOrders' and coalesce(r.data->>'purchaseRequestId',r.data->>'purchase_request_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: purchase request has purchase orders' using errcode='23503'; end if;

  if p_collection='purchaseOrders' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection=any(array['tools','fixedAssets']) and coalesce(r.data->>'purchaseOrderId',r.data->>'purchase_order_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: purchase order has recognized assets/tools' using errcode='23503'; end if;

  if p_collection='tools' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='toolAllocationSchedules' and coalesce(r.data->>'sourceId',r.data->>'source_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: tool has allocation schedule' using errcode='23503'; end if;

  if p_collection='fixedAssets' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='depreciationSchedules' and coalesce(r.data->>'sourceId',r.data->>'source_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: fixed asset has depreciation schedule' using errcode='23503'; end if;

  if p_collection='accounts' then
    select app.json_text(r.data,'code') into v_code from public.entity_records r
    where r.company_id=p_company and r.collection='accounts' and r.record_id=p_record_id and r.deleted_at is null;
    if v_code is not null and (
      exists(select 1 from public.entity_records r,
                    lateral jsonb_array_elements(case when jsonb_typeof(r.data->'lines')='array' then r.data->'lines' else '[]'::jsonb end) l(value)
             where r.company_id=p_company and r.collection='journalEntries' and r.deleted_at is null and app.json_text(l.value,'accountCode','account_code')=v_code)
      or exists(select 1 from public.entity_records r where r.company_id=p_company and r.collection='openingBalances' and r.deleted_at is null and app.json_text(r.data,'accountCode','account_code')=v_code)
      or exists(select 1 from public.entity_records r where r.company_id=p_company and r.collection=any(array['tools','fixedAssets']) and r.deleted_at is null
                and v_code=any(array[coalesce(r.data->>'expenseAccountCode',r.data->>'expense_account_code',''),coalesce(r.data->>'assetAccountCode',r.data->>'asset_account_code',''),coalesce(r.data->>'depreciationAccountCode',r.data->>'depreciation_account_code','')]))
    ) then raise exception 'DEPENDENCY_EXISTS: account has postings, balances or asset configuration' using errcode='23503'; end if;
  end if;
end $$;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare
  v text; v2 text; n numeric; n2 numeric; n3 numeric; line jsonb; target jsonb;
  total_debit numeric:=0; total_credit numeric:=0;
begin
  if p_record_id is null or length(btrim(p_record_id)) not between 1 and 160 then
    raise exception 'INVALID_RECORD_ID: record_id length is invalid' using errcode='22023';
  end if;
  if octet_length(coalesce(p_payload,'null'::jsonb)::text)>1048576 then
    raise exception 'PAYLOAD_TOO_LARGE: entity payload exceeds 1 MiB' using errcode='22023';
  end if;

  if p_collection='notificationReads' then
    if p_record_id<>'singleton' then raise exception 'INVALID_SINGLETON: notificationReads must use record_id singleton' using errcode='22023'; end if;
    if p_payload is null or jsonb_typeof(p_payload)<>'array' then raise exception 'INVALID_PAYLOAD_TYPE: notificationReads must be an array' using errcode='22023'; end if;
    if jsonb_array_length(p_payload)>10000 then raise exception 'PAYLOAD_TOO_LARGE: too many notification read markers' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload) e(value) where jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>240) then
      raise exception 'INVALID_NOTIFICATION_MARKER: every marker must be a string up to 240 characters' using errcode='22023';
    end if;
    return;
  end if;

  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'INVALID_PAYLOAD_TYPE: payload must be a JSON object' using errcode='22023';
  end if;
  if p_payload ?| array['__proto__','prototype','constructor'] then
    raise exception 'UNSAFE_JSON_KEY: unsafe JSON property name' using errcode='22023';
  end if;
  if p_collection='settings' then
    if p_record_id<>'singleton' then raise exception 'INVALID_SINGLETON: settings must use record_id singleton' using errcode='22023'; end if;
  elsif p_record_id='singleton' then
    raise exception 'INVALID_SINGLETON: collection % cannot use record_id singleton',p_collection using errcode='22023';
  end if;
  v:=app.json_text(p_payload,'id','uuid');
  if v is not null and v<>p_record_id then raise exception 'ID_MISMATCH: payload id does not match record_id' using errcode='22023'; end if;

  if p_collection='system' then
    if p_record_id<>'manifest' then raise exception 'INVALID_SYSTEM_RECORD: only manifest is allowed' using errcode='22023'; end if;

  elsif p_collection='settings' then
    n:=app.assert_json_number(p_payload,'settings.defaultVatRate',0,100,false,'defaultVatRate');
    n:=app.assert_json_number(p_payload,'settings.targetMargin',0,100,false,'targetMargin');
    n:=app.assert_json_number(p_payload,'settings.monthlyWorkingHours',1,744,false,'monthlyWorkingHours');

  elsif p_collection='people' then
    v:=app.assert_required_text(p_payload,'people.code',80,'code'); perform app.assert_unique_entity_text(p_company,'people',p_record_id,v,'people.code','code');
    perform app.assert_required_text(p_payload,'people.name',200,'name');
    perform app.assert_json_number(p_payload,'people.monthlySalary',0,null::numeric,false,'monthlySalary','monthly_salary');
    perform app.assert_json_number(p_payload,'people.hourlyRate',0,null::numeric,false,'hourlyRate','hourly_rate');
    perform app.assert_json_number(p_payload,'people.billingRate',0,null::numeric,false,'billingRate','billing_rate');
    perform app.assert_json_date(p_payload,'people.startDate',false,'startDate','start_date','hireDate','hire_date');
    perform app.assert_json_date(p_payload,'people.endDate',false,'endDate','end_date');

  elsif p_collection='clients' then
    v:=app.assert_required_text(p_payload,'clients.code',80,'code'); perform app.assert_unique_entity_text(p_company,'clients',p_record_id,v,'clients.code','code');
    perform app.assert_required_text(p_payload,'clients.name',240,'name');
    v:=app.json_text(p_payload,'taxCode','tax_code'); perform app.assert_unique_entity_text(p_company,'clients',p_record_id,v,'clients.taxCode','taxCode','tax_code');

  elsif p_collection='vendors' then
    v:=app.assert_required_text(p_payload,'vendors.code',80,'code'); perform app.assert_unique_entity_text(p_company,'vendors',p_record_id,v,'vendors.code','code');
    perform app.assert_required_text(p_payload,'vendors.name',240,'name');
    v:=app.json_text(p_payload,'taxCode','tax_code'); perform app.assert_unique_entity_text(p_company,'vendors',p_record_id,v,'vendors.taxCode','taxCode','tax_code');

  elsif p_collection='accounts' then
    v:=app.assert_required_text(p_payload,'accounts.code',32,'code');
    if v !~ '^[0-9A-Za-z._-]+$' then raise exception 'INVALID_ACCOUNT_CODE: unsupported characters' using errcode='22023'; end if;
    perform app.assert_unique_entity_text(p_company,'accounts',p_record_id,v,'accounts.code','code');
    perform app.assert_required_text(p_payload,'accounts.name',240,'name');
    v:=lower(app.assert_required_text(p_payload,'accounts.type',30,'type'));
    if v not in ('asset','liability','equity','revenue','expense') then raise exception 'INVALID_ENUM: accounts.type' using errcode='22023'; end if;

  elsif p_collection='projects' then
    v:=app.assert_required_text(p_payload,'projects.code',80,'code'); perform app.assert_unique_entity_text(p_company,'projects',p_record_id,v,'projects.code','code');
    perform app.assert_required_text(p_payload,'projects.name',240,'name');
    perform app.assert_entity_ref(p_company,'clients',app.json_text(p_payload,'clientId','client_id'),true,'projects.clientId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'pmId','pm_id'),true,'projects.pmId');
    v:=app.assert_json_date(p_payload,'projects.startDate',true,'startDate','start_date');
    v2:=app.assert_json_date(p_payload,'projects.endDate',false,'endDate','end_date');
    if v2 is not null and v2<v then raise exception 'INVALID_DATE_RANGE: project endDate precedes startDate' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'projects.contractValue',0,null::numeric,true,'contractValue','contract_value'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: project contractValue must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'projects.directBudget',0,null::numeric,true,'directBudget','direct_budget');
    perform app.assert_json_number(p_payload,'projects.progress',0,100,true,'progress');

  elsif p_collection='tasks' then
    perform app.assert_required_text(p_payload,'tasks.title',300,'title','name');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'tasks.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'assigneeId','assignee_id'),true,'tasks.assigneeId');
    v:=app.assert_json_date(p_payload,'tasks.startDate',false,'startDate','start_date');
    v2:=app.assert_json_date(p_payload,'tasks.dueDate',false,'dueDate','due_date');
    if v is not null and v2 is not null and v2<v then raise exception 'INVALID_DATE_RANGE: task dueDate precedes startDate' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'tasks.estimatedHours',0,null::numeric,false,'estimatedHours','estimated_hours');
    perform app.assert_json_number(p_payload,'tasks.actualHours',0,null::numeric,false,'actualHours','actual_hours');

  elsif p_collection='timesheets' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'timesheets.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'personId','person_id'),true,'timesheets.personId');
    perform app.assert_json_date(p_payload,'timesheets.date',true,'date');
    n:=app.assert_json_number(p_payload,'timesheets.hours',0,24,true,'hours'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: timesheet hours must be positive' using errcode='22023'; end if;

  elsif p_collection='contracts' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'contracts.projectId');
    perform app.assert_entity_ref(p_company,'clients',app.json_text(p_payload,'clientId','client_id'),true,'contracts.clientId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'ownerId','owner_id'),false,'contracts.ownerId');
    v:=app.assert_required_text(p_payload,'contracts.contractNo',120,'contractNo','contract_no'); perform app.assert_unique_entity_text(p_company,'contracts',p_record_id,v,'contracts.contractNo','contractNo','contract_no');
    perform app.assert_json_date(p_payload,'contracts.signedDate',false,'signedDate','signed_date');
    v:=app.assert_json_date(p_payload,'contracts.effectiveDate',true,'effectiveDate','effective_date');
    v2:=app.assert_json_date(p_payload,'contracts.expiryDate',false,'expiryDate','expiry_date');
    if v2 is not null and v2<v then raise exception 'INVALID_DATE_RANGE: contract expiryDate precedes effectiveDate' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'contracts.valueExclVat',0,null::numeric,true,'valueExclVat','value_excl_vat','contractValue'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: contract value must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'contracts.vatRate',0,100,false,'vatRate','vat_rate');

  elsif p_collection='journalEntries' then
    perform app.assert_json_date(p_payload,'journalEntries.date',true,'date');
    perform app.assert_required_text(p_payload,'journalEntries.documentNo',120,'documentNo','document_no');
    if jsonb_typeof(coalesce(p_payload->'lines','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'lines','[]'::jsonb))<2 then raise exception 'INVALID_JOURNAL: at least two lines are required' using errcode='22023'; end if;
    for line in select value from jsonb_array_elements(coalesce(p_payload->'lines','[]'::jsonb)) loop
      perform app.assert_account_code(p_company,app.json_text(line,'accountCode','account_code'),true,'journalEntries.lines.accountCode');
      perform app.assert_entity_ref(p_company,'projects',app.json_text(line,'projectId','project_id'),false,'journalEntries.lines.projectId');
      n:=coalesce(app.json_number(line,'debit'),0); n2:=coalesce(app.json_number(line,'credit'),0);
      if n<0 or n2<0 or (n>0 and n2>0) or (n=0 and n2=0) then raise exception 'INVALID_JOURNAL_LINE: each line must contain one positive debit or credit' using errcode='22023'; end if;
      total_debit:=total_debit+n; total_credit:=total_credit+n2;
    end loop;
    if round(total_debit,0)<>round(total_credit,0) or round(total_debit,0)<=0 then raise exception 'UNBALANCED_JOURNAL: total debit must equal total credit' using errcode='22023'; end if;
    if lower(coalesce(p_payload->>'status',''))='posted' and coalesce(p_payload->>'postingHash','') !~ '^[0-9a-fA-F]{64}$' then raise exception 'INVALID_POSTING_HASH: posted entry requires SHA-256 hash' using errcode='22023'; end if;

  elsif p_collection='finance' then
    perform app.assert_json_date(p_payload,'finance.date',true,'date');
    v:=lower(app.assert_required_text(p_payload,'finance.type',20,'type')); if v not in ('income','expense') then raise exception 'INVALID_ENUM: finance.type' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'finance.amount',0,null::numeric,true,'amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: finance amount must be positive' using errcode='22023'; end if;
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'finance.projectId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id'),false,'finance.journalEntryId');

  elsif p_collection='quotes' then
    perform app.assert_json_date(p_payload,'quotes.date',true,'date');
    perform app.assert_entity_ref(p_company,'clients',app.json_text(p_payload,'clientId','client_id'),true,'quotes.clientId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'quotes.projectId');
    perform app.assert_required_text(p_payload,'quotes.projectName',300,'projectName','project_name','name');
    perform app.assert_json_number(p_payload,'quotes.amount',0,null::numeric,true,'amount');
    perform app.assert_json_number(p_payload,'quotes.probability',0,100,true,'probability');

  elsif p_collection='approvals' then
    perform app.assert_json_date(p_payload,'approvals.date',true,'date');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'requesterId','requester_id'),true,'approvals.requesterId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'approvals.projectId');
    perform app.assert_required_text(p_payload,'approvals.title',400,'title');
    perform app.assert_json_number(p_payload,'approvals.amount',0,null::numeric,false,'amount');

  elsif p_collection='documents' then
    perform app.assert_required_text(p_payload,'documents.title',400,'title');
    perform app.assert_json_date(p_payload,'documents.date',false,'date');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'documents.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'ownerId','owner_id'),false,'documents.ownerId');

  elsif p_collection='taxInvoices' then
    perform app.assert_json_date(p_payload,'taxInvoices.date',true,'date');
    perform app.assert_json_date(p_payload,'taxInvoices.dueDate',false,'dueDate','due_date');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'taxInvoices.projectId');
    perform app.assert_entity_ref(p_company,'contracts',app.json_text(p_payload,'contractId','contract_id'),false,'taxInvoices.contractId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'taxInvoices.journalEntryId');
    n:=app.assert_json_number(p_payload,'taxInvoices.taxBase',0,null::numeric,true,'taxBase','tax_base','amountExclVat','amount_excl_vat');
    n2:=app.assert_json_number(p_payload,'taxInvoices.vatAmount',0,null::numeric,true,'vatAmount','vat_amount');
    n3:=app.assert_json_number(p_payload,'taxInvoices.totalAmount',0,null::numeric,true,'totalAmount','total_amount');
    if abs(round(n+n2,0)-round(n3,0))>1 then raise exception 'FORMULA_MISMATCH: invoice total must equal tax base plus VAT' using errcode='22023'; end if;

  elsif p_collection='pitWithholdings' then
    perform app.assert_json_date(p_payload,'pitWithholdings.date',true,'date');
    v:=lower(app.assert_required_text(p_payload,'pitWithholdings.recipientType',30,'recipientType','recipient_type'));
    v2:=app.json_text(p_payload,'recipientId','recipient_id');
    if v='vendor' then perform app.assert_entity_ref(p_company,'vendors',v2,true,'pitWithholdings.recipientId');
    elsif v in ('person','employee') then perform app.assert_entity_ref(p_company,'people',v2,true,'pitWithholdings.recipientId');
    else raise exception 'INVALID_ENUM: pitWithholdings.recipientType' using errcode='22023'; end if;
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'pitWithholdings.journalEntryId');
    n:=app.assert_json_number(p_payload,'pitWithholdings.grossIncome',0,null::numeric,true,'grossIncome','gross_income','grossAmount','gross_amount');
    n2:=app.assert_json_number(p_payload,'pitWithholdings.taxWithheld',0,n,true,'taxWithheld','tax_withheld');
    n3:=app.json_number(p_payload,'netPaid','net_paid','netAmount','net_amount'); if n3 is not null and abs(round(n-n2,0)-round(n3,0))>1 then raise exception 'FORMULA_MISMATCH: PIT net amount must equal gross less withheld tax' using errcode='22023'; end if;

  elsif p_collection='citAdjustments' then
    perform app.assert_json_date(p_payload,'citAdjustments.date',true,'date');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'citAdjustments.projectId');
    perform app.assert_json_number(p_payload,'citAdjustments.amount',0,null::numeric,true,'amount');
    perform app.assert_json_number(p_payload,'citAdjustments.fiscalYear',2000,2100,true,'fiscalYear','fiscal_year');

  elsif p_collection='taxFilings' then
    perform app.assert_required_text(p_payload,'taxFilings.period',80,'period');
    perform app.assert_json_date(p_payload,'taxFilings.dueDate',true,'dueDate','due_date');
    perform app.assert_json_date(p_payload,'taxFilings.filedDate',false,'filedDate','filed_date');
    perform app.assert_json_date(p_payload,'taxFilings.paymentDate',false,'paymentDate','payment_date');
    perform app.assert_json_number(p_payload,'taxFilings.payableAmount',0,null::numeric,false,'payableAmount','payable_amount');

  elsif p_collection='billingMilestones' then
    v:=app.json_text(p_payload,'contractId','contract_id'); perform app.assert_entity_ref(p_company,'contracts',v,true,'billingMilestones.contractId');
    v2:=app.json_text(p_payload,'projectId','project_id'); perform app.assert_entity_ref(p_company,'projects',v2,true,'billingMilestones.projectId');
    perform app.assert_entity_ref(p_company,'taxInvoices',app.json_text(p_payload,'invoiceId','invoice_id'),false,'billingMilestones.invoiceId');
    perform app.assert_json_date(p_payload,'billingMilestones.dueDate',false,'dueDate','due_date');
    n:=app.assert_json_number(p_payload,'billingMilestones.amount',0,null::numeric,true,'amountExclVat','amount_excl_vat','amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: milestone amount must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'billingMilestones.percentage',0,100,false,'percentage');
    select r.data into target from public.entity_records r where r.company_id=p_company and r.collection='contracts' and r.record_id=v and r.deleted_at is null;
    if target is not null and coalesce(target->>'projectId',target->>'project_id')<>v2 then raise exception 'CROSS_PROJECT_REFERENCE: milestone project differs from contract project' using errcode='23503'; end if;

  elsif p_collection='paymentAllocations' then
    v:=app.json_text(p_payload,'invoiceId','invoice_id'); perform app.assert_entity_ref(p_company,'taxInvoices',v,true,'paymentAllocations.invoiceId');
    perform app.assert_entity_ref(p_company,'finance',app.json_text(p_payload,'paymentId','payment_id'),false,'paymentAllocations.paymentId');
    perform app.assert_json_date(p_payload,'paymentAllocations.date',true,'date','allocationDate','allocation_date','paymentDate','payment_date');
    n:=app.assert_json_number(p_payload,'paymentAllocations.amount',0,null::numeric,true,'amount','allocatedAmount','allocated_amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: allocation amount must be positive' using errcode='22023'; end if;

  elsif p_collection='openingBalances' then
    perform app.assert_account_code(p_company,app.json_text(p_payload,'accountCode','account_code'),true,'openingBalances.accountCode');
    perform app.assert_json_date(p_payload,'openingBalances.asOfDate',true,'asOfDate','as_of_date');
    n:=coalesce(app.json_number(p_payload,'debit'),0); n2:=coalesce(app.json_number(p_payload,'credit'),0);
    if n<0 or n2<0 or (n>0 and n2>0) or (n=0 and n2=0) then raise exception 'INVALID_OPENING_BALANCE: enter exactly one positive debit or credit' using errcode='22023'; end if;

  elsif p_collection='accountingPeriods' then
    v:=app.assert_json_date(p_payload,'accountingPeriods.from',true,'from');
    v2:=app.assert_json_date(p_payload,'accountingPeriods.to',true,'to');
    if v2<v then raise exception 'INVALID_DATE_RANGE: accounting period to precedes from' using errcode='22023'; end if;

  elsif p_collection='projectBudgetVersions' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'projectBudgetVersions.projectId');
    perform app.assert_json_date(p_payload,'projectBudgetVersions.effectiveFrom',false,'effectiveFrom','effective_from');
    perform app.assert_json_number(p_payload,'projectBudgetVersions.directBudget',0,null::numeric,true,'directBudget','direct_budget');
    perform app.assert_json_number(p_payload,'projectBudgetVersions.contractValue',0,null::numeric,false,'contractValue','contract_value');

  elsif p_collection='projectBudgetLines' then
    perform app.assert_entity_ref(p_company,'projectBudgetVersions',app.json_text(p_payload,'budgetVersionId','budget_version_id'),true,'projectBudgetLines.budgetVersionId');
    n:=app.assert_json_number(p_payload,'projectBudgetLines.quantity',0,null::numeric,true,'quantity');
    n2:=app.assert_json_number(p_payload,'projectBudgetLines.unitRate',0,null::numeric,true,'unitRate','unit_rate');
    n3:=app.assert_json_number(p_payload,'projectBudgetLines.amount',0,null::numeric,false,'amount');
    if n3 is not null and abs(round(n*n2,0)-round(n3,0))>1 then raise exception 'FORMULA_MISMATCH: budget line amount must equal quantity times unit rate' using errcode='22023'; end if;

  elsif p_collection='resourcePlans' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'resourcePlans.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'personId','person_id'),true,'resourcePlans.personId');
    perform app.assert_json_month(p_payload,'resourcePlans.month',true,'month');
    perform app.assert_json_number(p_payload,'resourcePlans.plannedHours',0,null::numeric,true,'plannedHours','planned_hours','hours');
    perform app.assert_json_number(p_payload,'resourcePlans.costRate',0,null::numeric,false,'costRate','cost_rate','hourlyRate','hourly_rate');

  elsif p_collection='commitments' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'commitments.projectId');
    perform app.assert_json_date(p_payload,'commitments.dueDate',false,'dueDate','due_date');
    n:=app.assert_json_number(p_payload,'commitments.amount',0,null::numeric,true,'amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: commitment amount must be positive' using errcode='22023'; end if;
    n2:=coalesce(app.json_number(p_payload,'recognizedAmount','recognized_amount'),0); if n2<0 or n2>n then raise exception 'NUMBER_OUT_OF_RANGE: recognized commitment exceeds amount' using errcode='22023'; end if;

  elsif p_collection='projectStages' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'projectStages.projectId');
    v:=app.assert_json_date(p_payload,'projectStages.plannedStart',true,'plannedStart','planned_start');
    v2:=app.assert_json_date(p_payload,'projectStages.plannedEnd',true,'plannedEnd','planned_end');
    if v2<v then raise exception 'INVALID_DATE_RANGE: project stage end precedes start' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'projectStages.weight',0,100,true,'weight','weightPercent','weight_percent');
    perform app.assert_json_number(p_payload,'projectStages.progress',0,100,false,'progress','progressPercent','progress_percent');

  elsif p_collection='purchaseRequests' then
    v:=app.assert_required_text(p_payload,'purchaseRequests.requestNo',120,'requestNo','request_no'); perform app.assert_unique_entity_text(p_company,'purchaseRequests',p_record_id,v,'purchaseRequests.requestNo','requestNo','request_no');
    perform app.assert_json_date(p_payload,'purchaseRequests.date',true,'date');
    perform app.assert_required_text(p_payload,'purchaseRequests.itemName',400,'itemName','item_name');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'requesterId','requester_id'),true,'purchaseRequests.requesterId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'purchaseRequests.projectId');
    n:=app.assert_json_number(p_payload,'purchaseRequests.quantity',0,null::numeric,true,'quantity'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: purchase request quantity must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'purchaseRequests.unitPrice',0,null::numeric,true,'unitPrice','unit_price');
    perform app.assert_json_number(p_payload,'purchaseRequests.vatRate',0,100,false,'vatRate','vat_rate');

  elsif p_collection='purchaseOrders' then
    v:=app.assert_required_text(p_payload,'purchaseOrders.poNo',120,'poNo','po_no'); perform app.assert_unique_entity_text(p_company,'purchaseOrders',p_record_id,v,'purchaseOrders.poNo','poNo','po_no');
    perform app.assert_json_date(p_payload,'purchaseOrders.orderDate',true,'orderDate','order_date');
    perform app.assert_json_date(p_payload,'purchaseOrders.invoiceDate',false,'invoiceDate','invoice_date');
    perform app.assert_entity_ref(p_company,'purchaseRequests',app.json_text(p_payload,'purchaseRequestId','purchase_request_id'),true,'purchaseOrders.purchaseRequestId');
    perform app.assert_entity_ref(p_company,'vendors',app.json_text(p_payload,'vendorId','vendor_id'),true,'purchaseOrders.vendorId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'purchaseOrders.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'custodianId','custodian_id'),false,'purchaseOrders.custodianId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'purchaseOrders.journalEntryId');
    n:=app.assert_json_number(p_payload,'purchaseOrders.quantity',0,null::numeric,true,'quantity'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: purchase order quantity must be positive' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'purchaseOrders.unitPrice',0,null::numeric,true,'unitPrice','unit_price'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: purchase order unit price must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'purchaseOrders.vatRate',0,100,false,'vatRate','vat_rate');

  elsif p_collection='tools' then
    v:=app.assert_required_text(p_payload,'tools.toolCode',120,'toolCode','tool_code'); perform app.assert_unique_entity_text(p_company,'tools',p_record_id,v,'tools.toolCode','toolCode','tool_code');
    perform app.assert_required_text(p_payload,'tools.name',300,'name');
    perform app.assert_entity_ref(p_company,'purchaseOrders',app.json_text(p_payload,'purchaseOrderId','purchase_order_id'),false,'tools.purchaseOrderId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'tools.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'custodianId','custodian_id'),false,'tools.custodianId');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'expenseAccountCode','expense_account_code'),true,'tools.expenseAccountCode');
    perform app.assert_json_date(p_payload,'tools.startDate',true,'startDate','start_date');
    n:=app.assert_json_number(p_payload,'tools.originalCost',0,null::numeric,true,'originalCost','original_cost'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: tool original cost must be positive' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'tools.allocationMonths',1,1200,true,'allocationMonths','allocation_months'); if n<>trunc(n) then raise exception 'INVALID_INTEGER: tool allocationMonths' using errcode='22023'; end if;

  elsif p_collection='fixedAssets' then
    v:=app.assert_required_text(p_payload,'fixedAssets.assetCode',120,'assetCode','asset_code'); perform app.assert_unique_entity_text(p_company,'fixedAssets',p_record_id,v,'fixedAssets.assetCode','assetCode','asset_code');
    perform app.assert_required_text(p_payload,'fixedAssets.name',300,'name');
    perform app.assert_entity_ref(p_company,'purchaseOrders',app.json_text(p_payload,'purchaseOrderId','purchase_order_id'),false,'fixedAssets.purchaseOrderId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'fixedAssets.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'custodianId','custodian_id'),false,'fixedAssets.custodianId');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'assetAccountCode','asset_account_code'),true,'fixedAssets.assetAccountCode');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'depreciationAccountCode','depreciation_account_code'),true,'fixedAssets.depreciationAccountCode');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'expenseAccountCode','expense_account_code'),true,'fixedAssets.expenseAccountCode');
    perform app.assert_json_date(p_payload,'fixedAssets.acquisitionDate',true,'acquisitionDate','acquisition_date');
    perform app.assert_json_date(p_payload,'fixedAssets.inServiceDate',true,'inServiceDate','in_service_date');
    n:=app.assert_json_number(p_payload,'fixedAssets.originalCost',0,null::numeric,true,'originalCost','original_cost'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: asset original cost must be positive' using errcode='22023'; end if;
    n2:=coalesce(app.json_number(p_payload,'residualValue','residual_value'),0); if n2<0 or n2>=n then raise exception 'NUMBER_OUT_OF_RANGE: asset residual value must be below original cost' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'fixedAssets.usefulLifeMonths',13,1200,true,'usefulLifeMonths','useful_life_months'); if n<>trunc(n) then raise exception 'INVALID_INTEGER: asset usefulLifeMonths' using errcode='22023'; end if;

  elsif p_collection='toolAllocationSchedules' then
    perform app.assert_entity_ref(p_company,'tools',app.json_text(p_payload,'sourceId','source_id'),true,'toolAllocationSchedules.sourceId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'toolAllocationSchedules.journalEntryId');
    perform app.assert_json_month(p_payload,'toolAllocationSchedules.period',true,'period');
    perform app.assert_json_number(p_payload,'toolAllocationSchedules.amount',0,null::numeric,true,'amount');

  elsif p_collection='depreciationSchedules' then
    perform app.assert_entity_ref(p_company,'fixedAssets',app.json_text(p_payload,'sourceId','source_id'),true,'depreciationSchedules.sourceId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'depreciationSchedules.journalEntryId');
    perform app.assert_json_month(p_payload,'depreciationSchedules.period',true,'period');
    perform app.assert_json_number(p_payload,'depreciationSchedules.amount',0,null::numeric,true,'amount');

  elsif p_collection='financialForecastScenarios' then
    perform app.assert_required_text(p_payload,'financialForecastScenarios.name',200,'name');
    perform app.assert_json_number(p_payload,'forecast.collectionRatePercent',0,100,false,'collectionRatePercent');
    perform app.assert_json_number(p_payload,'forecast.directCostRatioPercent',0,100,false,'directCostRatioPercent');
    perform app.assert_json_number(p_payload,'forecast.pipelineFactorPercent',0,500,false,'pipelineFactorPercent');
    perform app.assert_json_number(p_payload,'forecast.pipelineLagMonths',0,120,false,'pipelineLagMonths');
    perform app.assert_json_number(p_payload,'forecast.pipelineDeliveryMonths',1,120,false,'pipelineDeliveryMonths');
    perform app.assert_json_number(p_payload,'forecast.recurringRevenueShare',0,1,false,'recurringRevenueShare');
    perform app.assert_json_number(p_payload,'forecast.taxRatePercent',0,100,false,'taxRatePercent');
    perform app.assert_json_number(p_payload,'forecast.minimumCashBuffer',0,null::numeric,false,'minimumCashBuffer');

  elsif p_collection in ('financialAnalysisSnapshots','financialLinkAuditRuns','exportLogs','importLogs') then
    perform app.assert_json_date(p_payload,p_collection||'.date',false,'date','runDate','run_date','createdDate','created_date');

  else
    raise exception 'UNVALIDATED_COLLECTION: %',p_collection using errcode='22023';
  end if;
end $$;

-- All browser writes must pass this idempotent, version-aware RPC. Direct table
-- insert/update grants are removed below so clients cannot bypass conflict detection.
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
  perform app.assert_operational_write_allowed(p_company);
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
  if p_payload is null then raise exception 'payload is required' using errcode='22023'; end if;
  if p_collection='notificationReads' then
    if jsonb_typeof(p_payload)<>'array' then raise exception 'notificationReads payload must be a JSON array' using errcode='22023'; end if;
  elsif jsonb_typeof(p_payload)<>'object' then
    raise exception 'payload must be a JSON object' using errcode='22023';
  end if;
  if not coalesce(p_deleted,false) then perform app.validate_entity_payload(p_company,p_collection,p_record_id,p_payload); end if;

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

create or replace function app.entity_record_guard() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare permission_code text;
begin
  if tg_op='UPDATE' and (new.company_id,new.collection,new.record_id) is distinct from (old.company_id,old.collection,old.record_id) then
    raise exception 'IMMUTABLE_ENTITY_IDENTITY: company_id, collection and record_id cannot be changed' using errcode='22023';
  end if;
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
  if new.deleted_at is null then
    perform app.validate_entity_payload(new.company_id,new.collection,new.record_id,new.data);
  elsif tg_op='INSERT' then
    perform app.assert_entity_delete_safe(new.company_id,new.collection,new.record_id);
  elsif old.deleted_at is null then
    perform app.assert_entity_delete_safe(new.company_id,new.collection,new.record_id);
  end if;
  if tg_op='INSERT' then new.created_by:=coalesce(new.created_by,app.current_user_id());new.created_at:=coalesce(new.created_at,clock_timestamp());end if;
  new.updated_by:=app.current_user_id();new.updated_at:=clock_timestamp();return new;
end $$;

-- Authenticated clients can read through RLS but may mutate only through
-- public.apply_entity_change, which enforces idempotency and optimistic concurrency.
revoke insert,update,delete on public.entity_records from authenticated;
grant select on public.entity_records to authenticated;
revoke all on function app.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) from public,anon,authenticated;
revoke all on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) from public,anon;
grant execute on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) to authenticated;

-- Security-definer helpers are trigger-internal only. Do not expose cross-tenant probes.
revoke all on function app.entity_ref_exists(uuid,text,text) from public,anon,authenticated;
revoke all on function app.entity_account_code_exists(uuid,text) from public,anon,authenticated;
revoke all on function app.json_text(jsonb,text[]) from public,anon,authenticated;
revoke all on function app.is_iso_date_text(text) from public,anon,authenticated;
revoke all on function app.json_number(jsonb,text[]) from public,anon,authenticated;
revoke all on function app.assert_required_text(jsonb,text,integer,text[]) from public,anon,authenticated;
revoke all on function app.assert_json_date(jsonb,text,boolean,text[]) from public,anon,authenticated;
revoke all on function app.assert_json_month(jsonb,text,boolean,text[]) from public,anon,authenticated;
revoke all on function app.assert_json_number(jsonb,text,numeric,numeric,boolean,text[]) from public,anon,authenticated;
revoke all on function app.assert_entity_ref(uuid,text,text,boolean,text) from public,anon,authenticated;
revoke all on function app.assert_account_code(uuid,text,boolean,text) from public,anon,authenticated;
revoke all on function app.assert_unique_entity_text(uuid,text,text,text,text,text[]) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.entity_record_guard() from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.3';
update public.companies set active_release_version='4.5.3' where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2');
insert into public.schema_versions(version,description) values
('4.5.3','Integrity and security hardening: complete server-side validation for every synchronized collection, operational kill-switch preservation, private tenant-safe helpers, dependency-safe deletion, deterministic formulas and clean production package')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 034_formula_linkage_web_security_v454.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.4
-- Formula-status alignment, atomic cross-module linkage guards and recursive JSON hardening.
begin;

-- Preserve the complete v4.5.3 validator and layer strict cross-record controls on top.
alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_v453;

create or replace function app.json_has_unsafe_key(p_value jsonb)
returns boolean language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare
  k text;
  v jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for k,v in select key,value from jsonb_each(p_value) loop
      if lower(k) in ('__proto__','prototype','constructor') or app.json_has_unsafe_key(v) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v in select value from jsonb_array_elements(p_value) loop
      if app.json_has_unsafe_key(v) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create or replace function app.json_numeric_or_zero(p_payload jsonb,variadic p_keys text[])
returns numeric language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null or length(v)>80 or v !~ '^[+-]?[0-9]+([.][0-9]+)?$' then return 0; end if;
  return v::numeric;
end $$;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  v text;
  v2 text;
  invoice_id text;
  payment_id text;
  status_value text;
  invoice_row jsonb;
  payment_row jsonb;
  contract_row jsonb;
  amount_value numeric:=0;
  existing_total numeric:=0;
  target_total numeric:=0;
  current_percent numeric:=0;
  existing_percent numeric:=0;
  recognized boolean:=false;
begin
  perform app.validate_entity_payload_v453(p_company,p_collection,p_record_id,p_payload);

  if app.json_has_unsafe_key(p_payload) then
    raise exception 'UNSAFE_JSON_KEY: nested unsafe JSON property name' using errcode='22023';
  end if;

  if p_collection='finance' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
    if status_value not in ('pending','paid','cancelled','canceled') then
      raise exception 'INVALID_ENUM: finance.status' using errcode='22023';
    end if;

  elsif p_collection='taxInvoices' then
    v:=lower(app.assert_required_text(p_payload,'taxInvoices.direction',20,'direction'));
    if v not in ('input','output') then
      raise exception 'INVALID_ENUM: taxInvoices.direction' using errcode='22023';
    end if;
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'valid'));
    if status_value not in ('draft','pending','review','valid','adjusted','issued','posted','approved','accepted','active','completed','replaced','cancelled','canceled') then
      raise exception 'INVALID_ENUM: taxInvoices.status' using errcode='22023';
    end if;
    v:=app.json_text(p_payload,'contractId','contract_id');
    v2:=app.json_text(p_payload,'projectId','project_id');
    if v is not null and v2 is not null then
      select r.data into contract_row from public.entity_records r
      where r.company_id=p_company and r.collection='contracts'
        and r.record_id=v and r.deleted_at is null;
      if contract_row is not null and coalesce(contract_row->>'projectId',contract_row->>'project_id','')<>v2 then
        raise exception 'CROSS_PROJECT_REFERENCE: invoice project differs from contract project' using errcode='23503';
      end if;
    end if;

  elsif p_collection='paymentAllocations' then
    invoice_id:=app.json_text(p_payload,'invoiceId','invoice_id');
    payment_id:=app.json_text(p_payload,'paymentId','payment_id');
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'posted'));
    if status_value not in ('draft','posted','paid','applied','completed','cancelled','canceled','deleted','void') then
      raise exception 'INVALID_ENUM: paymentAllocations.status' using errcode='22023';
    end if;
    recognized:=status_value in ('posted','paid','applied','completed');
    if recognized then
      -- Serialize every recognized allocation for the same invoice, preventing
      -- concurrent browser requests from both passing an over-allocation check.
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|invoice-allocation|'||invoice_id,0));
      select r.data into invoice_row from public.entity_records r
      where r.company_id=p_company and r.collection='taxInvoices'
        and r.record_id=invoice_id and r.deleted_at is null;
      if lower(coalesce(invoice_row->>'direction',''))<>'output' then
        raise exception 'INVALID_LINK_DIRECTION: receipt allocation requires an output invoice' using errcode='23503';
      end if;
      if lower(coalesce(invoice_row->>'status','valid')) in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'INVALID_LINK_STATUS: allocation requires a recognized invoice' using errcode='23503';
      end if;
      amount_value:=app.json_numeric_or_zero(p_payload,'amount','allocatedAmount','allocated_amount');
      target_total:=app.json_numeric_or_zero(invoice_row,'totalAmount','total_amount');
      select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
      into existing_total
      from public.entity_records r
      where r.company_id=p_company and r.collection='paymentAllocations'
        and r.record_id<>p_record_id and r.deleted_at is null
        and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=invoice_id
        and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
      if round(existing_total+amount_value,0)>round(target_total,0)+1 then
        raise exception 'OVER_ALLOCATION: recognized allocations exceed invoice total' using errcode='23514';
      end if;

      if payment_id is not null then
        perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|payment-allocation|'||payment_id,0));
        select r.data into payment_row from public.entity_records r
        where r.company_id=p_company and r.collection='finance'
          and r.record_id=payment_id and r.deleted_at is null;
        if lower(coalesce(payment_row->>'type',''))<>'income'
           or lower(coalesce(payment_row->>'status',''))<>'paid' then
          raise exception 'INVALID_LINK_STATUS: receipt allocation requires Paid Income finance' using errcode='23503';
        end if;
        if coalesce(invoice_row->>'projectId',invoice_row->>'project_id','')<>''
           and coalesce(payment_row->>'projectId',payment_row->>'project_id','')<>''
           and coalesce(invoice_row->>'projectId',invoice_row->>'project_id')<>coalesce(payment_row->>'projectId',payment_row->>'project_id') then
          raise exception 'CROSS_PROJECT_REFERENCE: invoice and payment projects differ' using errcode='23503';
        end if;
        target_total:=app.json_numeric_or_zero(payment_row,'amount');
        select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
        into existing_total
        from public.entity_records r
        where r.company_id=p_company and r.collection='paymentAllocations'
          and r.record_id<>p_record_id and r.deleted_at is null
          and coalesce(r.data->>'paymentId',r.data->>'payment_id')=payment_id
          and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
        if round(existing_total+amount_value,0)>round(target_total,0)+1 then
          raise exception 'OVER_ALLOCATION: recognized allocations exceed Paid finance amount' using errcode='23514';
        end if;
      end if;
    end if;

  elsif p_collection='billingMilestones' then
    status_value:=lower(coalesce(app.json_text(p_payload,'paymentStatus','payment_status'),'unpaid'));
    if status_value not in ('cancelled','canceled','deleted','void') then
      v:=app.json_text(p_payload,'contractId','contract_id');
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|billing-milestones|'||v,0));
      select r.data into contract_row from public.entity_records r
      where r.company_id=p_company and r.collection='contracts'
        and r.record_id=v and r.deleted_at is null;
      amount_value:=app.json_numeric_or_zero(p_payload,'amountExclVat','amount_excl_vat','amount');
      current_percent:=app.json_numeric_or_zero(p_payload,'percentage');
      select
        coalesce(sum(app.json_numeric_or_zero(r.data,'amountExclVat','amount_excl_vat','amount')),0),
        coalesce(sum(app.json_numeric_or_zero(r.data,'percentage')),0)
      into existing_total,existing_percent
      from public.entity_records r
      where r.company_id=p_company and r.collection='billingMilestones'
        and r.record_id<>p_record_id and r.deleted_at is null
        and coalesce(r.data->>'contractId',r.data->>'contract_id')=v
        and lower(coalesce(r.data->>'paymentStatus',r.data->>'payment_status','unpaid')) not in ('cancelled','canceled','deleted','void');
      target_total:=app.json_numeric_or_zero(contract_row,'valueExclVat','value_excl_vat','contractValue','contract_value');
      if existing_percent+current_percent>100.01 then
        raise exception 'FORMULA_MISMATCH: milestone percentages exceed 100 percent' using errcode='23514';
      end if;
      if round(existing_total+amount_value,0)>round(target_total,0)+1 then
        raise exception 'FORMULA_MISMATCH: milestone amounts exceed contract value' using errcode='23514';
      end if;
    end if;
  end if;
end $$;

-- Private validation helpers remain inaccessible to browser roles.
revoke all on function app.validate_entity_payload_v453(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.json_has_unsafe_key(jsonb) from public,anon,authenticated;
revoke all on function app.json_numeric_or_zero(jsonb,text[]) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.4';
update public.companies
set active_release_version='4.5.4'
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3');
insert into public.schema_versions(version,description) values
('4.5.4','Formula and linkage security hardening: strict Paid cash, recognized invoices, atomic invoice/payment allocation caps, contract-project alignment, recursive unsafe JSON rejection and clean-session web protection')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 035_ui_formula_deep_audit_v455.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.5
-- Deep formula audit: PIT workflow/math, payment-allocation evidence and temporal ordering.
begin;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_v454;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  status_value text;
  journal_id text;
  payment_id text;
  allocation_date text;
  gross_value numeric:=0;
  taxable_value numeric:=0;
  tax_value numeric:=0;
  net_value numeric:=0;
  rate_value numeric:=0;
  journal_row jsonb;
  payment_row jsonb;
  recognized boolean:=false;
begin
  perform app.validate_entity_payload_v454(p_company,p_collection,p_record_id,p_payload);

  if p_collection='pitWithholdings' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
    if status_value not in ('pending','withheld','declared','paid','posted','approved','completed','cancelled','canceled','deleted','void') then
      raise exception 'INVALID_ENUM: pitWithholdings.status' using errcode='22023';
    end if;

    gross_value:=app.json_numeric_or_zero(p_payload,'grossIncome','gross_income','grossAmount','gross_amount');
    taxable_value:=app.json_numeric_or_zero(p_payload,'taxableIncome','taxable_income');
    tax_value:=app.json_numeric_or_zero(p_payload,'taxWithheld','tax_withheld','taxAmount','tax_amount');
    net_value:=app.json_numeric_or_zero(p_payload,'netPaid','net_paid','netAmount','net_amount');
    rate_value:=app.json_numeric_or_zero(p_payload,'rate','withholdingRate','withholding_rate');
    if gross_value<=0 or taxable_value<0 or taxable_value>gross_value
       or tax_value<0 or tax_value>gross_value or rate_value<0 or rate_value>100 then
      raise exception 'FORMULA_RANGE: invalid PIT gross/taxable/tax/rate values' using errcode='23514';
    end if;
    if round(net_value,0)<>round(gross_value-tax_value,0) then
      raise exception 'FORMULA_MISMATCH: PIT net must equal gross minus tax' using errcode='23514';
    end if;

    recognized:=status_value in ('withheld','declared','paid','posted','approved','completed');
    if recognized then
      journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id');
      if journal_id is null then
        raise exception 'MISSING_REFERENCE: recognized PIT requires Posted journal entry' using errcode='23503';
      end if;
      select r.data into journal_row from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=journal_id and r.deleted_at is null;
      if journal_row is null or lower(coalesce(journal_row->>'status',''))<>'posted' then
        raise exception 'INVALID_LINK_STATUS: recognized PIT requires Posted journal entry' using errcode='23503';
      end if;
    end if;

  elsif p_collection='paymentAllocations' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'posted'));
    recognized:=status_value in ('posted','paid','applied','completed');
    if recognized then
      payment_id:=app.json_text(p_payload,'paymentId','payment_id');
      if payment_id is null then
        raise exception 'MISSING_REFERENCE: recognized allocation requires Paid Income finance' using errcode='23503';
      end if;
      allocation_date:=app.json_text(p_payload,'date','allocationDate','allocation_date','paymentDate','payment_date');
      select r.data into payment_row from public.entity_records r
      where r.company_id=p_company and r.collection='finance'
        and r.record_id=payment_id and r.deleted_at is null;
      if payment_row is null or lower(coalesce(payment_row->>'type',''))<>'income'
         or lower(coalesce(payment_row->>'status',''))<>'paid' then
        raise exception 'INVALID_LINK_STATUS: recognized allocation requires Paid Income finance' using errcode='23503';
      end if;
      if allocation_date is null or coalesce(payment_row->>'date','')=''
         or allocation_date<coalesce(payment_row->>'date','') then
        raise exception 'DATE_ORDER: allocation date must not precede payment date' using errcode='23514';
      end if;
    end if;
  end if;
end $$;

revoke all on function app.validate_entity_payload_v454(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.5';
update public.companies
set active_release_version='4.5.5'
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4');

insert into public.schema_versions(version,description) values
('4.5.5','Unified UI rhythm and navigation; PIT status/date thresholds; inclusive CIT boundary; fail-closed payment allocations; Posted-only project cost linkage and net VAT ledger reconciliation')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 036_ui_balance_contrast_formula_simulation_v456.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.6
-- UI balance/contrast certification and deterministic formula-simulation release marker.
begin;

alter table public.companies alter column active_release_version set default '4.5.6';
update public.companies
set active_release_version='4.5.6',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5');

insert into public.schema_versions(version,description) values
('4.5.6','Balanced tables and KPI grids; true circular chart markers; full light/dark contrast audit; deterministic independent formula simulation certification')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 037_ui_ux_workflow_formula_input_v457.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.7
-- Workflow UI/input-validation release marker and exact billing-milestone allocation certification.
begin;

alter table public.companies alter column active_release_version set default '4.5.7';
update public.companies
set active_release_version='4.5.7',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6');

insert into public.schema_versions(version,description) values
('4.5.7','Workflow-centered data entry with live calculation previews, inline validation, semantic table actions and exact billing-milestone remainder allocation')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 038_compact_kpi_runtime_hardening_v458.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.8
-- UI-only compact KPI and runtime-regression release marker. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.8';
update public.companies
set active_release_version='4.5.8',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7');

insert into public.schema_versions(version,description) values
('4.5.8','Compact KPI dashboard, semantic attention badges without pseudo-element conflicts, stale release-artifact cleanup and runtime regression hardening')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 039_full_table_layout_alignment_v459.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.9
-- UI/table-layout release marker. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.9';
update public.companies
set active_release_version='4.5.9',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8');

insert into public.schema_versions(version,description) values
('4.5.9','Full-width business tables, aligned action controls, balanced financial and operational panels, and browser layout regression hardening')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 040_table_separation_action_usability_v4510.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.10
-- UI table-separation/action-usability release marker. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.10';
update public.companies
set active_release_version='4.5.10',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9');

insert into public.schema_versions(version,description) values
('4.5.10','Named full-width people directory, collision-free VAT and backup controls, and usable immutable journal read-only actions')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 041_action_edit_collision_fix_v4511.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.11
-- UI/action release marker. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.11';
update public.companies
set active_release_version='4.5.11',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9','4.5.10');

insert into public.schema_versions(version,description) values
('4.5.11','Safe posted-journal adjustment action and collision-free VAT/backup cell containment')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 042_final_ui_formula_linkage_closure_v4512.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.12
-- Final UI/UX and formula-linkage simulation release marker. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.12';
update public.companies
set active_release_version='4.5.12',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9','4.5.10','4.5.11');

insert into public.schema_versions(version,description) values
('4.5.12','Final journal-entry UI clarity, balanced immutable-ledger actions, cloud layout containment and full formula/linkage simulation regression')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 043_modal_scroll_action_visibility_v4513.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.13
-- Modal scroll and action-visibility release marker. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.13';
update public.companies
set active_release_version='4.5.13',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9','4.5.10','4.5.11','4.5.12');

insert into public.schema_versions(version,description) values
('4.5.13','Independent journal-modal scrolling, fixed header/action visibility, and modal layering above the runtime guard banner')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 044_final_release_candidate_v4514.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.14
-- Final release-candidate marker and production-gate reset. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.14';
update public.companies
set active_release_version='4.5.14',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9','4.5.10','4.5.11','4.5.12','4.5.13');

insert into public.schema_versions(version,description) values
('4.5.14','Final release candidate: strict production preflight, refreshed responsive/XSS/offline audits, and clearer posted-journal adjustment action')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 045_account_protection_mfa_runtime_fix_v4515.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.15
-- Account protection and MFA runtime visibility fix. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.15';
update public.companies
set active_release_version='4.5.15',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9','4.5.10','4.5.11','4.5.12','4.5.13','4.5.14');

insert into public.schema_versions(version,description) values
('4.5.15','Account protection and MFA runtime fix: visible Demo/offline status, session validation, stale-factor cleanup, AAL and verified-factor diagnostics')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 046_release_claim_ui_mobile_security_formula_sql_audit_v4516.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.16
-- Corrects release evidence, mobile More navigation, VND rounding and fail-closed MFA gates.
-- No business table or accounting schema change; Production remains blocked pending real Staging UAT.
begin;

alter table public.companies alter column active_release_version set default '4.5.16';
update public.companies
set active_release_version='4.5.16',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9','4.5.10','4.5.11','4.5.12','4.5.13','4.5.14','4.5.15');

insert into public.schema_versions(version,description) values
('4.5.16','Release-evidence correction, exact desktop table fit, mobile More navigation access, symmetric VND rounding, fail-closed privileged MFA and ordered migration audit')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 047_accounting_report_table_fit_v4517.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.17
-- Rebalances the management-result and project P&L panels so all desktop columns remain visible.
-- No accounting formula, business table or authorization schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.17';
update public.companies
set active_release_version='4.5.17',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.16';

insert into public.schema_versions(version,description) values
('4.5.17','Accounting management-result and project P&L desktop table-fit correction; no formula or business-schema change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 048_tax_integration_typography_formula_linkage_v4518.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.18
-- Restores the Accounting Tax runtime, adds controlled integration configuration actions,
-- closes typography clipping and records the independently rerun money/linkage audit.
-- No business table or accounting formula schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.18';
update public.companies
set active_release_version='4.5.18',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.17';

insert into public.schema_versions(version,description) values
('4.5.18','Accounting Tax runtime restoration, controlled email/bank configuration actions, typography clipping closure and independent money/linkage regression audit; no business-schema change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 049_accessibility_table_fit_truthful_integrations_v4519.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.19
-- Closes desktop table overflow/action-heading defects, improves keyboard/focus accessibility,
-- enforces truthful Demo integration wording and records the final UI regression package.
-- No business table, accounting formula or posting-rule schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.19';
update public.companies
set active_release_version='4.5.19',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.18';

insert into public.schema_versions(version,description) values
('4.5.19','Accessibility labels and focus lifecycle, desktop full-table fit with explicit action headings, aligned status glyphs and truthful Demo integration states; no business-schema or accounting-formula change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 050_global_table_column_action_alignment_v4520.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.20
-- Records semantic desktop column sizing and exact THAO TAC alignment across all modules.
-- No business table, accounting formula, posting rule or tax calculation schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.20';
update public.companies
set active_release_version='4.5.20',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.19';

insert into public.schema_versions(version,description) values
('4.5.20','Semantic full-width desktop table columns and centered action headings/controls across all modules; no business-schema or accounting-formula change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 051_deep_audit_transition_permissions_v4521.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.21
-- Deep audit closure: transition-specific permissions for generic entity sync,
-- immutable posted journals and auditable accounting-period unlocks.
begin;

create or replace function app.collection_permission(p_collection text,p_write boolean default false)
returns text language sql immutable as $$
  select case
    when p_collection in ('projects','projectStages','tasks','resourcePlans','commitments','projectBudgetVersions','projectBudgetLines')
      then case when p_write then 'projects.write' else 'projects.read' end
    when p_collection in ('clients','quotes','contracts','billingMilestones','paymentAllocations')
      then case when p_write then 'crm.write' else 'crm.read' end
    when p_collection='people'
      then case when p_write then 'hr.write' else 'hr.read' end
    when p_collection='timesheets'
      then case when p_write then 'timesheet.write' else 'timesheet.read' end
    when p_collection='accountingPeriods'
      then case when p_write then 'accounting.close' else 'accounting.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection='documents'
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings'
      then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system'
      then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

create or replace function app.assert_entity_transition_permission(
  p_company uuid,
  p_collection text,
  p_old jsonb,
  p_new jsonb,
  p_deleted boolean default false
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare
  old_status text:=lower(coalesce(p_old->>'status',''));
  new_status text:=lower(coalesce(p_new->>'status',''));
  old_approved boolean:=coalesce((p_old->>'approved')::boolean,false);
  new_approved boolean:=coalesce((p_new->>'approved')::boolean,false);
  unlock_reason text:=btrim(coalesce(p_new->>'unlockReason',p_new->>'unlock_reason',''));
  policy_mfa boolean:=coalesce((select require_mfa_for_privileged from public.companies where id=p_company),true);
begin
  if p_collection='journalEntries' then
    if old_status='posted' and (coalesce(p_deleted,false) or p_new is distinct from p_old) then
      raise exception 'POSTED_JOURNAL_IMMUTABLE: use an adjustment or reversal entry' using errcode='42501';
    end if;
    if new_status='posted' and old_status is distinct from 'posted' then
      if not app.has_permission('accounting.post',p_company) then
        raise exception 'ACCOUNTING_POST_PERMISSION_REQUIRED' using errcode='42501';
      end if;
      if policy_mfa and app.current_aal()<>'aal2' then
        raise exception 'MFA_AAL2_REQUIRED_FOR_ACCOUNTING_POST' using errcode='42501';
      end if;
    end if;

  elsif p_collection='accountingPeriods' then
    if not app.has_permission('accounting.close',p_company)
       and not app.has_permission('accounting.period.lock',p_company) then
      raise exception 'ACCOUNTING_CLOSE_PERMISSION_REQUIRED' using errcode='42501';
    end if;
    if policy_mfa and app.current_aal()<>'aal2' then
      raise exception 'MFA_AAL2_REQUIRED_FOR_PERIOD_CONTROL' using errcode='42501';
    end if;
    if coalesce((p_old->>'locked')::boolean,false)
       and not coalesce((p_new->>'locked')::boolean,false)
       and not coalesce(p_deleted,false)
       and length(unlock_reason)<8 then
      raise exception 'ACCOUNTING_PERIOD_UNLOCK_REASON_REQUIRED' using errcode='22023';
    end if;

  elsif p_collection='timesheets' then
    if (new_approved and not old_approved)
       or (new_status in ('approved','rejected') and new_status is distinct from old_status) then
      if not app.has_permission('timesheet.approve',p_company) then
        raise exception 'TIMESHEET_APPROVE_PERMISSION_REQUIRED' using errcode='42501';
      end if;
    end if;

  elsif p_collection in ('approvals','purchaseRequests','purchaseOrders') then
    if new_status in ('approved','rejected') and new_status is distinct from old_status then
      if not app.has_permission('procurement.approve',p_company) then
        raise exception 'PROCUREMENT_APPROVE_PERMISSION_REQUIRED' using errcode='42501';
      end if;
    end if;
  end if;
end $$;

create or replace function app.entity_record_guard() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare permission_code text;
begin
  if tg_op='UPDATE' and (new.company_id,new.collection,new.record_id) is distinct from (old.company_id,old.collection,old.record_id) then
    raise exception 'IMMUTABLE_ENTITY_IDENTITY: company_id, collection and record_id cannot be changed' using errcode='22023';
  end if;
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

  perform app.assert_entity_transition_permission(
    new.company_id,
    new.collection,
    case when tg_op='UPDATE' then old.data else '{}'::jsonb end,
    new.data,
    new.deleted_at is not null
  );

  if new.deleted_at is null then
    perform app.validate_entity_payload(new.company_id,new.collection,new.record_id,new.data);
  elsif tg_op='INSERT' then
    perform app.assert_entity_delete_safe(new.company_id,new.collection,new.record_id);
  elsif old.deleted_at is null then
    perform app.assert_entity_delete_safe(new.company_id,new.collection,new.record_id);
  end if;
  if tg_op='INSERT' then new.created_by:=coalesce(new.created_by,app.current_user_id());new.created_at:=coalesce(new.created_at,clock_timestamp());end if;
  new.updated_by:=app.current_user_id();new.updated_at:=clock_timestamp();return new;
end $$;

revoke all on function app.assert_entity_transition_permission(uuid,text,jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function app.entity_record_guard() from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.21';
update public.companies set active_release_version='4.5.21'
where active_release_version is null or active_release_version in ('4.5.18','4.5.19','4.5.20');

insert into public.schema_versions(version,description) values
('4.5.21','Deep audit closure: transition-specific entity sync permissions, immutable Posted journals, MFA-protected posting and accounting-period control, auditable unlock reasons, secure identifiers and reliable browser evidence')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 052_qa_closure_release_v4525.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.25
-- QA closure release marker: aligns application, export, evidence and database release metadata.
begin;

alter table public.companies
  alter column active_release_version set default '4.5.25';

update public.companies
set active_release_version='4.5.25'
where active_release_version is null
   or active_release_version in ('4.5.21','4.5.22','4.5.23','4.5.24');

insert into public.schema_versions(version,description) values
('4.5.25','QA closure release: reliable authenticated browser audits, bounded test execution, corrected Excel date and percentage semantics, and unified runtime/export/database release metadata')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 053_effective_dated_tax_qa_portability_v4526.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.26
-- Engineering QA release marker: effective-dated tax policy and portable browser validation.
begin;

alter table public.companies
  alter column active_release_version set default '4.5.26';

update public.companies
set active_release_version='4.5.26'
where active_release_version is null
   or active_release_version in ('4.5.21','4.5.22','4.5.23','4.5.24','4.5.25');

insert into public.schema_versions(version,description) values
('4.5.26','Engineering QA release: effective-dated CIT policy, cross-year review control, current PWA cache and portable fail-fast browser audit tooling')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 054_production_invariants_v4527.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.27
-- Production invariants: exact cash-journal evidence, immutable Posted asset
-- schedules, parent-side allocation caps and complete dependency-safe deletion.
begin;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_v455;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  status_value text;
  type_value text;
  journal_id text;
  project_id text;
  source_id text;
  period_value text;
  journal_row jsonb;
  current_row jsonb;
  schedule_row jsonb;
  amount_value numeric:=0;
  allocated_value numeric:=0;
  cash_net numeric:=0;
  debit_total numeric:=0;
  credit_total numeric:=0;
  protected_schedule boolean:=false;
begin
  perform app.validate_entity_payload_v455(p_company,p_collection,p_record_id,p_payload);

  if p_collection='finance' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
    type_value:=lower(coalesce(app.json_text(p_payload,'type'),''));
    journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id');
    project_id:=app.json_text(p_payload,'projectId','project_id');
    amount_value:=app.json_numeric_or_zero(p_payload,'amount');

    if status_value='paid' then
      if journal_id is null then
        raise exception 'FINANCE_JOURNAL_REQUIRED: Paid finance requires a Posted cash journal' using errcode='23503';
      end if;
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|finance-journal|'||journal_id,0));
      select r.data into journal_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=journal_id and r.deleted_at is null;
      if journal_row is null or lower(coalesce(journal_row->>'status',''))<>'posted' then
        raise exception 'FINANCE_JOURNAL_NOT_POSTED: Paid finance requires a Posted journal' using errcode='23503';
      end if;
      if coalesce(journal_row->>'date','')<>coalesce(p_payload->>'date','') then
        raise exception 'FINANCE_JOURNAL_DATE_MISMATCH: finance and journal dates must match' using errcode='23514';
      end if;
      select coalesce(sum(
        case when coalesce(app.json_text(line.value,'accountCode','account_code'),'') ~ '^(111|112)'
          then app.json_numeric_or_zero(line.value,'debit')-app.json_numeric_or_zero(line.value,'credit')
          else 0 end
      ),0)
      into cash_net
      from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value);
      if (type_value='income' and round(cash_net,0)<>round(amount_value,0))
         or (type_value='expense' and round(cash_net,0)<>-round(amount_value,0)) then
        raise exception 'FINANCE_JOURNAL_AMOUNT_MISMATCH: net 111/112 movement must equal Paid finance amount and direction' using errcode='23514';
      end if;
      if project_id is not null
         and coalesce(journal_row->>'projectId',journal_row->>'project_id','')<>project_id
         and not exists(
           select 1
           from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value)
           where coalesce(line.value->>'projectId',line.value->>'project_id','')=project_id
         ) then
        raise exception 'FINANCE_JOURNAL_PROJECT_MISMATCH: finance project must be present on the journal' using errcode='23514';
      end if;
      if exists(
        select 1 from public.entity_records r
        where r.company_id=p_company and r.collection='finance'
          and r.record_id<>p_record_id and r.deleted_at is null
          and lower(coalesce(r.data->>'status',''))='paid'
          and coalesce(r.data->>'journalEntryId',r.data->>'journal_entry_id',r.data->>'postingId',r.data->>'posting_id')=journal_id
      ) then
        raise exception 'DUPLICATE_FINANCE_JOURNAL_LINK: one cash journal cannot support multiple Paid finance rows' using errcode='23505';
      end if;
    elsif journal_id is not null then
      raise exception 'FINANCE_JOURNAL_PENDING_LINK: only Paid finance may link a Posted cash journal' using errcode='23514';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|payment-allocation|'||p_record_id,0));
    select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
    into allocated_value
    from public.entity_records r
    where r.company_id=p_company and r.collection='paymentAllocations'
      and r.deleted_at is null
      and coalesce(r.data->>'paymentId',r.data->>'payment_id')=p_record_id
      and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
    if allocated_value>0 then
      if status_value<>'paid' or type_value<>'income' then
        raise exception 'ALLOCATED_PAYMENT_IMMUTABLE: allocated payment must remain Paid Income' using errcode='23514';
      end if;
      if round(amount_value,0)+1<round(allocated_value,0) then
        raise exception 'ALLOCATED_PAYMENT_AMOUNT: payment amount cannot be below recognized allocations' using errcode='23514';
      end if;
      if exists(
        select 1 from public.entity_records a
        where a.company_id=p_company and a.collection='paymentAllocations'
          and a.deleted_at is null
          and coalesce(a.data->>'paymentId',a.data->>'payment_id')=p_record_id
          and lower(coalesce(a.data->>'status','posted')) in ('posted','paid','applied','completed')
          and coalesce(a.data->>'date',a.data->>'allocationDate',a.data->>'allocation_date',a.data->>'paymentDate',a.data->>'payment_date','')<coalesce(p_payload->>'date','')
      ) then
        raise exception 'ALLOCATED_PAYMENT_DATE: payment date cannot follow an allocation date' using errcode='23514';
      end if;
      if exists(
        select 1
        from public.entity_records a
        join public.entity_records i
          on i.company_id=a.company_id and i.collection='taxInvoices'
         and i.record_id=coalesce(a.data->>'invoiceId',a.data->>'invoice_id') and i.deleted_at is null
        where a.company_id=p_company and a.collection='paymentAllocations'
          and a.deleted_at is null
          and coalesce(a.data->>'paymentId',a.data->>'payment_id')=p_record_id
          and lower(coalesce(a.data->>'status','posted')) in ('posted','paid','applied','completed')
          and coalesce(i.data->>'projectId',i.data->>'project_id','')<>''
          and coalesce(i.data->>'projectId',i.data->>'project_id')<>coalesce(project_id,'')
      ) then
        raise exception 'ALLOCATED_PAYMENT_PROJECT: payment project differs from an allocated invoice' using errcode='23514';
      end if;
    end if;

  elsif p_collection='taxInvoices' then
    perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|invoice-allocation|'||p_record_id,0));
    select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
    into allocated_value
    from public.entity_records r
    where r.company_id=p_company and r.collection='paymentAllocations'
      and r.deleted_at is null
      and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=p_record_id
      and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
    if allocated_value>0 then
      status_value:=lower(coalesce(app.json_text(p_payload,'status'),'valid'));
      if lower(coalesce(app.json_text(p_payload,'direction'),''))<>'output'
         or status_value in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'ALLOCATED_INVOICE_IMMUTABLE: allocated invoice must remain a recognized Output invoice' using errcode='23514';
      end if;
      amount_value:=app.json_numeric_or_zero(p_payload,'totalAmount','total_amount');
      if round(amount_value,0)+1<round(allocated_value,0) then
        raise exception 'ALLOCATED_INVOICE_AMOUNT: invoice total cannot be below recognized allocations' using errcode='23514';
      end if;
      project_id:=app.json_text(p_payload,'projectId','project_id');
      if exists(
        select 1
        from public.entity_records a
        join public.entity_records f
          on f.company_id=a.company_id and f.collection='finance'
         and f.record_id=coalesce(a.data->>'paymentId',a.data->>'payment_id') and f.deleted_at is null
        where a.company_id=p_company and a.collection='paymentAllocations'
          and a.deleted_at is null
          and coalesce(a.data->>'invoiceId',a.data->>'invoice_id')=p_record_id
          and lower(coalesce(a.data->>'status','posted')) in ('posted','paid','applied','completed')
          and coalesce(f.data->>'projectId',f.data->>'project_id','')<>''
          and coalesce(f.data->>'projectId',f.data->>'project_id')<>coalesce(project_id,'')
      ) then
        raise exception 'ALLOCATED_INVOICE_PROJECT: invoice project differs from an allocated payment' using errcode='23514';
      end if;
    end if;

  elsif p_collection in ('tools','fixedAssets') then
    source_id:=p_record_id;
    perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|asset-schedule|'||p_collection||'|'||source_id,0));
    select r.data into current_row
    from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null;
    if current_row is not null then
      select exists(
        select 1
        from public.entity_records s
        left join public.entity_records j
          on j.company_id=s.company_id and j.collection='journalEntries'
         and j.record_id=coalesce(s.data->>'journalEntryId',s.data->>'journal_entry_id') and j.deleted_at is null
        where s.company_id=p_company and s.deleted_at is null
          and s.collection=case when p_collection='tools' then 'toolAllocationSchedules' else 'depreciationSchedules' end
          and coalesce(s.data->>'sourceId',s.data->>'source_id')=source_id
          and (lower(coalesce(s.data->>'status',''))='posted' or lower(coalesce(j.data->>'status',''))='posted')
      ) into protected_schedule;
      if protected_schedule and (
        (p_collection='tools' and (
          coalesce(current_row->>'startDate',current_row->>'start_date','') is distinct from coalesce(p_payload->>'startDate',p_payload->>'start_date','')
          or app.json_numeric_or_zero(current_row,'originalCost','original_cost') is distinct from app.json_numeric_or_zero(p_payload,'originalCost','original_cost')
          or app.json_numeric_or_zero(current_row,'allocationMonths','allocation_months') is distinct from app.json_numeric_or_zero(p_payload,'allocationMonths','allocation_months')
          or coalesce(current_row->>'expenseAccountCode',current_row->>'expense_account_code','') is distinct from coalesce(p_payload->>'expenseAccountCode',p_payload->>'expense_account_code','')
          or coalesce(current_row->>'projectId',current_row->>'project_id','') is distinct from coalesce(p_payload->>'projectId',p_payload->>'project_id','')
        ))
        or (p_collection='fixedAssets' and (
          coalesce(current_row->>'acquisitionDate',current_row->>'acquisition_date','') is distinct from coalesce(p_payload->>'acquisitionDate',p_payload->>'acquisition_date','')
          or coalesce(current_row->>'inServiceDate',current_row->>'in_service_date','') is distinct from coalesce(p_payload->>'inServiceDate',p_payload->>'in_service_date','')
          or app.json_numeric_or_zero(current_row,'originalCost','original_cost') is distinct from app.json_numeric_or_zero(p_payload,'originalCost','original_cost')
          or app.json_numeric_or_zero(current_row,'residualValue','residual_value') is distinct from app.json_numeric_or_zero(p_payload,'residualValue','residual_value')
          or app.json_numeric_or_zero(current_row,'usefulLifeMonths','useful_life_months') is distinct from app.json_numeric_or_zero(p_payload,'usefulLifeMonths','useful_life_months')
          or coalesce(current_row->>'depreciationAccountCode',current_row->>'depreciation_account_code','') is distinct from coalesce(p_payload->>'depreciationAccountCode',p_payload->>'depreciation_account_code','')
          or coalesce(current_row->>'expenseAccountCode',current_row->>'expense_account_code','') is distinct from coalesce(p_payload->>'expenseAccountCode',p_payload->>'expense_account_code','')
          or coalesce(current_row->>'projectId',current_row->>'project_id','') is distinct from coalesce(p_payload->>'projectId',p_payload->>'project_id','')
        ))
      ) then
        raise exception 'POSTED_SCHEDULE_IMMUTABLE: financial schedule drivers cannot change after a period is Posted' using errcode='23514';
      end if;
    end if;

  elsif p_collection in ('toolAllocationSchedules','depreciationSchedules') then
    source_id:=app.json_text(p_payload,'sourceId','source_id');
    period_value:=app.json_text(p_payload,'period');
    journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id');
    amount_value:=app.json_numeric_or_zero(p_payload,'amount');
    if amount_value<=0 then
      raise exception 'SCHEDULE_AMOUNT: allocation/depreciation amount must be positive' using errcode='23514';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(
      p_company::text||'|asset-schedule|'||
      case when p_collection='toolAllocationSchedules' then 'tools' else 'fixedAssets' end||'|'||source_id,0));
    select r.data into current_row
    from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null;
    if current_row is not null then
      select r.data into journal_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=coalesce(current_row->>'journalEntryId',current_row->>'journal_entry_id') and r.deleted_at is null;
      if lower(coalesce(current_row->>'status',''))='posted' or lower(coalesce(journal_row->>'status',''))='posted' then
        if coalesce(current_row->>'sourceId',current_row->>'source_id','') is distinct from source_id
           or coalesce(current_row->>'period','') is distinct from period_value
           or app.json_numeric_or_zero(current_row,'amount') is distinct from amount_value
           or coalesce(current_row->>'journalEntryId',current_row->>'journal_entry_id','') is distinct from coalesce(journal_id,'') then
          raise exception 'POSTED_SCHEDULE_ROW_IMMUTABLE: Posted schedule rows cannot change' using errcode='23514';
        end if;
        if lower(coalesce(current_row->>'status','')) is distinct from lower(coalesce(p_payload->>'status','')) then
          raise exception 'POSTED_SCHEDULE_ROW_IMMUTABLE: Posted schedule rows cannot change' using errcode='23514';
        end if;
      end if;
    end if;
    if journal_id is not null then
      select r.data into journal_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=journal_id and r.deleted_at is null;
      select
        coalesce(sum(app.json_numeric_or_zero(line.value,'debit')),0),
        coalesce(sum(app.json_numeric_or_zero(line.value,'credit')),0)
      into debit_total,credit_total
      from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value);
      if journal_row is null
         or lower(coalesce(journal_row->>'sourceType',journal_row->>'source_type',''))<>
            case when p_collection='toolAllocationSchedules' then 'tool_allocation' else 'asset_depreciation' end
         or coalesce(journal_row->>'sourceId',journal_row->>'source_id','')<>source_id||':'||period_value
         or left(coalesce(journal_row->>'date',''),7)<>period_value
         or abs(round(debit_total,0)-round(amount_value,0))>0
         or abs(round(credit_total,0)-round(amount_value,0))>0 then
        raise exception 'SCHEDULE_JOURNAL_MISMATCH: schedule source, period and amount must match its journal' using errcode='23514';
      end if;
    end if;

  elsif p_collection='journalEntries'
        and lower(coalesce(app.json_text(p_payload,'status'),''))='posted'
        and lower(coalesce(app.json_text(p_payload,'sourceType','source_type'),'')) in ('tool_allocation','asset_depreciation') then
    source_id:=app.json_text(p_payload,'sourceId','source_id');
    period_value:=right(source_id,7);
    source_id:=left(source_id,greatest(0,length(source_id)-8));
    perform pg_advisory_xact_lock(hashtextextended(
      p_company::text||'|asset-schedule|'||
      case when lower(coalesce(app.json_text(p_payload,'sourceType','source_type'),''))='tool_allocation' then 'tools' else 'fixedAssets' end||'|'||source_id,0));
    select r.data into schedule_row
    from public.entity_records r
    where r.company_id=p_company and r.deleted_at is null
      and r.collection=case when lower(coalesce(app.json_text(p_payload,'sourceType','source_type'),''))='tool_allocation' then 'toolAllocationSchedules' else 'depreciationSchedules' end
      and coalesce(r.data->>'sourceId',r.data->>'source_id')=source_id
      and coalesce(r.data->>'period','')=period_value
    limit 1;
    select
      coalesce(sum(app.json_numeric_or_zero(line.value,'debit')),0),
      coalesce(sum(app.json_numeric_or_zero(line.value,'credit')),0)
    into debit_total,credit_total
    from jsonb_array_elements(case when jsonb_typeof(p_payload->'lines')='array' then p_payload->'lines' else '[]'::jsonb end) line(value);
    if schedule_row is null
       or coalesce(schedule_row->>'journalEntryId',schedule_row->>'journal_entry_id','')<>p_record_id
       or coalesce(schedule_row->>'period','')<>left(coalesce(p_payload->>'date',''),7)
       or abs(round(app.json_numeric_or_zero(schedule_row,'amount'),0)-round(debit_total,0))>0
       or abs(round(app.json_numeric_or_zero(schedule_row,'amount'),0)-round(credit_total,0))>0 then
      raise exception 'SCHEDULE_POSTING_MISMATCH: auto journal must match its linked schedule before posting' using errcode='23514';
    end if;
  end if;
end $$;

alter function app.assert_entity_delete_safe(uuid,text,text)
  rename to assert_entity_delete_safe_v453;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare
  existing_row jsonb;
  journal_row jsonb;
begin
  perform app.assert_entity_delete_safe_v453(p_company,p_collection,p_record_id);

  if p_collection='projects' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='journalEntries' and r.deleted_at is null
      and (
        coalesce(r.data->>'projectId',r.data->>'project_id')=p_record_id
        or exists(
          select 1 from jsonb_array_elements(case when jsonb_typeof(r.data->'lines')='array' then r.data->'lines' else '[]'::jsonb end) line(value)
          where coalesce(line.value->>'projectId',line.value->>'project_id')=p_record_id
        )
      )
  ) then raise exception 'DEPENDENCY_EXISTS: project is referenced by journal entries' using errcode='23503'; end if;

  if p_collection in ('people','clients','vendors') and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='journalEntries' and r.deleted_at is null
      and (
        (((p_collection='people' and lower(coalesce(r.data->>'partnerType',r.data->>'partner_type','')) in ('person','employee'))
          or (p_collection<>'people' and lower(coalesce(r.data->>'partnerType',r.data->>'partner_type',''))=
            case when p_collection='clients' then 'client' else 'vendor' end))
         and coalesce(r.data->>'partnerId',r.data->>'partner_id')=p_record_id)
        or exists(
          select 1 from jsonb_array_elements(case when jsonb_typeof(r.data->'lines')='array' then r.data->'lines' else '[]'::jsonb end) line(value)
          where ((p_collection='people' and lower(coalesce(line.value->>'partnerType',line.value->>'partner_type','')) in ('person','employee'))
            or (p_collection<>'people' and lower(coalesce(line.value->>'partnerType',line.value->>'partner_type',''))=
              case when p_collection='clients' then 'client' else 'vendor' end))
            and coalesce(line.value->>'partnerId',line.value->>'partner_id')=p_record_id
        )
      )
  ) then raise exception 'DEPENDENCY_EXISTS: party is referenced by journal entries' using errcode='23503'; end if;

  if p_collection in ('clients','vendors') and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='taxInvoices' and r.deleted_at is null
      and lower(coalesce(r.data->>'partnerType',r.data->>'partner_type',''))=
        case when p_collection='clients' then 'client' else 'vendor' end
      and coalesce(r.data->>'partnerId',r.data->>'partner_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: party is referenced by tax invoices' using errcode='23503'; end if;

  if p_collection='people' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='pitWithholdings' and r.deleted_at is null
      and lower(coalesce(r.data->>'recipientType',r.data->>'recipient_type','')) in ('person','employee')
      and coalesce(r.data->>'recipientId',r.data->>'recipient_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: person is referenced by PIT records' using errcode='23503'; end if;

  if p_collection in ('toolAllocationSchedules','depreciationSchedules') then
    select r.data into existing_row
    from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null;
    select r.data into journal_row
    from public.entity_records r
    where r.company_id=p_company and r.collection='journalEntries'
      and r.record_id=coalesce(existing_row->>'journalEntryId',existing_row->>'journal_entry_id') and r.deleted_at is null;
    if lower(coalesce(existing_row->>'status',''))='posted' or lower(coalesce(journal_row->>'status',''))='posted' then
      raise exception 'POSTED_SCHEDULE_DELETE: Posted schedule rows cannot be deleted' using errcode='23503';
    end if;
  end if;
end $$;

revoke all on function app.validate_entity_payload_v455(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe_v453(uuid,text,text) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;

alter table public.companies
  alter column active_release_version set default '4.5.27';

update public.companies
set active_release_version='4.5.27'
where active_release_version is null
   or active_release_version in ('4.5.21','4.5.22','4.5.23','4.5.24','4.5.25','4.5.26');

insert into public.schema_versions(version,description) values
('4.5.27','Production invariant hardening: exact one-to-one Paid cash journals, parent-side invoice/payment allocation guards, immutable Posted asset schedules and complete dependency-safe deletion')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

commit;

-- ============================================================================
-- SOURCE: 055_financial_reporting_integrity_v4536.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.36
-- Financial reporting integrity, TT133 classification and cash-flow posting controls.

alter table public.accounts add column if not exists balance_sheet_class text;
alter table public.accounts drop constraint if exists accounts_balance_sheet_class_check;
alter table public.accounts add constraint accounts_balance_sheet_class_check
  check (balance_sheet_class is null or balance_sheet_class in ('current_other_asset','noncurrent_other_asset'));

update public.accounts
set balance_sheet_class='noncurrent_other_asset'
where balance_sheet_class is null and (code like '242%' or code like '244%');

alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists report_unit text not null default 'VND';
alter table public.companies add column if not exists accounting_regime_effective_date date;

create or replace function app.account_code_balance_at(
  p_company uuid,p_code text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company and a.code=p_code
$$;

create or replace function app.account_balance_at_excluding(
  p_company uuid,p_prefix text,p_exclude_prefix text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company and a.code like p_prefix||'%' and a.code not like p_exclude_prefix||'%'
$$;

create or replace function app.account_balance_by_class_at(
  p_company uuid,p_class text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company and a.balance_sheet_class=p_class
$$;

create or replace function app.account_balance_by_prefix_not_class_at(
  p_company uuid,p_prefixes text[],p_excluded_class text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company
  and exists(select 1 from unnest(p_prefixes) p where a.code like p||'%')
  and coalesce(a.balance_sheet_class,'')<>p_excluded_class
$$;

create or replace function app.require_cash_flow_code_on_post() returns trigger
language plpgsql set search_path=public,app as $$
declare
  cash_net bigint:=0;
  expected text;
begin
  if new.status='posted' and old.status is distinct from 'posted' then
    select coalesce(sum(jl.debit-jl.credit),0)::bigint into cash_net
    from journal_lines jl join accounts a on a.id=jl.account_id
    where jl.entry_id=new.id and (a.code like '111%' or a.code like '112%');

    if cash_net<>0 then
      if nullif(trim(new.cash_flow_code),'') is null then
        raise exception 'cash_flow_code is required for a posted cash or bank entry';
      end if;
      select c.expected_direction into expected from cash_flow_codes c where c.code=new.cash_flow_code;
      if expected is null then
        raise exception 'Unknown cash_flow_code %',new.cash_flow_code;
      end if;
      if expected='inflow' and cash_net<=0 then
        raise exception 'cash_flow_code % expects inflow but cash movement is outflow',new.cash_flow_code;
      elsif expected='outflow' and cash_net>=0 then
        raise exception 'cash_flow_code % expects outflow but cash movement is inflow',new.cash_flow_code;
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_require_cash_flow_code on journal_entries;
create trigger trg_require_cash_flow_code before update of status on journal_entries
for each row execute function app.require_cash_flow_code_on_post();

create or replace function app.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint,level int,is_total boolean)
language plpgsql stable security definer set search_path=public,app as $$
declare
  cid uuid:=app.current_company_id();
  s date; e date:=p_to; fy date;
  o_cash bigint; x_cash bigint; o_short bigint; x_short bigint; o_ar bigint; x_ar bigint;
  o_adv bigint; x_adv bigint; o_other_ar bigint; x_other_ar bigint; o_inv bigint; x_inv bigint;
  o_other_ca bigint; x_other_ca bigint; o_fixed_gross bigint; x_fixed_gross bigint;
  o_fixed_dep bigint; x_fixed_dep bigint; o_fixed bigint; x_fixed bigint;
  o_ip_gross bigint; x_ip_gross bigint; o_ip_dep bigint; x_ip_dep bigint; o_ip bigint; x_ip bigint;
  o_cip bigint; x_cip bigint; o_long_inv bigint; x_long_inv bigint; o_other_la bigint; x_other_la bigint;
  o_trade bigint; x_trade bigint; o_customer_adv bigint; x_customer_adv bigint; o_tax bigint; x_tax bigint;
  o_employee bigint; x_employee bigint; o_other_pay bigint; x_other_pay bigint; o_loans bigint; x_loans bigint;
  o_provisions bigint; x_provisions bigint; o_funds bigint; x_funds bigint; o_liab bigint; x_liab bigint;
  o_contributed bigint; x_contributed bigint; o_premium bigint; x_premium bigint; o_other_capital bigint; x_other_capital bigint;
  o_treasury bigint; x_treasury bigint; o_fx bigint; x_fx bigint; o_owner_funds bigint; x_owner_funds bigint;
  o_retained bigint; x_retained bigint; x_pnl bigint:=0; o_equity bigint; x_equity bigint;
begin
  perform app.assert_company_access(cid);
  fy:=app.fiscal_year_start_date(cid,e);
  s:=fy-1;

  o_cash:=app.account_balance_at(cid,'111',s)+app.account_balance_at(cid,'112',s);
  x_cash:=app.account_balance_at(cid,'111',e)+app.account_balance_at(cid,'112',e);
  o_short:=app.account_balance_at(cid,'121',s)+app.account_balance_at(cid,'128',s)-app.account_balance_at(cid,'2291',s,'credit');
  x_short:=app.account_balance_at(cid,'121',e)+app.account_balance_at(cid,'128',e)-app.account_balance_at(cid,'2291',e,'credit');
  o_ar:=app.account_balance_at(cid,'131',s); x_ar:=app.account_balance_at(cid,'131',e);
  o_adv:=app.account_balance_at(cid,'331',s,'debit'); x_adv:=app.account_balance_at(cid,'331',e,'debit');
  o_other_ar:=app.account_balance_at(cid,'136',s)+app.account_balance_at(cid,'138',s)+app.account_balance_at(cid,'141',s)-app.account_balance_at(cid,'2293',s,'credit');
  x_other_ar:=app.account_balance_at(cid,'136',e)+app.account_balance_at(cid,'138',e)+app.account_balance_at(cid,'141',e)-app.account_balance_at(cid,'2293',e,'credit');
  o_inv:=app.account_balance_at(cid,'15',s)-app.account_balance_at(cid,'2294',s,'credit');
  x_inv:=app.account_balance_at(cid,'15',e)-app.account_balance_at(cid,'2294',e,'credit');
  o_other_ca:=app.account_balance_at(cid,'133',s)+app.account_balance_by_class_at(cid,'current_other_asset',s);
  x_other_ca:=app.account_balance_at(cid,'133',e)+app.account_balance_by_class_at(cid,'current_other_asset',e);

  o_fixed_gross:=app.account_balance_at(cid,'211',s)+app.account_balance_at(cid,'213',s);
  x_fixed_gross:=app.account_balance_at(cid,'211',e)+app.account_balance_at(cid,'213',e);
  o_fixed_dep:=-app.account_balance_at_excluding(cid,'214','2147',s,'credit');
  x_fixed_dep:=-app.account_balance_at_excluding(cid,'214','2147',e,'credit');
  o_fixed:=o_fixed_gross+o_fixed_dep; x_fixed:=x_fixed_gross+x_fixed_dep;
  o_ip_gross:=app.account_balance_at(cid,'217',s); x_ip_gross:=app.account_balance_at(cid,'217',e);
  o_ip_dep:=-app.account_balance_at(cid,'2147',s,'credit'); x_ip_dep:=-app.account_balance_at(cid,'2147',e,'credit');
  o_ip:=o_ip_gross+o_ip_dep; x_ip:=x_ip_gross+x_ip_dep;
  o_cip:=app.account_balance_at(cid,'241',s); x_cip:=app.account_balance_at(cid,'241',e);
  o_long_inv:=app.account_balance_at(cid,'228',s)-app.account_balance_at(cid,'2292',s,'credit');
  x_long_inv:=app.account_balance_at(cid,'228',e)-app.account_balance_at(cid,'2292',e,'credit');
  o_other_la:=app.account_balance_by_prefix_not_class_at(cid,array['242','244'],'current_other_asset',s);
  x_other_la:=app.account_balance_by_prefix_not_class_at(cid,array['242','244'],'current_other_asset',e);

  o_trade:=app.account_balance_at(cid,'331',s,'credit'); x_trade:=app.account_balance_at(cid,'331',e,'credit');
  o_customer_adv:=app.account_balance_at(cid,'131',s,'credit'); x_customer_adv:=app.account_balance_at(cid,'131',e,'credit');
  o_tax:=app.account_balance_at(cid,'333',s,'credit'); x_tax:=app.account_balance_at(cid,'333',e,'credit');
  o_employee:=app.account_balance_at(cid,'334',s,'credit'); x_employee:=app.account_balance_at(cid,'334',e,'credit');
  o_other_pay:=app.account_balance_at(cid,'335',s,'credit')+app.account_balance_at(cid,'336',s,'credit')+app.account_balance_at(cid,'338',s,'credit');
  x_other_pay:=app.account_balance_at(cid,'335',e,'credit')+app.account_balance_at(cid,'336',e,'credit')+app.account_balance_at(cid,'338',e,'credit');
  o_loans:=app.account_balance_at(cid,'341',s,'credit'); x_loans:=app.account_balance_at(cid,'341',e,'credit');
  o_provisions:=app.account_balance_at(cid,'352',s,'credit'); x_provisions:=app.account_balance_at(cid,'352',e,'credit');
  o_funds:=app.account_balance_at(cid,'353',s,'credit')+app.account_balance_at(cid,'356',s,'credit');
  x_funds:=app.account_balance_at(cid,'353',e,'credit')+app.account_balance_at(cid,'356',e,'credit');
  o_liab:=o_trade+o_customer_adv+o_tax+o_employee+o_other_pay+o_loans+o_provisions+o_funds;
  x_liab:=x_trade+x_customer_adv+x_tax+x_employee+x_other_pay+x_loans+x_provisions+x_funds;

  o_contributed:=app.account_code_balance_at(cid,'411',s,'credit')+app.account_balance_at(cid,'4111',s,'credit');
  x_contributed:=app.account_code_balance_at(cid,'411',e,'credit')+app.account_balance_at(cid,'4111',e,'credit');
  o_premium:=app.account_balance_at(cid,'4112',s,'credit')-app.account_balance_at(cid,'4112',s,'debit');
  x_premium:=app.account_balance_at(cid,'4112',e,'credit')-app.account_balance_at(cid,'4112',e,'debit');
  o_other_capital:=app.account_balance_at(cid,'4118',s,'credit')-app.account_balance_at(cid,'4118',s,'debit');
  x_other_capital:=app.account_balance_at(cid,'4118',e,'credit')-app.account_balance_at(cid,'4118',e,'debit');
  o_treasury:=-app.account_balance_at(cid,'419',s); x_treasury:=-app.account_balance_at(cid,'419',e);
  o_fx:=app.account_balance_at(cid,'413',s,'credit')-app.account_balance_at(cid,'413',s);
  x_fx:=app.account_balance_at(cid,'413',e,'credit')-app.account_balance_at(cid,'413',e);
  o_owner_funds:=app.account_balance_at(cid,'418',s,'credit')-app.account_balance_at(cid,'418',s);
  x_owner_funds:=app.account_balance_at(cid,'418',e,'credit')-app.account_balance_at(cid,'418',e);
  o_retained:=app.account_balance_at(cid,'421',s,'credit')-app.account_balance_at(cid,'421',s);
  x_retained:=app.account_balance_at(cid,'421',e,'credit')-app.account_balance_at(cid,'421',e);
  select coalesce(amount,0) into x_pnl from app.report_b02_dnn(fy,e) where code='60';
  o_equity:=o_contributed+o_premium+o_other_capital+o_treasury+o_fx+o_owner_funds+o_retained;
  x_equity:=x_contributed+x_premium+x_other_capital+x_treasury+x_fx+x_owner_funds+x_retained+x_pnl;

  return query values
  ('100','TÀI SẢN NGẮN HẠN',o_cash+o_short+o_ar+o_adv+o_other_ar+o_inv+o_other_ca,x_cash+x_short+x_ar+x_adv+x_other_ar+x_inv+x_other_ca,0,true),
  ('110','Tiền và các khoản tương đương tiền',o_cash,x_cash,1,false),
  ('120','Đầu tư tài chính ngắn hạn',o_short,x_short,1,false),
  ('130','Các khoản phải thu ngắn hạn',o_ar+o_adv+o_other_ar,x_ar+x_adv+x_other_ar,1,false),
  ('131','Phải thu ngắn hạn của khách hàng',o_ar,x_ar,2,false),
  ('132','Trả trước cho người bán ngắn hạn',o_adv,x_adv,2,false),
  ('134','Phải thu ngắn hạn khác',o_other_ar,x_other_ar,2,false),
  ('140','Hàng tồn kho',o_inv,x_inv,1,false),
  ('150','Tài sản ngắn hạn khác',o_other_ca,x_other_ca,1,false),
  ('200','TÀI SẢN DÀI HẠN',o_fixed+o_ip+o_cip+o_long_inv+o_other_la,x_fixed+x_ip+x_cip+x_long_inv+x_other_la,0,true),
  ('220','Tài sản cố định',o_fixed,x_fixed,1,false),
  ('221','Nguyên giá tài sản cố định',o_fixed_gross,x_fixed_gross,2,false),
  ('222','Giá trị hao mòn lũy kế',o_fixed_dep,x_fixed_dep,2,false),
  ('230','Bất động sản đầu tư',o_ip,x_ip,1,false),
  ('231','Nguyên giá bất động sản đầu tư',o_ip_gross,x_ip_gross,2,false),
  ('232','Giá trị hao mòn lũy kế bất động sản đầu tư',o_ip_dep,x_ip_dep,2,false),
  ('240','Xây dựng cơ bản dở dang',o_cip,x_cip,1,false),
  ('250','Đầu tư tài chính dài hạn',o_long_inv,x_long_inv,1,false),
  ('260','Tài sản dài hạn khác',o_other_la,x_other_la,1,false),
  ('270','TỔNG CỘNG TÀI SẢN',o_cash+o_short+o_ar+o_adv+o_other_ar+o_inv+o_other_ca+o_fixed+o_ip+o_cip+o_long_inv+o_other_la,x_cash+x_short+x_ar+x_adv+x_other_ar+x_inv+x_other_ca+x_fixed+x_ip+x_cip+x_long_inv+x_other_la,0,true),
  ('300','NỢ PHẢI TRẢ',o_liab,x_liab,0,true),
  ('311','Phải trả người bán',o_trade,x_trade,1,false),
  ('312','Người mua trả tiền trước',o_customer_adv,x_customer_adv,1,false),
  ('313','Thuế và các khoản phải nộp Nhà nước',o_tax,x_tax,1,false),
  ('314','Phải trả người lao động',o_employee,x_employee,1,false),
  ('315','Phải trả khác',o_other_pay,x_other_pay,1,false),
  ('316','Vay và nợ thuê tài chính',o_loans,x_loans,1,false),
  ('317','Dự phòng phải trả',o_provisions,x_provisions,1,false),
  ('318','Quỹ khen thưởng, phúc lợi và quỹ khác',o_funds,x_funds,1,false),
  ('400','VỐN CHỦ SỞ HỮU',o_equity,x_equity,0,true),
  ('411','Vốn góp của chủ sở hữu',o_contributed,x_contributed,1,false),
  ('412','Thặng dư vốn cổ phần',o_premium,x_premium,1,false),
  ('413','Vốn khác của chủ sở hữu',o_other_capital,x_other_capital,1,false),
  ('414','Cổ phiếu quỹ',o_treasury,x_treasury,1,false),
  ('415','Chênh lệch tỷ giá hối đoái',o_fx,x_fx,1,false),
  ('416','Các quỹ thuộc vốn chủ sở hữu',o_owner_funds,x_owner_funds,1,false),
  ('417','Lợi nhuận sau thuế chưa phân phối',o_retained,x_retained+x_pnl,1,false),
  ('440','TỔNG CỘNG NGUỒN VỐN',o_liab+o_equity,x_liab+x_equity,0,true);
end $$;

create or replace function app.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language plpgsql stable security definer set search_path=public,app as $$
declare
  a bigint; s bigint; fixed_net bigint; ip_net bigint; cf_close bigint; ledger_close bigint;
  note_count int; direction_errors int;
begin
  select ending_amount into a from app.report_b01a_dnn(p_from,p_to) where code='270';
  select ending_amount into s from app.report_b01a_dnn(p_from,p_to) where code='440';
  select ending_amount into fixed_net from app.report_b01a_dnn(p_from,p_to) where code='220';
  select ending_amount into ip_net from app.report_b01a_dnn(p_from,p_to) where code='230';
  select amount into cf_close from app.report_b03_dnn(p_from,p_to) where code='70';
  ledger_close:=app.account_balance_at(app.current_company_id(),'111',p_to)+app.account_balance_at(app.current_company_id(),'112',p_to);
  select count(*) into note_count from app.report_b09_dnn(p_from,p_to) where status='approved';
  select count(*) into direction_errors
  from (
    select je.id,je.cash_flow_code,c.expected_direction,
      coalesce(sum(jl.debit-jl.credit) filter(where a.code like '111%' or a.code like '112%'),0)::bigint cash_net
    from journal_entries je
    join journal_lines jl on jl.entry_id=je.id
    join accounts a on a.id=jl.account_id
    left join cash_flow_codes c on c.code=je.cash_flow_code
    where je.company_id=app.current_company_id() and je.status='posted' and je.document_date between p_from and p_to
    group by je.id,je.cash_flow_code,c.expected_direction
  ) q
  where cash_net<>0 and (cash_flow_code is null or expected_direction is null
    or (expected_direction='inflow' and cash_net<=0)
    or (expected_direction='outflow' and cash_net>=0));

  return query values
    ('B01_BALANCE',a=s,format('Tài sản=%s; Nguồn vốn=%s',a,s)),
    ('B01_CLASSIFICATION',fixed_net>=0 and ip_net>=0,format('TSCĐ thuần=%s; BĐS đầu tư thuần=%s',fixed_net,ip_net)),
    ('F01_BALANCE',not exists(select 1 from app.report_f01_dnn(p_from,p_to) r where r.ending_debit<0 or r.ending_credit<0),'Số dư Nợ/Có không âm'),
    ('B03_RECONCILE',cf_close=ledger_close,format('B03=%s; Sổ cái 111/112=%s',cf_close,ledger_close)),
    ('B03_DIRECTION',direction_errors=0,format('Số chứng từ tiền sai/thiếu chiều mã LCTT: %s',direction_errors)),
    ('B09_COMPLETENESS',note_count=8,format('Đã phê duyệt %s/8 phần thuyết minh',note_count));
end $$;

comment on column public.accounts.balance_sheet_class is
'Explicit B01a-DNN classification. 242/244 default to noncurrent_other_asset; current classification requires accountant approval.';

-- ============================================================================
-- SOURCE: 056_production_financial_certification_v4538.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.38
-- Production financial certification: B09 segregation of duties, server-issued
-- statutory parity evidence and an enforceable go-live gate.

insert into public.schema_versions(version,description) values
('4.5.38','Production financial certification: controlled B09 workflow, cloud parity evidence and statutory release gate')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

insert into public.permissions(code,module,name,description,risk_level) values
('b09.prepare','accounting','Lập thuyết minh B09','Lập và xác nhận nội dung thuyết minh B09-DNN','sensitive'),
('b09.review','accounting','Soát xét thuyết minh B09','Soát xét độc lập nội dung B09-DNN','critical'),
('b09.approve','accounting','Phê duyệt thuyết minh B09','Phê duyệt cuối cùng B09-DNN bằng MFA AAL2','critical'),
('financial_reports.certify','reports','Chứng nhận BCTC Cloud','Chứng nhận đối chiếu engine trình duyệt với Supabase bằng MFA AAL2','critical')
on conflict(code) do update set module=excluded.module,name=excluded.name,description=excluded.description,risk_level=excluded.risk_level;

insert into public.role_permissions(role_id,permission_code)
select r.id,p.permission_code
from public.roles r
cross join lateral unnest(case r.code
  when 'ACCOUNTANT' then array['b09.prepare']::text[]
  when 'CHIEF_ACCOUNTANT' then array['b09.prepare','b09.review','financial_reports.certify']::text[]
  when 'DIRECTOR' then array['b09.approve','financial_reports.certify']::text[]
  else array[]::text[] end) p(permission_code)
where cardinality(case r.code
  when 'ACCOUNTANT' then array['b09.prepare']::text[]
  when 'CHIEF_ACCOUNTANT' then array['b09.prepare','b09.review','financial_reports.certify']::text[]
  when 'DIRECTOR' then array['b09.approve','financial_reports.certify']::text[]
  else array[]::text[] end)>0
on conflict(role_id,permission_code) do nothing;

create or replace function app.permission_is_privileged(p_permission text) returns boolean
language sql immutable
set search_path=pg_catalog,public,app as $$
  select p_permission in (
    'admin','accounting.post','accounting.close','accounting.period.lock',
    'users.manage','roles.manage','reports.import','backup.restore',
    'security.manage','release.approve','b09.review','b09.approve',
    'financial_reports.certify'
  )
$$;

alter table public.report_notes_tt133
  add column if not exists prepared_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists content_sha256 text,
  add column if not exists workflow_version bigint not null default 1;

create or replace function app.report_note_content_is_complete(p_content jsonb)
returns boolean language sql immutable set search_path=pg_catalog as $$
  select length(trim(case
    when p_content is null then ''
    when jsonb_typeof(p_content)='string' then p_content#>>'{}'
    when jsonb_typeof(p_content)='object' and p_content ? 'text' then coalesce(p_content->>'text','')
    else p_content::text
  end))>=20
$$;

-- Backfill historical rows before installing the authenticated workflow trigger.
update public.report_notes_tt133
set content_sha256=encode(digest(convert_to(content::text,'UTF8'),'sha256'),'hex')
where content_sha256 is null;

create or replace function app.enforce_b09_workflow() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  actor uuid:=app.current_user_id();
  old_status text:=case when tg_op='INSERT' then 'draft' else lower(coalesce(old.status,'draft')) end;
  target_status text:=lower(coalesce(new.status,'draft'));
  content_changed boolean:=case when tg_op='INSERT' then true else new.content is distinct from old.content or new.section_title is distinct from old.section_title end;
begin
  if actor is null then raise exception 'authenticated user required for B09 workflow' using errcode='42501'; end if;
  if new.company_id<>app.current_company_id() then raise exception 'company mismatch' using errcode='42501'; end if;
  if new.section_code not in ('I','II','III','IV','V','VI','VII','VIII') then raise exception 'invalid B09 section code' using errcode='22023'; end if;
  if new.period_from is null or new.period_to is null or new.period_from>new.period_to then raise exception 'invalid B09 reporting period' using errcode='22023'; end if;
  if target_status not in ('draft','prepared','reviewed','approved') then raise exception 'invalid B09 status' using errcode='22023'; end if;

  if tg_op='INSERT' then
    new.prepared_by:=null; new.reviewed_by:=null; new.approved_by:=null;
    new.prepared_at:=null; new.reviewed_at:=null; new.approved_at:=null;
    new.workflow_version:=greatest(1,coalesce(new.workflow_version,1));
  else
    -- Actor and timestamp columns are database-controlled and cannot be forged by a client.
    new.prepared_by:=old.prepared_by; new.reviewed_by:=old.reviewed_by; new.approved_by:=old.approved_by;
    new.prepared_at:=old.prepared_at; new.reviewed_at:=old.reviewed_at; new.approved_at:=old.approved_at;
    new.workflow_version:=old.workflow_version;
    if (old.status='approved') and (content_changed or new.period_from is distinct from old.period_from or new.period_to is distinct from old.period_to or new.section_code is distinct from old.section_code) then
      raise exception 'approved B09 note is immutable; reopen it to draft before editing' using errcode='55000';
    end if;
    if content_changed and old_status<>'draft' and target_status<>'draft' then
      raise exception 'B09 content may only be edited in draft status' using errcode='55000';
    end if;
  end if;

  if target_status<>old_status then
    if target_status='draft' then
      if old_status='prepared' and not app.has_permission('b09.prepare',new.company_id) then raise exception 'b09.prepare permission required' using errcode='42501'; end if;
      if old_status='reviewed' and not app.has_permission('b09.review',new.company_id) then raise exception 'b09.review permission required' using errcode='42501'; end if;
      if old_status='approved' then
        if not app.has_permission('b09.approve',new.company_id) then raise exception 'b09.approve permission required' using errcode='42501'; end if;
        if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to reopen approved B09' using errcode='42501'; end if;
      end if;
      new.prepared_by:=null; new.reviewed_by:=null; new.approved_by:=null;
      new.prepared_at:=null; new.reviewed_at:=null; new.approved_at:=null;
      new.workflow_version:=coalesce(old.workflow_version,1)+1;
    elsif target_status='prepared' then
      if old_status<>'draft' then raise exception 'B09 transition must be draft -> prepared' using errcode='55000'; end if;
      if not app.has_permission('b09.prepare',new.company_id) then raise exception 'b09.prepare permission required' using errcode='42501'; end if;
      if not app.report_note_content_is_complete(new.content) then raise exception 'B09 content is incomplete' using errcode='22023'; end if;
      new.prepared_by:=actor; new.prepared_at:=clock_timestamp();
      new.reviewed_by:=null; new.reviewed_at:=null; new.approved_by:=null; new.approved_at:=null;
    elsif target_status='reviewed' then
      if old_status<>'prepared' then raise exception 'B09 transition must be prepared -> reviewed' using errcode='55000'; end if;
      if not app.has_permission('b09.review',new.company_id) then raise exception 'b09.review permission required' using errcode='42501'; end if;
      if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to review B09' using errcode='42501'; end if;
      if old.prepared_by is null or old.prepared_by=actor then raise exception 'B09 reviewer must differ from preparer' using errcode='42501'; end if;
      if not app.report_note_content_is_complete(new.content) then raise exception 'B09 content is incomplete' using errcode='22023'; end if;
      new.reviewed_by:=actor; new.reviewed_at:=clock_timestamp();
      new.approved_by:=null; new.approved_at:=null;
    elsif target_status='approved' then
      if old_status<>'reviewed' then raise exception 'B09 transition must be reviewed -> approved' using errcode='55000'; end if;
      if not app.has_permission('b09.approve',new.company_id) then raise exception 'b09.approve permission required' using errcode='42501'; end if;
      if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to approve B09' using errcode='42501'; end if;
      if old.prepared_by is null or old.reviewed_by is null then raise exception 'B09 preparation and review evidence is incomplete' using errcode='55000'; end if;
      if actor=old.prepared_by or actor=old.reviewed_by then raise exception 'B09 approver must differ from preparer and reviewer' using errcode='42501'; end if;
      if not app.report_note_content_is_complete(new.content) then raise exception 'B09 content is incomplete' using errcode='22023'; end if;
      new.approved_by:=actor; new.approved_at:=clock_timestamp();
    end if;
  elsif tg_op='UPDATE' and content_changed and target_status='draft' then
    new.prepared_by:=null; new.reviewed_by:=null; new.approved_by:=null;
    new.prepared_at:=null; new.reviewed_at:=null; new.approved_at:=null;
    new.workflow_version:=coalesce(old.workflow_version,1)+1;
  end if;

  new.status:=target_status;
  new.content_sha256:=encode(digest(convert_to(new.content::text,'UTF8'),'sha256'),'hex');
  return new;
end $$;

drop trigger if exists trg_b09_workflow_v4538 on public.report_notes_tt133;
create trigger trg_b09_workflow_v4538
before insert or update on public.report_notes_tt133
for each row execute function app.enforce_b09_workflow();

create or replace function app.report_b09_certification(p_from date,p_to date)
returns table(
  section_code text,section_title text,status text,content jsonb,content_sha256 text,
  prepared_by uuid,prepared_at timestamptz,reviewed_by uuid,reviewed_at timestamptz,
  approved_by uuid,approved_at timestamptz,workflow_version bigint,workflow_complete boolean
)
language sql stable security definer set search_path=pg_catalog,public,app as $$
with access as (select app.assert_company_access(app.current_company_id())),
required(section_code,section_title,sort_order) as (values
 ('I','Đặc điểm hoạt động của doanh nghiệp',1),
 ('II','Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán',2),
 ('III','Chuẩn mực và chế độ kế toán áp dụng',3),
 ('IV','Các chính sách kế toán áp dụng',4),
 ('V','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính',5),
 ('VI','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh',6),
 ('VII','Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ',7),
 ('VIII','Những thông tin khác',8)
)
select r.section_code,r.section_title,coalesce(n.status,'draft'),coalesce(n.content,'{}'::jsonb),n.content_sha256,
  n.prepared_by,n.prepared_at,n.reviewed_by,n.reviewed_at,n.approved_by,n.approved_at,coalesce(n.workflow_version,1),
  (n.status='approved' and app.report_note_content_is_complete(n.content)
    and n.content_sha256 is not null and n.prepared_by is not null and n.reviewed_by is not null and n.approved_by is not null
    and n.prepared_at is not null and n.reviewed_at is not null and n.approved_at is not null
    and n.prepared_by<>n.reviewed_by and n.prepared_by<>n.approved_by and n.reviewed_by<>n.approved_by) as workflow_complete
from access cross join required r left join public.report_notes_tt133 n
 on n.company_id=app.current_company_id() and n.period_from=p_from and n.period_to=p_to and n.section_code=r.section_code
order by r.sort_order
$$;
revoke all on function app.report_b09_certification(date,date) from public,anon,authenticated;

-- Supabase JavaScript uses the public PostgREST schema by default. These narrow wrappers
-- expose only tenant-scoped, security-definer report functions; the app implementations remain private.
create or replace function public.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint,level int,is_total boolean)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b01a_dnn(p_from,p_to)
$$;
create or replace function public.report_b02_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b02_dnn(p_from,p_to)
$$;
create or replace function public.report_b03_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint,level int,is_total boolean)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b03_dnn(p_from,p_to)
$$;
create or replace function public.report_b09_certification(p_from date,p_to date)
returns table(
  section_code text,section_title text,status text,content jsonb,content_sha256 text,
  prepared_by uuid,prepared_at timestamptz,reviewed_by uuid,reviewed_at timestamptz,
  approved_by uuid,approved_at timestamptz,workflow_version bigint,workflow_complete boolean
) language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b09_certification(p_from,p_to)
$$;
create or replace function public.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.validate_tt133_report_set(p_from,p_to)
$$;
revoke all on function public.report_b01a_dnn(date,date),public.report_b02_dnn(date,date),public.report_b03_dnn(date,date),public.report_b09_certification(date,date),public.validate_tt133_report_set(date,date) from public,anon;
grant execute on function public.report_b01a_dnn(date,date),public.report_b02_dnn(date,date),public.report_b03_dnn(date,date),public.report_b09_certification(date,date),public.validate_tt133_report_set(date,date) to authenticated;

create table if not exists public.statutory_report_certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  release_version text not null,
  formula_version text not null,
  migration_version integer not null,
  b01_sha256 text not null,
  b02_sha256 text not null,
  b03_sha256 text not null,
  b09_sha256 text not null,
  validation_checks jsonb not null default '[]'::jsonb,
  b09_approved_count integer not null default 0,
  status text not null default 'active' check(status in ('active','revoked','expired')),
  certified_by uuid not null,
  certified_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp()+interval '24 hours'),
  revoked_at timestamptz,
  revocation_reason text
);
create index if not exists ix_statutory_certification_lookup_v4538
  on public.statutory_report_certifications(company_id,period_from,period_to,release_version,certified_at desc);
create unique index if not exists ux_statutory_certification_active_v4538
  on public.statutory_report_certifications(company_id,period_from,period_to,release_version) where status='active';
alter table public.statutory_report_certifications enable row level security;
select app.drop_all_policies('statutory_report_certifications');
create policy statutory_cert_read_v4538 on public.statutory_report_certifications for select
  using(app.is_company_member(company_id));
revoke all on public.statutory_report_certifications from public,anon,authenticated;
grant select on public.statutory_report_certifications to authenticated;
grant all on public.statutory_report_certifications to service_role;

create or replace function app.report_rows_sha256(p_report text,p_from date,p_to date)
returns text language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare canonical text;
begin
  if p_report='B01' then
    select replace(jsonb_agg(jsonb_build_array(code,opening_amount,ending_amount) order by code)::text,', ',',') into canonical
    from app.report_b01a_dnn(p_from,p_to);
  elsif p_report='B02' then
    select replace(jsonb_agg(jsonb_build_array(code,amount) order by code)::text,', ',',') into canonical
    from app.report_b02_dnn(p_from,p_to);
  elsif p_report='B03' then
    select replace(jsonb_agg(jsonb_build_array(code,amount) order by code)::text,', ',',') into canonical
    from app.report_b03_dnn(p_from,p_to);
  elsif p_report='B09' then
    select replace(jsonb_agg(jsonb_build_array(section_code,status,coalesce(content_sha256,''),coalesce(prepared_by::text,''),coalesce(reviewed_by::text,''),coalesce(approved_by::text,''),workflow_version) order by section_code)::text,', ',',') into canonical
    from app.report_b09_certification(p_from,p_to);
  else raise exception 'unsupported report hash %',p_report using errcode='22023';
  end if;
  return encode(digest(convert_to(coalesce(canonical,'[]'),'UTF8'),'sha256'),'hex');
end $$;

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.38' or p_migration_version<>56 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed)
    into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;

  server_b01:=app.report_rows_sha256('B01',p_from,p_to);
  server_b02:=app.report_rows_sha256('B02',p_from,p_to);
  server_b03:=app.report_rows_sha256('B03',p_from,p_to);
  server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then
    raise exception 'browser and Supabase report hashes differ' using errcode='55000';
  end if;

  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded'
  where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';

  insert into public.statutory_report_certifications(
    company_id,period_from,period_to,release_version,formula_version,migration_version,
    b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at
  ) values(
    cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,
    server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours'
  ) returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));
  return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256)
$$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;
revoke all on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon,authenticated;

create or replace function app.revoke_statutory_certifications() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare cid uuid; source_id uuid;
begin
  if tg_table_name='cash_flow_codes' then
    update public.statutory_report_certifications
      set status='revoked',revoked_at=clock_timestamp(),revocation_reason='shared report mapping changed: cash_flow_codes'
    where status='active';
  else
    if tg_table_name='journal_lines' then
      source_id:=case when tg_op='DELETE' then old.entry_id else new.entry_id end;
      select je.company_id into cid from public.journal_entries je where je.id=source_id;
    elsif tg_table_name='companies' then
      cid:=case when tg_op='DELETE' then old.id else new.id end;
    else
      cid:=case when tg_op='DELETE' then old.company_id else new.company_id end;
    end if;
    if cid is not null then
      update public.statutory_report_certifications
        set status='revoked',revoked_at=clock_timestamp(),revocation_reason='source data changed: '||tg_table_name
      where company_id=cid and status='active';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['journal_entries','journal_lines','accounts','opening_balances','report_notes_tt133','companies','cash_flow_codes'] loop
    execute format('drop trigger if exists trg_revoke_statutory_cert_%I_v4538 on public.%I',t,t);
    execute format('create trigger trg_revoke_statutory_cert_%I_v4538 after insert or update or delete on public.%I for each row execute function app.revoke_statutory_certifications()',t,t);
  end loop;
end $$;

create or replace function app.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language plpgsql stable security definer set search_path=public,app as $$
declare
  a bigint; s bigint; fixed_net bigint; ip_net bigint; cf_close bigint; ledger_close bigint;
  note_count int; direction_errors int;
begin
  select ending_amount into a from app.report_b01a_dnn(p_from,p_to) where code='270';
  select ending_amount into s from app.report_b01a_dnn(p_from,p_to) where code='440';
  select ending_amount into fixed_net from app.report_b01a_dnn(p_from,p_to) where code='220';
  select ending_amount into ip_net from app.report_b01a_dnn(p_from,p_to) where code='230';
  select amount into cf_close from app.report_b03_dnn(p_from,p_to) where code='70';
  ledger_close:=app.account_balance_at(app.current_company_id(),'111',p_to)+app.account_balance_at(app.current_company_id(),'112',p_to);
  select count(*) into note_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  select count(*) into direction_errors
  from (
    select je.id,je.cash_flow_code,c.expected_direction,
      coalesce(sum(jl.debit-jl.credit) filter(where a.code like '111%' or a.code like '112%'),0)::bigint cash_net
    from journal_entries je
    join journal_lines jl on jl.entry_id=je.id
    join accounts a on a.id=jl.account_id
    left join cash_flow_codes c on c.code=je.cash_flow_code
    where je.company_id=app.current_company_id() and je.status='posted' and je.document_date between p_from and p_to
    group by je.id,je.cash_flow_code,c.expected_direction
  ) q
  where cash_net<>0 and (cash_flow_code is null or expected_direction is null
    or (expected_direction='inflow' and cash_net<=0)
    or (expected_direction='outflow' and cash_net>=0));

  return query values
    ('B01_BALANCE',coalesce(a=s,false),format('Tài sản=%s; Nguồn vốn=%s',a,s)),
    ('B01_CLASSIFICATION',coalesce(fixed_net>=0 and ip_net>=0,false),format('TSCĐ thuần=%s; BĐS đầu tư thuần=%s',fixed_net,ip_net)),
    ('F01_BALANCE',not exists(select 1 from app.report_f01_dnn(p_from,p_to) r where r.ending_debit<0 or r.ending_credit<0),'Số dư Nợ/Có không âm'),
    ('B03_RECONCILE',coalesce(cf_close=ledger_close,false),format('B03=%s; Sổ cái 111/112=%s',cf_close,ledger_close)),
    ('B03_DIRECTION',direction_errors=0,format('Số chứng từ tiền sai/thiếu chiều mã LCTT: %s',direction_errors)),
    ('B09_WORKFLOW',note_count=8,format('Đã hoàn tất lập-soát xét-phê duyệt độc lập %s/8 phần B09',note_count));
end $$;

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
    ('secret_scan','Quét secret và cấu hình phát hành',true,interval '30 days'),
    ('financial_statutory','BCTC Cloud khớp và B09 đủ ba cấp phê duyệt',true,interval '24 hours')
$$;

comment on table public.statutory_report_certifications is
'Server-issued evidence that B01/B02/B03 browser hashes match Supabase and B09 has eight independently approved sections. Any source-data write revokes active evidence.';

-- ============================================================================
-- SOURCE: 057_company_profile_dynamic_reporting_period_v4539.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.39
-- Company profile propagation and dynamic reporting-period release binding.

insert into public.schema_versions(version,description) values
('4.5.39','Company profile propagation, automatic current-year reporting period and statutory certification release binding')
on conflict(version) do update set description=excluded.description;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.39'
where status='active' and release_version<>'4.5.39';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.39' or p_migration_version<>57 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed)
    into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;

  server_b01:=app.report_rows_sha256('B01',p_from,p_to);
  server_b02:=app.report_rows_sha256('B02',p_from,p_to);
  server_b03:=app.report_rows_sha256('B03',p_from,p_to);
  server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then
    raise exception 'browser and Supabase report hashes differ' using errcode='55000';
  end if;

  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded'
  where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';

  insert into public.statutory_report_certifications(
    company_id,period_from,period_to,release_version,formula_version,migration_version,
    b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at
  ) values(
    cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,
    server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours'
  ) returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));
  return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256)
$$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;
revoke all on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon,authenticated;

comment on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) is
'Certifies TT133 statutory reports for ALPHA DESIGN ERP Cloud v4.5.39 / migration 057 after live Cloud parity and B09 approval.';

-- ============================================================================
-- SOURCE: 058_statutory_template_manager_filter_chart_tax_v4540.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.40
-- Statutory template manager, persistent UI filters, manual CIT field refinement and headcount chart correction.

insert into public.schema_versions(version,description) values
('4.5.40','Versioned statutory report template packages, persistent filters, manual CIT UI refinement and headcount chart correction')
on conflict(version) do update set description=excluded.description;

create table if not exists public.statutory_report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id text not null,
  template_name text not null,
  version text not null,
  accounting_regime text not null,
  effective_from date not null,
  legal_reference text,
  package_sha256 text not null check(package_sha256 ~ '^[0-9a-f]{64}$'),
  package jsonb not null,
  status text not null default 'candidate' check(status in ('candidate','active','inactive','rejected')),
  imported_by uuid not null default auth.uid(),
  imported_at timestamptz not null default clock_timestamp(),
  activated_by uuid,
  activated_at timestamptz,
  row_version bigint not null default 1,
  unique(company_id,template_id,version),
  unique(company_id,package_sha256)
);

alter table public.statutory_report_templates enable row level security;
drop policy if exists statutory_report_templates_select on public.statutory_report_templates;
create policy statutory_report_templates_select on public.statutory_report_templates for select
using(app.is_company_member(company_id) and app.has_permission('accounting.read',company_id));
drop policy if exists statutory_report_templates_insert on public.statutory_report_templates;
create policy statutory_report_templates_insert on public.statutory_report_templates for insert
with check(company_id=app.current_company_id() and app.has_permission('reports.import',company_id));
drop policy if exists statutory_report_templates_update on public.statutory_report_templates;
create policy statutory_report_templates_update on public.statutory_report_templates for update
using(company_id=app.current_company_id() and app.has_permission('reports.import',company_id))
with check(company_id=app.current_company_id());
revoke all on public.statutory_report_templates from public,anon;
grant select,insert,update on public.statutory_report_templates to authenticated;

create index if not exists idx_statutory_report_templates_company_status
on public.statutory_report_templates(company_id,status,effective_from desc);

create or replace function app.activate_statutory_report_template(p_template_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare cid uuid:=app.current_company_id(); target public.statutory_report_templates; old_row jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('reports.import',cid) then raise exception 'reports.import permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to activate statutory templates' using errcode='42501'; end if;
  select * into target from public.statutory_report_templates where id=p_template_id and company_id=cid for update;
  if target.id is null then raise exception 'statutory template not found' using errcode='P0002'; end if;
  old_row:=to_jsonb(target);
  update public.statutory_report_templates set status='inactive',row_version=row_version+1
  where company_id=cid and status='active' and id<>p_template_id;
  update public.statutory_report_templates set status='active',activated_by=app.current_user_id(),activated_at=clock_timestamp(),row_version=row_version+1
  where id=p_template_id returning * into target;
  perform app.append_audit(cid,'statutory_report_templates',target.id::text,'ACTIVATE',old_row,to_jsonb(target));
  return to_jsonb(target);
end $$;

create or replace function public.activate_statutory_report_template(p_template_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.activate_statutory_report_template(p_template_id)
$$;
revoke all on function public.activate_statutory_report_template(uuid) from public,anon;
grant execute on function public.activate_statutory_report_template(uuid) to authenticated;
revoke all on function app.activate_statutory_report_template(uuid) from public,anon,authenticated;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.40'
where status='active' and release_version<>'4.5.40';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.40' or p_migration_version<>58 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed)
    into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;

  server_b01:=app.report_rows_sha256('B01',p_from,p_to);
  server_b02:=app.report_rows_sha256('B02',p_from,p_to);
  server_b03:=app.report_rows_sha256('B03',p_from,p_to);
  server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then
    raise exception 'browser and Supabase report hashes differ' using errcode='55000';
  end if;

  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded'
  where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';

  insert into public.statutory_report_certifications(
    company_id,period_from,period_to,release_version,formula_version,migration_version,
    b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at
  ) values(
    cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,
    server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours'
  ) returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));
  return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256)
$$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;
revoke all on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon,authenticated;

comment on table public.statutory_report_templates is
'Checksum-versioned statutory presentation packages. Imported packages may change titles, row labels/order, note references and print layout; calculation formulas remain controlled by Calculation Core.';
comment on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) is
'Certifies TT133 statutory reports for ALPHA DESIGN ERP Cloud v4.5.40 / migration 058 after live Cloud parity and B09 approval.';

-- ============================================================================
-- SOURCE: 059_stability_browser_qa_data_quality_v4541.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.41
-- Browser audit closure, VAT table fit and production certification rebinding.

insert into public.schema_versions(version,description) values
('4.5.41','Browser audit closure, VAT table fit, QA module loading and demo data-quality hardening')
on conflict(version) do update set description=excluded.description;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.41'
where status='active' and release_version<>'4.5.41';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.41' or p_migration_version<>59 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed)
    into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;

  server_b01:=app.report_rows_sha256('B01',p_from,p_to);
  server_b02:=app.report_rows_sha256('B02',p_from,p_to);
  server_b03:=app.report_rows_sha256('B03',p_from,p_to);
  server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then
    raise exception 'browser and Supabase report hashes differ' using errcode='55000';
  end if;

  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded'
  where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';

  insert into public.statutory_report_certifications(
    company_id,period_from,period_to,release_version,formula_version,migration_version,
    b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at
  ) values(
    cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,
    server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours'
  ) returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));
  return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256)
$$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;
revoke all on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon,authenticated;

comment on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) is
'Certifies TT133 statutory reports for ALPHA DESIGN ERP Cloud v4.5.41 / migration 059 after live Cloud parity and B09 approval.';

-- ============================================================================
-- SOURCE: 060_detailed_employee_payroll_v4542.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.42
-- Detailed employee payroll, immutable approval workflow and reporting view.

insert into public.schema_versions(version,description) values
('4.5.42','Detailed employee payroll by period and employee, timesheet linkage, deductions, PIT, employer cost and project recovery')
on conflict(version) do update set description=excluded.description;


-- The browser sync stream keeps payroll data available offline and uses the same
-- optimistic-concurrency contract as other operational collections.
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
    when p_collection in ('payrollPeriods','payrollItems')
      then case when p_write then 'payroll.write' else 'payroll.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','accountingPeriods','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection in ('documents')
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings' then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system' then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

alter function app.validate_entity_payload(uuid,text,text,jsonb) rename to validate_entity_payload_pre_v4542;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare status_value text; gross numeric; deductions numeric;
begin
  if p_collection='payrollPeriods' then
    perform app.assert_required_text(p_payload,'payrollPeriods.periodCode',120,'periodCode','period_code');
    perform app.assert_json_month(p_payload,'payrollPeriods.month',true,'month','monthKey','month_key');
    perform app.assert_json_date(p_payload,'payrollPeriods.dateFrom',true,'dateFrom','date_from');
    perform app.assert_json_date(p_payload,'payrollPeriods.dateTo',true,'dateTo','date_to');
    status_value:=lower(app.assert_required_text(p_payload,'payrollPeriods.status',30,'status'));
    if status_value not in ('draft','reviewed','approved','locked','open','calculating','posted') then
      raise exception 'INVALID_ENUM: payrollPeriods.status' using errcode='22023';
    end if;
    return;
  elsif p_collection='payrollItems' then
    perform app.assert_entity_ref(p_company,'payrollPeriods',app.json_text(p_payload,'payrollPeriodId','payroll_period_id'),true,'payrollItems.payrollPeriodId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'personId','employeeId','employee_id'),true,'payrollItems.personId');
    perform app.assert_json_number(p_payload,'payrollItems.unpaidLeaveDays',0,31,false,'unpaidLeaveDays','unpaid_leave_days');
    perform app.assert_json_number(p_payload,'payrollItems.allowances',0,null::numeric,false,'allowances');
    perform app.assert_json_number(p_payload,'payrollItems.overtimePay',0,null::numeric,false,'overtimePay','overtime');
    perform app.assert_json_number(p_payload,'payrollItems.bonus',0,null::numeric,false,'bonus');
    perform app.assert_json_number(p_payload,'payrollItems.otherIncome',0,null::numeric,false,'otherIncome','other_income');
    perform app.assert_json_number(p_payload,'payrollItems.employeeInsurance',0,null::numeric,false,'employeeInsurance','employee_insurance');
    perform app.assert_json_number(p_payload,'payrollItems.employerInsurance',0,null::numeric,false,'employerInsurance','employer_insurance');
    perform app.assert_json_number(p_payload,'payrollItems.personalIncomeTax',0,null::numeric,false,'personalIncomeTax','personal_income_tax');
    perform app.assert_json_number(p_payload,'payrollItems.advanceDeduction',0,null::numeric,false,'advanceDeduction','advance_deduction');
    perform app.assert_json_number(p_payload,'payrollItems.otherDeductions',0,null::numeric,false,'otherDeductions','other_deductions');
    gross:=coalesce(app.json_number(p_payload,'grossIncome','gross_income'),0);
    deductions:=coalesce(app.json_number(p_payload,'employeeInsurance','employee_insurance'),0)+coalesce(app.json_number(p_payload,'personalIncomeTax','personal_income_tax'),0)+coalesce(app.json_number(p_payload,'advanceDeduction','advance_deduction'),0)+coalesce(app.json_number(p_payload,'otherDeductions','other_deductions'),0);
    if gross>0 and deductions>gross then raise exception 'NEGATIVE_NET_PAY: deductions exceed gross income' using errcode='23514'; end if;
    return;
  end if;
  perform app.validate_entity_payload_pre_v4542(p_company,p_collection,p_record_id,p_payload);
end $$;

revoke all on function app.validate_entity_payload_pre_v4542(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

alter table public.payroll_periods
  add column if not exists month_key text,
  add column if not exists prepared_by uuid,
  add column if not exists prepared_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists locked_at timestamptz,
  add column if not exists calculation_version text not null default 'ALPHA-PAYROLL-4.5.42',
  add column if not exists workflow_history jsonb not null default '[]'::jsonb;

update public.payroll_periods
set month_key=to_char(date_from,'YYYY-MM')
where month_key is null or month_key='';

alter table public.payroll_items
  add column if not exists standard_workdays numeric(8,2) not null default 0,
  add column if not exists payable_workdays numeric(8,2) not null default 0,
  add column if not exists unpaid_leave_days numeric(8,2) not null default 0,
  add column if not exists approved_hours numeric(10,2) not null default 0,
  add column if not exists billable_hours numeric(10,2) not null default 0,
  add column if not exists base_salary bigint not null default 0,
  add column if not exists bonus bigint not null default 0,
  add column if not exists other_income bigint not null default 0,
  add column if not exists advance_deduction bigint not null default 0,
  add column if not exists project_allocated_cost bigint not null default 0,
  add column if not exists recoverable_revenue bigint not null default 0,
  add column if not exists utilization_percent numeric(9,4) not null default 0,
  add column if not exists chargeability_percent numeric(9,4) not null default 0,
  add column if not exists recovery_ratio_percent numeric(9,4) not null default 0,
  add column if not exists pit_mode text not null default 'Manual review',
  add column if not exists notes text not null default '',
  add column if not exists calculation_version text not null default 'ALPHA-PAYROLL-4.5.42';

do $$ begin
  alter table public.payroll_items add constraint payroll_items_v4542_nonnegative check(
    standard_workdays>=0 and payable_workdays>=0 and unpaid_leave_days>=0 and approved_hours>=0 and billable_hours>=0
    and base_salary>=0 and bonus>=0 and other_income>=0 and advance_deduction>=0
    and project_allocated_cost>=0 and recoverable_revenue>=0 and utilization_percent>=0
    and chargeability_percent>=0 and recovery_ratio_percent>=0
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.payroll_items add constraint payroll_items_v4542_days_valid check(payable_workdays<=standard_workdays and unpaid_leave_days<=standard_workdays);
exception when duplicate_object then null; end $$;

create or replace function app.guard_payroll_item_mutation_v4542()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare period_status text;
begin
  select status into period_status from public.payroll_periods where id=coalesce(new.payroll_period_id,old.payroll_period_id);
  if period_status in ('approved','posted','locked') then
    raise exception 'payroll period is immutable after approval' using errcode='55000';
  end if;
  if tg_op<>'DELETE' then
    if coalesce(new.base_salary,0)+coalesce(new.allowances,0)+coalesce(new.overtime,0)+coalesce(new.bonus,0)+coalesce(new.other_income,0)
       < coalesce(new.employee_insurance,0)+coalesce(new.personal_income_tax,0)+coalesce(new.advance_deduction,0)+coalesce(new.other_deductions,0) then
      raise exception 'payroll net pay cannot be negative' using errcode='23514';
    end if;
    new.calculation_version='ALPHA-PAYROLL-4.5.42';
    new.updated_at=clock_timestamp();
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists trg_guard_payroll_item_mutation_v4542 on public.payroll_items;
create trigger trg_guard_payroll_item_mutation_v4542
before insert or update or delete on public.payroll_items
for each row execute function app.guard_payroll_item_mutation_v4542();

create or replace function app.guard_payroll_period_workflow_v4542()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app as $$
begin
  if tg_op='UPDATE' and new.status is distinct from old.status then
    if not ((old.status in ('open','calculating') and new.status='reviewed') or
            (old.status='reviewed' and new.status='approved') or
            (old.status='approved' and new.status in ('posted','locked')) or
            (old.status='posted' and new.status='locked')) then
      raise exception 'invalid payroll workflow transition: % -> %',old.status,new.status using errcode='22023';
    end if;
    if new.status='reviewed' then
      new.reviewed_by=coalesce(new.reviewed_by,app.current_user_id());new.reviewed_at=coalesce(new.reviewed_at,clock_timestamp());
    elsif new.status='approved' then
      if old.reviewed_by is not null and old.reviewed_by=coalesce(new.approved_by,app.current_user_id()) then raise exception 'payroll approver must differ from reviewer' using errcode='42501'; end if;
      new.approved_by=coalesce(new.approved_by,app.current_user_id());new.approved_at=coalesce(new.approved_at,clock_timestamp());
    elsif new.status='locked' then
      new.locked_by=coalesce(new.locked_by,app.current_user_id());new.locked_at=coalesce(new.locked_at,clock_timestamp());
    end if;
    new.workflow_history=coalesce(old.workflow_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('action',upper(new.status),'at',clock_timestamp(),'by',app.current_user_id()));
  end if;
  new.month_key=coalesce(nullif(new.month_key,''),to_char(new.date_from,'YYYY-MM'));
  new.calculation_version='ALPHA-PAYROLL-4.5.42';new.updated_at=clock_timestamp();
  return new;
end $$;

drop trigger if exists trg_guard_payroll_period_workflow_v4542 on public.payroll_periods;
create trigger trg_guard_payroll_period_workflow_v4542
before insert or update on public.payroll_periods
for each row execute function app.guard_payroll_period_workflow_v4542();

create or replace view public.v_payroll_employee_detail_v4542
with (security_invoker=true) as
select
  pp.company_id,pp.id payroll_period_id,pp.period_code,pp.month_key,pp.date_from,pp.date_to,pp.status period_status,
  pi.id payroll_item_id,pi.employee_id,e.employee_no employee_code,e.full_name,d.name department,e.job_title,e.employment_type,
  pi.standard_workdays,pi.payable_workdays,pi.unpaid_leave_days,pi.approved_hours,pi.billable_hours,
  pi.base_salary,pi.allowances,pi.overtime overtime_pay,pi.bonus,pi.other_income,
  (pi.base_salary+pi.allowances+pi.overtime+pi.bonus+pi.other_income) gross_income,
  pi.employee_insurance,pi.personal_income_tax,pi.advance_deduction,pi.other_deductions,
  (pi.base_salary+pi.allowances+pi.overtime+pi.bonus+pi.other_income-pi.employee_insurance-pi.personal_income_tax-pi.advance_deduction-pi.other_deductions) net_pay,
  pi.employer_insurance,
  (pi.base_salary+pi.allowances+pi.overtime+pi.bonus+pi.other_income+pi.employer_insurance) total_employer_cost,
  pi.project_allocated_cost,pi.recoverable_revenue,pi.utilization_percent,pi.chargeability_percent,pi.recovery_ratio_percent,
  pi.pit_mode,pi.notes,pi.calculation_version,pi.updated_at
from public.payroll_items pi
join public.payroll_periods pp on pp.id=pi.payroll_period_id
join public.employees e on e.id=pi.employee_id and e.company_id=pi.company_id
left join public.departments d on d.id=e.department_id and d.company_id=e.company_id;

grant select on public.v_payroll_employee_detail_v4542 to authenticated;

-- Rebind statutory certification to the current release and migration.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.42'
where status='active' and release_version<>'4.5.42';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.42' or p_migration_version<>60 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 061_payroll_header_layout_refinement_v4543.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.43
-- Payroll header layout refinement and statutory certification release binding.

insert into public.schema_versions(version,description) values
('4.5.43','Payroll detailed-table header layout refinement; all 25 headings readable and responsive')
on conflict(version) do update set description=excluded.description;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.43'
where status='active' and release_version<>'4.5.43';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.43' or p_migration_version<>61 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 062_global_table_grid_alignment_v4544.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.44
-- Exact global table column-grid alignment and statutory certification release binding.

insert into public.schema_versions(version,description) values
('4.5.44','Exact global table column-grid alignment across all modules and responsive viewports')
on conflict(version) do update set description=excluded.description;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.44'
where status='active' and release_version<>'4.5.44';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.44' or p_migration_version<>62 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 063_annual_bonus_travel_fund_v4545.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.45
-- Annual 13th-month bonus and travel welfare budget planning.

insert into public.schema_versions(version,description) values
('4.5.45','Annual 13th-month bonus and travel welfare budget, payroll linkage, welfare ceiling control and approval workflow')
on conflict(version) do update set description=excluded.description;

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
    when p_collection in ('payrollPeriods','payrollItems','annualBenefitBudgets')
      then case when p_write then 'payroll.write' else 'payroll.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','accountingPeriods','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection in ('documents')
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings' then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system' then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

alter function app.validate_entity_payload(uuid,text,text,jsonb) rename to validate_entity_payload_pre_v4545;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare status_value text; year_value numeric;
begin
  if p_collection='annualBenefitBudgets' then
    year_value:=app.assert_json_number(p_payload,'annualBenefitBudgets.year',2000,2200,true,'year');
    status_value:=lower(app.assert_required_text(p_payload,'annualBenefitBudgets.status',30,'status'));
    if status_value not in ('draft','reviewed','approved','locked') then
      raise exception 'INVALID_ENUM: annualBenefitBudgets.status' using errcode='22023';
    end if;
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.minimumServiceDays',0,366,false,'minimumServiceDays','minimum_service_days');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.companyPerformanceFactor',0,2,false,'companyPerformanceFactor','company_performance_factor');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.defaultEmployeePerformanceFactor',0,2,false,'defaultEmployeePerformanceFactor','default_employee_performance_factor');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.bonusTaxProvisionRate',0,99,false,'bonusTaxProvisionRate','bonus_tax_provision_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.bonusContingencyRate',0,100,false,'bonusContingencyRate','bonus_contingency_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelParticipationRate',0,100,false,'travelParticipationRate','travel_participation_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelCostPerPerson',0,null::numeric,false,'travelCostPerPerson','travel_cost_per_person');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelCommonCost',0,null::numeric,false,'travelCommonCost','travel_common_cost');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelContingencyRate',0,100,false,'travelContingencyRate','travel_contingency_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.otherWelfareSpent',0,null::numeric,false,'otherWelfareSpent','other_welfare_spent');
    if coalesce(app.json_text(p_payload,'bonusPaymentMode','bonus_payment_mode'),'Gross') not in ('Gross','Net') then
      raise exception 'INVALID_ENUM: annualBenefitBudgets.bonusPaymentMode' using errcode='22023';
    end if;
    return;
  end if;
  perform app.validate_entity_payload_pre_v4545(p_company,p_collection,p_record_id,p_payload);
end $$;

revoke all on function app.validate_entity_payload_pre_v4545(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

create or replace function app.guard_annual_benefit_budget_entity_v4545()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare old_status text; new_status text; actor uuid:=app.current_user_id();
begin
  if new.collection<>'annualBenefitBudgets' or new.deleted_at is not null then return new; end if;
  new_status:=lower(coalesce(new.data->>'status','draft'));
  if tg_op='INSERT' then
    if new_status<>'draft' then raise exception 'Annual benefit budget must be created in Draft status' using errcode='23514'; end if;
    return new;
  end if;
  old_status:=lower(coalesce(old.data->>'status','draft'));
  if old_status='locked' and new.data is distinct from old.data then
    raise exception 'Locked annual benefit budget is immutable' using errcode='55000';
  end if;
  if old_status<>new_status then
    if not ((old_status='draft' and new_status='reviewed') or (old_status='reviewed' and new_status='approved') or (old_status='approved' and new_status='locked')) then
      raise exception 'Invalid annual benefit budget transition % -> %',old_status,new_status using errcode='23514';
    end if;
    if new_status in ('approved','locked') then
      if not app.has_permission('payroll.approve',new.company_id) then raise exception 'payroll.approve permission required' using errcode='42501'; end if;
      if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required for annual benefit approval/lock' using errcode='42501'; end if;
    end if;
    if new_status='approved' and coalesce(new.data->>'reviewedBy','')=actor::text then
      raise exception 'Reviewer and approver must be different users' using errcode='23514';
    end if;
  elsif old_status='approved' and new.data is distinct from old.data then
    raise exception 'Approved annual benefit budget may only transition to Locked' using errcode='55000';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_annual_benefit_budget_v4545 on public.entity_records;
create trigger trg_guard_annual_benefit_budget_v4545
before insert or update on public.entity_records
for each row execute function app.guard_annual_benefit_budget_entity_v4545();

-- Current statutory certification release binding.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.45'
where status='active' and release_version<>'4.5.45';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.45' or p_migration_version<>63 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 064_sticky_table_workflow_formula_hardened_v4546.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.46
-- Sticky long-table headers, centered headings, workflow feedback and resilient TT133 reference download.

insert into public.schema_versions(version,description) values
('4.5.46','Sticky long-table headers, centered table headings, accessible horizontal navigation, workflow feedback and resilient TT133 reference download')
on conflict(version) do update set description=excluded.description;

-- Current statutory certification release binding.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.46'
where status='active' and release_version<>'4.5.46';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.46' or p_migration_version<>64 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 065_accounting_operations_tax_package_update_v4547.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.47
-- Accounting operations capability audit and effective-dated Vietnamese tax compliance package manager.

insert into public.schema_versions(version,description) values
('4.5.47','Accounting operations capability audit and checksum-versioned, effective-dated Vietnamese tax compliance package manager')
on conflict(version) do update set description=excluded.description;

create table if not exists public.tax_compliance_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  package_id text not null,
  package_name text not null,
  version text not null,
  jurisdiction text not null default 'VN' check(upper(jurisdiction)='VN'),
  authority text,
  effective_from date not null,
  effective_to date,
  package_sha256 text not null check(package_sha256 ~ '^[0-9a-f]{64}$'),
  package jsonb not null,
  status text not null default 'candidate' check(status in ('candidate','active','inactive','rejected')),
  imported_by uuid not null default auth.uid(),
  imported_at timestamptz not null default clock_timestamp(),
  activated_by uuid,
  activated_at timestamptz,
  row_version bigint not null default 1,
  constraint tax_compliance_packages_date_order check(effective_to is null or effective_to>=effective_from),
  unique(company_id,package_id,version),
  unique(company_id,package_sha256)
);

alter table public.tax_compliance_packages enable row level security;
drop policy if exists tax_compliance_packages_select on public.tax_compliance_packages;
create policy tax_compliance_packages_select on public.tax_compliance_packages for select
using(app.is_company_member(company_id) and app.has_permission('tax.read',company_id));
drop policy if exists tax_compliance_packages_insert on public.tax_compliance_packages;
create policy tax_compliance_packages_insert on public.tax_compliance_packages for insert
with check(company_id=app.current_company_id() and app.has_permission('tax.write',company_id));
drop policy if exists tax_compliance_packages_update on public.tax_compliance_packages;
create policy tax_compliance_packages_update on public.tax_compliance_packages for update
using(company_id=app.current_company_id() and app.has_permission('tax.write',company_id))
with check(company_id=app.current_company_id());
revoke all on public.tax_compliance_packages from public,anon;
grant select,insert,update on public.tax_compliance_packages to authenticated;

create index if not exists idx_tax_compliance_packages_company_status_effective
on public.tax_compliance_packages(company_id,status,effective_from desc);

create or replace function app.activate_tax_compliance_package(p_package_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare cid uuid:=app.current_company_id(); target public.tax_compliance_packages; old_row jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('tax.write',cid) then raise exception 'tax.write permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to activate tax compliance packages' using errcode='42501'; end if;
  select * into target from public.tax_compliance_packages where id=p_package_id and company_id=cid for update;
  if target.id is null then raise exception 'tax compliance package not found' using errcode='P0002'; end if;
  if coalesce(target.package->'manifest'->>'packageType','')<>'alpha-vn-tax-compliance-package' then raise exception 'invalid package type' using errcode='22023'; end if;
  if coalesce((target.package->'manifest'->>'schemaVersion')::integer,0)<>1 then raise exception 'unsupported package schema version' using errcode='22023'; end if;
  old_row:=to_jsonb(target);
  update public.tax_compliance_packages set status='inactive',row_version=row_version+1
  where company_id=cid and status='active' and id<>p_package_id;
  update public.tax_compliance_packages set status='active',activated_by=app.current_user_id(),activated_at=clock_timestamp(),row_version=row_version+1
  where id=p_package_id returning * into target;
  perform app.append_audit(cid,'tax_compliance_packages',target.id::text,'ACTIVATE',old_row,to_jsonb(target));
  return to_jsonb(target);
end $$;

create or replace function public.activate_tax_compliance_package(p_package_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.activate_tax_compliance_package(p_package_id)
$$;
revoke all on function public.activate_tax_compliance_package(uuid) from public,anon;
grant execute on function public.activate_tax_compliance_package(uuid) to authenticated;
revoke all on function app.activate_tax_compliance_package(uuid) from public,anon,authenticated;

comment on table public.tax_compliance_packages is
'Checksum-versioned, effective-dated Vietnamese tax metadata packages. Packages may define form metadata, fields, validations, legal references and XML profiles, but cannot execute code or replace Calculation Core.';
comment on function app.activate_tax_compliance_package(uuid) is
'Activates a tax compliance package with tax.write permission and MFA AAL2, retaining prior packages for rollback and historical filing reproducibility.';

-- Current statutory certification release binding.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.47'
where status='active' and release_version<>'4.5.47';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.47' or p_migration_version<>65 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 066_responsive_sidebar_table_centering_v4548.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.48
-- Responsive sidebar table reflow and centered quantitative/date column alignment.

insert into public.schema_versions(version,description) values
('4.5.48','Responsive sidebar table reflow and centered quantitative/date column alignment')
on conflict(version) do update set description=excluded.description;

-- Current statutory certification release binding.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.48'
where status='active' and release_version<>'4.5.48';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.48' or p_migration_version<>66 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 067_table_viewport_formula_linkage_hardened_v4549.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.49
-- Bottom-only horizontal table scrolling, expanded project viewport and full formula/linkage regression.

insert into public.schema_versions(version,description) values
('4.5.49','Bottom-only table scrolling, expanded project viewport and full formula/linkage regression')
on conflict(version) do update set description=excluded.description;

-- Current statutory certification release binding.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.49'
where status='active' and release_version<>'4.5.49';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.49' or p_migration_version<>67 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 068_enterprise_data_alignment_operational_audit_v4550.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.50
-- Enterprise table semantics, payroll sticky-header correction and full operational regression binding.

insert into public.schema_versions(version,description) values
('4.5.50','Enterprise table data alignment, complete payroll sticky header and operational regression binding')
on conflict(version) do update set description=excluded.description;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.50'
where status='active' and release_version<>'4.5.50';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.50' or p_migration_version<>68 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 069_accounting_tax_legal_hardening_v4561.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.61
-- Accounting/tax legal-boundary hardening and current-release statutory certification binding.

insert into public.schema_versions(version,description) values
('4.5.61','Accounting and tax boundary hardening; TT133 certification rebound to release 4.5.61')
on conflict(version) do update set description=excluded.description;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.61'
where status='active' and release_version<>'4.5.61';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.61' or p_migration_version<>69 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

-- ============================================================================
-- SOURCE: 070_vat_payment_evidence_tk242_parity_v4562.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.62
-- Input-VAT payment-evidence hardening, linked-record immutability and TK242
-- report-classification parity release binding.
begin;

insert into public.schema_versions(version,description) values
('4.5.62','Linked bank-payment evidence and proportional input-VAT deduction; TK242 current/long-term report parity')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

create or replace function app.vat_invoice_vendor_id_v4562(
  p_company uuid,p_payload jsonb
) returns text language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare
  vendor_id text;
  tax_code text;
begin
  vendor_id:=app.json_text(p_payload,'vendorId','vendor_id');
  if vendor_id is null
     and lower(coalesce(app.json_text(p_payload,'partnerType','partner_type'),''))='vendor' then
    vendor_id:=app.json_text(p_payload,'partnerId','partner_id');
  end if;
  if vendor_id is not null then return vendor_id; end if;
  tax_code:=regexp_replace(coalesce(app.json_text(p_payload,'taxCode','tax_code'),''),'\s','','g');
  if tax_code='' then return null; end if;
  select r.record_id into vendor_id
  from public.entity_records r
  where r.company_id=p_company and r.collection='vendors' and r.deleted_at is null
    and regexp_replace(coalesce(r.data->>'taxCode',r.data->>'tax_code',''),'\s','','g')=tax_code
  order by r.record_id
  limit 1;
  return vendor_id;
end $$;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_pre_v4562;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  invoice_id text;
  invoice_vendor_id text;
  payment_vendor_id text;
  journal_id text;
  project_id text;
  invoice_project_id text;
  status_value text;
  type_value text;
  invoice_status text;
  amount_value numeric:=0;
  invoice_total numeric:=0;
  existing_paid numeric:=0;
  bank_net numeric:=0;
  cash_net numeric:=0;
  invoice_row jsonb;
  journal_row jsonb;
  current_row jsonb;
  current_vendor_id text;
  vendor_in_journal boolean:=false;
begin
  perform app.validate_entity_payload_pre_v4562(p_company,p_collection,p_record_id,p_payload);

  if p_collection='finance' then
    invoice_id:=app.json_text(p_payload,'invoiceId','invoice_id','taxInvoiceId','tax_invoice_id');
    select r.data into current_row
    from public.entity_records r
    where r.company_id=p_company and r.collection='finance'
      and r.record_id=p_record_id and r.deleted_at is null;

    if lower(coalesce(current_row->>'status',''))='paid'
       and coalesce(current_row->>'invoiceId',current_row->>'invoice_id',current_row->>'taxInvoiceId',current_row->>'tax_invoice_id','')<>''
       and (
         coalesce(current_row->>'invoiceId',current_row->>'invoice_id',current_row->>'taxInvoiceId',current_row->>'tax_invoice_id','') is distinct from coalesce(invoice_id,'')
         or lower(coalesce(current_row->>'type','')) is distinct from lower(coalesce(p_payload->>'type',''))
         or lower(coalesce(current_row->>'status','')) is distinct from lower(coalesce(p_payload->>'status',''))
         or coalesce(current_row->>'date','') is distinct from coalesce(p_payload->>'date','')
         or coalesce(current_row->>'journalEntryId',current_row->>'journal_entry_id',current_row->>'postingId',current_row->>'posting_id','') is distinct from coalesce(app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id'),'')
         or app.json_numeric_or_zero(current_row,'amount') is distinct from app.json_numeric_or_zero(p_payload,'amount')
       ) then
      raise exception 'VAT_PAYMENT_IMMUTABLE: reverse a linked Paid input-invoice payment instead of rewriting its evidence' using errcode='23514';
    end if;

    if invoice_id is not null then
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|input-vat-payment|'||invoice_id,0));
      select r.data into invoice_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='taxInvoices'
        and r.record_id=invoice_id and r.deleted_at is null;
      if invoice_row is null or lower(coalesce(invoice_row->>'direction',''))<>'input' then
        raise exception 'VAT_INPUT_INVOICE_REQUIRED: linked finance requires an active Input invoice' using errcode='23503';
      end if;
      invoice_status:=lower(coalesce(invoice_row->>'status','valid'));
      if invoice_status in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'VAT_INPUT_INVOICE_STATUS: linked finance requires a recognized Input invoice' using errcode='23503';
      end if;

      type_value:=lower(coalesce(app.json_text(p_payload,'type'),''));
      status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
      if type_value<>'expense' then
        raise exception 'VAT_PAYMENT_TYPE: an Input invoice may only link to Expense finance' using errcode='23514';
      end if;
      project_id:=app.json_text(p_payload,'projectId','project_id');
      invoice_project_id:=app.json_text(invoice_row,'projectId','project_id');
      if project_id is not null and invoice_project_id is not null and project_id<>invoice_project_id then
        raise exception 'VAT_PAYMENT_PROJECT: finance and Input invoice projects differ' using errcode='23514';
      end if;

      invoice_vendor_id:=app.vat_invoice_vendor_id_v4562(p_company,invoice_row);
      payment_vendor_id:=app.json_text(p_payload,'vendorId','vendor_id');
      if payment_vendor_id is null
         and lower(coalesce(app.json_text(p_payload,'partnerType','partner_type'),''))='vendor' then
        payment_vendor_id:=app.json_text(p_payload,'partnerId','partner_id');
      end if;
      if invoice_vendor_id is null then
        raise exception 'VAT_PAYMENT_VENDOR: Input invoice must identify a vendor' using errcode='23503';
      end if;
      if payment_vendor_id is not null and payment_vendor_id<>invoice_vendor_id then
        raise exception 'VAT_PAYMENT_VENDOR: finance vendor differs from Input invoice vendor' using errcode='23514';
      end if;

      if status_value='paid' then
        journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id');
        select r.data into journal_row
        from public.entity_records r
        where r.company_id=p_company and r.collection='journalEntries'
          and r.record_id=journal_id and r.deleted_at is null;
        if journal_row is null or lower(coalesce(journal_row->>'status',''))<>'posted' then
          raise exception 'VAT_PAYMENT_JOURNAL: linked Paid finance requires a Posted journal' using errcode='23503';
        end if;
        select
          coalesce(sum(case when coalesce(app.json_text(line.value,'accountCode','account_code'),'') ~ '^112'
            then app.json_numeric_or_zero(line.value,'debit')-app.json_numeric_or_zero(line.value,'credit') else 0 end),0),
          coalesce(sum(case when coalesce(app.json_text(line.value,'accountCode','account_code'),'') ~ '^111'
            then app.json_numeric_or_zero(line.value,'debit')-app.json_numeric_or_zero(line.value,'credit') else 0 end),0)
        into bank_net,cash_net
        from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value);
        amount_value:=app.json_numeric_or_zero(p_payload,'amount');
        if round(bank_net,0)<>-round(amount_value,0) or round(cash_net,0)<>0 then
          raise exception 'VAT_PAYMENT_BANK_EVIDENCE: account 112 must fund the exact amount and account 111 must be zero' using errcode='23514';
        end if;

        vendor_in_journal:=(
          lower(coalesce(journal_row->>'partnerType',journal_row->>'partner_type',''))='vendor'
          and coalesce(journal_row->>'partnerId',journal_row->>'partner_id','')=invoice_vendor_id
        ) or exists(
          select 1
          from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value)
          where lower(coalesce(line.value->>'partnerType',line.value->>'partner_type',''))='vendor'
            and coalesce(line.value->>'partnerId',line.value->>'partner_id','')=invoice_vendor_id
        );
        if payment_vendor_id is null and not vendor_in_journal then
          raise exception 'VAT_PAYMENT_VENDOR_EVIDENCE: payment or journal must identify the invoice vendor' using errcode='23514';
        end if;

        invoice_total:=app.json_numeric_or_zero(invoice_row,'totalAmount','total_amount');
        select coalesce(sum(app.json_numeric_or_zero(r.data,'amount')),0)
        into existing_paid
        from public.entity_records r
        where r.company_id=p_company and r.collection='finance'
          and r.record_id<>p_record_id and r.deleted_at is null
          and lower(coalesce(r.data->>'type',''))='expense'
          and lower(coalesce(r.data->>'status',''))='paid'
          and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=invoice_id;
        if round(existing_paid+amount_value,0)>round(invoice_total,0)+1 then
          raise exception 'VAT_PAYMENT_OVERPAYMENT: linked Paid finance exceeds Input invoice total' using errcode='23514';
        end if;
      end if;
    end if;

  elsif p_collection='taxInvoices' then
    if exists(
      select 1 from public.entity_records r
      where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
        and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=p_record_id
    ) then
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|input-vat-payment|'||p_record_id,0));
      status_value:=lower(coalesce(app.json_text(p_payload,'status'),'valid'));
      if lower(coalesce(app.json_text(p_payload,'direction'),''))<>'input'
         or status_value in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'VAT_LINKED_INVOICE_IMMUTABLE: linked invoice must remain recognized Input' using errcode='23514';
      end if;
      select r.data into current_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='taxInvoices'
        and r.record_id=p_record_id and r.deleted_at is null;
      invoice_vendor_id:=app.vat_invoice_vendor_id_v4562(p_company,p_payload);
      current_vendor_id:=app.vat_invoice_vendor_id_v4562(p_company,current_row);
      if invoice_vendor_id is null or invoice_vendor_id is distinct from current_vendor_id
         or coalesce(app.json_text(p_payload,'projectId','project_id'),'') is distinct from coalesce(app.json_text(current_row,'projectId','project_id'),'') then
        raise exception 'VAT_LINKED_INVOICE_PARTY: vendor and project cannot change after payment linkage' using errcode='23514';
      end if;
      select coalesce(sum(app.json_numeric_or_zero(r.data,'amount')),0)
      into existing_paid
      from public.entity_records r
      where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
        and lower(coalesce(r.data->>'type',''))='expense'
        and lower(coalesce(r.data->>'status',''))='paid'
        and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=p_record_id;
      invoice_total:=app.json_numeric_or_zero(p_payload,'totalAmount','total_amount');
      if round(invoice_total,0)+1<round(existing_paid,0) then
        raise exception 'VAT_LINKED_INVOICE_TOTAL: invoice total cannot be below linked Paid finance' using errcode='23514';
      end if;
    end if;
  end if;
end $$;

alter function app.assert_entity_delete_safe(uuid,text,text)
  rename to assert_entity_delete_safe_pre_v4562;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  perform app.assert_entity_delete_safe_pre_v4562(p_company,p_collection,p_record_id);
  if p_collection='taxInvoices' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
      and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: Input invoice is referenced by finance payment evidence' using errcode='23503'; end if;
  if p_collection='vendors' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
      and coalesce(r.data->>'vendorId',r.data->>'vendor_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: vendor is referenced by finance payment evidence' using errcode='23503'; end if;
  if p_collection='finance' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='finance'
      and r.record_id=p_record_id and r.deleted_at is null
      and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id','')<>''
  ) then raise exception 'DEPENDENCY_EXISTS: linked Input-invoice payment evidence cannot be deleted' using errcode='23503'; end if;
end $$;

revoke all on function app.vat_invoice_vendor_id_v4562(uuid,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload_pre_v4562(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe_pre_v4562(uuid,text,text) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.62';
update public.companies set active_release_version='4.5.62'
where active_release_version is null or active_release_version='4.5.61';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.62'
where status='active' and release_version<>'4.5.62';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.62' or p_migration_version<>70 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

commit;

-- ============================================================================
-- SOURCE: 071_table_scroll_continuity_release_v4563.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.63
-- Shared table-scroll continuity patch and release-certification binding.
begin;

insert into public.schema_versions(version,description) values
('4.5.63','Preserve vertical and horizontal table viewport after in-view approve, reject and record mutations')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

alter table public.companies alter column active_release_version set default '4.5.63';
update public.companies set active_release_version='4.5.63'
where active_release_version is null or active_release_version='4.5.62';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.63'
where status='active' and release_version<>'4.5.63';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.63' or p_migration_version<>71 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

commit;

-- ============================================================================
-- SOURCE: 072_prepaint_table_viewport_release_v4564.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.64
-- Pre-paint table viewport restoration and release-certification binding.
begin;

insert into public.schema_versions(version,description) values
('4.5.64','Restore every table viewport synchronously before first browser paint after an in-view mutation')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

alter table public.companies alter column active_release_version set default '4.5.64';
update public.companies set active_release_version='4.5.64'
where active_release_version is null or active_release_version='4.5.63';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.64'
where status='active' and release_version<>'4.5.64';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.64' or p_migration_version<>72 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

commit;

-- ============================================================================
-- SOURCE: 073_full_control_terminology_release_v4565.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.65
-- Full Vietnamese operational-control terminology and release-certification binding.
begin;

insert into public.schema_versions(version,description) values
('4.5.65','Display complete Vietnamese names for operational-control metrics without changing accounting or tax formulas')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

alter table public.companies alter column active_release_version set default '4.5.65';
update public.companies set active_release_version='4.5.65'
where active_release_version is null or active_release_version='4.5.64';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.65'
where status='active' and release_version<>'4.5.65';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.65' or p_migration_version<>73 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

commit;

-- ============================================================================
-- SOURCE: 074_recycle_bin_restore_v4566.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.66
-- Recycle bin, exact-module restore, permanent purge and 30-day retention.
begin;

insert into public.schema_versions(version,description) values
('4.5.66','Recycle bin with original payload and module context, controlled restore, permanent purge and automatic 30-day retention')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

create or replace function app.collection_permission(p_collection text,p_write boolean default false)
returns text language sql immutable as $$
  select case
    when p_collection in ('projects','projectStages','tasks','resourcePlans','commitments','projectBudgetVersions','projectBudgetLines')
      then case when p_write then 'projects.write' else 'projects.read' end
    when p_collection in ('clients','quotes','contracts','billingMilestones','paymentAllocations')
      then case when p_write then 'crm.write' else 'crm.read' end
    when p_collection='people'
      then case when p_write then 'hr.write' else 'hr.read' end
    when p_collection='timesheets'
      then case when p_write then 'timesheet.write' else 'timesheet.read' end
    when p_collection in ('payrollPeriods','payrollItems','annualBenefitBudgets')
      then case when p_write then 'payroll.write' else 'payroll.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','accountingPeriods','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection='documents'
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    -- Creation is validated against the deleted source by trg_guard_trash_entries_v4566.
    -- Reading, restore and purge remain restricted to security administrators.
    when p_collection='trashEntries'
      then case when p_write then 'dashboard.read' else 'security.manage' end
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings' then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system' then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

drop policy if exists entity_records_select_v36 on public.entity_records;
create policy entity_records_select_v36 on public.entity_records for select
using(
  app.is_company_member(company_id)
  and (
    (collection='trashEntries' and (app.has_permission('security.manage',company_id) or app.has_permission('admin',company_id)))
    or
    (collection<>'trashEntries' and (
      app.has_permission(coalesce(app.collection_permission(collection,false),'data.read'),company_id)
      or app.has_permission('data.read',company_id)
      or app.has_permission('admin',company_id)
    ))
  )
);

-- Keep the server deletion rule aligned with the existing client contract plan:
-- an unused contract may be removed together with draft, uninvoiced milestones.
alter function app.assert_entity_delete_safe(uuid,text,text)
  rename to assert_entity_delete_safe_pre_v4566;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  begin
    perform app.assert_entity_delete_safe_pre_v4566(p_company,p_collection,p_record_id);
  exception when foreign_key_violation then
    if p_collection='contracts'
       and not exists(
         select 1 from public.entity_records r
         where r.company_id=p_company and r.deleted_at is null
           and r.collection='taxInvoices'
           and coalesce(r.data->>'contractId',r.data->>'contract_id')=p_record_id
       )
       and not exists(
         select 1 from public.entity_records r
         where r.company_id=p_company and r.deleted_at is null
           and r.collection='billingMilestones'
           and coalesce(r.data->>'contractId',r.data->>'contract_id')=p_record_id
           and (
             lower(coalesce(r.data->>'status','draft')) not in ('draft','planned')
             or coalesce(r.data->>'invoiceId',r.data->>'invoice_id','')<>''
           )
       ) then
      return;
    end if;
    raise;
  end;
end $$;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_pre_v4566;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  deleted_at_value timestamptz;
  expires_at_value timestamptz;
  related jsonb;
begin
  if p_collection<>'trashEntries' then
    perform app.validate_entity_payload_pre_v4566(p_company,p_collection,p_record_id,p_payload);
    return;
  end if;
  if p_record_id is null or length(btrim(p_record_id)) not between 1 and 160 then raise exception 'INVALID_TRASH_ID' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_TRASH_PAYLOAD' using errcode='22023'; end if;
  if octet_length(p_payload::text)>1048576 then raise exception 'PAYLOAD_TOO_LARGE: trash entry exceeds 1 MiB' using errcode='22023'; end if;
  if app.json_has_unsafe_key(p_payload) then raise exception 'UNSAFE_JSON_KEY: trash entry contains unsafe property name' using errcode='22023'; end if;
  if coalesce(p_payload->>'id','')<>p_record_id then raise exception 'ID_MISMATCH: trash entry id' using errcode='22023'; end if;
  if length(btrim(coalesce(p_payload->>'entityType',''))) not between 1 and 80 or p_payload->>'entityType' in ('trashEntries','settings','system','notificationReads') then raise exception 'INVALID_TRASH_ENTITY_TYPE' using errcode='22023'; end if;
  if jsonb_typeof(p_payload->'record')<>'object' then raise exception 'INVALID_TRASH_RECORD' using errcode='22023'; end if;
  if coalesce(p_payload->>'recordId','')='' or coalesce(p_payload->'record'->>'id','')<>p_payload->>'recordId' then raise exception 'INVALID_TRASH_RECORD_ID' using errcode='22023'; end if;
  if length(coalesce(p_payload->>'sourceView',''))>80 or length(coalesce(p_payload->>'sourceLabel',''))>160 or length(coalesce(p_payload->>'displayName',''))>320 then raise exception 'TRASH_TEXT_TOO_LONG' using errcode='22023'; end if;
  if coalesce(p_payload->>'originalIndex','')!~ '^[0-9]+$' or (p_payload->>'originalIndex')::numeric>10000000 then raise exception 'INVALID_TRASH_INDEX' using errcode='22023'; end if;
  begin deleted_at_value:=(p_payload->>'deletedAt')::timestamptz;expires_at_value:=(p_payload->>'expiresAt')::timestamptz;
  exception when others then raise exception 'INVALID_TRASH_DATE' using errcode='22023'; end;
  if expires_at_value<deleted_at_value+interval '30 days' or expires_at_value>deleted_at_value+interval '30 days 1 second' then raise exception 'INVALID_TRASH_RETENTION' using errcode='22023'; end if;
  if coalesce((p_payload->>'retentionDays')::numeric,0)<>30 then raise exception 'INVALID_TRASH_RETENTION_DAYS' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_payload->'relatedRecords','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'relatedRecords','[]'::jsonb))>100 then raise exception 'INVALID_TRASH_RELATED_RECORDS' using errcode='22023'; end if;
  for related in select value from jsonb_array_elements(coalesce(p_payload->'relatedRecords','[]'::jsonb)) loop
    if jsonb_typeof(related)<>'object' or jsonb_typeof(related->'record')<>'object' or coalesce(related->>'entityType','')='' or related->>'entityType' in ('trashEntries','settings','system','notificationReads') or coalesce(related->'record'->>'id','')='' then raise exception 'INVALID_TRASH_RELATED_RECORD' using errcode='22023'; end if;
  end loop;
end $$;

create or replace function app.guard_trash_entry_v4566()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  source_row public.entity_records;
  source_permission text;
  related jsonb;
  related_row public.entity_records;
begin
  if new.collection<>'trashEntries' then return new; end if;
  if tg_op='UPDATE' and old.deleted_at is null and new.deleted_at is null and new.data is distinct from old.data then raise exception 'TRASH_ENTRY_IMMUTABLE' using errcode='55000'; end if;
  if new.deleted_at is null and (tg_op='INSERT' or old.deleted_at is not null) then
    if coalesce(new.data->>'deletedByUserId','')<>coalesce(app.current_user_id()::text,'') then raise exception 'TRASH_ACTOR_MISMATCH' using errcode='42501'; end if;
    source_permission:=app.collection_permission(new.data->>'entityType',true);
    if source_permission is null or (not app.has_permission(source_permission,new.company_id) and not app.has_permission('data.write',new.company_id)) then raise exception 'TRASH_SOURCE_PERMISSION_REQUIRED' using errcode='42501'; end if;
    select * into source_row from public.entity_records r where r.company_id=new.company_id and r.collection=new.data->>'entityType' and r.record_id=new.data->>'recordId';
    if not found or source_row.deleted_at is null or source_row.data is distinct from new.data->'record' then raise exception 'TRASH_SOURCE_MISMATCH' using errcode='23503'; end if;
    -- AUTHORITATIVE_TRASH_RETENTION: never trust a browser-supplied age. The
    -- database deletion timestamp is the only start of the 30-day window.
    new.data:=jsonb_set(new.data,'{deletedAt}',to_jsonb(source_row.deleted_at),true);
    new.data:=jsonb_set(new.data,'{expiresAt}',to_jsonb(source_row.deleted_at+interval '30 days'),true);
    for related in select value from jsonb_array_elements(coalesce(new.data->'relatedRecords','[]'::jsonb)) loop
      source_permission:=app.collection_permission(related->>'entityType',true);
      if source_permission is null or (not app.has_permission(source_permission,new.company_id) and not app.has_permission('data.write',new.company_id)) then raise exception 'TRASH_RELATED_PERMISSION_REQUIRED' using errcode='42501'; end if;
      select * into related_row from public.entity_records r where r.company_id=new.company_id and r.collection=related->>'entityType' and r.record_id=related->'record'->>'id';
      if not found or related_row.deleted_at is null or related_row.data is distinct from related->'record' then raise exception 'TRASH_RELATED_SOURCE_MISMATCH' using errcode='23503'; end if;
    end loop;
  elsif tg_op='UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    if not app.has_permission('security.manage',new.company_id) and not app.has_permission('admin',new.company_id) then raise exception 'TRASH_MANAGE_PERMISSION_REQUIRED' using errcode='42501'; end if;
    if app.current_aal()<>'aal2' then raise exception 'MFA_AAL2_REQUIRED_FOR_TRASH_MANAGEMENT' using errcode='42501'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_trash_entries_v4566 on public.entity_records;
create trigger trg_guard_trash_entries_v4566
before insert or update on public.entity_records
for each row execute function app.guard_trash_entry_v4566();

create or replace function app.finalize_trash_entry_v4566()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare related jsonb;
begin
  if new.collection<>'trashEntries' or old.deleted_at is not null or new.deleted_at is null then return new; end if;
  delete from public.entity_records r where r.company_id=new.company_id and r.collection=new.data->>'entityType' and r.record_id=new.data->>'recordId' and r.deleted_at is not null;
  for related in select value from jsonb_array_elements(coalesce(new.data->'relatedRecords','[]'::jsonb)) loop
    delete from public.entity_records r where r.company_id=new.company_id and r.collection=related->>'entityType' and r.record_id=related->'record'->>'id' and r.deleted_at is not null;
  end loop;
  delete from public.entity_records r where r.company_id=new.company_id and r.collection='trashEntries' and r.record_id=new.record_id;
  return null;
end $$;

drop trigger if exists trg_finalize_trash_entries_v4566 on public.entity_records;
create trigger trg_finalize_trash_entries_v4566
after update on public.entity_records
for each row execute function app.finalize_trash_entry_v4566();

create or replace function app.purge_expired_trash_entries_v4566()
returns integer language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare entry record;related jsonb;purged integer:=0;
begin
  for entry in select * from public.entity_records r where r.collection='trashEntries' and r.deleted_at is null and coalesce(r.data->>'externalSource','')='' and not coalesce((r.data->'record')?'storagePath',false) and (r.data->>'expiresAt')::timestamptz<=clock_timestamp() for update skip locked loop
    delete from public.entity_records r where r.company_id=entry.company_id and r.collection=entry.data->>'entityType' and r.record_id=entry.data->>'recordId' and r.deleted_at is not null;
    for related in select value from jsonb_array_elements(coalesce(entry.data->'relatedRecords','[]'::jsonb)) loop delete from public.entity_records r where r.company_id=entry.company_id and r.collection=related->>'entityType' and r.record_id=related->'record'->>'id' and r.deleted_at is not null;end loop;
    delete from public.entity_records r where r.company_id=entry.company_id and r.collection='trashEntries' and r.record_id=entry.record_id;
    purged:=purged+1;
  end loop;
  return purged;
end $$;

do $schedule$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin
      execute 'select cron.schedule($1,$2,$3)' using 'alpha-recycle-bin-30-day-purge','17 * * * *','select app.purge_expired_trash_entries_v4566();';
    exception when unique_violation then null; when insufficient_privilege then null; when undefined_function then null; when undefined_table then null; end;
  end if;
end $schedule$;

revoke all on function app.validate_entity_payload_pre_v4566(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe_pre_v4566(uuid,text,text) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;
revoke all on function app.guard_trash_entry_v4566() from public,anon,authenticated;
revoke all on function app.finalize_trash_entry_v4566() from public,anon,authenticated;
revoke all on function app.purge_expired_trash_entries_v4566() from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.66';
update public.companies set active_release_version='4.5.66'
where active_release_version is null or active_release_version='4.5.65';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.66'
where status='active' and release_version<>'4.5.66';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();checks jsonb;failed_count int;approved_count int;
  server_b01 text;server_b02 text;server_b03 text;server_b09 text;row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.66' or p_migration_version<>74 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

commit;

-- ============================================================================
-- SOURCE: 075_deep_qa_autoheal_v4567.sql
-- ============================================================================
-- ALPHA DESIGN ERP Cloud v4.5.67
-- Deep QA, controlled auto-heal and release-certification binding. Formula correction is delivered in the application calculation core.
begin;

insert into public.schema_versions(version,description) values
('4.5.67','Deep accounting and financial QA, inclusive VND 50 billion CIT boundary, controlled auto-heal and exact-package browser verification')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

alter table public.companies alter column active_release_version set default '4.5.67';
update public.companies set active_release_version='4.5.67'
where active_release_version is null or active_release_version='4.5.66';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.67'
where status='active' and release_version<>'4.5.67';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.67' or p_migration_version<>75 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

commit;
