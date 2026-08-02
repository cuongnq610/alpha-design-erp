-- Cross-table consistency triggers, audit coverage and Supabase Storage policies.

-- Touch/audit coverage for accounting subledgers.
do $$
declare t text;
begin
  foreach t in array array[
    'subledger_documents','payments','fixed_assets','prepaid_expenses',
    'tax_declarations','report_snapshots'
  ] loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_touch',t);
    execute format('create trigger %I before update on public.%I for each row execute function app.touch_row()','trg_'||t||'_touch',t);
  end loop;
  foreach t in array array[
    'subledger_documents','payments','payment_allocations','fixed_assets',
    'fixed_asset_depreciation','prepaid_expenses','prepaid_allocations',
    'tax_declarations','tax_declaration_lines','tax_payments','report_snapshots'
  ] loop
    execute format('drop trigger if exists %I on public.%I','trg_audit_'||t,t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.audit_row_change()','trg_audit_'||t,t);
  end loop;
end $$;

create or replace function app.guard_accounting_child_tenant() returns trigger
language plpgsql set search_path=pg_catalog,public,app as $$
declare cid uuid;
begin
  if tg_table_name='payment_allocations' then
    select p.company_id into cid from public.payments p where p.id=new.payment_id;
    if cid<>new.company_id or not exists(select 1 from public.subledger_documents d where d.id=new.subledger_document_id and d.company_id=new.company_id) then raise exception 'payment allocation tenant mismatch'; end if;
  elsif tg_table_name='fixed_asset_depreciation' then
    select company_id into cid from public.fixed_assets where id=new.fixed_asset_id;
    if cid<>new.company_id then raise exception 'depreciation tenant mismatch'; end if;
  elsif tg_table_name='prepaid_allocations' then
    select company_id into cid from public.prepaid_expenses where id=new.prepaid_expense_id;
    if cid<>new.company_id then raise exception 'prepaid allocation tenant mismatch'; end if;
  elsif tg_table_name='tax_declaration_lines' then
    select company_id into cid from public.tax_declarations where id=new.tax_declaration_id;
    if cid<>new.company_id then raise exception 'tax declaration line tenant mismatch'; end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['payment_allocations','fixed_asset_depreciation','prepaid_allocations','tax_declaration_lines'] loop
    execute format('drop trigger if exists %I on public.%I','trg_tenant_'||t,t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function app.guard_accounting_child_tenant()','trg_tenant_'||t,t);
  end loop;
end $$;

create or replace function app.recalculate_purchase_order(p_order uuid) returns public.purchase_orders
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare r public.purchase_orders; s bigint; v bigint;
begin
  select * into r from public.purchase_orders where id=p_order for update;
  if not found then raise exception 'purchase order not found'; end if;
  select coalesce(sum(line_subtotal),0),coalesce(sum(line_vat),0) into s,v from public.purchase_order_lines where purchase_order_id=p_order;
  update public.purchase_orders set subtotal=s,vat_amount=v where id=p_order returning * into r;
  return r;
end $$;

create or replace function app.purchase_order_line_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,app as $$
begin
  perform app.recalculate_purchase_order(coalesce(new.purchase_order_id,old.purchase_order_id));
  return coalesce(new,old);
end $$;
drop trigger if exists trg_po_line_recalculate on public.purchase_order_lines;
create trigger trg_po_line_recalculate after insert or update or delete on public.purchase_order_lines
for each row execute function app.purchase_order_line_changed();

-- Store current document version number in files_metadata metadata through a view.
create or replace view public.v_files_latest with (security_invoker=true) as
select f.*,v.id latest_version_id,v.version_no,v.object_path latest_object_path,
  v.size_bytes latest_size_bytes,v.sha256 latest_sha256,v.created_at latest_uploaded_at
from public.files_metadata f
left join lateral (
  select dv.* from public.document_versions dv where dv.file_id=f.id order by dv.version_no desc limit 1
) v on true;

-- Supabase private storage bucket. Path convention:
-- {company_id}/{project_id-or-general}/{file_id}/{version_no}/{filename}
do $$
begin
  if exists(select 1 from information_schema.schemata where schema_name='storage') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('company-files','company-files',false,1073741824,null)
    on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

    drop policy if exists company_files_read_v3 on storage.objects;
    create policy company_files_read_v3 on storage.objects for select to authenticated
    using(bucket_id='company-files'
      and app.is_company_member(((storage.foldername(name))[1])::uuid)
      and app.has_permission('documents.read',((storage.foldername(name))[1])::uuid));

    drop policy if exists company_files_insert_v3 on storage.objects;
    create policy company_files_insert_v3 on storage.objects for insert to authenticated
    with check(bucket_id='company-files'
      and app.is_company_member(((storage.foldername(name))[1])::uuid)
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid));

    drop policy if exists company_files_update_v3 on storage.objects;
    create policy company_files_update_v3 on storage.objects for update to authenticated
    using(bucket_id='company-files'
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid))
    with check(bucket_id='company-files'
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid));

    drop policy if exists company_files_delete_v3 on storage.objects;
    create policy company_files_delete_v3 on storage.objects for delete to authenticated
    using(bucket_id='company-files'
      and app.has_permission('documents.write',((storage.foldername(name))[1])::uuid));
  end if;
end $$;
