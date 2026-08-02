# BIÊN BẢN KIỂM THỬ THÙNG RÁC VÀ KHÔI PHỤC — v4.5.66

## Phạm vi

- Chuyển bản ghi hợp lệ vào Thùng rác thay cho xóa ngay.
- Giữ nguyên payload, mã định danh, phân hệ, ngữ cảnh tab và vị trí.
- Khôi phục một bản ghi và gói hợp đồng/đợt thanh toán.
- Chặn khôi phục khi có xung đột mã định danh.
- Tính chính xác hạn 30 ngày và số ngày còn lại.
- Xóa vĩnh viễn, dọn quá hạn và dọn toàn bộ.
- Trì hoãn xóa tệp Cloud; khôi phục/xóa tệp IndexedDB cục bộ.
- Quyền `security.manage`, MFA AAL2, RLS và kiểm tra bản ghi nguồn trên Supabase.
- Hồi quy toàn bộ công thức kế toán, thuế, lương, BCTC và liên kết dữ liệu.

## Tiêu chí đạt

1. Bản ghi rời khỏi phân hệ gốc và xuất hiện trong Thùng rác với hạn đúng 30 ngày.
2. Khôi phục trả payload về đúng collection và chỉ số ban đầu; không ghi đè dữ liệu đang tồn tại.
3. Xóa vĩnh viễn loại bỏ cả bản ghi nguồn đã xóa mềm và mục Thùng rác trên Cloud.
4. Các mục quá hạn được dọn tự động khi ứng dụng khởi động/hoạt động lại và mỗi giờ; máy chủ dùng `pg_cron` nếu có.
5. Tệp Cloud không bị xóa trước thao tác purge; tệp cục bộ vẫn còn trong IndexedDB để khôi phục.
6. Mọi ràng buộc khóa sổ, chứng từ Posted, liên kết VAT, tài sản và dự án vẫn fail-closed.

## Giới hạn bằng chứng

Kiểm thử Node, SQL tĩnh, source/public parity và toàn bộ release regression là bằng chứng hiện hành của v4.5.66. Browser automation không được tuyên bố PASS nếu preflight thiếu Playwright/Chromium. Migration 074 vẫn phải chạy và thử restore/purge trên Supabase staging thật trước Production.
