-- Seed the TT133 chart of accounts relevant to ALPHA DESIGN.
create or replace function app.seed_tt133_accounts(p_company uuid) returns int
language plpgsql security definer set search_path=public,app as $$
declare c int;
begin
  insert into accounts(company_id,code,name,account_type,normal_side,parent_code,postable,regime) values
  (p_company,'111','Tiền mặt','Asset','Debit',null,false,'TT133'),
  (p_company,'1111','Tiền Việt Nam','Asset','Debit','111',true,'TT133'),
  (p_company,'112','Tiền gửi ngân hàng','Asset','Debit',null,false,'TT133'),
  (p_company,'1121','Tiền Việt Nam gửi ngân hàng','Asset','Debit','112',true,'TT133'),
  (p_company,'121','Chứng khoán kinh doanh','Asset','Debit',null,true,'TT133'),
  (p_company,'128','Đầu tư nắm giữ đến ngày đáo hạn','Asset','Debit',null,true,'TT133'),
  (p_company,'131','Phải thu của khách hàng','Asset','Debit',null,true,'TT133'),
  (p_company,'133','Thuế GTGT được khấu trừ','Asset','Debit',null,false,'TT133'),
  (p_company,'1331','Thuế GTGT được khấu trừ của hàng hóa, dịch vụ','Asset','Debit','133',true,'TT133'),
  (p_company,'138','Phải thu khác','Asset','Debit',null,true,'TT133'),
  (p_company,'141','Tạm ứng','Asset','Debit',null,true,'TT133'),
  (p_company,'152','Nguyên liệu, vật liệu','Asset','Debit',null,true,'TT133'),
  (p_company,'153','Công cụ, dụng cụ','Asset','Debit',null,true,'TT133'),
  (p_company,'154','Chi phí sản xuất, kinh doanh dở dang','Asset','Debit',null,true,'TT133'),
  (p_company,'211','Tài sản cố định','Asset','Debit',null,false,'TT133'),
  (p_company,'2112','Máy móc, thiết bị','Asset','Debit','211',true,'TT133'),
  (p_company,'214','Hao mòn tài sản cố định','Asset','Credit',null,false,'TT133'),
  (p_company,'2141','Hao mòn TSCĐ hữu hình','Asset','Credit','214',true,'TT133'),
  (p_company,'228','Đầu tư góp vốn vào đơn vị khác','Asset','Debit',null,true,'TT133'),
  (p_company,'229','Dự phòng tổn thất tài sản','Asset','Credit',null,true,'TT133'),
  (p_company,'241','Xây dựng cơ bản dở dang','Asset','Debit',null,true,'TT133'),
  (p_company,'242','Chi phí trả trước','Asset','Debit',null,true,'TT133'),
  (p_company,'244','Cầm cố, thế chấp, ký quỹ, ký cược','Asset','Debit',null,true,'TT133'),
  (p_company,'331','Phải trả cho người bán','Liability','Credit',null,true,'TT133'),
  (p_company,'333','Thuế và các khoản phải nộp Nhà nước','Liability','Credit',null,false,'TT133'),
  (p_company,'33311','Thuế GTGT đầu ra','Liability','Credit','333',true,'TT133'),
  (p_company,'3334','Thuế thu nhập doanh nghiệp','Liability','Credit','333',true,'TT133'),
  (p_company,'3335','Thuế thu nhập cá nhân','Liability','Credit','333',true,'TT133'),
  (p_company,'334','Phải trả người lao động','Liability','Credit',null,true,'TT133'),
  (p_company,'335','Chi phí phải trả','Liability','Credit',null,true,'TT133'),
  (p_company,'338','Phải trả, phải nộp khác','Liability','Credit',null,false,'TT133'),
  (p_company,'3383','Bảo hiểm xã hội','Liability','Credit','338',true,'TT133'),
  (p_company,'3384','Bảo hiểm y tế','Liability','Credit','338',true,'TT133'),
  (p_company,'3386','Bảo hiểm thất nghiệp','Liability','Credit','338',true,'TT133'),
  (p_company,'341','Vay và nợ thuê tài chính','Liability','Credit',null,true,'TT133'),
  (p_company,'352','Dự phòng phải trả','Liability','Credit',null,true,'TT133'),
  (p_company,'353','Quỹ khen thưởng, phúc lợi','Liability','Credit',null,true,'TT133'),
  (p_company,'411','Vốn đầu tư của chủ sở hữu','Equity','Credit',null,false,'TT133'),
  (p_company,'4111','Vốn góp của chủ sở hữu','Equity','Credit','411',true,'TT133'),
  (p_company,'413','Chênh lệch tỷ giá hối đoái','Equity','Credit',null,true,'TT133'),
  (p_company,'418','Các quỹ thuộc vốn chủ sở hữu','Equity','Credit',null,true,'TT133'),
  (p_company,'419','Cổ phiếu quỹ','Equity','Debit',null,true,'TT133'),
  (p_company,'421','Lợi nhuận sau thuế chưa phân phối','Equity','Credit',null,false,'TT133'),
  (p_company,'4212','Lợi nhuận sau thuế chưa phân phối năm nay','Equity','Credit','421',true,'TT133'),
  (p_company,'511','Doanh thu bán hàng và cung cấp dịch vụ','Revenue','Credit',null,false,'TT133'),
  (p_company,'5113','Doanh thu cung cấp dịch vụ thiết kế','Revenue','Credit','511',true,'TT133'),
  (p_company,'515','Doanh thu hoạt động tài chính','Revenue','Credit',null,true,'TT133'),
  (p_company,'521','Các khoản giảm trừ doanh thu','Revenue','Debit',null,true,'TT133'),
  (p_company,'632','Giá vốn hàng bán và dịch vụ','Expense','Debit',null,true,'TT133'),
  (p_company,'635','Chi phí tài chính','Expense','Debit',null,true,'TT133'),
  (p_company,'642','Chi phí quản lý kinh doanh','Expense','Debit',null,false,'TT133'),
  (p_company,'6421','Chi phí bán hàng','Expense','Debit','642',true,'TT133'),
  (p_company,'6422','Chi phí quản lý doanh nghiệp','Expense','Debit','642',true,'TT133'),
  (p_company,'711','Thu nhập khác','Revenue','Credit',null,true,'TT133'),
  (p_company,'811','Chi phí khác','Expense','Debit',null,true,'TT133'),
  (p_company,'821','Chi phí thuế TNDN','Expense','Debit',null,false,'TT133'),
  (p_company,'8211','Chi phí thuế TNDN hiện hành','Expense','Debit','821',true,'TT133'),
  (p_company,'911','Xác định kết quả kinh doanh','Equity','Credit',null,true,'TT133')
  on conflict(company_id,code) do update set name=excluded.name,account_type=excluded.account_type,normal_side=excluded.normal_side,parent_code=excluded.parent_code,postable=excluded.postable,regime='TT133',active=true;
  get diagnostics c=row_count; return c;
end $$;

-- Supabase Storage policies are applied after creating a private bucket named company-files.
-- Folder convention: {company_id}/{project_id-or-general}/{uuid}/{filename}
-- Example policy expression for storage.objects:
-- bucket_id='company-files' and (storage.foldername(name))[1]::uuid=app.current_company_id()
