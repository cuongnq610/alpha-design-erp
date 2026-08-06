import {copyFileSync,existsSync,mkdirSync,rmSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=join(root,'public');
// Danh sách duy nhất các tài nguyên được phép công khai. Không phát hành source backend, SQL, test hoặc tài liệu nội bộ.
const files=[
  'index.html','index-qa-demo-v4.5.60.html','qa-demo-seed-v4560.js','theme-bootstrap.js','runtime-config.js','alpha-design-system.css','calculation-core.js','reporting-period.js','statutory-template-manager.js','statutory-template-reference.js','tax-compliance-package-manager.js','tax-compliance-reference.js','tax-calendar.js','accounting-operations.js','payroll-detail.js','annual-benefits.js','recycle-bin.js','money-input.js',
  'permission-map.js','production-guard.js','export-center.js','theme-manager.js','demo-enterprise-seed.js','app.js','cloud-adapter.js',
  'alpha-sync.bundle.js','auth-security.js','cloud-v2.js','alpha-enterprise.js','sw.js','manifest.webmanifest',
  'logo-alpha-transparent.png','logo-alpha-on-dark.png','icon-192.png','icon-512.png'
];

rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});
for(const relativePath of files){
  const source=join(root,relativePath),destination=join(output,relativePath);
  if(!existsSync(source)||!statSync(source).isFile())throw new Error(`Thiếu tài nguyên giao diện: ${relativePath}`);
  mkdirSync(dirname(destination),{recursive:true});
  copyFileSync(source,destination);
}
const templates=['templates/statutory/TT133_2026_BASELINE_TEMPLATE.json','templates/statutory/TT99_2026_BASELINE_TEMPLATE.json','templates/statutory/TT132_2026_BASELINE_TEMPLATE.json','templates/tax/VN_TAX_2026_BASELINE_PACKAGE.json'];
for(const template of templates){
  const templateSource=join(root,template),templateDestination=join(output,template);
  if(!existsSync(templateSource)||!statSync(templateSource).isFile())throw new Error(`Thiếu tài nguyên giao diện: ${template}`);
  mkdirSync(dirname(templateDestination),{recursive:true});copyFileSync(templateSource,templateDestination);
}
console.log(`PUBLIC_BUILD_OK ${files.length+templates.length} files -> ${output}`);
