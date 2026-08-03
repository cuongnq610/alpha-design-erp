-- ALPHA DESIGN ERP Cloud v4.5.38
-- Production financial certification: B09 segregation of duties, server-issued
-- statutory parity evidence and an enforceable go-live gate.

insert into public.schema_versions(version,description) values
('4.5.38','Production financial certification: controlled B09 workflow, cloud parity evidence and statutory release gate')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();

insert into public.permissions(code,module,name,description,risk_level) values
('b09.prepare','accounting','Lập thuyết minh B09','Lập và xác nhận nội dung thuyết minh B09-DNN','sensitive'),
('b09.review','accounting','Soát xét thuyết minh B09','Soát xét độc lập nội dung B09-DNN','critical'),
('b09.approve','accounting','Phê duyệt thuyết minh B09','Phê duyệt cuối cùng B09-DNN bằng MFA AAL2','critical'),
('financial_reports.certify','reports','Chứng nhận BCTC Cloud','Chứng nhận đối chiếu engine trình duyệt với Supabase bằng MFA AAL2','critical')
on conflict(code) do update set module=excluded.module,name=excluded.name,description=excluded.description,risk_level=excluded.risk_level;

insert into public.role_permissions(role_id,permission_code)
select r.id,p.permission_code
from public.roles r
cross join lateral unnest(case r.code
  when 'ACCOUNTANT' then array['b09.prepare']::text[]
  when 'CHIEF_ACCOUNTANT' then array['b09.prepare','b09.review','financial_reports.certify']::text[]
  when 'DIRECTOR' then array['b09.approve','financial_reports.certify']::text[]
  else array[]::text[] end) p(permission_code)
where cardinality(case r.code
  when 'ACCOUNTANT' then array['b09.prepare']::text[]
  when 'CHIEF_ACCOUNTANT' then array['b09.prepare','b09.review','financial_reports.certify']::text[]
  when 'DIRECTOR' then array['b09.approve','financial_reports.certify']::text[]
  else array[]::text[] end)>0
on conflict(role_id,permission_code) do nothing;

create or replace function app.permission_is_privileged(p_permission text) returns boolean
language sql immutable
set search_path=pg_catalog,public,app as $$
  select p_permission in (
    'admin','accounting.post','accounting.close','accounting.period.lock',
    'users.manage','roles.manage','reports.import','backup.restore',
    'security.manage','release.approve','b09.review','b09.approve',
    'financial_reports.certify'
  )
$$;

alter table public.report_notes_tt133
  add column if not exists prepared_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists content_sha256 text,
  add column if not exists workflow_version bigint not null default 1;

create or replace function app.report_note_content_is_complete(p_content jsonb)
returns boolean language sql immutable set search_path=pg_catalog as $$
  select length(trim(case
    when p_content is null then ''
    when jsonb_typeof(p_content)='string' then p_content#>>'{}'
    when jsonb_typeof(p_content)='object' and p_content ? 'text' then coalesce(p_content->>'text','')
    else p_content::text
  end))>=20
$$;

-- Backfill historical rows before installing the authenticated workflow trigger.
update public.report_notes_tt133
set content_sha256=encode(extensions.digest(convert_to(content::text,'UTF8'),'sha256'),'hex')
where content_sha256 is null;

create or replace function app.enforce_b09_workflow() returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,app,auth as $$
declare
  actor uuid:=app.current_user_id();
  old_status text:=case when tg_op='INSERT' then 'draft' else lower(coalesce(old.status,'draft')) end;
  target_status text:=lower(coalesce(new.status,'draft'));
  content_changed boolean:=case when tg_op='INSERT' then true else new.content is distinct from old.content or new.section_title is distinct from old.section_title end;
