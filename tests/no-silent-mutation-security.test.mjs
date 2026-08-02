import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('app.js'),cloud=read('cloud-v2.js'),sync=read('alpha-sync.bundle.js'),migration=read('supabase/migrations/033_entity_payload_integrity_v453.sql'),schema=read('SUPABASE_PRODUCTION_SCHEMA.sql');
const migrate=app.slice(app.indexOf('function migrateDB'),app.indexOf('function readStorage'));
assert.equal(migrate.includes('Calc.repairExactLinks'),false,'Loading data must not silently repair financial links');
assert.ok(app.includes("if(ENVIRONMENT==='demo')bootstrapProcurementAutomation();"),'Automatic procurement bootstrap must be restricted to Demo');
assert.equal(app.includes("db=migrateDB(e.detail.db);\n      bootstrapProcurementAutomation(false)"),false,'Remote Cloud pulls must not synthesize accounting records');
assert.ok(app.includes("if(!out.financialForecastScenarios.length&&ENVIRONMENT==='demo')"),'Production must not inject demo forecast assumptions');
assert.ok(app.includes("window.addEventListener('beforeunload'")&&app.includes('state?.outbox'),'Closing a tab with pending Cloud writes must be guarded');
assert.ok(cloud.includes("moveToTrash('documents'")&&!cloud.includes('deleteFile(coreDoc.storagePath)'),'Moving file metadata to trash must retain Cloud bytes, eliminating the former cross-system rollback window');
for(const marker of ['validate_entity_payload','entity_ref_exists','ID_MISMATCH','PAYLOAD_TOO_LARGE','UNBALANCED_JOURNAL','assert_operational_write_allowed','assert_entity_delete_safe'])assert.ok(migration.includes(marker),`Migration 033 missing ${marker}`);
assert.ok(schema.includes('SOURCE: 033_entity_payload_integrity_v453.sql'),'Consolidated schema must include migration 033');

assert.ok(sync.includes('104857600'),'Low-level Storage client must enforce the 100 MB ceiling');
assert.ok(sync.includes('normalize("NFKC")'),'Low-level Storage client must normalize filenames');

console.log('PASS v4.5.4 no-silent-mutation, pending-sync close guard, file rollback and server payload validation controls');
