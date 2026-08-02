# BIÊN BẢN KIỂM THỬ GIỮ VỊ TRÍ BẢNG — v4.5.63

**Sản phẩm:** ALPHA DESIGN ERP Cloud  
**Ngày kiểm thử:** 02/08/2026  
**Phạm vi:** lớp kết xuất bảng dùng chung, thao tác Duyệt/Từ chối và hồi quy kế toán–thuế  
**Kết luận:** lỗi nhảy về dòng đầu đã được vá ở lớp dùng chung; công thức nghiệp vụ không thay đổi; Production vẫn chờ các cổng triển khai bên ngoài.

## 1. Nguyên nhân gốc

Hàm kết xuất cũ thực hiện `content.innerHTML = fn()` sau mỗi thao tác. Toàn bộ node `.table-wrap` bị hủy và tạo lại, khiến trình duyệt đặt `scrollTop` và `scrollLeft` về 0. Bảng Phê duyệt bộc lộ lỗi rõ nhất vì Duyệt/Từ chối gọi `render()` ngay sau khi lưu.

## 2. Cách vá

| Kiểm soát | Hành vi v4.5.63 |
|---|---|
| Chụp trạng thái | Chụp vị trí dọc/ngang của mọi `.table-wrap` trước khi thay HTML |
| Định danh bảng | Ghép thứ tự, ID/khóa khai báo và tiêu đề cột để khớp đúng bảng sau render |
| Neo dòng | Nếu bảng có `data-record-id`, giữ dòng nhìn thấy đầu tiên ở đúng độ lệch cũ |
| Thời điểm khôi phục | Khôi phục sau bước cân chỉnh responsive bằng hai nhịp `requestAnimationFrame` |
| Giới hạn ngữ cảnh | Chỉ khôi phục trong cùng màn hình, tab, kỳ và bộ lọc |
| Điều hướng chủ động | Chuyển màn hình hoặc mở thông báo có dòng đích sẽ không dùng vị trí cũ |

## 3. Ma trận kiểm thử hồi quy

| Tình huống | Kết quả mong đợi | Kết quả |
|---|---|---|
| Duyệt dòng giữa/cuối bảng Phê duyệt | Dòng đang xem giữ nguyên độ lệch | Đạt |
| Từ chối dòng giữa/cuối bảng Phê duyệt | Không trở về dòng đầu | Đạt |
| Duyệt timesheet trong bảng dài | Giữ vị trí dọc của bảng | Đạt |
| Bảng rộng đang cuộn ngang | Giữ `scrollLeft` | Đạt |
| Dòng vừa thao tác vẫn còn | Neo theo `data-record-id` | Đạt |
| Dòng vừa thao tác bị bộ lọc loại khỏi bảng | Giữ vị trí số học gần nhất và chặn vượt biên | Đạt |
| Chuyển sang màn hình khác | Không khôi phục vị trí màn hình cũ | Đạt |
| Chuyển tab Kế toán/Mua sắm/Phân tích/Kiểm soát | Đặt lại đúng ngữ cảnh mới | Đạt |
| Đổi kỳ báo cáo/kỳ lương/năm phúc lợi | Không dùng vị trí của kỳ cũ | Đạt |
| Mở bản ghi từ thông báo | Ưu tiên cuộn tới bản ghi đích | Đạt |
| Bảng ngắn không có thanh cuộn | Không phát sinh vị trí âm/vượt biên | Đạt |
| Vị trí cuộn trang bên ngoài bảng | Giữ nguyên sau thao tác cùng màn hình | Đạt |

## 4. Hồi quy kế toán và thuế

Bản vá không thay đổi calculation core. Kết quả chạy lại:

- `npm test`: PASS toàn bộ release audit v4.5.63.
- 57.500 tình huống nghiệp vụ đa kịch bản: PASS.
- 315.092 kiểm tra phức tạp xác định: PASS.
- 470.000 kiểm tra đối kháng tiền tệ/hash/chứng từ: PASS.
- 40.007 tình huống tiền và liên kết độc lập: PASS.
- Dữ liệu tải lớn 100 nhân sự, 48 dự án trên 10 tỷ đồng, 2.510 bản ghi và 544 đối chiếu: PASS.
- `npm run audit:financial`: PASS, điểm 100/100; 0 lỗi nghiêm trọng, 0 cảnh báo thất bại, 0 sửa chữa tự động.
- Các kiểm soát `JE_BALANCE`, `TB_BALANCE`, `VAT_DEDUCTION_EVIDENCE`, `VAT_PARTIAL_PAYMENT`, `VAT_PAYMENT_LINK`, `PIT_MATH`, `TT133_B01`, `TT133_B02`, `TT133_B03`, `FINANCE_JOURNAL_EXACT` và toàn vẹn liên kết: đạt.
- Migration 001–071, consolidated schema, source/public parity, package integrity và backend smoke: PASS.

Môi trường hiện không có Chromium/Playwright tương thích, nên không tuyên bố đã chạy lại bộ browser audit cho v4.5.63. Kiểm thử vị trí bảng hiện tại là kiểm thử hành vi xác định trên chính các hàm chụp/khôi phục và kiểm thử wiring của lớp render dùng chung.

## 5. Cổng Production còn lại

1. Chạy và đối chiếu migration 001–071 trên Supabase thật.
2. Đối chiếu song song với sổ cái, hóa đơn, sao kê và bảng lương đã ký.
3. Kiểm định mapping TT99 và XML thuế đang có hiệu lực.
4. Kiểm thử backup/restore, MFA, phân quyền và phê duyệt kép.

`productionApproval` tiếp tục là `false`.
