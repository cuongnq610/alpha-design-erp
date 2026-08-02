import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=join(root,'FILE_MANIFEST_SHA256.txt');
if(!existsSync(manifestPath))throw new Error('Thiếu FILE_MANIFEST_SHA256.txt');
const lines=readFileSync(manifestPath,'utf8').split(/\r?\n/).filter(Boolean);
const expected=new Map(lines.map(line=>{const m=line.match(/^([a-f0-9]{64})  (.+)$/);if(!m)throw new Error(`Dòng manifest không hợp lệ: ${line}`);return[m[2],m[1]];}));
const actual=[];
const walk=dir=>{for(const name of readdirSync(dir)){if(name==='node_modules'||name==='.git'||name==='FILE_MANIFEST_SHA256.txt')continue;const full=join(dir,name),rel=relative(root,full).replaceAll('\\','/');if(statSync(full).isDirectory())walk(full);else actual.push(rel);}};
walk(root);
const errors=[];
for(const [rel,hash] of expected){const full=join(root,rel);if(!existsSync(full)){errors.push(`MISSING ${rel}`);continue;}const got=createHash('sha256').update(readFileSync(full)).digest('hex');if(got!==hash)errors.push(`HASH ${rel}`);}
for(const rel of actual)if(!expected.has(rel))errors.push(`UNLISTED ${rel}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`PASS manifest SHA-256: ${expected.size}/${expected.size} files; no unlisted release files`);
