# Checklist chuyển ALPHA DESIGN ERP v4.5.30 sang Production

## Gate bắt buộc

- [ ] Supabase Production là project riêng, không dùng chung Staging.
- [ ] Schema database đã áp dụng đầy đủ migration 001–054; `schema_versions` và `active_release_version` đều là 4.5.30.
- [ ] RLS bật trên toàn bộ bảng nghiệp vụ; Security Advisor không còn lỗi Critical.
- [ ] `entity_records` nằm trong publication `supabase_realtime`.
- [ ] Bucket `company-files` tồn tại và `public=false`.
- [ ] Auth signup công khai đã tắt; email confirmation và SMTP thật đã bật; quên/đổi mật khẩu UAT thành công.
- [ ] Site URL và Redirect URLs chỉ chứa URL HTTPS chính xác.
- [ ] Giám đốc và Kế toán trưởng đăng ký MFA; đăng nhập và thao tác đặc quyền đều đạt AAL2.
- [ ] Mắt Bão chạy Node.js 20/22 LTS; startup file `passenger.cjs`.
- [ ] `/api/health` trả version 4.5.30, `server-authoritative` và `supabaseConfigured=true`.
- [ ] Kiểm thử cạnh tranh xác nhận một cash journal không thể nối hai khoản Paid và phân bổ không thể vượt cha.
- [ ] Lịch CCDC/TSCĐ và chứng từ định kỳ đã Posted không thể sửa, đổi trạng thái hoặc xóa.
- [ ] `/runtime-config.js` không chứa Service Role key hoặc secret.
- [ ] DNS/SSL hợp lệ; HTTP chuyển 301 sang HTTPS; CORS chỉ cho phép domain đã duyệt.
- [ ] UAT đa thiết bị hoàn thành, không có lỗi chặn vận hành.
- [ ] Backup độc lập đã tạo và restore drill thành công.
- [ ] `app.validate_database_integrity` kiểm tra trọng yếu PASS.
- [ ] `app.verify_audit_chain` trả `valid=true`.
- [ ] Đối chiếu B01/B02/B03 và sổ chi tiết với dữ liệu kiểm thử đã ký duyệt.
- [ ] Giám đốc và Kế toán trưởng ký quyết định GO-LIVE.

## Sau khi mở Production

- [ ] Theo dõi log 24 giờ đầu, lỗi 401/403/5xx và Realtime disconnect.
- [ ] Chạy song song với hệ thống cũ ít nhất 2–3 kỳ kế toán.
- [ ] Backup hằng ngày; kiểm tra restore hằng quý.
- [ ] Mọi thay đổi schema đi qua migration, không sửa trực tiếp Table Editor.
