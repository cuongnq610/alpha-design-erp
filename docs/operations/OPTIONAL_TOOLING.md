# Công cụ tùy chọn cho triển khai và QA

Runtime ứng dụng chỉ cần Node.js >=20 và dùng các thư viện trình duyệt đã bundle cục bộ.

Các công cụ sau không phải runtime dependency và nên cài riêng trên máy CI/staging khi cần:
- Supabase CLI 2.109.1 để chạy migration/kiểm tra dự án Supabase.
- Python Playwright 1.55.0 và Beautiful Soup 4.13.4 để chạy bộ QA trình duyệt.
- `@supabase/supabase-js` 2.110.8 chỉ dùng khi rebuild bundle `alpha-sync.bundle.js`.

Không thêm các công cụ này vào runtime lockfile để tránh làm deployment phụ thuộc registry khi chỉ cần chạy ứng dụng.

## Chuẩn bị bộ QA trình duyệt

```bash
python3 -m pip install -r requirements-qa.txt
python3 -m playwright install chromium
npm run test:browser
```

Bộ chạy tự tìm `chromium`, `chromium-browser`, `google-chrome` hoặc trình duyệt do Playwright cài. Trong CI có trình duyệt riêng, đặt đường dẫn tuyệt đối:

```bash
ALPHA_CHROMIUM_EXECUTABLE=/opt/chromium/chrome npm run test:browser
```

Preflight sẽ dừng ngay với hướng dẫn cụ thể nếu thiếu gói Python hoặc tệp trình duyệt, thay vì tạo hàng loạt kết quả lỗi trùng lặp.
