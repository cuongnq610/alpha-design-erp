-- ALPHA DESIGN ERP Cloud v4.5.17
-- Rebalances the management-result and project P&L panels so all desktop columns remain visible.
-- No accounting formula, business table or authorization schema change.
begin;

alter table public.companies alter column active_release_version set default '4.5.17';
update public.companies
set active_release_version='4.5.17',
    go_live_status='blocked',
    go_live_approved_at=null,
    go_live_approved_by=null
where active_release_version='4.5.16';

insert into public.schema_versions(version,description) values
('4.5.17','Accounting management-result and project P&L desktop table-fit correction; no formula or business-schema change')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
