# CHƯƠNG TRÌNH KIỂM THỬ TỔNG THỂ — ALPHA DESIGN ERP CLOUD v4.5.67

## 1. Mục tiêu

Xác nhận phần mềm tính đúng, ghi nhận đúng, liên kết đúng và thất bại an toàn trước khi sử dụng dữ liệu thật. Chương trình bao phủ thuật toán, công thức, kế toán, thuế, tài chính–kinh tế dự án, luồng nghiệp vụ, cơ sở dữ liệu, bảo mật, trình duyệt, hiệu năng, sao lưu–khôi phục và điều kiện phát hành.

## 2. Nguyên tắc kiểm thử

1. **Độc lập với dữ liệu demo:** mọi công thức trọng yếu có bộ dữ liệu vàng, dữ liệu biên và dữ liệu ngẫu nhiên đối kháng.
2. **Kiểm tra bất biến:** tổng Nợ = tổng Có; số dư đầu + phát sinh = số dư cuối; tiền đầu + dòng tiền thuần = tiền cuối; phân bổ không vượt nguồn; thuế không âm; không ghi đè bản ghi khi khôi phục.
3. **Kiểm tra theo ngày hiệu lực:** công thức thuế và chế độ kế toán phải chọn chính sách theo kỳ, không theo ngày máy tính một cách mù quáng.
4. **Fail closed:** thiếu phê duyệt, thiếu MFA, thiếu chứng từ, thiếu liên kết hoặc sai hash thì chặn thao tác thay vì tự suy đoán.
5. **Không tự tuyên bố Production:** kiểm thử cục bộ không thay thế đối chiếu dữ liệu thật, nghiệm thu kế toán trưởng, thử Supabase staging, sao lưu–khôi phục và xác minh schema HTKK/eTax.

## 3. Cổng phát hành bắt buộc

| Cổng | Nội dung | Điều kiện đạt |
|---|---|---|
| G0 | Cấu trúc gói, syntax, build, checksum | 100% đạt, không file rác/secret |
| G1 | Thuật toán và công thức | 100% test Critical; không sai số quá 1 VND |
| G2 | Kế toán và BCTC | Cân đối Nợ/Có, parity sổ–báo cáo, khóa kỳ hoạt động |
| G3 | Thuế | Đúng biên, đúng ngày hiệu lực, thiếu căn cứ thì chặn |
| G4 | Tài chính–kinh tế dự án | P&L, dòng tiền, EAC/CPI/SPI và forecast bảo toàn số liệu |
| G5 | Nghiệp vụ ứng dụng | CRUD, phê duyệt, ghi sổ, khóa, xóa/khôi phục đúng trạng thái |
| G6 | Cloud, SQL và bảo mật | RLS, quyền, MFA, payload, hash và audit trail đạt |
| G7 | Trình duyệt/UX | Không lỗi script, tràn bảng, nhảy dòng, mất vị trí, XSS |
| G8 | Hiệu năng và tải | Không treo; thời gian đáp ứng nằm trong ngưỡng đã định |
| G9 | DR/khôi phục | Backup có thể phục hồi; kiểm tra checksum và RPO/RTO |
| G10 | UAT Production | Kế toán trưởng + Giám đốc ký; đối chiếu dữ liệu thật 2 kỳ |

## 4. Chiến lược dữ liệu kiểm thử

- **Biên tiền:** 0; 1; 4.999.999; 5.000.000; 5.000.001; 3 tỷ; 50 tỷ; số lớn gần giới hạn an toàn.
- **Biên thời gian:** ngày đầu/cuối tháng, năm nhuận, giao năm tài chính, kỳ khóa, chính sách trước/sau ngày hiệu lực.
- **Dữ liệu kế toán:** chứng từ cân, lệch 1 đồng, tài khoản không tồn tại, trùng số chứng từ, hash bị sửa, chứng từ kỳ khóa.
- **Dữ liệu dự án:** 0–100% tiến độ, ngân sách 0, vượt ngân sách, nhiều baseline, hợp đồng >10 tỷ, 100 nhân sự, 48+ dự án.
- **Dữ liệu xấu:** ID trùng/thiếu, chuỗi XSS, CSV formula injection, payload quá lớn, liên kết mồ côi, quyền không đủ.

## 5. Quy tắc tự vá lỗi

Chương trình `scripts/auto-heal-release.mjs` chỉ được phép vá lỗi có mẫu xác định và hậu kiểm tự động: biên thuế TNDN 50 tỷ, selector QA KPI, tái tạo public/schema/checksum/manifest và xóa cache tạm. Mọi lỗi không nằm trong danh sách cho phép, lỗi dữ liệu thật, thay đổi bút toán đã ghi sổ, thay đổi RLS/migration phá hủy, hoặc thay đổi chính sách pháp lý **phải dừng và yêu cầu phê duyệt**. Sau mỗi bản vá, toàn bộ test liên quan và package-integrity phải chạy lại.

## 6. Chu kỳ thực thi

1. Snapshot mã nguồn và dữ liệu test.
2. Chạy G0–G6 bằng `npm test` và `npm run audit:financial`.
3. Chạy G7 bằng `npm run test:browser`; chạy bộ mở rộng khi phát hành Production Candidate.
4. Chạy G8 bằng tải chuẩn 100 nhân sự/48 dự án và stress ngẫu nhiên.
5. Thử G9 trên Supabase staging độc lập.
6. Tạo báo cáo lỗi theo Severity, nguyên nhân gốc, bản vá, test chống tái phát.
7. Chạy `npm run heal:full`, tạo manifest SHA-256 và đóng gói ZIP.
8. Chỉ qua G10 sau khi đối chiếu dữ liệu thật và ký nghiệm thu.

## 7. Phân loại lỗi và SLA

| Mức | Ví dụ | Quyết định |
|---|---|---|
| Blocker | Mất dữ liệu, sai BCTC/thuế, vượt quyền, không khôi phục được | Chặn phát hành |
| Critical | Sai công thức tiền, lệch Nợ/Có, bypass MFA/RLS | Chặn phát hành |
| Major | Luồng chính không hoạt động, bảng nhảy/mất vị trí, export sai | Chặn RC hoặc vá trước UAT |
| Minor | Căn chỉnh, nhãn, thông báo không ảnh hưởng số liệu | Có thể lên lịch nhưng phải ghi nhận |

## 8. Bằng chứng phải lưu

Log test Node, JSON browser audit, ảnh lỗi trước/sau, dữ liệu đầu vào, kết quả kỳ vọng, checksum schema, manifest file, danh sách migration, báo cáo tài chính đối chiếu, biên bản backup/restore và chữ ký UAT. Danh mục test chi tiết nằm trong `QA_TEST_CASE_MATRIX_V4_5_67.csv`.
