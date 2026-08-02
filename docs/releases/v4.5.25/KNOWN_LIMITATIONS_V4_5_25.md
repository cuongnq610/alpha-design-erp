# Giới hạn xác nhận — v4.5.25

Các kiểm thử trong gói xác nhận mã nguồn, công thức, trình duyệt Chromium cục bộ, backend demo và tính toàn vẹn migration ở mức static/lexical. Chúng không phải bằng chứng cho các thành phần bên ngoài sau:

- Migration 001–052 trên dự án Supabase thật.
- RLS với tài khoản và vai trò thật.
- MFA TOTP/AAL2, SMTP và khôi phục tài khoản thật.
- Backup/restore và khả năng phục hồi sự cố.
- Safari/iPhone/iPad/Android vật lý.
- Adapter ngân hàng/email/hóa đơn điện tử bên thứ ba.
- Đối chiếu B01/B02/B03 với sổ kế toán được phê duyệt.

Do đó `productionApproval` tiếp tục là `false` cho tới khi hoàn thành checklist Staging/UAT và ký duyệt độc lập.
