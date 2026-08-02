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
