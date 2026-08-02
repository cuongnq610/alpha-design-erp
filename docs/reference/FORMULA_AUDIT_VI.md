# BÁO CÁO KIỂM TRA CÔNG THỨC V4.5.30 — TT133 & LIÊN KẾT PHÂN HỆ

## Các nguyên tắc đã kiểm tra

- VND được làm tròn và lưu dưới dạng số nguyên.
- Chỉ chứng từ Posted vào sổ và báo cáo.
- Chứng từ phải có tối thiểu hai dòng, mỗi dòng chỉ Nợ hoặc Có, tổng Nợ bằng tổng Có.
- Tài khoản không tồn tại, bị khóa hoặc không postable bị từ chối.
- Tiền mặt/ngân hàng phải có mã B03-DNN trước khi ghi sổ.
- B01a: tổng tài sản bằng tổng nguồn vốn.
- B02: lợi nhuận trước thuế khớp engine P&L.
- B03: đầu kỳ + lưu chuyển + tỷ giá bằng cuối kỳ và khớp TK 111/112.
- F01: tổng phát sinh Nợ/Có và dư cuối Nợ/Có cân bằng.
- VAT: tiền thuế và tổng thanh toán khớp hóa đơn; đối chiếu TK 1331/33311.
- TNCN đối chiếu TK 3335; TNDN dùng cầu nối lợi nhuận kế toán–thu nhập tính thuế.
- Chi phí quản trị dự án và chi phí kế toán được tách riêng.

## Sửa lỗi trọng yếu so với bản trước

- Số dư theo prefix chỉ cộng bên Nợ hoặc bên Có thực tế, không tạo giá trị âm giả cho tài khoản lưỡng tính 131/331.
- Backend tính số dư theo đúng năm tài chính, không cộng lặp số dư đầu kỳ nhiều năm.
- F01 dùng số dư chính xác theo từng tài khoản postable.
- Chứng từ tiền được phân loại theo mã dòng B03 thay vì chỉ suy đoán từ tài khoản đối ứng.
- Audit hash dùng cùng timestamp/transaction khi tạo và được tính lại khi xác minh.
- Dòng chứng từ posted bị khóa bất biến; điều chỉnh bằng bút toán đảo.
