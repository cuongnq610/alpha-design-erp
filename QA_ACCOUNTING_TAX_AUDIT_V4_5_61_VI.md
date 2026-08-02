# BIÊN BẢN KIỂM THỬ KẾ TOÁN & THUẾ — v4.5.61

**Sản phẩm:** ALPHA DESIGN ERP Cloud  
**Ngày kiểm thử:** 31/07/2026  
**Phạm vi:** mã nguồn và dữ liệu DEMO trong gói v4.5.60 do người dùng cung cấp  
**Kết luận:** đạt kiểm thử hồi quy cục bộ sau vá lỗi; **chưa phê duyệt Production** vì còn các cổng dữ liệu thật và xác nhận pháp lý bên ngoài.

## 1. Kết quả điều tra

Phát hiện năm nhóm lỗi có thể làm sai số thuế hoặc làm sai trạng thái phát hành:

| Mã | Lỗi ở v4.5.60 | Rủi ro | Xử lý ở v4.5.61 |
|---|---|---|---|
| TAX-CIT-01 | Doanh thu tính thuế năm trước đúng 50 tỷ đồng bị xếp vào thuế suất 17% | Ước tính thiếu thuế TNDN | Biên 17% đổi thành `< 50 tỷ`; đúng 50 tỷ áp dụng 20% |
| TAX-PIT-01 | Biểu thuế lương 2026 mặc định hiệu lực từ 01/07/2026 | TNCN tháng 01–06/2026 dùng sai giảm trừ và biểu thuế | Hiệu lực đổi thành 01/01/2026; tự di trú cấu hình cũ và chỉ tính lại kỳ lương Nháp |
| TAX-VAT-01 | Thuế GTGT đầu vào tin trực tiếp cờ `deductible`, không kiểm tra chứng từ thanh toán | Có thể khấu trừ sai hóa đơn từ ngưỡng 5 triệu đồng | Kiểm tra ngưỡng gồm VAT, phương thức/trạng thái thanh toán và cộng gộp cùng nhà cung cấp trong cùng ngày |
| ACC-TT99-01 | Báo cáo TT99 thực chất dùng lại mapping dòng TT133 và từng được cho phép xuất | Có thể phát hành BCTC sai biểu mẫu/chỉ tiêu | Khóa fail-closed toàn bộ xuất TT99 cho tới khi mapping Phụ lục IV được kiểm định độc lập |
| CLOUD-CERT-01 | Chứng nhận Cloud kiểm tra phiên bản/migration cũ 4.5.50/068 | Chứng nhận hợp lệ không thể khớp gói hiện tại | Ràng buộc động theo v4.5.61 và migration 069; bổ sung migration 069 |

## 2. Kiểm tra logic và kết quả tính độc lập

Các giá trị dưới đây được tính bằng test độc lập, không lấy kết quả mong đợi từ giao diện.

### Thuế TNDN

| Doanh thu làm căn cứ năm trước | Thuế suất mong đợi | Kết quả v4.5.61 |
|---:|---:|---:|
| 3.000.000.000 | 15% | 15% — đạt |
| 3.000.000.001 | 17% | 17% — đạt |
| 49.999.999.999 | 17% | 17% — đạt |
| 50.000.000.000 | 20% | 20% — đạt |
| 50.000.000.001 | 20% | 20% — đạt |

Thuế suất tự động vẫn yêu cầu trạng thái đủ điều kiện được phê duyệt; chế độ nhập thủ công vẫn lưu lịch sử hiệu lực để tránh tự suy diễn điều kiện ưu đãi.

### Thuế TNCN từ tiền lương

| Ngày tính | Giảm trừ bản thân | Người phụ thuộc | Số bậc | Kết quả |
|---|---:|---:|---:|---|
| 31/12/2025 | 11.000.000 | 4.400.000 | 7 | đạt |
| 01/01/2026 | 15.500.000 | 6.200.000 | 5 | đạt |

Kiểm tra số học biểu 2026: thu nhập tính thuế 10.000.000 đồng cho kết quả 500.000 đồng; 110.000.000 đồng cho kết quả 24.000.000 đồng. Kỳ lương đã khóa không bị tự động sửa khi nâng phiên bản.

### Thuế GTGT đầu vào

