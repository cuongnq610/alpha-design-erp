-- ALPHA DESIGN ERP v4.5.31 — Khởi tạo công ty và Giám đốc đầu tiên.
-- 1) Tạo người dùng trong Supabase Dashboard > Authentication > Users.
-- 2) Thay ba giá trị PLACEHOLDER bên dưới.
-- 3) Chạy đúng MỘT LẦN trong SQL Editor sau khi schema v4.5.31 đã được áp dụng.

begin;

do $$
declare
  v_email text := 'DIRECTOR_EMAIL@example.com';
  v_company_code text := 'ALPHA';
  v_company_name text := 'ALPHA DESIGN CO., LTD';
  v_full_name text := 'PHAM GIANG NAM';
  v_user_id uuid;
  v_company_id uuid;
  v_role_id uuid;
begin
  select id into v_user_id from auth.users where lower(email)=lower(v_email) limit 1;
  if v_user_id is null then raise exception 'Không tìm thấy Auth user: %',v_email; end if;
  if exists(select 1 from public.memberships where user_id=v_user_id and status='active') then
    raise exception 'Người dùng đã có membership; dừng để tránh tạo trùng';
  end if;

  insert into public.companies(code,name,accounting_regime,production_mode,require_mfa_for_privileged)
  values(upper(trim(v_company_code)),trim(v_company_name),'TT133/2016/TT-BTC',false,true)
  returning id into v_company_id;

  insert into public.profiles(user_id,full_name,email,status)
  values(v_user_id,v_full_name,v_email,'active')
  on conflict(user_id) do update set full_name=excluded.full_name,email=excluded.email,status='active';

  insert into public.roles(company_id,code,name,permissions)
  values(v_company_id,'DIRECTOR','Giám đốc',array['admin','dashboard.read'])
  returning id into v_role_id;

  insert into public.memberships(company_id,user_id,role_id,status)
  values(v_company_id,v_user_id,v_role_id,'active');

  perform set_config('request.jwt.claim.sub',v_user_id::text,true);
  perform set_config('request.jwt.claim.company_id',v_company_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user_id,'email',v_email,'aal','aal2','app_metadata',jsonb_build_object('company_id',v_company_id))::text,true);
  perform app.seed_alpha_design_reference(v_company_id);

  raise notice 'COMPANY_ID=%',v_company_id;
end $$;

commit;

-- Sau khi chạy: lấy Company ID để điền ALPHA_COMPANY_ID trên server.
select c.id company_id,c.code,c.name,p.full_name,r.code role_code,m.status
from public.memberships m
join public.companies c on c.id=m.company_id
join public.profiles p on p.user_id=m.user_id
join public.roles r on r.id=m.role_id
where upper(r.code)='DIRECTOR'
order by m.created_at desc
limit 5;
