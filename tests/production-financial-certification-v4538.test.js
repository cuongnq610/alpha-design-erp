const assert=require('node:assert/strict');
const C=require('../calculation-core.js');
const range={from:'2026-01-01',to:'2026-12-31'};
const db={settings:{accountingRegime:'TT133/2016/TT-BTC',fiscalYearStart:'01-01',currency:'VND'},accounts:[],openingBalances:[],journalEntries:[],taxInvoices:[],citAdjustments:[],reportNotesTT133:[]};
const codes=['I','II','III','IV','V','VI','VII','VIII'];
const make=(i)=>({id:`N${i}`,sectionCode:codes[i],periodFrom:range.from,periodTo:range.to,status:'approved',content:{text:`Statutory disclosure section ${codes[i]} with sufficient controlled content.`},contentSha256:`sha-${i}`,preparedBy:`preparer-${i}`,preparedAt:'2026-07-20T08:00:00Z',reviewedBy:`reviewer-${i}`,reviewedAt:'2026-07-21T08:00:00Z',approvedBy:`approver-${i}`,approvedAt:'2026-07-22T08:00:00Z',workflowVersion:1});
db.reportNotesTT133=codes.map((_,i)=>make(i));
let b09=C.tt133B09(db,range);
assert.equal(b09.complete,true);
assert.equal(b09.approvedCount,8);
assert.equal(b09.sections.every(x=>x.workflowComplete),true);

db.reportNotesTT133[0].reviewedBy=db.reportNotesTT133[0].preparedBy;
b09=C.tt133B09(db,range);
assert.equal(b09.complete,false,'same preparer/reviewer must fail segregation of duties');
assert.equal(b09.approvedCount,7);

db.reportNotesTT133[0]=make(0);
delete db.reportNotesTT133[1].contentSha256;
b09=C.tt133B09(db,range);
assert.equal(b09.complete,false,'missing server content hash must fail certification');

db.reportNotesTT133[1]=make(1);
db.reportNotesTT133[2].workflowComplete=false;
b09=C.tt133B09(db,range);
assert.equal(b09.complete,false,'explicit server workflow failure must be authoritative');
console.log('PASS v4.5.39 B09 three-level workflow and certification evidence');