begin
  if actor is null then raise exception 'authenticated user required for B09 workflow' using errcode='42501'; end if;
  if new.company_id<>app.current_company_id() then raise exception 'company mismatch' using errcode='42501'; end if;
  if new.section_code not in ('I','II','III','IV','V','VI','VII','VIII') then raise exception 'invalid B09 section code' using errcode='22023'; end if;
  if new.period_from is null or new.period_to is null or new.period_from>new.period_to then raise exception 'invalid B09 reporting period' using errcode='22023'; end if;
  if target_status not in ('draft','prepared','reviewed','approved') then raise exception 'invalid B09 status' using errcode='22023'; end if;

  if tg_op='INSERT' then
    new.prepared_by:=null; new.reviewed_by:=null; new.approved_by:=null;
    new.prepared_at:=null; new.reviewed_at:=null; new.approved_at:=null;
    new.workflow_version:=greatest(1,coalesce(new.workflow_version,1));
  else
    -- Actor and timestamp columns are database-controlled and cannot be forged by a client.
    new.prepared_by:=old.prepared_by; new.reviewed_by:=old.reviewed_by; new.approved_by:=old.approved_by;
    new.prepared_at:=old.prepared_at; new.reviewed_at:=old.reviewed_at; new.approved_at:=old.approved_at;
    new.workflow_version:=old.workflow_version;
    if (old.status='approved') and (content_changed or new.period_from is distinct from old.period_from or new.period_to is distinct from old.period_to or new.section_code is distinct from old.section_code) then
      raise exception 'approved B09 note is immutable; reopen it to draft before editing' using errcode='55000';
    end if;
    if content_changed and old_status<>'draft' and target_status<>'draft' then
      raise exception 'B09 content may only be edited in draft status' using errcode='55000';
    end if;
  end if;

  if target_status<>old_status then
    if target_status='draft' then
      if old_status='prepared' and not app.has_permission('b09.prepare',new.company_id) then raise exception 'b09.prepare permission required' using errcode='42501'; end if;
      if old_status='reviewed' and not app.has_permission('b09.review',new.company_id) then raise exception 'b09.review permission required' using errcode='42501'; end if;
      if old_status='approved' then
        if not app.has_permission('b09.approve',new.company_id) then raise exception 'b09.approve permission required' using errcode='42501'; end if;
        if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to reopen approved B09' using errcode='42501'; end if;
      end if;
      new.prepared_by:=null; new.reviewed_by:=null; new.approved_by:=null;
      new.prepared_at:=null; new.reviewed_at:=null; new.approved_at:=null;
      new.workflow_version:=coalesce(old.workflow_version,1)+1;
    elsif target_status='prepared' then
      if old_status<>'draft' then raise exception 'B09 transition must be draft -> prepared' using errcode='55000'; end if;
      if not app.has_permission('b09.prepare',new.company_id) then raise exception 'b09.prepare permission required' using errcode='42501'; end if;
      if not app.report_note_content_is_complete(new.content) then raise exception 'B09 content is incomplete' using errcode='22023'; end if;
      new.prepared_by:=actor; new.prepared_at:=clock_timestamp();
      new.reviewed_by:=null; new.reviewed_at:=null; new.approved_by:=null; new.approved_at:=null;
    elsif target_status='reviewed' then
      if old_status<>'prepared' then raise exception 'B09 transition must be prepared -> reviewed' using errcode='55000'; end if;
      if not app.has_permission('b09.review',new.company_id) then raise exception 'b09.review permission required' using errcode='42501'; end if;
      if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to review B09' using errcode='42501'; end if;
      if old.prepared_by is null or old.prepared_by=actor then raise exception 'B09 reviewer must differ from preparer' using errcode='42501'; end if;
      if not app.report_note_content_is_complete(new.content) then raise exception 'B09 content is incomplete' using errcode='22023'; end if;
      new.reviewed_by:=actor; new.reviewed_at:=clock_timestamp();
      new.approved_by:=null; new.approved_at:=null;
    elsif target_status='approved' then
      if old_status<>'reviewed' then raise exception 'B09 transition must be reviewed -> approved' using errcode='55000'; end if;
      if not app.has_permission('b09.approve',new.company_id) then raise exception 'b09.approve permission required' using errcode='42501'; end if;
      if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required to approve B09' using errcode='42501'; end if;
      if old.prepared_by is null or old.reviewed_by is null then raise exception 'B09 preparation and review evidence is incomplete' using errcode='55000'; end if;
      if actor=old.prepared_by or actor=old.reviewed_by then raise exception 'B09 approver must differ from preparer and reviewer' using errcode='42501'; end if;
      if not app.report_note_content_is_complete(new.content) then raise exception 'B09 content is incomplete' using errcode='22023'; end if;
      new.approved_by:=actor; new.approved_at:=clock_timestamp();
    end if;
  elsif tg_op='UPDATE' and content_changed and target_status='draft' then
    new.prepared_by:=null; new.reviewed_by:=null; new.approved_by:=null;
    new.prepared_at:=null; new.reviewed_at:=null; new.approved_at:=null;
    new.workflow_version:=coalesce(old.workflow_version,1)+1;
  end if;

  new.status:=target_status;
  new.content_sha256:=encode(extensions.digest(convert_to(new.content::text,'UTF8'),'sha256'),'hex');
  return new;
