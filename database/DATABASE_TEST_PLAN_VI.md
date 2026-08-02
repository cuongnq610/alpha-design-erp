# KẾ HOẠCH KIỂM THỬ DATABASE

## Kiểm thử cấu trúc

- Chạy `tests/run-all.sh`.
- Kiểm tra đủ bảng, RLS, RPC, audit, idempotency và báo cáo TT133.
- Cấm kiểu số thực cho tiền kế toán.

## Kiểm thử transaction

1. Tạo chứng từ cân Nợ/Có: phải thành công.
2. Tạo chứng từ lệch: toàn bộ transaction rollback.
3. Dùng lại `client_request_id`: không tạo chứng từ thứ hai.
4. Hai phiên cùng ghi sổ: chỉ một phiên thành công; phiên còn lại nhận xung đột.
5. Kỳ đã khóa: không tạo hoặc ghi sổ chứng từ.

## Kiểm thử RLS

- Giám đốc: toàn quyền trong công ty của mình.
- Kế toán trưởng: kế toán, thuế, lương và audit.
- PM: dự án, timesheet và hồ sơ dự án; không xem bảng lương.
- Nhân viên: chỉ nhập timesheet và xem phạm vi được cấp.
- Tài khoản công ty A không đọc/ghi dữ liệu công ty B.

## Kiểm thử đồng bộ

- Nhập dự án trên desktop và kiểm tra iPhone/iPad nhận thay đổi.
- Nhập timesheet trên iPhone và kiểm tra desktop nhận thay đổi.
- Mất mạng, tạo dữ liệu, kết nối lại; kiểm tra không trùng.
- Hai thiết bị sửa cùng một bản ghi; kiểm tra `row_version` chặn ghi đè.

## Kiểm thử kế toán

- Tổng Nợ bằng tổng Có theo kỳ.
- Số dư đầu kỳ chỉ lấy đúng năm tài chính.
- 131/331 theo đối tượng và công nợ còn lại.
- VAT hóa đơn bằng giá tính thuế + VAT.
- B01a-DNN cân tổng tài sản và nguồn vốn.
- B03-DNN khớp tiền đầu kỳ, lưu chuyển và cuối kỳ.

## Kiểm thử tải

- 100 người dùng đồng thời đọc dashboard.
- 30 người đồng thời nhập timesheet.
- 10 kế toán viên đồng thời tạo chứng từ.
- Import 100.000 hóa đơn/giao dịch theo batch.
- Báo cáo F01 với ít nhất 1 triệu dòng định khoản.

## Kiểm thử khôi phục

- Restore database sang project độc lập.
- Restore Storage.
- Kiểm tra checksum file.
- Chạy toàn bộ integrity check.
- Đối chiếu số dư, công nợ, báo cáo và audit chain.
