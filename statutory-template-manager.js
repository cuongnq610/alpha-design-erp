(() => {
  'use strict';

  const REQUIRED_FORMS_BY_REGIME={TT133:['B01a-DNN','B02-DNN','B03-DNN','F01-DNN','B09-DNN'],TT99:['B01-DN','B02-DN','B03-DN','B09-DN'],TT132:['B01-DNSN','B02-DNSN','F01-DNSN','F02-DNSN']};
  const REQUIRED_FORMS=REQUIRED_FORMS_BY_REGIME.TT133;
  const PACKAGE_TYPE = 'alpha-statutory-report-template';
  const SCHEMA_VERSION = 1;
  const textDecoder = new TextDecoder('utf-8');

  const clone = value => JSON.parse(JSON.stringify(value));
  const normalizeName = name => String(name || '').replace(/\\/g, '/').split('/').pop();
  const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const sha256Bytes = async bytes => {
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const sha256Text = text => sha256Bytes(new TextEncoder().encode(String(text || '')));
  const canonicalJson = value => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  };

  async function inflateRaw(bytes) {
    if (!globalThis.DecompressionStream) throw new Error('Trình duyệt này chưa hỗ trợ giải nén ZIP. Hãy dùng gói JSON hoặc nâng cấp trình duyệt.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    let eocd = -1;
    for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i += 1) {
      if (view.getUint32(i, true) === 0x06054b50) eocd = i;
    }
    if (eocd < 0) throw new Error('Không tìm thấy thư mục trung tâm của file ZIP.');
    const entries = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const files = new Map();
    for (let index = 0; index < entries; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Cấu trúc ZIP không hợp lệ.');
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const fileName = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`Header ZIP của ${fileName} không hợp lệ.`);
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let content;
      if (method === 0) content = compressed;
      else if (method === 8) content = await inflateRaw(compressed);
      else throw new Error(`ZIP dùng phương thức nén chưa được hỗ trợ (${method}) tại ${fileName}.`);
      if (!fileName.endsWith('/')) files.set(normalizeName(fileName), content);
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return files;
  }

  function buildPackageFromFiles(files) {
    const getText = name => {
      const bytes = files.get(name);
      return bytes ? textDecoder.decode(bytes) : '';
    };
    const manifestText = getText('manifest.json');
    if (!manifestText) throw new Error('Gói mẫu thiếu manifest.json.');
    const manifest = JSON.parse(manifestText);
    const packageObject = { manifest, reports: {}, accountMapping: {}, validationRules: [], printLayout: '' };
    const aliases = {
      'B01a-DNN':['B01a_DNN.json','B01A_DNN.json','B01a-DNN.json'],
      'B02-DNN':['B02_DNN.json','B02-DNN.json'],
      'B03-DNN':['B03_DNN.json','B03-DNN.json'],
      'F01-DNN':['F01_DNN.json','F01-DNN.json'],
      'B09-DNN':['B09_DNN.json','B09-DNN.json'],
      'B01-DN':['B01_DN.json','B01-DN.json'],
      'B02-DN':['B02_DN.json','B02-DN.json'],
      'B03-DN':['B03_DN.json','B03-DN.json'],
      'B09-DN':['B09_DN.json','B09-DN.json'],
      'B01-DNSN':['B01_DNSN.json','B01-DNSN.json'],
      'B02-DNSN':['B02_DNSN.json','B02-DNSN.json'],
      'F01-DNSN':['F01_DNSN.json','F01-DNSN.json'],
      'F02-DNSN':['F02_DNSN.json','F02-DNSN.json']
    };
    Object.entries(aliases).forEach(([form,names]) => {
      const name = names.find(candidate => files.has(candidate));
      if (name) packageObject.reports[form] = JSON.parse(getText(name));
    });
    if (files.has('account_mapping.json')) packageObject.accountMapping = JSON.parse(getText('account_mapping.json'));
    if (files.has('validation_rules.json')) packageObject.validationRules = JSON.parse(getText('validation_rules.json'));
    if (files.has('print_layout.css')) packageObject.printLayout = getText('print_layout.css');
    packageObject.__rawFiles = files;
    return packageObject;
  }

  async function parseFile(file) {
    if (!file) throw new Error('Chưa chọn file bộ mẫu.');
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.json')) {
      const parsed = JSON.parse(await file.text());
      return parsed.manifest ? parsed : { manifest: parsed, reports: parsed.reports || {} };
    }
    if (!name.endsWith('.zip')) throw new Error('Chỉ hỗ trợ bộ mẫu .zip hoặc .json.');
    return buildPackageFromFiles(await unzip(await file.arrayBuffer()));
  }

  async function validatePackage(input) {
    const pkg = clone(input);
    delete pkg.__rawFiles;
    const errors = [], warnings = [];
    const manifest = pkg.manifest || {};
    if (manifest.packageType !== PACKAGE_TYPE) errors.push(`manifest.packageType phải là ${PACKAGE_TYPE}.`);
    if (Number(manifest.schemaVersion) !== SCHEMA_VERSION) errors.push(`schemaVersion phải bằng ${SCHEMA_VERSION}.`);
    if (!String(manifest.templateId || '').trim()) errors.push('Thiếu templateId.');
    if (!String(manifest.version || '').trim()) errors.push('Thiếu version của bộ mẫu.');
    if (!safeDate(manifest.effectiveFrom)) errors.push('effectiveFrom phải có dạng YYYY-MM-DD.');
    if (!/TT133|TT99|TT132/i.test(String(manifest.accountingRegime || ''))) errors.push('accountingRegime phải xác định TT133, TT99 hoặc TT132.');
    const reports = pkg.reports || {};
    const regimeCode=String(manifest.accountingRegime||'').toUpperCase().includes('TT99')?'TT99':String(manifest.accountingRegime||'').toUpperCase().includes('TT132')?'TT132':'TT133';
    const requiredForms=REQUIRED_FORMS_BY_REGIME[regimeCode]||REQUIRED_FORMS;
    requiredForms.forEach(form => {
      const report = reports[form];
      if (!report) { errors.push(`Thiếu cấu hình ${form}.`); return; }
      if (report.form && report.form !== form) errors.push(`${form}: trường form không khớp.`);
      if (!String(report.title || '').trim()) errors.push(`${form}: thiếu title.`);
      if (report.rows && !Array.isArray(report.rows)) errors.push(`${form}: rows phải là mảng.`);
      const codes = new Set();
      (report.rows || []).forEach((row, index) => {
        const code = String(row.code || '').trim();
        if (!code) errors.push(`${form}: dòng ${index + 1} thiếu code.`);
        else if (codes.has(code)) errors.push(`${form}: trùng mã số ${code}.`);
        codes.add(code);
        if (row.formula || row.script || row.javascript) errors.push(`${form}/${code}: gói format không được chứa mã lệnh hoặc công thức thực thi.`);
      });
    });
    if (String(pkg.printLayout || '').length > 100000) errors.push('print_layout.css vượt quá 100 KB.');
    if (/<script|javascript:|expression\s*\(/i.test(String(pkg.printLayout || ''))) errors.push('print_layout.css chứa nội dung không an toàn.');
    if (manifest.files && input.__rawFiles instanceof Map) {
      for (const [name, expected] of Object.entries(manifest.files)) {
        const bytes = input.__rawFiles.get(normalizeName(name));
        if (!bytes) { errors.push(`Thiếu file được khai báo checksum: ${name}.`); continue; }
        const actual = await sha256Bytes(bytes);
        if (String(expected).toLowerCase() !== actual) errors.push(`Checksum không khớp: ${name}.`);
      }
    } else warnings.push('Gói không có bảng checksum từng file; hệ thống vẫn tạo checksum toàn gói khi nhập.');
    const packageSha256 = await sha256Text(canonicalJson(pkg));
    return { valid: errors.length === 0, errors, warnings, packageSha256, normalized: pkg };
  }

  function getActiveTemplate(db, accountingRegime = '') {
    const templates = Array.isArray(db?.statutoryReportTemplates) ? db.statutoryReportTemplates : [];
    const activeId = db?.settings?.activeStatutoryTemplateId;
    const code=String(accountingRegime||'').includes('TT99')?'TT99':String(accountingRegime||'').includes('TT132')?'TT132':'TT133';
    const direct = templates.find(x => String(x.id) === String(activeId) && x.status === 'active' && (!accountingRegime || String(x.accountingRegime||'').includes(code)));
    if (direct) return direct;
    return templates.filter(x => x.status === 'active' && (!accountingRegime || String(x.accountingRegime).includes(code)))
      .sort((a,b) => String(b.activatedAt || b.importedAt || '').localeCompare(String(a.activatedAt || a.importedAt || '')))[0] || null;
  }

  function diffPackages(currentRecord, nextPackage) {
    const current = currentRecord?.package || { reports:{} };
    const changes = [];
    const nextRegime=String(nextPackage?.manifest?.accountingRegime||currentRecord?.accountingRegime||'').toUpperCase().includes('TT99')?'TT99':String(nextPackage?.manifest?.accountingRegime||currentRecord?.accountingRegime||'').toUpperCase().includes('TT132')?'TT132':'TT133';
    (REQUIRED_FORMS_BY_REGIME[nextRegime]||REQUIRED_FORMS).forEach(form => {
      const before = current.reports?.[form] || {};
      const after = nextPackage.reports?.[form] || {};
      if (String(before.title || '') !== String(after.title || '')) changes.push(`${form}: đổi tiêu đề`);
      const beforeRows = new Map((before.rows || []).map(x => [String(x.code), x]));
      const afterRows = new Map((after.rows || []).map(x => [String(x.code), x]));
      [...afterRows.keys()].filter(code => !beforeRows.has(code)).forEach(code => changes.push(`${form}: thêm chỉ tiêu ${code}`));
      [...beforeRows.keys()].filter(code => !afterRows.has(code)).forEach(code => changes.push(`${form}: ẩn/bỏ chỉ tiêu ${code}`));
      [...afterRows.keys()].filter(code => beforeRows.has(code) && String(afterRows.get(code).label || '') !== String(beforeRows.get(code).label || '')).forEach(code => changes.push(`${form}: đổi tên chỉ tiêu ${code}`));
    });
    return changes;
  }

  function install(db, validation, actor = 'Người dùng') {
    if (!validation?.valid) throw new Error((validation?.errors || ['Bộ mẫu không hợp lệ.']).join('\n'));
    db.statutoryReportTemplates = Array.isArray(db.statutoryReportTemplates) ? db.statutoryReportTemplates : [];
    const manifest = validation.normalized.manifest;
    const existing = db.statutoryReportTemplates.find(x => x.templateId === manifest.templateId && x.version === manifest.version);
    if (existing) throw new Error('Bộ mẫu cùng templateId và version đã tồn tại.');
    const record = {
      id: `srt-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      templateId: manifest.templateId,
      version: manifest.version,
      name: manifest.name || `${manifest.accountingRegime} ${manifest.version}`,
      accountingRegime: manifest.accountingRegime,
      effectiveFrom: manifest.effectiveFrom,
      legalReference: manifest.legalReference || '',
      packageSha256: validation.packageSha256,
      status: 'candidate',
      importedAt: new Date().toISOString(),
      importedBy: actor,
      validationWarnings: validation.warnings,
      package: validation.normalized
    };
    db.statutoryReportTemplates.unshift(record);
    return record;
  }

  function activate(db, id, actor = 'Người dùng') {
    const list = Array.isArray(db.statutoryReportTemplates) ? db.statutoryReportTemplates : [];
    const target = list.find(x => String(x.id) === String(id));
    if (!target) throw new Error('Không tìm thấy bộ mẫu.');
    if (!['candidate','inactive','active'].includes(target.status)) throw new Error('Bộ mẫu chưa ở trạng thái có thể kích hoạt.');
    list.forEach(item => { if (item.status === 'active') item.status = 'inactive'; });
    target.status = 'active';
    target.activatedAt = new Date().toISOString();
    target.activatedBy = actor;
    db.settings.activeStatutoryTemplateId = target.id;
    return target;
  }

  function rollback(db, id, actor = 'Người dùng') {
    return activate(db, id, actor);
  }

  function applyReport(report, template, form = report?.form) {
    if (!template?.package?.reports?.[form]) return report;
    const config = template.package.reports[form];
    const rowConfig = new Map((config.rows || []).map((row,index) => [String(row.code), {...row, __index:index}]));
    const rows = (report.rows || []).map(row => {
      const override = rowConfig.get(String(row.code));
      if (!override) return {...row, __index: Number.MAX_SAFE_INTEGER};
      return {...row, label: override.label || row.label, noteRef: override.noteRef ?? row.noteRef, level: Number.isFinite(Number(override.level)) ? Number(override.level) : row.level, bold: override.bold ?? row.bold, hidden: Boolean(override.hidden), __index: override.__index};
    }).filter(row => !row.hidden).sort((a,b) => a.__index - b.__index || String(a.code).localeCompare(String(b.code))).map(({__index,hidden,...row}) => row);
    return {...report, rows, templateMeta:{title:config.title,subtitle:config.subtitle || '',legalReference:config.legalReference || template.legalReference || '',periodStyle:config.periodStyle || '',unitLabel:config.unitLabel || ''}};
  }

  function reportConfig(template, form) {
    return template?.package?.reports?.[form] || null;
  }

  window.AlphaStatutoryTemplateManager = {
    PACKAGE_TYPE, SCHEMA_VERSION, REQUIRED_FORMS, REQUIRED_FORMS_BY_REGIME, parseFile, validatePackage, getActiveTemplate,
    diffPackages, install, activate, rollback, applyReport, reportConfig, canonicalJson
  };
})();
