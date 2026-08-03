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
  v_hash:=encode(extensions.digest(convert_to(v_payload,'UTF8'),'sha256'),'hex');

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
    v_expected:=encode(extensions.digest(convert_to(v_payload,'UTF8'),'sha256'),'hex');
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
