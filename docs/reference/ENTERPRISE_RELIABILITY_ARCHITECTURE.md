# KIẾN TRÚC ĐỘ TIN CẬY DOANH NGHIỆP

## 1. Backend giao dịch ACID

PostgreSQL là nguồn dữ liệu chính thức. Ghi sổ, đảo bút toán, khóa kỳ và đánh số chứng từ được thực hiện bằng hàm RPC chạy trong một transaction. Số tiền dùng `bigint` VND để tránh sai số số thực.

## 2. Đồng thời nhiều người dùng

- `SELECT ... FOR UPDATE` khóa bản ghi khi ghi sổ hoặc khóa kỳ.
- `pg_advisory_xact_lock` tuần tự hóa các nghiệp vụ theo công ty/kỳ.
- `row_version` triển khai optimistic concurrency; bản cập nhật cũ trả lỗi `40001` thay vì ghi đè.
- `edit_locks` cung cấp khóa mềm có thời hạn để giao diện báo ai đang sửa.

## 3. Audit bất biến

Audit log chỉ được ghi qua hàm `SECURITY DEFINER`, bị chặn UPDATE/DELETE, và liên kết bằng chuỗi SHA-256. Hàm `verify_audit_chain` kiểm tra cả liên kết trước và hash từng sự kiện.

## 4. Phân quyền tầng dữ liệu

Row-Level Security lọc dữ liệu theo `company_id` lấy từ JWT và kiểm tra membership/permission. Giao diện ẩn menu chỉ là lớp tiện ích; RLS mới là lớp bảo vệ quyết định.

## 5. Bất biến chứng từ

Dòng và đầu chứng từ `posted` không được sửa hoặc xóa. Điều chỉnh phải dùng bút toán đảo, nhờ đó bảo toàn lịch sử và báo cáo đã phát hành.

## 6. Báo cáo có kiểm soát

B01a, B02, B03, B09, F01 được tính trên server và có bộ validator. Report sign-off lưu hash, người lập, người soát xét và người duyệt.

## 7. Sao lưu và phục hồi

Gói có script `pg_dump` định dạng custom, checksum SHA-256, manifest và script phục hồi vào database thử nghiệm. Go-live chỉ được duyệt sau khi restore drill thành công.
