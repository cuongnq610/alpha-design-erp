-- ALPHA DESIGN ERP Cloud v4.5.3
-- Deep server-side integrity validation for the generic entity_records stream.
-- This migration restores the operational kill switch, keeps helper functions private,
-- validates all synchronized collections and blocks unsafe master-data deletion.
begin;

-- notificationReads is the only synchronized singleton whose payload is an array.
-- Preserve any legacy wrapper shape before replacing the original object-only check.
alter table public.entity_records drop constraint if exists entity_records_data_check;
alter table public.entity_records drop constraint if exists entity_records_data_type_v453_check;
update public.entity_records
set data=case
  when jsonb_typeof(data)='array' then data
  when jsonb_typeof(data->'items')='array' then data->'items'
  when jsonb_typeof(data->'values')='array' then data->'values'
  else '[]'::jsonb
end
where collection='notificationReads' and jsonb_typeof(data)<>'array';
alter table public.entity_records add constraint entity_records_data_type_v453_check check(
  (collection='notificationReads' and jsonb_typeof(data)='array')
  or (collection<>'notificationReads' and jsonb_typeof(data)='object')
);

create or replace function app.entity_ref_exists(p_company uuid,p_collection text,p_record_id text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select p_record_id is not null and btrim(p_record_id)<>'' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null
  )
$$;

create or replace function app.entity_account_code_exists(p_company uuid,p_code text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select p_code is not null and btrim(p_code)<>'' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='accounts' and r.deleted_at is null
      and r.data->>'code'=p_code
  )
$$;

create or replace function app.json_text(p_payload jsonb,variadic p_keys text[])
returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare k text; v text;
begin
  foreach k in array p_keys loop
    v:=nullif(btrim(coalesce(p_payload->>k,'')),'');
    if v is not null then return v; end if;
  end loop;
  return null;
end $$;

create or replace function app.is_iso_date_text(p_value text)
returns boolean language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare d date;
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  begin d:=p_value::date; exception when others then return false; end;
  return to_char(d,'YYYY-MM-DD')=p_value;
end $$;

create or replace function app.json_number(p_payload jsonb,variadic p_keys text[])
returns numeric language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then return null; end if;
  if length(v)>80 or v !~ '^[+-]?[0-9]+([.][0-9]+)?$' then
    raise exception 'INVALID_NUMBER: numeric value is malformed' using errcode='22023';
  end if;
  return v::numeric;
end $$;

create or replace function app.assert_required_text(
  p_payload jsonb,p_label text,p_max_length integer,variadic p_keys text[]
) returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then raise exception 'REQUIRED_FIELD: % is required',p_label using errcode='22023'; end if;
  if length(v)>p_max_length then raise exception 'FIELD_TOO_LONG: % exceeds % characters',p_label,p_max_length using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_json_date(
  p_payload jsonb,p_label text,p_required boolean,variadic p_keys text[]
) returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then
    if p_required then raise exception 'REQUIRED_DATE: % is required',p_label using errcode='22023'; end if;
    return null;
  end if;
  if not app.is_iso_date_text(v) then raise exception 'INVALID_DATE: % must be YYYY-MM-DD',p_label using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_json_month(
  p_payload jsonb,p_label text,p_required boolean,variadic p_keys text[]
) returns text language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null then
    if p_required then raise exception 'REQUIRED_PERIOD: % is required',p_label using errcode='22023'; end if;
    return null;
  end if;
  if v !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_PERIOD: % must be YYYY-MM',p_label using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_json_number(
  p_payload jsonb,p_label text,p_min numeric,p_max numeric,p_required boolean,variadic p_keys text[]
) returns numeric language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v numeric;
begin
  v:=app.json_number(p_payload,variadic p_keys);
  if v is null then
    if p_required then raise exception 'REQUIRED_NUMBER: % is required',p_label using errcode='22023'; end if;
    return null;
  end if;
  if p_min is not null and v<p_min then raise exception 'NUMBER_OUT_OF_RANGE: % is below minimum',p_label using errcode='22023'; end if;
  if p_max is not null and v>p_max then raise exception 'NUMBER_OUT_OF_RANGE: % exceeds maximum',p_label using errcode='22023'; end if;
  return v;
end $$;

