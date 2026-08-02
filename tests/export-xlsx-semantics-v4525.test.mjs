import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {TextEncoder} from 'node:util';

const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('../export-center.js',import.meta.url),'utf8');
const context={
  console, TextEncoder, Uint8Array, ArrayBuffer, DataView, Blob, Date, Intl, Math,
  setTimeout, clearTimeout,
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000000'},
  ALPHA_RUNTIME_CONFIG:{releaseVersion:'4.5.25'},
};
context.window=context;
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'export-center.js'});
const api=context.AlphaExportCenter;
assert.ok(api?.makeXlsx,'AlphaExportCenter.makeXlsx is unavailable');

const bytes=api.makeXlsx({sheets:[{
  name:'Semantics', title:'Semantic round-trip',
  columns:[{key:'date',label:'Ngày',type:'date'},{key:'utilization',label:'Utilization',type:'percent'}],
  rows:[{date:'2026-07-28',utilization:80}]
}]},{company:'ALPHA DESIGN',range:{from:'2026-07-01',to:'2026-07-31'}});

function readStoredZip(input){
  const buffer=Buffer.from(input);const files=new Map();let at=0;
  while(at+30<=buffer.length&&buffer.readUInt32LE(at)===0x04034b50){
    const method=buffer.readUInt16LE(at+8),size=buffer.readUInt32LE(at+18),nameLen=buffer.readUInt16LE(at+26),extraLen=buffer.readUInt16LE(at+28);
    assert.equal(method,0,'Fixture XLSX must use STORE method');
    const nameStart=at+30,dataStart=nameStart+nameLen+extraLen;
    const name=buffer.subarray(nameStart,nameStart+nameLen).toString('utf8');
    files.set(name,buffer.subarray(dataStart,dataStart+size));
    at=dataStart+size;
  }
  return files;
}
const files=readStoredZip(bytes);
const sheet=files.get('xl/worksheets/sheet1.xml')?.toString('utf8')||'';
const styles=files.get('xl/styles.xml')?.toString('utf8')||'';
assert.ok(sheet&&styles,'Generated XLSX is missing worksheet/styles');
const date=sheet.match(/<c r="A7" s="4"><v>([^<]+)<\/v><\/c>/);
const percent=sheet.match(/<c r="B7" s="7"><v>([^<]+)<\/v><\/c>/);
assert.ok(date,'Date cell A7 is not numeric with date style');
assert.ok(percent,'Percent cell B7 is not numeric with percent style');
assert.equal(Number(percent[1]),0.8,'80 percent must be stored as 0.8');
const expectedSerial=Date.UTC(2026,6,28)/86400000+25569;
assert.equal(Number(date[1]),expectedSerial,'ISO date must be stored as a real Excel serial');
assert.match(styles,/numFmtId="165" formatCode="dd\/mm\/yyyy"/);
assert.match(styles,/numFmtId="166" formatCode="0\.00%"/);
assert.doesNotMatch(source,/ALPHA DESIGN ERP Cloud v4\.5\.21/);
assert.match(source,/releaseVersion\(\)/);
console.log('PASS v4.5.25 XLSX date, percent and dynamic export-version semantics');
