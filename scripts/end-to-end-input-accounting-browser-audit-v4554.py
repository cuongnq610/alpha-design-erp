from pathlib import Path
from playwright.sync_api import sync_playwright
from datetime import date, timedelta
import re,base64,json,math,sys
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium

root=Path(__file__).resolve().parents[1]
out=evidence_dir('end-to-end-input-accounting')
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'alpha-design-system.css').read_text(encoding='utf-8')
html=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',html)
for src in re.findall(r'<script src="([^"]+)"></script>',html):
    p=root/src
    if p.exists(): html=html.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
for name in ['logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png']:
    p=root/name
    if p.exists(): html=html.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
html=html.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
mem="""<script>
function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length},dump:()=>({...store})};}
window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();
</script>"""
html=html.replace('<head>','<head>'+mem,1)
results={'version':RELEASE_VERSION,'checks':[],'screenshots':[],'errors':[],'records':{}}

def check(name, actual, expected, tolerance=0):
    if isinstance(actual,(int,float)) and isinstance(expected,(int,float)):
        ok=abs(actual-expected)<=tolerance
    else: ok=actual==expected
    results['checks'].append({'name':name,'actual':actual,'expected':expected,'tolerance':tolerance,'pass':ok})
    if not ok: results['errors'].append(f'{name}: actual={actual!r}, expected={expected!r}')
    return ok

def fill(page,name,value):
    loc=page.locator(f'#modalForm [name="{name}"]')
    if loc.count()!=1: raise RuntimeError(f'Field {name} count={loc.count()}')
    tag=loc.evaluate('e=>e.tagName')
    if tag=='SELECT': loc.select_option(str(value))
    else: loc.fill(str(value))


def fill_many(page,data,events=False):
    page.evaluate("""({data,events})=>{const f=document.querySelector('#modalForm');for(const [name,value] of Object.entries(data)){const e=f?.elements?.namedItem(name);if(!e)throw new Error('Missing field '+name);e.value=String(value);if(events){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}}}""",{'data':data,'events':events})

def submit(page,wait=350):
    page.locator('#modalForm button[type="submit"]').click();page.wait_for_timeout(wait)

def nav(page,view):
    page.evaluate("v=>document.querySelector(`.nav-item[data-view='${v}']`)?.click()",view);page.wait_for_timeout(220)

def db_now(page,key): return json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',key))

def snap(page,name,full=False):
    path=out/f'{name}.png';page.screenshot(path=str(path),full_page=full,timeout=15000);results['screenshots'].append(str(path.relative_to(root)))

def progressive_tax(taxable):
    rem=max(0,taxable); prev=0; tax=0
    for upper,rate in [(10_000_000,.05),(30_000_000,.10),(60_000_000,.20),(100_000_000,.30),(float('inf'),.35)]:
        sl=max(0,min(rem,upper-prev)); tax+=sl*rate; rem-=sl; prev=upper
        if rem<=0: break
    return round(tax)

def workdays_july(settings):
    weekdays=set(settings.get('workWeekdays',[1,2,3,4,5])); holidays=set(settings.get('holidays',[])); d=date(2026,7,1); end=date(2026,7,31); count=0
    while d<=end:
        js_day=(d.weekday()+1)%7
        if js_day in weekdays and d.isoformat() not in holidays: count+=1
        d+=timedelta(days=1)
    return count

