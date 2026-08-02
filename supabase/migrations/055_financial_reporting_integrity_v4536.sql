-- ALPHA DESIGN ERP Cloud v4.5.36
-- Financial reporting integrity, TT133 classification and cash-flow posting controls.

alter table public.accounts add column if not exists balance_sheet_class text;
alter table public.accounts drop constraint if exists accounts_balance_sheet_class_check;
alter table public.accounts add constraint accounts_balance_sheet_class_check
  check (balance_sheet_class is null or balance_sheet_class in ('current_other_asset','noncurrent_other_asset'));

update public.accounts
set balance_sheet_class='noncurrent_other_asset'
where balance_sheet_class is null and (code like '242%' or code like '244%');

alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists report_unit text not null default 'VND';
alter table public.companies add column if not exists accounting_regime_effective_date date;

create or replace function app.account_code_balance_at(
  p_company uuid,p_code text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company and a.code=p_code
$$;

create or replace function app.account_balance_at_excluding(
  p_company uuid,p_prefix text,p_exclude_prefix text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company and a.code like p_prefix||'%' and a.code not like p_exclude_prefix||'%'
$$;

create or replace function app.account_balance_by_class_at(
  p_company uuid,p_class text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company and a.balance_sheet_class=p_class
$$;

create or replace function app.account_balance_by_prefix_not_class_at(
  p_company uuid,p_prefixes text[],p_excluded_class text,p_to date,p_side text default 'debit'
) returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when lower(p_side)='credit' then b.ending_credit else b.ending_debit end),0)::bigint
from accounts a
cross join lateral app.account_exact_balance_at(p_company,a.id,p_to) b
where a.company_id=p_company
  and exists(select 1 from unnest(p_prefixes) p where a.code like p||'%')
  and coalesce(a.balance_sheet_class,'')<>p_excluded_class
$$;

create or replace function app.require_cash_flow_code_on_post() returns trigger
language plpgsql set search_path=public,app as $$
declare
  cash_net bigint:=0;
  expected text;
begin
  if new.status='posted' and old.status is distinct from 'posted' then
    select coalesce(sum(jl.debit-jl.credit),0)::bigint into cash_net
    from journal_lines jl join accounts a on a.id=jl.account_id
    where jl.entry_id=new.id and (a.code like '111%' or a.code like '112%');

    if cash_net<>0 then
      if nullif(trim(new.cash_flow_code),'') is null then
        raise exception 'cash_flow_code is required for a posted cash or bank entry';
      end if;
      select c.expected_direction into expected from cash_flow_codes c where c.code=new.cash_flow_code;
      if expected is null then
        raise exception 'Unknown cash_flow_code %',new.cash_flow_code;
      end if;
      if expected='inflow' and cash_net<=0 then
        raise exception 'cash_flow_code % expects inflow but cash movement is outflow',new.cash_flow_code;
      elsif expected='outflow' and cash_net>=0 then
        raise exception 'cash_flow_code % expects outflow but cash movement is inflow',new.cash_flow_code;
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_require_cash_flow_code on journal_entries;
create trigger trg_require_cash_flow_code before update of status on journal_entries
for each row execute function app.require_cash_flow_code_on_post();

create or replace function app.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint,level int,is_total boolean)
language plpgsql stable security definer set search_path=public,app as $$
declare
  cid uuid:=app.current_company_id();
  s date; e date:=p_to; fy date;
  o_cash bigint; x_cash bigint; o_short bigint; x_short bigint; o_ar bigint; x_ar bigint;
  o_adv bigint; x_adv bigint; o_other_ar bigint; x_other_ar bigint; o_inv bigint; x_inv bigint;
  o_other_ca bigint; x_other_ca bigint; o_fixed_gross bigint; x_fixed_gross bigint;
  o_fixed_dep bigint; x_fixed_dep bigint; o_fixed bigint; x_fixed bigint;
  o_ip_gross bigint; x_ip_gross bigint; o_ip_dep bigint; x_ip_dep bigint; o_ip bigint; x_ip bigint;
  o_cip bigint; x_cip bigint; o_long_inv bigint; x_long_inv bigint; o_other_la bigint; x_other_la bigint;
  o_trade bigint; x_trade bigint; o_customer_adv bigint; x_customer_adv bigint; o_tax bigint; x_tax bigint;
  o_employee bigint; x_employee bigint; o_other_pay bigint; x_other_pay bigint; o_loans bigint; x_loans bigint;
  o_provisions bigint; x_provisions bigint; o_funds bigint; x_funds bigint; o_liab bigint; x_liab bigint;
  o_contributed bigint; x_contributed bigint; o_premium bigint; x_premium bigint; o_other_capital bigint; x_other_capital bigint;
  o_treasury bigint; x_treasury bigint; o_fx bigint; x_fx bigint; o_owner_funds bigint; x_owner_funds bigint;
  o_retained bigint; x_retained bigint; x_pnl bigint:=0; o_equity bigint; x_equity bigint;
