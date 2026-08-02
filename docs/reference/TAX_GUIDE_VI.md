# Hướng dẫn cấu hình thuế — ALPHA DESIGN ERP Cloud v4.5.30

> Kế toán phụ trách phải xác nhận tham số và biểu mẫu đang áp dụng trước mỗi kỳ kê khai. Tài liệu này là công cụ vận hành nội bộ, không thay thế tư vấn thuế hoặc văn bản pháp luật hiện hành.

## 1. VAT

- Quản lý độc lập sổ hóa đơn đầu ra, đầu vào và chứng từ kế toán.
- Đối chiếu VAT đầu ra với TK 33311; VAT đầu vào được khấu trừ với TK 1331.
- Hệ thống cung cấp mức 8% và 10% nhưng không tự lựa chọn thay người phụ trách thuế.
- Chính sách giảm VAT đến 31/12/2026 có danh mục loại trừ; cần xác nhận theo hàng hóa/dịch vụ cụ thể.

## 2. TNCN

- Tạo một dòng khấu trừ cho mỗi lần chi trả cá nhân/CTV.
- Gắn người nhận, mã số thuế/CCCD, loại hợp đồng, thu nhập gộp, thu nhập tính khấu trừ, tỷ lệ và số thuế.
- Ngưỡng 2.000.000 đồng/lần và tỷ lệ 10% là tham số tham chiếu cho một số trường hợp cá nhân cư trú không ký hợp đồng lao động hoặc hợp đồng dưới 3 tháng; không áp dụng máy móc cho mọi trường hợp.

## 3. TNDN

### Cầu nối kế toán–thuế

```text
Lợi nhuận kế toán trước thuế
+ Điều chỉnh tăng
− Điều chỉnh giảm
− Lỗ được chuyển
= Thu nhập tính thuế ước tính
```

Chỉ các dòng điều chỉnh có trạng thái `Reviewed` hoặc `Approved` được đưa vào phép tính.

### Ngưỡng doanh thu tham chiếu năm 2026

- Doanh thu năm không quá 1 tỷ đồng: có cơ chế miễn thuế nếu đáp ứng đầy đủ điều kiện.
- Trên 1 tỷ đến không quá 3 tỷ đồng: mức 15% khi đủ điều kiện.
- Trên 3 tỷ và dưới 50 tỷ đồng: mức 17% khi đủ điều kiện.
- Từ đúng 50 tỷ đồng trở lên: quay về mức chuẩn 20% nếu không có ưu đãi khác.

Phần mềm áp dụng nguyên tắc thận trọng:

- `citExemptionEligibility = Unreviewed` là mặc định; hệ thống không tự miễn.
- Chỉ khi kế toán chọn `Approved` và doanh thu tính ngưỡng không vượt mức cấu hình thì thuế suất ước tính mới bằng 0%.
- Mức 15%/17% cũng yêu cầu `citReducedRateEligibility = Approved`.
- Doanh nghiệp con hoặc doanh nghiệp có quan hệ liên kết có thể thuộc trường hợp loại trừ; cần rà soát hồ sơ thực tế.

### Hồ sơ chi phí

Các nhóm cần kiểm tra kỹ gồm chi phí CTV, lương, hoa hồng giới thiệu, tiếp khách, mua thiết bị, khấu hao, chi phí dự án dở dang và khoản thanh toán không dùng tiền mặt.

## 4. Lịch kê khai và tiền chậm nộp

- Người dùng phải nhập/cập nhật `dueDate` theo lịch chính thức và văn bản gia hạn áp dụng cho doanh nghiệp.
- Tiền chậm nộp trong hệ thống chỉ là ước tính quản trị: số thuế chưa nộp × tỷ lệ/ngày × số ngày quá hạn.

## 5. Checklist trước khi nộp

- Hóa đơn đầu ra đầy đủ và khớp doanh thu.
- Hóa đơn đầu vào đã kiểm tra trạng thái, mã số thuế và điều kiện khấu trừ.
- VAT register khớp sổ cái hoặc có biên bản giải trình.
- TNCN khớp bảng chi trả và TK 3335.
- Điều chỉnh TNDN có người rà soát và hồ sơ chứng minh.
- Điều kiện miễn thuế hoặc mức 15%/17% có phê duyệt của người phụ trách thuế.
- Lưu mã tiếp nhận, giấy nộp tiền và bản sao hồ sơ.

## 6. Văn bản tham chiếu chính tại thời điểm kiểm toán

- Luật Thuế thu nhập doanh nghiệp số 67/2025/QH15.
- Luật số 09/2026/QH16 sửa đổi một số luật thuế.
- Nghị định số 320/2025/NĐ-CP.
- Nghị định số 141/2026/NĐ-CP.
- Nghị định số 174/2025/NĐ-CP về giảm VAT.
- Thông tư số 133/2016/TT-BTC đối với chế độ kế toán DNNVV đang cấu hình trong phần mềm.

Luôn đối chiếu văn bản gốc và hướng dẫn của cơ quan thuế tại thời điểm phát sinh giao dịch.
