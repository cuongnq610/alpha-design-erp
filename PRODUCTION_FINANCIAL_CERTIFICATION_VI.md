# Chứng nhận tài chính Production v4.5.39

Bản v4.5.39 không cho phép tự gắn nhãn Production.

## Trình tự bắt buộc

1. Backup database và chạy migration 057 trên Supabase Staging, sau đó Production; xác nhận `schema_versions.version = 4.5.39`.
2. Khai báo đúng chế độ kế toán và kỳ báo cáo.
3. Hoàn thiện từng phần I–VIII của B09. Người lập chuyển Draft → Prepared.
4. Tài khoản thứ hai có quyền `b09.review` và MFA AAL2 chuyển Prepared → Reviewed.
5. Tài khoản thứ ba có quyền `b09.approve` và MFA AAL2 chuyển Reviewed → Approved.
6. Trong màn hình BCTC, chạy **Đối chiếu Cloud**; mọi chỉ tiêu và validator phải PASS.
7. Chạy **Chứng nhận AAL2** để Supabase phát hành chứng nhận 24 giờ.
8. Chạy `npm run financial:certify-gate` trên CI/server với Secret key để ghi gate `financial_statutory`.
9. Hoàn tất các gate deployment, RLS, MFA, backup/restore, load, parallel run, browser smoke và secret scan.
10. Kế toán phụ trách và Giám đốc phê duyệt Production.

## Cơ chế khóa

Trước mỗi lần kết xuất BCTC chính thức, hệ thống truy vấn lại Supabase, yêu cầu chứng nhận còn hiệu lực trong năm phút gần nhất và so lại SHA-256 của B01/B02/B03/B09. Thay đổi chứng từ, dòng bút toán, tài khoản, số dư đầu kỳ, B09, cấu hình năm tài chính hoặc mã LCTT sẽ thu hồi chứng nhận.

XML của ALPHA ERP vẫn là dữ liệu trao đổi nội bộ, không phải XML nộp cơ quan thuế.
