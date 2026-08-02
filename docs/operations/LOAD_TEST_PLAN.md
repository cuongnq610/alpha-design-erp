# KẾ HOẠCH KIỂM THỬ KHỐI LƯỢNG

## Mục tiêu

- 50 người dùng đồng thời đọc báo cáo.
- P95 báo cáo tổng hợp dưới 500–800 ms trên cấu hình production mục tiêu.
- Tỷ lệ lỗi đọc dưới 0,5%; lỗi ghi dưới 1% và chỉ được phép là xung đột có kiểm soát.
- Không có chứng từ ghi sổ hai lần, số chứng từ trùng hoặc mất audit event.

## Bộ thử

- `tests/stress/calculation-stress.test.js`: 10.000 chứng từ / 20.000 dòng trên calculation engine cục bộ.
- `tests/load/k6-read-reports.js`: tải B01/B02/B03/F01/validator.
- `tests/load/k6-posting.js`: tranh chấp ghi sổ cùng chứng từ để xác nhận row lock/version.

Kết quả production phải được chạy trên chính hạ tầng dự kiến go-live; kết quả cục bộ không thay thế kiểm thử database thật.