| Tình huống | Kết quả đúng | Kết quả v4.5.61 |
|---|---|---|
| Tổng thanh toán đúng 5.000.000, trả tiền mặt | Không khấu trừ | bị chặn — đạt |
| Tổng thanh toán 4.999.999 | Không thuộc kiểm soát ngưỡng này | được giữ — đạt |
| Hai hóa đơn 3.000.000, cùng MST NCC và cùng ngày, trả tiền mặt | Cộng 6.000.000 và chặn cả hai | bị chặn — đạt |
| 5.000.000, chuyển khoản, đã thanh toán | Được khấu trừ | được khấu trừ — đạt |
| Mua trả chậm, chuyển khoản, chưa đến hạn | Tạm đủ điều kiện nhưng phải theo dõi | cảnh báo rà soát — đạt |
| Đã quá hạn mà chưa có chứng từ không dùng tiền mặt | Không khấu trừ | bị chặn — đạt |

Sổ VAT và số thuế phải nộp hiện chỉ sử dụng phần đầu vào đạt điều kiện; kiểm soát `VAT_DEDUCTION_EVIDENCE` là lỗi nghiêm trọng nếu có số đã đánh dấu khấu trừ nhưng thiếu bằng chứng.

## 3. Bằng chứng kiểm thử kỹ thuật

- `npm test`: đạt toàn bộ release audit, gồm test công thức, sổ cái, bút toán, liên kết nghiệp vụ, payroll, thuế, xuất báo cáo, backend, bảo mật và kiểm tra migration.
- `npm run audit:financial`: đạt, điểm kiểm soát 100/100 trên dữ liệu mô phỏng; không có kiểm soát nghiêm trọng thất bại.
- `tests/accounting-tax-legal-regression-v4561.test.mjs`: đạt toàn bộ biên CIT/PIT/VAT nêu trên, khóa TT99 và ràng buộc chứng nhận Cloud.
- `npm run build`, tạo/kiểm tra manifest và kiểm tra toàn vẹn gói: đạt.
- Kiểm tra cú pháp JavaScript và migration 001–069 ở mức tĩnh: đạt.
- Bằng chứng stress được tách số liệu thời gian/bộ nhớ không xác định khỏi tệp checksum; chuỗi `giải nén → npm test → manifest:verify` không còn tự làm thay đổi gói.

Các kết quả trình duyệt v4.5.60 nằm trong thư mục `quality/final-v4560` chỉ là bằng chứng lịch sử. Báo cáo này **không tuyên bố** đã chạy lại toàn bộ bộ trình duyệt trên v4.5.61.

## 4. Căn cứ pháp lý dùng để đối chiếu

- Bộ Tài chính, chế độ kế toán doanh nghiệp theo Thông tư 99/2025/TT-BTC, hiệu lực 01/01/2026: https://www.mof.gov.vn/tin-tuc-tai-chinh/tin-chinh-sach-tai-chinh/quy-dinh-moi-ve-che-do-ke-toan-doanh-nghiep
- Chính phủ, Luật sửa đổi 09/2026/QH16 và biên doanh thu thuế TNDN: https://xaydungchinhsach.chinhphu.vn/thong-qua-luat-sua-doi-bo-sung-4-luat-thue-thu-nhap-ca-nhan-thue-gia-tri-gia-tang-thue-thu-nhap-doanh-nghiep-thue-tieu-thu-dac-biet-119260424140703304.htm
- Chính phủ, quy định khấu trừ thuế TNCN năm 2026: https://xaydungchinhsach.chinhphu.vn/quy-dinh-moi-ve-khau-tru-thue-thu-nhap-ca-nhan-119260703150410707.htm
- Chính phủ, Luật Thuế thu nhập cá nhân áp dụng kỳ tính thuế 2026: https://xaydungchinhsach.chinhphu.vn/luat-thue-thu-nhap-ca-nhan-119260623093630882.htm
- Bộ Tài chính, điều kiện thanh toán không dùng tiền mặt đối với thuế GTGT đầu vào từ 5 triệu đồng và cộng gộp cùng ngày: https://qlg.mof.gov.vn/hoidapcstc/home/cthoidap/157494

## 5. Cổng còn lại trước Production

1. Chạy migration 001–069 trên Supabase thật và đối chiếu checksum/chứng nhận Cloud.
2. Đối chiếu song song bằng bảng lương, hóa đơn điện tử, sao kê ngân hàng và sổ cái đã ký của doanh nghiệp.
3. Kiểm định đầy đủ mapping Phụ lục IV TT99 trước khi gỡ khóa xuất TT99.
4. Xác nhận hồ sơ XML với phiên bản phần mềm/schema kê khai đang có hiệu lực.
5. Kiểm thử sao lưu/khôi phục, phân quyền, MFA và phê duyệt kép trên môi trường staging/production.

`productionApproval` tiếp tục là `false`. Gói v4.5.61 phù hợp để kiểm thử chấp nhận người dùng (UAT), không phải bằng chứng tự động rằng hồ sơ thuế thật đã đủ điều kiện nộp.
