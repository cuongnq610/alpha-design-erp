# THIẾT KẾ DATABASE – ALPHA DESIGN ERP CLOUD v4.5.30

## 1. Mục tiêu

Database là nguồn dữ liệu trung tâm duy nhất cho máy tính, iPhone và iPad. Mọi thiết bị đăng nhập cùng hệ thống sẽ đọc và ghi vào PostgreSQL/Supabase, thay vì lưu dữ liệu nghiệp vụ chính trong từng trình duyệt.

Thiết kế tập trung vào bốn yêu cầu:

1. **Tính đúng kế toán:** chứng từ kép, số tiền nguyên VND, khóa kỳ, bất biến sau ghi sổ, báo cáo TT133.
2. **Đồng bộ đa thiết bị:** Realtime, idempotency, outbox, phiên bản bản ghi và xử lý xung đột.
3. **Bảo mật nhiều người dùng:** multi-tenant, RLS, RBAC, quyền theo module và audit bất biến.
4. **Vận hành công ty thiết kế:** dự án, giai đoạn, bộ môn, nhân sự, timesheet, lương, hợp đồng, hồ sơ và chi phí dự án.

## 2. Nền tảng kỹ thuật

- PostgreSQL/Supabase làm database production.
- Supabase Auth quản lý đăng nhập.
- Row-Level Security bảo vệ từng dòng dữ liệu.
- Supabase Realtime truyền thay đổi giữa các thiết bị.
- Supabase Storage lưu hợp đồng, bản vẽ, PDF và Excel.
- PostgreSQL RPC thực hiện nghiệp vụ ACID như ghi sổ, khóa kỳ và duyệt timesheet.
- `bigint` dùng cho mọi giá trị tiền VND; không dùng `float` hoặc `double precision`.

## 3. Cấu trúc module

### Tenant và phân quyền

- `companies`, `branches`, `profiles`, `memberships`.
- `roles`, `permissions`, `role_permissions`, `membership_roles`.
- Một người có thể có nhiều vai trò trong cùng công ty.
- Quyền được kiểm tra tại database qua `app.has_permission()`.

### CRM, hợp đồng và dự án

- `clients`, `vendors`, `contacts`.
- `projects`, `project_stages`, `project_assignments`.
- `contracts`, `contract_milestones`.
- `tasks`, `task_assignments`.

### Nhân sự, chấm công và lương

- `employees`, `departments`, `disciplines`.
- `timesheets` lưu giờ làm, billable hours, cost rate và billing rate tại thời điểm ghi nhận.
- `payroll_periods`, `payroll_items` quản lý kỳ lương và kết quả tính lương.

### Kế toán TT133

- `accounting_periods`, `accounts`, `opening_balances`.
- `journal_entries`, `journal_lines`.
- Chứng từ chỉ được ghi sổ khi Nợ bằng Có và kỳ đang mở.
- Chứng từ đã ghi sổ không được sửa hoặc xóa; điều chỉnh bằng bút toán đảo.
- `report_snapshots` đóng băng dữ liệu báo cáo cùng SHA-256.

### Công nợ, ngân hàng và tài sản

- `subledger_documents`, `payments`, `payment_allocations`.
- `bank_accounts`, `bank_transactions`, `bank_reconciliations`.
- `fixed_assets`, `fixed_asset_depreciation`.
- `prepaid_expenses`, `prepaid_allocations`.

### Thuế

- `tax_invoices` quản lý hóa đơn VAT đầu vào/đầu ra.
- `tax_rules` quản lý quy tắc theo phiên bản và ngày hiệu lực.
- `tax_declarations`, `tax_declaration_lines`, `tax_payments`.
- Chế độ kế toán TT133 được tách khỏi quy tắc thuế để cập nhật chính sách mà không thay cấu trúc sổ kế toán.

### Mua hàng và chi phí

- `purchase_requests`, `purchase_orders`, `purchase_order_lines`.
- `expense_claims`.
- Tổng đơn mua hàng được database tính lại từ các dòng chi tiết.

### Hồ sơ và tích hợp

