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
  h:=encode(extensions.digest(payload,'sha256'),'hex');
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
  update journal_entries set status='posted',posted_at=clock_timestamp(),posted_by=app.current_user_id(),posting_hash=encode(extensions.digest(payload,'sha256'),'hex') where id=r.id returning * into r;
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
