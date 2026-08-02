# ALPHA DESIGN ERP Cloud v4.5.67 — DEEP QA AUTOHEAL RELEASE

## Lỗi đã vá

- Sửa biên thuế TNDN: doanh thu đúng 50 tỷ đồng áp dụng 17% khi đủ điều kiện; chỉ trên 50 tỷ mới áp dụng mức chuẩn 20%.
- Sửa selector trong bộ structural browser audit để chỉ đánh giá KPI lõi của dashboard, loại bỏ false positive ở KPI vận hành dạng compact.

## Bổ sung

- Chương trình kiểm thử tổng thể và ma trận test chi tiết.
- Test hồi quy riêng cho kế toán–tài chính, biên thuế, double-entry và QA harness.
- Auto-heal fail-closed chỉ vá lỗi nằm trong allowlist và luôn chạy hậu kiểm.
- Migration 075 gắn release/certification v4.5.67.

## Trạng thái

Không tự phê duyệt Production. TT99 export chính thức vẫn bị chặn tới khi xác minh mapping/schema; Supabase staging, dữ liệu thật, backup/restore và UAT có chữ ký vẫn là cổng bắt buộc.
