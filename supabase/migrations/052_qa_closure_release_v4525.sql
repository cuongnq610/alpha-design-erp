-- ALPHA DESIGN ERP Cloud v4.5.25
-- QA closure release marker: aligns application, export, evidence and database release metadata.
begin;

alter table public.companies
  alter column active_release_version set default '4.5.25';

update public.companies
set active_release_version='4.5.25'
where active_release_version is null
   or active_release_version in ('4.5.21','4.5.22','4.5.23','4.5.24');

insert into public.schema_versions(version,description) values
('4.5.25','QA closure release: reliable authenticated browser audits, bounded test execution, corrected Excel date and percentage semantics, and unified runtime/export/database release metadata')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

commit;
