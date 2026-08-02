import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const apply=process.argv.includes('--apply');const full=process.argv.includes('--full');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const repairs=[];const unresolved=[];
function exactRepair(id,file,bad,good){let s=read(file);if(s.includes(bad)){if(apply){s=s.replace(bad,good);write(file,s);repairs.push({id,file,status:'applied'});}else repairs.push({id,file,status:'required'});}else if(s.includes(good))repairs.push({id,file,status:'already-correct'});else unresolved.push({id,file,reason:'precondition-mismatch'});}
exactRepair('CIT_50B_INCLUSIVE','calculation-core.js','{ maxRevenue: 50000000000, rate: 17, inclusive: false }','{ maxRevenue: 50000000000, rate: 17, inclusive: true }');
exactRepair('CIT_REVIEW_50B_INCLUSIVE','calculation-core.js','revenueBasis < 50000000000','revenueBasis <= 50000000000');
exactRepair('QA_CORE_KPI_SELECTOR','scripts/ui-structural-browser-audit-v4525.py',".dashboard-kpi-grid>.kpi-card",".dashboard-core-grid>.kpi-card");
function cleanup(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(e.name==='__pycache__'){if(apply)fs.rmSync(p,{recursive:true,force:true});repairs.push({id:'CLEAN_PY_CACHE',file:path.relative(root,p),status:apply?'applied':'required'});}else cleanup(p);}else if(/\.pyc$|(?:structural-rerun|browser-rerun)\.log$/i.test(e.name)){if(apply)fs.rmSync(p,{force:true});repairs.push({id:'CLEAN_TRANSIENT',file:path.relative(root,p),status:apply?'applied':'required'});}}}
cleanup(root);
if(unresolved.length){console.error(JSON.stringify({passed:false,repairs,unresolved},null,2));process.exit(2);}
if(!apply){console.log(JSON.stringify({passed:repairs.every(x=>x.status==='already-correct'),mode:'check',repairs,unresolved},null,2));process.exit(repairs.some(x=>x.status==='required')?1:0);}
const run=(cmd,args)=>{execFileSync(cmd,args,{cwd:root,stdio:'inherit',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});};
run(process.execPath,['scripts/build-consolidated-schema.mjs']);run(process.execPath,['scripts/build-public.mjs']);
run(process.execPath,['tests/deep-accounting-finance-v4567.test.mjs']);run(process.execPath,['tests/sql-deep-qa-autoheal-v4567.test.mjs']);
if(full)run('bash',['tests/run-release-audit.sh']);else run(process.execPath,['tests/release-package-integrity.test.mjs']);
const report={release:'4.5.67',mode:full?'apply-full':'apply-targeted',passed:true,policy:'allowlisted-deterministic-repairs-only; fail closed on unknown defects',repairs,unresolved};
fs.mkdirSync(path.join(root,'quality'),{recursive:true});write('quality/AUTO_HEAL_V4_5_67_RESULT.json',JSON.stringify(report,null,2)+'\n');
run(process.execPath,['scripts/generate-file-manifest.mjs']);run(process.execPath,['scripts/verify-file-manifest.mjs']);
console.log('AUTO_HEAL_PASS v4.5.67');
