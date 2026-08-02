(() => {
  'use strict';
  const PACKAGE_TYPE='alpha-vn-tax-compliance-package',SCHEMA_VERSION=1;
  const REQUIRED_MANIFEST=['packageId','version','name','effectiveFrom','jurisdiction'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const safeDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
  const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
  const sha256=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text||''))))].map(x=>x.toString(16).padStart(2,'0')).join('');
  async function parseFile(file){
    if(!file)throw new Error('Chưa chọn gói cập nhật thuế.');
    if(!String(file.name||'').toLowerCase().endsWith('.json'))throw new Error('Phiên bản này chỉ nhận gói thuế JSON đã ký kiểm soát. ZIP phải được chuyển thành JSON trước khi nhập.');
    return JSON.parse(await file.text());
  }
  function containsExecutable(value){return /<script|javascript:|\beval\s*\(|\bFunction\s*\(|=>|\bfunction\b/i.test(JSON.stringify(value));}
  async function validatePackage(input){
    const pkg=clone(input||{}),errors=[],warnings=[],m=pkg.manifest||{};
    if(m.packageType!==PACKAGE_TYPE)errors.push(`manifest.packageType phải là ${PACKAGE_TYPE}.`);
    if(Number(m.schemaVersion)!==SCHEMA_VERSION)errors.push(`schemaVersion phải bằng ${SCHEMA_VERSION}.`);
    REQUIRED_MANIFEST.forEach(k=>{if(!String(m[k]||'').trim())errors.push(`Thiếu manifest.${k}.`);});
    if(!safeDate(m.effectiveFrom))errors.push('effectiveFrom phải có dạng YYYY-MM-DD.');
    if(m.effectiveTo&&!safeDate(m.effectiveTo))errors.push('effectiveTo phải có dạng YYYY-MM-DD.');
    if(m.effectiveTo&&m.effectiveTo<m.effectiveFrom)errors.push('effectiveTo không được trước effectiveFrom.');
    if(String(m.jurisdiction).toUpperCase()!=='VN')errors.push('Gói hiện chỉ hỗ trợ jurisdiction VN.');
    if(!Array.isArray(pkg.forms)||!pkg.forms.length)errors.push('Gói phải có ít nhất một biểu mẫu thuế.');
    const formCodes=new Set();
    (pkg.forms||[]).forEach((form,i)=>{
      const code=String(form.code||'').trim();
      if(!code)errors.push(`Biểu mẫu ${i+1} thiếu code.`);else if(formCodes.has(code))errors.push(`Trùng mã biểu mẫu ${code}.`);formCodes.add(code);
      if(!String(form.title||'').trim())errors.push(`${code||`Biểu mẫu ${i+1}`}: thiếu title.`);
      if(!Array.isArray(form.fields))errors.push(`${code}: fields phải là mảng.`);
      const fieldCodes=new Set();
      (form.fields||[]).forEach((field,j)=>{const fc=String(field.code||'').trim();if(!fc)errors.push(`${code}: trường ${j+1} thiếu code.`);else if(fieldCodes.has(fc))errors.push(`${code}: trùng trường ${fc}.`);fieldCodes.add(fc);if(field.formula||field.script||field.javascript)errors.push(`${code}/${fc}: không cho phép công thức hoặc mã lệnh trong gói thuế.`);});
    });
    if(pkg.calendarRules!==undefined&&!Array.isArray(pkg.calendarRules))errors.push('calendarRules phải là mảng.');
    const ruleIds=new Set(),allowedFrequencies=new Set(['monthly','quarterly','annual','configured']),allowedDueRules=new Set(['day-20-next-month','last-day-next-month','last-day-next-quarter-month','day-30-next-quarter-month','last-day-third-month-next-year']);
    (pkg.calendarRules||[]).forEach((rule,index)=>{
      const label=`Quy tắc lịch ${index+1}`,id=String(rule.id||'').trim(),frequency=String(rule.frequency||'').toLowerCase();
      if(!id)errors.push(`${label}: thiếu id.`);else if(ruleIds.has(id))errors.push(`${label}: trùng id ${id}.`);ruleIds.add(id);
      if(!String(rule.taxType||'').trim())errors.push(`${label}: thiếu taxType.`);
      if(!allowedFrequencies.has(frequency))errors.push(`${label}: frequency không được hỗ trợ.`);
      if(frequency==='configured'){
        if(!allowedDueRules.has(String(rule.monthlyDueRule||'')))errors.push(`${label}: monthlyDueRule không hợp lệ.`);
        if(!allowedDueRules.has(String(rule.quarterlyDueRule||'')))errors.push(`${label}: quarterlyDueRule không hợp lệ.`);
      }else if(!allowedDueRules.has(String(rule.dueRule||'')))errors.push(`${label}: dueRule không hợp lệ.`);
    });
    if(!Array.isArray(pkg.calendarRules)||!pkg.calendarRules.length)warnings.push('Gói chưa có calendarRules; hệ thống sẽ dùng lịch mặc định nội bộ.');
    if(pkg.nonWorkingDates!==undefined&&(!Array.isArray(pkg.nonWorkingDates)||pkg.nonWorkingDates.some(date=>!safeDate(date))))errors.push('nonWorkingDates phải là mảng ngày YYYY-MM-DD.');
    if(!Array.isArray(pkg.legalReferences)||!pkg.legalReferences.length)warnings.push('Gói chưa khai báo căn cứ pháp lý.');
    if(!pkg.xmlProfiles||typeof pkg.xmlProfiles!=='object')warnings.push('Gói chưa có hồ sơ XML; chỉ dùng cho nhập liệu/kiểm soát, chưa dùng nộp cơ quan thuế.');
    if(containsExecutable(pkg))errors.push('Gói chứa nội dung có dấu hiệu thực thi mã.');
    const packageSha256=await sha256(canonical(pkg));
    return {valid:!errors.length,errors,warnings,packageSha256,normalized:pkg};
  }
  function getActivePackage(db,date=new Date().toISOString().slice(0,10)){
    const list=Array.isArray(db?.taxCompliancePackages)?db.taxCompliancePackages:[];
    const direct=list.find(x=>String(x.id)===String(db?.settings?.activeTaxCompliancePackageId||'')&&x.status==='active'&&x.effectiveFrom<=date&&(!x.effectiveTo||x.effectiveTo>=date));
    return direct||list.filter(x=>x.status==='active'&&x.effectiveFrom<=date&&(!x.effectiveTo||x.effectiveTo>=date)).sort((a,b)=>String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0]||null;
  }
  function install(db,validation,actor='Người dùng'){
    if(!validation?.valid)throw new Error((validation?.errors||['Gói thuế không hợp lệ.']).join('\n'));
    db.taxCompliancePackages=Array.isArray(db.taxCompliancePackages)?db.taxCompliancePackages:[];
    const m=validation.normalized.manifest;
    if(db.taxCompliancePackages.some(x=>x.packageId===m.packageId&&x.version===m.version))throw new Error('Gói cùng packageId và version đã tồn tại.');
    const rec={id:`tcp-${crypto.randomUUID?crypto.randomUUID():Date.now()}`,packageId:m.packageId,version:m.version,name:m.name,jurisdiction:m.jurisdiction,effectiveFrom:m.effectiveFrom,effectiveTo:m.effectiveTo||'',authority:m.authority||'',packageSha256:validation.packageSha256,status:'candidate',importedAt:new Date().toISOString(),importedBy:actor,validationWarnings:validation.warnings,package:validation.normalized};
    db.taxCompliancePackages.unshift(rec);return rec;
  }
  function activate(db,id,actor='Người dùng'){
    const list=Array.isArray(db.taxCompliancePackages)?db.taxCompliancePackages:[],target=list.find(x=>String(x.id)===String(id));
    if(!target)throw new Error('Không tìm thấy gói thuế.');
    list.forEach(x=>{if(x.status==='active')x.status='inactive';});target.status='active';target.activatedAt=new Date().toISOString();target.activatedBy=actor;db.settings.activeTaxCompliancePackageId=target.id;return target;
  }
  function resolveForm(db,formCode,date){const p=getActivePackage(db,date);return p?.package?.forms?.find(x=>String(x.code)===String(formCode))||null;}
  window.AlphaTaxCompliancePackageManager={PACKAGE_TYPE,SCHEMA_VERSION,parseFile,validatePackage,getActivePackage,install,activate,rollback:activate,resolveForm,canonical};
})();
