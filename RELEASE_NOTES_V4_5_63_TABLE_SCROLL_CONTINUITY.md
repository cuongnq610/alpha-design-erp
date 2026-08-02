# ALPHA DESIGN ERP Cloud v4.5.63

## Table Scroll Continuity Release

Phát hành ngày 02/08/2026.

### Lỗi đã sửa

- Khi Duyệt hoặc Từ chối một dòng ở gần cuối bảng Phê duyệt, bảng không còn nhảy về dòng đầu.
- Cơ chế sửa nằm ở lớp `render()` dùng chung nên áp dụng cho toàn bộ `.table-wrap`, không chỉ riêng bảng Phê duyệt.
- Giữ đồng thời `scrollTop`, `scrollLeft`, vị trí trang và dòng có `data-record-id` đang nhìn thấy sau khi kết xuất lại.
- Khôi phục diễn ra sau khi hệ thống hoàn tất cân chỉnh cột và vùng cuộn, tránh bị bước responsive ghi đè.
- Không khôi phục nhầm khi chuyển màn hình, chuyển tab Kế toán/Mua sắm/Phân tích/Kiểm soát, đổi kỳ lương, năm phúc lợi, kỳ báo cáo hoặc bộ lọc toàn cục.

### Phạm vi thao tác được hưởng bản vá

- Duyệt/Từ chối yêu cầu và duyệt timesheet.
- Ghi sổ chứng từ, thay đổi trạng thái workflow, sửa/lưu/xóa bản ghi.
- Tính lại, soát xét, phê duyệt và khóa lương/phúc lợi.
- Đồng bộ thuế và các thao tác nghiệp vụ khác gọi kết xuất lại trong cùng ngữ cảnh.
- Vị trí ngang của các bảng rộng trên desktop, tablet và mobile.

### Nâng cấp dữ liệu

Chạy `supabase/migrations/071_table_scroll_continuity_release_v4563.sql` sau migration 070. Migration 071 không đổi công thức hoặc dữ liệu nghiệp vụ; migration chỉ:

- ghi nhận schema version 4.5.63;
- cập nhật release đang hoạt động;
- ràng buộc chứng nhận TT133 với release 4.5.63 và migration 071.

### Tính tương thích kế toán và thuế

Không thay đổi công thức kế toán, VAT, TNCN, TNDN, payroll, TK 242 hoặc báo cáo tài chính. Toàn bộ logic đã kiểm thử ở v4.5.62 được giữ nguyên và chạy lại trong release audit v4.5.63.

### Giới hạn phát hành

- Chưa chạy migration 071 trên Supabase thật.
- TT99 tiếp tục bị khóa cho đến khi mapping Phụ lục IV được kiểm định độc lập.
- `productionApproval` là `false`; gói phù hợp cho UAT/staging có kiểm soát trước khi đối chiếu dữ liệu thật và phê duyệt kép.

Chi tiết xem `QA_TABLE_SCROLL_AUDIT_V4_5_63_VI.md`.
