# BIÊN BẢN KIỂM THỬ TÊN CHỈ SỐ KIỂM SOÁT — v4.5.65

**Sản phẩm:** ALPHA DESIGN ERP Cloud  
**Ngày kiểm thử:** 02/08/2026  
**Yêu cầu:** hiển thị tên đầy đủ, không dùng AR, EAC, CPI, SPI trong tiêu đề bảng kiểm soát  
**Kết luận:** đã chuẩn hóa tên hiển thị; mã nội bộ và công thức không thay đổi.

## Đối chiếu nhãn

| Nhãn cũ | Nhãn mới |
|---|---|
| AR | Công nợ phải thu |
| EAC | Chi phí ước tính khi hoàn thành |
| CPI | Chỉ số hiệu quả chi phí |
| SPI | Chỉ số hiệu quả tiến độ |
| Actual Project Margin | Biên lợi nhuận dự án thực tế |
| Forecast Project Margin | Biên lợi nhuận dự án dự báo |

## Phạm vi chuẩn hóa

- Tiêu đề và mô tả màn hình Kiểm soát vận hành.
- Bảng kiểm soát dự án và bộ lọc độ tin cậy.
- Các thẻ chỉ số, cầu nối số liệu và giải thích công thức.
- Cảnh báo dự án, kiểm tra chất lượng và hướng dẫn kế hoạch nguồn lực.
- Tên các thẻ Thực tế & dự báo, Thương mại, Dòng tiền, Chất lượng dữ liệu.

## Kiểm thử bắt buộc

| Kiểm tra | Kết quả |
|---|---|
| Năm tiêu đề tiếng Việt đầy đủ xuất hiện | Đạt |
| Không còn tiêu đề `AR`, `EAC`, `CPI / SPI` | Đạt |
| Nhãn độ tin cậy hiển thị Cao/Trung bình/Thấp | Đạt |
| Phương pháp ước tính được dịch đầy đủ | Đạt |
| Cảnh báo chỉ số dùng tên đầy đủ | Đạt |
| Hai cột tên dài có chiều rộng riêng | Đạt |
| JavaScript hợp lệ | Đạt |

## Hồi quy nghiệp vụ

- `npm test`: PASS toàn bộ release audit v4.5.65.
- 57.500 tình huống nghiệp vụ đa kịch bản: PASS.
- 315.092 kiểm tra phức tạp xác định: PASS.
- 470.000 kiểm tra đối kháng tiền tệ, hash và chứng từ: PASS.
- 40.007 tình huống tiền và liên kết độc lập: PASS.
- 500 tình huống fuzz kiểm soát dự án: PASS.
- Financial audit: 100/100; 0 lỗi nghiêm trọng, 0 cảnh báo thất bại, 0 sửa chữa tự động.
- Migration 001–073, consolidated schema, backend, source/public parity và package integrity: PASS.

Các phép tính sử dụng nguyên dữ liệu và thuộc tính nội bộ; không sửa công thức trong calculation core. Chỉ nội dung câu cảnh báo được đổi sang tên đầy đủ.

## Giới hạn môi trường

Browser audit tự động đã dừng ở preflight vì môi trường không có `beautifulsoup4`, Playwright và Chromium. Không có bước browser nào được tuyên bố PASS cho release này; kiểm thử tĩnh, công thức và package vẫn là kết quả hiện hành của v4.5.65.
