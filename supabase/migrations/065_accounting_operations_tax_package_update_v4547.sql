-- ALPHA DESIGN ERP Cloud v4.5.47
-- Accounting operations capability audit and effective-dated Vietnamese tax compliance package manager.

insert into public.schema_versions(version,description) values
('4.5.47','Accounting operations capability audit and checksum-versioned, effective-dated Vietnamese tax compliance package manager')
on conflict(version) do update set description=excluded.description;

create table if not exists public.tax_compliance_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  package_id text not null,
  package_name text not null,
  version text not null,
  jurisdiction text not null default 'VN' check(upper(jurisdiction)='VN'),
  authority text,
  effective_from date not null,
  effective_to date,
  package_sha256 text not null check(package_sha256 ~ '^[0-9a-f]{64}$'),
  package jsonb not null,
  status text not null default 'candidate' check(status in ('candidate','active','inactive','rejected')),
  imported_by uuid not null default auth.uid(),
  imported_at timestamptz not null default clock_timestamp(),
  activated_by uuid,
  activated_at timestamptz,
  row_version bigint not null default 1,
  constraint tax_compliance_packages_date_order check(effective_to is null or effective_to>=effective_from),
  unique(company_id,package_id,version),
  unique(company_id,package_sha256)
);

alter table public.tax_compliance_packages enable row level security;
drop policy if exists tax_compliance_packages_select on public.tax_compliance_packages;
create policy tax_compliance_packages_select on public.tax_compliance_packages for select
using(app.is_company_member(company_id) and app.has_permission('tax.read',company_id));
drop policy if exists tax_compliance_packages_insert on public.tax_compliance_packages;
create policy tax_compliance_packages_insert on public.tax_compliance_packages for insert
with check(company_id=app.current_company_id() and app.has_permission('tax.write',company_id));
drop policy if exists tax_compliance_packages_update on public.tax_compliance_packages;
create policy tax_compliance_packages_update on public.tax_compliance_packages for update
using(company_id=app.current_company_id() and app.has_permission('tax.write',company_id))
with check(company_id=app.current_company_id());
revoke all on public.tax_compliance_packages from public,anon;
grant select,insert,update on public.tax_compliance_packages to authenticated;

create index if not exists idx_tax_compliance_packages_company_status_effective
on public.tax_compliance_packages(company_id,status,effective_from desc);

create or replace function app.activate_tax_compliance_package(p_package_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare cid uuid:=app.current_company_id(); target public.tax_compliance_packages; old_row jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('tax.write',cid) then raise exception 'tax.write permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to activate tax compliance packages' using errcode='42501'; end if;
  select * into target from public.tax_compliance_packages where id=p_package_id and company_id=cid for update;
  if target.id is null then raise exception 'tax compliance package not found' using errcode='P0002'; end if;
  if coalesce(target.package->'manifest'->>'packageType','')<>'alpha-vn-tax-compliance-package' then raise exception 'invalid package type' using errcode='22023'; end if;
  if coalesce((target.package->'manifest'->>'schemaVersion')::integer,0)<>1 then raise exception 'unsupported package schema version' using errcode='22023'; end if;
  old_row:=to_jsonb(target);
  update public.tax_compliance_packages set status='inactive',row_version=row_version+1
  where company_id=cid and status='active' and id<>p_package_id;
  update public.tax_compliance_packages set status='active',activated_by=app.current_user_id(),activated_at=clock_timestamp(),row_version=row_version+1
  where id=p_package_id returning * into target;
  perform app.append_audit(cid,'tax_compliance_packages',target.id::text,'ACTIVATE',old_row,to_jsonb(target));
  return to_jsonb(target);
end $$;

create or replace function public.activate_tax_compliance_package(p_package_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.activate_tax_compliance_package(p_package_id)
$$;
revoke all on function public.activate_tax_compliance_package(uuid) from public,anon;
grant execute on function public.activate_tax_compliance_package(uuid) to authenticated;
revoke all on function app.activate_tax_compliance_package(uuid) from public,anon,authenticated;

comment on table public.tax_compliance_packages is
'Checksum-versioned, effective-dated Vietnamese tax metadata packages. Packages may define form metadata, fields, validations, legal references and XML profiles, but cannot execute code or replace Calculation Core.';
comment on function app.activate_tax_compliance_package(uuid) is
'Activates a tax compliance package with tax.write permission and MFA AAL2, retaining prior packages for rollback and historical filing reproducibility.';

-- Current statutory certification release binding.
update public.statutory_report_certifications
set status='revoked',revoked_at=clock_timestamp(),revocation_reason='superseded by release 4.5.47'
where status='active' and release_version<>'4.5.47';

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
  if p_release_version<>'4.5.47' or p_migration_version<>65 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
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
