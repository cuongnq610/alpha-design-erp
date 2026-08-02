-- ALPHA DESIGN ERP Cloud v4.5.40
-- Statutory template manager, persistent UI filters, manual CIT field refinement and headcount chart correction.

insert into public.schema_versions(version,description) values
('4.5.40','Versioned statutory report template packages, persistent filters, manual CIT UI refinement and headcount chart correction')
on conflict(version) do update set description=excluded.description;

create table if not exists public.statutory_report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id text not null,
  template_name text not null,
  version text not null,
  accounting_regime text not null,
  effective_from date not null,
  legal_reference text,
  package_sha256 text not null check(package_sha256 ~ '^[0-9a-f]{64}$'),
  package jsonb not null,
  status text not null default 'candidate' check(status in ('candidate','active','inactive','rejected')),
  imported_by uuid not null default auth.uid(),
  imported_at timestamptz not null default clock_timestamp(),
  activated_by uuid,
  activated_at timestamptz,
  row_version bigint not null default 1,
  unique(company_id,template_id,version),
  unique(company_id,package_sha256)
);

alter table public.statutory_report_templates enable row level security;
drop policy if exists statutory_report_templates_select on public.statutory_report_templates;
create policy statutory_report_templates_select on public.statutory_report_templates for select
using(app.is_company_member(company_id) and app.has_permission('accounting.read',company_id));
drop policy if exists statutory_report_templates_insert on public.statutory_report_templates;
create policy statutory_report_templates_insert on public.statutory_report_templates for insert
with check(company_id=app.current_company_id() and app.has_permission('reports.import',company_id));
drop policy if exists statutory_report_templates_update on public.statutory_report_templates;
create policy statutory_report_templates_update on public.statutory_report_templates for update
using(company_id=app.current_company_id() and app.has_permission('reports.import',company_id))
with check(company_id=app.current_company_id());
revoke all on public.statutory_report_templates from public,anon;
grant select,insert,update on public.statutory_report_templates to authenticated;

create index if not exists idx_statutory_report_templates_company_status
on public.statutory_report_templates(company_id,status,effective_from desc);

create or replace function app.activate_statutory_report_template(p_template_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare cid uuid:=app.current_company_id(); target public.statutory_report_templates; old_row jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('reports.import',cid) then raise exception 'reports.import permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to activate statutory templates' using errcode='42501'; end if;
  select * into target from public.statutory_report_templates where id=p_template_id and company_id=cid for update;
  if target.id is null then raise exception 'statutory template not found' using errcode='P0002'; end if;
  old_row:=to_jsonb(target);
  update public.statutory_report_templates set status='inactive',row_version=row_version+1
  where company_id=cid and status='active' and id<>p_template_id;
  update public.statutory_report_templates set status='active',activated_by=app.current_user_id(),activated_at=clock_timestamp(),row_version=row_version+1
  where id=p_template_id returning * into target;
  perform app.append_audit(cid,'statutory_report_templates',target.id::text,'ACTIVATE',old_row,to_jsonb(target));
  return to_jsonb(target);
end $$;

create or replace function public.activate_statutory_report_template(p_template_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.activate_statutory_report_template(p_template_id)
$$;
revoke all on function public.activate_statutory_report_template(uuid) from public,anon;
grant execute on function public.activate_statutory_report_template(uuid) to authenticated;
revoke all on function app.activate_statutory_report_template(uuid) from public,anon,authenticated;

update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.40'
where status='active' and release_version<>'4.5.40';

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
  if p_release_version<>'4.5.40' or p_migration_version<>58 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
  if p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8' then raise exception 'formula version mismatch' using errcode='22023'; end if;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),count(*) filter(where not passed)
    into checks,failed_count from app.validate_tt133_report_set(p_from,p_to) x;
  select count(*) into approved_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  if failed_count<>0 or approved_count<>8 then raise exception 'statutory validation failed: % checks failed; B09 %/8',failed_count,approved_count using errcode='55000'; end if;

  server_b01:=app.report_rows_sha256('B01',p_from,p_to);
  server_b02:=app.report_rows_sha256('B02',p_from,p_to);
  server_b03:=app.report_rows_sha256('B03',p_from,p_to);
  server_b09:=app.report_rows_sha256('B09',p_from,p_to);
  if lower(coalesce(p_b01_sha256,''))<>server_b01 or lower(coalesce(p_b02_sha256,''))<>server_b02 or lower(coalesce(p_b03_sha256,''))<>server_b03 then
    raise exception 'browser and Supabase report hashes differ' using errcode='55000';
  end if;

  update public.statutory_report_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded'
  where company_id=cid and period_from=p_from and period_to=p_to and release_version=p_release_version and status='active';

  insert into public.statutory_report_certifications(
    company_id,period_from,period_to,release_version,formula_version,migration_version,
    b01_sha256,b02_sha256,b03_sha256,b09_sha256,validation_checks,b09_approved_count,status,certified_by,certified_at,expires_at
  ) values(
    cid,p_from,p_to,p_release_version,p_formula_version,p_migration_version,
    server_b01,server_b02,server_b03,server_b09,checks,approved_count,'active',app.current_user_id(),clock_timestamp(),clock_timestamp()+interval '24 hours'
  ) returning * into row;
  perform app.append_audit(cid,'statutory_report_certifications',row.id::text,'CERTIFY_TT133_RELEASE',null,to_jsonb(row));
  return to_jsonb(row);
end $$;

create or replace function public.certify_tt133_release(
  p_from date,p_to date,p_release_version text,p_formula_version text,p_migration_version integer,
  p_b01_sha256 text,p_b02_sha256 text,p_b03_sha256 text
) returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.certify_tt133_release(p_from,p_to,p_release_version,p_formula_version,p_migration_version,p_b01_sha256,p_b02_sha256,p_b03_sha256)
$$;
revoke all on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon;
grant execute on function public.certify_tt133_release(date,date,text,text,integer,text,text,text) to authenticated;
revoke all on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) from public,anon,authenticated;

comment on table public.statutory_report_templates is
'Checksum-versioned statutory presentation packages. Imported packages may change titles, row labels/order, note references and print layout; calculation formulas remain controlled by Calculation Core.';
comment on function app.certify_tt133_release(date,date,text,text,integer,text,text,text) is
'Certifies TT133 statutory reports for ALPHA DESIGN ERP Cloud v4.5.40 / migration 058 after live Cloud parity and B09 approval.';