begin
  perform app.assert_company_access(cid);
  fy:=app.fiscal_year_start_date(cid,e);
  s:=fy-1;

  o_cash:=app.account_balance_at(cid,'111',s)+app.account_balance_at(cid,'112',s);
  x_cash:=app.account_balance_at(cid,'111',e)+app.account_balance_at(cid,'112',e);
  o_short:=app.account_balance_at(cid,'121',s)+app.account_balance_at(cid,'128',s)-app.account_balance_at(cid,'2291',s,'credit');
  x_short:=app.account_balance_at(cid,'121',e)+app.account_balance_at(cid,'128',e)-app.account_balance_at(cid,'2291',e,'credit');
  o_ar:=app.account_balance_at(cid,'131',s); x_ar:=app.account_balance_at(cid,'131',e);
  o_adv:=app.account_balance_at(cid,'331',s,'debit'); x_adv:=app.account_balance_at(cid,'331',e,'debit');
  o_other_ar:=app.account_balance_at(cid,'136',s)+app.account_balance_at(cid,'138',s)+app.account_balance_at(cid,'141',s)-app.account_balance_at(cid,'2293',s,'credit');
  x_other_ar:=app.account_balance_at(cid,'136',e)+app.account_balance_at(cid,'138',e)+app.account_balance_at(cid,'141',e)-app.account_balance_at(cid,'2293',e,'credit');
  o_inv:=app.account_balance_at(cid,'15',s)-app.account_balance_at(cid,'2294',s,'credit');
  x_inv:=app.account_balance_at(cid,'15',e)-app.account_balance_at(cid,'2294',e,'credit');
  o_other_ca:=app.account_balance_at(cid,'133',s)+app.account_balance_by_class_at(cid,'current_other_asset',s);
  x_other_ca:=app.account_balance_at(cid,'133',e)+app.account_balance_by_class_at(cid,'current_other_asset',e);

  o_fixed_gross:=app.account_balance_at(cid,'211',s)+app.account_balance_at(cid,'213',s);
  x_fixed_gross:=app.account_balance_at(cid,'211',e)+app.account_balance_at(cid,'213',e);
  o_fixed_dep:=-app.account_balance_at_excluding(cid,'214','2147',s,'credit');
  x_fixed_dep:=-app.account_balance_at_excluding(cid,'214','2147',e,'credit');
  o_fixed:=o_fixed_gross+o_fixed_dep; x_fixed:=x_fixed_gross+x_fixed_dep;
  o_ip_gross:=app.account_balance_at(cid,'217',s); x_ip_gross:=app.account_balance_at(cid,'217',e);
  o_ip_dep:=-app.account_balance_at(cid,'2147',s,'credit'); x_ip_dep:=-app.account_balance_at(cid,'2147',e,'credit');
  o_ip:=o_ip_gross+o_ip_dep; x_ip:=x_ip_gross+x_ip_dep;
  o_cip:=app.account_balance_at(cid,'241',s); x_cip:=app.account_balance_at(cid,'241',e);
  o_long_inv:=app.account_balance_at(cid,'228',s)-app.account_balance_at(cid,'2292',s,'credit');
  x_long_inv:=app.account_balance_at(cid,'228',e)-app.account_balance_at(cid,'2292',e,'credit');
  o_other_la:=app.account_balance_by_prefix_not_class_at(cid,array['242','244'],'current_other_asset',s);
  x_other_la:=app.account_balance_by_prefix_not_class_at(cid,array['242','244'],'current_other_asset',e);

  o_trade:=app.account_balance_at(cid,'331',s,'credit'); x_trade:=app.account_balance_at(cid,'331',e,'credit');
  o_customer_adv:=app.account_balance_at(cid,'131',s,'credit'); x_customer_adv:=app.account_balance_at(cid,'131',e,'credit');
  o_tax:=app.account_balance_at(cid,'333',s,'credit'); x_tax:=app.account_balance_at(cid,'333',e,'credit');
  o_employee:=app.account_balance_at(cid,'334',s,'credit'); x_employee:=app.account_balance_at(cid,'334',e,'credit');
  o_other_pay:=app.account_balance_at(cid,'335',s,'credit')+app.account_balance_at(cid,'336',s,'credit')+app.account_balance_at(cid,'338',s,'credit');
  x_other_pay:=app.account_balance_at(cid,'335',e,'credit')+app.account_balance_at(cid,'336',e,'credit')+app.account_balance_at(cid,'338',e,'credit');
  o_loans:=app.account_balance_at(cid,'341',s,'credit'); x_loans:=app.account_balance_at(cid,'341',e,'credit');
  o_provisions:=app.account_balance_at(cid,'352',s,'credit'); x_provisions:=app.account_balance_at(cid,'352',e,'credit');
  o_funds:=app.account_balance_at(cid,'353',s,'credit')+app.account_balance_at(cid,'356',s,'credit');
  x_funds:=app.account_balance_at(cid,'353',e,'credit')+app.account_balance_at(cid,'356',e,'credit');
  o_liab:=o_trade+o_customer_adv+o_tax+o_employee+o_other_pay+o_loans+o_provisions+o_funds;
  x_liab:=x_trade+x_customer_adv+x_tax+x_employee+x_other_pay+x_loans+x_provisions+x_funds;

  o_contributed:=app.account_code_balance_at(cid,'411',s,'credit')+app.account_balance_at(cid,'4111',s,'credit');
  x_contributed:=app.account_code_balance_at(cid,'411',e,'credit')+app.account_balance_at(cid,'4111',e,'credit');
  o_premium:=app.account_balance_at(cid,'4112',s,'credit')-app.account_balance_at(cid,'4112',s,'debit');
  x_premium:=app.account_balance_at(cid,'4112',e,'credit')-app.account_balance_at(cid,'4112',e,'debit');
  o_other_capital:=app.account_balance_at(cid,'4118',s,'credit')-app.account_balance_at(cid,'4118',s,'debit');
  x_other_capital:=app.account_balance_at(cid,'4118',e,'credit')-app.account_balance_at(cid,'4118',e,'debit');
  o_treasury:=-app.account_balance_at(cid,'419',s); x_treasury:=-app.account_balance_at(cid,'419',e);
  o_fx:=app.account_balance_at(cid,'413',s,'credit')-app.account_balance_at(cid,'413',s);
  x_fx:=app.account_balance_at(cid,'413',e,'credit')-app.account_balance_at(cid,'413',e);
  o_owner_funds:=app.account_balance_at(cid,'418',s,'credit')-app.account_balance_at(cid,'418',s);
  x_owner_funds:=app.account_balance_at(cid,'418',e,'credit')-app.account_balance_at(cid,'418',e);
  o_retained:=app.account_balance_at(cid,'421',s,'credit')-app.account_balance_at(cid,'421',s);
  x_retained:=app.account_balance_at(cid,'421',e,'credit')-app.account_balance_at(cid,'421',e);
  select coalesce(amount,0) into x_pnl from app.report_b02_dnn(fy,e) where code='60';
  o_equity:=o_contributed+o_premium+o_other_capital+o_treasury+o_fx+o_owner_funds+o_retained;
  x_equity:=x_contributed+x_premium+x_other_capital+x_treasury+x_fx+x_owner_funds+x_retained+x_pnl;

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
  ('200','TÀI SẢN DÀI HẠN',o_fixed+o_ip+o_cip+o_long_inv+o_other_la,x_fixed+x_ip+x_cip+x_long_inv+x_other_la,0,true),
  ('220','Tài sản cố định',o_fixed,x_fixed,1,false),
  ('221','Nguyên giá tài sản cố định',o_fixed_gross,x_fixed_gross,2,false),
  ('222','Giá trị hao mòn lũy kế',o_fixed_dep,x_fixed_dep,2,false),
  ('230','Bất động sản đầu tư',o_ip,x_ip,1,false),
  ('231','Nguyên giá bất động sản đầu tư',o_ip_gross,x_ip_gross,2,false),
  ('232','Giá trị hao mòn lũy kế bất động sản đầu tư',o_ip_dep,x_ip_dep,2,false),
  ('240','Xây dựng cơ bản dở dang',o_cip,x_cip,1,false),
  ('250','Đầu tư tài chính dài hạn',o_long_inv,x_long_inv,1,false),
  ('260','Tài sản dài hạn khác',o_other_la,x_other_la,1,false),
  ('270','TỔNG CỘNG TÀI SẢN',o_cash+o_short+o_ar+o_adv+o_other_ar+o_inv+o_other_ca+o_fixed+o_ip+o_cip+o_long_inv+o_other_la,x_cash+x_short+x_ar+x_adv+x_other_ar+x_inv+x_other_ca+x_fixed+x_ip+x_cip+x_long_inv+x_other_la,0,true),
  ('300','NỢ PHẢI TRẢ',o_liab,x_liab,0,true),
  ('311','Phải trả người bán',o_trade,x_trade,1,false),
  ('312','Người mua trả tiền trước',o_customer_adv,x_customer_adv,1,false),
  ('313','Thuế và các khoản phải nộp Nhà nước',o_tax,x_tax,1,false),
  ('314','Phải trả người lao động',o_employee,x_employee,1,false),
  ('315','Phải trả khác',o_other_pay,x_other_pay,1,false),
  ('316','Vay và nợ thuê tài chính',o_loans,x_loans,1,false),
  ('317','Dự phòng phải trả',o_provisions,x_provisions,1,false),
  ('318','Quỹ khen thưởng, phúc lợi và quỹ khác',o_funds,x_funds,1,false),
  ('400','VỐN CHỦ SỞ HỮU',o_equity,x_equity,0,true),
  ('411','Vốn góp của chủ sở hữu',o_contributed,x_contributed,1,false),
  ('412','Thặng dư vốn cổ phần',o_premium,x_premium,1,false),
  ('413','Vốn khác của chủ sở hữu',o_other_capital,x_other_capital,1,false),
  ('414','Cổ phiếu quỹ',o_treasury,x_treasury,1,false),
  ('415','Chênh lệch tỷ giá hối đoái',o_fx,x_fx,1,false),
  ('416','Các quỹ thuộc vốn chủ sở hữu',o_owner_funds,x_owner_funds,1,false),
  ('417','Lợi nhuận sau thuế chưa phân phối',o_retained,x_retained+x_pnl,1,false),
  ('440','TỔNG CỘNG NGUỒN VỐN',o_liab+o_equity,x_liab+x_equity,0,true);
