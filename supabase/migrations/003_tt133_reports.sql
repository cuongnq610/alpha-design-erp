-- Server-side statutory report functions for TT133.
create or replace function app.account_balance_at(p_company uuid,p_prefix text,p_to date,p_side text default 'debit') returns bigint
language sql stable security definer set search_path=public,app as $$
with mov as (
 select coalesce(sum(case when p_side='credit' then jl.credit-jl.debit else jl.debit-jl.credit end),0)::bigint v
 from journal_lines jl join journal_entries je on je.id=jl.entry_id join accounts a on a.id=jl.account_id
 where je.company_id=p_company and je.status='posted' and je.document_date<=p_to and a.code like p_prefix||'%'
), op as (
 select coalesce(sum(case when p_side='credit' then ob.credit-ob.debit else ob.debit-ob.credit end),0)::bigint v
 from opening_balances ob join accounts a on a.id=ob.account_id
 where ob.company_id=p_company and a.code like p_prefix||'%'
)
select greatest(0,(select v from mov)+(select v from op))::bigint
$$;

create or replace function app.account_movement(p_company uuid,p_prefix text,p_from date,p_to date,p_side text default 'debit') returns bigint
language sql stable security definer set search_path=public,app as $$
select coalesce(sum(case when p_side='credit' then jl.credit-jl.debit else jl.debit-jl.credit end),0)::bigint
from journal_lines jl join journal_entries je on je.id=jl.entry_id join accounts a on a.id=jl.account_id
where je.company_id=p_company and je.status='posted' and je.document_date between p_from and p_to and a.code like p_prefix||'%'
$$;

create or replace function app.report_f01_dnn(p_from date,p_to date)
returns table(account_code text,account_name text,opening_debit bigint,opening_credit bigint,movement_debit bigint,movement_credit bigint,ending_debit bigint,ending_credit bigint)
language sql stable security definer set search_path=public,app as $$
with m as (
 select a.id,a.code,a.name,
 coalesce(sum(jl.debit) filter(where je.document_date<p_from),0)+coalesce(sum(ob.debit),0) od,
 coalesce(sum(jl.credit) filter(where je.document_date<p_from),0)+coalesce(sum(ob.credit),0) oc,
 coalesce(sum(jl.debit) filter(where je.document_date between p_from and p_to),0) md,
 coalesce(sum(jl.credit) filter(where je.document_date between p_from and p_to),0) mc
 from accounts a
 left join journal_lines jl on jl.account_id=a.id
 left join journal_entries je on je.id=jl.entry_id and je.status='posted' and je.company_id=app.current_company_id()
 left join opening_balances ob on ob.account_id=a.id and ob.company_id=a.company_id
 where a.company_id=app.current_company_id()
 group by a.id,a.code,a.name
)
select code,name,greatest(od-oc,0)::bigint,greatest(oc-od,0)::bigint,md::bigint,mc::bigint,
 greatest((od+md)-(oc+mc),0)::bigint,greatest((oc+mc)-(od+md),0)::bigint
from m where od<>0 or oc<>0 or md<>0 or mc<>0 order by code
$$;

create or replace function app.report_b02_dnn(p_from date,p_to date)
returns table(code text,label text,amount bigint) language plpgsql stable security definer set search_path=public,app as $$
declare sales bigint; deductions bigint; cogs bigint; fin_income bigint; fin_cost bigint; management bigint; other_income bigint; other_cost bigint; tax bigint;
begin
 sales:=app.account_movement(app.current_company_id(),'511',p_from,p_to,'credit');
 deductions:=app.account_movement(app.current_company_id(),'521',p_from,p_to,'debit');
 cogs:=app.account_movement(app.current_company_id(),'632',p_from,p_to,'debit');
 fin_income:=app.account_movement(app.current_company_id(),'515',p_from,p_to,'credit');
 fin_cost:=app.account_movement(app.current_company_id(),'635',p_from,p_to,'debit');
 management:=app.account_movement(app.current_company_id(),'642',p_from,p_to,'debit');
 other_income:=app.account_movement(app.current_company_id(),'711',p_from,p_to,'credit');
 other_cost:=app.account_movement(app.current_company_id(),'811',p_from,p_to,'debit');
 tax:=app.account_movement(app.current_company_id(),'821',p_from,p_to,'debit');
 return query values
 ('01','Doanh thu bán hàng và cung cấp dịch vụ',sales),('02','Các khoản giảm trừ doanh thu',deductions),('10','Doanh thu thuần',sales-deductions),('11','Giá vốn hàng bán',cogs),('20','Lợi nhuận gộp',sales-deductions-cogs),('21','Doanh thu hoạt động tài chính',fin_income),('22','Chi phí tài chính',fin_cost),('24','Chi phí quản lý kinh doanh',management),('30','Lợi nhuận thuần từ hoạt động kinh doanh',sales-deductions-cogs+fin_income-fin_cost-management),('31','Thu nhập khác',other_income),('32','Chi phí khác',other_cost),('40','Lợi nhuận khác',other_income-other_cost),('50','Tổng lợi nhuận kế toán trước thuế',sales-deductions-cogs+fin_income-fin_cost-management+other_income-other_cost),('51','Chi phí thuế TNDN',tax),('60','Lợi nhuận sau thuế TNDN',sales-deductions-cogs+fin_income-fin_cost-management+other_income-other_cost-tax);
