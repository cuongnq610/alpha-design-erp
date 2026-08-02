import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('alpha-design-system.css','utf8');
const migration=fs.readFileSync('supabase/migrations/067_table_viewport_formula_linkage_hardened_v4549.sql','utf8');
for(const marker of [
  'project-list-table-wrap',
  "wrap.dataset.horizontalScrollbar=scrollable?'native-bottom-only':'none'",
  'topScroller?.remove();hint?.remove();',
  'table.dataset.gridVersion=RELEASE_VERSION',
  "releaseVersion:'4.5.55',migrationVersion:68"
]) assert.ok(app.includes(marker),`missing v4.5.49 app marker ${marker}`);
assert.equal(app.includes("topScroller.className='table-scroll-top'"),false,'Duplicated top horizontal scrollbar must not be recreated');
for(const marker of [
  'v4.5.49 — bottom-only horizontal scrolling and taller project list viewport',
  '.table-scroll-top,.table-scroll-hint{display:none!important}',
  '.project-list-table-wrap.table-scroll-frame',
  'max-height:clamp(500px,66dvh,780px)'
]) assert.ok(css.includes(marker),`missing v4.5.49 CSS marker ${marker}`);
assert.ok(migration.includes("('4.5.49','Bottom-only table scrolling, expanded project viewport and full formula/linkage regression')"));
assert.ok(migration.includes("p_release_version<>'4.5.49' or p_migration_version<>67"));
console.log('PASS v4.5.49 project viewport expansion, bottom-only horizontal scrolling and release binding');
