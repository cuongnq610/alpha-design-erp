-- ALPHA DESIGN ERP Cloud v4.5.66
-- Recycle bin, exact-module restore, permanent purge and 30-day retention.
begin;

insert into public.schema_versions(version,description) values
('4.5.66','Recycle bin with original payload and module context, controlled restore, permanent purge and automatic 30-day retention')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

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
    when p_collection in ('payrollPeriods','payrollItems','annualBenefitBudgets')
      then case when p_write then 'payroll.write' else 'payroll.read' end
    when p_collection in ('finance','accounts','journalEntries','openingBalances','accountingPeriods','vendors')
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
    -- Creation is validated against the deleted source by trg_guard_trash_entries_v4566.
    -- Reading, restore and purge remain restricted to security administrators.
    when p_collection='trashEntries'
      then case when p_write then 'dashboard.read' else 'security.manage' end
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings' then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system' then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

drop policy if exists entity_records_select_v36 on public.entity_records;
create policy entity_records_select_v36 on public.entity_records for select
using(
  app.is_company_member(company_id)
  and (
    (collection='trashEntries' and (app.has_permission('security.manage',company_id) or app.has_permission('admin',company_id)))
    or
    (collection<>'trashEntries' and (
      app.has_permission(coalesce(app.collection_permission(collection,false),'data.read'),company_id)
      or app.has_permission('data.read',company_id)
      or app.has_permission('admin',company_id)
    ))
  )
);

-- Keep the server deletion rule aligned with the existing client contract plan:
-- an unused contract may be removed together with draft, uninvoiced milestones.
alter function app.assert_entity_delete_safe(uuid,text,text)
  rename to assert_entity_delete_safe_pre_v4566;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  begin
    perform app.assert_entity_delete_safe_pre_v4566(p_company,p_collection,p_record_id);
  exception when foreign_key_violation then
    if p_collection='contracts'
       and not exists(
         select 1 from public.entity_records r
         where r.company_id=p_company and r.deleted_at is null
           and r.collection='taxInvoices'
           and coalesce(r.data->>'contractId',r.data->>'contract_id')=p_record_id
       )
       and not exists(
         select 1 from public.entity_records r
         where r.company_id=p_company and r.deleted_at is null
           and r.collection='billingMilestones'
           and coalesce(r.data->>'contractId',r.data->>'contract_id')=p_record_id
           and (
             lower(coalesce(r.data->>'status','draft')) not in ('draft','planned')
             or coalesce(r.data->>'invoiceId',r.data->>'invoice_id','')<>''
           )
       ) then
      return;
    end if;
    raise;
  end;
end $$;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_pre_v4566;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  deleted_at_value timestamptz;
  expires_at_value timestamptz;
  related jsonb;
