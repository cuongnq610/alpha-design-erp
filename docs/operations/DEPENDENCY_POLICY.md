# Dependency Policy — v4.5.30

- Node.js tối thiểu: 20; môi trường kiểm thử: Node 22.16.0.
- npm được cố định ở `npm@10.9.2` qua trường `packageManager`.
- Mọi dependency cấp cao phải dùng phiên bản chính xác, không dùng `^`, `~`, `latest` hoặc wildcard.
- `.npmrc` bắt buộc lưu phiên bản chính xác, bật package lock và audit.
- Trước khi triển khai Production trên máy build có kết nối registry tin cậy:
  1. Chạy `npm install --package-lock-only --ignore-scripts`.
  2. Đưa `package-lock.json` vào kiểm soát phiên bản.
  3. Chạy `npm run dependencies:preflight -- --require-lock`.
  4. Chạy `npm audit` và xử lý mọi mức nghiêm trọng/high trước khi phê duyệt release.

Gói phát hành có `package-lock.json` dependency-free cho runtime và một bundle Supabase chạy cục bộ (`alpha-sync.bundle.js`). Trên máy CI có registry tin cậy, vẫn phải chạy preflight và `npm audit` trước Production. Runtime không phụ thuộc CDN.
