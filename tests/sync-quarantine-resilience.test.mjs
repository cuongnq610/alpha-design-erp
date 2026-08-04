import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sync=fs.readFileSync(path.join(root,'alpha-sync.bundle.js'),'utf8');

// Task 1: State carries a quarantine store
assert.ok(/outbox:\[\],conflicts:\{\},quarantine:\{\}/.test(sync),'Sync state must include a quarantine store');

// Task 1: A permanent-rejection classifier exists and recognises server validation SQLSTATEs
assert.ok(sync.includes('isPermanentReject'),'Sync must classify permanent server rejections');
assert.ok(sync.includes('22023')&&sync.includes('23505')&&sync.includes('23503'),'Classifier must recognise validation SQLSTATEs');

console.log('PASS phase1 task1: quarantine state + classifier present');
