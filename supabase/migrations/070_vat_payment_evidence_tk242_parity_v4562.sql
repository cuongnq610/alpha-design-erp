-- ALPHA DESIGN ERP Cloud v4.5.62
-- Input-VAT payment-evidence hardening, linked-record immutability and TK242
-- report-classification parity release binding.
begin;

insert into public.schema_versions(version,description) values
('4.5.62','Linked bank-payment evidence and proportional input-VAT deduction; TK242 current/long-term report parity')
on conflict(version) do update
set description=excluded.description,
    applied_at=clock_timestamp();

create or replace function app.vat_invoice_vendor_id_v4562(
  p_company uuid,p_payload jsonb
) returns text language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare
  vendor_id text;
  tax_code text;
begin
  vendor_id:=app.json_text(p_payload,'vendorId','vendor_id');
  if vendor_id is null
     and lower(coalesce(app.json_text(p_payload,'partnerType','partner_type'),''))='vendor' then
    vendor_id:=app.json_text(p_payload,'partnerId','partner_id');
  end if;
  if vendor_id is not null then return vendor_id; end if;
  tax_code:=regexp_replace(coalesce(app.json_text(p_payload,'taxCode','tax_code'),''),'\s','','g');
  if tax_code='' then return null; end if;
  select r.record_id into vendor_id
  from public.entity_records r
  where r.company_id=p_company and r.collection='vendors' and r.deleted_at is null
    and regexp_replace(coalesce(r.data->>'taxCode',r.data->>'tax_code',''),'\s','','g')=tax_code
  order by r.record_id
  limit 1;
  return vendor_id;
end $$;

alter function app.validate_entity_payload(uuid,text,text,jsonb)
  rename to validate_entity_payload_pre_v4562;

create or replace function app.validate_entity_payload(
  p_company uuid,p_collection text,p_record_id text,p_payload jsonb
) returns void language plpgsql volatile security definer
set search_path=pg_catalog,public,app as $$
declare
  invoice_id text;
  invoice_vendor_id text;
  payment_vendor_id text;
  journal_id text;
  project_id text;
  invoice_project_id text;
  status_value text;
  type_value text;
  invoice_status text;
  amount_value numeric:=0;
  invoice_total numeric:=0;
  existing_paid numeric:=0;
  bank_net numeric:=0;
  cash_net numeric:=0;
  invoice_row jsonb;
  journal_row jsonb;
  current_row jsonb;
  current_vendor_id text;
  vendor_in_journal boolean:=false;
