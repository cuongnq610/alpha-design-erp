import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/033_entity_payload_integrity_v453.sql'),'utf8');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const marker='const demoData = ',start=source.indexOf(marker)+marker.length;
let i=start,depth=0,quote='',escaped=false,end=-1;
for(;i<source.length;i++){
  const ch=source[i];
  if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
  if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
  if(ch==='{')depth++;else if(ch==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>start,'Cannot extract demoData');
const db=vm.runInNewContext('('+source.slice(start,end)+')',{});
const branchPattern=/(?:if|elsif) p_collection='([^']+)' then\n([\s\S]*?)(?=\n\s*elsif p_collection|\n\s*else\n\s*raise exception 'UNVALIDATED_COLLECTION)/g;
const missing=[];let branch;
while((branch=branchPattern.exec(sql))){
  const [_,collection,segment]=branch,required=[];
  for(const fn of ['assert_required_text','assert_json_date','assert_json_month','assert_json_number']){
    const callPattern=new RegExp(`app\\.${fn}\\(p_payload,([\\s\\S]*?)\\);`,'g');let call;
    while((call=callPattern.exec(segment))){
      const compact=call[1].replace(/\s+/g,'');
      if(fn!=='assert_required_text'&&!compact.includes(',true,'))continue;
      const aliases=[...call[1].matchAll(/'([^']+)'/g)].map(x=>x[1]).slice(1);
      if(aliases.length)required.push({fn,aliases});
    }
  }
  for(const fn of ['assert_entity_ref','assert_account_code']){
    const callPattern=new RegExp(`app\\.${fn}\\(([\\s\\S]*?)\\);`,'g');let call;
    while((call=callPattern.exec(segment))){
      if(!call[1].replace(/\s+/g,'').includes(',true,'))continue;
      const jsonCall=call[1].match(/app\.json_text\(p_payload,([^)]*)\)/);
      if(jsonCall)required.push({fn,aliases:[...jsonCall[1].matchAll(/'([^']+)'/g)].map(x=>x[1])});
    }
  }
  const rows=db[collection];if(!Array.isArray(rows))continue;
  rows.forEach((row,index)=>required.forEach(req=>{
    const present=req.aliases.some(key=>Object.hasOwn(row,key)&&row[key]!==null&&String(row[key]).trim()!=='');
    if(!present)missing.push({collection,index,id:row.id||'',validator:req.fn,aliases:req.aliases});
  }));
}
assert.deepEqual(missing,[],'Demo/bootstrap records must satisfy every server-required payload field');
assert.ok(sql.includes("'grossIncome','gross_income','grossAmount','gross_amount'"),'PIT server validation must use the application gross-income field aliases');
assert.ok(sql.includes("'netPaid','net_paid','netAmount','net_amount'"),'PIT server validation must use the application net-paid field aliases');
assert.ok(sql.includes("'progress','progressPercent','progress_percent'"),'Project-stage server validation must use the application progress field aliases');
console.log('PASS v4.5.4 demo/bootstrap payloads are compatible with every required server-side field contract');
