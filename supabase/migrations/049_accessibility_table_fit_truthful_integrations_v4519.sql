-- ALPHA DESIGN ERP Cloud v4.5.19
-- Closes desktop table overflow/action-heading defects, improves keyboard/focus accessibility,
-- enforces truthful Demo integration wording and records the final UI regression package.
-- No business table, accounting formula or posting-rule schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.19';
update public.companies
set active_release_version='4.5.19',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.18';

insert into public.schema_versions(version,description) values
('4.5.19','Accessibility labels and focus lifecycle, desktop full-table fit with explicit action headings, aligned status glyphs and truthful Demo integration states; no business-schema or accounting-formula change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