begin
  perform app.validate_entity_payload_pre_v4562(p_company,p_collection,p_record_id,p_payload);

  if p_collection='finance' then
    invoice_id:=app.json_text(p_payload,'invoiceId','invoice_id','taxInvoiceId','tax_invoice_id');
    select r.data into current_row
    from public.entity_records r
    where r.company_id=p_company and r.collection='finance'
      and r.record_id=p_record_id and r.deleted_at is null;

    if lower(coalesce(current_row->>'status',''))='paid'
       and coalesce(current_row->>'invoiceId',current_row->>'invoice_id',current_row->>'taxInvoiceId',current_row->>'tax_invoice_id','')<>''
       and (
         coalesce(current_row->>'invoiceId',current_row->>'invoice_id',current_row->>'taxInvoiceId',current_row->>'tax_invoice_id','') is distinct from coalesce(invoice_id,'')
         or lower(coalesce(current_row->>'type','')) is distinct from lower(coalesce(p_payload->>'type',''))
         or lower(coalesce(current_row->>'status','')) is distinct from lower(coalesce(p_payload->>'status',''))
         or coalesce(current_row->>'date','') is distinct from coalesce(p_payload->>'date','')
         or coalesce(current_row->>'journalEntryId',current_row->>'journal_entry_id',current_row->>'postingId',current_row->>'posting_id','') is distinct from coalesce(app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id'),'')
         or app.json_numeric_or_zero(current_row,'amount') is distinct from app.json_numeric_or_zero(p_payload,'amount')
       ) then
      raise exception 'VAT_PAYMENT_IMMUTABLE: reverse a linked Paid input-invoice payment instead of rewriting its evidence' using errcode='23514';
    end if;

    if invoice_id is not null then
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|input-vat-payment|'||invoice_id,0));
      select r.data into invoice_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='taxInvoices'
        and r.record_id=invoice_id and r.deleted_at is null;
      if invoice_row is null or lower(coalesce(invoice_row->>'direction',''))<>'input' then
        raise exception 'VAT_INPUT_INVOICE_REQUIRED: linked finance requires an active Input invoice' using errcode='23503';
      end if;
      invoice_status:=lower(coalesce(invoice_row->>'status','valid'));
      if invoice_status in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'VAT_INPUT_INVOICE_STATUS: linked finance requires a recognized Input invoice' using errcode='23503';
      end if;

      type_value:=lower(coalesce(app.json_text(p_payload,'type'),''));
      status_value:=lower(coalesce(app.json_text(p_payload,'status'),'pending'));
      if type_value<>'expense' then
        raise exception 'VAT_PAYMENT_TYPE: an Input invoice may only link to Expense finance' using errcode='23514';
      end if;
      project_id:=app.json_text(p_payload,'projectId','project_id');
      invoice_project_id:=app.json_text(invoice_row,'projectId','project_id');
      if project_id is not null and invoice_project_id is not null and project_id<>invoice_project_id then
        raise exception 'VAT_PAYMENT_PROJECT: finance and Input invoice projects differ' using errcode='23514';
      end if;

      invoice_vendor_id:=app.vat_invoice_vendor_id_v4562(p_company,invoice_row);
      payment_vendor_id:=app.json_text(p_payload,'vendorId','vendor_id');
      if payment_vendor_id is null
         and lower(coalesce(app.json_text(p_payload,'partnerType','partner_type'),''))='vendor' then
        payment_vendor_id:=app.json_text(p_payload,'partnerId','partner_id');
      end if;
      if invoice_vendor_id is null then
        raise exception 'VAT_PAYMENT_VENDOR: Input invoice must identify a vendor' using errcode='23503';
      end if;
      if payment_vendor_id is not null and payment_vendor_id<>invoice_vendor_id then
        raise exception 'VAT_PAYMENT_VENDOR: finance vendor differs from Input invoice vendor' using errcode='23514';
      end if;

      if status_value='paid' then
        journal_id:=app.json_text(p_payload,'journalEntryId','journal_entry_id','postingId','posting_id');
        select r.data into journal_row
        from public.entity_records r
        where r.company_id=p_company and r.collection='journalEntries'
          and r.record_id=journal_id and r.deleted_at is null;
        if journal_row is null or lower(coalesce(journal_row->>'status',''))<>'posted' then
          raise exception 'VAT_PAYMENT_JOURNAL: linked Paid finance requires a Posted journal' using errcode='23503';
        end if;
        select
          coalesce(sum(case when coalesce(app.json_text(line.value,'accountCode','account_code'),'') ~ '^112'
            then app.json_numeric_or_zero(line.value,'debit')-app.json_numeric_or_zero(line.value,'credit') else 0 end),0),
          coalesce(sum(case when coalesce(app.json_text(line.value,'accountCode','account_code'),'') ~ '^111'
            then app.json_numeric_or_zero(line.value,'debit')-app.json_numeric_or_zero(line.value,'credit') else 0 end),0)
        into bank_net,cash_net
        from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value);
        amount_value:=app.json_numeric_or_zero(p_payload,'amount');
        if round(bank_net,0)<>-round(amount_value,0) or round(cash_net,0)<>0 then
          raise exception 'VAT_PAYMENT_BANK_EVIDENCE: account 112 must fund the exact amount and account 111 must be zero' using errcode='23514';
        end if;

        vendor_in_journal:=(
          lower(coalesce(journal_row->>'partnerType',journal_row->>'partner_type',''))='vendor'
          and coalesce(journal_row->>'partnerId',journal_row->>'partner_id','')=invoice_vendor_id
        ) or exists(
          select 1
          from jsonb_array_elements(case when jsonb_typeof(journal_row->'lines')='array' then journal_row->'lines' else '[]'::jsonb end) line(value)
          where lower(coalesce(line.value->>'partnerType',line.value->>'partner_type',''))='vendor'
            and coalesce(line.value->>'partnerId',line.value->>'partner_id','')=invoice_vendor_id
        );
        if payment_vendor_id is null and not vendor_in_journal then
          raise exception 'VAT_PAYMENT_VENDOR_EVIDENCE: payment or journal must identify the invoice vendor' using errcode='23514';
        end if;

        invoice_total:=app.json_numeric_or_zero(invoice_row,'totalAmount','total_amount');
        select coalesce(sum(app.json_numeric_or_zero(r.data,'amount')),0)
        into existing_paid
        from public.entity_records r
        where r.company_id=p_company and r.collection='finance'
          and r.record_id<>p_record_id and r.deleted_at is null
          and lower(coalesce(r.data->>'type',''))='expense'
          and lower(coalesce(r.data->>'status',''))='paid'
          and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=invoice_id;
        if round(existing_paid+amount_value,0)>round(invoice_total,0)+1 then
          raise exception 'VAT_PAYMENT_OVERPAYMENT: linked Paid finance exceeds Input invoice total' using errcode='23514';
        end if;
      end if;
    end if;

  elsif p_collection='taxInvoices' then
    if exists(
      select 1 from public.entity_records r
      where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
        and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=p_record_id
    ) then
      perform pg_advisory_xact_lock(hashtextextended(p_company::text||'|input-vat-payment|'||p_record_id,0));
      status_value:=lower(coalesce(app.json_text(p_payload,'status'),'valid'));
      if lower(coalesce(app.json_text(p_payload,'direction'),''))<>'input'
         or status_value in ('draft','pending','review','replaced','cancelled','canceled','deleted','void') then
        raise exception 'VAT_LINKED_INVOICE_IMMUTABLE: linked invoice must remain recognized Input' using errcode='23514';
      end if;
      select r.data into current_row
      from public.entity_records r
      where r.company_id=p_company and r.collection='taxInvoices'
        and r.record_id=p_record_id and r.deleted_at is null;
      invoice_vendor_id:=app.vat_invoice_vendor_id_v4562(p_company,p_payload);
      current_vendor_id:=app.vat_invoice_vendor_id_v4562(p_company,current_row);
      if invoice_vendor_id is null or invoice_vendor_id is distinct from current_vendor_id
         or coalesce(app.json_text(p_payload,'projectId','project_id'),'') is distinct from coalesce(app.json_text(current_row,'projectId','project_id'),'') then
        raise exception 'VAT_LINKED_INVOICE_PARTY: vendor and project cannot change after payment linkage' using errcode='23514';
      end if;
      select coalesce(sum(app.json_numeric_or_zero(r.data,'amount')),0)
      into existing_paid
      from public.entity_records r
      where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
        and lower(coalesce(r.data->>'type',''))='expense'
        and lower(coalesce(r.data->>'status',''))='paid'
        and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=p_record_id;
      invoice_total:=app.json_numeric_or_zero(p_payload,'totalAmount','total_amount');
      if round(invoice_total,0)+1<round(existing_paid,0) then
        raise exception 'VAT_LINKED_INVOICE_TOTAL: invoice total cannot be below linked Paid finance' using errcode='23514';
      end if;
    end if;
  end if;
