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
