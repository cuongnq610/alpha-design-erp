# ALPHA DESIGN ERP Cloud v4.5.67 — DEEP QA AUTOHEAL RELEASE

Mở `index.html` để dùng dữ liệu Demo tiêu chuẩn. Mở `index-qa-demo-v4.5.60.html` để xem bộ dữ liệu kiểm thử phức tạp.

Bản v4.5.67 sửa biên thuế TNDN tại đúng 50 tỷ đồng, bổ sung chương trình kiểm thử sâu và cơ chế tự vá có kiểm soát; đồng thời kế thừa phân hệ Thùng rác: nội dung xóa được giữ 30 ngày, có thể khôi phục về đúng phân hệ/vị trí hoặc xóa vĩnh viễn. Tệp Cloud chỉ bị xóa vật lý khi dọn vĩnh viễn. Các khóa kiểm soát kế toán, thuế và liên kết dữ liệu tiếp tục được giữ nguyên.

Chạy `npm test` để kiểm tra logic, liên kết, bảo mật tĩnh và backend. Chạy `npm run test:browser` cho 18 cổng browser chính; chạy `npm run test:browser:extended` cho 11 vòng hồi quy bổ sung.

Đọc `QA_MASTER_TEST_PROGRAM_V4_5_67_VI.md`, `QA_TEST_CASE_MATRIX_V4_5_67.csv` và `RELEASE_NOTES_V4_5_67_DEEP_QA_AUTOHEAL.md` trước khi triển khai. Bản này chưa tự phê duyệt Production vì vẫn cần chạy migration trên Supabase thật, đối chiếu dữ liệu công ty, xác nhận schema pháp định, backup/restore và phê duyệt kép.
