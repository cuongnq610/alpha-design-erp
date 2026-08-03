-- ALPHA DESIGN ERP Cloud v4.5.27
-- Production invariants: exact cash-journal evidence, immutable Posted asset
-- schedules, parent-side allocation caps and complete dependency-safe deletion.
begin;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_v455;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  status_value text;
  type_value text;
  journal_id text;
  project_id text;
  source_id text;
  period_value text;
  journal_row jsonb;
  current_row jsonb;
  schedule_row jsonb;
  amount_value numeric:=0;
  allocated_value numeric:=0;
  cash_net numeric:=0;
  debit_total numeric:=0;
  credit_total numeric:=0;
  protected_schedule boolean:=false;
begin
  perform app.validate_entity_payload_v455(p_company,p_collection,p_record_id,p_payload);

  if p_collection='finance' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
    type_value:=lower(coalesce(app.json_text(p_payload,'type'),''));
    journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id');
    project_id:=app.json_text(p_payload,'projectId','project_id');
    amount_value:=app.json_numeric_or_zero(p_payload,'amount');

    if status_value='paid' then
      if journal_id is null then
        raise exception 'FINANCE_JOURNAL_REQUIRED: Paid finance requires a Posted cash journal' using errcode='23503';
      end if;
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|finance-journal|'||journal_id,0));
      select r.data into journal_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=journal_id and r.deleted_at is null;
      if journal_row is null or lower(coalesce(journal_row->>'status',''))<>'posted' then
        raise exception 'FINANCE_JOURNAL_NOT_POSTED: Paid finance requires a Posted journal' using errcode='23503';
      end if;
      if coalesce(journal_row->>'date','')<>coalesce(p_payload->>'date','') then
        raise exception 'FINANCE_JOURNAL_DATE_MISMATCH: finance and journal dates must match' using errcode='23514';
      end if;
      select coalesce(sum(
        case when coalesce(app.json_text(line.value,'accountCode','account_code'),'') ~ '^(111|112)'
          then app.json_numeric_or_zero(line.value,'debit')-app.json_numeric_or_zero(line.value,'credit')
          else 0 end
      ),0)
      into cash_net
      from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value);
      if (type_value='income' and round(cash_net,0)<>round(amount_value,0))
         or (type_value='expense' and round(cash_net,0)<>-round(amount_value,0)) then
        raise exception 'FINANCE_JOURNAL_AMOUNT_MISMATCH: net 111/112 movement must equal Paid finance amount and direction' using errcode='23514';
      end if;
      if project_id is not null
         and coalesce(journal_row->>'projectId',journal_row->>'project_id','')<>project_id
         and not exists(
           select 1
           from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value)
           where coalesce(line.value->>'projectId',line.value->>'project_id','')=project_id
         ) then
        raise exception 'FINANCE_JOURNAL_PROJECT_MISMATCH: finance project must be present on the journal' using errcode='23514';
      end if;
      if exists(
        select 1 from public.entity_records r
        where r.company_id=p_company and r.collection='finance'
          and r.record_id<>p_record_id and r.deleted_at is null
          and lower(coalesce(r.data->>'status',''))='paid'
          and coalesce(r.data->>'journalEntryId',r.data->>'journal_entry_id',r.data->>'postingId',r.data->>'posting_id')=journal_id
      ) then
        raise exception 'DUPLICATE_FINANCE_JOURNAL_LINK: one cash journal cannot support multiple Paid finance rows' using errcode='23505';
      end if;
    elsif journal_id is not null then
      raise exception 'FINANCE_JOURNAL_PENDING_LINK: only Paid finance may link a Posted cash journal' using errcode='23514';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|payment-allocation|'||p_record_id,0));
    select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
    into allocated_value
    from public.entity_records r
    where r.company_id=p_company and r.collection='paymentAllocations'
      and r.deleted_at is null
      and coalesce(r.data->>'paymentId',r.data->>'payment_id')=p_record_id
      and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
    if allocated_value>0 then
      if status_value<>'paid' or type_value<>'income' then
        raise exception 'ALLOCATED_PAYMENT_IMMUTABLE: allocated payment must remain Paid Income' using errcode='23514';
      end if;
      if round(amount_value,0)+1<round(allocated_value,0) then
        raise exception 'ALLOCATED_PAYMENT_AMOUNT: payment amount cannot be below recognized allocations' using errcode='23514';
      end if;
      if exists(
        select 1 from public.entity_records a
        where a.company_id=p_company and a.collection='paymentAllocations'
          and a.deleted_at is null
          and coalesce(a.data->>'paymentId',a.data->>'payment_id')=p_record_id
          and lower(coalesce(a.data->>'status','posted')) in ('posted','paid','applied','completed')
          and coalesce(a.data->>'date',a.data->>'allocationDate',a.data->>'allocation_date',a.data->>'paymentDate',a.data->>'payment_date','')<coalesce(p_payload->>'date','')
      ) then
        raise exception 'ALLOCATED_PAYMENT_DATE: payment date cannot follow an allocation date' using errcode='23514';
      end if;
      if exists(
        select 1
        from public.entity_records a
        join public.entity_records i
          on i.company_id=a.company_id and i.collection='taxInvoices'
         and i.record_id=coalesce(a.data->>'invoiceId',a.data->>'invoice_id') and i.deleted_at is null
        where a.company_id=p_company and a.collection='paymentAllocations'
          and a.deleted_at is null
          and coalesce(a.data->>'paymentId',a.data->>'payment_id')=p_record_id
          and lower(coalesce(a.data->>'status','posted')) in ('posted','paid','applied','completed')
          and coalesce(i.data->>'projectId',i.data->>'project_id','')<>''
          and coalesce(i.data->>'projectId',i.data->>'project_id')<>coalesce(project_id,'')
      ) then
        raise exception 'ALLOCATED_PAYMENT_PROJECT: payment project differs from an allocated invoice' using errcode='23514';
      end if;
    end if;

  elsif p_collection='taxInvoices' then
    perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|invoice-allocation|'||p_record_id,0));
    select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
    into allocated_value
    from public.entity_records r
    where r.company_id=p_company and r.collection='paymentAllocations'
      and r.deleted_at is null
      and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=p_record_id
      and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
    if allocated_value>0 then
      status_value:=lower(coalesce(app.json_text(p_payload,'status'),'valid'));
      if lower(coalesce(app.json_text(p_payload,'direction'),''))<>'output'
         or status_value in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'ALLOCATED_INVOICE_IMMUTABLE: allocated invoice must remain a recognized Output invoice' using errcode='23514';
      end if;
      amount_value:=app.json_numeric_or_zero(p_payload,'totalAmount','total_amount');
      if round(amount_value,0)+1<round(allocated_value,0) then
        raise exception 'ALLOCATED_INVOICE_AMOUNT: invoice total cannot be below recognized allocations' using errcode='23514';
      end if;
      project_id:=app.json_text(p_payload,'projectId','project_id');
      if exists(
        select 1
        from public.entity_records a
        join public.entity_records f
          on f.company_id=a.company_id and f.collection='finance'
         and f.record_id=coalesce(a.data->>'paymentId',a.data->>'payment_id') and f.deleted_at is null
        where a.company_id=p_company and a.collection='paymentAllocations'
          and a.deleted_at is null
          and coalesce(a.data->>'invoiceId',a.data->>'invoice_id')=p_record_id
          and lower(coalesce(a.data->>'status','posted')) in ('posted','paid','applied','completed')
          and coalesce(f.data->>'projectId',f.data->>'project_id','')<>''
          and coalesce(f.data->>'projectId',f.data->>'project_id')<>coalesce(project_id,'')
      ) then
        raise exception 'ALLOCATED_INVOICE_PROJECT: invoice project differs from an allocated payment' using errcode='23514';
      end if;
    end if;

  elsif p_collection in ('tools','fixedAssets') then
    source_id:=p_record_id;
    perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|asset-schedule|'||p_collection||'|'||source_id,0));
    select r.data into current_row
    from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null;
    if current_row is not null then
      select exists(
        select 1
        from public.entity_records s
        left join public.entity_records j
          on j.company_id=s.company_id and j.collection='journalEntries'
         and j.record_id=coalesce(s.data->>'journalEntryId',s.data->>'journal_entry_id') and j.deleted_at is null
        where s.company_id=p_company and s.deleted_at is null
          and s.collection=case when p_collection='tools' then 'toolAllocationSchedules' else 'depreciationSchedules' end
          and coalesce(s.data->>'sourceId',s.data->>'source_id')=source_id
          and (lower(coalesce(s.data->>'status',''))='posted' or lower(coalesce(j.data->>'status',''))='posted')
      ) into protected_schedule;
      if protected_schedule and (
        (p_collection='tools' and (
          coalesce(current_row->>'startDate',current_row->>'start_date','') is distinct from coalesce(p_payload->>'startDate',p_payload->>'start_date','')
          or app.json_numeric_or_zero(current_row,'originalCost','original_cost') is distinct from app.json_numeric_or_zero(p_payload,'originalCost','original_cost')
          or app.json_numeric_or_zero(current_row,'allocationMonths','allocation_months') is distinct from app.json_numeric_or_zero(p_payload,'allocationMonths','allocation_months')
          or coalesce(current_row->>'expenseAccountCode',current_row->>'expense_account_code','') is distinct from coalesce(p_payload->>'expenseAccountCode',p_payload->>'expense_account_code','')
          or coalesce(current_row->>'projectId',current_row->>'project_id','') is distinct from coalesce(p_payload->>'projectId',p_payload->>'project_id','')
        ))
        or (p_collection='fixedAssets' and (
          coalesce(current_row->>'acquisitionDate',current_row->>'acquisition_date','') is distinct from coalesce(p_payload->>'acquisitionDate',p_payload->>'acquisition_date','')
          or coalesce(current_row->>'inServiceDate',current_row->>'in_service_date','') is distinct from coalesce(p_payload->>'inServiceDate',p_payload->>'in_service_date','')
          or app.json_numeric_or_zero(current_row,'originalCost','original_cost') is distinct from app.json_numeric_or_zero(p_payload,'originalCost','original_cost')
          or app.json_numeric_or_zero(current_row,'residualValue','residual_value') is distinct from app.json_numeric_or_zero(p_payload,'residualValue','residual_value')
          or app.json_numeric_or_zero(current_row,'usefulLifeMonths','useful_life_months') is distinct from app.json_numeric_or_zero(p_payload,'usefulLifeMonths','useful_life_months')
          or coalesce(current_row->>'depreciationAccountCode',current_row->>'depreciation_account_code','') is distinct from coalesce(p_payload->>'depreciationAccountCode',p_payload->>'depreciation_account_code','')
          or coalesce(current_row->>'expenseAccountCode',current_row->>'expense_account_code','') is distinct from coalesce(p_payload->>'expenseAccountCode',p_payload->>'expense_account_code','')
          or coalesce(current_row->>'projectId',current_row->>'project_id','') is distinct from coalesce(p_payload->>'projectId',p_payload->>'project_id','')
        ))
      ) then
        raise exception 'POSTED_SCHEDULE_IMMUTABLE: financial schedule drivers cannot change after a period is Posted' using errcode='23514';
      end if;
    end if;

  elsif p_collection in ('toolAllocationSchedules','depreciationSchedules') then
    source_id:=app.json_text(p_payload,'sourceId','source_id');
    period_value:=app.json_text(p_payload,'period');
    journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id');
    amount_value:=app.json_numeric_or_zero(p_payload,'amount');
    if amount_value<=0 then
      raise exception 'SCHEDULE_AMOUNT: allocation/depreciation amount must be positive' using errcode='23514';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(
      p_company::text||'|asset-schedule|'||
      case when p_collection='toolAllocationSchedules' then 'tools' else 'fixedAssets' end||'|'||source_id,0));
    select r.data into current_row
    from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null;
    if current_row is not null then
      select r.data into journal_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=coalesce(current_row->>'journalEntryId',current_row->>'journal_entry_id') and r.deleted_at is null;
      if lower(coalesce(current_row->>'status',''))='posted' or lower(coalesce(journal_row->>'status',''))='posted' then
        if coalesce(current_row->>'sourceId',current_row->>'source_id','') is distinct from source_id
           or coalesce(current_row->>'period','') is distinct from period_value
           or app.json_numeric_or_zero(current_row,'amount') is distinct from amount_value
           or coalesce(current_row->>'journalEntryId',current_row->>'journal_entry_id','') is distinct from coalesce(journal_id,'') then
          raise exception 'POSTED_SCHEDULE_ROW_IMMUTABLE: Posted schedule rows cannot change' using errcode='23514';
        end if;
        if lower(coalesce(current_row->>'status','')) is distinct from lower(coalesce(p_payload->>'status','')) then
          raise exception 'POSTED_SCHEDULE_ROW_IMMUTABLE: Posted schedule rows cannot change' using errcode='23514';
        end if;
      end if;
    end if;
    if journal_id is not null then
      select r.data into journal_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=journal_id and r.deleted_at is null;
      select
        coalesce(sum(app.json_numeric_or_zero(line.value,'debit')),0),
        coalesce(sum(app.json_numeric_or_zero(line.value,'credit')),0)
      into debit_total,credit_total
      from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value);
      if journal_row is null
         or lower(coalesce(journal_row->>'sourceType',journal_row->>'source_type',''))<>
            (case when p_collection='toolAllocationSchedules' then 'tool_allocation' else 'asset_depreciation' end)
         or coalesce(journal_row->>'sourceId',journal_row->>'source_id','')<>source_id||':'||period_value
         or left(coalesce(journal_row->>'date',''),7)<>period_value
         or abs(round(debit_total,0)-round(amount_value,0))>0
         or abs(round(credit_total,0)-round(amount_value,0))>0 then
        raise exception 'SCHEDULE_JOURNAL_MISMATCH: schedule source, period and amount must match its journal' using errcode='23514';
      end if;
    end if;

  elsif p_collection='journalEntries'
        and lower(coalesce(app.json_text(p_payload,'status'),''))='posted'
        and lower(coalesce(app.json_text(p_payload,'sourceType','source_type'),'')) in ('tool_allocation','asset_depreciation') then
    source_id:=app.json_text(p_payload,'sourceId','source_id');
    period_value:=right(source_id,7);
    source_id:=left(source_id,greatest(0,length(source_id)-8));
    perform pg_advisory_xact_lock(hashtextextended(
      p_company::text||'|asset-schedule|'||
      case when lower(coalesce(app.json_text(p_payload,'sourceType','source_type'),''))='tool_allocation' then 'tools' else 'fixedAssets' end||'|'||source_id,0));
    select r.data into schedule_row
    from public.entity_records r
    where r.company_id=p_company and r.deleted_at is null
      and r.collection=case when lower(coalesce(app.json_text(p_payload,'sourceType','source_type'),''))='tool_allocation' then 'toolAllocationSchedules' else 'depreciationSchedules' end
      and coalesce(r.data->>'sourceId',r.data->>'source_id')=source_id
      and coalesce(r.data->>'period','')=period_value
    limit 1;
    select
      coalesce(sum(app.json_numeric_or_zero(line.value,'debit')),0),
      coalesce(sum(app.json_numeric_or_zero(line.value,'credit')),0)
    into debit_total,credit_total
    from jsonb_array_elements(case when jsonb_typeof(p_payload->'lines')='array' then p_payload->'lines' else '[]'::jsonb end) line(value);
    if schedule_row is null
       or coalesce(schedule_row->>'journalEntryId',schedule_row->>'journal_entry_id','')<>p_record_id
       or coalesce(schedule_row->>'period','')<>left(coalesce(p_payload->>'date',''),7)
       or abs(round(app.json_numeric_or_zero(schedule_row,'amount'),0)-round(debit_total,0))>0
       or abs(round(app.json_numeric_or_zero(schedule_row,'amount'),0)-round(credit_total,0))>0 then
      raise exception 'SCHEDULE_POSTING_MISMATCH: auto journal must match its linked schedule before posting' using errcode='23514';
    end if;
  end if;
