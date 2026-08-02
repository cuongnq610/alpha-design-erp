# Triển khai ALPHA DESIGN ERP v4.5.30 trên Mắt Bão + Supabase

## 0. Kiểm tra dịch vụ Mắt Bão

Trong cPanel phải có **Setup Node.js App/Nodejs setup App** và chọn được Node.js 20 hoặc 22 LTS. Nếu không có, hoặc chỉ có Node <20, không triển khai Production trên gói đó; cần nâng cấp Hosting Linux Premium có Node.js hoặc dùng Cloud Server/VPS.

## 1. Supabase Staging

1. Tạo project Staging tại khu vực gần Việt Nam/Singapore.
2. Lấy Project URL, Publishable key và Secret key. Secret key chỉ lưu server.
3. Khởi tạo database theo một trong hai cách:
   - Dashboard: SQL Editor → chạy `SUPABASE_PRODUCTION_SCHEMA.sql` đúng một lần trên project mới.
   - CLI: đặt `SUPABASE_PROJECT_REF` rồi chạy `bash scripts/deploy-new-supabase-project.sh`.
4. Storage: xác nhận bucket `company-files` là private.
5. Realtime: xác nhận bảng `entity_records` thuộc `supabase_realtime`.
6. Auth: tắt public signup; bật email confirmation; cấu hình SMTP thật.
7. URL Configuration:
   - Site URL: `https://staging-erp.alphadesign.vn`
   - Redirect URL: `https://staging-erp.alphadesign.vn/**`
8. Tạo Auth user Giám đốc, sau đó chạy `deployment/BOOTSTRAP_FIRST_DIRECTOR.sql`.
9. Điền Company ID nhận được vào `ALPHA_COMPANY_ID` trên Mắt Bão.
10. Đặt Edge Function secrets `ALLOWED_ORIGINS` và `SITE_URL`, sau đó deploy `invite-user`.

## 2. Mắt Bão cPanel

1. Trỏ subdomain `staging-erp` về IP Hosting trước.
2. cPanel → Setup Node.js App → Create Application.
3. Chọn:
   - Node.js: 20/22 LTS
   - Application mode: Production
   - Application root: thư mục ngoài `public_html`, ví dụ `alpha-erp-staging`
   - Application URL: `staging-erp.alphadesign.vn`
   - Startup file: `passenger.cjs`
4. Upload toàn bộ nội dung thư mục ứng dụng vào Application root.
5. Trong Terminal của Node App:

```bash
npm ci
npm run build
cp .env.matbao.example .env.production.local
chmod 600 .env.production.local
```

6. Mở `.env.production.local` trong File Manager và tự điền secret; không gửi secret cho người khác.
7. Chạy:

```bash
node scripts/preflight-matbao.mjs
```

8. Restart Application trong cPanel.
9. cPanel → SSL/TLS Status → Run AutoSSL. Bật chuyển HTTP sang HTTPS.
10. Kiểm tra:

```bash
APP_URL=https://staging-erp.alphadesign.vn node scripts/verify-remote-deployment.mjs
```

## 3. Kiểm tra Supabase từ server

```bash
set -a
. ./.env.production.local
set +a
node scripts/verify-supabase-project.mjs
```

Sau đó chạy `deployment/POST_DEPLOY_AUDIT.sql` trong SQL Editor bằng UUID thật.

## 4. UAT và Production

- Thực hiện `deployment/UAT_MULTI_DEVICE_CHECKLIST.csv`.
- Diễn tập backup/restore bằng `scripts/backup.sh` và `scripts/restore-verify.sh` trên database thử nghiệm riêng.
- Chỉ mở Production khi hoàn thành `deployment/PRODUCTION_CUTOVER_CHECKLIST.md`.
- Tạo Supabase Production và Node App Production riêng; không sao chép secret Staging sang Production.

## 5. Trường hợp Mắt Bão dùng Plesk

Trong **Websites & Domains → Node.js**:

- Node version: 20/22 LTS.
- Application mode: Production.
- Application root: thư mục chứa `package.json`.
- Document root: `public` nếu Plesk yêu cầu document root; ứng dụng vẫn phải được khởi động bằng Node proxy.
- Application startup file: `passenger.cjs`.
- Chạy `npm ci`, `npm run build`, `npm run deploy:preflight`, sau đó **Restart App**.
- Trong Hosting Settings, bật chuyển hướng 301 từ HTTP sang HTTPS và chọn chứng chỉ hợp lệ.

Nếu Plesk không cho đặt startup file `.cjs`, tạo một file `passenger.js` có nội dung `require('./passenger.cjs')` và chọn `passenger.js`; không sửa `app.js` vì đó là mã giao diện của ERP.
