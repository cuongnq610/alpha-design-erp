(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AlphaTaxCalendar=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const ISO=/^\d{4}-\d{2}-\d{2}$/;
  const pad=n=>String(n).padStart(2,'0');
  const iso=(year,month,day)=>`${year}-${pad(month)}-${pad(day)}`;
  const parse=value=>ISO.test(String(value||''))?new Date(`${value}T12:00:00`):null;
  const monthEnd=(year,month)=>new Date(year,month,0).getDate();
  const addMonths=(year,month,delta)=>{const d=new Date(year,month-1+delta,1);return {year:d.getFullYear(),month:d.getMonth()+1};};
  const stableKey=(taxType,period)=>`${String(taxType||'').trim().toUpperCase()}::${String(period||'').trim().toUpperCase()}`;
  const yearOfPeriod=period=>{const m=String(period||'').match(/(19|20)\d{2}/);return m?Number(m[0]):0;};
  const completed=row=>String(row?.filingStatus||'').toLowerCase()==='filed'&&['paid','no payment'].includes(String(row?.paymentStatus||'').toLowerCase())
    ||String(row?.filingStatus||'').toLowerCase()==='not required'&&(Number(row?.payableAmount||0)===0||String(row?.paymentStatus||'').toLowerCase()==='paid');

  function adjustBusinessDay(date,nonWorkingDates=[]){
    let d=parse(date);if(!d)return date;
    const blocked=new Set((nonWorkingDates||[]).filter(x=>ISO.test(String(x))));
    for(let guard=0;guard<14;guard++){
      const key=iso(d.getFullYear(),d.getMonth()+1,d.getDate());
      if(d.getDay()!==0&&d.getDay()!==6&&!blocked.has(key))return key;
      d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1,12,0,0);
    }
    return date;
  }

  function fallbackRules(frequency='Quarterly'){
    const quarterly=String(frequency).toLowerCase()!=='monthly';
    return [
      {id:'vat',taxType:'VAT',frequency:quarterly?'Quarterly':'Monthly',dueRule:quarterly?'last-day-next-quarter-month':'day-20-next-month',filingRequired:true,title:'Thuế GTGT'},
      {id:'pit',taxType:'PIT',frequency:quarterly?'Quarterly':'Monthly',dueRule:quarterly?'last-day-next-quarter-month':'day-20-next-month',filingRequired:true,title:'Thuế TNCN'},
      {id:'cit-provisional',taxType:'CIT provisional',frequency:'Quarterly',dueRule:'day-30-next-quarter-month',filingRequired:false,title:'Thuế TNDN tạm nộp'},
      {id:'annual-finalization',taxType:'Annual finalization',frequency:'Annual',dueRule:'last-day-third-month-next-year',filingRequired:true,title:'Quyết toán thuế năm'}
    ];
  }

  function rulesFromPackage(activePackage,frequency='Quarterly'){
    const pkg=activePackage?.package||activePackage||{};
    const rules=Array.isArray(pkg.calendarRules)?pkg.calendarRules:[];
    if(!rules.length)return fallbackRules(frequency);
    return rules.map(rule=>{
      if(String(rule.frequency||'').toLowerCase()!=='configured')return rule;
      const monthly=String(frequency||'').toLowerCase()==='monthly';
      return {...rule,frequency:monthly?'Monthly':'Quarterly',dueRule:monthly?(rule.monthlyDueRule||'day-20-next-month'):(rule.quarterlyDueRule||'last-day-next-quarter-month')};
    });
  }

  function dueDateFor(rule,year,index){
    const freq=String(rule.frequency||'').toLowerCase();
    if(freq==='monthly'){
      const target=addMonths(year,index,1);
      if(rule.dueRule==='last-day-next-month')return iso(target.year,target.month,monthEnd(target.year,target.month));
      return iso(target.year,target.month,Number(rule.dueDay||20));
    }
    if(freq==='quarterly'){
      const quarter=index;
      const lastMonth=quarter*3;
      const target=addMonths(year,lastMonth,1);
      if(rule.dueRule==='day-30-next-quarter-month')return iso(target.year,target.month,Number(rule.dueDay||30));
      return iso(target.year,target.month,monthEnd(target.year,target.month));
    }
    if(freq==='annual'){
      const month=Number(rule.dueMonth||3),day=rule.dueRule==='last-day-third-month-next-year'?monthEnd(year+1,month):Number(rule.dueDay||monthEnd(year+1,month));
      return iso(year+1,month,day);
    }
    return '';
  }

  function periodFor(rule,year,index){
    const freq=String(rule.frequency||'').toLowerCase();
    if(freq==='monthly')return `T${pad(index)}/${year}`;
    if(freq==='quarterly')return `Q${index}/${year}`;
    if(freq==='annual')return `FY${year}`;
    return String(rule.period||'');
  }

  function generateYear({year,frequency='Quarterly',activePackage=null,nonWorkingDates=[],amountResolver=null,generatedAt=''}={}){
    const y=Number(year);if(!Number.isInteger(y)||y<1900||y>9999)return [];
    const packageRules=rulesFromPackage(activePackage,frequency);
    const packageVersion=activePackage?.version||activePackage?.manifest?.version||activePackage?.package?.manifest?.version||'embedded-fallback';
    const rows=[];
    packageRules.forEach(rule=>{
      const freq=String(rule.frequency||'').toLowerCase();
      const count=freq==='monthly'?12:freq==='quarterly'?4:freq==='annual'?1:0;
      for(let i=1;i<=count;i++){
        const period=periodFor(rule,y,i),calendarKey=stableKey(rule.taxType,period);
        const dueDate=adjustBusinessDay(dueDateFor(rule,y,i),nonWorkingDates);
        const amount=typeof amountResolver==='function'?Number(amountResolver({rule,year:y,index:i,period,dueDate})||0):0;
        rows.push({
          id:`auto-tax-${calendarKey.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`,
          calendarKey,
          taxType:rule.taxType,
          period,
          frequency:rule.frequency,
          dueDate,
          filingStatus:rule.filingRequired===false?'Not required':'Not prepared',
          filedDate:'',
          payableAmount:Math.max(0,Math.round(amount)),
          paymentStatus:amount>0?'Unpaid':'No payment',
          paymentDate:'',
          referenceNo:'',
          notes:`Tự động tạo từ lịch thuế ${packageVersion}. Hạn được chuyển sang ngày làm việc tiếp theo khi rơi vào cuối tuần/ngày nghỉ đã cấu hình.`,
          source:'auto-calendar',
          calendarRuleId:rule.id||'',
          taxPackageVersion:packageVersion,
          generatedAt:generatedAt||new Date().toISOString()
        });
      }
    });
    return rows;
  }

  function merge(existing=[],generated=[],targetYears=[]){
    const years=new Set((targetYears||[]).map(Number));
    const generatedByKey=new Map(generated.map(x=>[x.calendarKey||stableKey(x.taxType,x.period),x]));
    const output=[];const consumed=new Set();
    for(const row of existing||[]){
      const key=row.calendarKey||stableKey(row.taxType,row.period),generatedRow=generatedByKey.get(key),year=yearOfPeriod(row.period);
      if(generatedRow){
        consumed.add(key);
        const keepDueDate=String(row.dueDateMode||'').toLowerCase()==='manual';
        const preserveCompletion=completed(row);
        output.push({
          ...generatedRow,
          ...row,
          calendarKey:key,
          dueDate:keepDueDate?row.dueDate:generatedRow.dueDate,
          payableAmount:preserveCompletion?Number(row.payableAmount||0):generatedRow.payableAmount,
          paymentStatus:preserveCompletion?row.paymentStatus:generatedRow.paymentStatus,
          filingStatus:preserveCompletion?row.filingStatus:(row.filingStatus&&row.filingStatus!=='Not prepared'?row.filingStatus:generatedRow.filingStatus),
          source:row.source||generatedRow.source,
          taxPackageVersion:generatedRow.taxPackageVersion,
          generatedAt:generatedRow.generatedAt
        });
        continue;
      }
      const staleAuto=String(row.source||'').toLowerCase()==='auto-calendar'&&years.has(year)&&!completed(row);
      if(!staleAuto)output.push(row);
    }
    generated.forEach(row=>{const key=row.calendarKey||stableKey(row.taxType,row.period);if(!consumed.has(key))output.push(row);});
    return output.sort((a,b)=>String(a.dueDate||'').localeCompare(String(b.dueDate||''))||String(a.taxType||'').localeCompare(String(b.taxType||'')));
  }

  function diffSignature(rows=[]){
    return JSON.stringify((rows||[]).map(x=>({calendarKey:x.calendarKey||stableKey(x.taxType,x.period),dueDate:x.dueDate,filingStatus:x.filingStatus,payableAmount:Number(x.payableAmount||0),paymentStatus:x.paymentStatus,source:x.source,taxPackageVersion:x.taxPackageVersion})));
  }

  return {adjustBusinessDay,fallbackRules,rulesFromPackage,dueDateFor,periodFor,generateYear,merge,diffSignature,stableKey,completed};
});
