-- ALPHA DESIGN ERP Cloud v4.5.0
-- Responsive Mobile & Tablet release marker. No destructive schema change.
begin;
alter table public.companies alter column active_release_version set default '4.5.0';
update public.companies
set active_release_version='4.5.0'
where active_release_version is null or active_release_version='4.4.0';
insert into public.schema_versions(version, description)
values ('4.5.0','Responsive Mobile & Tablet: certified layouts at 360, 390, 430, 768, 820 and 1024 px; touch-safe navigation, forms, drawers, upload and local table scrolling')
on conflict (version) do update set description=excluded.description, applied_at=clock_timestamp();
commit;
