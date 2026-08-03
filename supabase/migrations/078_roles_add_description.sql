-- list_company_roles() (migration 028) returns coalesce(r.description,''), but the roles
-- table (001) was created without a description column. Calling the RPC therefore fails at
-- runtime with 42703 (column r.description does not exist) — a latent error the migration
-- replay can't catch, since plpgsql column references resolve only at execution time.
-- Add the column to match the function's contract; nullable-with-default so existing rows
-- and inserts that omit it (seed, provision_company, bootstrap) remain valid.
alter table public.roles add column if not exists description text not null default '';