end $$;

alter function app.assert_entity_delete_safe(uuid,text,text)
  rename to assert_entity_delete_safe_pre_v4562;

create or replace function app.assert_entity_delete_safe(
  p_company uuid,p_collection text,p_record_id text
) returns void language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
begin
  perform app.assert_entity_delete_safe_pre_v4562(p_company,p_collection,p_record_id);
  if p_collection='taxInvoices' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
      and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: Input invoice is referenced by finance payment evidence' using errcode='23503'; end if;
  if p_collection='vendors' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='finance' and r.deleted_at is null
      and coalesce(r.data->>'vendorId',r.data->>'vendor_id')=p_record_id
  ) then raise exception 'DEPENDENCY_EXISTS: vendor is referenced by finance payment evidence' using errcode='23503'; end if;
  if p_collection='finance' and exists(
    select 1 from public.entity_records r
    where r.company_id=p_company and r.collection='finance'
      and r.record_id=p_record_id and r.deleted_at is null
      and coalesce(r.data->>'invoiceId',r.data->>'invoice_id',r.data->>'taxInvoiceId',r.data->>'tax_invoice_id','')<>''
  ) then raise exception 'DEPENDENCY_EXISTS: linked Input-invoice payment evidence cannot be deleted' using errcode='23503'; end if;
end $$;

revoke all on function app.vat_invoice_vendor_id_v4562(uuid,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload_pre_v4562(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.validate_entity_payload(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe_pre_v4562(uuid,text,text) from public,anon,authenticated;
revoke all on function app.assert_entity_delete_safe(uuid,text,text) from public,anon,authenticated;

alter table public.companies alter column active_release_version set default '4.5.62';
update public.companies set active_release_version='4.5.62'
where active_release_version is null or active_release_version='4.5.61';

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.62'
where status='active' and release_version<>'4.5.62';

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
  if p_release_version<>'4.5.62' or p_migration_version<>70 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
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