- `files_metadata`, `document_versions`.
- `integration_connections` quản lý trạng thái kết nối hóa đơn điện tử, ngân hàng và chữ ký số.
- Storage sử dụng đường dẫn theo công ty và dự án; RLS kiểm tra quyền trước khi tải hoặc đọc file.

### Đồng bộ và audit

- `idempotency_keys` chống gửi trùng khi thiết bị mất mạng rồi gửi lại.
- `outbox_events` bảo đảm sự kiện đồng bộ được tạo trong cùng transaction với dữ liệu nghiệp vụ.
- `device_registrations`, `sync_checkpoints` theo dõi thiết bị và tiến trình đồng bộ.
- `audit_events` là bảng append-only, liên kết hash SHA-256 theo chuỗi.

## 4. Kiểm soát độ tin cậy

### ACID

Các RPC nghiệp vụ chạy trong một transaction PostgreSQL. Nếu một bước thất bại, toàn bộ nghiệp vụ được rollback.

### Khóa đồng thời

- `FOR UPDATE` khóa bản ghi khi ghi sổ hoặc phê duyệt.
- `pg_advisory_xact_lock` tuần tự hóa đánh số chứng từ, ghi sổ và khóa kỳ.
- `row_version` phát hiện thiết bị đang dùng dữ liệu cũ.
- Lỗi xung đột trả mã `40001`; giao diện phải yêu cầu người dùng tải lại thay vì ghi đè.

### Bất biến kế toán

- Chứng từ `posted` không sửa/xóa.
- Kỳ `hard_locked` không nhận thêm bút toán.
- Bảng lương đã `posted/locked` không sửa dòng chi tiết.
- Tờ khai thuế đã `accepted/closed` chỉ điều chỉnh bằng bản khai bổ sung.

### Audit

Mỗi sự kiện chứa:

- Công ty và người thực hiện.
- Thời gian máy chủ và transaction ID.
- Dữ liệu trước/sau.
- Request ID, IP, user agent khi có.
- `previous_hash` và `event_hash`.

Hàm `app.verify_audit_chain()` kiểm tra lại toàn bộ chuỗi.

## 5. Báo cáo và đối chiếu

Database giữ các hàm báo cáo:

- B01a-DNN.
- B02-DNN.
- B03-DNN.
- B09-DNN.
- F01-DNN.

`app.validate_database_integrity()` kiểm tra:

- Chứng từ Nợ/Có.
- Bảng cân đối phát sinh.
- Ghi sổ sau khóa kỳ.
- Phép tính VAT.
- Phân bổ thanh toán.
- Timesheet.
- Lương thực nhận.
- Chuỗi audit.

`app.close_accounting_period_strict()` chỉ khóa kỳ khi các kiểm tra bắt buộc đạt.

## 6. Luồng đồng bộ máy tính – iPhone – iPad

1. Thiết bị gửi yêu cầu với `client_request_id`.
2. PostgreSQL kiểm tra idempotency.
3. Nghiệp vụ được ghi trong transaction ACID.
4. Trigger tạo `outbox_events` trong cùng transaction.
5. Supabase Realtime gửi sự kiện tới các thiết bị đang mở.
6. Thiết bị cập nhật dữ liệu cục bộ.
7. Nếu `row_version` không khớp, server từ chối và yêu cầu xử lý xung đột.

## 7. Nguyên tắc triển khai production

- Dùng ba môi trường: Development, Staging, Production.
- Chỉ thay đổi schema bằng migration đã lưu trong Git.
- Không đặt service-role key trong frontend.
- Backup database và Storage độc lập.
- Chạy thử khôi phục backup trước go-live.
- Chạy song song 2–3 kỳ với phần mềm kế toán hiện hành.
- Kế toán trưởng ký nghiệm thu báo cáo TT133 và số dư.

## 8. Phạm vi chưa tự động hoàn toàn

- Kết nối thực tế với nhà cung cấp hóa đơn điện tử, ngân hàng và chữ ký số cần API/credentials riêng.
- Quy tắc thuế phải được kế toán trưởng phê duyệt theo thời điểm áp dụng.
- Database package chưa tự tạo Supabase project hoặc tên miền; cần triển khai vào hạ tầng thật.
