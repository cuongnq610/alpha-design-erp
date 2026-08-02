#!/usr/bin/env node
import {existsSync,readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const exact=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const violations=[];
for(const group of ['dependencies','devDependencies','optionalDependencies']){
  for(const [name,version] of Object.entries(pkg[group]||{}))if(!exact.test(String(version)))violations.push(`${group}:${name}=${version}`);
}
if(pkg.packageManager!=='npm@10.9.2')violations.push(`packageManager=${pkg.packageManager||'missing'}`);
const lockExists=existsSync('package-lock.json');
if(violations.length){console.error(JSON.stringify({status:'failed',violations,lockExists},null,2));process.exit(1);}
const strict=process.argv.includes('--require-lock');
const result={status:lockExists?'passed':'warning',exactTopLevelVersions:true,packageManager:pkg.packageManager,lockExists,note:lockExists?'Dependency graph is locked.':'Generate package-lock.json on a connected trusted build machine, commit it, then run npm audit before production.'};
console.log(JSON.stringify(result,null,2));
if(strict&&!lockExists)process.exit(2);
