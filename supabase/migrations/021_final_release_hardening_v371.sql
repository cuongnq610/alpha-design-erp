-- ALPHA DESIGN ERP Cloud v3.7.1 - Final release hardening.
-- Fixes release permission alignment, locks legacy validation evidence, and advances formula/release versions.

alter table public.companies alter column active_release_version set default '3.7.1';
update public.companies
set active_release_version='3.7.1',go_live_status='blocked',go_live_approved_at=null,go_live_approved_by=null
where active_release_version='3.7.0' and operational_mode in ('pilot','parallel');

alter table public.project_control_snapshots
  alter column formula_version set default 'ALPHA-PROJECT-CONTROL-2.3';

-- Internal helper functions are not direct client APIs. Public wrappers retain the required access checks.
revoke all on function app.required_release_gates() from public,anon,authenticated;
revoke all on function app.release_gate_status(uuid,text) from public,anon,authenticated;
revoke all on function app.assert_operational_write_allowed(uuid) from public,anon,authenticated;
revoke all on function app.production_readiness() from public,anon,authenticated;
revoke all on function app.current_user_context() from public,anon,authenticated;

-- Legacy validation tables are evidence stores, not user-editable business records.
revoke insert,update,delete,truncate,references,trigger
  on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,
     public.backup_manifests,public.restore_drills
  from authenticated;
grant select on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,
     public.backup_manifests,public.restore_drills to authenticated;
grant all on public.golden_dataset_cases,public.golden_dataset_results,public.operational_validation_runs,
     public.backup_manifests,public.restore_drills to service_role;

insert into public.schema_versions(version,description) values
('3.7.1','Final release hardening: cash/allocation separation, approved risk baseline, API permission alignment, live browser gate and secret scan')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();