create or replace function app.assert_entity_ref(
  p_company uuid,p_target_collection text,p_target_id text,p_required boolean,p_label text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  if p_target_id is null or btrim(p_target_id)='' then
    if p_required then raise exception 'REQUIRED_REFERENCE: % is required',p_label using errcode='23503'; end if;
    return;
  end if;
  if not app.entity_ref_exists(p_company,p_target_collection,p_target_id) then
    raise exception 'INVALID_REFERENCE: % does not exist',p_label using errcode='23503';
  end if;
end $$;

create or replace function app.assert_account_code(
  p_company uuid,p_code text,p_required boolean,p_label text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  if p_code is null or btrim(p_code)='' then
    if p_required then raise exception 'REQUIRED_REFERENCE: % is required',p_label using errcode='23503'; end if;
    return;
  end if;
  if not app.entity_account_code_exists(p_company,p_code) then
    raise exception 'INVALID_REFERENCE: % account code does not exist',p_label using errcode='23503';
  end if;
end $$;

create or replace function app.assert_unique_entity_text(
  p_company uuid,p_collection text,p_record_id text,p_value text,p_label text,variadic p_keys text[]
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  if p_value is null or btrim(p_value)='' then return; end if;
  if exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection and r.deleted_at is null
      and r.record_id<>p_record_id
      and exists(select 1 from unnest(p_keys) k where lower(btrim(coalesce(r.data->>k,'')))=lower(btrim(p_value)))
  ) then raise exception 'DUPLICATE_KEY: % already exists',p_label using errcode='23505'; end if;
end $$;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare v_code text;
begin
  if p_collection='projects' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null and r.record_id<>p_record_id
      and r.collection=any(array['tasks','timesheets','finance','quotes','approvals','documents','contracts','taxInvoices','billingMilestones','projectBudgetVersions','resourcePlans','commitments','projectStages','purchaseRequests','purchaseOrders','tools','fixedAssets','citAdjustments'])
      and coalesce(r.data->>'projectId',r.data->>'project_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: project is referenced by active records' using errcode='23503'; end if;

  if p_collection='people' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection='projects' and coalesce(r.data->>'pmId',r.data->>'pm_id')=p_record_id)
        or (r.collection='tasks' and coalesce(r.data->>'assigneeId',r.data->>'assignee_id')=p_record_id)
        or (r.collection='timesheets' and coalesce(r.data->>'personId',r.data->>'person_id')=p_record_id)
        or (r.collection='approvals' and coalesce(r.data->>'requesterId',r.data->>'requester_id')=p_record_id)
        or (r.collection='documents' and coalesce(r.data->>'ownerId',r.data->>'owner_id')=p_record_id)
        or (r.collection='contracts' and coalesce(r.data->>'ownerId',r.data->>'owner_id')=p_record_id)
        or (r.collection='resourcePlans' and coalesce(r.data->>'personId',r.data->>'person_id')=p_record_id)
        or (r.collection='purchaseRequests' and coalesce(r.data->>'requesterId',r.data->>'requester_id')=p_record_id)
        or (r.collection=any(array['purchaseOrders','tools','fixedAssets']) and coalesce(r.data->>'custodianId',r.data->>'custodian_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: person is referenced by active records' using errcode='23503'; end if;

  if p_collection='clients' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection=any(array['projects','quotes','contracts'])
      and coalesce(r.data->>'clientId',r.data->>'client_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: client is referenced by active records' using errcode='23503'; end if;

  if p_collection='vendors' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection='purchaseOrders' and coalesce(r.data->>'vendorId',r.data->>'vendor_id')=p_record_id)
        or (r.collection='pitWithholdings' and lower(coalesce(r.data->>'recipientType',r.data->>'recipient_type',''))='vendor' and coalesce(r.data->>'recipientId',r.data->>'recipient_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: vendor is referenced by active records' using errcode='23503'; end if;

  if p_collection='contracts' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection=any(array['taxInvoices','billingMilestones'])
      and coalesce(r.data->>'contractId',r.data->>'contract_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: contract is referenced by active records' using errcode='23503'; end if;

  if p_collection='taxInvoices' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection='billingMilestones' and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=p_record_id)
        or (r.collection='paymentAllocations' and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: invoice is referenced by active records' using errcode='23503'; end if;

  if p_collection='finance' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='paymentAllocations' and coalesce(r.data->>'paymentId',r.data->>'payment_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: payment is allocated to invoices' using errcode='23503'; end if;

  if p_collection='journalEntries' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and ((r.collection=any(array['finance','taxInvoices','pitWithholdings','purchaseOrders']) and coalesce(r.data->>'journalEntryId',r.data->>'journal_entry_id',r.data->>'postingId',r.data->>'posting_id')=p_record_id)
        or (r.collection=any(array['toolAllocationSchedules','depreciationSchedules']) and coalesce(r.data->>'journalEntryId',r.data->>'journal_entry_id')=p_record_id))
  ) then raise exception 'DEPENDENCY_EXISTS: journal entry is referenced by active records' using errcode='23503'; end if;

  if p_collection='projectBudgetVersions' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='projectBudgetLines' and coalesce(r.data->>'budgetVersionId',r.data->>'budget_version_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: budget version has detail lines' using errcode='23503'; end if;

  if p_collection='purchaseRequests' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='purchaseOrders' and coalesce(r.data->>'purchaseRequestId',r.data->>'purchase_request_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: purchase request has purchase orders' using errcode='23503'; end if;

  if p_collection='purchaseOrders' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection=any(array['tools','fixedAssets']) and coalesce(r.data->>'purchaseOrderId',r.data->>'purchase_order_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: purchase order has recognized assets/tools' using errcode='23503'; end if;

  if p_collection='tools' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='toolAllocationSchedules' and coalesce(r.data->>'sourceId',r.data->>'source_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: tool has allocation schedule' using errcode='23503'; end if;

  if p_collection='fixedAssets' and exists(
    select 1 from public.entity_records r where r.company_id=p_company and r.deleted_at is null
      and r.collection='depreciationSchedules' and coalesce(r.data->>'sourceId',r.data->>'source_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: fixed asset has depreciation schedule' using errcode='23503'; end if;

  if p_collection='accounts' then
    select app.json_text(r.data,'code') into v_code from public.entity_records r
    where r.company_id=p_company and r.collection='accounts' and r.record_id=p_record_id and r.deleted_at is null;
    if v_code is not null and (
      exists(select 1 from public.entity_records r,
                    lateral jsonb_array_elements(case when jsonb_typeof(r.data->'lines')='array' then r.data->'lines' else '[]'::jsonb end) l(value)
             where r.company_id=p_company and r.collection='journalEntries' and r.deleted_at is null and app.json_text(l.value,'accountCode','account_code')=v_code)
      or exists(select 1 from public.entity_records r where r.company_id=p_company and r.collection='openingBalances' and r.deleted_at is null and app.json_text(r.data,'accountCode','account_code')=v_code)
      or exists(select 1 from public.entity_records r where r.company_id=p_company and r.collection=any(array['tools','fixedAssets']) and r.deleted_at is null
                and v_code=any(array[coalesce(r.data->>'expenseAccountCode',r.data->>'expense_account_code',''),coalesce(r.data->>'assetAccountCode',r.data->>'asset_account_code',''),coalesce(r.data->>'depreciationAccountCode',r.data->>'depreciation_account_code','')]))
    ) then raise exception 'DEPENDENCY_EXISTS: account has postings, balances or asset configuration' using errcode='23503'; end if;
  end if;
end $$;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare
  v text; v2 text; n numeric; n2 numeric; n3 numeric; line jsonb; target jsonb;
  total_debit numeric:=0; total_credit numeric:=0;
begin
  if p_record_id is null or length(btrim(p_record_id)) not between 1 and 160 then
    raise exception 'INVALID_RECORD_ID: record_id length is invalid' using errcode='22023';
  end if;
  if octet_length(coalesce(p_payload,'null'::jsonb)::text)>1048576 then
    raise exception 'PAYLOAD_TOO_LARGE: entity payload exceeds 1 MiB' using errcode='22023';
  end if;

  if p_collection='notificationReads' then
    if p_record_id<>'singleton' then raise exception 'INVALID_SINGLETON: notificationReads must use record_id singleton' using errcode='22023'; end if;
    if p_payload is null or jsonb_typeof(p_payload)<>'array' then raise exception 'INVALID_PAYLOAD_TYPE: notificationReads must be an array' using errcode='22023'; end if;
    if jsonb_array_length(p_payload)>10000 then raise exception 'PAYLOAD_TOO_LARGE: too many notification read markers' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload) e(value) where jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>240) then
      raise exception 'INVALID_NOTIFICATION_MARKER: every marker must be a string up to 240 characters' using errcode='22023';
    end if;
    return;
  end if;

  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'INVALID_PAYLOAD_TYPE: payload must be a JSON object' using errcode='22023';
  end if;
  if p_payload ?| array['__proto__','prototype','constructor'] then
    raise exception 'UNSAFE_JSON_KEY: unsafe JSON property name' using errcode='22023';
  end if;
  if p_collection='settings' then
    if p_record_id<>'singleton' then raise exception 'INVALID_SINGLETON: settings must use record_id singleton' using errcode='22023'; end if;
  elsif p_record_id='singleton' then
    raise exception 'INVALID_SINGLETON: collection % cannot use record_id singleton',p_collection using errcode='22023';
  end if;
  v:=app.json_text(p_payload,'id','uuid');
  if v is not null and v<>p_record_id then raise exception 'ID_MISMATCH: payload id does not match record_id' using errcode='22023'; end if;

  if p_collection='system' then
    if p_record_id<>'manifest' then raise exception 'INVALID_SYSTEM_RECORD: only manifest is allowed' using errcode='22023'; end if;

  elsif p_collection='settings' then
    n:=app.assert_json_number(p_payload,'settings.defaultVatRate',0,100,false,'defaultVatRate');
    n:=app.assert_json_number(p_payload,'settings.targetMargin',0,100,false,'targetMargin');
    n:=app.assert_json_number(p_payload,'settings.monthlyWorkingHours',1,744,false,'monthlyWorkingHours');

  elsif p_collection='people' then
    v:=app.assert_required_text(p_payload,'people.code',80,'code'); perform app.assert_unique_entity_text(p_company,'people',p_record_id,v,'people.code','code');
    perform app.assert_required_text(p_payload,'people.name',200,'name');
    perform app.assert_json_number(p_payload,'people.monthlySalary',0,null::numeric,false,'monthlySalary','monthly_salary');
    perform app.assert_json_number(p_payload,'people.hourlyRate',0,null::numeric,false,'hourlyRate','hourly_rate');
    perform app.assert_json_number(p_payload,'people.billingRate',0,null::numeric,false,'billingRate','billing_rate');
    perform app.assert_json_date(p_payload,'people.startDate',false,'startDate','start_date','hireDate','hire_date');
    perform app.assert_json_date(p_payload,'people.endDate',false,'endDate','end_date');

  elsif p_collection='clients' then
    v:=app.assert_required_text(p_payload,'clients.code',80,'code'); perform app.assert_unique_entity_text(p_company,'clients',p_record_id,v,'clients.code','code');
    perform app.assert_required_text(p_payload,'clients.name',240,'name');
    v:=app.json_text(p_payload,'taxCode','tax_code'); perform app.assert_unique_entity_text(p_company,'clients',p_record_id,v,'clients.taxCode','taxCode','tax_code');

  elsif p_collection='vendors' then
    v:=app.assert_required_text(p_payload,'vendors.code',80,'code'); perform app.assert_unique_entity_text(p_company,'vendors',p_record_id,v,'vendors.code','code');
    perform app.assert_required_text(p_payload,'vendors.name',240,'name');
    v:=app.json_text(p_payload,'taxCode','tax_code'); perform app.assert_unique_entity_text(p_company,'vendors',p_record_id,v,'vendors.taxCode','taxCode','tax_code');

  elsif p_collection='accounts' then
    v:=app.assert_required_text(p_payload,'accounts.code',32,'code');
    if v !~ '^[0-9A-Za-z._-]+$' then raise exception 'INVALID_ACCOUNT_CODE: unsupported characters' using errcode='22023'; end if;
    perform app.assert_unique_entity_text(p_company,'accounts',p_record_id,v,'accounts.code','code');
    perform app.assert_required_text(p_payload,'accounts.name',240,'name');
    v:=lower(app.assert_required_text(p_payload,'accounts.type',30,'type'));
    if v not in ('asset','liability','equity','revenue','expense') then raise exception 'INVALID_ENUM: accounts.type' using errcode='22023'; end if;

  elsif p_collection='projects' then
    v:=app.assert_required_text(p_payload,'projects.code',80,'code'); perform app.assert_unique_entity_text(p_company,'projects',p_record_id,v,'projects.code','code');
    perform app.assert_required_text(p_payload,'projects.name',240,'name');
    perform app.assert_entity_ref(p_company,'clients',app.json_text(p_payload,'clientId','client_id'),true,'projects.clientId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'pmId','pm_id'),true,'projects.pmId');
    v:=app.assert_json_date(p_payload,'projects.startDate',true,'startDate','start_date');
    v2:=app.assert_json_date(p_payload,'projects.endDate',false,'endDate','end_date');
    if v2 is not null and v2<v then raise exception 'INVALID_DATE_RANGE: project endDate precedes startDate' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'projects.contractValue',0,null::numeric,true,'contractValue','contract_value'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: project contractValue must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'projects.directBudget',0,null::numeric,true,'directBudget','direct_budget');
    perform app.assert_json_number(p_payload,'projects.progress',0,100,true,'progress');

  elsif p_collection='tasks' then
    perform app.assert_required_text(p_payload,'tasks.title',300,'title','name');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'tasks.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'assigneeId','assignee_id'),true,'tasks.assigneeId');
    v:=app.assert_json_date(p_payload,'tasks.startDate',false,'startDate','start_date');
    v2:=app.assert_json_date(p_payload,'tasks.dueDate',false,'dueDate','due_date');
    if v is not null and v2 is not null and v2<v then raise exception 'INVALID_DATE_RANGE: task dueDate precedes startDate' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'tasks.estimatedHours',0,null::numeric,false,'estimatedHours','estimated_hours');
    perform app.assert_json_number(p_payload,'tasks.actualHours',0,null::numeric,false,'actualHours','actual_hours');

  elsif p_collection='timesheets' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'timesheets.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'personId','person_id'),true,'timesheets.personId');
    perform app.assert_json_date(p_payload,'timesheets.date',true,'date');
    n:=app.assert_json_number(p_payload,'timesheets.hours',0,24,true,'hours'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: timesheet hours must be positive' using errcode='22023'; end if;

  elsif p_collection='contracts' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'contracts.projectId');
    perform app.assert_entity_ref(p_company,'clients',app.json_text(p_payload,'clientId','client_id'),true,'contracts.clientId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'ownerId','owner_id'),false,'contracts.ownerId');
    v:=app.assert_required_text(p_payload,'contracts.contractNo',120,'contractNo','contract_no'); perform app.assert_unique_entity_text(p_company,'contracts',p_record_id,v,'contracts.contractNo','contractNo','contract_no');
    perform app.assert_json_date(p_payload,'contracts.signedDate',false,'signedDate','signed_date');
    v:=app.assert_json_date(p_payload,'contracts.effectiveDate',true,'effectiveDate','effective_date');
    v2:=app.assert_json_date(p_payload,'contracts.expiryDate',false,'expiryDate','expiry_date');
    if v2 is not null and v2<v then raise exception 'INVALID_DATE_RANGE: contract expiryDate precedes effectiveDate' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'contracts.valueExclVat',0,null::numeric,true,'valueExclVat','value_excl_vat','contractValue'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: contract value must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'contracts.vatRate',0,100,false,'vatRate','vat_rate');

  elsif p_collection='journalEntries' then
    perform app.assert_json_date(p_payload,'journalEntries.date',true,'date');
    perform app.assert_required_text(p_payload,'journalEntries.documentNo',120,'documentNo','document_no');
    if jsonb_typeof(coalesce(p_payload->'lines','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'lines','[]'::jsonb))<2 then raise exception 'INVALID_JOURNAL: at least two lines are required' using errcode='22023'; end if;
    for line in select value from jsonb_array_elements(coalesce(p_payload->'lines','[]'::jsonb)) loop
      perform app.assert_account_code(p_company,app.json_text(line,'accountCode','account_code'),true,'journalEntries.lines.accountCode');
      perform app.assert_entity_ref(p_company,'projects',app.json_text(line,'projectId','project_id'),false,'journalEntries.lines.projectId');
      n:=coalesce(app.json_number(line,'debit'),0); n2:=coalesce(app.json_number(line,'credit'),0);
      if n<0 or n2<0 or (n>0 and n2>0) or (n=0 and n2=0) then raise exception 'INVALID_JOURNAL_LINE: each line must contain one positive debit or credit' using errcode='22023'; end if;
      total_debit:=total_debit+n; total_credit:=total_credit+n2;
    end loop;
    if round(total_debit,0)<>round(total_credit,0) or round(total_debit,0)<=0 then raise exception 'UNBALANCED_JOURNAL: total debit must equal total credit' using errcode='22023'; end if;
    if lower(coalesce(p_payload->>'status',''))='posted' and coalesce(p_payload->>'postingHash','') !~ '^[0-9a-fA-F]{64}$' then raise exception 'INVALID_POSTING_HASH: posted entry requires SHA-256 hash' using errcode='22023'; end if;

  elsif p_collection='finance' then
    perform app.assert_json_date(p_payload,'finance.date',true,'date');
    v:=lower(app.assert_required_text(p_payload,'finance.type',20,'type')); if v not in ('income','expense') then raise exception 'INVALID_ENUM: finance.type' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'finance.amount',0,null::numeric,true,'amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: finance amount must be positive' using errcode='22023'; end if;
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'finance.projectId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id'),false,'finance.journalEntryId');

  elsif p_collection='quotes' then
    perform app.assert_json_date(p_payload,'quotes.date',true,'date');
    perform app.assert_entity_ref(p_company,'clients',app.json_text(p_payload,'clientId','client_id'),true,'quotes.clientId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'quotes.projectId');
    perform app.assert_required_text(p_payload,'quotes.projectName',300,'projectName','project_name','name');
    perform app.assert_json_number(p_payload,'quotes.amount',0,null::numeric,true,'amount');
    perform app.assert_json_number(p_payload,'quotes.probability',0,100,true,'probability');

  elsif p_collection='approvals' then
    perform app.assert_json_date(p_payload,'approvals.date',true,'date');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'requesterId','requester_id'),true,'approvals.requesterId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'approvals.projectId');
    perform app.assert_required_text(p_payload,'approvals.title',400,'title');
    perform app.assert_json_number(p_payload,'approvals.amount',0,null::numeric,false,'amount');

  elsif p_collection='documents' then
    perform app.assert_required_text(p_payload,'documents.title',400,'title');
    perform app.assert_json_date(p_payload,'documents.date',false,'date');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'documents.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'ownerId','owner_id'),false,'documents.ownerId');

  elsif p_collection='taxInvoices' then
    perform app.assert_json_date(p_payload,'taxInvoices.date',true,'date');
    perform app.assert_json_date(p_payload,'taxInvoices.dueDate',false,'dueDate','due_date');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'taxInvoices.projectId');
    perform app.assert_entity_ref(p_company,'contracts',app.json_text(p_payload,'contractId','contract_id'),false,'taxInvoices.contractId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'taxInvoices.journalEntryId');
    n:=app.assert_json_number(p_payload,'taxInvoices.taxBase',0,null::numeric,true,'taxBase','tax_base','amountExclVat','amount_excl_vat');
    n2:=app.assert_json_number(p_payload,'taxInvoices.vatAmount',0,null::numeric,true,'vatAmount','vat_amount');
    n3:=app.assert_json_number(p_payload,'taxInvoices.totalAmount',0,null::numeric,true,'totalAmount','total_amount');
    if abs(round(n+n2,0)-round(n3,0))>1 then raise exception 'FORMULA_MISMATCH: invoice total must equal tax base plus VAT' using errcode='22023'; end if;

  elsif p_collection='pitWithholdings' then
    perform app.assert_json_date(p_payload,'pitWithholdings.date',true,'date');
    v:=lower(app.assert_required_text(p_payload,'pitWithholdings.recipientType',30,'recipientType','recipient_type'));
    v2:=app.json_text(p_payload,'recipientId','recipient_id');
    if v='vendor' then perform app.assert_entity_ref(p_company,'vendors',v2,true,'pitWithholdings.recipientId');
    elsif v in ('person','employee') then perform app.assert_entity_ref(p_company,'people',v2,true,'pitWithholdings.recipientId');
    else raise exception 'INVALID_ENUM: pitWithholdings.recipientType' using errcode='22023'; end if;
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'pitWithholdings.journalEntryId');
    n:=app.assert_json_number(p_payload,'pitWithholdings.grossIncome',0,null::numeric,true,'grossIncome','gross_income','grossAmount','gross_amount');
    n2:=app.assert_json_number(p_payload,'pitWithholdings.taxWithheld',0,n,true,'taxWithheld','tax_withheld');
    n3:=app.json_number(p_payload,'netPaid','net_paid','netAmount','net_amount'); if n3 is not null and abs(round(n-n2,0)-round(n3,0))>1 then raise exception 'FORMULA_MISMATCH: PIT net amount must equal gross less withheld tax' using errcode='22023'; end if;

  elsif p_collection='citAdjustments' then
    perform app.assert_json_date(p_payload,'citAdjustments.date',true,'date');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'citAdjustments.projectId');
    perform app.assert_json_number(p_payload,'citAdjustments.amount',0,null::numeric,true,'amount');
    perform app.assert_json_number(p_payload,'citAdjustments.fiscalYear',2000,2100,true,'fiscalYear','fiscal_year');

  elsif p_collection='taxFilings' then
    perform app.assert_required_text(p_payload,'taxFilings.period',80,'period');
    perform app.assert_json_date(p_payload,'taxFilings.dueDate',true,'dueDate','due_date');
    perform app.assert_json_date(p_payload,'taxFilings.filedDate',false,'filedDate','filed_date');
    perform app.assert_json_date(p_payload,'taxFilings.paymentDate',false,'paymentDate','payment_date');
    perform app.assert_json_number(p_payload,'taxFilings.payableAmount',0,null::numeric,false,'payableAmount','payable_amount');

  elsif p_collection='billingMilestones' then
    v:=app.json_text(p_payload,'contractId','contract_id'); perform app.assert_entity_ref(p_company,'contracts',v,true,'billingMilestones.contractId');
    v2:=app.json_text(p_payload,'projectId','project_id'); perform app.assert_entity_ref(p_company,'projects',v2,true,'billingMilestones.projectId');
    perform app.assert_entity_ref(p_company,'taxInvoices',app.json_text(p_payload,'invoiceId','invoice_id'),false,'billingMilestones.invoiceId');
    perform app.assert_json_date(p_payload,'billingMilestones.dueDate',false,'dueDate','due_date');
    n:=app.assert_json_number(p_payload,'billingMilestones.amount',0,null::numeric,true,'amountExclVat','amount_excl_vat','amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: milestone amount must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'billingMilestones.percentage',0,100,false,'percentage');
    select r.data into target from public.entity_records r where r.company_id=p_company and r.collection='contracts' and r.record_id=v and r.deleted_at is null;
    if target is not null and coalesce(target->>'projectId',target->>'project_id')<>v2 then raise exception 'CROSS_PROJECT_REFERENCE: milestone project differs from contract project' using errcode='23503'; end if;

  elsif p_collection='paymentAllocations' then
    v:=app.json_text(p_payload,'invoiceId','invoice_id'); perform app.assert_entity_ref(p_company,'taxInvoices',v,true,'paymentAllocations.invoiceId');
    perform app.assert_entity_ref(p_company,'finance',app.json_text(p_payload,'paymentId','payment_id'),false,'paymentAllocations.paymentId');
    perform app.assert_json_date(p_payload,'paymentAllocations.date',true,'date','allocationDate','allocation_date','paymentDate','payment_date');
    n:=app.assert_json_number(p_payload,'paymentAllocations.amount',0,null::numeric,true,'amount','allocatedAmount','allocated_amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: allocation amount must be positive' using errcode='22023'; end if;

  elsif p_collection='openingBalances' then
    perform app.assert_account_code(p_company,app.json_text(p_payload,'accountCode','account_code'),true,'openingBalances.accountCode');
    perform app.assert_json_date(p_payload,'openingBalances.asOfDate',true,'asOfDate','as_of_date');
    n:=coalesce(app.json_number(p_payload,'debit'),0); n2:=coalesce(app.json_number(p_payload,'credit'),0);
    if n<0 or n2<0 or (n>0 and n2>0) or (n=0 and n2=0) then raise exception 'INVALID_OPENING_BALANCE: enter exactly one positive debit or credit' using errcode='22023'; end if;

  elsif p_collection='accountingPeriods' then
    v:=app.assert_json_date(p_payload,'accountingPeriods.from',true,'from');
    v2:=app.assert_json_date(p_payload,'accountingPeriods.to',true,'to');
    if v2<v then raise exception 'INVALID_DATE_RANGE: accounting period to precedes from' using errcode='22023'; end if;

  elsif p_collection='projectBudgetVersions' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'projectBudgetVersions.projectId');
    perform app.assert_json_date(p_payload,'projectBudgetVersions.effectiveFrom',false,'effectiveFrom','effective_from');
    perform app.assert_json_number(p_payload,'projectBudgetVersions.directBudget',0,null::numeric,true,'directBudget','direct_budget');
    perform app.assert_json_number(p_payload,'projectBudgetVersions.contractValue',0,null::numeric,false,'contractValue','contract_value');

  elsif p_collection='projectBudgetLines' then
    perform app.assert_entity_ref(p_company,'projectBudgetVersions',app.json_text(p_payload,'budgetVersionId','budget_version_id'),true,'projectBudgetLines.budgetVersionId');
    n:=app.assert_json_number(p_payload,'projectBudgetLines.quantity',0,null::numeric,true,'quantity');
    n2:=app.assert_json_number(p_payload,'projectBudgetLines.unitRate',0,null::numeric,true,'unitRate','unit_rate');
    n3:=app.assert_json_number(p_payload,'projectBudgetLines.amount',0,null::numeric,false,'amount');
    if n3 is not null and abs(round(n*n2,0)-round(n3,0))>1 then raise exception 'FORMULA_MISMATCH: budget line amount must equal quantity times unit rate' using errcode='22023'; end if;

  elsif p_collection='resourcePlans' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'resourcePlans.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'personId','person_id'),true,'resourcePlans.personId');
    perform app.assert_json_month(p_payload,'resourcePlans.month',true,'month');
    perform app.assert_json_number(p_payload,'resourcePlans.plannedHours',0,null::numeric,true,'plannedHours','planned_hours','hours');
    perform app.assert_json_number(p_payload,'resourcePlans.costRate',0,null::numeric,false,'costRate','cost_rate','hourlyRate','hourly_rate');

  elsif p_collection='commitments' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'commitments.projectId');
    perform app.assert_json_date(p_payload,'commitments.dueDate',false,'dueDate','due_date');
    n:=app.assert_json_number(p_payload,'commitments.amount',0,null::numeric,true,'amount'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: commitment amount must be positive' using errcode='22023'; end if;
    n2:=coalesce(app.json_number(p_payload,'recognizedAmount','recognized_amount'),0); if n2<0 or n2>n then raise exception 'NUMBER_OUT_OF_RANGE: recognized commitment exceeds amount' using errcode='22023'; end if;

  elsif p_collection='projectStages' then
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),true,'projectStages.projectId');
    v:=app.assert_json_date(p_payload,'projectStages.plannedStart',true,'plannedStart','planned_start');
    v2:=app.assert_json_date(p_payload,'projectStages.plannedEnd',true,'plannedEnd','planned_end');
    if v2<v then raise exception 'INVALID_DATE_RANGE: project stage end precedes start' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'projectStages.weight',0,100,true,'weight','weightPercent','weight_percent');
    perform app.assert_json_number(p_payload,'projectStages.progress',0,100,false,'progress','progressPercent','progress_percent');

  elsif p_collection='purchaseRequests' then
    v:=app.assert_required_text(p_payload,'purchaseRequests.requestNo',120,'requestNo','request_no'); perform app.assert_unique_entity_text(p_company,'purchaseRequests',p_record_id,v,'purchaseRequests.requestNo','requestNo','request_no');
    perform app.assert_json_date(p_payload,'purchaseRequests.date',true,'date');
    perform app.assert_required_text(p_payload,'purchaseRequests.itemName',400,'itemName','item_name');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'requesterId','requester_id'),true,'purchaseRequests.requesterId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'purchaseRequests.projectId');
    n:=app.assert_json_number(p_payload,'purchaseRequests.quantity',0,null::numeric,true,'quantity'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: purchase request quantity must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'purchaseRequests.unitPrice',0,null::numeric,true,'unitPrice','unit_price');
    perform app.assert_json_number(p_payload,'purchaseRequests.vatRate',0,100,false,'vatRate','vat_rate');

  elsif p_collection='purchaseOrders' then
    v:=app.assert_required_text(p_payload,'purchaseOrders.poNo',120,'poNo','po_no'); perform app.assert_unique_entity_text(p_company,'purchaseOrders',p_record_id,v,'purchaseOrders.poNo','poNo','po_no');
    perform app.assert_json_date(p_payload,'purchaseOrders.orderDate',true,'orderDate','order_date');
    perform app.assert_json_date(p_payload,'purchaseOrders.invoiceDate',false,'invoiceDate','invoice_date');
    perform app.assert_entity_ref(p_company,'purchaseRequests',app.json_text(p_payload,'purchaseRequestId','purchase_request_id'),true,'purchaseOrders.purchaseRequestId');
    perform app.assert_entity_ref(p_company,'vendors',app.json_text(p_payload,'vendorId','vendor_id'),true,'purchaseOrders.vendorId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'purchaseOrders.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'custodianId','custodian_id'),false,'purchaseOrders.custodianId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'purchaseOrders.journalEntryId');
    n:=app.assert_json_number(p_payload,'purchaseOrders.quantity',0,null::numeric,true,'quantity'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: purchase order quantity must be positive' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'purchaseOrders.unitPrice',0,null::numeric,true,'unitPrice','unit_price'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: purchase order unit price must be positive' using errcode='22023'; end if;
    perform app.assert_json_number(p_payload,'purchaseOrders.vatRate',0,100,false,'vatRate','vat_rate');

  elsif p_collection='tools' then
    v:=app.assert_required_text(p_payload,'tools.toolCode',120,'toolCode','tool_code'); perform app.assert_unique_entity_text(p_company,'tools',p_record_id,v,'tools.toolCode','toolCode','tool_code');
    perform app.assert_required_text(p_payload,'tools.name',300,'name');
    perform app.assert_entity_ref(p_company,'purchaseOrders',app.json_text(p_payload,'purchaseOrderId','purchase_order_id'),false,'tools.purchaseOrderId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'tools.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'custodianId','custodian_id'),false,'tools.custodianId');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'expenseAccountCode','expense_account_code'),true,'tools.expenseAccountCode');
    perform app.assert_json_date(p_payload,'tools.startDate',true,'startDate','start_date');
    n:=app.assert_json_number(p_payload,'tools.originalCost',0,null::numeric,true,'originalCost','original_cost'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: tool original cost must be positive' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'tools.allocationMonths',1,1200,true,'allocationMonths','allocation_months'); if n<>trunc(n) then raise exception 'INVALID_INTEGER: tool allocationMonths' using errcode='22023'; end if;

  elsif p_collection='fixedAssets' then
    v:=app.assert_required_text(p_payload,'fixedAssets.assetCode',120,'assetCode','asset_code'); perform app.assert_unique_entity_text(p_company,'fixedAssets',p_record_id,v,'fixedAssets.assetCode','assetCode','asset_code');
    perform app.assert_required_text(p_payload,'fixedAssets.name',300,'name');
    perform app.assert_entity_ref(p_company,'purchaseOrders',app.json_text(p_payload,'purchaseOrderId','purchase_order_id'),false,'fixedAssets.purchaseOrderId');
    perform app.assert_entity_ref(p_company,'projects',app.json_text(p_payload,'projectId','project_id'),false,'fixedAssets.projectId');
    perform app.assert_entity_ref(p_company,'people',app.json_text(p_payload,'custodianId','custodian_id'),false,'fixedAssets.custodianId');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'assetAccountCode','asset_account_code'),true,'fixedAssets.assetAccountCode');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'depreciationAccountCode','depreciation_account_code'),true,'fixedAssets.depreciationAccountCode');
    perform app.assert_account_code(p_company,app.json_text(p_payload,'expenseAccountCode','expense_account_code'),true,'fixedAssets.expenseAccountCode');
    perform app.assert_json_date(p_payload,'fixedAssets.acquisitionDate',true,'acquisitionDate','acquisition_date');
    perform app.assert_json_date(p_payload,'fixedAssets.inServiceDate',true,'inServiceDate','in_service_date');
    n:=app.assert_json_number(p_payload,'fixedAssets.originalCost',0,null::numeric,true,'originalCost','original_cost'); if n<=0 then raise exception 'NUMBER_OUT_OF_RANGE: asset original cost must be positive' using errcode='22023'; end if;
    n2:=coalesce(app.json_number(p_payload,'residualValue','residual_value'),0); if n2<0 or n2>=n then raise exception 'NUMBER_OUT_OF_RANGE: asset residual value must be below original cost' using errcode='22023'; end if;
    n:=app.assert_json_number(p_payload,'fixedAssets.usefulLifeMonths',13,1200,true,'usefulLifeMonths','useful_life_months'); if n<>trunc(n) then raise exception 'INVALID_INTEGER: asset usefulLifeMonths' using errcode='22023'; end if;

  elsif p_collection='toolAllocationSchedules' then
    perform app.assert_entity_ref(p_company,'tools',app.json_text(p_payload,'sourceId','source_id'),true,'toolAllocationSchedules.sourceId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'toolAllocationSchedules.journalEntryId');
    perform app.assert_json_month(p_payload,'toolAllocationSchedules.period',true,'period');
    perform app.assert_json_number(p_payload,'toolAllocationSchedules.amount',0,null::numeric,true,'amount');

  elsif p_collection='depreciationSchedules' then
    perform app.assert_entity_ref(p_company,'fixedAssets',app.json_text(p_payload,'sourceId','source_id'),true,'depreciationSchedules.sourceId');
    perform app.assert_entity_ref(p_company,'journalEntries',app.json_text(p_payload,'journalEntryId','journal_entry_id'),false,'depreciationSchedules.journalEntryId');
    perform app.assert_json_month(p_payload,'depreciationSchedules.period',true,'period');
    perform app.assert_json_number(p_payload,'depreciationSchedules.amount',0,null::numeric,true,'amount');

  elsif p_collection='financialForecastScenarios' then
    perform app.assert_required_text(p_payload,'financialForecastScenarios.name',200,'name');
    perform app.assert_json_number(p_payload,'forecast.collectionRatePercent',0,100,false,'collectionRatePercent');
    perform app.assert_json_number(p_payload,'forecast.directCostRatioPercent',0,100,false,'directCostRatioPercent');
    perform app.assert_json_number(p_payload,'forecast.pipelineFactorPercent',0,500,false,'pipelineFactorPercent');
    perform app.assert_json_number(p_payload,'forecast.pipelineLagMonths',0,120,false,'pipelineLagMonths');
    perform app.assert_json_number(p_payload,'forecast.pipelineDeliveryMonths',1,120,false,'pipelineDeliveryMonths');
    perform app.assert_json_number(p_payload,'forecast.recurringRevenueShare',0,1,false,'recurringRevenueShare');
    perform app.assert_json_number(p_payload,'forecast.taxRatePercent',0,100,false,'taxRatePercent');
    perform app.assert_json_number(p_payload,'forecast.minimumCashBuffer',0,null::numeric,false,'minimumCashBuffer');

  elsif p_collection in ('financialAnalysisSnapshots','financialLinkAuditRuns','exportLogs','importLogs') then
    perform app.assert_json_date(p_payload,p_collection||'.date',false,'date','runDate','run_date','createdDate','created_date');

  else
    raise exception 'UNVALIDATED_COLLECTION: %',p_collection using errcode='22023';
  end if;
end $$;

-- All browser writes must pass this idempotent, version-aware RPC. Direct table
-- insert/update grants are removed below so clients cannot bypass conflict detection.
create or replace function app.apply_entity_change(
  p_company uuid,
  p_collection text,
  p_record_id text,
  p_payload jsonb,
  p_deleted boolean,
  p_expected_version bigint,
  p_idempotency_key uuid
) returns table(
  ok boolean,
  conflict boolean,
  row_version bigint,
  data jsonb,
  deleted boolean,
  server_data jsonb,
  server_deleted boolean,
  server_version bigint
)
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare
  r public.entity_records;
  next_version bigint;
  permission_code text;
  idem record;
  response jsonb;
begin
  perform app.assert_operational_write_allowed(p_company);
  perform app.assert_company_access(p_company);
  if coalesce((select require_mfa_for_privileged from public.companies where id=p_company),true)
     and app.user_is_privileged(p_company) and app.current_aal()<>'aal2' then
    raise exception 'MFA AAL2 required for privileged write' using errcode='42501';
  end if;
  permission_code:=app.collection_permission(p_collection,true);
  if permission_code is null then raise exception 'unsupported collection' using errcode='22023'; end if;
  if not app.has_permission(permission_code,p_company)
     and not app.has_permission('data.write',p_company) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='22023'; end if;
  if p_payload is null then raise exception 'payload is required' using errcode='22023'; end if;
  if p_collection='notificationReads' then
    if jsonb_typeof(p_payload)<>'array' then raise exception 'notificationReads payload must be a JSON array' using errcode='22023'; end if;
  elsif jsonb_typeof(p_payload)<>'object' then
    raise exception 'payload must be a JSON object' using errcode='22023';
  end if;
  if not coalesce(p_deleted,false) then perform app.validate_entity_payload(p_company,p_collection,p_record_id,p_payload); end if;

  select * into idem from app.begin_idempotent_request(
    p_company,p_idempotency_key,'entity.change',
    jsonb_build_object('collection',p_collection,'record_id',p_record_id,'payload',p_payload,'deleted',p_deleted,'expected_version',p_expected_version)
  );
  if idem.status='completed' and idem.response_payload is not null then
    return query select
      coalesce((idem.response_payload->>'ok')::boolean,false),
      coalesce((idem.response_payload->>'conflict')::boolean,false),
      coalesce((idem.response_payload->>'row_version')::bigint,0),
      coalesce(idem.response_payload->'data','{}'::jsonb),
      coalesce((idem.response_payload->>'deleted')::boolean,false),
      idem.response_payload->'server_data',
      coalesce((idem.response_payload->>'server_deleted')::boolean,false),
      coalesce((idem.response_payload->>'server_version')::bigint,0);
    return;
  end if;
  if not coalesce(idem.is_new,false) and idem.status='processing' then
    raise exception 'idempotent request is already processing' using errcode='40001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|'||p_collection||'|'||p_record_id,0));
  select * into r from public.entity_records
    where company_id=p_company and collection=p_collection and record_id=p_record_id
    for update;

  if found and r.row_version<>coalesce(p_expected_version,0) then
    response:=jsonb_build_object(
      'ok',false,'conflict',true,'row_version',r.row_version,
      'data',r.data,'deleted',r.deleted_at is not null,
      'server_data',r.data,'server_deleted',r.deleted_at is not null,'server_version',r.row_version
    );
    perform app.complete_idempotent_request(p_company,p_idempotency_key,response);
    return query select false,true,r.row_version,r.data,(r.deleted_at is not null),r.data,(r.deleted_at is not null),r.row_version;
    return;
  end if;

  if not found and coalesce(p_expected_version,0)<>0 then
    response:=jsonb_build_object('ok',false,'conflict',true,'row_version',0,'data','{}'::jsonb,'deleted',true,'server_data','{}'::jsonb,'server_deleted',true,'server_version',0);
    perform app.complete_idempotent_request(p_company,p_idempotency_key,response);
    return query select false,true,0,'{}'::jsonb,true,'{}'::jsonb,true,0;
    return;
  end if;

  next_version:=coalesce(r.row_version,0)+1;
  insert into public.entity_records(company_id,collection,record_id,data,row_version,deleted_at)
  values(p_company,p_collection,p_record_id,p_payload,next_version,case when p_deleted then clock_timestamp() else null end)
  on conflict(company_id,collection,record_id) do update set
    data=excluded.data,row_version=excluded.row_version,deleted_at=excluded.deleted_at;

  response:=jsonb_build_object('ok',true,'conflict',false,'row_version',next_version,'data',p_payload,'deleted',p_deleted,'server_data',null,'server_deleted',false,'server_version',next_version);
  perform app.complete_idempotent_request(p_company,p_idempotency_key,response);
  perform app.append_audit(p_company,'entity_records',p_collection||':'||p_record_id,case when p_deleted then 'SOFT_DELETE' else 'UPSERT' end,to_jsonb(r),response);
  return query select true,false,next_version,p_payload,p_deleted,null::jsonb,false,next_version;
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

