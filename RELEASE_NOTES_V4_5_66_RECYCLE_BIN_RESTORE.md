# ALPHA DESIGN ERP Cloud v4.5.66

## RECYCLE BIN RESTORE RELEASE

- Thêm phân hệ **Thùng rác** trong nhóm Hệ thống.
- Mọi bản ghi vượt qua kiểm soát xóa được lưu nguyên dữ liệu trong 30 ngày.
- Lưu phân hệ gốc, ngữ cảnh tab, vị trí mảng, người xóa, thời điểm xóa và hạn tự dọn.
- Khôi phục đúng danh mục; chặn an toàn nếu đã tồn tại bản ghi cùng mã định danh.
- Hỗ trợ xóa vĩnh viễn từng mục, các mục quá hạn hoặc toàn bộ Thùng rác.
- Tệp Cloud được giữ nguyên trong thời gian chờ và chỉ xóa vật lý khi dọn vĩnh viễn.
- Tệp cục bộ trong IndexedDB có thể khôi phục về Kho hồ sơ.
- Cloud giới hạn quyền xem/khôi phục/xóa vĩnh viễn cho quản trị bảo mật và yêu cầu MFA AAL2.
- Migration 074 kiểm tra payload, đối chiếu bản ghi nguồn, bảo vệ RLS, hard purge và thiết lập lịch dọn khi `pg_cron` có sẵn.

## Tương thích nghiệp vụ

Không thay đổi công thức kế toán, thuế, lương, BCTC hoặc kiểm soát dự án. Chứng từ đã ghi sổ, dữ liệu có liên kết, kỳ đã khóa và dự án đã phát sinh nghiệp vụ vẫn không được xóa vật lý; hệ thống tiếp tục dùng quy trình điều chỉnh, đảo chứng từ, hủy hoặc lưu trữ phù hợp.

## Triển khai

Chạy `supabase/migrations/074_recycle_bin_restore_v4566.sql` sau migration 073, sau đó chạy toàn bộ `npm test`. Production chỉ được phê duyệt sau khi migration thật, đối chiếu dữ liệu, thử khôi phục/backup và phê duyệt kép hoàn tất.
