# BIÊN BẢN KIỂM THỬ KẾ TOÁN & THUẾ — v4.5.62

**Sản phẩm:** ALPHA DESIGN ERP Cloud  
**Ngày kiểm thử:** 01/08/2026  
**Phạm vi:** toàn bộ bộ hồi quy cục bộ, dữ liệu DEMO và các bộ dữ liệu kế toán/thuế đối chứng được nhập bằng mã kiểm thử  
**Kết luận:** hai sai lệch của v4.5.61 đã được vá và kết quả tính lại đạt; **chưa phê duyệt Production** vì còn các cổng dữ liệu thật, Cloud và xác nhận pháp lý bên ngoài.

## 1. Sai lệch được phát hiện và xử lý

| Mã | Sai lệch trước bản vá | Kết quả sai | Xử lý ở v4.5.62 |
|---|---|---|---|
| TAX-VAT-PAY-01 | Hóa đơn đầu vào chỉ cần cờ `Paid`, không cần khoản chi/bút toán ngân hàng liên kết | Hóa đơn 330 triệu đồng không có chứng từ vẫn được khấu trừ 30 triệu đồng VAT | Cờ nhập tay chỉ còn tham khảo; thiếu bằng chứng liên kết thì khấu trừ 0 đồng |
| TAX-VAT-PART-02 | Thanh toán hợp lệ một phần không được phân bổ theo tỷ lệ | Thanh toán 165/330 triệu đồng cho kết quả 0 đồng thay vì 15 triệu đồng VAT | Khấu trừ theo `VAT × tiền đã xác minh / tổng thanh toán` |
| ACC-TK242-01 | Engine tình hình tài chính xếp toàn bộ TK 242 ngắn hạn, trong khi B01 mặc định xếp dài hạn | Tài sản ngắn hạn lệch 23 triệu đồng giữa hai báo cáo | Dùng chung quy tắc `reportClass`; mặc định TK 242 là dài hạn |

## 2. Kiểm tra nhập liệu và kết quả VAT đầu vào

Hóa đơn đối chứng: giá chưa VAT 300.000.000 đồng, VAT 30.000.000 đồng, tổng thanh toán 330.000.000 đồng, nhà cung cấp A.

| Tình huống nhập liệu | Kết quả đúng | Kết quả v4.5.62 |
|---|---:|---:|
| Chỉ đặt trạng thái “Đã thanh toán”, không có khoản chi và bút toán ngân hàng | 0 | 0 — đạt |
| Khoản chi 330.000.000, đúng hóa đơn/NCC, bút toán Posted giảm TK 112 đúng số tiền | 30.000.000 | 30.000.000 — đạt |
| Khoản chi hợp lệ 165.000.000 | 15.000.000 | 15.000.000 — đạt |
| Hai khoản chi hợp lệ 100.000.000 và 65.000.000 | 15.000.000 | 15.000.000 — đạt |
| Khoản chi đúng số tiền nhưng sai nhà cung cấp | 0 | 0 — đạt |
| Bút toán dùng TK 111 thay TK 112 | 0 | 0 — đạt |
| Ngày thanh toán sau ngày chốt báo cáo | 0 tại ngày chốt | 0 — đạt |
| Tổng khoản chi Paid 331.000.000 vượt tổng hóa đơn | Từ chối lưu | Từ chối — đạt |
| Hóa đơn trả chậm chưa đến hạn, chưa có chứng từ | Tạm khấu trừ và đưa vào danh sách rà soát | 30.000.000 provisional — đạt |

Công thức cho thanh toán một phần:

`VAT được khấu trừ = làm tròn(VAT hóa đơn × tổng tiền thanh toán ngân hàng hợp lệ / tổng giá thanh toán)`

Mọi bằng chứng phải đồng thời thỏa mãn: khoản chi `Expense/Paid`, ngày không sau ngày chốt, liên kết đúng hóa đơn, đúng nhà cung cấp, bút toán `Posted`, số giảm TK 112 đúng bằng khoản chi, TK 111 không phát sinh và tổng liên kết không vượt tổng hóa đơn.

## 3. Kiểm tra TK 242 và B01

Số dư đối chứng: tiền 100.000.000 đồng; TK 242 là 23.000.000 đồng; nợ phải trả 3.000.000 đồng; vốn chủ sở hữu 120.000.000 đồng.

