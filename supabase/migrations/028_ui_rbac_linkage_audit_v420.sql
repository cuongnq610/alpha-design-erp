-- ALPHA DESIGN ERP Cloud v4.2.0 UI, Director-managed module RBAC and linkage controls.

alter table public.companies alter column active_release_version set default '4.2.0';
update public.companies
set active_release_version='4.2.0', go_live_status='blocked', go_live_approved_at=null, go_live_approved_by=null
where active_release_version='4.1.0' and operational_mode in ('pilot','parallel','maintenance');

create or replace function app.current_user_is_director(p_company uuid default app.current_company_id()) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,app as $$
  select exists(
    select 1
    from public.memberships m
    join public.roles r on r.id=m.role_id
    where m.company_id=p_company
      and m.user_id=app.current_user_id()
      and m.status='active'
      and (upper(r.code)='DIRECTOR' or 'admin'=any(coalesce(r.permissions,array[]::text[])))
  )
$$;
revoke all on function app.current_user_is_director(uuid) from public,anon;
grant execute on function app.current_user_is_director(uuid) to authenticated;

create or replace function app.list_company_roles() returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); result jsonb;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('users.manage',cid)
     and not app.has_permission('roles.manage',cid)
     and not app.has_permission('admin',cid) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'role_id',r.id,
    'role_code',r.code,
    'role_name',r.name,
    'role_description',coalesce(r.description,''),
    'is_admin',(upper(r.code)='DIRECTOR' or 'admin'=any(coalesce(r.permissions,array[]::text[]))),
    'permissions',(
      select to_jsonb(array(
        select distinct pcode from (
          select unnest(coalesce(r.permissions,array[]::text[])) pcode
          union all
          select rp.permission_code from public.role_permissions rp where rp.role_id=r.id
        ) q where nullif(trim(pcode),'') is not null order by pcode
      ))
    )
  ) order by r.name),'[]'::jsonb)
  into result
  from public.roles r
  where r.company_id=cid;
  return result;
end $$;
revoke all on function app.list_company_roles() from public,anon;
grant execute on function app.list_company_roles() to authenticated;

create or replace function public.list_company_roles() returns jsonb
language sql stable security definer set search_path=pg_catalog,public,app as $$
  select app.list_company_roles()
$$;
revoke all on function public.list_company_roles() from public,anon;
grant execute on function public.list_company_roles() to authenticated;

create or replace function app.update_role_module_permissions(p_role_code text,p_permissions text[]) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare
  cid uuid:=app.current_company_id();
  rid uuid;
  old_permissions text[];
  clean_permissions text[];
  invalid_permissions text[];
begin
  perform app.assert_company_access(cid);
  if not app.current_user_is_director(cid) then
    raise exception 'only Director can change role module access' using errcode='42501';
  end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required' using errcode='42501'; end if;
  select id,coalesce(permissions,array[]::text[]) into rid,old_permissions
  from public.roles where company_id=cid and code=p_role_code for update;
  if rid is null then raise exception 'role not found' using errcode='P0002'; end if;
  if upper(p_role_code)='DIRECTOR' or 'admin'=any(old_permissions) then
    raise exception 'Director permissions are fixed and cannot be reduced' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct trim(x) order by trim(x)),array[]::text[])
  into clean_permissions
  from unnest(coalesce(p_permissions,array[]::text[])) x
  where nullif(trim(x),'') is not null;
  if not 'dashboard.read'=any(clean_permissions) then
    clean_permissions:=array_append(clean_permissions,'dashboard.read');
  end if;
  select coalesce(array_agg(x),array[]::text[]) into invalid_permissions
  from unnest(clean_permissions) x
  where not exists(select 1 from public.permissions p where p.code=x);
  if cardinality(invalid_permissions)>0 then
    raise exception 'unknown permissions: %',array_to_string(invalid_permissions,', ') using errcode='22023';
  end if;
  delete from public.role_permissions where role_id=rid;
  insert into public.role_permissions(role_id,permission_code)
  select rid,x from unnest(clean_permissions) x;
  update public.roles set permissions=clean_permissions where id=rid;
  perform app.append_audit(cid,'roles',rid::text,'UPDATE_MODULE_ACCESS',to_jsonb(old_permissions),to_jsonb(clean_permissions));
  return jsonb_build_object('role_code',p_role_code,'permissions',clean_permissions);
end $$;
revoke all on function app.update_role_module_permissions(text,text[]) from public,anon;
grant execute on function app.update_role_module_permissions(text,text[]) to authenticated;

create or replace function public.update_role_module_permissions(p_role_code text,p_permissions text[]) returns jsonb
language sql security definer set search_path=pg_catalog,public,app as $$
  select app.update_role_module_permissions(p_role_code,p_permissions)
$$;
revoke all on function public.update_role_module_permissions(text,text[]) from public,anon;
grant execute on function public.update_role_module_permissions(text,text[]) to authenticated;

insert into public.schema_versions(version,description) values
('4.2.0','UI display fixes, safe contract deletion, Director-managed module access, contract KPI filtering and cross-module linkage audit')
on conflict(version) do update set description=excluded.description,applied_at=clock_timestamp();
