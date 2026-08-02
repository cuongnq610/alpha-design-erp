# BÁO CÁO KIỂM THỬ, VÁ LỖI VÀ PHÁT HÀNH v4.5.67

## 1. Phạm vi

Gói nguồn kiểm tra: **ALPHA DESIGN ERP Cloud v4.5.66 RECYCLE BIN RESTORE RELEASE**.

Bản phát hành sau kiểm thử: **ALPHA DESIGN ERP Cloud v4.5.67 DEEP QA AUTOHEAL RELEASE**.

Phạm vi gồm cấu trúc gói, thuật toán, công thức tiền, kế toán kép, BCTC, thuế, lương, tài chính–kinh tế dự án, liên kết dữ liệu, Cloud/Supabase, bảo mật, thùng rác–khôi phục, trình duyệt, responsive, tải lớn, package integrity và cơ chế tự vá.

## 2. Lỗi xác nhận và bản vá

### DEF-4567-01 — Sai biên thuế TNDN tại đúng 50 tỷ đồng — Critical

- Hiện trạng: chế độ tự động trả về 20% khi doanh thu năm trước bằng đúng 50.000.000.000 VND.
- Nguyên nhân: dải 17% được cấu hình loại trừ cận trên (`inclusive: false`) và điều kiện review dùng `< 50 tỷ`.
- Kết quả đúng: khi đủ điều kiện, doanh thu trên 3 tỷ đến **không quá 50 tỷ** áp dụng 17%; chỉ trên 50 tỷ mới áp dụng mức chuẩn.
- Bản vá: đổi cận 50 tỷ thành inclusive và đồng bộ điều kiện review thành `<= 50 tỷ`.
- Test chống tái phát: 0; 3 tỷ; 3 tỷ + 1; 49.999.999.999; 50 tỷ; 50 tỷ + 1, kèm trường hợp thiếu phê duyệt ưu đãi.
- Trạng thái: **ĐÃ VÁ — PASS**.

### DEF-4567-02 — False positive trong structural browser audit — Major/QA

- Hiện trạng: hai cảnh báo KPI quá lớn tại view Kiểm soát, dù giao diện không bị tràn.
- Nguyên nhân: selector kiểm tra toàn bộ `.dashboard-kpi-grid`, gồm cả KPI vận hành compact, trong khi ngưỡng kích thước chỉ dành cho KPI lõi dashboard.
- Bản vá: giới hạn selector vào `.dashboard-core-grid > .kpi-card`.
- Hậu kiểm: 378 trạng thái trình duyệt, không còn cảnh báo giả.
- Trạng thái: **ĐÃ VÁ — PASS**.

### DEF-4567-03 — Đồng bộ release/certification migration — Critical/Release

- Bản phát hành mới phải dùng migration 075 nhưng các hằng số chứng nhận trong ứng dụng và Export Center cần được nâng đồng bộ.
- Bản vá: `DATABASE_MIGRATION_VERSION = 75` tại ứng dụng và cổng xuất; migration 075 gắn active release và TT133 certification với v4.5.67; test SQL và export gate được bổ sung.
- Trạng thái: **ĐÃ VÁ — PASS**.

## 3. Kết quả kiểm thử tự động

| Nhóm | Kết quả |
|---|---:|
| Toàn bộ `npm test` release audit | PASS |
| Ma trận nghiệp vụ đa tình huống | 57.500 scenario — PASS |
| Tính toán đối kháng phức tạp | 315.092 check — PASS |
| Tiền/hash/bút toán đối kháng | 470.000 check trên 160.000 scenario — PASS |
| Mô phỏng công thức độc lập | 15.250 scenario — PASS |
| Randomized formula/tax/hash/cash-flow | 40.000 scenario — PASS |
| Money/linkage độc lập | 40.007 scenario — PASS |
| Input workflow | 6.000 scenario — PASS |
| Stress sổ kế toán | 10.000 bút toán, 20.000 dòng — cân bằng |
| Enterprise load | 100 nhân sự, 48 dự án, 2.510 bản ghi, 544 check — PASS |
| Golden dataset | 25 đầu ra kiểm soát — PASS |
| Structural browser | 27 view × 7 viewport × 2 theme = 378 trạng thái — PASS |
| Lỗi script trình duyệt | 0 |
| Body/table/KPI overflow issue | 0 |
| Static security | PASS |
| Authentication/MFA browser | PASS, 0 page error |
| Financial audit | PASS |
| Package integrity | PASS, migration 001–075, source/public parity, không secret/file rác |
| SHA-256 file manifest | PASS, không file thiếu/thừa |
| Auto-heal full pipeline | PASS |

