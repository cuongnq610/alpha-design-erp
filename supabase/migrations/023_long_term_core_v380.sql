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
