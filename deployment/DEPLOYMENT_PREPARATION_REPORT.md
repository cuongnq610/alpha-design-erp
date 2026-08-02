# Báo cáo chuẩn bị triển khai ALPHA DESIGN ERP v4.5.30

## Đã thực hiện

- Hoàn thiện giao diện và luồng MFA TOTP AAL2 cho tài khoản đặc quyền.
- Hoàn thiện quên mật khẩu, recovery callback và đặt mật khẩu mới.
- Cập nhật backend, API, Edge Function và script triển khai cho Supabase Publishable/Secret key mới, có fallback legacy.
- Bảo đảm Secret/Service Role key không xuất hiện trong `public` hoặc `/runtime-config.js`.
- Bổ sung startup `passenger.cjs`/`passenger.js` cho cPanel hoặc Plesk Node.js App.
- Cập nhật `.env.matbao.example`, preflight Mắt Bão, remote verification và Supabase verification.
- Bổ sung kiểm thử luồng auth mô phỏng và kiểm thử header cho key mới/cũ.
- Cập nhật Service Worker để phát hành module bảo mật mới và không rơi về Demo khi offline.
- Cập nhật checklist UAT, checklist Production và tài liệu phát hành v4.5.30.

## Kết quả kiểm tra cục bộ

- Node.js: 22.16.0.
- `npm ci`: PASS, 0 vulnerability trong gói dependency-free.
- Build public: PASS, 21 tài nguyên public.
- Release audit: PASS toàn bộ.
- Stress test: 10.000 chứng từ, 20.000 dòng cân bằng.
- Backend startup/auth gate: PASS.
- Mắt Bão preflight: PASS, 0 lỗi, 0 cảnh báo.
- Schema SQL checksum: PASS.
- Manifest SHA-256 được tạo lại sau vòng QA cuối và phải xác minh trước khi upload.

## Giới hạn cần quyền tài khoản thật

- Tạo/cấu hình Supabase project của ALPHA DESIGN.
- Nhập Secret key, SMTP credential và database password.
- Thay đổi DNS, SSL hoặc xác nhận OTP.
- UAT MFA, password recovery, Realtime, Storage và RLS trên URL HTTPS thật.
- Diễn tập backup/restore bằng dữ liệu Staging.

Không gửi mật khẩu, OTP, Secret/Service Role key hoặc database password qua chat.
