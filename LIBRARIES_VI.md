# Thư viện và môi trường chạy — v4.5.32

## Yêu cầu runtime

- Node.js 20 trở lên để chạy server Demo và bộ kiểm thử.
- Chrome, Edge, Safari hoặc trình duyệt Android hiện hành.

## Bundle cục bộ

Ứng dụng không tải thư viện runtime từ CDN:

- `alpha-sync.bundle.js`: Supabase JavaScript client đã bundle cục bộ.
- `calculation-core.js`: công thức kế toán, dự án, hệ số và dự báo.
- `alpha-enterprise.js`: dịch vụ runtime dùng chung.
- `libraries/runtime-libraries.json`: manifest truy vết thư viện.
- `libraries/check-libraries.mjs`: kiểm tra sự hiện diện và SHA-256.

`package-lock.json` được giữ ở chế độ dependency-free để `npm ci` tái lập ổn định mà không cần tải package ngoài cho runtime. Công cụ browser audit bằng Python/Playwright là công cụ QA của môi trường build, không phải phụ thuộc cần thiết khi người dùng vận hành phần mềm.
