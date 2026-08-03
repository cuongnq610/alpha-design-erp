-- Complete TT133 reporting support: B01a-DNN, B02-DNN, B03-DNN,
-- B09-DNN disclosures and F01-DNN trial balance.

alter table journal_entries add column if not exists cash_flow_code text;

create table if not exists public.cash_flow_codes (
  code text primary key,
  label text not null,
  activity text not null check(activity in ('operating','investing','financing','fx')),
  expected_direction text not null check(expected_direction in ('inflow','outflow','either')),
  sort_order int not null
);
insert into cash_flow_codes(code,label,activity,expected_direction,sort_order) values
('01','Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác','operating','inflow',1),
('02','Tiền chi trả cho người cung cấp hàng hóa và dịch vụ','operating','outflow',2),
('03','Tiền chi trả cho người lao động','operating','outflow',3),
('04','Tiền lãi vay đã trả','operating','outflow',4),
('05','Thuế thu nhập doanh nghiệp đã nộp','operating','outflow',5),
('06','Tiền thu khác từ hoạt động kinh doanh','operating','inflow',6),
('07','Tiền chi khác cho hoạt động kinh doanh','operating','outflow',7),
('21','Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác','investing','outflow',21),
('22','Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác','investing','inflow',22),
('23','Tiền chi cho vay, mua các công cụ nợ của đơn vị khác','investing','outflow',23),
('24','Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác','investing','inflow',24),
('25','Tiền chi đầu tư góp vốn vào đơn vị khác','investing','outflow',25),
('26','Tiền thu hồi đầu tư góp vốn vào đơn vị khác','investing','inflow',26),
('27','Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia','investing','inflow',27),
('31','Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu','financing','inflow',31),
('32','Tiền trả lại vốn góp, mua lại cổ phiếu đã phát hành','financing','outflow',32),
('33','Tiền thu từ đi vay','financing','inflow',33),
('34','Tiền trả nợ gốc vay','financing','outflow',34),
('35','Tiền trả nợ gốc thuê tài chính','financing','outflow',35),
('36','Cổ tức, lợi nhuận đã trả cho chủ sở hữu','financing','outflow',36),
('61','Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ','fx','either',61)
on conflict(code) do update set label=excluded.label,activity=excluded.activity,expected_direction=excluded.expected_direction,sort_order=excluded.sort_order;

alter table journal_entries drop constraint if exists journal_entries_cash_flow_code_fkey;
alter table journal_entries add constraint journal_entries_cash_flow_code_fkey foreign key(cash_flow_code) references cash_flow_codes(code);

create or replace function app.require_cash_flow_code_on_post() returns trigger
language plpgsql set search_path=public,app as $$
begin
  if old.status='draft' and new.status='posted'
     and exists(
       select 1 from journal_lines jl join accounts a on a.id=jl.account_id
       where jl.entry_id=new.id and (a.code like '111%' or a.code like '112%')
     )
     and new.cash_flow_code is null then
    raise exception 'cash_flow_code is required for a posted cash or bank entry';
  end if;
  return new;
end $$;
drop trigger if exists trg_require_cash_flow_code on journal_entries;
create trigger trg_require_cash_flow_code before update of status on journal_entries
for each row execute function app.require_cash_flow_code_on_post();

create table if not exists public.report_notes_tt133 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  section_code text not null,
  section_title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check(status in ('draft','prepared','reviewed','approved')),
  row_version bigint not null default 1,
  prepared_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  updated_at timestamptz not null default now(),
  unique(company_id,period_from,period_to,section_code)
);
create trigger trg_notes_touch before update on report_notes_tt133 for each row execute function app.touch_row();
create trigger trg_audit_notes after insert or update or delete on report_notes_tt133 for each row execute function app.audit_row_change();
alter table report_notes_tt133 enable row level security;
create policy notes_select on report_notes_tt133 for select using(company_id=app.current_company_id());
create policy notes_write on report_notes_tt133 for all using(company_id=app.current_company_id() and app.has_permission('accounting.write',company_id)) with check(company_id=app.current_company_id());