begin
  if p_collection<>'trashEntries' then
    perform app.validate_entity_payload_pre_v4566(p_company,p_collection,p_record_id,p_payload);
    return;
  end if;
  if p_record_id is null or length(btrim(p_record_id)) not between 1 and 160 then raise exception 'INVALID_TRASH_ID' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_TRASH_PAYLOAD' using errcode='22023'; end if;
  if octet_length(p_payload::text)>1048576 then raise exception 'PAYLOAD_TOO_LARGE: trash entry exceeds 1 MiB' using errcode='22023'; end if;
  if app.json_has_unsafe_key(p_payload) then raise exception 'UNSAFE_JSON_KEY: trash entry contains unsafe property name' using errcode='22023'; end if;
  if coalesce(p_payload->>'id','')<>p_record_id then raise exception 'ID_MISMATCH: trash entry id' using errcode='22023'; end if;
  if length(btrim(coalesce(p_payload->>'entityType',''))) not between 1 and 80 or p_payload->>'entityType' in ('trashEntries','settings','system','notificationReads') then raise exception 'INVALID_TRASH_ENTITY_TYPE' using errcode='22023'; end if;
  if jsonb_typeof(p_payload->'record')<>'object' then raise exception 'INVALID_TRASH_RECORD' using errcode='22023'; end if;
  if coalesce(p_payload->>'recordId','')='' or coalesce(p_payload->'record'->>'id','')<>p_payload->>'recordId' then raise exception 'INVALID_TRASH_RECORD_ID' using errcode='22023'; end if;
  if length(coalesce(p_payload->>'sourceView',''))>80 or length(coalesce(p_payload->>'sourceLabel',''))>160 or length(coalesce(p_payload->>'displayName',''))>320 then raise exception 'TRASH_TEXT_TOO_LONG' using errcode='22023'; end if;
  if coalesce(p_payload->>'originalIndex','')!~ '^[0-9]+$' or (p_payload->>'originalIndex')::numeric>10000000 then raise exception 'INVALID_TRASH_INDEX' using errcode='22023'; end if;
  begin deleted_at_value:=(p_payload->>'deletedAt')::timestamptz;expires_at_value:=(p_payload->>'expiresAt')::timestamptz;
  exception when others then raise exception 'INVALID_TRASH_DATE' using errcode='22023'; end;
  if expires_at_value<deleted_at_value+interval '30 days' or expires_at_value>deleted_at_value+interval '30 days 1 second' then raise exception 'INVALID_TRASH_RETENTION' using errcode='22023'; end if;
  if coalesce((p_payload->>'retentionDays')::numeric,0)<>30 then raise exception 'INVALID_TRASH_RETENTION_DAYS' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_payload->'relatedRecords','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'relatedRecords','[]'::jsonb))>100 then raise exception 'INVALID_TRASH_RELATED_RECORDS' using errcode='22023'; end if;
  for related in select value from jsonb_array_elements(coalesce(p_payload->'relatedRecords','[]'::jsonb)) loop
    if jsonb_typeof(related)<>'object' or jsonb_typeof(related->'record')<>'object' or coalesce(related->>'entityType','')='' or related->>'entityType' in ('trashEntries','settings','system','notificationReads') or coalesce(related->'record'->>'id','')='' then raise exception 'INVALID_TRASH_RELATED_RECORD' using errcode='22023'; end if;
  end loop;
end $$;

create or replace function app.guard_trash_entry_v4566()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  source_row public.entity_records;
  source_permission text;
  related jsonb;
  related_row public.entity_records;
begin
  if new.collection<>'trashEntries' then return new; end if;
  if tg_op='UPDATE' and old.deleted_at is null and new.deleted_at is null and new.data is distinct from old.data then raise exception 'TRASH_ENTRY_IMMUTABLE' using errcode='55000'; end if;
  if new.deleted_at is null and (tg_op='INSERT' or old.deleted_at is not null) then
    if coalesce(new.data->>'deletedByUserId','')<>coalesce(app.current_user_id()::text,'') then raise exception 'TRASH_ACTOR_MISMATCH' using errcode='42501'; end if;
    source_permission:=app.collection_permission(new.data->>'entityType',true);
    if source_permission is null or (not app.has_permission(source_permission,new.company_id) and not app.has_permission('data.write',new.company_id)) then raise exception 'TRASH_SOURCE_PERMISSION_REQUIRED' using errcode='42501'; end if;
    select * into source_row from public.entity_records r where r.company_id=new.company_id and r.collection=new.data->>'entityType' and r.record_id=new.data->>'recordId';
    if not found or source_row.deleted_at is null or source_row.data is distinct from new.data->'record' then raise exception 'TRASH_SOURCE_MISMATCH' using errcode='23503'; end if;
    -- AUTHORITATIVE_TRASH_RETENTION: never trust a browser-supplied age. The
    -- database deletion timestamp is the only start of the 30-day window.
    new.data:=jsonb_set(new.data,'{deletedAt}',to_jsonb(source_row.deleted_at),true);
    new.data:=jsonb_set(new.data,'{expiresAt}',to_jsonb(source_row.deleted_at+interval '30 days'),true);
    for related in select value from jsonb_array_elements(coalesce(new.data->'relatedRecords','[]'::jsonb)) loop
      source_permission:=app.collection_permission(related->>'entityType',true);
      if source_permission is null or (not app.has_permission(source_permission,new.company_id) and not app.has_permission('data.write',new.company_id)) then raise exception 'TRASH_RELATED_PERMISSION_REQUIRED' using errcode='42501'; end if;
      select * into related_row from public.entity_records r where r.company_id=new.company_id and r.collection=related->>'entityType' and r.record_id=related->'record'->>'id';
      if not found or related_row.deleted_at is null or related_row.data is distinct from related->'record' then raise exception 'TRASH_RELATED_SOURCE_MISMATCH' using errcode='23503'; end if;
    end loop;
  elsif tg_op='UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    if not app.has_permission('security.manage',new.company_id) and not app.has_permission('admin',new.company_id) then raise exception 'TRASH_MANAGE_PERMISSION_REQUIRED' using errcode='42501'; end if;
    if app.current_aal()<>'aal2' then raise exception 'MFA_AAL2_REQUIRED_FOR_TRASH_MANAGEMENT' using errcode='42501'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_trash_entries_v4566 on public.entity_records;
