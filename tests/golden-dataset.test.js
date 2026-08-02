'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Calc=require('../calculation-core.js');
const root=path.join(__dirname,'..');
const file=path.join(root,'quality/golden/project-control-golden-dataset.json');
const spec=JSON.parse(fs.readFileSync(file,'utf8'));
const canonical=value=>JSON.stringify(value,Object.keys(value).sort());
function stable(value){
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')}}`;
  return JSON.stringify(value);
}
const hash='sha256:'+crypto.createHash('sha256').update(stable(spec.input)).digest('hex');
assert.equal(hash,spec.inputHash,'Golden input hash changed without approval');
const db=structuredClone(spec.input);
for(const entry of db.journalEntries)entry.postingHash=Calc.postingHash(entry);
const result=Calc.projectFinancials(db,spec.projectId,spec.range);
assert.equal(result.valid,true);
assert.equal(result.formulaVersion,spec.formulaVersion);
const differences=[];
for(const [key,expected] of Object.entries(spec.expected)){
  const actual=result[key];
  let tolerance=0;
  if(typeof expected==='number')tolerance=/rate|margin|progress|cpi|spi/i.test(key)?spec.tolerance.ratio:spec.tolerance.money;
  const pass=typeof expected==='number'?Math.abs(Number(actual)-expected)<=tolerance:actual===expected;
  if(!pass)differences.push({key,expected,actual,tolerance});
}
const output={caseCode:spec.caseCode,releaseVersion:spec.releaseVersion,formulaVersion:spec.formulaVersion,inputHash:hash,passed:differences.length===0,differences,actual:Object.fromEntries(Object.keys(spec.expected).map(k=>[k,result[k]]))};
if(process.env.GOLDEN_WRITE==='1')fs.writeFileSync(path.join(root,'quality/golden/project-control-golden-result.json'),JSON.stringify(output,null,2)+'\n');
assert.equal(output.passed,true,JSON.stringify(differences,null,2));
console.log(`PASS golden dataset ${spec.caseCode}: ${Object.keys(spec.expected).length} controlled outputs`);
