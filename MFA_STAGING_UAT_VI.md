# UAT Bảo vệ tài khoản & MFA trên Supabase Staging

## 1. Chuẩn bị

1. Cấu hình `runtime-config.js` bằng `configure_production.py` với môi trường `staging`.
2. Chạy đầy đủ migration đến `054_production_invariants_v4527.sql`.
3. Tạo một tài khoản thử nghiệm có vai trò đặc quyền như Giám đốc hoặc Kế toán trưởng.
4. Bảo đảm công ty bật `require_mfa_for_privileged = true`.
5. Cấu hình URL ứng dụng và URL khôi phục mật khẩu đúng với domain Staging.

## 2. Kiểm thử đăng ký MFA

1. Đăng nhập bằng email và mật khẩu.
2. Hệ thống phải yêu cầu thiết lập MFA trước khi mở phiên đặc quyền.
3. Quét QR bằng ứng dụng Authenticator.
4. Nhập mã TOTP 6 số.
5. Kết quả đạt khi màn hình đóng, ứng dụng mở và trạng thái tài khoản hiển thị `AAL2`, factor đã xác minh `1`.

## 3. Kiểm thử đăng nhập lại

1. Đăng xuất hoàn toàn.
2. Đăng nhập lại bằng mật khẩu.
3. Hệ thống phải yêu cầu mã Authenticator trước khi vào phần mềm.
4. Nhập mã sai: không được mở phiên, phải có log thất bại.
5. Nhập mã đúng: phiên phải được nâng lên AAL2.

## 4. Kiểm thử bảo vệ thao tác đặc quyền

- Ở AAL1, thử ghi sổ chứng từ, khóa kỳ, quản lý người dùng hoặc phê duyệt phát hành: database phải từ chối.
- Sau AAL2, thao tác đúng quyền mới được phép.
- Kiểm tra `security_events` có bản ghi đăng nhập, MFA thành công/thất bại và đăng xuất.

## 5. Kiểm thử khôi phục mật khẩu

1. Chọn Quên mật khẩu.
2. Nhận email trên hộp thư thật.
3. Mở đúng domain Staging.
4. Đặt mật khẩu tối thiểu 12 ký tự, có hoa, thường, số và ký tự đặc biệt.
5. Sau cập nhật, toàn bộ phiên cũ phải bị đăng xuất.

## 6. Bằng chứng cần lưu

- Ảnh trạng thái AAL2 và factor đã xác minh.
- Log `security_events` đã ẩn email/IP nếu cần chia sẻ.
- Biên bản kiểm thử thao tác AAL1 bị chặn và AAL2 được phép.
- Thời gian, người kiểm thử, trình duyệt, thiết bị và phiên bản 4.5.30.