Bộ structural browser chạy ở các kích thước 1920×1080, 1792×1000, 1536×1000, 1440×1000, 1024×900, 768×900 và 390×844, trong cả light/dark mode. Kết quả: 378/378 trạng thái đạt, 0 lỗi bảng, 0 body overflow, 0 KPI text overflow, 0 script error.

## 4. Kiểm toán kế toán, thuế và tài chính

- Bút toán kép: kiểm tra cân Nợ/Có, lệch 1 đồng, tài khoản không hợp lệ, hash bị sửa và khóa kỳ.
- BCTC: đối chiếu trial balance, P&L, B01, B02, B03, B09, TT133 và TT132; TT99 vẫn fail-closed cho phát hành chính thức.
- Thuế: biên TNDN, TNCN theo ngày hiệu lực, VAT đầu vào với bằng chứng thanh toán, phân bổ một phần, sai nhà cung cấp, vượt hóa đơn và TK 242.
- Tài chính: cash flow quản trị/sổ cái, tỷ số thanh khoản, biên lợi nhuận, ROA/ROE, DSO/DPO/CCC, forecast, backlog, pipeline, non-cash expense, EAC/CPI/SPI và budget baseline.
- Audit tài chính nhận diện đúng trường hợp giả lập tăng trưởng có dòng tiền âm trong tương lai; đây là cảnh báo của dữ liệu kịch bản, không phải lỗi công thức.

## 5. Chương trình tự vá

File: `scripts/auto-heal-release.mjs`.

Nguyên tắc: chỉ vá lỗi xác định trước, có precondition và test hậu kiểm; lỗi lạ phải dừng. Allowlist hiện tại gồm:

1. Cận 50 tỷ của dải TNDN 17%.
2. Điều kiện review TNDN tại 50 tỷ.
3. Selector KPI lõi của structural audit.
4. Dọn Python cache/log tạm.
5. Tái tạo schema, public build, checksum và manifest.

Lệnh:

```bash
npm run heal          # vá + test trọng yếu
npm run heal:full     # vá + toàn bộ release audit + manifest
```

Kết quả lần chạy cuối: `quality/AUTO_HEAL_V4_5_67_RESULT.json` — **PASS**, không có lỗi chưa xử lý.

## 6. Hồ sơ kiểm thử kèm theo

- `QA_MASTER_TEST_PROGRAM_V4_5_67_VI.md`: chiến lược, cổng phát hành, dữ liệu biên, Severity, SLA và quy tắc tự vá.
- `QA_TEST_CASE_MATRIX_V4_5_67.csv`: **186 test case** chi tiết.
- `RELEASE_NOTES_V4_5_67_DEEP_QA_AUTOHEAL.md`.
- `quality/final-v4567/`: bằng chứng security, MFA và structural browser.
- `FILE_MANIFEST_SHA256.txt`: manifest toàn bộ file phát hành.

## 7. Trạng thái phát hành

**Đạt điều kiện phát hành bản QA/UAT v4.5.67. Chưa tự phê duyệt Production.**

Các cổng ngoài môi trường cục bộ còn bắt buộc:

1. Chạy và đối chiếu migration 001–075 trên Supabase staging/production thật.
2. Đối chiếu ít nhất hai kỳ bằng dữ liệu sổ, ngân hàng, hóa đơn và lương đã ký của doanh nghiệp.
3. Xác minh mapping TT99 Appendix IV và schema XML theo phiên bản HTKK/eTax đang hiệu lực trước khi mở xuất chính thức.
4. Diễn tập backup/restore, RPO/RTO và rollback/fail-forward.
5. UAT đa thiết bị, kiểm thử tích hợp ngân hàng/hóa đơn điện tử và phê duyệt kép của Kế toán trưởng–Giám đốc.

`productionApproval` trong `VERSION.json` tiếp tục là `false` để không đánh đồng test cục bộ với nghiệm thu vận hành thật.
