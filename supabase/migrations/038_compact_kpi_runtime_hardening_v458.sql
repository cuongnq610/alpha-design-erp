-- ALPHA DESIGN ERP Cloud v4.5.8
-- UI-only compact KPI and runtime-regression release marker. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.8';
update public.companies
set active_release_version='4.5.8',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7');

insert into public.schema_versions(version,description) values
('4.5.8','Compact KPI dashboard, semantic attention badges without pseudo-element conflicts, stale release-artifact cleanup and runtime regression hardening')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