end $$;

drop trigger if exists trg_b09_workflow_v4538 on public.report_notes_tt133;
create trigger trg_b09_workflow_v4538
before insert or update on public.report_notes_tt133
for each row execute function app.enforce_b09_workflow();

create or replace function app.report_b09_certification(p_from date,p_to date)
returns table(
  section_code text,section_title text,status text,content jsonb,content_sha256 text,
  prepared_by uuid,prepared_at timestamptz,reviewed_by uuid,reviewed_at timestamptz,
  approved_by uuid,approved_at timestamptz,workflow_version bigint,workflow_complete boolean
)
language sql stable security definer set search_path=pg_catalog,public,app as $$
with access as (select app.assert_company_access(app.current_company_id())),
required(section_code,section_title,sort_order) as (values
 ('I','Đặc điểm hoạt động của doanh nghiệp',1),
 ('II','Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán',2),
 ('III','Chuẩn mực và chế độ kế toán áp dụng',3),
 ('IV','Các chính sách kế toán áp dụng',4),
 ('V','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính',5),
 ('VI','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh',6),
 ('VII','Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ',7),
 ('VIII','Những thông tin khác',8)
)
select r.section_code,r.section_title,coalesce(n.status,'draft'),coalesce(n.content,'{}'::jsonb),n.content_sha256,
  n.prepared_by,n.prepared_at,n.reviewed_by,n.reviewed_at,n.approved_by,n.approved_at,coalesce(n.workflow_version,1),
  (n.status='approved' and app.report_note_content_is_complete(n.content)
    and n.content_sha256 is not null and n.prepared_by is not null and n.reviewed_by is not null and n.approved_by is not null
    and n.prepared_at is not null and n.reviewed_at is not null and n.approved_at is not null
    and n.prepared_by<>n.reviewed_by and n.prepared_by<>n.approved_by and n.reviewed_by<>n.approved_by) as workflow_complete
from access cross join required r left join public.report_notes_tt133 n
 on n.company_id=app.current_company_id() and n.period_from=p_from and n.period_to=p_to and n.section_code=r.section_code
order by r.sort_order
$$;
revoke all on function app.report_b09_certification(date,date) from public,anon,authenticated;

-- Supabase JavaScript uses the public PostgREST schema by default. These narrow wrappers
-- expose only tenant-scoped, security-definer report functions; the app implementations remain private.
create or replace function public.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint,level int,is_total boolean)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b01a_dnn(p_from,p_to)
$$;
create or replace function public.report_b02_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b02_dnn(p_from,p_to)
$$;
create or replace function public.report_b03_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint,level int,is_total boolean)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b03_dnn(p_from,p_to)
$$;
create or replace function public.report_b09_certification(p_from date,p_to date)
returns table(
  section_code text,section_title text,status text,content jsonb,content_sha256 text,
  prepared_by uuid,prepared_at timestamptz,reviewed_by uuid,reviewed_at timestamptz,
  approved_by uuid,approved_at timestamptz,workflow_version bigint,workflow_complete boolean
) language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.report_b09_certification(p_from,p_to)
$$;
create or replace function public.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select * from app.validate_tt133_report_set(p_from,p_to)
$$;
revoke all on function public.report_b01a_dnn(date,date),public.report_b02_dnn(date,date),public.report_b03_dnn(date,date),public.report_b09_certification(date,date),public.validate_tt133_report_set(date,date) from public,anon;
grant execute on function public.report_b01a_dnn(date,date),public.report_b02_dnn(date,date),public.report_b03_dnn(date,date),public.report_b09_certification(date,date),public.validate_tt133_report_set(date,date) to authenticated;

