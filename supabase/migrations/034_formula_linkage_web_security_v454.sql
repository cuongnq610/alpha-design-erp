-- ALPHA DESIGN ERP Cloud v4.5.4
-- Formula-status alignment, atomic cross-module linkage guards and recursive JSON hardening.
begin;

-- Preserve the complete v4.5.3 validator and layer strict cross-record controls on top.
alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_v453;

create or replace function app.json_has_unsafe_key(p_value jsonb)
returns boolean language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare
  k text;
  v jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for k,v in select key,value from jsonb_each(p_value) loop
      if lower(k) in ('__proto__','prototype','constructor') or app.json_has_unsafe_key(v) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v in select value from jsonb_array_elements(p_value) loop
      if app.json_has_unsafe_key(v) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create or replace function app.json_numeric_or_zero(p_payload jsonb,variadic p_keys text[])
returns numeric language plpgsql immutable
set search_path=pg_catalog,public,app as $$
declare v text;
begin
  v:=app.json_text(p_payload,variadic p_keys);
  if v is null or length(v)>80 or v !~ '^[+-]?[0-9]+([.][0-9]+)?$' then return 0; end if;
  return v::numeric;
end $$;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  v text;
  v2 text;
  invoice_id text;
  payment_id text;
  status_value text;
  invoice_row jsonb;
  payment_row jsonb;
  contract_row jsonb;
  amount_value numeric:=0;
  existing_total numeric:=0;
  target_total numeric:=0;
  current_percent numeric:=0;
  existing_percent numeric:=0;
  recognized boolean:=false;
