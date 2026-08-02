# KẾ HOẠCH CHẠY SONG SONG 2–3 KỲ

## Phạm vi đối chiếu tối thiểu

- Tổng phát sinh Nợ/Có và số dư từng tài khoản.
- TK 111, 112, 131, 331, 1331, 33311, 3334, 3335, 334, 154, 511, 632, 642, 821, 421.
- B01a-DNN, B02-DNN, B03-DNN, F01-DNN và các chỉ tiêu B09.
- Sổ hóa đơn VAT, công nợ theo đối tượng, chi phí theo dự án.

## Quy trình mỗi kỳ

1. Khóa dữ liệu đầu vào cùng thời điểm ở hai hệ thống.
2. Xuất số liệu từ phần mềm kế toán hiện hành và ALPHA ERP.
3. Nhập vào `PARALLEL_RECONCILIATION_TEMPLATE.csv`.
4. Giải trình từng chênh lệch; không bù trừ chênh lệch chưa rõ nguyên nhân.
5. Sửa quy tắc hoặc dữ liệu, chạy lại toàn bộ báo cáo.
6. Kế toán trưởng phê duyệt kỳ khi mọi chênh lệch trọng yếu bằng 0.

## Tiêu chí kết thúc

- Ít nhất 2 kỳ liên tiếp đạt; khuyến nghị 3 kỳ nếu có nhiều nghiệp vụ điều chỉnh cuối tháng.
- Không còn lỗi critical trong kiểm tra toàn vẹn.
- Báo cáo thuế và BCTC khớp hệ thống đang sử dụng hoặc có biên bản giải trình được duyệt.
