# BÁO CÁO PHÁT HÀNH v4.5.60 — QA VERIFIED EXPORT GATE HARDENED RELEASE

## Kết quả

Bản v4.5.60 sửa hai lỗi phát hành quan trọng của v4.5.59: gói ZIP đầy đủ chưa dùng chung cổng kiểm soát BCTC, và một số dữ liệu TT99 trong gói vẫn mang nhãn TT133. Bản vá không thay đổi công thức lõi, payload dữ liệu hoặc migration 068.

- Release audit Node/backend/security: PASS.
- Browser release audit: PASS 18/18.
- Browser regression mở rộng: PASS 11/11.
- Structural UI: PASS 364/364 trạng thái, 0 issue record.
- TT99 browser audit: PASS 15/15; tải XLSX hợp lệ.
- Export center: PASS 33/33 cho XLSX, PDF print view, CSV, XML, DOCX, JSON và ZIP.
- Responsive: PASS tại 360, 390, 430, 768, 820 và 1024 px.
- Offline/reconnect và XSS: PASS.

## Lỗi đã đóng

- Full ZIP bypass cổng kiểm soát TT133/TT99.
- JSON BCTC và nút in/PDF trực tiếp chưa dùng chung cổng chứng nhận.
- Gói TT99 có thể mang nhãn B03-DNN và hệ tài khoản TT133.
- Metadata lưới bảng còn cố định ở v4.5.50.
- Hồ sơ phát hành ghi mâu thuẫn về trạng thái browser audit.
- Ba script browser cũ dùng selector của giao diện đã bị thay thế.

## Kết luận

Bản này đủ điều kiện làm release candidate cho UAT/staging có kiểm soát. Chưa đủ căn cứ tự phê duyệt Production cho tới khi hoàn thành các cổng bên ngoài trong `EXTERNAL_GATES_STATUS_V4_5_60.json`.
