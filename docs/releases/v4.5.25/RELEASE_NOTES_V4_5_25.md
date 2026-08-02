# Release Notes — ALPHA DESIGN ERP Cloud v4.5.25

## Fixed

1. Browser release audit có thể chạy kéo dài và không lưu đầy đủ bằng chứng khi một bài test gặp sự cố.
2. Structural audit có thể đánh giá giao diện khi màn hình đăng nhập vẫn che ứng dụng.
3. Responsive audit có thể bấm phần tử ngoài viewport và phát sinh lỗi không phản ánh UI thật.
4. XLSX export lưu phần trăm 80 dưới dạng `80` rồi áp format `%`, gây hiển thị 8.000%.
5. XLSX export lưu ngày dưới dạng text, làm giảm độ tin cậy khi lọc/sắp xếp/tính ngày.
6. PDF/ZIP và một số script triển khai còn nhãn phiên bản cứng của các bản trước.
7. QA evidence và database release marker chưa đồng nhất với gói hiện hành.

## Added

- Regression test cho XLSX date/percentage semantics.
- Browser audit lock chống chạy đồng thời.
- Kiểm tra đủ 15 bước, phát hiện thiếu bước hoặc bản ghi trùng.
- Migration 052 đồng bộ `schema_versions` và `active_release_version` với 4.5.25.
- Hồ sơ QA closure và danh sách lỗi đóng/mở.

## Validation

- Release audit: PASS.
- Browser audit: 15/15 PASS, report integrity PASS.
- Structural: 364/364.
- Global table/action: 208/208.
- Responsive certified widths: PASS.

## Release decision

Staging/UAT ready. Production approval remains blocked by the external gates listed in `GO_LIVE_CHECKLIST.md`.