end $$;

alter function app.assert_entity_delete_safe(uuid,text,text)
  rename to assert_entity_delete_safe_v453;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare
  existing_row jsonb;
  journal_row jsonb;
begin
  perform app.assert_entity_delete_safe_v453(p_company,p_collection,p_record_id);

  if p_collection='projects' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='journalEntries' and r.deleted_at is null
      and (
        coalesce(r.data->>'projectId',r.data->>'project_id')=p_record_id
        or exists(
          select 1 from jsonb_array_elements(case when jsonb_typeof(r.data->'lines')='array' then r.data->'lines' else '[]'::jsonb end) line(value)
          where coalesce(line.value->>'projectId',line.value->>'project_id')=p_record_id
        )
      )
  ) then raise exception 'DEPENDENCY_EXISTS: project is referenced by journal entries' using errcode='23503'; end if;

  if p_collection in ('people','clients','vendors') and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='journalEntries' and r.deleted_at is null
      and (
        (((p_collection='people' and lower(coalesce(r.data->>'partnerType',r.data->>'partner_type','')) in ('person','employee'))
          or (p_collection<>'people' and lower(coalesce(r.data->>'partnerType',r.data->>'partner_type',''))=
            case when p_collection='clients' then 'client' else 'vendor' end))
         and coalesce(r.data->>'partnerId',r.data->>'partner_id')=p_record_id)
        or exists(
          select 1 from jsonb_array_elements(case when jsonb_typeof(r.data->'lines')='array' then r.data->'lines' else '[]'::jsonb end) line(value)
          where ((p_collection='people' and lower(coalesce(line.value->>'partnerType',line.value->>'partner_type','')) in ('person','employee'))
            or (p_collection<>'people' and lower(coalesce(line.value->>'partnerType',line.value->>'partner_type',''))=
              case when p_collection='clients' then 'client' else 'vendor' end))
            and coalesce(line.value->>'partnerId',line.value->>'partner_id')=p_record_id
        )
      )
  ) then raise exception 'DEPENDENCY_EXISTS: party is referenced by journal entries' using errcode='23503'; end if;

  if p_collection in ('clients','vendors') and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='taxInvoices' and r.deleted_at is null
      and lower(coalesce(r.data->>'partnerType',r.data->>'partner_type',''))=
        case when p_collection='clients' then 'client' else 'vendor' end
      and coalesce(r.data->>'partnerId',r.data->>'partner_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: party is referenced by tax invoices' using errcode='23503'; end if;

  if p_collection='people' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='pitWithholdings' and r.deleted_at is null
      and lower(coalesce(r.data->>'recipientType',r.data->>'recipient_type','')) in ('person','employee')
      and coalesce(r.data->>'recipientId',r.data->>'recipient_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: person is referenced by PIT records' using errcode='23503'; end if;

  if p_collection in ('toolAllocationSchedules','depreciationSchedules') then
    select r.data into existing_row
    from public.entity_records r
    where r.company_id=p_company and r.collection=p_collection
      and r.record_id=p_record_id and r.deleted_at is null;
    select r.data into journal_row
    from public.entity_records r
    where r.company_id=p_company and r.collection='journalEntries'
      and r.record_id=coalesce(existing_row->>'journalEntryId',existing_row->>'journal_entry_id') and r.deleted_at is null;
    if lower(coalesce(existing_row->>'status',''))='posted' or lower(coalesce(journal_row->>'status',''))='posted' then
      raise exception 'POSTED_SCHEDULE_DELETE: Posted schedule rows cannot be deleted' using errcode='23503';
    end if;
  end if;
end $$;

revoke all on function app.validate_entity_payload_v455(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe_v453(uuid,text,text) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;

alter table public.companies
  alter column active_release_version set default '4.5.27';

update public.companies
set active_release_version='4.5.27'
where active_release_version is null
   or active_release_version in ('4.5.21','4.5.22','4.5.23','4.5.24','4.5.25','4.5.26');

insert into public.schema_versions(version,description) values
('4.5.27','Production invariant hardening: exact one-to-one Paid cash journals, parent-side invoice/payment allocation guards, immutable Posted asset schedules and complete dependency-safe deletion')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

commit;