-- Authenticated clients can read through RLS but may mutate only through
-- public.apply_entity_change, which enforces idempotency and optimistic concurrency.
revoke insert,update,delete on public.entity_records from authenticated;
grant select on public.entity_records to authenticated;
revoke all on function app.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) from public,anon,authenticated;
revoke all on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) from public,anon;
grant execute on function public.apply_entity_change(uuid,text,text,jsonb,boolean,bigint,uuid) to authenticated;

-- Security-definer helpers are trigger-internal only. Do not expose cross-tenant probes.
revoke all on function app.entity_ref_exists(uuid,text,text) from public,anon,authenticated;
revoke all on function app.entity_account_code_exists(uuid,text) from public,anon,authenticated;
revoke all on function app.json_text(jsonb,text[]) from public,anon,authenticated;
revoke all on function app.is_iso_date_text(text) from public,anon,authenticated;
revoke all on function app.json_number(jsonb,text[]) from public,anon,authenticated;
revoke all on function app.assert_required_text(jsonb,text,integer,text[]) from public,anon,authenticated;
revoke all on function app.assert_json_date(jsonb,text,boolean,text[]) from public,anon,authenticated;
revoke all on function app.assert_json_month(jsonb,text,boolean,text[]) from public,anon,authenticated;
revoke all on function app.assert_json_number(jsonb,text,numeric,numeric,boolean,text[]) from public,anon,authenticated;
revoke all on function app.assert_entity_ref(uuid,text,text,boolean,text) from public,anon,authenticated;
revoke all on function app.assert_account_code(uuid,text,boolean,text) from public,anon,authenticated;
revoke all on function app.assert_unique_entity_text(uuid,text,text,text,text,text[]) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.entity_record_guard() from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.3';
update public.companies set active_release_version='4.5.3' where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2');
insert into public.schema_versions(version,description) values
('4.5.3','Integrity and security hardening: complete server-side validation for every synchronized collection, operational kill-switch preservation, private tenant-safe helpers, dependency-safe deletion, deterministic formulas and clean production package')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
