# ALPHA DESIGN ERP Cloud v4.5.60 — QA VERIFIED EXPORT GATE HARDENED RELEASE

## Thay đổi

- Dùng chung một cổng phát hành fail-closed cho XLSX, PDF, CSV, XML, DOCX, JSON và ZIP.
- Chặn gói ZIP đầy đủ khi BCTC TT133/TT99 chưa cân đối, thiếu thuyết minh hoặc chưa đủ chứng nhận áp dụng.
- Chặn JSON BCTC và nút in/PDF trực tiếp nếu chưa vượt cổng phát hành.
- Đồng bộ gói TT99 sang B03-DN và tiêu đề hệ tài khoản TT99; không đưa biểu mẫu TT133 không hoạt động vào gói.
- Đồng bộ metadata lưới bảng theo đúng phiên bản hiện tại.
- Bổ sung kiểm thử browser đủ bảy định dạng và kiểm tra cấu trúc tệp sau khi tải.
- Loại bỏ ba script browser lịch sử đã bị thay thế bởi các bài kiểm thử hiện hành.

## Kiểm thử

- `npm test`: PASS toàn bộ release audit.
- `npm run test:browser`: PASS 18/18.
- `npm run test:browser:extended`: PASS 11/11.
- Structural UI: PASS 364/364 trạng thái.
- TT99 export activation: PASS 15/15.
- Export center: PASS 33/33.

## Giới hạn

`productionApproval=false`. Vẫn cần Supabase thật, đối chiếu dữ liệu công ty, xác nhận schema thuế/pháp định, backup/restore và phê duyệt kép.
