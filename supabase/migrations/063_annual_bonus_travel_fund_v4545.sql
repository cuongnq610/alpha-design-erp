-- ALPHA DESIGN ERP Cloud v4.5.45
-- Annual 13th-month bonus and travel welfare budget planning.

insert into public.schema_versions(version,description) values
('4.5.45','Annual 13th-month bonus and travel welfare budget, payroll linkage, welfare ceiling control and approval workflow')
on conflict(version) do update set description=excluded.description;

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
    when p_collection in ('payrollPeriods','payrollItems','annualBenefitBudgets')
      then case when p_write then 'payroll.write' else 'payroll.read' end
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
    when p_collection='notificationReads' then 'dashboard.read'
    when p_collection='settings' then case when p_write then 'integrations.manage' else 'dashboard.read' end
    when p_collection='system' then case when p_write then 'data.write' else 'data.read' end
    else null
  end
$$;

alter function app.validate_entity_payload(uuid,text,text,jsonb) rename to validate_entity_payload_pre_v4545;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare status_value text; year_value numeric;
begin
  if p_collection='annualBenefitBudgets' then
    year_value:=app.assert_json_number(p_payload,'annualBenefitBudgets.year',2000,2200,true,'year');
    status_value:=lower(app.assert_required_text(p_payload,'annualBenefitBudgets.status',30,'status'));
    if status_value not in ('draft','reviewed','approved','locked') then
      raise exception 'INVALID_ENUM: annualBenefitBudgets.status' using errcode='22023';
    end if;
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.minimumServiceDays',0,366,false,'minimumServiceDays','minimum_service_days');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.companyPerformanceFactor',0,2,false,'companyPerformanceFactor','company_performance_factor');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.defaultEmployeePerformanceFactor',0,2,false,'defaultEmployeePerformanceFactor','default_employee_performance_factor');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.bonusTaxProvisionRate',0,99,false,'bonusTaxProvisionRate','bonus_tax_provision_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.bonusContingencyRate',0,100,false,'bonusContingencyRate','bonus_contingency_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelParticipationRate',0,100,false,'travelParticipationRate','travel_participation_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelCostPerPerson',0,null::numeric,false,'travelCostPerPerson','travel_cost_per_person');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelCommonCost',0,null::numeric,false,'travelCommonCost','travel_common_cost');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.travelContingencyRate',0,100,false,'travelContingencyRate','travel_contingency_rate');
    perform app.assert_json_number(p_payload,'annualBenefitBudgets.otherWelfareSpent',0,null::numeric,false,'otherWelfareSpent','other_welfare_spent');
    if coalesce(app.json_text(p_payload,'bonusPaymentMode','bonus_payment_mode'),'Gross') not in ('Gross','Net') then
      raise exception 'INVALID_ENUM: annualBenefitBudgets.bonusPaymentMode' using errcode='22023';
    end if;
    return;
  end if;
  perform app.validate_entity_payload_pre_v4545(p_company,p_collection,p_record_id,p_payload);
end $$;

revoke all on function app.validate_entity_payload_pre_v4545(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

create or replace function app.guard_annual_benefit_budget_entity_v4545()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare old_status text; new_status text; actor uuid:=app.current_user_id();
begin
  if new.collection<>'annualBenefitBudgets' or new.deleted_at is not null then return new; end if;
  new_status:=lower(coalesce(new.data->>'status','draft'));
  if tg_op='INSERT' then
    if new_status<>'draft' then raise exception 'Annual benefit budget must be created in Draft status' using errcode='23514'; end if;
    return new;
  end if;
  old_status:=lower(coalesce(old.data->>'status','draft'));
  if old_status='locked' and new.data is distinct from old.data then
    raise exception 'Locked annual benefit budget is immutable' using errcode='55000';
  end if;
  if old_status<>new_status then
    if not ((old_status='draft' and new_status='reviewed') or (old_status='reviewed' and new_status='approved') or (old_status='approved' and new_status='locked')) then
      raise exception 'Invalid annual benefit budget transition % -> %',old_status,new_status using errcode='23514';
    end if;
    if new_status in ('approved','locked') then
      if not app.has_permission('payroll.approve',new.company_id) then raise exception 'payroll.approve permission required' using errcode='42501'; end if;
      if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required for annual benefit approval/lock' using errcode='42501'; end if;
    end if;
    if new_status='approved' and coalesce(new.data->>'reviewedBy','')=actor::text then
      raise exception 'Reviewer and approver must be different users' using errcode='23514';
    end if;
  elsif old_status='approved' and new.data is distinct from old.data then
    raise exception 'Approved annual benefit budget may only transition to Locked' using errcode='55000';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_annual_benefit_budget_v4545 on public.entity_records;
create trigger trg_guard_annual_benefit_budget_v4545
before insert or update on public.entity_records
for each row execute function app.guard_annual_benefit_budget_entity_v4545();

-- Current statutory certification release binding.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.45'
where status='active' and release_version<>'4.5.45';

create or replace function app.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  cid uuid:=app.current_company_id();
  checks jsonb; failed_count int; approved_count int;
  server_b01 text; server_b02 text; server_b03 text; server_b09 text;
  row public.statutory_report_certifications;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('financial_reports.certify',cid) then raise exception 'financial_reports.certify permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to certify statutory reports' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid reporting period' using errcode='22023'; end if;
  if p_release_version<>'4.5.45' or p_migration_version<>63 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
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
