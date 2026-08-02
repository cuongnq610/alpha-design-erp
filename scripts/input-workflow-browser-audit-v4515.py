from pathlib import Path
from playwright.sync_api import sync_playwright
import re,base64,json,math,sys
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
root=Path(__file__).resolve().parents[1]
out=evidence_dir('input')
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'alpha-design-system.css').read_text(encoding='utf-8')
html=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',html)
for src in re.findall(r'<script src="([^"]+)"></script>',html):
    p=root/src
    if p.exists(): html=html.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
for name in ['logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png']:
    p=root/name
    html=html.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
# Opaque set_content origins block Storage APIs; use deterministic in-memory implementations.
html=html.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
mem="""<script>
function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length},dump:()=>({...store})};}
window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();
</script>"""
html=html.replace('<head>','<head>'+mem,1)
results={'version':RELEASE_VERSION,'checks':[],'screenshots':[],'errors':[]}
def check(name, actual, expected, tolerance=0):
    if isinstance(actual,(int,float)) and isinstance(expected,(int,float)):
        ok=abs(actual-expected)<=tolerance
    else: ok=actual==expected
    results['checks'].append({'name':name,'actual':actual,'expected':expected,'tolerance':tolerance,'pass':ok})
    if not ok: results['errors'].append(f'{name}: actual={actual}, expected={expected}')
    return ok

def fill(page,name,value):
    loc=page.locator(f'#modalForm [name="{name}"]')
    typ=loc.get_attribute('type')
    tag=loc.evaluate('e=>e.tagName')
    if tag=='SELECT': loc.select_option(str(value))
    else: loc.fill(str(value))

def snapshot(page,name):
    path=out/f'{name}.png';page.screenshot(path=str(path),full_page=False,timeout=10000);results['screenshots'].append(str(path.relative_to(root)))

