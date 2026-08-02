# Hướng dẫn ngân sách thưởng tháng 13 và quỹ du lịch

## Vị trí

Mở **Nhân sự → Lương & Chi phí → Ngân sách thưởng tháng lương 13 và quỹ du lịch**.

## Thưởng tháng lương 13

Phần mềm tính theo từng nhân viên:

```text
Thưởng dự kiến
= Lương bình quân
× Tỷ lệ thời gian làm việc đủ điều kiện
× Hệ số hiệu suất cá nhân
× Hệ số kết quả công ty
```

Có thể chọn ngân sách Gross hoặc Net, cấu hình tỷ lệ dự phòng thuế và dự phòng điều chỉnh quỹ thưởng.

## Quỹ du lịch

```text
Quỹ du lịch
= Số người dự kiến tham gia × Chi phí bình quân/người
+ Chi phí tổ chức chung
+ Dự phòng
```

Hệ thống hiển thị quỹ lương tham chiếu, hạn mức phúc lợi quản trị ước tính, các phúc lợi khác đã chi, hạn mức còn lại và phần quỹ du lịch có khả năng vượt hạn mức.

## Quy trình kiểm soát

```text
Draft → Reviewed → Approved → Locked
```

Bản Approved hoặc Locked không được sửa trực tiếp. Trên Production, người rà soát và người phê duyệt phải là hai tài khoản khác nhau; các bước đặc quyền yêu cầu MFA AAL2.

## Trích trước ngân sách

Mức trích trước bình quân tháng bằng tổng ngân sách thưởng và du lịch chia cho 12. Đây là số liệu quản trị dòng tiền; việc ghi nhận kế toán và điều kiện thuế phải được kế toán phụ trách phê duyệt.