create trigger trg_guard_trash_entries_v4566
before insert or update on public.entity_records
for each row execute function app.guard_trash_entry_v4566();

create or replace function app.finalize_trash_entry_v4566()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare related jsonb;
begin
  if new.collection<>'trashEntries' or old.deleted_at is not null or new.deleted_at is null then return new; end if;
  delete from public.entity_records r where r.company_id=new.company_id and r.collection=new.data->>'entityType' and r.record_id=new.data->>'recordId' and r.deleted_at is not null;
  for related in select value from jsonb_array_elements(coalesce(new.data->'relatedRecords','[]'::jsonb)) loop
    delete from public.entity_records r where r.company_id=new.company_id and r.collection=related->>'entityType' and r.record_id=related->'record'->>'id' and r.deleted_at is not null;
  end loop;
  delete from public.entity_records r where r.company_id=new.company_id and r.collection='trashEntries' and r.record_id=new.record_id;
  return null;
end $$;

drop trigger if exists trg_finalize_trash_entries_v4566 on public.entity_records;
create trigger trg_finalize_trash_entries_v4566
after update on public.entity_records
for each row execute function app.finalize_trash_entry_v4566();

create or replace function app.purge_expired_trash_entries_v4566()
returns integer language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare entry record;related jsonb;purged integer:=0;
begin
  for entry in select * from public.entity_records r where r.collection='trashEntries' and r.deleted_at is null and coalesce(r.data->>'externalSource','')='' and not coalesce((r.data->'record')?'storagePath',false) and (r.data->>'expiresAt')::timestamptz<=clock_timestamp() for update skip locked loop
    delete from public.entity_records r where r.company_id=entry.company_id and r.collection=entry.data->>'entityType' and r.record_id=entry.data->>'recordId' and r.deleted_at is not null;
    for related in select value from jsonb_array_elements(coalesce(entry.data->'relatedRecords','[]'::jsonb)) loop delete from public.entity_records r where r.company_id=entry.company_id and r.collection=related->>'entityType' and r.record_id=related->'record'->>'id' and r.deleted_at is not null;end loop;
    delete from public.entity_records r where r.company_id=entry.company_id and r.collection='trashEntries' and r.record_id=entry.record_id;
    purged:=purged+1;
  end loop;
  return purged;
end $$;

do $schedule$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin
      execute 'select cron.schedule($1,$2,$3)' using 'alpha-recycle-bin-30-day-purge','17 * * * *','select app.purge_expired_trash_entries_v4566();';
    exception when unique_violation then null; when insufficient_privilege then null; when undefined_function then null; when undefined_table then null; end;
  end if;
end $schedule$;

revoke all on function app.validate_entity_payload_pre_v4566(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe_pre_v4566(uuid,text,text) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;
revoke all on function app.guard_trash_entry_v4566() from public,anon,authenticated;
revoke all on function app.finalize_trash_entry_v4566() from public,anon,authenticated;
revoke all on function app.purge_expired_trash_entries_v4566() from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.66';
update public.companies set active_release_version='4.5.66'
where active_release_version is null or active_release_version='4.5.65';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.66'
where status='active' and release_version<>'4.5.66';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();checks jsonb;failed_count int;approved_count int;
  server_b01 text;server_b02 text;server_b03 text;server_b09 text;row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.66' or p_migration_version<>74 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed) into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;
  server_b01:=app.report_rows_sha256('B01',p_from,p_to);server_b02:=app.report_rows_sha256('B02',p_from,p_to);server_b03:=app.report_rows_sha256('B03',p_from,p_to);server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then raise exception 'browser and Supabase report hashes differ' using errcode='55000'; end if;
  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded' where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';
  insert into public.statutory_report_certifications(company_id,period_from,period_to,release_version,formula_version,migration_version,b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at)
  values(cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$ select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256) $$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;

commit;
