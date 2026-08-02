-- ALPHA DESIGN ERP Cloud v3.8.0 Final Release Audit
-- Align the private storage bucket used by the web client with database policies and enforce the UI's 100 MB limit server-side.

do $$
begin
  if exists(select 1 from information_schema.schemata where schema_name='storage') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('company-files','company-files',false,104857600,null)
    on conflict(id) do update
      set public=false,
          file_size_limit=excluded.file_size_limit;
  end if;
end $$;

comment on table public.files_metadata is 'ALPHA DESIGN company file metadata. Binary objects are stored in private bucket company-files under a company-id-prefixed path.';
