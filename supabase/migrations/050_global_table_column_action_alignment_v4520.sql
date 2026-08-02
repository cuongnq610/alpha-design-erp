-- ALPHA DESIGN ERP Cloud v4.5.20
-- Records semantic desktop column sizing and exact THAO TAC alignment across all modules.
-- No business table, accounting formula, posting rule or tax calculation schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.20';
update public.companies
set active_release_version='4.5.20',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.19';

insert into public.schema_versions(version,description) values
('4.5.20','Semantic full-width desktop table columns and centered action headings/controls across all modules; no business-schema or accounting-formula change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
