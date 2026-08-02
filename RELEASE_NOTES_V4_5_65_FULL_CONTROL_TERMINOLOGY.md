# ALPHA DESIGN ERP Cloud v4.5.65

## Full Control Terminology Release

Phát hành ngày 02/08/2026.

### Nội dung đã sửa

- `AR` được hiển thị thành **Công nợ phải thu**.
- `EAC` được hiển thị thành **Chi phí ước tính khi hoàn thành**.
- `CPI / SPI` được hiển thị thành **Chỉ số hiệu quả chi phí / Chỉ số hiệu quả tiến độ**.
- Các tiêu đề hợp đồng, hóa đơn, chi phí và biên lợi nhuận trong cùng bảng được chuẩn hóa sang tiếng Việt đầy đủ.
- Thẻ chỉ số, bộ lọc độ tin cậy, phần giải thích công thức, cảnh báo và các thẻ kiểm soát phụ được chuẩn hóa cùng một cách gọi.
- Giá trị nội bộ `High`, `Medium`, `Low` vẫn được giữ để lọc chính xác nhưng hiển thị thành `Cao`, `Trung bình`, `Thấp`.
- Phân bổ chiều rộng cột được điều chỉnh để các tên dài xuống dòng rõ ràng, không che dữ liệu.

### Công thức nghiệp vụ

Không thay đổi công thức hoặc trường dữ liệu nội bộ. Các tên `receivable`, `estimateAtCompletion`, `cpi`, `spi` và mọi phép tính kế toán/thuế tiếp tục giữ nguyên. Bản vá chỉ thay lớp trình bày và nội dung cảnh báo.

### Kiểm thử hồi quy

- Có kiểm thử riêng xác nhận năm tiêu đề dài bắt buộc xuất hiện.
- Có kiểm thử chặn các tiêu đề viết tắt cũ quay lại bảng kiểm soát.
- Có kiểm thử tỷ lệ cột dành cho hai tiêu đề dài nhất.
- Toàn bộ kiểm thử kế toán, VAT, TNCN, TNDN, lương, tài sản, TK 242, báo cáo tài chính, bảo mật, backend và package integrity được chạy lại.
- Financial audit đạt 100/100, không có lỗi nghiêm trọng, cảnh báo thất bại hoặc sửa chữa tự động.

### Nâng cấp dữ liệu

Chạy `supabase/migrations/073_full_control_terminology_release_v4565.sql` sau migration 072. Migration này chỉ ghi nhận release và cập nhật ràng buộc chứng nhận TT133 sang v4.5.65/migration 073.

### Giới hạn

- `productionApproval` vẫn là `false` cho đến khi hoàn tất các cổng Cloud và đối chiếu dữ liệu thật.
- TT99 tiếp tục bị khóa phát hành cho đến khi mapping Phụ lục IV được kiểm định độc lập.
