'use strict';
const assert = require('assert');
const C = require('../calculation-core.js');

const account = (code,type='Asset',normalSide='Debit',extra={}) => ({code,name:code,type,normalSide,active:true,postable:true,...extra});
const base = () => ({
  settings:{fiscalYearStart:'01-01',accountingRegime:'TT133/2016/TT-BTC',currency:'VND'},
  accounts:[],openingBalances:[],journalEntries:[],accountingPeriods:[],reportNotesTT133:[]
});
const row = (report,code) => report.rows.find(x=>x.code===code);

// Regression F-03: TK 217/2147 must stay together as investment property, never create negative fixed assets.
{
  const db=base();
  db.accounts=[account('217'),account('2147','Asset','Credit'),account('411','Equity','Credit')];
  db.openingBalances=[
    {accountCode:'217',debit:1_000_000_000,credit:0},
    {accountCode:'2147',debit:0,credit:200_000_000},
    {accountCode:'411',debit:0,credit:800_000_000}
  ];
  const b01=C.tt133B01a(db,{from:'2026-04-01',to:'2026-06-30'});
  assert.equal(row(b01,'220').end,0,'TK 2147 must not reduce fixed assets');
  assert.equal(row(b01,'230').end,800_000_000,'Investment property must be net of TK 2147');
  assert.equal(row(b01,'250').end,0,'TK 217 must not be reported as long-term financial investment');
  assert.equal(b01.balanced,true);
  assert.equal(b01.classificationValid,true);
}

// Regression F-01/F-02: TK 242/244 appear once; current classification is explicit, otherwise long-term.
{
  const db=base();
  db.accounts=[account('242'),account('244'),account('411','Equity','Credit')];
  db.openingBalances=[
    {accountCode:'242',debit:100_000_000,credit:0},
    {accountCode:'244',debit:50_000_000,credit:0},
    {accountCode:'411',debit:0,credit:150_000_000}
  ];
  let b01=C.tt133B01a(db,{from:'2026-04-01',to:'2026-06-30'});
  assert.equal(row(b01,'150').end,0);
  assert.equal(row(b01,'260').end,150_000_000);
  assert.equal(row(b01,'270').end,150_000_000,'242/244 must not be double counted');
  db.accounts.find(x=>x.code==='242').reportClass='current_other_asset';
  b01=C.tt133B01a(db,{from:'2026-04-01',to:'2026-06-30'});
  assert.equal(row(b01,'150').end,100_000_000);
  assert.equal(row(b01,'260').end,50_000_000);
  assert.equal(row(b01,'270').end,150_000_000);
  assert.equal(b01.fiscalStart,'2026-01-01','Opening column must be anchored to fiscal-year start, not filter start');
}

// B02/B03 must expose a comparable prior-year column.
{
  const db=base();
  db.accounts=[account('1121'),account('131'),account('5113','Revenue','Credit')];
  db.journalEntries=[
    {id:'j25',date:'2025-02-01',documentNo:'PT25',status:'Posted',cashFlowCode:'01',lines:[{accountCode:'1121',debit:50_000_000,credit:0},{accountCode:'5113',debit:0,credit:50_000_000}]},
    {id:'j26',date:'2026-02-01',documentNo:'PT26',status:'Posted',cashFlowCode:'01',lines:[{accountCode:'1121',debit:80_000_000,credit:0},{accountCode:'5113',debit:0,credit:80_000_000}]}
  ];
  const b02=C.tt133B02(db,{from:'2026-01-01',to:'2026-06-30'});
  assert.equal(row(b02,'01').value,80_000_000);
  assert.equal(row(b02,'01').previous,50_000_000);
  const b03=C.tt133B03Direct(db,{from:'2026-01-01',to:'2026-06-30'});
  assert.equal(row(b03,'01').value,80_000_000);
  assert.equal(row(b03,'01').previous,50_000_000);
}

// Regression F-08: wrong B03 direction is rejected before posting.
{
  const db=base();
  db.accounts=[account('1121'),account('131')];
  const entry={id:'x',date:'2026-07-01',documentNo:'PT-001',status:'Posted',cashFlowCode:'02',lines:[{accountCode:'1121',debit:100_000_000,credit:0},{accountCode:'131',debit:0,credit:100_000_000}]};
  const invalid=C.entryValidation(db,entry);
  assert.equal(invalid.valid,false);
  assert.ok(invalid.errors.some(x=>x.includes('sai chiều')));
  const valid=C.entryValidation(db,{...entry,cashFlowCode:'01'});
  assert.equal(valid.valid,true,valid.errors.join('; '));
}

// Regression F-05: all eight note sections must be approved for a complete B09.
{
  const db=base();
  const codes=['I','II','III','IV','V','VI','VII','VIII'];
  db.reportNotesTT133=codes.map((sectionCode,i)=>({id:`n${i}`,sectionCode,periodFrom:'2026-01-01',periodTo:'2026-12-31',status:'approved',content:{text:`Section ${sectionCode} contains complete statutory disclosure content.`},contentSha256:`hash-${i}`,preparedBy:`preparer-${i}`,preparedAt:'2026-07-20T08:00:00Z',reviewedBy:`reviewer-${i}`,reviewedAt:'2026-07-21T08:00:00Z',approvedBy:`approver-${i}`,approvedAt:'2026-07-22T08:00:00Z'}));
  let b09=C.tt133B09(db,{from:'2026-01-01',to:'2026-12-31'});
  assert.equal(b09.complete,true);
  assert.equal(b09.approvedCount,8);
  db.reportNotesTT133[0].status='reviewed';
  b09=C.tt133B09(db,{from:'2026-01-01',to:'2026-12-31'});
  assert.equal(b09.complete,false);
  assert.equal(b09.approvedCount,7);
}

// Regression F-07: client/cloud parity fails on missing or different statutory rows.
{
  const client={form:'B01a-DNN',rows:[{code:'270',start:100,end:120},{code:'440',start:100,end:120}]};
  assert.equal(C.tt133ReportParity(client,[{code:'270',opening_amount:100,ending_amount:120},{code:'440',opening_amount:100,ending_amount:120}]).pass,true);
  const mismatch=C.tt133ReportParity(client,[{code:'270',opening_amount:100,ending_amount:121}]);
  assert.equal(mismatch.pass,false);
  assert.ok(mismatch.differences.some(x=>x.code==='270'));
  assert.ok(mismatch.differences.some(x=>x.code==='440'));
}

console.log('PASS v4.5.39 financial reporting integrity regression suite');