| Cấu hình TK 242 | Tình hình tài chính | B01 | Kết quả |
|---|---:|---:|---|
| Không có `reportClass` | Ngắn hạn 100.000.000; dài hạn 23.000.000 | Chỉ tiêu 100 = 100.000.000; chỉ tiêu 200 = 23.000.000 | Khớp — đạt |
| `current_other_asset` | Ngắn hạn 123.000.000; dài hạn 0 | Chỉ tiêu 100 = 123.000.000; chỉ tiêu 200 = 0 | Khớp — đạt |

Tổng tài sản vẫn là 123.000.000 đồng trong cả hai cách phân loại; bản vá chỉ sửa vị trí trình bày, không làm thay đổi tổng tài sản.

## 4. Kết quả bộ kiểm thử phát hành

- Toàn bộ `npm test`: PASS, gồm công thức, sổ cái, VAT, TNCN, TNDN, payroll, tài sản, công nợ, báo cáo TT133/TT132, xuất dữ liệu, backend, bảo mật, migration và toàn vẹn gói.
- 57.500 tình huống nghiệp vụ đa kịch bản: PASS.
- 470.000 kiểm tra đối kháng tiền tệ/hash/chứng từ: PASS.
- 315.092 kiểm tra phức tạp xác định: PASS.
- 40.007 tình huống tiền và liên kết độc lập: PASS.
- Dữ liệu tải lớn 100 nhân sự, 48 dự án trên 10 tỷ đồng, 2.510 bản ghi và 544 đối chiếu: PASS.
- Financial audit mô phỏng: PASS, 100/100; các kiểm soát `VAT_DEDUCTION_EVIDENCE`, `VAT_PARTIAL_PAYMENT`, `VAT_PAYMENT_LINK`, `FINANCE_JOURNAL_EXACT`, `TT133_B01` đều đạt.
- Migration 070 và consolidated schema 001–070: PASS kiểm tra tĩnh/lexical và thứ tự.

Bộ trình duyệt hiện không được chạy lại cho v4.5.62 do môi trường không có executable tương thích. Bằng chứng trình duyệt cũ chỉ được giữ làm lịch sử và không được dùng để tuyên bố bản này đã qua browser audit.

## 5. Căn cứ đối chiếu và nguyên tắc thận trọng

- Bộ Tài chính: điều kiện thanh toán không dùng tiền mặt đối với hàng hóa, dịch vụ mua vào từ ngưỡng 5 triệu đồng: https://qlg.mof.gov.vn/hoidapcstc/home/cthoidap/155081
- Bộ Tài chính: trường hợp thanh toán từng phần, chỉ phần giá trị có chứng từ thanh toán không dùng tiền mặt đáp ứng điều kiện khấu trừ: https://tpcp.mof.gov.vn/hoidapcstc/home/cthoidap/156809
- Chính phủ: Luật sửa đổi về thuế TNDN/VAT/TNCN và các ngưỡng áp dụng năm 2026: https://xaydungchinhsach.chinhphu.vn/thong-qua-luat-sua-doi-bo-sung-4-luat-thue-thu-nhap-ca-nhan-thue-gia-tri-gia-tang-thue-thu-nhap-doanh-nghiep-thue-tieu-thu-dac-biet-119260424140703304.htm

Phần mềm áp dụng nguyên tắc fail-closed: trạng thái do người dùng nhập không thay thế chứng từ ngân hàng; bù trừ công nợ hoặc phương thức không dùng tiền mặt khác chưa có luồng chứng cứ được xác minh riêng sẽ không tự động được coi là đủ điều kiện.

## 6. Cổng còn lại trước Production

1. Chạy và đối chiếu migration 001–070 trên Supabase staging/production thật.
2. Nhập/đồng bộ sao kê ngân hàng, hóa đơn điện tử, sổ cái và hồ sơ nhà cung cấp thực tế; đối chiếu song song với kỳ đã ký.
3. Kiểm định mapping Phụ lục IV TT99 trước khi gỡ khóa xuất TT99.
4. Xác nhận XML thuế với phần mềm/schema kê khai đang có hiệu lực.
5. Kiểm thử sao lưu/khôi phục, phân quyền, MFA, khóa kỳ và phê duyệt kép.

`productionApproval` tiếp tục là `false`. v4.5.62 phù hợp cho UAT và staging có kiểm soát; không phải xác nhận tự động rằng hồ sơ thuế thực tế đã đủ điều kiện kê khai hoặc nộp.
