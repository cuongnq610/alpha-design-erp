-- ALPHA DESIGN ERP Cloud v4.5.21
-- Deep audit closure: transition-specific permissions for generic entity sync,
-- immutable posted journals and auditable accounting-period unlocks.
begin;

create or replace function app.collection_permission(p_collection text,p_write boolean default false)
returns text language sql immutable as $$
  select case
    when p_collection in ('projects','projectStages','tasks','resourcePlans','commitments','projectBudgetVersions','projectBudgetLines')
      then case when p_write then 'projects.write' else 'projects.read' end
    when p_collection in ('clients','quotes','contracts','billingMilestones','paymentAllocations')
      then case when p_write then 'crm.write' else 'crm.read' end
    when p_collection='people'
      then case when p_write then 'hr.write' else 'hr.read' end
    when p_collection='timesheets'
      then case when p_write then 'timesheet.write' else 'timesheet.read' end
    when p_collection='accountingPeriods'
      then case when p_write then 'accounting.close' else 'accounting.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','vendors')
      then case when p_write then 'accounting.write' else 'accounting.read' end
    when p_collection in ('taxInvoices','pitWithholdings','citAdjustments','taxFilings')
      then case when p_write then 'tax.write' else 'tax.read' end
    when p_collection='documents'
      then case when p_write then 'documents.write' else 'documents.read' end
    when p_collection in ('approvals','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules')
      then case when p_write then 'procurement.write' else 'procurement.read' end
    when p_collection in ('financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns')
      then case when p_write then 'financial_analytics.write' else 'financial_analytics.read' end
    when p_collection in ('exportLogs','importLogs')
      then case when p_write then 'reports.export' else 'reports.read' end
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings'
      then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system'
      then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

create or replace function app.assert_entity_transition_permission(
  p_company uuid,
  p_collection text,
  p_old jsonb,
  p_new jsonb,
  p_deleted boolean default false
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare
  old_status text:=lower(coalesce(p_old->>'status',''));
  new_status text:=lower(coalesce(p_new->>'status',''));
  old_approved boolean:=coalesce((p_old->>'approved')::boolean,false);
  new_approved boolean:=coalesce((p_new->>'approved')::boolean,false);
  unlock_reason text:=btrim(coalesce(p_new->>'unlockReason',p_new->>'unlock_reason',''));
  policy_mfa boolean:=coalesce((select require_mfa_for_privileged from public.companies where id=p_company),true);
begin
  if p_collection='journalEntries' then
    if old_status='posted' and (coalesce(p_deleted,false) or p_new is distinct from p_old) then
      raise exception 'POSTED_JOURNAL_IMMUTABLE: use an adjustment or reversal entry' using errcode='42501';
    end if;
    if new_status='posted' and old_status is distinct from 'posted' then
      if not app.has_permission('accounting.post',p_company) then
        raise exception 'ACCOUNTING_POST_PERMISSION_REQUIRED' using errcode='42501';
      end if;
      if policy_mfa and app.current_aal()<>'aal2' then
        raise exception 'MFA_AAL2_REQUIRED_FOR_ACCOUNTING_POST' using errcode='42501';
      end if;
    end if;

  elsif p_collection='accountingPeriods' then
    if not app.has_permission('accounting.close',p_company)
       and not app.has_permission('accounting.period.lock',p_company) then
      raise exception 'ACCOUNTING_CLOSE_PERMISSION_REQUIRED' using errcode='42501';
    end if;
    if policy_mfa and app.current_aal()<>'aal2' then
      raise exception 'MFA_AAL2_REQUIRED_FOR_PERIOD_CONTROL' using errcode='42501';
    end if;
    if coalesce((p_old->>'locked')::boolean,false)
       and not coalesce((p_new->>'locked')::boolean,false)
       and not coalesce(p_deleted,false)
       and length(unlock_reason)<8 then
      raise exception 'ACCOUNTING_PERIOD_UNLOCK_REASON_REQUIRED' using errcode='22023';
    end if;

  elsif p_collection='timesheets' then
    if (new_approved and not old_approved)
       or (new_status in ('approved','rejected') and new_status is distinct from old_status) then
      if not app.has_permission('timesheet.approve',p_company) then
        raise exception 'TIMESHEET_APPROVE_PERMISSION_REQUIRED' using errcode='42501';
      end if;
    end if;

  elsif p_collection in ('approvals','purchaseRequests','purchaseOrders') then
    if new_status in ('approved','rejected') and new_status is distinct from old_status then
      if not app.has_permission('procurement.approve',p_company) then
        raise exception 'PROCUREMENT_APPROVE_PERMISSION_REQUIRED' using errcode='42501';
      end if;
    end if;
  end if;
end $$;

create or replace function app.entity_record_guard() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare permission_code text;
begin
  if tg_op='UPDATE' and (new.company_id,new.collection,new.record_id) is distinct from (old.company_id,old.collection,old.record_id) then
    raise exception 'IMMUTABLE_ENTITY_IDENTITY: company_id, collection and record_id cannot be changed' using errcode='22023';
  end if;
  perform app.assert_operational_write_allowed(new.company_id);
  permission_code:=app.collection_permission(new.collection,true);
  if permission_code is null then raise exception 'unsupported collection: %',new.collection using errcode='22023'; end if;
  perform app.assert_company_access(new.company_id);
  if coalesce((select require_mfa_for_privileged from public.companies where id=new.company_id),true)
     and app.user_is_privileged(new.company_id) and app.current_aal()<>'aal2' then
    raise exception 'MFA AAL2 required for privileged write' using errcode='42501';
  end if;
  if not app.has_permission(permission_code,new.company_id) and not app.has_permission('data.write',new.company_id) then
    raise exception 'permission denied for collection %',new.collection using errcode='42501';
  end if;

  perform app.assert_entity_transition_permission(
    new.company_id,
    new.collection,
    case when tg_op='UPDATE' then old.data else '{}'::jsonb end,
    new.data,
    new.deleted_at is not null
  );

  if new.deleted_at is null then
    perform app.validate_entity_payload(new.company_id,new.collection,new.record_id,new.data);
  elsif tg_op='INSERT' then
    perform app.assert_entity_delete_safe(new.company_id,new.collection,new.record_id);
  elsif old.deleted_at is null then
    perform app.assert_entity_delete_safe(new.company_id,new.collection,new.record_id);
  end if;
  if tg_op='INSERT' then new.created_by:=coalesce(new.created_by,app.current_user_id());new.created_at:=coalesce(new.created_at,clock_timestamp());end if;
  new.updated_by:=app.current_user_id();new.updated_at:=clock_timestamp();return new;
end $$;

revoke all on function app.assert_entity_transition_permission(uuid,text,jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function app.entity_record_guard() from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.21';
update public.companies set active_release_version='4.5.21'
where active_release_version is null or active_release_version in ('4.5.18','4.5.19','4.5.20');

insert into public.schema_versions(version,description) values
('4.5.21','Deep audit closure: transition-specific entity sync permissions, immutable Posted journals, MFA-protected posting and accounting-period control, auditable unlock reasons, secure identifiers and reliable browser evidence')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
