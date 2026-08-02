import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const file of ['app.js','cloud-v2.js','export-center.js']){
  const src=fs.readFileSync(file,'utf8');
  assert.ok(src.includes('crypto?.randomUUID?.()'),`${file} must prefer cryptographic UUIDs`);
}
console.log('PASS v4.5.21 cryptographic identifier generation with compatibility fallback');
