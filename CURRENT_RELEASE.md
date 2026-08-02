# Current release

**ALPHA DESIGN ERP Cloud v4.5.67 — DEEP QA AUTOHEAL RELEASE**

- Main entry: `index.html`
- QA data entry (legacy deterministic fixture): `index-qa-demo-v4.5.60.html`
- Recycle-bin QA: `QA_RECYCLE_BIN_RESTORE_AUDIT_V4_5_66_VI.md`
- Full-terminology QA inherited from v4.5.65: `QA_CONTROL_TERMINOLOGY_AUDIT_V4_5_65_VI.md`
- Previous no-flash table QA: `QA_TABLE_NO_FLASH_AUDIT_V4_5_64_VI.md`
- Accounting/tax QA inherited from v4.5.62: `QA_ACCOUNTING_TAX_AUDIT_V4_5_62_VI.md`
- Release notes: `RELEASE_NOTES_V4_5_67_DEEP_QA_AUTOHEAL.md`
- Master QA program: `QA_MASTER_TEST_PROGRAM_V4_5_67_VI.md`
- Detailed matrix: `QA_TEST_CASE_MATRIX_V4_5_67.csv`
- Current database migration: `supabase/migrations/075_deep_qa_autoheal_v4567.sql`
- Recycle-bin migration inherited: `supabase/migrations/074_recycle_bin_restore_v4566.sql`
- Machine-readable release status: `VERSION.json`

v4.5.67 là bản kiểm thử sâu và tự vá có kiểm soát; đồng thời kế thừa đầy đủ phân hệ Thùng rác. Bản ghi được phép xóa sẽ lưu nguyên dữ liệu, phân hệ, ngữ cảnh và vị trí trong 30 ngày; có thể khôi phục mà không ghi đè bản ghi trùng, hoặc xóa vĩnh viễn có xác nhận. Dữ liệu quá hạn được dọn khi khởi động, khi ứng dụng hoạt động lại và theo chu kỳ mỗi giờ; Cloud có thêm lịch dọn phía máy chủ khi `pg_cron` khả dụng.

Có một thay đổi công thức thuế đã được kiểm chứng: doanh thu đúng 50 tỷ đồng thuộc biên 17% khi đủ điều kiện; trên 50 tỷ mới áp dụng mức chuẩn. Các ràng buộc khóa sổ, chứng từ đã ghi sổ, liên kết nghiệp vụ và lưu trữ dự án vẫn được áp dụng trước khi chuyển vào Thùng rác. Việc xuất TT99 vẫn bị khóa có chủ đích. `productionApproval` vẫn là `false` cho tới khi hoàn tất migration 001–075 trên Cloud thật, đối chiếu dữ liệu doanh nghiệp, kiểm định TT99/XML, sao lưu/khôi phục và phê duyệt kép.
