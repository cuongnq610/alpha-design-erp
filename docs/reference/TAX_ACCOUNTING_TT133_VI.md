# HẠCH TOÁN THUẾ TRONG HỆ THỐNG TT133

## Nguyên tắc

Chế độ kế toán TT133 và pháp luật thuế là hai lớp khác nhau. Hệ thống dùng các tài khoản TT133 để ghi nhận số liệu, trong khi thuế suất, điều kiện khấu trừ, thời hạn khai/nộp và hồ sơ được quản lý bằng bộ quy tắc thuế có phiên bản và phải do kế toán trưởng phê duyệt.

## Tài khoản thuế chính

| Nghiệp vụ | Tài khoản thường dùng |
|---|---|
| VAT đầu vào được khấu trừ | 1331 |
| VAT đầu ra | 33311 |
| Thuế TNDN phải nộp | 3334 |
| Chi phí thuế TNDN hiện hành | 8211 |
| Thuế TNCN khấu trừ | 3335 |
| Thuế, phí và nghĩa vụ khác | Chi tiết TK 333 theo quy chế nội bộ |

## Luồng kiểm soát

- Hóa đơn đầu vào/đầu ra được ghi riêng trong sổ hóa đơn và liên kết với chứng từ kế toán.
- VAT trên hóa đơn phải bằng giá tính thuế nhân thuế suất sau làm tròn VND; tổng thanh toán bằng giá chưa thuế cộng VAT.
- VAT đầu vào chỉ đưa vào chỉ tiêu khấu trừ khi đủ điều kiện và có trạng thái đã soát xét.
- Thuế TNCN: tổng khấu trừ, số đã nộp và số còn phải nộp được đối chiếu với TK 3335.
- Thuế TNDN: lợi nhuận kế toán được điều chỉnh bằng các khoản tăng/giảm và lỗ chuyển kỳ; số thuế kế toán phải đối chiếu TK 8211/3334.
- Hạn khai/nộp và chính sách thuế không khóa cứng trong mã nguồn; được lưu theo phiên bản pháp lý.

## Quy tắc phát hành

Không phát hành báo cáo thuế khi còn một trong các lỗi: hóa đơn trùng, hóa đơn không liên kết chứng từ, VAT lệch sổ cái, TNCN lệch TK 3335, hoặc điều chỉnh TNDN chưa được soát xét.
