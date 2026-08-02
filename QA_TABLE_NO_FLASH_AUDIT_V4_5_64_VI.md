# BIÊN BẢN KIỂM THỬ BẢNG KHÔNG NHẤP NHÁY — v4.5.64

**Sản phẩm:** ALPHA DESIGN ERP Cloud  
**Ngày kiểm thử:** 02/08/2026  
**Lỗi:** bảng hiện dòng đầu trong thời gian ngắn rồi mới trở lại dòng đang thao tác  
**Kết luận:** đã loại bỏ đường khôi phục trễ; vị trí được đặt lại trước lần vẽ đầu tiên.

## Cơ chế trước và sau bản vá

| Giai đoạn | v4.5.63 | v4.5.64 |
|---|---|---|
| Thay HTML bảng | Đồng bộ | Đồng bộ |
| Cân chỉnh responsive | Khung hình kế tiếp | Ngay trong tác vụ hiện tại |
| Khôi phục vị trí | Sau hai animation frame | Ngay sau cân chỉnh bố cục |
| Khả năng thấy dòng đầu | Có thể xảy ra | Không có khung hình trung gian |

## Kiểm thử bắt buộc

| Kiểm tra | Kết quả |
|---|---|
| Khôi phục nằm sau thay HTML và cân chỉnh cột | Đạt |
| Khôi phục không nằm trong `requestAnimationFrame` | Đạt |
| Vị trí dọc được giữ | Đạt |
| Vị trí ngang được giữ | Đạt |
| Dòng neo đang nhìn thấy được giữ | Đạt |
| Không khôi phục nhầm khi đổi ngữ cảnh | Đạt |
| Điều hướng có bản ghi đích vẫn được ưu tiên | Đạt |

## Hồi quy nghiệp vụ

- `npm test`: PASS toàn bộ release audit v4.5.64.
- Kiểm thử chống khung hình dòng đầu: PASS.
- 57.500 tình huống nghiệp vụ đa kịch bản: PASS.
- 315.092 kiểm tra phức tạp xác định: PASS.
- 470.000 kiểm tra đối kháng tiền tệ/hash/chứng từ: PASS.
- 40.007 tình huống tiền và liên kết độc lập: PASS.
- Financial audit: 100/100; 0 lỗi nghiêm trọng, 0 cảnh báo thất bại, 0 sửa chữa tự động.
- Migration 001–072, consolidated schema, backend, source/public parity và package integrity: PASS.

Bản vá không sửa calculation core.

## Giới hạn môi trường

Browser audit tự động chỉ được công nhận khi có Playwright/Chromium tương thích. Không sử dụng bằng chứng lịch sử để tuyên bố browser PASS cho release này.