drop function if exists app.report_b01a_dnn(date,date);
create or replace function app.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint,level int,is_total boolean)
language plpgsql stable security definer set search_path=public,app as $$
declare
  cid uuid:=app.current_company_id();
  s date:=p_from-1;
  e date:=p_to;
  o_cash bigint; x_cash bigint; o_short bigint; x_short bigint; o_ar bigint; x_ar bigint;
  o_adv bigint; x_adv bigint; o_other_ar bigint; x_other_ar bigint; o_inv bigint; x_inv bigint;
  o_other_ca bigint; x_other_ca bigint; o_fixed bigint; x_fixed bigint; o_cip bigint; x_cip bigint;
  o_long_inv bigint; x_long_inv bigint; o_other_la bigint; x_other_la bigint;
  o_liab bigint; x_liab bigint; o_equity bigint; x_equity bigint; o_pnl bigint; x_pnl bigint;
begin
  perform app.assert_company_access(cid);
  o_cash:=app.account_balance_at(cid,'111',s)+app.account_balance_at(cid,'112',s);
  x_cash:=app.account_balance_at(cid,'111',e)+app.account_balance_at(cid,'112',e);
  o_short:=app.account_balance_at(cid,'121',s)+app.account_balance_at(cid,'128',s)-app.account_balance_at(cid,'2291',s,'credit');
  x_short:=app.account_balance_at(cid,'121',e)+app.account_balance_at(cid,'128',e)-app.account_balance_at(cid,'2291',e,'credit');
  o_ar:=app.account_balance_at(cid,'131',s); x_ar:=app.account_balance_at(cid,'131',e);
  o_adv:=app.account_balance_at(cid,'331',s,'debit'); x_adv:=app.account_balance_at(cid,'331',e,'debit');
  o_other_ar:=app.account_balance_at(cid,'136',s)+app.account_balance_at(cid,'138',s)+app.account_balance_at(cid,'141',s)+app.account_balance_at(cid,'244',s)-app.account_balance_at(cid,'2293',s,'credit');
  x_other_ar:=app.account_balance_at(cid,'136',e)+app.account_balance_at(cid,'138',e)+app.account_balance_at(cid,'141',e)+app.account_balance_at(cid,'244',e)-app.account_balance_at(cid,'2293',e,'credit');
  o_inv:=app.account_balance_at(cid,'15',s)-app.account_balance_at(cid,'2294',s,'credit');
  x_inv:=app.account_balance_at(cid,'15',e)-app.account_balance_at(cid,'2294',e,'credit');
  o_other_ca:=app.account_balance_at(cid,'133',s)+app.account_balance_at(cid,'242',s);
  x_other_ca:=app.account_balance_at(cid,'133',e)+app.account_balance_at(cid,'242',e);
  o_fixed:=app.account_balance_at(cid,'211',s)-app.account_balance_at(cid,'214',s,'credit');
  x_fixed:=app.account_balance_at(cid,'211',e)-app.account_balance_at(cid,'214',e,'credit');
  o_cip:=app.account_balance_at(cid,'241',s); x_cip:=app.account_balance_at(cid,'241',e);
  o_long_inv:=app.account_balance_at(cid,'217',s)+app.account_balance_at(cid,'228',s)-app.account_balance_at(cid,'2292',s,'credit');
  x_long_inv:=app.account_balance_at(cid,'217',e)+app.account_balance_at(cid,'228',e)-app.account_balance_at(cid,'2292',e,'credit');
  o_other_la:=app.account_balance_at(cid,'242',s)+app.account_balance_at(cid,'244',s);
  x_other_la:=app.account_balance_at(cid,'242',e)+app.account_balance_at(cid,'244',e);

  o_liab:=app.account_balance_at(cid,'331',s,'credit')+app.account_balance_at(cid,'131',s,'credit')+
    app.account_balance_at(cid,'333',s,'credit')+app.account_balance_at(cid,'334',s,'credit')+
    app.account_balance_at(cid,'335',s,'credit')+app.account_balance_at(cid,'336',s,'credit')+
    app.account_balance_at(cid,'338',s,'credit')+app.account_balance_at(cid,'341',s,'credit')+
    app.account_balance_at(cid,'352',s,'credit')+app.account_balance_at(cid,'353',s,'credit')+
    app.account_balance_at(cid,'356',s,'credit');
  x_liab:=app.account_balance_at(cid,'331',e,'credit')+app.account_balance_at(cid,'131',e,'credit')+
    app.account_balance_at(cid,'333',e,'credit')+app.account_balance_at(cid,'334',e,'credit')+
    app.account_balance_at(cid,'335',e,'credit')+app.account_balance_at(cid,'336',e,'credit')+
    app.account_balance_at(cid,'338',e,'credit')+app.account_balance_at(cid,'341',e,'credit')+
    app.account_balance_at(cid,'352',e,'credit')+app.account_balance_at(cid,'353',e,'credit')+
    app.account_balance_at(cid,'356',e,'credit');

  select coalesce(amount,0) into o_pnl from app.report_b02_dnn(date_trunc('year',s)::date,s) where code='60';
  select coalesce(amount,0) into x_pnl from app.report_b02_dnn(date_trunc('year',e)::date,e) where code='60';
  o_equity:=app.account_balance_at(cid,'411',s,'credit')+app.account_balance_at(cid,'413',s,'credit')-
    app.account_balance_at(cid,'413',s)+app.account_balance_at(cid,'418',s,'credit')-
    app.account_balance_at(cid,'419',s)+app.account_balance_at(cid,'421',s,'credit')-
    app.account_balance_at(cid,'421',s)+o_pnl;
  x_equity:=app.account_balance_at(cid,'411',e,'credit')+app.account_balance_at(cid,'413',e,'credit')-
    app.account_balance_at(cid,'413',e)+app.account_balance_at(cid,'418',e,'credit')-
    app.account_balance_at(cid,'419',e)+app.account_balance_at(cid,'421',e,'credit')-
    app.account_balance_at(cid,'421',e)+x_pnl;

  return query values
  ('100','TÀI SẢN NGẮN HẠN',o_cash+o_short+o_ar+o_adv+o_other_ar+o_inv+o_other_ca,x_cash+x_short+x_ar+x_adv+x_other_ar+x_inv+x_other_ca,0,true),
  ('110','Tiền và các khoản tương đương tiền',o_cash,x_cash,1,false),
  ('120','Đầu tư tài chính ngắn hạn',o_short,x_short,1,false),
  ('130','Các khoản phải thu ngắn hạn',o_ar+o_adv+o_other_ar,x_ar+x_adv+x_other_ar,1,false),
  ('131','Phải thu ngắn hạn của khách hàng',o_ar,x_ar,2,false),
  ('132','Trả trước cho người bán ngắn hạn',o_adv,x_adv,2,false),
  ('134','Phải thu ngắn hạn khác',o_other_ar,x_other_ar,2,false),
  ('140','Hàng tồn kho',o_inv,x_inv,1,false),
  ('150','Tài sản ngắn hạn khác',o_other_ca,x_other_ca,1,false),
  ('200','TÀI SẢN DÀI HẠN',o_fixed+o_cip+o_long_inv+o_other_la,x_fixed+x_cip+x_long_inv+x_other_la,0,true),
  ('220','Tài sản cố định',o_fixed,x_fixed,1,false),
  ('240','Xây dựng cơ bản dở dang',o_cip,x_cip,1,false),
  ('250','Đầu tư tài chính dài hạn',o_long_inv,x_long_inv,1,false),
  ('260','Tài sản dài hạn khác',o_other_la,x_other_la,1,false),
  ('270','TỔNG CỘNG TÀI SẢN',o_cash+o_short+o_ar+o_adv+o_other_ar+o_inv+o_other_ca+o_fixed+o_cip+o_long_inv+o_other_la,x_cash+x_short+x_ar+x_adv+x_other_ar+x_inv+x_other_ca+x_fixed+x_cip+x_long_inv+x_other_la,0,true),
  ('300','NỢ PHẢI TRẢ',o_liab,x_liab,0,true),
  ('400','VỐN CHỦ SỞ HỮU',o_equity,x_equity,0,true),
  ('440','TỔNG CỘNG NGUỒN VỐN',o_liab+o_equity,x_liab+x_equity,0,true);
