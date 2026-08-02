import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const exportsJs=read('export-center.js');
const cloud=read('cloud-v2.js');
const sync=read('alpha-sync.bundle.js');

assert.ok(exportsJs.includes("typeof v === 'string' && /^[\\t\\r\\n ]*[=+\\-@]/.test(s)"),'General CSV export must neutralize formula-leading text');
assert.ok(exportsJs.includes("s = `'${s}`"),'CSV mitigation must preserve user text by prefixing an apostrophe');
assert.ok(cloud.includes('safeCsvCell')&&cloud.includes('/^[\\t\\r\\n ]*[=+\\-@]/'),'Audit CSV must neutralize formula-leading text');

for(const ext of ['html','svg','js','exe','msi','bat','cmd','ps1','sh','jar']){
  assert.ok(cloud.includes(`'${ext}'`),`Cloud file UI must block ${ext}`);
  assert.ok(sync.includes(`"${ext}"`),`Low-level storage client must block ${ext}`);
}
for(const mime of ['text/html','image/svg+xml','application/javascript','application/x-msdownload']){
  assert.ok(cloud.includes(`'${mime}'`),`Cloud file UI must block ${mime}`);
  assert.ok(sync.includes(`"${mime}"`),`Low-level storage client must block ${mime}`);
}
assert.ok(cloud.includes('100*1024*1024'),'Cloud file size must remain capped at 100 MB');
assert.ok(sync.includes('company-files').toString(),'Storage must remain in the private company-files bucket');
console.log('PASS v4.5.4 CSV formula-injection mitigation and layered risky-upload blocking');