create table if not exists public.statutory_report_certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  release_version text not null,
  formula_version text not null,
  migration_version integer not null,
  b01_sha256 text not null,
  b02_sha256 text not null,
  b03_sha256 text not null,
  b09_sha256 text not null,
  validation_checks jsonb not null default '[]'::jsonb,
  b09_approved_count integer not null default 0,
  status text not null default 'active' check(status in ('active','revoked','expired')),
  certified_by uuid not null,
  certified_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp()+interval '24 hours'),
  revoked_at timestamptz,
  revocation_reason text
);
create index if not exists ix_statutory_certification_lookup_v4538
  on public.statutory_report_certifications(company_id,period_from,period_to,release_version,certified_at desc);
create unique index if not exists ux_statutory_certification_active_v4538
  on public.statutory_report_certifications(company_id,period_from,period_to,release_version) where status='active';
alter table public.statutory_report_certifications enable row level security;
select app.drop_all_policies('statutory_report_certifications');
create policy statutory_cert_read_v4538 on public.statutory_report_certifications for select
  using(app.is_company_member(company_id));
revoke all on public.statutory_report_certifications from public,anon,authenticated;
grant select on public.statutory_report_certifications to authenticated;
grant all on public.statutory_report_certifications to service_role;

create or replace function app.report_rows_sha256(p_report text,p_from date,p_to date)
returns text language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare canonical text;
begin
  if p_report='B01' then
    select replace(jsonb_agg(jsonb_build_array(code,opening_amount,ending_amount) order by code)::text,', ',',') into canonical
    from app.report_b01a_dnn(p_from,p_to);
  elsif p_report='B02' then
    select replace(jsonb_agg(jsonb_build_array(code,amount) order by code)::text,', ',',') into canonical
    from app.report_b02_dnn(p_from,p_to);
  elsif p_report='B03' then
    select replace(jsonb_agg(jsonb_build_array(code,amount) order by code)::text,', ',',') into canonical
    from app.report_b03_dnn(p_from,p_to);
  elsif p_report='B09' then
    select replace(jsonb_agg(jsonb_build_array(section_code,status,coalesce(content_sha256,''),coalesce(prepared_by::text,''),coalesce(reviewed_by::text,''),coalesce(approved_by::text,''),workflow_version) order by section_code)::text,', ',',') into canonical
    from app.report_b09_certification(p_from,p_to);
  else raise exception 'unsupported report hash %',p_report using errcode='22023';
  end if;
  return encode(extensions.digest(convert_to(coalesce(canonical,'[]'),'UTF8'),'sha256'),'hex');
end $$;

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
  if p_release_version<>'4.5.38' or p_migration_version<>56 then raise exception 'release or migration version mismatch' using errcode='22023'; end if;
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

create or replace function app.revoke_statutory_certifications() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,app as $$
declare cid uuid; source_id uuid;
begin
  if tg_table_name='cash_flow_codes' then
    update public.statutory_report_certifications
      set status='revoked',revoked_at=clock_timestamp(),revocation_reason='shared report mapping changed: cash_flow_codes'
    where status='active';
  else
    if tg_table_name='journal_lines' then
      source_id:=case when tg_op='DELETE' then old.entry_id else new.entry_id end;
      select je.company_id into cid from public.journal_entries je where je.id=source_id;
    elsif tg_table_name='companies' then
      cid:=case when tg_op='DELETE' then old.id else new.id end;
    else
      cid:=case when tg_op='DELETE' then old.company_id else new.company_id end;
    end if;
    if cid is not null then
      update public.statutory_report_certifications
        set status='revoked',revoked_at=clock_timestamp(),revocation_reason='source data changed: '||tg_table_name
      where company_id=cid and status='active';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['journal_entries','journal_lines','accounts','opening_balances','report_notes_tt133','companies','cash_flow_codes'] loop
    execute format('drop trigger if exists trg_revoke_statutory_cert_%I_v4538 on public.%I',t,t);
    execute format('create trigger trg_revoke_statutory_cert_%I_v4538 after insert or update or delete on public.%I for each row execute function app.revoke_statutory_certifications()',t,t);
  end loop;
