# DIỄN TẬP SAO LƯU VÀ PHỤC HỒI

## Tần suất đề xuất

- Sao lưu cơ sở dữ liệu hằng ngày; lưu checksum và manifest.
- Bản sao ngoại vi/khác vùng tối thiểu hằng tuần.
- Diễn tập phục hồi tối thiểu hàng quý và trước go-live.

## Quy trình

1. Chạy `scripts/backup.sh` trên database nguồn.
2. Tạo database thử nghiệm trống, tách biệt production.
3. Chạy `scripts/restore-verify.sh` với tệp backup.
4. Kiểm tra số lượng bản ghi, cân bằng chứng từ, hash chứng từ, tệp đính kèm và audit log.
5. Mở ngẫu nhiên hồ sơ dự án và chạy bộ BCTC một kỳ đã khóa.
6. Ghi RPO, RTO thực tế và người chứng kiến vào biên bản.

Go-live không được chấp thuận nếu chưa phục hồi thành công từ một bản sao độc lập.
