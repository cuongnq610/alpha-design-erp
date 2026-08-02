import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const url=String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const secret=String(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const companyId=String(process.env.ALPHA_COMPANY_ID||'');
const periodFrom=String(process.env.PERIOD_FROM||'');
const periodTo=String(process.env.PERIOD_TO||'');
const releaseVersion=String(process.env.RELEASE_VERSION||'4.5.67');
const output=path.resolve(process.argv[2]||'quality/production-financial-gate-evidence.json');
if(!url||!secret||!companyId||!/^\d{4}-\d{2}-\d{2}$/.test(periodFrom)||!/^\d{4}-\d{2}-\d{2}$/.test(periodTo)){
  throw new Error('Cần SUPABASE_URL, SUPABASE_SECRET_KEY/SERVICE_ROLE_KEY, ALPHA_COMPANY_ID, PERIOD_FROM và PERIOD_TO.');
}
const headers={apikey:secret,'content-type':'application/json',...(!secret.startsWith('sb_')?{Authorization:`Bearer ${secret}`}:{})};
async function request(endpoint,{method='GET',body}={}){
  const response=await fetch(`${url}${endpoint}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const text=await response.text();let data=text;try{data=text?JSON.parse(text):null;}catch{}
  if(!response.ok)throw new Error(`${method} ${endpoint} -> ${response.status}: ${typeof data==='string'?data:JSON.stringify(data)}`);
  return data;
}
const enc=encodeURIComponent;
const result={releaseVersion,companyId,periodFrom,periodTo,checkedAt:new Date().toISOString(),checks:[],pass:false};
function check(code,pass,details){result.checks.push({code,pass:Boolean(pass),details});return Boolean(pass);}
let certification=null,notes=[];
try{
  const versions=await request(`/rest/v1/schema_versions?version=eq.${enc(releaseVersion)}&select=version,applied_at&limit=1`);
  check('SCHEMA_VERSION',Array.isArray(versions)&&versions.length===1,versions);
  const certs=await request(`/rest/v1/statutory_report_certifications?company_id=eq.${enc(companyId)}&period_from=eq.${enc(periodFrom)}&period_to=eq.${enc(periodTo)}&release_version=eq.${enc(releaseVersion)}&status=eq.active&select=*&order=certified_at.desc&limit=1`);
  certification=Array.isArray(certs)?certs[0]:null;
  check('ACTIVE_CERTIFICATION',Boolean(certification),certification||'missing');
  check('CERT_NOT_EXPIRED',Boolean(certification?.expires_at)&&new Date(certification.expires_at)>new Date(),certification?.expires_at||'missing');
  check('MIGRATION_VERSION',Number(certification?.migration_version)===73,certification?.migration_version);
  check('B09_CERT_COUNT',Number(certification?.b09_approved_count)===8,certification?.b09_approved_count);
  notes=await request(`/rest/v1/report_notes_tt133?company_id=eq.${enc(companyId)}&period_from=eq.${enc(periodFrom)}&period_to=eq.${enc(periodTo)}&select=section_code,status,content_sha256,prepared_by,prepared_at,reviewed_by,reviewed_at,approved_by,approved_at,workflow_version&order=section_code.asc`);
  const required=['I','II','III','IV','V','VI','VII','VIII'];
  const byCode=new Map((Array.isArray(notes)?notes:[]).map(x=>[x.section_code,x]));
  const workflowFailures=[];
  for(const code of required){
    const n=byCode.get(code);
    const actors=n?[n.prepared_by,n.reviewed_by,n.approved_by]:[];
    const valid=Boolean(n&&n.status==='approved'&&n.content_sha256&&n.prepared_at&&n.reviewed_at&&n.approved_at&&actors.every(Boolean)&&new Set(actors).size===3);
    if(!valid)workflowFailures.push(code);
  }
  check('B09_THREE_LEVEL_WORKFLOW',workflowFailures.length===0,{failedSections:workflowFailures,count:8-workflowFailures.length});
}catch(error){
  result.error=error.message||String(error);
  check('PIPELINE_EXECUTION',false,result.error);
}
result.pass=result.checks.every(x=>x.pass);
const summary={period_from:periodFrom,period_to:periodTo,certification_id:certification?.id||null,certified_at:certification?.certified_at||null,expires_at:certification?.expires_at||null,b09_sections:Array.isArray(notes)?notes.length:0,checks:result.checks};
const checksum=createHash('sha256').update(JSON.stringify(summary)).digest('hex');
result.checksumSha256=checksum;
try{
  await request('/rest/v1/rpc/record_release_gate_pipeline',{method:'POST',body:{p_company:companyId,p_release:releaseVersion,p_gate_code:'financial_statutory',p_status:result.pass?'passed':'failed',p_summary:summary,p_evidence_uri:null,p_checksum_sha256:checksum,p_expires_at:certification?.expires_at||null}});
  result.gateRecorded=true;
}catch(error){result.gateRecorded=false;result.gateRecordError=error.message||String(error);result.pass=false;}
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({pass:result.pass,gateRecorded:result.gateRecorded,output,checks:result.checks.length},null,2));
if(!result.pass)process.exitCode=1;
