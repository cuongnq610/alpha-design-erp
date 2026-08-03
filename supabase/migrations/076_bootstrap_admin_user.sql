-- Bootstrap the first ALPHA DESIGN administrator and link them to the ALPHA company.
--
-- Keyed by EMAIL (not UID) so it is portable across Supabase projects: the auth user's
-- UID differs per project, but the email is stable. Fully idempotent (safe to re-run on
-- every `db push` / `db reset`) and self-skipping: if the auth user (or the auth schema)
-- is not present in this environment, it logs a NOTICE and does nothing instead of failing.
--
-- To onboard a different director, change v_admin_email below.
do $$
declare
  v_admin_email text := 'giangnam.est@gmail.com';
  v_uid     uuid;
  v_company uuid;
  v_role    uuid;
begin
  -- auth.users only exists on a real Supabase project; skip on plain/local Postgres.
  if to_regclass('auth.users') is null then
    raise notice 'bootstrap_admin: auth.users not present; skipping.';
    return;
  end if;

  select id into v_uid from auth.users where lower(email) = lower(v_admin_email) limit 1;
  if v_uid is null then
    raise notice 'bootstrap_admin: auth user % not found; skipping.', v_admin_email;
    return;
  end if;

  insert into public.companies(code, name, require_mfa_for_privileged)
  values ('ALPHA', 'ALPHA DESIGN', false)
  on conflict (code) do update set require_mfa_for_privileged = excluded.require_mfa_for_privileged
  returning id into v_company;

  insert into public.roles(company_id, code, name, permissions)
  values (v_company, 'director', 'Giám đốc', array['admin'])
  on conflict (company_id, code) do update set permissions = excluded.permissions
  returning id into v_role;

  insert into public.profiles(user_id, full_name, email, status)
  values (v_uid, 'Giám đốc ALPHA', v_admin_email, 'active')
  on conflict (user_id) do update set status = 'active', email = excluded.email;

  insert into public.memberships(company_id, user_id, role_id, status)
  values (v_company, v_uid, v_role, 'active')
  on conflict (company_id, user_id) do update set role_id = excluded.role_id, status = 'active';

  raise notice 'bootstrap_admin: linked % as director/admin of company % .', v_admin_email, v_company;
end $$;
