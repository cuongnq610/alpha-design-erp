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
