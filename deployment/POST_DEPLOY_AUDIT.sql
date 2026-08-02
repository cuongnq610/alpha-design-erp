-- Thay COMPANY_UUID và DIRECTOR_USER_UUID trước khi chạy trong SQL Editor.
begin;
select set_config('request.jwt.claim.sub','DIRECTOR_USER_UUID',true);
select set_config('request.jwt.claim.company_id','COMPANY_UUID',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','DIRECTOR_USER_UUID','aal','aal2','app_metadata',jsonb_build_object('company_id','COMPANY_UUID'))::text,true);

-- Phiên bản schema.
select version,description,applied_at from public.schema_versions order by applied_at desc limit 15;

-- Mọi bảng public có dữ liệu nghiệp vụ phải bật RLS.
select n.nspname schema_name,c.relname table_name,c.relrowsecurity rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname not like 'schema_%' and not c.relrowsecurity
order by c.relname;

-- Publication Realtime bắt buộc có entity_records.
select schemaname,tablename from pg_publication_tables
where pubname='supabase_realtime'
order by tablename;

-- Bucket hồ sơ phải private.
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='company-files';

-- Vai trò, permission và membership.
select r.code,r.name,count(rp.permission_code) permission_count
from public.roles r left join public.role_permissions rp on rp.role_id=r.id
where r.company_id='COMPANY_UUID'::uuid
group by r.id order by r.code;

-- Kiểm tra toàn vẹn dữ liệu và chuỗi audit.
select * from app.validate_database_integrity('COMPANY_UUID'::uuid,current_date-interval '365 days',current_date);
select * from app.verify_audit_chain('COMPANY_UUID'::uuid);
select public.production_readiness();
commit;