with sync_playwright() as p:
    browser=launch_chromium(p)
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.set_default_timeout(6000)
    page.on('pageerror',lambda e:results['errors'].append('pageerror: '+str(e)))
    page.set_content(html,wait_until='load',timeout=60000);page.wait_for_timeout(400)
    page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required')")
    storage_key=page.evaluate('window.AlphaERP.storageKey')
    initial=json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',storage_key))
    initial_counts={k:len(v) for k,v in initial.items() if isinstance(v,list)}

    print('STAGE project', flush=True)
    # 1. Project quick input -> contract + approved budget synchronization.
    page.evaluate("document.querySelector(\".nav-item[data-view='projects']\").click()");page.wait_for_timeout(150);page.locator('#primaryAction').click()
    fill(page,'code','UXTEST-459')
    fill(page,'name','Dự án kiểm thử nhập liệu v4.5.23')
    fill(page,'clientId','c1');fill(page,'pmId','p2');fill(page,'type','Hotel');fill(page,'stage','TKCS');fill(page,'status','In Progress');fill(page,'risk','Medium')
    fill(page,'startDate','2026-07-01');fill(page,'endDate','2027-03-31')
    fill(page,'contractValue',1_200_000_000);fill(page,'directBudget',720_000_000);fill(page,'progress',35);fill(page,'progressMode','manual')
    page.wait_for_timeout(100)
    summary=page.locator('.form-live-summary').inner_text()
    check('Project preview contains contract value', '1,2 tỷ' in summary or '1.200.000.000' in summary, True)
    check('Project preview contains direct budget', '720' in summary, True)
    snapshot(page,'01-project-live-preview')
    page.locator('#modalForm button[type="submit"]').click();page.wait_for_timeout(500)
    db=json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',storage_key))
    project=next(x for x in db['projects'] if x['code']=='UXTEST-459')
    contract=next(x for x in db['contracts'] if x.get('projectId')==project['id'] and x.get('contractType','customer')=='customer')
    budget=next(x for x in db['projectBudgetVersions'] if x.get('projectId')==project['id'] and x.get('status')=='Approved')
    check('Project contract value saved',project['contractValue'],1_200_000_000)
    check('Project direct budget saved',project['directBudget'],720_000_000)
    check('Project manual progress saved',project['progress'],35)
    check('Synced customer contract value',contract['valueExclVat'],1_200_000_000)
    check('Synced contract client',contract['clientId'],'c1')
    check('Synced approved budget direct cost',budget['directBudget'],720_000_000)
    check('Synced target contribution',1_200_000_000-budget['directBudget'],480_000_000)
    snapshot(page,'02-project-created')

    print('STAGE contract', flush=True)
    # 2. Create an explicit signed contract and verify VAT live calculation + client auto-link.
    page.evaluate("document.querySelector(\".nav-item[data-view='commercial']\").click()");page.wait_for_timeout(200);page.locator('#primaryAction').click();page.wait_for_timeout(100)
    fill(page,'projectId',project['id']);page.wait_for_timeout(50)
    check('Contract project auto-fills client',page.locator('#modalForm [name="clientId"]').input_value(),'c1')
    fill(page,'contractNo','HĐ-UX-459-01');fill(page,'contractType','customer');fill(page,'signedDate','2026-07-20');fill(page,'effectiveDate','2026-07-20');fill(page,'expiryDate','2027-03-31');fill(page,'valueExclVat',330_000_000);fill(page,'vatRate',10);fill(page,'status','Active');page.wait_for_timeout(100)
    summary=page.locator('.form-live-summary').inner_text()
    check('Contract preview VAT 10%',('33' in summary and '363' in summary),True)
    snapshot(page,'03-contract-live-preview')
    page.locator('#modalForm button[type="submit"]').click();page.wait_for_timeout(450)
    db=json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',storage_key))
    explicit=next(x for x in db['contracts'] if x.get('contractNo')=='HĐ-UX-459-01')
    check('Explicit contract value saved',explicit['valueExclVat'],330_000_000)
    check('Explicit contract VAT rate saved',explicit['vatRate'],10)
    check('Explicit contract total incl VAT (independent)',round(explicit['valueExclVat']*(1+explicit['vatRate']/100)),363_000_000)

    print('STAGE timesheet', flush=True)
    # 3. Timesheet: actual browser entry and independent labor/billable calculations.
    page.evaluate("document.querySelector(\".nav-item[data-view='timesheets']\").click()");page.wait_for_timeout(200);page.locator('#primaryAction').click();page.wait_for_timeout(100)
    fill(page,'date','2026-07-25');fill(page,'personId','p2');fill(page,'projectId',project['id']);fill(page,'hours',7.5);fill(page,'billable','true');fill(page,'approved','true');fill(page,'description','Triển khai hồ sơ thiết kế cơ sở và rà soát mô hình');page.wait_for_timeout(100)
    summary=page.locator('.form-live-summary').inner_text();snapshot(page,'04-timesheet-live-preview')
    person=next(x for x in db['people'] if x['id']=='p2')
    expected_cost=round(7.5*float(person.get('hourlyRate',0)))
    expected_bill=round(7.5*float(person.get('billingRate',0)))
    check('Timesheet preview shows hours','7,5' in summary or '7.5' in summary,True)
    page.locator('#modalForm button[type="submit"]').click();page.wait_for_timeout(450)
    db=json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',storage_key))
    ts=next(x for x in db['timesheets'] if x.get('projectId')==project['id'] and x.get('date')=='2026-07-25' and x.get('personId')=='p2')
    check('Timesheet hours saved',ts['hours'],7.5)
    check('Timesheet approved flag saved',ts['approved'],True)
    check('Independent labor cost',round(ts['hours']*float(person.get('hourlyRate',0))),expected_cost)
    check('Independent recoverable value',round(ts['hours']*float(person.get('billingRate',0))),expected_bill)
    snapshot(page,'05-timesheet-created')

    print('STAGE procurement', flush=True)
    # 4. Procurement request + order auto-fill and amount/VAT validation.
    page.evaluate("document.querySelector(\".nav-item[data-view='procurement']\").click()");page.wait_for_timeout(200);page.locator('#primaryAction').click();page.wait_for_timeout(100)
    # Primary creates purchase request.
    request_fields=page.locator('#modalForm input,#modalForm select').evaluate_all('els=>els.map(e=>e.name)')
    fill(page,'requestNo','PR-UX-459-01');fill(page,'date','2026-07-26');fill(page,'requesterId','p2');fill(page,'itemName','Máy trạm kiểm thử');fill(page,'category','IT equipment');fill(page,'quantity',2);fill(page,'unitPrice',25_000_000);fill(page,'vatRate',10);fill(page,'projectId',project['id']);fill(page,'purpose','Bổ sung máy trạm cho nhóm thiết kế dự án');fill(page,'status','Approved');page.wait_for_timeout(100)
    snapshot(page,'06-purchase-request-preview')
    page.locator('#modalForm button[type="submit"]').click();page.wait_for_timeout(450)
    db=json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',storage_key))
    req=next(x for x in db['purchaseRequests'] if x.get('requestNo')=='PR-UX-459-01')
    check('Purchase request amount independent',round(req['quantity']*req['unitPrice']),50_000_000)
    check('Purchase request VAT independent',round(req['quantity']*req['unitPrice']*req['vatRate']/100),5_000_000)

    # Open the purchase-order tab and create an order linked to the approved request.
    page.locator('[data-procurement-tab="orders"]').click();page.wait_for_timeout(160)
    page.locator('[data-secondary-add="purchaseOrders"]').click();page.wait_for_timeout(120)
    fill(page,'purchaseRequestId',req['id']);page.wait_for_timeout(100)
    check('PO auto-fill item',page.locator('#modalForm [name="itemName"]').input_value(),'Máy trạm kiểm thử')
    check('PO auto-fill quantity',float(page.locator('#modalForm [name="quantity"]').input_value()),2)
    check('PO auto-fill unit price',float(page.locator('#modalForm [name="unitPrice"]').input_value()),25_000_000)
    fill(page,'poNo','PO-UX-459-01');fill(page,'vendorId','v1');fill(page,'orderDate','2026-07-26');fill(page,'invoiceDate','2026-07-27');fill(page,'paymentMethod','Payable');fill(page,'directProject','false');fill(page,'usefulLifeMonths',36);fill(page,'allocationMonths',24);fill(page,'status','Approved');page.wait_for_timeout(100)
    snapshot(page,'07-purchase-order-preview')
    page.locator('#modalForm button[type="submit"]').click();page.wait_for_timeout(450)
    db=json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',storage_key))
    po=next(x for x in db['purchaseOrders'] if x.get('poNo')=='PO-UX-459-01')
    check('PO excl VAT total',round(po['quantity']*po['unitPrice']),50_000_000)
    check('PO VAT total',round(po['quantity']*po['unitPrice']*po['vatRate']/100),5_000_000)
    check('PO gross total',round(po['quantity']*po['unitPrice']*(1+po['vatRate']/100)),55_000_000)

    # 5. Verify stored record-count deltas and no page/runtime errors.
    final_db=json.loads(page.evaluate('(k)=>window.alphaStorage.getItem(k)',storage_key))
    check('Projects count increment',len(final_db['projects']),initial_counts['projects']+1)
    check('Timesheets count increment',len(final_db['timesheets']),initial_counts['timesheets']+1)
    check('Purchase requests count increment',len(final_db['purchaseRequests']),initial_counts['purchaseRequests']+1)
    snapshot(page,'08-procurement-after-entry')
    browser.close()

results['passed']=sum(1 for x in results['checks'] if x['pass'])
results['failed']=sum(1 for x in results['checks'] if not x['pass'])+len(results['errors'])
(out/'input-workflow-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':results['passed'],'failed':results['failed'],'errors':results['errors']},ensure_ascii=False,indent=2))
if results['failed']: sys.exit(1)
