# Checklist trước Production — v4.5.32

## Bằng chứng tự động trên đúng gói

- [x] `npm test` hoàn thành toàn bộ release audit.
- [x] 61.250 kịch bản hiện hữu + 40.007 độc lập + 470.000 phép kiểm tra đối kháng PASS.
- [x] Production invariants có 64 assertion code/static và 19/19 kiểm tra runtime trình duyệt PASS.
- [x] Stress 10.000 chứng từ / 20.000 dòng cân bằng Nợ–Có.
- [x] Golden dataset và liên kết Dashboard/phân hệ PASS.
- [x] Structural UI 364/364; global table/action 208/208.
- [x] Accessibility/integration 11/11; input workflow 30/30; modal scroll 24/24.
- [x] Mobile Security Center 6/6; interaction smoke 26/26 phân hệ.
- [x] Responsive 360/390/430/768/820/1024, light/dark PASS.
- [x] Offline fail-closed và XSS browser audit PASS.
- [x] Browser runner 16/16 bước; không trùng bước, có timeout và khóa chống chạy đồng thời.
- [x] Paid ↔ Posted cash journal exact/unique, allocation parent lock và schedule immutability PASS.
- [x] B01a-DNN 411–417 cộng đúng vào 400 ở đầu và cuối kỳ.
- [x] Migration chain 001–054 liên tục; consolidated schema và checksum được sinh lại.
- [x] Backend, source/public parity, package integrity, secret scan và junk scan PASS.
- [x] Manifest SHA-256 bao phủ toàn bộ tệp trong gói.

## Bắt buộc trên Staging thật

- [ ] Backup database trước triển khai; lưu checksum và người phê duyệt.
- [ ] Chạy migrations 001–054 trên Supabase Staging; xác nhận rollback khi migration thất bại.
- [ ] Xác nhận `schema_versions` có `4.5.32` và `active_release_version = '4.5.32'`.
- [ ] Chạy test cạnh tranh: hai giao dịch đồng thời không thể tái sử dụng một cash journal hoặc vượt mức phân bổ.
- [ ] Kiểm thử dữ liệu legacy: `record_id` và `payload.id` được chuẩn hóa, mọi liên kết vẫn đúng.
- [ ] Chuyển runtime khỏi Demo bằng Supabase URL/publishable key thật; secret chỉ ở backend.
- [ ] Kiểm thử Draft → Posted bị chặn với `accounting.write` và được phép với `accounting.post` + AAL2.
- [ ] Kiểm thử sửa/xóa Posted, lịch đã Posted và bản ghi có phụ thuộc đều bị database từ chối.
- [ ] Kiểm thử khóa/mở kỳ; mở khóa phải lưu lý do và audit actor.
- [ ] Kiểm thử timesheet/procurement approval với tài khoản có và không có quyền.
- [ ] TOTP enrollment, sign-in, AAL2 refresh và recovery bằng Authenticator thật.
- [ ] RLS với tối thiểu Giám đốc, Kế toán trưởng và Quản lý dự án.
- [ ] SMTP/Microsoft 365 và email khôi phục mật khẩu thật.
- [ ] Backup/restore drill; đối chiếu số lượng bản ghi và số dư sau restore.
- [ ] UAT Safari trên iPhone/iPad và Android vật lý.
- [ ] Kiểm thử adapter ngân hàng/email/hóa đơn điện tử nếu bật.
- [ ] Đối chiếu B01/B02/B03 với sổ kế toán đã phê duyệt và mẫu biểu doanh nghiệp áp dụng.
- [ ] Kế toán trưởng xác nhận chính sách thuế, số dư đầu kỳ, tài khoản chi tiết và cách kết chuyển.
- [ ] Chạy song song 2–3 kỳ hoặc phạm vi mẫu được phê duyệt.
- [ ] Kế toán trưởng và Giám đốc ký xác nhận độc lập.

> Chỉ chuyển `productionApproval=true` sau khi mọi mục bắt buộc có bằng chứng, người thực hiện và người phê duyệt.
