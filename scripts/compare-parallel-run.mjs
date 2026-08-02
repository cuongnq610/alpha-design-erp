import fs from 'node:fs';
import path from 'node:path';
const input=process.argv[2]||'ops/parallel-run/PARALLEL_RUN_TEMPLATE.csv';
const output=process.argv[3]||'ops/parallel-run/PARALLEL_RUN_RESULT.json';
function parse(line){const cells=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;}cells.push(value);return cells;}
const lines=fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);const headers=parse(lines.shift());
const rows=lines.filter(Boolean).map(line=>Object.fromEntries(headers.map((h,i)=>[h,parse(line)[i]??''])));
let passed=0,failed=0;const results=rows.map(row=>{const excel=Number(row.excel_value),erp=Number(row.erp_value),abs=Math.abs(erp-excel),base=Math.max(1,Math.abs(excel)),pct=abs/base*100,tolAbs=Number(row.tolerance_abs||0),tolPct=Number(row.tolerance_pct||0);const ok=Number.isFinite(excel)&&Number.isFinite(erp)&&(abs<=tolAbs||pct<=tolPct);ok?passed++:failed++;return {...row,difference_abs:abs,difference_pct:pct,passed:ok};});
const report={generatedAt:new Date().toISOString(),input:path.resolve(input),summary:{total:results.length,passed,failed,passRate:results.length?passed/results.length*100:0},results};
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));if(failed)process.exitCode=1;
