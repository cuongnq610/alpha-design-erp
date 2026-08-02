-- ALPHA DESIGN ERP Cloud v4.5.5
-- Deep formula audit: PIT workflow/math, payment-allocation evidence and temporal ordering.
begin;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_v454;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  status_value text;
  journal_id text;
  payment_id text;
  allocation_date text;
  gross_value numeric:=0;
  taxable_value numeric:=0;
  tax_value numeric:=0;
  net_value numeric:=0;
  rate_value numeric:=0;
  journal_row jsonb;
  payment_row jsonb;
  recognized boolean:=false;
begin
  perform app.validate_entity_payload_v454(p_company,p_collection,p_record_id,p_payload);

  if p_collection='pitWithholdings' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
    if status_value not in ('pending','withheld','declared','paid','posted','approved','completed','cancelled','canceled','deleted','void') then
      raise exception 'INVALID_ENUM: pitWithholdings.status' using errcode='22023';
    end if;

    gross_value:=app.json_numeric_or_zero(p_payload,'grossIncome','gross_income','grossAmount','gross_amount');
    taxable_value:=app.json_numeric_or_zero(p_payload,'taxableIncome','taxable_income');
    tax_value:=app.json_numeric_or_zero(p_payload,'taxWithheld','tax_withheld','taxAmount','tax_amount');
    net_value:=app.json_numeric_or_zero(p_payload,'netPaid','net_paid','netAmount','net_amount');
    rate_value:=app.json_numeric_or_zero(p_payload,'rate','withholdingRate','withholding_rate');
    if gross_value<=0 or taxable_value<0 or taxable_value>gross_value
       or tax_value<0 or tax_value>gross_value or rate_value<0 or rate_value>100 then
      raise exception 'FORMULA_RANGE: invalid PIT gross/taxable/tax/rate values' using errcode='23514';
    end if;
    if round(net_value,0)<>round(gross_value-tax_value,0) then
      raise exception 'FORMULA_MISMATCH: PIT net must equal gross minus tax' using errcode='23514';
    end if;

    recognized:=status_value in ('withheld','declared','paid','posted','approved','completed');
    if recognized then
      journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id');
      if journal_id is null then
        raise exception 'MISSING_REFERENCE: recognized PIT requires Posted journal entry' using errcode='23503';
      end if;
      select r.data into journal_row from public.entity_records r
      where r.company_id=p_company and r.collection='journalEntries'
        and r.record_id=journal_id and r.deleted_at is null;
      if journal_row is null or lower(coalesce(journal_row->>'status',''))<>'posted' then
        raise exception 'INVALID_LINK_STATUS: recognized PIT requires Posted journal entry' using errcode='23503';
      end if;
    end if;

  elsif p_collection='paymentAllocations' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'posted'));
    recognized:=status_value in ('posted','paid','applied','completed');
    if recognized then
      payment_id:=app.json_text(p_payload,'paymentId','payment_id');
      if payment_id is null then
        raise exception 'MISSING_REFERENCE: recognized allocation requires Paid Income finance' using errcode='23503';
      end if;
      allocation_date:=app.json_text(p_payload,'date','allocationDate','allocation_date','paymentDate','payment_date');
      select r.data into payment_row from public.entity_records r
      where r.company_id=p_company and r.collection='finance'
        and r.record_id=payment_id and r.deleted_at is null;
      if payment_row is null or lower(coalesce(payment_row->>'type',''))<>'income'
         or lower(coalesce(payment_row->>'status',''))<>'paid' then
        raise exception 'INVALID_LINK_STATUS: recognized allocation requires Paid Income finance' using errcode='23503';
      end if;
      if allocation_date is null or coalesce(payment_row->>'date','')=''
         or allocation_date<coalesce(payment_row->>'date','') then
        raise exception 'DATE_ORDER: allocation date must not precede payment date' using errcode='23514';
      end if;
    end if;
  end if;
end $$;

revoke all on function app.validate_entity_payload_v454(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.5';
update public.companies
set active_release_version='4.5.5'
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3','4.5.4');

insert into public.schema_versions(version,description) values
('4.5.5','Unified UI rhythm and navigation; PIT status/date thresholds; inclusive CIT boundary; fail-closed payment allocations; Posted-only project cost linkage and net VAT ledger reconciliation')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
