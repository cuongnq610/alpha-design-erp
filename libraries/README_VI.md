# Thư viện runtime v4.5.30

Phần mềm Demo được đóng gói tự chứa và không tải thư viện từ CDN.

- `alpha-sync.bundle.js`: Supabase JavaScript client được bundle cục bộ cho kết nối Cloud.
- `calculation-core.js`: bộ máy công thức kế toán, dự án và dự báo.
- `alpha-enterprise.js`: dịch vụ runtime dùng chung.
- `runtime-libraries.json`: manifest truy vết thư viện.
- `check-libraries.mjs`: kiểm tra file bắt buộc và SHA-256.

`package-lock.json` không có package ngoài để `npm ci` có thể tái lập runtime một cách ổn định. Playwright dùng cho browser audit là công cụ của môi trường QA, không cần cài trên máy người dùng vận hành Demo.
