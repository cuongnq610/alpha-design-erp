-- ALPHA DESIGN ERP Cloud v4.5.18
-- Restores the Accounting Tax runtime, adds controlled integration configuration actions,
-- closes typography clipping and records the independently rerun money/linkage audit.
-- No business table or accounting formula schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.18';
update public.companies
set active_release_version='4.5.18',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.17';

insert into public.schema_versions(version,description) values
('4.5.18','Accounting Tax runtime restoration, controlled email/bank configuration actions, typography clipping closure and independent money/linkage regression audit; no business-schema change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
