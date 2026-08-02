-- ALPHA DESIGN ERP Cloud v4.5.26
-- Engineering QA release marker: effective-dated tax policy and portable browser validation.
begin;

alter table public.companies
  alter column active_release_version set default '4.5.26';

update public.companies
set active_release_version='4.5.26'
where active_release_version is null
   or active_release_version in ('4.5.21','4.5.22','4.5.23','4.5.24','4.5.25');

insert into public.schema_versions(version,description) values
('4.5.26','Engineering QA release: effective-dated CIT policy, cross-year review control, current PWA cache and portable fail-fast browser audit tooling')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

commit;
