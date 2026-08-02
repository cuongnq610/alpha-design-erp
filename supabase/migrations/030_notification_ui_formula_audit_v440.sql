-- ALPHA DESIGN ERP Cloud v4.4.0
-- Notification navigation and UI/formula audit release marker.
begin;
alter table public.companies alter column active_release_version set default '4.4.0';
update public.companies
set active_release_version='4.4.0'
where active_release_version is null or active_release_version in ('4.0.0','4.1.0','4.2.0','4.3.0');
insert into public.schema_versions(version, description)
values ('4.4.0','Notification read-state/navigation, refined contract actions, planning scope separation, UI cleanup and full formula/linkage regression audit')
on conflict (version) do update set description=excluded.description, applied_at=clock_timestamp();
commit;
