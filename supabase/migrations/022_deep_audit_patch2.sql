-- ALPHA DESIGN ERP Cloud v3.7.1 Deep Audit Patch 2
-- Correct operational-mode state transitions when leaving production.

create or replace function app.set_operational_mode(p_mode text,p_release text default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,app as $$
declare cid uuid:=app.current_company_id(); readiness jsonb; old_row jsonb; new_row jsonb; release text;
begin
  perform app.assert_company_access(cid);
  if not app.has_permission('release.approve',cid) then raise exception 'release.approve permission required' using errcode='42501'; end if;
  if app.current_aal()<>'aal2' then raise exception 'MFA AAL2 required' using errcode='42501'; end if;
  if p_mode not in ('pilot','parallel','production','maintenance','suspended') then raise exception 'invalid operational mode' using errcode='22023'; end if;
  select to_jsonb(c),coalesce(nullif(p_release,''),c.active_release_version) into old_row,release from public.companies c where c.id=cid for update;
  if p_mode='production' then
    update public.companies set active_release_version=release where id=cid;
    readiness:=app.production_readiness();
    if not coalesce((readiness->>'can_go_live')::boolean,false) then raise exception 'go-live gates or dual approvals are incomplete' using errcode='55000'; end if;
    update public.companies set operational_mode='production',production_mode=true,production_writes_enabled=true,
      go_live_status='approved',go_live_approved_at=clock_timestamp(),go_live_approved_by=app.current_user_id()
    where id=cid;
  else
    update public.companies set
      operational_mode=p_mode,
      production_mode=false,
      production_writes_enabled=false,
      go_live_status=case when p_mode='suspended' then 'revoked' else 'blocked' end,
      go_live_approved_at=null,
      go_live_approved_by=null
    where id=cid;
  end if;
  select to_jsonb(c) into new_row from public.companies c where c.id=cid;
  perform app.append_audit(cid,'companies',cid::text,'SET_OPERATIONAL_MODE',old_row,new_row);
  return new_row;
end $$;

create or replace function public.set_operational_mode(p_mode text,p_release text default null)
returns jsonb language sql security definer set search_path=pg_catalog,public,app as $$
  select app.set_operational_mode(p_mode,p_release)
$$;
revoke all on function public.set_operational_mode(text,text) from public,anon;
grant execute on function public.set_operational_mode(text,text) to authenticated;
revoke all on function app.set_operational_mode(text,text) from public,anon,authenticated;

insert into public.schema_versions(version,description) values
('3.7.1-patch2','Deep audit patch 2: accounting reports, date validation, upstream timeout and safe operational-mode transitions')
on conflict(version) do nothing;
