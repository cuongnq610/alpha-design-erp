import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const migrationRoot=join(root,'supabase','migrations');
const version=JSON.parse(readFileSync(join(root,'VERSION.json'),'utf8')).version;
const migrations=readdirSync(migrationRoot).filter(name=>/^\d{3}_.+\.sql$/.test(name)).sort();
const separator='-- ============================================================================';
const sections=migrations.map(name=>[
  separator,
  `-- SOURCE: ${name}`,
  separator,
  readFileSync(join(migrationRoot,name),'utf8').trim()
].join('\n'));
const output=[
  `-- ALPHA DESIGN ERP Cloud v${version} — Consolidated Production Schema`,
  '-- Generated from ordered migrations. Apply only to a new database; existing databases must run migrations incrementally.',
  '',
  '',
  sections.join('\n\n'),
  ''
].join('\n');
writeFileSync(join(root,'SUPABASE_PRODUCTION_SCHEMA.sql'),output);
const digest=createHash('sha256').update(output).digest('hex');
writeFileSync(join(root,'SUPABASE_PRODUCTION_SCHEMA.sql.sha256'),`${digest}  SUPABASE_PRODUCTION_SCHEMA.sql\n`);
console.log(`SCHEMA_BUILD_OK ${migrations.length} ordered migrations -> SUPABASE_PRODUCTION_SCHEMA.sql`);