end $$;

create or replace function app.report_b01a_dnn(p_from date,p_to date)
returns table(code text,label text,opening_amount bigint,ending_amount bigint) language plpgsql stable security definer set search_path=public,app as $$
declare cid uuid:=app.current_company_id(); begin
 return query
 with d as (select p_from-1 s,p_to e), r as (
 select * from (values
 ('110','Tiền và các khoản tương đương tiền',app.account_balance_at(cid,'111',(select s from d))+app.account_balance_at(cid,'112',(select s from d)),app.account_balance_at(cid,'111',(select e from d))+app.account_balance_at(cid,'112',(select e from d))),
 ('131','Phải thu ngắn hạn của khách hàng',app.account_balance_at(cid,'131',(select s from d)),app.account_balance_at(cid,'131',(select e from d))),
 ('132','Trả trước cho người bán',app.account_balance_at(cid,'331',(select s from d),'debit'),app.account_balance_at(cid,'331',(select e from d),'debit')),
 ('140','Hàng tồn kho và chi phí SXKD dở dang',app.account_balance_at(cid,'15',(select s from d)),app.account_balance_at(cid,'15',(select e from d))),
 ('151','Thuế GTGT được khấu trừ',app.account_balance_at(cid,'133',(select s from d)),app.account_balance_at(cid,'133',(select e from d))),
 ('220','Tài sản cố định',app.account_balance_at(cid,'211',(select s from d))-app.account_balance_at(cid,'214',(select s from d),'credit'),app.account_balance_at(cid,'211',(select e from d))-app.account_balance_at(cid,'214',(select e from d),'credit')),
 ('240','Xây dựng cơ bản dở dang',app.account_balance_at(cid,'241',(select s from d)),app.account_balance_at(cid,'241',(select e from d))),
 ('260','Tài sản dài hạn khác',app.account_balance_at(cid,'242',(select s from d)),app.account_balance_at(cid,'242',(select e from d))),
 ('311','Phải trả người bán',app.account_balance_at(cid,'331',(select s from d),'credit'),app.account_balance_at(cid,'331',(select e from d),'credit')),
 ('312','Người mua trả tiền trước',app.account_balance_at(cid,'131',(select s from d),'credit'),app.account_balance_at(cid,'131',(select e from d),'credit')),
 ('313','Thuế và các khoản phải nộp Nhà nước',app.account_balance_at(cid,'333',(select s from d),'credit'),app.account_balance_at(cid,'333',(select e from d),'credit')),
 ('314','Phải trả người lao động',app.account_balance_at(cid,'334',(select s from d),'credit'),app.account_balance_at(cid,'334',(select e from d),'credit')),
 ('315','Phải trả khác',app.account_balance_at(cid,'338',(select s from d),'credit'),app.account_balance_at(cid,'338',(select e from d),'credit')),
 ('316','Vay và nợ thuê tài chính',app.account_balance_at(cid,'341',(select s from d),'credit'),app.account_balance_at(cid,'341',(select e from d),'credit')),
 ('411','Vốn góp của chủ sở hữu',app.account_balance_at(cid,'411',(select s from d),'credit'),app.account_balance_at(cid,'411',(select e from d),'credit')),
 ('417','Lợi nhuận sau thuế chưa phân phối',app.account_balance_at(cid,'421',(select s from d),'credit'),app.account_balance_at(cid,'421',(select e from d),'credit'))
 ) v(code,label,opening_amount,ending_amount)
 ) select * from r;
end $$;

create or replace function app.verify_audit_chain(p_company uuid) returns table(valid boolean,broken_at bigint)
language plpgsql stable security definer set search_path=public,app as $$
declare r record; prev text:=null; expected text;
begin
 for r in select * from audit_events where company_id=p_company order by id loop
   if r.previous_hash is distinct from prev then return query select false,r.id; return; end if;
   prev:=r.event_hash;
 end loop;
 return query select true,null::bigint;
end $$;
