import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('scripts/build-consolidated-schema.mjs','utf8');
assert.ok(src.includes("createHash('sha256')"),'Schema builder must calculate SHA-256');
assert.ok(src.includes("SUPABASE_PRODUCTION_SCHEMA.sql.sha256"),'Schema builder must update its checksum file atomically with schema generation');
for(const dir of ['tests','scripts']){
  for(const file of fs.readdirSync(dir)){
    const path=`${dir}/${file}`;if(!fs.statSync(path).isFile())continue;
    const text=fs.readFileSync(path,'utf8');
    assert.equal(text.includes('/mnt'+'/data/'),false,`${path} must not depend on an absolute container path`);
  }
}
console.log('PASS v4.5.21 reproducible schema checksum and container-independent test harness');