end $$;

create or replace function app.validate_tt133_report_set(p_from date,p_to date)
returns table(check_code text,passed boolean,details text)
language plpgsql stable security definer set search_path=public,app as $$
declare
  a bigint; s bigint; fixed_net bigint; ip_net bigint; cf_close bigint; ledger_close bigint;
  note_count int; direction_errors int;
begin
  select ending_amount into a from app.report_b01a_dnn(p_from,p_to) where code='270';
  select ending_amount into s from app.report_b01a_dnn(p_from,p_to) where code='440';
  select ending_amount into fixed_net from app.report_b01a_dnn(p_from,p_to) where code='220';
  select ending_amount into ip_net from app.report_b01a_dnn(p_from,p_to) where code='230';
  select amount into cf_close from app.report_b03_dnn(p_from,p_to) where code='70';
  ledger_close:=app.account_balance_at(app.current_company_id(),'111',p_to)+app.account_balance_at(app.current_company_id(),'112',p_to);
  select count(*) into note_count from app.report_b09_dnn(p_from,p_to) where status='approved';
  select count(*) into direction_errors
  from (
    select je.id,je.cash_flow_code,c.expected_direction,
      coalesce(sum(jl.debit-jl.credit) filter(where a.code like '111%' or a.code like '112%'),0)::bigint cash_net
    from journal_entries je
    join journal_lines jl on jl.entry_id=je.id
    join accounts a on a.id=jl.account_id
    left join cash_flow_codes c on c.code=je.cash_flow_code
    where je.company_id=app.current_company_id() and je.status='posted' and je.document_date between p_from and p_to
    group by je.id,je.cash_flow_code,c.expected_direction
  ) q
  where cash_net<>0 and (cash_flow_code is null or expected_direction is null
    or (expected_direction='inflow' and cash_net<=0)
    or (expected_direction='outflow' and cash_net>=0));

  return query values
    ('B01_BALANCE',a=s,format('Tài sản=%s; Nguồn vốn=%s',a,s)),
    ('B01_CLASSIFICATION',fixed_net>=0 and ip_net>=0,format('TSCĐ thuần=%s; BĐS đầu tư thuần=%s',fixed_net,ip_net)),
    ('F01_BALANCE',not exists(select 1 from app.report_f01_dnn(p_from,p_to) r where r.ending_debit<0 or r.ending_credit<0),'Số dư Nợ/Có không âm'),
    ('B03_RECONCILE',cf_close=ledger_close,format('B03=%s; Sổ cái 111/112=%s',cf_close,ledger_close)),
    ('B03_DIRECTION',direction_errors=0,format('Số chứng từ tiền sai/thiếu chiều mã LCTT: %s',direction_errors)),
    ('B09_COMPLETENESS',note_count=8,format('Đã phê duyệt %s/8 phần thuyết minh',note_count));
end $$;

comment on column public.accounts.balance_sheet_class is
'Explicit B01a-DNN classification. 242/244 default to noncurrent_other_asset; current classification requires accountant approval.';
