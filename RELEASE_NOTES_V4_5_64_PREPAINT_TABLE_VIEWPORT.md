# ALPHA DESIGN ERP Cloud v4.5.64

## Pre-paint Table Viewport Hotfix

Phát hành ngày 02/08/2026.

### Lỗi đã sửa

v4.5.63 đã nhớ đúng dòng nhưng chờ hai nhịp `requestAnimationFrame` mới khôi phục. Vì vậy trình duyệt có thể vẽ một khung hình ở dòng đầu, sau đó mới quay lại dòng hiện tại. v4.5.64 loại bỏ độ trễ này.

- Cân chỉnh cột và khôi phục `scrollTop`/`scrollLeft` được thực hiện đồng bộ trong cùng tác vụ `render()`.
- JavaScript chỉ nhường quyền vẽ sau khi bảng đã trở lại đúng dòng và đúng vị trí ngang.
- Tiếp tục giữ dòng neo `data-record-id` và vị trí cuộn trang bên ngoài bảng.
- Áp dụng ở lớp `.table-wrap` dùng chung cho tất cả bảng.
- Chuyển màn hình, tab, kỳ hoặc bộ lọc vẫn đặt lại vị trí đúng chủ đích.

### Công thức nghiệp vụ

Không thay đổi công thức kế toán, VAT, TNCN, TNDN, payroll, tài sản, TK 242 hoặc báo cáo tài chính.

### Nâng cấp dữ liệu

Chạy `supabase/migrations/072_prepaint_table_viewport_release_v4564.sql` sau migration 071. Migration này chỉ ghi nhận release và cập nhật ràng buộc chứng nhận TT133 sang v4.5.64/migration 072.

### Giới hạn

- `productionApproval` vẫn là `false` cho đến khi hoàn tất các cổng Cloud và đối chiếu dữ liệu thật.
- TT99 tiếp tục bị khóa phát hành cho đến khi mapping Phụ lục IV được kiểm định độc lập.
