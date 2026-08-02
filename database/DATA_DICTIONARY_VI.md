# TỪ ĐIỂN DỮ LIỆU – ALPHA DESIGN ERP CLOUD v4.5.30

## Quy ước chung

| Trường | Ý nghĩa |
|---|---|
| `id` | UUID khóa chính |
| `company_id` | Công ty sở hữu dữ liệu; cơ sở của RLS |
| `row_version` | Phiên bản tăng sau mỗi lần sửa, dùng chống ghi đè |
| `created_at`, `updated_at` | Thời gian máy chủ |
| Giá trị tiền | `bigint`, đơn vị VND |
| Trạng thái | Dùng `check constraint`, không cho giá trị ngoài quy trình |

## Tenant và bảo mật

| Bảng | Mục đích | Khóa/quan hệ chính |
|---|---|---|
| `companies` | Thông tin pháp nhân và chế độ kế toán | `id`, `accounting_regime` |
| `branches` | Chi nhánh/trụ sở | FK `company_id` |
| `profiles` | Hồ sơ người dùng Supabase Auth | PK `user_id` |
| `memberships` | Người dùng thuộc công ty | PK `company_id,user_id` |
| `roles` | Vai trò theo công ty | FK `company_id` |
| `permissions` | Danh mục quyền chuẩn | PK `code` |
| `role_permissions` | Quyền của vai trò | PK `role_id,permission_code` |
| `membership_roles` | Cho phép một người có nhiều vai trò | PK `company_id,user_id,role_id` |

## Cơ cấu tổ chức và nhân sự

| Bảng | Mục đích | Trường đáng chú ý |
|---|---|---|
| `departments` | Phòng/khối và cây tổ chức | `parent_id`, `branch_id` |
| `cost_centers` | Trung tâm chi phí | `department_id` |
| `disciplines` | Kiến trúc, Kết cấu, MEP, Nội thất… | `code`, `sort_order` |
| `employees` | Nhân viên và CTV | `employment_type`, `hourly_cost`, `billing_rate` |
| `payroll_periods` | Kỳ tính lương | `status`, `journal_entry_id` |
| `payroll_items` | Chi tiết lương theo người | `net_salary`, `total_employer_cost` |

## CRM và hợp đồng

| Bảng | Mục đích | Trường đáng chú ý |
|---|---|---|
| `clients` | Khách hàng | `code`, `tax_code` |
| `vendors` | Nhà cung cấp/CTV | `vendor_type` |
| `contacts` | Người liên hệ | Chỉ thuộc một `client` hoặc `vendor` |
| `contracts` | Hợp đồng khách hàng, NCC, CTV | `value_excl_vat`, `vat_amount`, `total_value` |
| `contract_milestones` | Giai đoạn nghiệm thu/thanh toán | `percentage`, `payment_status` |

## Dự án và công việc

| Bảng | Mục đích | Trường đáng chú ý |
|---|---|---|
| `projects` | Hồ sơ dự án | `contract_value`, `direct_budget` |
| `project_stages` | Concept, TKCS, TKKT, TKTC… | `budget_hours`, `budget_cost`, `progress_percent` |
| `project_assignments` | Phân bổ nhân sự vào dự án | `allocation_percent` |
| `tasks` | Công việc và cấu trúc cha-con | `parent_id`, `planned_hours`, `status` |
| `task_assignments` | Người thực hiện/duyệt/theo dõi | `assignment_role` |
| `timesheets` | Giờ làm và giờ billable | `hours`, `billable_hours`, `cost_amount`, `recoverable_revenue` |

## Kế toán TT133

| Bảng | Mục đích | Kiểm soát |
|---|---|---|
| `accounting_periods` | Kỳ kế toán | `open`, `soft_locked`, `hard_locked` |
| `accounts` | Hệ thống tài khoản | `normal_side`, `postable`, `regime` |
| `opening_balances` | Số dư đầu năm | Duy nhất theo tài khoản và chiều phân tích |
| `journal_entries` | Đầu chứng từ | `document_no`, `status`, `posting_hash` |
| `journal_lines` | Định khoản Nợ/Có | Mỗi dòng chỉ có Nợ hoặc Có; gắn dự án, bộ phận, đối tượng |
| `report_snapshots` | Bản đóng băng báo cáo | `data_hash`, trạng thái ký duyệt |

## Công nợ và thanh toán

| Bảng | Mục đích | Trường đáng chú ý |
|---|---|---|
| `subledger_documents` | Khoản phải thu/phải trả | `original_amount`, `due_date` |
| `payments` | Phiếu thu/chi | `direction`, `amount`, `journal_entry_id` |
| `payment_allocations` | Phân bổ thanh toán vào công nợ | Không được vượt tiền thanh toán hoặc chứng từ gốc |
| `v_subledger_outstanding` | View số tiền còn lại | Tính `outstanding_amount` và trạng thái thực tế |

## Ngân hàng, tài sản và chi phí trả trước

| Bảng | Mục đích |
|---|---|
| `bank_accounts` | Tài khoản ngân hàng và tài khoản sổ cái liên kết |
| `bank_transactions` | Giao dịch nhập từ ngân hàng |
| `bank_reconciliations` | Đối chiếu số dư sổ sách và sao kê |
| `fixed_assets` | Nguyên giá, thời gian sử dụng, tài khoản hạch toán |
| `fixed_asset_depreciation` | Khấu hao theo kỳ |
| `prepaid_expenses` | Chi phí trả trước |
| `prepaid_allocations` | Phân bổ chi phí trả trước theo kỳ |

## Thuế

| Bảng | Mục đích |
|---|---|
| `tax_invoices` | Hóa đơn đầu vào/đầu ra và VAT |
| `tax_rules` | Quy tắc thuế có ngày hiệu lực và phiên bản |
| `tax_declarations` | Tờ khai theo kỳ |
| `tax_declaration_lines` | Chỉ tiêu tờ khai và nguồn số liệu |
| `tax_payments` | Các lần nộp thuế |

## Mua hàng

| Bảng | Mục đích |
|---|---|
| `purchase_requests` | Đề nghị mua hàng/chi phí |
| `purchase_orders` | Đơn mua hàng |
| `purchase_order_lines` | Dòng hàng hóa/dịch vụ, VAT và trung tâm chi phí |
| `expense_claims` | Đề nghị hoàn ứng/thanh toán chi phí |

## Hồ sơ, đồng bộ và audit

| Bảng | Mục đích |
|---|---|
| `files_metadata` | Metadata file, phân loại bảo mật, SHA-256 |
| `document_versions` | Lịch sử phiên bản file |
| `notifications` | Thông báo theo người dùng |
| `integration_connections` | Trạng thái tích hợp dịch vụ ngoài |
| `idempotency_keys` | Chống gửi lại yêu cầu trùng |
| `outbox_events` | Hàng đợi sự kiện transaction |
| `device_registrations` | Thiết bị đã đăng nhập |
| `sync_checkpoints` | Mốc đồng bộ theo thiết bị |
| `audit_events` | Nhật ký append-only, hash chain |

## View quản trị

| View | Nội dung |
|---|---|
| `v_project_financials` | Doanh thu, chi phí, lợi nhuận và utilization theo dự án |
| `v_payroll_summary` | Tổng hợp quỹ lương theo kỳ |
| `v_subledger_outstanding` | Công nợ còn lại và quá hạn |
| `v_files_latest` | Phiên bản file mới nhất |
