'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const C=require('../calculation-core.js');

const account=(code,type='Asset',normalSide='Debit')=>({code,name:code,type,normalSide,active:true,postable:true});
const row=(report,code)=>report.rows.find(item=>item.code===code);
const range={from:'2026-01-01',to:'2026-12-31'};

{
  const db={
    settings:{fiscalYearStart:'01-01',accountingRegime:'TT132/2018/TT-BTC (DNSN)'},
    accounts:[
      account('1111'),account('131'),account('152'),account('211'),account('214','Asset','Credit'),
      account('331','Liability','Credit'),account('33311','Liability','Credit'),account('3334','Liability','Credit'),
      account('4111','Equity','Credit'),account('421','Equity','Credit'),
      account('511','Revenue','Credit'),account('642','Expense'),account('821','Expense')
    ],
    openingBalances:[
      {accountCode:'1111',debit:100},{accountCode:'131',debit:20},{accountCode:'152',debit:30},{accountCode:'211',debit:50},
      {accountCode:'214',credit:10},{accountCode:'331',credit:40},{accountCode:'33311',credit:10},{accountCode:'4111',credit:100},{accountCode:'421',credit:40}
    ],
    journalEntries:[
      {id:'rev',date:'2026-03-01',documentNo:'DT-01',status:'Posted',lines:[{accountCode:'1111',debit:100,credit:0},{accountCode:'511',debit:0,credit:100}]},
      {id:'exp',date:'2026-03-02',documentNo:'CP-01',status:'Posted',lines:[{accountCode:'642',debit:30,credit:0},{accountCode:'1111',debit:0,credit:30}]},
      {id:'cit',date:'2026-12-20',documentNo:'TNDN-01',status:'Posted',lines:[{accountCode:'821',debit:14,credit:0},{accountCode:'3334',debit:0,credit:14}]},
      {id:'vatpay',date:'2026-12-25',documentNo:'VAT-01',status:'Posted',lines:[{accountCode:'33311',debit:5,credit:0},{accountCode:'1111',debit:0,credit:5}]}
    ]
  };
  const b01=C.tt132B01(db,range),b02=C.tt132B02(db,range),f01=C.tt132F01(db,range),f02=C.tt132F02(db,range),checks=C.tt132ReportChecks(db,range);
  assert.equal(b01.form,'B01-DNSN');
  assert.equal(b01.balanced,true);
  assert.equal(row(b01,'200').end,255);
  assert.equal(row(b01,'500').end,255);
  assert.equal(row(b01,'320').end,19);
  assert.equal(b02.form,'B02-DNSN');
  assert.equal(row(b02,'01').value,100);
  assert.equal(row(b02,'02').value,44);
  assert.equal(row(b02,'03').value,56);
  assert.equal(b02.formulaValid,true);
  assert.equal(f01.form,'F01-DNSN');
  assert.equal(f01.balanced,true);
  assert.equal(f02.form,'F02-DNSN');
  assert.equal(row(f02,'01').openingPayable,10);
  assert.equal(row(f02,'01').paid,5);
  assert.equal(row(f02,'01').endingPayable,5);
  assert.equal(row(f02,'02').arisingPayable,14);
  assert.equal(row(f02,'02').endingPayable,14);
  assert.equal(f02.reconciled,true);
  assert.equal(checks.pass,true,checks.checks.filter(x=>!x.pass).map(x=>x.detail).join('; '));
}

{
  const db={
    settings:{fiscalYearStart:'01-01',accountingRegime:'TT132/2018/TT-BTC (DNSN)'},
    accounts:[account('1111'),account('9111','Revenue','Credit'),account('9112','Expense'),account('4111','Equity','Credit')],
    openingBalances:[{accountCode:'1111',debit:100},{accountCode:'4111',credit:100}],
    journalEntries:[
      {id:'native-rev',date:'2026-02-01',documentNo:'N-01',status:'Posted',lines:[{accountCode:'1111',debit:50,credit:0},{accountCode:'9111',debit:0,credit:50}]},
      {id:'native-exp',date:'2026-02-02',documentNo:'N-02',status:'Posted',lines:[{accountCode:'9112',debit:20,credit:0},{accountCode:'1111',debit:0,credit:20}]}
    ]
  };
  const b02=C.tt132B02(db,range);
  assert.equal(row(b02,'01').value,50);
  assert.equal(row(b02,'02').value,20);
  assert.equal(row(b02,'03').value,30);
  assert.match(b02.mapping,/9111\/9112/);
}

const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const exportCenter=fs.readFileSync(path.join(__dirname,'..','export-center.js'),'utf8');
const manager=fs.readFileSync(path.join(__dirname,'..','statutory-template-manager.js'),'utf8');
assert.doesNotMatch(app,/bộ BCTC pháp định TT132 chưa nằm trong phạm vi phát hành/);
for(const form of ['B01-DNSN','B02-DNSN','F01-DNSN','F02-DNSN']){
  assert.match(app,new RegExp(form.replace('-','\\-')));
  assert.match(exportCenter,new RegExp(form.replace('-','\\-')));
  assert.match(manager,new RegExp(form.replace('-','\\-')));
}
assert.ok(fs.existsSync(path.join(__dirname,'..','templates','statutory','TT132_2026_BASELINE_TEMPLATE.json')));

console.log('PASS v4.5.61 TT132 statutory financial-report engine, UI and export package');