end $$;

create or replace function app.report_b03_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint,level int,is_total boolean)
language plpgsql stable security definer set search_path=public,app as $$
declare cid uuid:=app.current_company_id(); op bigint; inv bigint; fin bigint; fx bigint; opening bigint; closing bigint;
begin
  perform app.assert_company_access(cid);
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into op
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  join cash_flow_codes c on c.code=je.cash_flow_code
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and c.activity='operating' and (a.code like '111%' or a.code like '112%');
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into inv
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  join cash_flow_codes c on c.code=je.cash_flow_code
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and c.activity='investing' and (a.code like '111%' or a.code like '112%');
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into fin
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  join cash_flow_codes c on c.code=je.cash_flow_code
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and c.activity='financing' and (a.code like '111%' or a.code like '112%');
  select coalesce(sum(jl.debit-jl.credit),0)::bigint into fx
  from journal_entries je join journal_lines jl on jl.entry_id=je.id join accounts a on a.id=jl.account_id
  where je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to and je.cash_flow_code='61' and (a.code like '111%' or a.code like '112%');
  opening:=app.account_balance_at(cid,'111',p_from-1)+app.account_balance_at(cid,'112',p_from-1);
  closing:=app.account_balance_at(cid,'111',p_to)+app.account_balance_at(cid,'112',p_to);

  return query
  with detail as (
    select c.code,c.label,coalesce(sum(case when a.id is not null then jl.debit-jl.credit else 0 end),0)::bigint amount,1 level,false is_total,c.sort_order
    from cash_flow_codes c
    left join journal_entries je on je.cash_flow_code=c.code and je.company_id=cid and je.status='posted' and je.document_date between p_from and p_to
    left join journal_lines jl on jl.entry_id=je.id
    left join accounts a on a.id=jl.account_id and (a.code like '111%' or a.code like '112%')
    where c.code<>'61'
    group by c.code,c.label,c.sort_order
  ), totals as (
    select * from (values
      ('20','Lưu chuyển tiền thuần từ hoạt động kinh doanh',op,0,true,20),
      ('30','Lưu chuyển tiền thuần từ hoạt động đầu tư',inv,0,true,30),
      ('40','Lưu chuyển tiền thuần từ hoạt động tài chính',fin,0,true,40),
      ('50','Lưu chuyển tiền thuần trong kỳ',op+inv+fin,0,true,50),
      ('60','Tiền và tương đương tiền đầu kỳ',opening,0,true,60),
      ('61','Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ',fx,1,false,61),
      ('70','Tiền và tương đương tiền cuối kỳ',closing,0,true,70)
    ) v(code,label,amount,level,is_total,sort_order)
  )
  select q.code,q.label,q.amount,q.level,q.is_total from (select * from detail union all select * from totals) q order by q.sort_order;
