# TRIỂN KHAI DATABASE POSTGRESQL/SUPABASE

## 1. Chuẩn bị

- Tạo Supabase project dành riêng cho Production.
- Bật MFA cho tài khoản quản trị Supabase.
- Ghi nhận Project URL và anon public key.
- Không đưa service-role key vào mã frontend hoặc email/chat.
- Tạo thêm project Staging để thử migration trước Production.

## 2. Chạy migration

Có hai phương án:

### Supabase CLI

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Thư mục migration: `supabase/migrations`.

### SQL Editor

Chạy file `SUPABASE_PRODUCTION_SCHEMA.sql` trên một project mới. Với database đã có dữ liệu, ưu tiên migration từng file và backup trước khi chạy.

## 3. Tạo công ty và quản trị viên đầu tiên

1. Tạo user trong Supabase Auth.
2. Tạo bản ghi `companies`.
3. Tạo `profiles`, `roles` và `memberships` bằng service backend hoặc SQL quản trị.
4. Gán quyền `admin` cho vai trò Giám đốc.
5. Đặt `company_id` trong `app_metadata` của user hoặc chọn công ty qua backend.
6. Gọi:

```sql
select app.seed_alpha_design_reference('<COMPANY_UUID>');
```

Hàm này tạo bộ môn, phòng ban, vai trò chuẩn và hệ tài khoản TT133.

## 4. Cấu hình Storage

Migration tạo bucket riêng tư `company-files` nếu chạy trên Supabase. Đường dẫn file phải theo cấu trúc:

```text
{company_id}/{project_id-or-general}/{file_id}/{version_no}/{filename}
```

RLS Storage kiểm tra quyền `documents.read` và `documents.write`.

## 5. Cấu hình frontend

Điền trong `runtime-config.js`:

```javascript
window.ALPHA_RUNTIME_CONFIG = {
  supabaseUrl: 'https://<PROJECT_REF>.supabase.co',
  supabaseAnonKey: '<ANON_PUBLIC_KEY>'
};
```

Không đặt service-role key tại đây.

## 6. Kiểm tra sau triển khai

```sql
select app.database_health();
select * from app.validate_database_integrity('<COMPANY_UUID>');
select * from app.verify_audit_chain('<COMPANY_UUID>');
```

Kiểm tra bằng nhiều tài khoản:

- Nhân viên không xem bảng lương người khác.
- Quản lý dự án chỉ sửa dữ liệu đúng quyền.
- Kế toán viên không khóa kỳ nếu thiếu quyền.
- Chứng từ đã ghi sổ không sửa/xóa.
- Audit log không thể update/delete qua API.

## 7. Realtime

Các bảng chính được thêm vào publication `supabase_realtime`. Kiểm tra các thiết bị đăng nhập cùng công ty nhận được thay đổi dự án, nhiệm vụ, timesheet, chứng từ, hóa đơn và thông báo.

## 8. Backup và phục hồi

- Bật backup tự động và PITR nếu gói dịch vụ hỗ trợ.
- Backup file Storage riêng.
- Khôi phục định kỳ vào project thử nghiệm.
- Sau restore, chạy `app.validate_database_integrity()` và so sánh số lượng file, checksum, tổng Nợ/Có.

## 9. Go-live

Chỉ go-live khi:

- Migration chạy thành công trên Staging và Production.
- RLS test đạt.
- Load test đạt ngưỡng.
- Backup restore drill thành công.
- Chạy song song 2–3 kỳ không còn chênh lệch chưa giải thích.
- Kế toán trưởng và Giám đốc ký biên bản nghiệm thu.
