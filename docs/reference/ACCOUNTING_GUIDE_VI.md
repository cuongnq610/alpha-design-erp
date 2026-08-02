# Hướng dẫn hệ kế toán ALPHA DESIGN

## 1. Quy trình chứng từ chuẩn

1. Tiếp nhận hồ sơ gốc: hợp đồng, hóa đơn, biên bản nghiệm thu, đề nghị thanh toán, bảng lương hoặc hồ sơ CTV.
2. Kiểm tra tính đầy đủ và người phê duyệt.
3. Tạo chứng từ ở trạng thái `Draft`.
4. Gắn đúng dự án và đúng đối tượng công nợ.
5. Kiểm tra tổng Nợ bằng tổng Có.
6. Người phụ trách kế toán kiểm tra.
7. Chuyển sang `Posted` để đưa vào sổ và báo cáo.
8. Cuối tháng đối chiếu ngân hàng, công nợ, thuế và chi phí dự án.

## 2. Mẫu định khoản thường dùng

### 2.1 Ghi nhận hóa đơn doanh thu dịch vụ thiết kế
- Nợ 131 – Phải thu khách hàng: Tổng tiền thanh toán.
- Có 5113 – Doanh thu cung cấp dịch vụ: Giá trị chưa VAT.
- Có 33311 – Thuế GTGT đầu ra: Tiền VAT.

### 2.2 Khách hàng thanh toán
- Nợ 1121 – Tiền gửi ngân hàng.
- Có 131 – Phải thu khách hàng.

### 2.3 Hóa đơn đầu vào gắn trực tiếp với dự án
- Nợ 154 – Chi phí sản xuất, kinh doanh dở dang: Giá chưa VAT.
- Nợ 1331 – Thuế GTGT được khấu trừ: VAT đủ điều kiện.
- Có 331 – Phải trả nhà cung cấp: Tổng thanh toán.

### 2.4 Chi phí quản lý văn phòng
- Nợ 6422 – Chi phí quản lý doanh nghiệp: Giá chưa VAT.
- Nợ 1331 – Thuế GTGT được khấu trừ: VAT đủ điều kiện.
- Có 331 hoặc 1121: Tổng thanh toán.

### 2.5 Thanh toán nhà cung cấp
- Nợ 331 – Phải trả nhà cung cấp.
- Có 1121 – Tiền gửi ngân hàng.

### 2.6 Thanh toán CTV có khấu trừ thuế TNCN
- Khi ghi nhận chi phí: Nợ 154 hoặc 6422 / Có 331.
- Khi thanh toán: Nợ 331 / Có 1121 phần thực trả / Có 3335 phần thuế TNCN khấu trừ.

Tỷ lệ khấu trừ phải được kế toán xác định theo hồ sơ, loại hợp đồng, mức chi trả và quy định thuế hiện hành; không nên mặc định cho mọi trường hợp.

### 2.7 Chi phí lương nhân viên
- Nợ 154: Phần lương trực tiếp phân bổ cho dự án.
- Nợ 6422: Phần lương quản lý, hành chính hoặc thời gian không phân bổ.
- Có 334: Tổng lương phải trả.

Khi trả lương:
- Nợ 334.
- Có 1121.
- Có 3335 nếu có thuế TNCN khấu trừ.
- Có các tài khoản bảo hiểm phải nộp nếu có.

### 2.8 Kết chuyển chi phí dự án hoàn thành
- Nợ 632 – Giá vốn dịch vụ đã cung cấp.
- Có 154 – Chi phí sản xuất, kinh doanh dở dang.

Chỉ kết chuyển phần chi phí tương ứng với doanh thu/giai đoạn đã đủ điều kiện ghi nhận.

### 2.9 Tạm ứng nhân viên
Khi chi tạm ứng:
- Nợ 141.
- Có 1111 hoặc 1121.

Khi quyết toán:
- Nợ 154/6422/1331 hoặc tài khoản phù hợp.
- Có 141.

Phần hoàn ứng:
- Nợ 1111/1121.
- Có 141.

## 3. Kiểm soát theo dự án

Mỗi chứng từ liên quan đến dự án cần gắn mã dự án. Hệ thống sẽ tổng hợp:
- Doanh thu theo dự án.
- Chi phí đã ghi nhận vào kết quả kinh doanh.
- Chi phí dở dang TK 154.
- Lợi nhuận kế toán theo dự án.

Không gắn dự án cho các khoản chi phí chung thực sự của công ty, hoặc phân bổ định kỳ theo tiêu thức được phê duyệt.

## 4. Checklist khóa sổ tháng

- Không còn chứng từ lệch Nợ/Có.
- Kiểm tra toàn bộ chứng từ `Draft`.
- Đối chiếu số dư ngân hàng với sao kê.
- Đối chiếu phải thu theo từng khách hàng.
- Đối chiếu phải trả theo từng nhà cung cấp/CTV.
- Đối chiếu VAT đầu vào với hóa đơn hợp lệ.
- Đối chiếu VAT đầu ra với hóa đơn đã phát hành.
- Đối chiếu thuế TNCN đã khấu trừ.
- Rà soát chi phí dở dang TK 154 theo từng dự án.
- Thực hiện kết chuyển giá vốn cho phần việc đã hoàn thành.
- Sao lưu dữ liệu JSON trước khi khóa sổ nội bộ.

## 5. Nguyên tắc sử dụng an toàn

- Không sửa trực tiếp chứng từ đã dùng để lập báo cáo; nên chuyển về Draft, ghi rõ lý do và sửa có kiểm soát.
- Không xóa tài khoản đã phát sinh.
- Không dùng báo cáo thuế quản trị để nộp cơ quan nhà nước khi chưa đối chiếu với kế toán phụ trách.
- Luôn lưu hồ sơ gốc bên ngoài hệ thống vì bản cục bộ chưa lưu file chứng từ.
