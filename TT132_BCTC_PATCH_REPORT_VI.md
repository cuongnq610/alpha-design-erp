# BÁO CÁO BẢN VÁ BCTC TT132

## Nội dung đã sửa

- Xóa cảnh báo khóa “chưa có báo cáo tài chính TT132”.
- Bổ sung màn hình **B01-DNSN – Báo cáo tình hình tài chính**.
- Bổ sung màn hình **B02-DNSN – Báo cáo kết quả hoạt động kinh doanh**.
- Bổ sung màn hình **F01-DNSN – Bảng cân đối tài khoản**.
- Bổ sung màn hình **F02-DNSN – Báo cáo tình hình thực hiện nghĩa vụ với ngân sách nhà nước**.
- Bổ sung kết xuất TT132 trong Trung tâm kết xuất: XLSX, PDF/bản in, CSV, XML, DOCX, JSON và gói ZIP.
- Bổ sung bộ mẫu `TT132_2026_BASELINE_TEMPLATE.json` và cache offline.

## Kiểm soát số liệu

- B01 chỉ vượt cổng khi tổng tài sản bằng tổng nguồn vốn và chỉ tiêu 400 bằng 410 + 420.
- B02 kiểm tra chỉ tiêu 03 bằng chỉ tiêu 01 trừ chỉ tiêu 02.
- F01 kiểm tra tổng phát sinh Nợ/Có và số dư cuối kỳ cân bằng.
- F02 kiểm tra số đầu năm + số phải nộp phát sinh − số đã nộp = số cuối năm.
- Mapping ưu tiên tài khoản TT132 gốc; đồng thời hỗ trợ dữ liệu đang dùng hệ tài khoản tương thích TT133 để tránh mất báo cáo khi chuyển chế độ.

## Kết quả kiểm thử

- Bộ kiểm thử TT132 mới: PASS.
- Toàn bộ release audit Node, công thức, bảo mật, backend, export, responsive và package integrity hiện có: PASS.
- Không thay đổi database; migration vẫn là 068.

## Lưu ý vận hành

Bản vá mở đầy đủ chức năng lập và kết xuất bộ TT132 trong phần mềm. Trước khi dùng để nộp chính thức, doanh nghiệp vẫn cần đối chiếu số dư, hồ sơ kế toán, kỳ báo cáo, thông tin pháp nhân, chữ ký số và yêu cầu của cổng tiếp nhận đang áp dụng.
