'use strict';
const fs=require('fs');const vm=require('vm');const C=require(process.cwd()+'/calculation-core.js');
const src=fs.readFileSync('app.js','utf8');
const marker='const demoData = ';
const start=src.indexOf(marker)+marker.length;if(start<marker.length)throw new Error('demoData not found');
let i=start,depth=0,inStr='',esc=false,end=-1;
for(;i<src.length;i++){
 const ch=src[i];
 if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===inStr)inStr='';continue;}
 if(ch==='"'||ch==="'"||ch==='`'){inStr=ch;continue;}
 if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0){end=i+1;break;}}
}
const db=vm.runInNewContext('('+src.slice(start,end)+')',{});
db.journalEntries=(db.journalEntries||[]).map(x=>C.statusIs(x.status,'posted')?{...x,postingHash:C.postingHash(x)}:x);
db.toolAllocationSchedules=db.toolAllocationSchedules||[];db.depreciationSchedules=db.depreciationSchedules||[];
let seq=0;const id=(p)=>`${p}-audit-${++seq}`;
function poTotal(po){return C.vnd(Number(po.quantity||0)*Number(po.unitPrice||0));}
function expense(po){return po.directProject&&po.projectId?'154':'6422';}
function addJournal(bp,sourceType,sourceId){let ex=db.journalEntries.find(x=>x.sourceType===sourceType&&x.sourceId===sourceId);if(ex)return ex;const je={id:id('je'),date:bp.date,documentNo:`AUD-${seq}`,description:bp.description,status:'Draft',sourceType,sourceId,lines:bp.lines.map(l=>({id:id('jl'),...l,debit:C.vnd(l.debit),credit:C.vnd(l.credit)}))};const v=C.entryValidation(db,je,'');if(!v.valid)throw new Error(v.errors.join(';'));db.journalEntries.unshift(je);return je;}
for(const po of db.purchaseOrders.filter(x=>/received|completed/i.test(x.status||''))){if(!po.journalEntryId){const bp=C.purchaseJournalBlueprint({...po,totalExclVat:poTotal(po),expenseAccountCode:expense(po)},db.settings);po.journalEntryId=addJournal(bp,'purchase_order',po.id).id;}}
for(const tool of db.tools){let rows=db.toolAllocationSchedules.filter(x=>x.sourceId===tool.id);if(!rows.length){rows=C.straightLineSchedule({sourceId:tool.id,startDate:tool.startDate,cost:tool.originalCost,residualValue:0,months:tool.allocationMonths,kind:'tool'});db.toolAllocationSchedules.push(...rows);}for(const r of rows){if(!r.journalEntryId){const bp=C.periodicJournalBlueprint({date:`${r.period}-28`,amount:r.amount,expenseAccountCode:tool.expenseAccountCode||'6422',creditAccountCode:'242',projectId:tool.projectId||'',description:`Phân bổ CCDC kỳ ${r.period}`});r.journalEntryId=addJournal(bp,'tool_allocation',`${r.sourceId}:${r.period}`).id;}}}
for(const asset of db.fixedAssets){let rows=db.depreciationSchedules.filter(x=>x.sourceId===asset.id);if(!rows.length){rows=C.straightLineSchedule({sourceId:asset.id,startDate:asset.inServiceDate||asset.acquisitionDate,cost:asset.originalCost,residualValue:asset.residualValue||0,months:asset.usefulLifeMonths,kind:'asset'});db.depreciationSchedules.push(...rows);}for(const r of rows){if(!r.journalEntryId){const bp=C.periodicJournalBlueprint({date:`${r.period}-28`,amount:r.amount,expenseAccountCode:asset.expenseAccountCode||'6422',creditAccountCode:asset.depreciationAccountCode||'2141',projectId:asset.projectId||'',description:`Khấu hao TSCĐ kỳ ${r.period}`});r.journalEntryId=addJournal(bp,'asset_depreciation',`${r.sourceId}:${r.period}`).id;}}}
const before=C.financialLinkAudit(db,{from:'2026-01-01',to:'2026-12-31'});const repairs=C.repairExactLinks(db);const after=C.financialLinkAudit(db,{from:'2026-01-01',to:'2026-12-31'});
const ratios=C.financialRatios(db,{from:'2026-01-01',to:'2026-12-31'});
const forecasts={};for(const s of db.financialForecastScenarios){const f=C.financialForecast(db,{asOf:'2026-07-23',months:12,scenario:s});forecasts[s.name]={revenue:f.totalRevenue,profit:f.totalProfit,endingCash:f.endingCash,minCash:f.minCash,negativeCashMonth:f.negativeCashMonth,quality:f.quality};}
const integrity=C.integrityChecks(db,{from:'2026-01-01',to:'2026-12-31'});
const result={integrity,before:{score:before.score,critical:before.criticalIssues,warnings:before.warningIssues,failed:before.rows.filter(x=>!x.pass).map(x=>({id:x.id,label:x.label,linked:x.linked,total:x.total,detail:x.detail,severity:x.severity}))},repairs,after:{score:after.score,critical:after.criticalIssues,warnings:after.warningIssues,failed:after.rows.filter(x=>!x.pass).map(x=>({id:x.id,label:x.label,linked:x.linked,total:x.total,detail:x.detail,severity:x.severity}))},position:ratios.end,quality:ratios.quality,metrics:Object.fromEntries(ratios.metrics.map(x=>[x.id,{value:x.value,unit:x.unit,assessment:x.assessment}])),forecasts,counts:{journalEntries:db.journalEntries.length,purchaseOrders:db.purchaseOrders.length,tools:db.tools.length,toolSchedules:db.toolAllocationSchedules.length,fixedAssets:db.fixedAssets.length,depreciationSchedules:db.depreciationSchedules.length}};
console.log(JSON.stringify(result,null,2));
