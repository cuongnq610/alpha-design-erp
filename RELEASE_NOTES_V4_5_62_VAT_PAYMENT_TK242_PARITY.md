# ALPHA DESIGN ERP Cloud v4.5.62

## VAT Payment & TK242 Parity Release

Phát hành ngày 01/08/2026.

### Lỗi đã sửa

- Không còn dùng riêng cờ `paymentStatus: Paid` do người dùng nhập để kết luận VAT đầu vào đủ điều kiện khấu trừ.
- Chỉ công nhận bằng chứng thanh toán khi khoản chi `Expense/Paid` liên kết đúng hóa đơn đầu vào, đúng nhà cung cấp, đúng dự án và đúng bút toán `Posted` có số giảm TK 112 bằng chính xác số tiền thanh toán; TK 111 phải bằng 0.
- Thanh toán một phần được khấu trừ VAT theo tỷ lệ số tiền đã xác minh trên tổng giá thanh toán. Ví dụ hóa đơn 330.000.000 đồng, VAT 30.000.000 đồng, đã thanh toán hợp lệ 165.000.000 đồng thì VAT được khấu trừ là 15.000.000 đồng.
- Loại chứng từ sai nhà cung cấp, dùng tiền mặt, ngày thanh toán sau ngày chốt, chứng từ chưa ghi sổ hoặc tổng thanh toán vượt hóa đơn.
- Đồng bộ phân loại TK 242 giữa báo cáo tình hình tài chính và B01. TK 242 không có `reportClass` được xếp vào tài sản dài hạn; chỉ `current_other_asset` mới vào tài sản ngắn hạn.
- Bảo vệ liên kết hóa đơn–thanh toán ở giao diện, calculation core, kiểm tra toàn vẹn và migration phía máy chủ.

### Nâng cấp dữ liệu

Chạy `supabase/migrations/070_vat_payment_evidence_tk242_parity_v4562.sql` sau migration 069. Migration 070:

- khóa tổng thanh toán Paid liên kết không được vượt tổng hóa đơn;
- yêu cầu đúng hóa đơn đầu vào, nhà cung cấp và bút toán ngân hàng;
- không cho sửa/xóa bằng chứng Paid đã liên kết theo cách làm mất dấu vết;
- ràng buộc chứng nhận TT133 với release 4.5.62 và migration 070.

Không đổi namespace dữ liệu trình duyệt v4.5.58 và không đổi phiên bản công thức bảng lương `ALPHA-PAYROLL-4.5.61`, vì bản vá này không thay đổi công thức payroll.

### Kiểm thử phát hành

- `npm test`: PASS toàn bộ release audit.
- `npm run audit:financial`: PASS, điểm kiểm soát 100/100; không có lỗi nghiêm trọng hoặc cảnh báo thất bại trên dữ liệu mô phỏng.
- Kiểm thử VAT chuyên biệt: PASS các trường hợp không có chứng từ, thanh toán đủ, một phần, nhiều lần, sai nhà cung cấp, TK 111, sau ngày chốt và vượt tổng hóa đơn.
- Kiểm thử TK 242: PASS cả phân loại mặc định dài hạn và phân loại ngắn hạn khai báo rõ.
- Migration 001–070, consolidated schema, package integrity và source/public parity: PASS ở mức kiểm thử tĩnh cục bộ.

### Giới hạn phát hành

- Chưa chạy migration 070 trên Supabase thật.
- Chưa đối chiếu song song với sao kê ngân hàng, hóa đơn điện tử và sổ cái đã ký của doanh nghiệp.
- Không tuyên bố đã chạy lại bộ trình duyệt cho v4.5.62 trong môi trường này.
- TT99 tiếp tục bị khóa phát hành cho đến khi mapping Phụ lục IV được kiểm định độc lập.
- `productionApproval` tiếp tục là `false`; gói phù hợp cho UAT và triển khai staging có kiểm soát.

Chi tiết xem `QA_ACCOUNTING_TAX_AUDIT_V4_5_62_VI.md`.
