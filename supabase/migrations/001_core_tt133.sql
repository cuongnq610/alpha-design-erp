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