end $$;

create or replace function app.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language plpgsql stable security definer set search_path=public,app as $$
declare
  a bigint; s bigint; fixed_net bigint; ip_net bigint; cf_close bigint; ledger_close bigint;
  note_count int; direction_errors int;
begin
  select ending_amount into a from app.report_b01a_dnn(p_from,p_to) where code='270';
  select ending_amount into s from app.report_b01a_dnn(p_from,p_to) where code='440';
  select ending_amount into fixed_net from app.report_b01a_dnn(p_from,p_to) where code='220';
  select ending_amount into ip_net from app.report_b01a_dnn(p_from,p_to) where code='230';
  select amount into cf_close from app.report_b03_dnn(p_from,p_to) where code='70';
  ledger_close:=app.account_balance_at(app.current_company_id(),'111',p_to)+app.account_balance_at(app.current_company_id(),'112',p_to);
  select count(*) into note_count from app.report_b09_certification(p_from,p_to) where workflow_complete;
  select count(*) into direction_errors
  from (
    select je.id,je.cash_flow_code,c.expected_direction,
      coalesce(sum(jl.debit-jl.credit) filter(where a.code like '111%' or a.code like '112%'),0)::bigint cash_net
    from journal_entries je
    join journal_lines jl on jl.entry_id=je.id
    join accounts a on a.id=jl.account_id
    left join cash_flow_codes c on c.code=je.cash_flow_code
    where je.company_id=app.current_company_id() and je.status='posted' and je.document_date between p_from and p_to
    group by je.id,je.cash_flow_code,c.expected_direction
  ) q
  where cash_net<>0 and (cash_flow_code is null or expected_direction is null
    or (expected_direction='inflow' and cash_net<=0)
    or (expected_direction='outflow' and cash_net>=0));

  return query values
    ('B01_BALANCE',coalesce(a=s,false),format('Tài sản=%s; Nguồn vốn=%s',a,s)),
    ('B01_CLASSIFICATION',coalesce(fixed_net>=0 and ip_net>=0,false),format('TSCĐ thuần=%s; BĐS đầu tư thuần=%s',fixed_net,ip_net)),
    ('F01_BALANCE',not exists(select 1 from app.report_f01_dnn(p_from,p_to) r where r.ending_debit<0 or r.ending_credit<0),'Số dư Nợ/Có không âm'),
    ('B03_RECONCILE',coalesce(cf_close=ledger_close,false),format('B03=%s; Sổ cái 111/112=%s',cf_close,ledger_close)),
    ('B03_DIRECTION',direction_errors=0,format('Số chứng từ tiền sai/thiếu chiều mã LCTT: %s',direction_errors)),
    ('B09_WORKFLOW',note_count=8,format('Đã hoàn tất lập-soát xét-phê duyệt độc lập %s/8 phần B09',note_count));
end $$;

create or replace function app.required_release_gates()
returns table(gate_code text,gate_name text,critical boolean,max_age interval)
language sql immutable as $$
  values
    ('deployment','Triển khai migration và API staging',true,interval '30 days'),
    ('rls','Kiểm thử RLS và cô lập công ty',true,interval '30 days'),
    ('mfa','Kiểm thử MFA AAL2 end-to-end',true,interval '30 days'),
    ('golden_dataset','Golden dataset đúng công thức',true,interval '30 days'),
    ('backup','Backup mã hóa có checksum',true,interval '36 hours'),
    ('restore','Restore drill trên database cô lập',true,interval '90 days'),
    ('load','Load test nhiều vai trò đạt ngưỡng',true,interval '30 days'),
    ('parallel_run','Đối chiếu tối thiểu hai kỳ đã khóa',true,interval '120 days'),
    ('browser_smoke','Browser smoke test các phân hệ',true,interval '30 days'),
    ('secret_scan','Quét secret và cấu hình phát hành',true,interval '30 days'),
    ('financial_statutory','BCTC Cloud khớp và B09 đủ ba cấp phê duyệt',true,interval '24 hours')
$$;

comment on table public.statutory_report_certifications is
'Server-issued evidence that B01/B02/B03 browser hashes match Supabase and B09 has eight independently approved sections. Any source-data write revokes active evidence.';
