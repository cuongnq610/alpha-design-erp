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
