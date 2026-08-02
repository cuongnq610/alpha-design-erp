# BÁO CÁO BẢN VÁ MÀU VÒNG CƠ CẤU PHÒNG BAN

**Sản phẩm:** ALPHA DESIGN ERP Cloud v4.5.60  
**Ngày kiểm tra:** 31/07/2026  
**Phạm vi:** Phân hệ Nhân sự → Danh mục nhân sự → Cơ cấu phòng ban.

## Nội dung sửa

- Thay vòng viền xanh nhạt bằng biểu đồ donut nhiều màu.
- Mỗi lát biểu đồ đại diện một phòng/bộ môn và được tính theo tỷ trọng nhân sự thực tế.
- Màu lát biểu đồ đồng bộ với màu nhận diện của từng dòng phòng ban.
- Bổ sung khe phân tách giữa các lát, tâm trắng rõ chữ và tương thích giao diện tối.
- Bổ sung `aria-label` và tooltip mô tả tổng số phòng, tổng nhân sự, số người và tỷ trọng từng bộ môn.
- Giữ nguyên công thức, dữ liệu, backend, database và các phân hệ khác.

## Kiểm thử

- Kiểm tra cú pháp JavaScript: đạt.
- Kiểm tra source/public đồng nhất sau build: đạt.
- Kiểm tra tĩnh màu vòng, donut, palette 9 bộ môn và trợ năng: đạt.
- Kiểm tra Chromium tại 1758 × 832 px: vòng tròn 104 × 104 px, 9 lát màu, 9 dòng bộ môn, không phát sinh lỗi trang.
- Chạy lại toàn bộ bộ release audit cục bộ của gói: đạt, kết thúc với `ALL V4.5.60 RELEASE AUDIT TESTS PASSED`.
