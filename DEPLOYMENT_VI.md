# Triển khai ALPHA DESIGN ERP Cloud v4.5.32

## Trước khi triển khai

1. Lập cửa sổ bảo trì và người chịu trách nhiệm rollback.
2. Backup database; lưu checksum, thời điểm, người thực hiện và người phê duyệt.
3. Giải nén gói, chạy `npm ci`, `npm test`, `npm run build` và `npm run manifest:verify`.
4. Kiểm tra biến môi trường theo `.env.production.example`; Service Role/secret chỉ được đặt ở backend.

## Database

- Database mới: chạy `SUPABASE_PRODUCTION_SCHEMA.sql`.
- Database hiện hữu: chạy tuần tự mọi migration còn thiếu, kết thúc tại `supabase/migrations/054_production_invariants_v4527.sql`.
- Không bỏ qua migration trung gian.
- Sau khi chạy, xác nhận `schema_versions` có `4.5.32` và `companies.active_release_version = '4.5.32'`.
- Kiểm tra rollback trên Staging trước khi chạy Production.

## Runtime

1. Triển khai backend Node và nội dung thư mục `public`.
2. Xác nhận HTTPS, CSP, CORS, health endpoint và runtime-config không chứa secret.
3. Xóa cache CDN cũ nếu có; kiểm tra Service Worker nhận namespace v4.5.32.
4. Chạy smoke test đăng nhập, xem dữ liệu, thêm Draft, phê duyệt, ghi sổ, khóa kỳ, export và offline.

```bash
npm run deploy:preflight
APP_URL=https://staging-erp.alphadesign.vn EXPECTED_VERSION=4.5.32 npm run deploy:verify
npm run supabase:verify
```

## Điều kiện chuyển Production

Hoàn thành toàn bộ mục Staging thật trong `GO_LIVE_CHECKLIST.md`, đặc biệt RLS theo vai trò, TOTP/AAL2, SMTP, backup/restore, thiết bị vật lý, đối chiếu B01/B02/B03 và ký duyệt của Kế toán trưởng/Giám đốc. Không dùng kết quả Chromium cục bộ hoặc lexical SQL làm bằng chứng thay thế.
