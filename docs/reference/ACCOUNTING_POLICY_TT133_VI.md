# CHÍNH SÁCH KẾ TOÁN ALPHA DESIGN – TT133

## 1. Phạm vi

Phiên bản này cấu hình theo **Thông tư 133/2016/TT-BTC**, dành cho doanh nghiệp nhỏ và vừa. Trước khi áp dụng chính thức, ALPHA DESIGN phải xác nhận doanh nghiệp thuộc đối tượng phù hợp và ban hành quyết định lựa chọn chế độ kế toán.

TT133 điều chỉnh việc ghi sổ, hệ thống tài khoản, chứng từ và báo cáo tài chính. Nghĩa vụ thuế được xác định theo pháp luật thuế hiện hành, không được suy ra chỉ từ việc áp dụng TT133.

## 2. Nguyên tắc dữ liệu

- Tiền tệ hạch toán: VND nguyên, lưu bằng `bigint` trên PostgreSQL.
- Cơ sở kế toán: dồn tích, hoạt động liên tục, nhất quán giữa các kỳ.
- Chỉ chứng từ `posted` được đưa vào sổ và báo cáo.
- Chứng từ đã ghi sổ là bất biến; sai sót được xử lý bằng bút toán đảo và bút toán thay thế.
- Kỳ đã khóa không cho tạo, sửa hoặc ghi sổ chứng từ.
- Mỗi chứng từ phải cân bằng Nợ/Có và dùng tài khoản chi tiết được phép hạch toán.
- Mọi thay đổi nghiệp vụ phải có người thực hiện, thời gian, phiên giao dịch và dấu vết audit.

## 3. Bộ báo cáo

- **B01a-DNN:** Báo cáo tình hình tài chính. B01b-DNN chỉ dùng khi doanh nghiệp lựa chọn mẫu thay thế và cấu hình riêng.
- **B02-DNN:** Báo cáo kết quả hoạt động kinh doanh.
- **B09-DNN:** Bản thuyết minh Báo cáo tài chính.
- **F01-DNN:** Bảng cân đối tài khoản nộp cùng hồ sơ quyết toán thuế.
- **B03-DNN:** Báo cáo lưu chuyển tiền tệ theo phương pháp trực tiếp; hệ thống hỗ trợ đầy đủ dù TT133 khuyến khích lập.

## 4. Kiểm soát phát hành

Báo cáo chỉ được gắn trạng thái `approved` khi:

1. B01a cân đối tài sản và nguồn vốn.
2. F01 cân bằng tổng Nợ/Có.
3. B03 khớp số dư TK 111/112.
4. B09 hoàn thành đủ các phần thuyết minh bắt buộc.
5. Không còn chứng từ nháp trong kỳ.
6. Audit chain hợp lệ.
7. Kế toán trưởng soát xét và phê duyệt hash của bộ báo cáo.