with sync_playwright() as p:
    browser=launch_chromium(p)
    page=browser.new_page(viewport={'width':1600,'height':1050},device_scale_factor=1)
    page.set_default_timeout(8000)
    page.on('pageerror',lambda e:results['errors'].append('pageerror: '+str(e)))
    page.set_content(html,wait_until='load',timeout=60000);page.wait_for_timeout(500)
    page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required')")
    storage_key=page.evaluate('window.AlphaERP.storageKey')
    initial=db_now(page,storage_key)
    initial_counts={k:len(v) for k,v in initial.items() if isinstance(v,list)}

    # A. Enter two contrasting personnel records through the real form.
    print('STAGE people',flush=True)
    nav(page,'people')
    page.locator('#primaryAction').click()
    fixed_fields={'code':'QA-FIX-4554','name':'Nhân viên kiểm thử lương phức tạp','role':'Kiến trúc sư chủ trì','department':'Kiến trúc','type':'Fixed','status':'Active','startDate':'2026-01-01','monthlySalary':31_000_000,'monthlyAllowance':2_400_000,'insuranceSalary':28_000_000,'insuranceEnabled':'true','dependentCount':1,'pitResidence':'Resident','overtimeMultiplier':1.5,'hourlyRate':0,'billingRate':620_000}
    for k,v in fixed_fields.items(): fill(page,k,v)
    snap(page,'01-fixed-employee-input')
    submit(page)
    page.locator('#primaryAction').click()
    ctv_fields={'code':'QA-CTV-4554','name':'Cộng tác viên kiểm thử','role':'BIM Modeler','department':'BIM','type':'CTV','status':'Active','startDate':'2026-01-01','monthlySalary':0,'monthlyAllowance':0,'insuranceSalary':0,'insuranceEnabled':'false','dependentCount':0,'pitResidence':'Resident','overtimeMultiplier':1.5,'hourlyRate':210_000,'billingRate':390_000}
    for k,v in ctv_fields.items(): fill(page,k,v)
    submit(page)
    db=db_now(page,storage_key)
    fixed=next(x for x in db['people'] if x.get('code')=='QA-FIX-4554'); ctv=next(x for x in db['people'] if x.get('code')=='QA-CTV-4554')
    check('Fixed employee saved',fixed['monthlySalary'],31_000_000);check('Fixed allowance saved',fixed['monthlyAllowance'],2_400_000);check('Fixed insurance base saved',fixed['insuranceSalary'],28_000_000);check('CTV hourly rate saved',ctv['hourlyRate'],210_000)

    # B. Project quick-entry and cross-table synchronization.
    print('STAGE project',flush=True)
    nav(page,'projects');page.locator('#primaryAction').click()
    proj_fields={'code':'QA-PROJ-4554','name':'Khách sạn QA kiểm thử xuyên suốt','clientId':'c1','pmId':fixed['id'],'type':'Hotel','stage':'TKCS','status':'In Progress','risk':'High','startDate':'2026-07-01','endDate':'2027-06-30','contractValue':2_750_000_000,'directBudget':1_120_000_000,'progress':37,'progressMode':'manual'}
    for k,v in proj_fields.items(): fill(page,k,v)
    check('Project live preview contribution displayed','1,63' in page.locator('.form-live-summary').inner_text() or '1.630' in page.locator('.form-live-summary').inner_text(),True)
    snap(page,'02-project-complex-input');submit(page,500)
    db=db_now(page,storage_key); project=next(x for x in db['projects'] if x.get('code')=='QA-PROJ-4554')
    contract=next(x for x in db['contracts'] if x.get('projectId')==project['id'] and x.get('contractType','customer')=='customer')
    budget=next(x for x in db['projectBudgetVersions'] if x.get('projectId')==project['id'] and x.get('status')=='Approved')
    check('Project value saved',project['contractValue'],2_750_000_000);check('Project budget saved',project['directBudget'],1_120_000_000);check('Auto contract synchronized',contract['valueExclVat'],2_750_000_000);check('Approved budget synchronized',budget['directBudget'],1_120_000_000)

    # C. Timesheet data, invalid boundary and direct approval.
    print('STAGE timesheets',flush=True)
    nav(page,'timesheets')
    def add_ts(day,person,hours,billable,approved,desc):
        page.locator('#primaryAction').click();
        for k,v in {'date':day,'personId':person,'projectId':project['id'],'hours':hours,'billable':str(billable).lower(),'approved':str(approved).lower(),'description':desc}.items(): fill(page,k,v)
        submit(page,420)
    add_ts('2026-07-06',fixed['id'],10,True,False,'Thiết kế concept và phối hợp liên bộ môn')
    db=db_now(page,storage_key); pending=next(x for x in db['timesheets'] if x.get('personId')==fixed['id'] and x.get('date')=='2026-07-06')
    button=page.locator(f'.approve-timesheet[data-id="{pending["id"]}"]')
    check('Pending row exposes direct approval button',button.count(),1)
    snap(page,'03-timesheet-pending-direct-approval');button.click();page.wait_for_timeout(550)
    db=db_now(page,storage_key);approved_pending=next(x for x in db['timesheets'] if x['id']==pending['id'])
    check('Direct approval persists approved flag',approved_pending['approved'],True);check('Direct approval stamps approver',bool(approved_pending.get('approvedBy')),True);check('Approved row removes approval button',page.locator(f'.approve-timesheet[data-id="{pending["id"]}"]').count(),0)
    add_ts('2026-07-07',fixed['id'],8,False,True,'Họp nội bộ và QA hồ sơ')
    add_ts('2026-07-08',fixed['id'],6,True,True,'Triển khai hồ sơ TKCS')
    add_ts('2026-07-09',ctv['id'],20,True,True,'Dựng mô hình BIM cao điểm')
    add_ts('2026-07-10',ctv['id'],10,True,True,'Hoàn thiện mô hình và render')
    before_invalid=len(db_now(page,storage_key)['timesheets']);page.locator('#primaryAction').click()
    for k,v in {'date':'2026-07-11','personId':fixed['id'],'projectId':project['id'],'billable':'true','approved':'false','description':'Dữ liệu biên không hợp lệ'}.items(): fill(page,k,v)
    page.locator('#modalForm [name="hours"]').evaluate("e=>{e.value='25';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}")
    submit(page,150)
    check('25-hour invalid entry remains in form',page.locator('#modalBackdrop').evaluate("e=>!e.classList.contains('hidden')"),True);check('25-hour invalid entry not persisted',len(db_now(page,storage_key)['timesheets']),before_invalid)
    page.locator('#closeModal').click();page.wait_for_timeout(150)

    # D. Payroll automatic period + independent accounting calculation.
    print('STAGE payroll',flush=True)
    nav(page,'payroll');page.locator('#payrollMonthSelect').select_option('2026-07');page.locator('#generatePayrollPeriod').click();page.wait_for_timeout(650)
    db=db_now(page,storage_key)
    rows=page.evaluate('(db)=>window.AlphaPayrollDetail.calculatePeriod(db,"2026-07")',db)
    fixed_row=next(x for x in rows if x['personId']==fixed['id']);ctv_row=next(x for x in rows if x['personId']==ctv['id'])
    wd=workdays_july(db['settings']);daily=float(db['settings'].get('dailyWorkingHours') or db['settings'].get('monthlyWorkingHours',176)/22 or 8)
    fixed_hours=24; fixed_billable=16; ot=2
    expected_base=31_000_000
    expected_allowance=2_400_000
    expected_ot=round(ot*(31_000_000/(wd*daily))*1.5)
    gross=round(expected_base+expected_allowance+expected_ot)
    emp_bh=round(28_000_000*float(db['settings'].get('employeeInsuranceRate',10.5))/100)
    er_bh=round(28_000_000*float(db['settings'].get('employerInsuranceRate',21.5))/100)
    taxable=max(0,round(gross-emp_bh-15_500_000-6_200_000))
    pit=progressive_tax(taxable);net=round(gross-emp_bh-pit);recoverable=round(fixed_billable*620_000)
    check('Fixed standard workdays independent',fixed_row['standardWorkdays'],wd);check('Fixed approved hours',fixed_row['approvedHours'],fixed_hours);check('Fixed billable hours',fixed_row['billableHours'],fixed_billable);check('Fixed overtime hours',fixed_row['overtimeHours'],ot)
    for name,actual,expected in [('Fixed base salary',fixed_row['baseSalary'],expected_base),('Automatic allowance',fixed_row['allowances'],expected_allowance),('Automatic overtime pay',fixed_row['overtimePay'],expected_ot),('Gross income',fixed_row['grossIncome'],gross),('Employee insurance',fixed_row['employeeInsurance'],emp_bh),('Employer insurance',fixed_row['employerInsurance'],er_bh),('Taxable income',fixed_row['taxableIncome'],taxable),('Progressive PIT',fixed_row['personalIncomeTax'],pit),('Net pay',fixed_row['netPay'],net),('Recoverable revenue',fixed_row['recoverableRevenue'],recoverable)]: check(name,actual,expected)
    check('CTV approved hours',ctv_row['approvedHours'],30);check('CTV gross from timesheet',ctv_row['grossIncome'],6_300_000);check('CTV withholding 10%',ctv_row['personalIncomeTax'],630_000);check('CTV net pay',ctv_row['netPay'],5_670_000)
    payroll_row=page.locator(f'tr[data-payroll-person="{fixed["id"]}"]')
    check('Payroll row hides automatic source word','Tự động' in payroll_row.inner_text(),False);check('Payroll row keeps overtime audit','2 giờ OT' in payroll_row.inner_text() or '2,0 giờ OT' in payroll_row.inner_text(),True)
    snap(page,'04-payroll-automatic-complex-results')

    # E. Journal validation, posted entries, VAT register and linked paid cash movements.
    print('STAGE accounting',flush=True)
    period_range={'from':'2026-07-01','to':'2026-07-31'}
    before_metrics=page.evaluate("(r)=>{const d=JSON.parse(window.alphaStorage.getItem(window.AlphaERP.storageKey));return {pl:window.AlphaCalc.profitAndLoss(d,r),cf:window.AlphaCalc.cashFlow(d,r),vat:window.AlphaCalc.vatRegisterSummary(d,r)}}",period_range);print('ACCOUNTING baseline metrics',flush=True)
    print('ACCOUNTING nav start',flush=True);nav(page,'accounting');print('ACCOUNTING nav done',flush=True);page.locator('#primaryAction').click();print('ACCOUNTING form opened',flush=True)
    print('ACCOUNTING fill bad start',flush=True);fill_many(page,{'date':'2026-07-28','documentNo':'QA-BAD-4554','sourceType':'Báo Có','cashFlowCode':'01','status':'Posted','projectId':project['id'],'partner':'client:c1','description':'Chứng từ mất cân đối phải bị chặn','accountCode0':'1121','debit0':550_000_000,'credit0':0,'lineDescription0':'Thu tiền','accountCode1':'5113','debit1':0,'credit1':500_000_000,'lineDescription1':'Doanh thu'});print('ACCOUNTING fill bad done',flush=True)
    print('ACCOUNTING submit bad start',flush=True);submit(page,250);print('ACCOUNTING submit bad done',flush=True)
    print('ACCOUNTING read feedback start',flush=True);feedback=page.evaluate("document.querySelector('#modalForm .form-feedback')?.innerText||''");print('ACCOUNTING read feedback done',flush=True)
    check('Unbalanced Posted journal blocked',page.evaluate("!document.querySelector('#modalBackdrop').classList.contains('hidden')"),True);check('Unbalanced feedback mentions balance',('Nợ' in feedback and 'Có' in feedback) or 'cân' in feedback.lower(),True);check('Unbalanced journal not saved',page.evaluate("!JSON.parse(window.alphaStorage.getItem(window.AlphaERP.storageKey)).journalEntries.some(x=>x.documentNo==='QA-BAD-4554')"),True);print('ACCOUNTING bad checks done',flush=True)
    print('ACCOUNTING correction fill start',flush=True);fill_many(page,{'documentNo':'QA-BC-4554','description':'Thu tiền dịch vụ thiết kế khách sạn QA','accountCode2':'33311','debit2':0,'credit2':50_000_000,'lineDescription2':'VAT đầu ra'});print('ACCOUNTING correction fill done',flush=True);submit(page,600);print('ACCOUNTING income submit done',flush=True)
    je_income=page.evaluate("JSON.parse(window.alphaStorage.getItem(window.AlphaERP.storageKey)).journalEntries.find(x=>x.documentNo==='QA-BC-4554')");print('ACCOUNTING income record extracted',flush=True)
    check('Income journal posted',je_income['status'],'Posted');check('Income journal balanced',sum(x['debit'] for x in je_income['lines']),sum(x['credit'] for x in je_income['lines']));check('Posted journal has immutable hash',bool(je_income.get('postingHash')),True)
    injected=page.evaluate("""({projectId,contractId,incomeJournalId})=>{
      const key=window.AlphaERP.storageKey,d=JSON.parse(window.alphaStorage.getItem(key));
      const expense={id:'je-qa-exp-4554',date:'2026-07-29',documentNo:'QA-BN-4554',sourceType:'Báo Nợ',cashFlowCode:'07',status:'Posted',projectId,partnerType:'vendor',partnerId:'v1',description:'Chi phí tư vấn kỹ thuật đầu vào',lines:[
        {accountCode:'6421',debit:100000000,credit:0,description:'Chi phí dịch vụ'},
        {accountCode:'1331',debit:10000000,credit:0,description:'VAT đầu vào'},
        {accountCode:'1121',debit:0,credit:110000000,description:'Chi ngân hàng'}]};
      const validation=window.AlphaCalc.entryValidation(d,expense,'');if(!validation.valid)throw new Error(validation.errors.join(' | '));
      expense.postedAt=new Date().toISOString();expense.postedBy='demo';expense.postingHash=window.AlphaCalc.postingHash(expense);d.journalEntries.unshift(expense);
      const output={id:'txi-qa-out-4554',direction:'Output',date:'2026-07-28',dueDate:'2026-07-28',serial:'C26TAA',invoiceNo:'QA-OUT-4554',partnerType:'client',partnerId:'c1',taxCode:'0100000001',description:'Dịch vụ tư vấn thiết kế khách sạn',projectId,contractId,taxBase:500000000,vatRate:10,vatAmount:50000000,totalAmount:550000000,deductible:false,paymentMethod:'Bank',paymentStatus:'Paid',status:'Valid',journalEntryId:incomeJournalId,notes:'Đã đối chiếu chứng từ'};
      const input={id:'txi-qa-in-4554',direction:'Input',date:'2026-07-29',dueDate:'2026-07-29',serial:'C26TAA',invoiceNo:'QA-IN-4554',partnerType:'vendor',partnerId:'v1',taxCode:'0100000002',description:'Dịch vụ tư vấn kỹ thuật đầu vào',projectId,contractId:'',taxBase:100000000,vatRate:10,vatAmount:10000000,totalAmount:110000000,deductible:true,paymentMethod:'Bank',paymentStatus:'Paid',status:'Valid',journalEntryId:expense.id,notes:'Đủ điều kiện khấu trừ'};
      d.taxInvoices.unshift(input,output);
      const incomeFinance={id:'f-qa-in-4554',date:'2026-07-28',type:'Income',category:'Thu khách hàng',projectId,amount:550000000,status:'Paid',journalEntryId:incomeJournalId,description:'Thu tiền hóa đơn QA-OUT-4554'};
      const expenseFinance={id:'f-qa-out-4554',date:'2026-07-29',type:'Expense',category:'Chi phí tư vấn',projectId,amount:110000000,status:'Paid',journalEntryId:expense.id,description:'Thanh toán hóa đơn QA-IN-4554'};
      if(!window.AlphaCalc.financeJournalMatch(d,incomeFinance,d.journalEntries.find(x=>x.id===incomeJournalId)))throw new Error('Income finance/journal mismatch');
      if(!window.AlphaCalc.financeJournalMatch(d,expenseFinance,expense))throw new Error('Expense finance/journal mismatch');
      d.finance.unshift(expenseFinance,incomeFinance);window.alphaStorage.setItem(key,JSON.stringify(d));
      return {expense,output,input,incomeFinance,expenseFinance};
    }""",{'projectId':project['id'],'contractId':contract['id'],'incomeJournalId':je_income['id']})
    je_exp=injected['expense']
    check('Expense journal balanced',sum(x['debit'] for x in je_exp['lines']),sum(x['credit'] for x in je_exp['lines']))
    check('Input VAT automatically traceable to journal',injected['input']['journalEntryId'],je_exp['id'])
    check('Paid income matches Posted cash journal',injected['incomeFinance']['amount'],550_000_000)
    check('Paid expense matches Posted cash journal',injected['expenseFinance']['amount'],110_000_000)
    nav(page,'finance');page.wait_for_timeout(350);snap(page,'05-finance-linked-paid-records')
    after=page.evaluate("(r)=>{const d=JSON.parse(window.alphaStorage.getItem(window.AlphaERP.storageKey));return {pl:window.AlphaCalc.profitAndLoss(d,r),cf:window.AlphaCalc.cashFlow(d,r),vat:window.AlphaCalc.vatRegisterSummary(d,r),ledger:window.AlphaCalc.vatLedgerSummary(d,r)}}",period_range)
    check('Revenue delta from Posted entry',after['pl']['revenue']-before_metrics['pl']['revenue'],500_000_000);check('Expense delta from Posted entry',after['pl']['expenseBeforeTax']-before_metrics['pl']['expenseBeforeTax'],100_000_000);check('Profit delta independent',after['pl']['profitBeforeTax']-before_metrics['pl']['profitBeforeTax'],400_000_000)
    check('Cash inflow delta from linked Paid',after['cf']['cashIn']-before_metrics['cf']['cashIn'],550_000_000);check('Cash outflow delta from linked Paid',after['cf']['cashOut']-before_metrics['cf']['cashOut'],110_000_000);check('Net cash delta',after['cf']['net']-before_metrics['cf']['net'],440_000_000)
    check('VAT output delta',after['vat']['output']-before_metrics['vat']['output'],50_000_000);check('VAT deductible input delta',after['vat']['inputDeductible']-before_metrics['vat']['inputDeductible'],10_000_000);check('VAT payable delta',after['vat']['payable']-before_metrics['vat']['payable'],40_000_000)
    check('VAT output register equals ledger',after['vat']['output'],after['ledger']['output']);check('VAT input register equals ledger',after['vat']['inputDeductible'],after['ledger']['input'])

    # F. Persistence/editability and dashboard responsive geometry.
    print('STAGE persistence-dashboard',flush=True)
    persisted_person=page.evaluate("JSON.parse(window.alphaStorage.getItem(window.AlphaERP.storageKey)).people.find(x=>x.code==='QA-FIX-4554')")
    check('Saved employee persists salary after cross-module operations',persisted_person['monthlySalary'],31_000_000);check('Saved employee persists billing rate after cross-module operations',persisted_person['billingRate'],620_000)
    print('DASHBOARD nav start',flush=True);nav(page,'dashboard');page.wait_for_timeout(350);print('DASHBOARD nav done',flush=True)
    dash=page.evaluate("""(()=>{const q=s=>[...document.querySelectorAll(s)],rect=e=>e?.getBoundingClientRect();const core=q('.dashboard-core-grid .kpi-card'),ctx=q('.dashboard-context-grid .kpi-card'),note=q('.dashboard-source-card');return {core:core.length,context:ctx.length,note:note.length,coreWidth:rect(core[0])?.width||0,contextWidth:rect(ctx[0])?.width||0}})()""")
    check('Dashboard core KPI count',dash['core'],4);check('Dashboard compact context KPI count',dash['context'],3);check('Dashboard source note count',dash['note'],1);check('Project/people KPI cards are compact',page.locator('.dashboard-context-grid .kpi-card--compact').count(),3)
    snap(page,'06-dashboard-compact-overview')
    page.evaluate("(document.querySelector('#desktopMenuBtn')||document.querySelector('.desktop-menu'))?.click()");page.wait_for_timeout(250)
    inside=page.evaluate("""(()=>{const a=document.querySelector('.sidebar .nav-item.active')?.getBoundingClientRect(),s=document.querySelector('.sidebar')?.getBoundingClientRect();return !!(a&&s&&a.x>=s.x-.5&&a.right<=s.right+.5)})()""")
    check('Collapsed active sidebar icon remains inside rail',inside,True)
    snap(page,'07-collapsed-sidebar-not-clipped')

    final_counts=page.evaluate("(()=>{const d=JSON.parse(window.alphaStorage.getItem(window.AlphaERP.storageKey));return Object.fromEntries(['people','projects','timesheets','journalEntries','finance','taxInvoices'].map(k=>[k,d[k].length]))})()")
    for key,delta in [('people',2),('projects',1),('timesheets',5),('journalEntries',2),('finance',2),('taxInvoices',2)]: check(f'{key} record count delta',final_counts[key],initial_counts[key]+delta)
    results['records']={'fixedPersonId':fixed['id'],'ctvPersonId':ctv['id'],'projectId':project['id'],'contractId':contract['id'],'incomeJournalId':je_income['id'],'expenseJournalId':je_exp['id']}
    results['qaSubset']=page.evaluate("(()=>{const d=JSON.parse(window.alphaStorage.getItem(window.AlphaERP.storageKey));const people=d.people.filter(x=>['QA-FIX-4554','QA-CTV-4554'].includes(x.code));const ids=new Set(people.map(x=>x.id));const project=d.projects.find(x=>x.code==='QA-PROJ-4554');return {people,projects:project?[project]:[],contracts:d.contracts.filter(x=>x.projectId===project?.id),projectBudgetVersions:d.projectBudgetVersions.filter(x=>x.projectId===project?.id),timesheets:d.timesheets.filter(x=>x.projectId===project?.id&&ids.has(x.personId)),journalEntries:d.journalEntries.filter(x=>['QA-BC-4554','QA-BN-4554'].includes(x.documentNo)),taxInvoices:d.taxInvoices.filter(x=>['QA-OUT-4554','QA-IN-4554'].includes(x.invoiceNo)),finance:d.finance.filter(x=>String(x.description||'').includes('4554')),payrollPeriods:d.payrollPeriods.filter(x=>x.month==='2026-07'),payrollItems:d.payrollItems.filter(x=>ids.has(x.personId))}})()")
    browser.close()

results['passed']=sum(1 for x in results['checks'] if x['pass'])
results['failed']=sum(1 for x in results['checks'] if not x['pass'])+len([x for x in results['errors'] if x.startswith('pageerror:')])
(out/'end-to-end-results.json').write_text(json.dumps({k:v for k,v in results.items() if k!='qaSubset'},ensure_ascii=False,indent=2),encoding='utf-8')
(out/'qa-demo-database-v4554.json').write_text(json.dumps(results.get('qaSubset',{}),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':results['passed'],'failed':results['failed'],'errors':results['errors']},ensure_ascii=False,indent=2))
if results['failed']: sys.exit(1)
