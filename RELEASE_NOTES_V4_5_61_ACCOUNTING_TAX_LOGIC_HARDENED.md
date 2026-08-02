# ALPHA DESIGN ERP Cloud v4.5.61

## Accounting & Tax Logic Hardened Release

Phát hành ngày 31/07/2026.

### Sửa lỗi chính

- Sửa biên thuế TNDN: đúng 50 tỷ đồng áp dụng 20%, không còn bị xếp nhầm vào mức 17%.
- Áp dụng biểu thuế TNCN tiền lương 2026 từ 01/01/2026; di trú cấu hình 01/07 cũ và chỉ tính lại kỳ Nháp.
- Kiểm tra điều kiện thanh toán không dùng tiền mặt cho VAT đầu vào từ 5 triệu đồng, kể cả cộng gộp hóa đơn cùng nhà cung cấp trong cùng ngày.
- Khóa phát hành TT99 cho tới khi mapping Phụ lục IV được kiểm định; bản xem trước tương thích không còn có thể đi qua cổng xuất.
- Đồng bộ chứng nhận Cloud với release 4.5.61 và migration 069.
- Làm tệp bằng chứng stress có tính xác định để chạy self-test không phá checksum manifest của gói.

### Nâng cấp dữ liệu

Chạy `supabase/migrations/069_accounting_tax_legal_hardening_v4561.sql` sau các migration 001–068. Migration này thay thế hợp đồng chứng nhận TT133 cũ bằng ràng buộc release 4.5.61/migration 069.

### Trạng thái

- Local release audit: PASS.
- Financial audit mô phỏng: PASS, 100/100.
- TT99 export: BLOCKED có chủ đích.
- Production approval: PENDING các cổng dữ liệu thật, pháp lý, Cloud và phê duyệt kép.

Chi tiết xem `QA_ACCOUNTING_TAX_AUDIT_V4_5_61_VI.md`.
