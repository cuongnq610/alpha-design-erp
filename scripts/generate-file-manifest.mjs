import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputName='FILE_MANIFEST_SHA256.txt';
const files=[];

const walk=dir=>{
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='.git'||entry.name==='node_modules'||entry.name===outputName)continue;
    const full=join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(lstatSync(full).isSymbolicLink())throw new Error(`Refusing symlink in release manifest: ${relative(root,full)}`);
    files.push(relative(root,full).replaceAll('\\','/'));
  }
};

walk(root);
files.sort((a,b)=>a.localeCompare(b,'en'));
const lines=files.map(rel=>`${createHash('sha256').update(readFileSync(join(root,rel))).digest('hex')}  ${rel}`);
writeFileSync(join(root,outputName),`${lines.join('\n')}\n`);
console.log(`MANIFEST_GENERATED ${files.length} files -> ${outputName}`);
