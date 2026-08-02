import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[
  ...fs.readdirSync(path.join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort().map(x=>path.join(root,'supabase/migrations',x)),
  path.join(root,'SUPABASE_PRODUCTION_SCHEMA.sql')
];

function scanSql(text,file){
  let i=0,state='normal',dollar='',paren=0;
  const fail=(msg)=>assert.fail(`${path.basename(file)}: ${msg} near offset ${i}`);
  while(i<text.length){
    const c=text[i],n=text[i+1];
    if(state==='line'){if(c==='\n')state='normal';i++;continue;}
    if(state==='block'){
      if(c==='*'&&n==='/'){state='normal';i+=2;continue;}
      i++;continue;
    }
    if(state==='single'){
      if(c==="'"&&n==="'"){i+=2;continue;}
      if(c==="'"){state='normal';i++;continue;}
      i++;continue;
    }
    if(state==='double'){
      if(c==='"'&&n==='"'){i+=2;continue;}
      if(c==='"'){state='normal';i++;continue;}
      i++;continue;
    }
    if(state==='dollar'){
      if(text.startsWith(dollar,i)){i+=dollar.length;state='normal';dollar='';continue;}
      i++;continue;
    }
    if(c==='-'&&n==='-'){state='line';i+=2;continue;}
    if(c==='/'&&n==='*'){state='block';i+=2;continue;}
    if(c==="'"){state='single';i++;continue;}
    if(c==='"'){state='double';i++;continue;}
    if(c==='$'){
      const m=text.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if(m){dollar=m[0];state='dollar';i+=dollar.length;continue;}
    }
    if(c==='(')paren++;
    else if(c===')'){paren--;if(paren<0)fail('closing parenthesis has no opener');}
    i++;
  }
  assert.equal(state==='line'?'normal':state,'normal',`${path.basename(file)}: unclosed ${state} lexical construct`);
  assert.equal(paren,0,`${path.basename(file)}: unbalanced outer SQL parentheses (${paren})`);
  const createFns=(text.match(/create\s+or\s+replace\s+function\s+/gi)||[]).length;
  const functionTerminators=(text.match(/\$\$\s*;/g)||[]).length;
  assert.ok(functionTerminators>=createFns,`${path.basename(file)}: function body terminators (${functionTerminators}) below CREATE FUNCTION count (${createFns})`);
}
for(const f of files) scanSql(fs.readFileSync(f,'utf8'),f);
const migration=fs.readFileSync(path.join(root,'supabase/migrations/033_entity_payload_integrity_v453.sql'),'utf8');
for(const token of [
  'create or replace function app.validate_entity_payload',
  'create or replace function app.entity_record_guard',
  'create or replace function app.apply_entity_change',
  'grant execute on function public.apply_entity_change',
  'revoke insert,update,delete on public.entity_records from authenticated'
]) assert.ok(migration.toLowerCase().includes(token),`Migration 033 missing critical SQL token: ${token}`);
console.log(`PASS v4.5.4 SQL lexical integrity across ${files.length} migration/schema files`);