begin
  perform app.validate_entity_payload_v453(p_company,p_collection,p_record_id,p_payload);

  if app.json_has_unsafe_key(p_payload) then
    raise exception 'UNSAFE_JSON_KEY: nested unsafe JSON property name' using errcode='22023';
  end if;

  if p_collection='finance' then
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
    if status_value not in ('pending','paid','cancelled','canceled') then
      raise exception 'INVALID_ENUM: finance.status' using errcode='22023';
    end if;

  elsif p_collection='taxInvoices' then
    v:=lower(app.assert_required_text(p_payload,'taxInvoices.direction',20,'direction'));
    if v not in ('input','output') then
      raise exception 'INVALID_ENUM: taxInvoices.direction' using errcode='22023';
    end if;
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'valid'));
    if status_value not in ('draft','pending','review','valid','adjusted','issued','posted','approved','accepted','active','completed','replaced','cancelled','canceled') then
      raise exception 'INVALID_ENUM: taxInvoices.status' using errcode='22023';
    end if;
    v:=app.json_text(p_payload,'contractId','contract_id');
    v2:=app.json_text(p_payload,'projectId','project_id');
    if v is not null and v2 is not null then
      select r.data into contract_row from public.entity_records r
      where r.company_id=p_company and r.collection='contracts'
        and r.record_id=v and r.deleted_at is null;
      if contract_row is not null and coalesce(contract_row->>'projectId',contract_row->>'project_id','')<>v2 then
        raise exception 'CROSS_PROJECT_REFERENCE: invoice project differs from contract project' using errcode='23503';
      end if;
    end if;

  elsif p_collection='paymentAllocations' then
    invoice_id:=app.json_text(p_payload,'invoiceId','invoice_id');
    payment_id:=app.json_text(p_payload,'paymentId','payment_id');
    status_value:=lower(coalesce(app.json_text(p_payload,'status'),'posted'));
    if status_value not in ('draft','posted','paid','applied','completed','cancelled','canceled','deleted','void') then
      raise exception 'INVALID_ENUM: paymentAllocations.status' using errcode='22023';
    end if;
    recognized:=status_value in ('posted','paid','applied','completed');
    if recognized then
      -- Serialize every recognized allocation for the same invoice, preventing
      -- concurrent browser requests from both passing an over-allocation check.
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|invoice-allocation|'||invoice_id,0));
      select r.data into invoice_row from public.entity_records r
      where r.company_id=p_company and r.collection='taxInvoices'
        and r.record_id=invoice_id and r.deleted_at is null;
      if lower(coalesce(invoice_row->>'direction',''))<>'output' then
        raise exception 'INVALID_LINK_DIRECTION: receipt allocation requires an output invoice' using errcode='23503';
      end if;
      if lower(coalesce(invoice_row->>'status','valid')) in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'INVALID_LINK_STATUS: allocation requires a recognized invoice' using errcode='23503';
      end if;
      amount_value:=app.json_numeric_or_zero(p_payload,'amount','allocatedAmount','allocated_amount');
      target_total:=app.json_numeric_or_zero(invoice_row,'totalAmount','total_amount');
      select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
      into existing_total
      from public.entity_records r
      where r.company_id=p_company and r.collection='paymentAllocations'
        and r.record_id<>p_record_id and r.deleted_at is null
        and coalesce(r.data->>'invoiceId',r.data->>'invoice_id')=invoice_id
        and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
      if round(existing_total+amount_value,0)>round(target_total,0)+1 then
        raise exception 'OVER_ALLOCATION: recognized allocations exceed invoice total' using errcode='23514';
      end if;

      if payment_id is not null then
        perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|payment-allocation|'||payment_id,0));
        select r.data into payment_row from public.entity_records r
        where r.company_id=p_company and r.collection='finance'
          and r.record_id=payment_id and r.deleted_at is null;
        if lower(coalesce(payment_row->>'type',''))<>'income'
           or lower(coalesce(payment_row->>'status',''))<>'paid' then
          raise exception 'INVALID_LINK_STATUS: receipt allocation requires Paid Income finance' using errcode='23503';
        end if;
        if coalesce(invoice_row->>'projectId',invoice_row->>'project_id','')<>''
           and coalesce(payment_row->>'projectId',payment_row->>'project_id','')<>''
           and coalesce(invoice_row->>'projectId',invoice_row->>'project_id')<>coalesce(payment_row->>'projectId',payment_row->>'project_id') then
          raise exception 'CROSS_PROJECT_REFERENCE: invoice and payment projects differ' using errcode='23503';
        end if;
        target_total:=app.json_numeric_or_zero(payment_row,'amount');
        select coalesce(sum(app.json_numeric_or_zero(r.data,'amount','allocatedAmount','allocated_amount')),0)
        into existing_total
        from public.entity_records r
        where r.company_id=p_company and r.collection='paymentAllocations'
          and r.record_id<>p_record_id and r.deleted_at is null
          and coalesce(r.data->>'paymentId',r.data->>'payment_id')=payment_id
          and lower(coalesce(r.data->>'status','posted')) in ('posted','paid','applied','completed');
        if round(existing_total+amount_value,0)>round(target_total,0)+1 then
          raise exception 'OVER_ALLOCATION: recognized allocations exceed Paid finance amount' using errcode='23514';
        end if;
      end if;
    end if;

  elsif p_collection='billingMilestones' then
    status_value:=lower(coalesce(app.json_text(p_payload,'paymentStatus','payment_status'),'unpaid'));
    if status_value not in ('cancelled','canceled','deleted','void') then
      v:=app.json_text(p_payload,'contractId','contract_id');
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|billing-milestones|'||v,0));
      select r.data into contract_row from public.entity_records r
      where r.company_id=p_company and r.collection='contracts'
        and r.record_id=v and r.deleted_at is null;
      amount_value:=app.json_numeric_or_zero(p_payload,'amountExclVat','amount_excl_vat','amount');
      current_percent:=app.json_numeric_or_zero(p_payload,'percentage');
      select
        coalesce(sum(app.json_numeric_or_zero(r.data,'amountExclVat','amount_excl_vat','amount')),0),
        coalesce(sum(app.json_numeric_or_zero(r.data,'percentage')),0)
      into existing_total,existing_percent
      from public.entity_records r
      where r.company_id=p_company and r.collection='billingMilestones'
        and r.record_id<>p_record_id and r.deleted_at is null
        and coalesce(r.data->>'contractId',r.data->>'contract_id')=v
        and lower(coalesce(r.data->>'paymentStatus',r.data->>'payment_status','unpaid')) not in ('cancelled','canceled','deleted','void');
      target_total:=app.json_numeric_or_zero(contract_row,'valueExclVat','value_excl_vat','contractValue','contract_value');
      if existing_percent+current_percent>100.01 then
        raise exception 'FORMULA_MISMATCH: milestone percentages exceed 100 percent' using errcode='23514';
      end if;
      if round(existing_total+amount_value,0)>round(target_total,0)+1 then
        raise exception 'FORMULA_MISMATCH: milestone amounts exceed contract value' using errcode='23514';
      end if;
    end if;
  end if;
end $$;

-- Private validation helpers remain inaccessible to browser roles.
revoke all on function app.validate_entity_payload_v453(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.json_has_unsafe_key(jsonb) from public,anon,authenticated;
revoke all on function app.json_numeric_or_zero(jsonb,text[]) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.4';
update public.companies
set active_release_version='4.5.4'
where active_release_version is null or active_release_version in ('4.5.0','4.5.1','4.5.2','4.5.3');
insert into public.schema_versions(version,description) values
('4.5.4','Formula and linkage security hardening: strict Paid cash, recognized invoices, atomic invoice/payment allocation caps, contract-project alignment, recursive unsafe JSON rejection and clean-session web protection')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

commit;
