import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(resolve(here,'runtime-libraries.json'),'utf8'));
for(const item of manifest.libraries){
  const path=resolve(here,item.localBundle);
  await access(path);
  const data=await readFile(path);
  console.log(`${item.name}: ${data.length} bytes · sha256 ${createHash('sha256').update(data).digest('hex')}`);
}
console.log('PASS: toàn bộ thư viện runtime bắt buộc hiện diện.');
