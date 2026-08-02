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
