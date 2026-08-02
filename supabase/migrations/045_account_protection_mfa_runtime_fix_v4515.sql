-- ALPHA DESIGN ERP Cloud v4.5.15
-- Account protection and MFA runtime visibility fix. No accounting schema or formula changes.
begin;

alter table public.companies alter column active_release_version set default '4.5.15';
update public.companies
set active_release_version='4.5.15',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4','4.5.5','4.5.6','4.5.7','4.5.8','4.5.9','4.5.10','4.5.11','4.5.12','4.5.13','4.5.14');

insert into public.schema_versions(version,description) values
('4.5.15','Account protection and MFA runtime fix: visible Demo/offline status, session validation, stale-factor cleanup, AAL and verified-factor diagnostics')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
