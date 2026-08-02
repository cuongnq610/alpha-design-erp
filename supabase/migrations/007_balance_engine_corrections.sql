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
