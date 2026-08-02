'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../calculation-core.js');

function demoDB(){
  const src=fs.readFileSync('app.js','utf8');
  const marker='const demoData = ';
  const start=src.indexOf(marker)+marker.length;
  assert(start>=marker.length,'demoData marker missing');
  let depth=0,quote='',escaped=false,end=-1;
  for(let i=start;i<src.length;i++){
    const ch=src[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0){end=i+1;break;}
  }
  assert(end>start,'demoData end missing');
  const db=vm.runInNewContext('('+src.slice(start,end)+')',{});
  db.journalEntries=(db.journalEntries||[]).map(x=>C.statusIs(x.status,'posted')?{...x,postingHash:C.postingHash(x)}:x);
  db.toolAllocationSchedules=db.toolAllocationSchedules||[];
  db.depreciationSchedules=db.depreciationSchedules||[];
  return db;
}
let seq=0;
const id=p=>`${p}-audit-${++seq}`;
function addDraft(db,bp,sourceType,sourceId){
  const old=db.journalEntries.find(x=>x.sourceType===sourceType&&String(x.sourceId)===String(sourceId));
  if(old)return old;
  const entry={id:id('je'),date:bp.date,documentNo:`V430-${seq}`,description:bp.description,status:'Draft',sourceType,sourceId,lines:bp.lines.map(l=>({id:id('jl'),...l,debit:C.vnd(l.debit),credit:C.vnd(l.credit)}))};
  const check=C.entryValidation(db,entry,'');
  assert.equal(check.valid,true,check.errors.join('; '));
  db.journalEntries.unshift(entry);
  return entry;
}
function bootstrapProcurement(db){
  const poTotal=po=>C.vnd(Number(po.quantity||0)*Number(po.unitPrice||0));
  const expense=po=>po.directProject&&po.projectId?'154':'6422';
  for(const po of (db.purchaseOrders||[]).filter(x=>C.statusIs(x.status,'received','completed'))){
    if(!po.journalEntryId){
      const bp=C.purchaseJournalBlueprint({...po,totalExclVat:poTotal(po),expenseAccountCode:expense(po)},db.settings);
      po.journalEntryId=addDraft(db,bp,'purchase_order',po.id).id;
    }
  }
  for(const tool of db.tools||[]){
    let rows=db.toolAllocationSchedules.filter(x=>String(x.sourceId)===String(tool.id));
    if(!rows.length){rows=C.straightLineSchedule({sourceId:tool.id,startDate:tool.startDate,cost:tool.originalCost,residualValue:0,months:tool.allocationMonths,kind:'tool'});db.toolAllocationSchedules.push(...rows);}
    for(const row of rows){if(!row.journalEntryId){const bp=C.periodicJournalBlueprint({date:`${row.period}-28`,amount:row.amount,expenseAccountCode:tool.expenseAccountCode||'6422',creditAccountCode:'242',projectId:tool.projectId||'',description:`Phân bổ CCDC kỳ ${row.period}`});row.journalEntryId=addDraft(db,bp,'tool_allocation',`${row.sourceId}:${row.period}`).id;}}
  }
  for(const asset of db.fixedAssets||[]){
    let rows=db.depreciationSchedules.filter(x=>String(x.sourceId)===String(asset.id));
    if(!rows.length){rows=C.straightLineSchedule({sourceId:asset.id,startDate:asset.inServiceDate||asset.acquisitionDate,cost:asset.originalCost,residualValue:asset.residualValue||0,months:asset.usefulLifeMonths,kind:'asset'});db.depreciationSchedules.push(...rows);}
    for(const row of rows){if(!row.journalEntryId){const bp=C.periodicJournalBlueprint({date:`${row.period}-28`,amount:row.amount,expenseAccountCode:asset.expenseAccountCode||'6422',creditAccountCode:asset.depreciationAccountCode||'2141',projectId:asset.projectId||'',description:`Khấu hao TSCĐ kỳ ${row.period}`});row.journalEntryId=addDraft(db,bp,'asset_depreciation',`${row.sourceId}:${row.period}`).id;}}
  }
}

const db=demoDB();
bootstrapProcurement(db);
const repair=C.repairExactLinks(db);
assert.equal(repair.count,0,'Release fixture should already contain all deterministic links.');
assert(db.finance.filter(C.financePaid).every(row=>C.financeJournalMatch(db,row,db.journalEntries.find(entry=>entry.id===row.journalEntryId))),'Every Paid demo row must ship with exact Posted cash evidence.');
const range={from:'2026-01-01',to:'2026-12-31'};
const audit=C.financialLinkAudit(db,range);
assert.equal(audit.passCritical,true,JSON.stringify(audit.rows.filter(x=>!x.pass)));
assert.equal(audit.score,100);
const integrity=C.integrityChecks(db,range);
assert.equal(integrity.passCritical,true);

const pnl=C.profitAndLoss(db,range);
const cash=C.cashFlow(db,range);
const ledgerCash=C.ledgerCashFlow(db,range);
const b03=C.tt133B03Direct(db,range);
const commercial=C.contractRegisterSummary(db,range);
const portfolio=C.portfolioHealth(db,{to:range.to});
const position=C.financialPosition(db,range.to);
const aurora=C.projectFinancials(db,'pr1',{to:range.to});

assert.equal(pnl.revenue,204545455,'dashboard revenue must come only from Posted revenue accounts');
assert.equal(pnl.expenseBeforeTax,64363636,'Posted COGS must be included while Draft purchase entries remain excluded from actual P&L');
assert.equal(cash.net,cash.cashIn-cash.cashOut);
assert.equal(cash.cashIn,ledgerCash.inflow,'Paid management cash must reconcile to Posted ledger inflow');
assert.equal(cash.cashOut,ledgerCash.outflow,'Paid management cash must reconcile to Posted ledger outflow');
assert.equal(b03.net,cash.net,'B03 net cash and dashboard net cash must reconcile');
assert.equal(commercial.contractValue,portfolio.contractValue,'Commercial and project-control contract values must share committed contracts');
assert.equal(commercial.backlogNet,commercial.contractValue-commercial.invoicedNet);
assert.equal(portfolio.pipelineValue,420000000,'Proposal stays in pipeline and cannot inflate committed contract value');
assert.equal(aurora.actualCost,48000000,'Project control actual cost includes Posted WIP/direct project cost');
assert.equal(aurora.recognizedRevenue,pnl.revenue,'Project recognized revenue must reconcile to Posted revenue for the only active project');
assert.equal(aurora.receivable,0,'invoice allocation must clear project AR');
assert.equal(position.balanced,true);
assert.equal(position.balanceGap,0);
assert.equal(db.purchaseOrders.filter(x=>C.statusIs(x.status,'received','completed')).every(x=>x.journalEntryId),true);
assert.equal(db.toolAllocationSchedules.every(x=>x.journalEntryId),true);

console.log('PASS dashboard sources, formulas and cross-module links reconcile at 100/100');
