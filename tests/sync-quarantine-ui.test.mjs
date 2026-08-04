import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cloud=fs.readFileSync(path.join(root,'cloud-v2.js'),'utf8');

// Cloud admin surfaces quarantined records and wires retry/discard through the sync API
assert.ok(cloud.includes('quarantine=Object.values(syncState.quarantine||{})'),'Cloud admin must read the quarantine store from sync status');
assert.ok(cloud.includes('Bản ghi bị từ chối'),'Cloud admin must render a rejected-records panel');
assert.ok(cloud.includes('retry-quarantine')&&cloud.includes('discard-quarantine'),'Panel must offer retry and discard actions');
assert.ok(cloud.includes('window.AlphaOnline.retryQuarantine')&&cloud.includes('window.AlphaOnline.discardQuarantine'),'Buttons must call the sync management API');
// Sync completion toast notifies the user about rejected records
assert.ok(cloud.includes('bản ghi bị từ chối cần sửa'),'Sync toast must notify when records were rejected');

console.log('PASS phase1 task4: quarantine UI + notification wired');
