-- ALPHA DESIGN ERP Cloud v4.5.2
-- Deep security/offline audit: complete entity_records permission mapping for every browser collection.
begin;

create or replace function app.collection_permission(p_collection text,p_write boolean default false)
returns text language sql immutable as $$
  select case
    when p_collection in ('projects','projectStages','tasks','resourcePlans','commitments','projectBudgetVersions','projectBudgetLines')
      then case when p_write then 'projects.write' else 'projects.read' end
    when p_collection in ('clients','quotes','contracts','billingMilestones','paymentAllocations')
      then case when p_write then 'crm.write' else 'crm.read' end
    when p_collection in ('people')
      then case when p_write then 'hr.write' else 'hr.read' end
    when p_collection in ('timesheets')
      then case when p_write then 'timesheet.write' else 'timesheet.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','accountingPeriods','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection in ('documents')
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection in ('notificationReads')
      then 'dashboard.read'
    when p_collection in ('settings')
      then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system'
      then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;


-- Keep the database MFA boundary aligned with every critical permission used by the browser and release APIs.
create or replace function app.permission_is_privileged(p_permission text) returns boolean
language sql immutable
set search_path=pg_catalog,public,app as $$
  select p_permission in (
    'admin','accounting.post','accounting.close','accounting.period.lock',
    'users.manage','roles.manage','reports.import','backup.restore',
    'security.manage','release.approve'
  )
$$;

create or replace function app.user_is_privileged(p_company uuid default app.current_company_id()) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select exists(
    select 1
    from public.memberships m
    join public.roles r on r.id=m.role_id and r.company_id=m.company_id
    where m.company_id=p_company
      and m.user_id=app.current_user_id()
      and m.status='active'
      and (
        'admin'=any(coalesce(r.permissions,array[]::text[]))
        or exists(
          select 1 from unnest(coalesce(r.permissions,array[]::text[])) p(code)
          where app.permission_is_privileged(p.code)
        )
        or exists(
          select 1 from public.role_permissions rp
          where rp.role_id=r.id
            and (rp.permission_code='admin' or app.permission_is_privileged(rp.permission_code))
        )
      )
    union all
    select 1
    from public.membership_roles mr
    join public.roles r on r.id=mr.role_id and r.company_id=mr.company_id
    where mr.company_id=p_company
      and mr.user_id=app.current_user_id()
      and (
        'admin'=any(coalesce(r.permissions,array[]::text[]))
        or exists(
          select 1 from unnest(coalesce(r.permissions,array[]::text[])) p(code)
          where app.permission_is_privileged(p.code)
        )
        or exists(
          select 1 from public.role_permissions rp
          where rp.role_id=r.id
            and (rp.permission_code='admin' or app.permission_is_privileged(rp.permission_code))
        )
      )
  )
$$;
revoke all on function app.permission_is_privileged(text) from public,anon;
revoke all on function app.user_is_privileged(uuid) from public,anon;
grant execute on function app.permission_is_privileged(text) to authenticated;
grant execute on function app.user_is_privileged(uuid) to authenticated;

alter table public.companies alter column active_release_version set default '4.5.2';
update public.companies
set active_release_version='4.5.2'
where active_release_version is null or active_release_version in ('4.4.0','4.5.0');

insert into public.schema_versions(version,description) values
('4.5.2','Deep security and offline audit: complete Cloud sync/RPC permission coverage, strict production read-only behavior when disconnected, CSV formula-injection mitigation and risky upload blocking')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