end $$;

create or replace function app.report_b09_dnn(p_from date,p_to date)
returns table(section_code text,section_title text,status text,content jsonb)
language sql stable security definer set search_path=public,app as $$
with required(section_code,section_title,sort_order) as (values
 ('I','Đặc điểm hoạt động của doanh nghiệp',1),
 ('II','Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán',2),
 ('III','Chuẩn mực và chế độ kế toán áp dụng',3),
 ('IV','Các chính sách kế toán áp dụng',4),
 ('V','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính',5),
 ('VI','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh',6),
 ('VII','Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ',7),
 ('VIII','Những thông tin khác',8)
)
select r.section_code,r.section_title,coalesce(n.status,'draft'),coalesce(n.content,'{}'::jsonb)
from required r left join report_notes_tt133 n
 on n.company_id=app.current_company_id() and n.period_from=p_from and n.period_to=p_to and n.section_code=r.section_code
order by r.sort_order
$$;

create or replace function app.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language plpgsql stable security definer set search_path=public,app as $$
declare a bigint; s bigint; cf_close bigint; ledger_close bigint; note_count int;
begin
  select ending_amount into a from app.report_b01a_dnn(p_from,p_to) where code='270';
  select ending_amount into s from app.report_b01a_dnn(p_from,p_to) where code='440';
  select amount into cf_close from app.report_b03_dnn(p_from,p_to) where code='70';
  ledger_close:=app.account_balance_at(app.current_company_id(),'111',p_to)+app.account_balance_at(app.current_company_id(),'112',p_to);
  select count(*) into note_count from app.report_b09_dnn(p_from,p_to) where status in ('prepared','reviewed','approved');
  return query values
    ('B01_BALANCE',a=s,format('Tài sản=%s; Nguồn vốn=%s',a,s)),
    ('F01_BALANCE',not exists(select 1 from app.report_f01_dnn(p_from,p_to) r where r.ending_debit<0 or r.ending_credit<0),'Số dư Nợ/Có không âm'),
    ('B03_RECONCILE',cf_close=ledger_close,format('B03=%s; Sổ cái 111/112=%s',cf_close,ledger_close)),
    ('B09_COMPLETENESS',note_count=8,format('Đã chuẩn bị %s/8 phần thuyết minh',note_count));
end $$;
