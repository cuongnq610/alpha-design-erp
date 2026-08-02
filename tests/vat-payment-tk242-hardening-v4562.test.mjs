import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../calculation-core.js');

const invoice=(overrides={})=>({
  id:'inv-input',direction:'Input',date:'2026-07-01',dueDate:'2026-07-15',status:'Valid',
  partnerType:'vendor',partnerId:'vendor-a',taxCode:'0100000001',taxBase:300_000_000,
  vatRate:10,vatAmount:30_000_000,totalAmount:330_000_000,deductible:true,
  paymentMethod:'Bank',paymentStatus:'Paid',...overrides
});

const bankEvidence=(amount=330_000_000,overrides={})=>{
  const id=overrides.id||'pay-a',journalId=overrides.journalEntryId||`journal-${id}`;
  const vendorId=overrides.vendorId??'vendor-a',date=overrides.date||'2026-07-15',accountCode=overrides.accountCode||'1121';
  return {
    payment:{id,date,type:'Expense',status:'Paid',vendorId,invoiceId:'inv-input',amount,journalEntryId:journalId,...overrides},
    journal:{id:journalId,date,status:'Posted',partnerType:'vendor',partnerId:vendorId,lines:[
      {accountCode:'331',debit:amount,credit:0,partnerType:'vendor',partnerId:vendorId},
      {accountCode,debit:0,credit:amount}
    ]}
  };
};

const assessment=(taxInvoice,payments=[],journals=[],asOf='2026-07-31')=>C.vatInputDeductionAssessment({
  settings:{vatNonCashPaymentThreshold:5_000_000},vendors:[{id:'vendor-a',taxCode:'0100000001'},{id:'vendor-b',taxCode:'0100000002'}],
  taxInvoices:[taxInvoice],finance:payments,journalEntries:journals
},{from:'2026-07-01',to:'2026-07-31',asOf});

{
  const result=assessment(invoice());
  assert.equal(result.deductibleVat,0,'Manual Paid status without linked bank evidence must not deduct VAT');
  assert.equal(result.blockedRows.length,1);
}
{
  const evidence=bankEvidence();
  const result=assessment(invoice(),[evidence.payment],[evidence.journal]);
  assert.equal(result.deductibleVat,30_000_000,'Full linked bank payment must support full VAT');
  assert.equal(result.rows[0].eligible,true);
  assert.equal(result.rows[0].verifiedPaidGross,330_000_000);
}
{
  const evidence=bankEvidence(165_000_000);
  const result=assessment(invoice({paymentStatus:'Part-paid'}),[evidence.payment],[evidence.journal]);
  assert.equal(result.deductibleVat,15_000_000,'Partial payment must deduct VAT proportionally');
  assert.equal(result.rows[0].partial,true);
  assert.equal(result.partialRows.length,1);
  assert.equal(result.partialBlockedVat,15_000_000);
}
{
  const result=assessment(invoice({dueDate:'2026-08-15',paymentStatus:'Pending'}));
  assert.equal(result.deductibleVat,30_000_000,'Deferred invoice before due date remains provisionally deductible');
  assert.equal(result.rows[0].provisional,true);
}
{
  const evidence=bankEvidence(330_000_000,{date:'2026-08-01'});
  evidence.journal.date='2026-08-01';
  const result=assessment(invoice(),[evidence.payment],[evidence.journal]);
  assert.equal(result.deductibleVat,0,'Payment after the reporting cutoff must not leak into VAT evidence');
}
{
  const evidence=bankEvidence(330_000_000,{vendorId:'vendor-b'});
  const result=assessment(invoice(),[evidence.payment],[evidence.journal]);
  assert.equal(result.deductibleVat,0,'Payment to a different vendor must not support VAT deduction');
}
{
  const evidence=bankEvidence(330_000_000,{accountCode:'1111'});
  const result=assessment(invoice(),[evidence.payment],[evidence.journal]);
  assert.equal(result.deductibleVat,0,'Cash journal 111 must not masquerade as non-cash bank evidence');
}
{
  const first=bankEvidence(100_000_000,{id:'pay-1'}),second=bankEvidence(65_000_000,{id:'pay-2',date:'2026-07-16'});
  const result=assessment(invoice(),[first.payment,second.payment],[first.journal,second.journal]);
  assert.equal(result.deductibleVat,15_000_000,'Multiple linked payments must aggregate deterministically');
}
{
  const excessive=bankEvidence(331_000_000);
  const db={vendors:[{id:'vendor-a'}],taxInvoices:[invoice()],finance:[],journalEntries:[excessive.journal]};
  const control=C.inputInvoicePaymentConstraint(db,excessive.payment,'pay-new');
  assert.equal(control.valid,false,'Linked Paid amount above invoice total must be rejected');
}

const positionDb=(reportClass='')=>({
  settings:{fiscalYearStart:'01-01'},
  accounts:[
    {id:'a112',code:'1121',type:'Asset',normalSide:'Debit'},
    {id:'a242',code:'242',type:'Asset',normalSide:'Debit',reportClass},
    {id:'a331',code:'331',type:'Liability',normalSide:'Credit'},
    {id:'a411',code:'411',type:'Equity',normalSide:'Credit'}
  ],
  openingBalances:[
    {id:'ob1',asOfDate:'2026-01-01',accountCode:'1121',debit:100_000_000,credit:0},
    {id:'ob2',asOfDate:'2026-01-01',accountCode:'242',debit:23_000_000,credit:0},
    {id:'ob3',asOfDate:'2026-01-01',accountCode:'331',debit:0,credit:3_000_000},
    {id:'ob4',asOfDate:'2026-01-01',accountCode:'411',debit:0,credit:120_000_000}
  ],journalEntries:[]
});

{
  const db=positionDb(),position=C.financialPosition(db,'2026-07-31'),b01=C.tt133B01a(db,{from:'2026-01-01',to:'2026-07-31'});
  assert.equal(position.prepaidCurrent,0);
  assert.equal(position.prepaidLongTerm,23_000_000);
  assert.equal(position.currentAssets,b01.rows.find(row=>row.code==='100').end,'Default TK242 classification must match B01 current assets');
  assert.equal(position.longTermAssets,b01.rows.find(row=>row.code==='200').end,'Default TK242 classification must match B01 long-term assets');
}
{
  const db=positionDb('current_other_asset'),position=C.financialPosition(db,'2026-07-31'),b01=C.tt133B01a(db,{from:'2026-01-01',to:'2026-07-31'});
  assert.equal(position.prepaidCurrent,23_000_000);
  assert.equal(position.prepaidLongTerm,0);
  assert.equal(position.currentAssets,b01.rows.find(row=>row.code==='100').end,'Explicit current TK242 classification must match B01');
}

console.log('PASS v4.5.62 linked input-VAT payment evidence, proportional deduction and TK242 classification parity');
