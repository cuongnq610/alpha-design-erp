(() => {
  'use strict';

  const enc = new TextEncoder();
  const fmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const money = (v) => Math.round(Number(v) || 0);
  const isoToday = () => new Date().toISOString().slice(0, 10);
  const escXml = (v = '') => String(v).replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const escHtml = (v = '') => String(v).replace(/[&<>'\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const safeName = (v = 'export') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 90) || 'export';
  const uid = (prefix = 'ex') => { const id=globalThis.crypto?.randomUUID?.(); return id?`${prefix}-${id}`:`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; };
  const inRange = (date, range = {}) => (!range.from || String(date || '') >= range.from) && (!range.to || String(date || '') <= range.to);
  const releaseVersion = () => String(window.ALPHA_RUNTIME_CONFIG?.releaseVersion || window.AlphaERP?.version || window.AlphaEnterprise?.version || 'unknown');
  const DATABASE_MIGRATION_VERSION = 75;
  function excelDateSerial(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime() / 86400000 + 25569;
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(String(value || '').trim());
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const utc = Date.UTC(year, month - 1, day);
    const parsed = new Date(utc);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
    return utc / 86400000 + 25569;
  }

  function downloadBytes(bytes, filename, mime = 'application/octet-stream') {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  function csvText(columns, rows) {
    const q = (v) => {
      if (v === null || v === undefined) return '';
      let s = String(v);
      // Prevent spreadsheet formula injection when exported CSV is opened in Excel/LibreOffice.
      if (typeof v === 'string' && /^[\t\r\n ]*[=+\-@]/.test(s)) s = `'${s}`;
      return /[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '\ufeff' + [columns.map((c) => q(c.label)).join(','), ...rows.map((r) => columns.map((c) => q(r[c.key])).join(','))].join('\r\n');
  }

  // Minimal ZIP writer (STORE method) used for XLSX, DOCX and report packages.
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function u16(v) { return Uint8Array.of(v & 255, (v >>> 8) & 255); }
  function u32(v) { return Uint8Array.of(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
  function concat(parts) {
    const size = parts.reduce((s, x) => s + x.length, 0), out = new Uint8Array(size);
    let at = 0;
    parts.forEach((p) => { out.set(p, at); at += p.length; });
    return out;
  }
  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }
  function zipFiles(files) {
    const localParts = [], centralParts = [];
    let offset = 0;
    const dt = dosDateTime();
    files.forEach((file) => {
      const name = enc.encode(file.name), data = file.data instanceof Uint8Array ? file.data : enc.encode(String(file.data));
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dt.time), u16(dt.date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
      ]);
      localParts.push(local);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dt.time), u16(dt.date), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
      ]);
      centralParts.push(central);
      offset += local.length;
    });
    const central = concat(centralParts), locals = concat(localParts);
    const end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(locals.length), u16(0)]);
    return concat([locals, central, end]);
  }

  function colLetter(n) {
    let s = '';
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
  }
  function xlsxCell(ref, value, style = 0) {
    if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    if (typeof value === 'boolean') return `<c r="${ref}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
  }
  function worksheetXml(sheet, meta) {
    const cols = sheet.columns || [], rows = sheet.rows || [], last = colLetter(Math.max(1, cols.length));
    const lines = [];
    lines.push(`<row r="1" ht="28" customHeight="1">${xlsxCell('A1', sheet.title || sheet.name, 2)}</row>`);
    lines.push(`<row r="2">${xlsxCell('A2', `${meta.company}${meta.taxCode ? ` • MST: ${meta.taxCode}` : ''}`, 5)}</row>`);
    lines.push(`<row r="3">${xlsxCell('A3', `${meta.address || ''}${meta.regime ? ` • Chế độ: ${meta.regime}` : ''}`, 5)}</row>`);
    lines.push(`<row r="4">${xlsxCell('A4', `Kỳ: ${meta.range.from || 'Tất cả'} — ${meta.range.to || 'Tất cả'} • Đơn vị: ${meta.unit || 'VND'} • Kết xuất: ${new Date().toLocaleString('vi-VN')}`, 5)}</row>`);
    lines.push(`<row r="6">${cols.map((c, i) => xlsxCell(`${colLetter(i + 1)}6`, c.label, 1)).join('')}</row>`);
    rows.forEach((row, ri) => {
      const r = ri + 7;
      lines.push(`<row r="${r}">${cols.map((c, ci) => {
        let v = row[c.key];
        if (c.type === 'money' || c.type === 'number') v = Number(v) || 0;
        if (c.type === 'percent') v = (Number(v) || 0) / 100;
        if (c.type === 'date') {
          const serial = excelDateSerial(v);
          if (serial !== null) v = serial;
        }
        const style = c.type === 'money' ? 3 : c.type === 'date' ? 4 : c.type === 'number' ? 6 : c.type === 'percent' ? 7 : 0;
        return xlsxCell(`${colLetter(ci + 1)}${r}`, v, style);
      }).join('')}</row>`);
    });
    const widths = cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || (c.type === 'money' ? 18 : 20)}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths}</cols><sheetData>${lines.join('')}</sheetData>
<mergeCells count="4"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/><mergeCell ref="A3:${last}3"/><mergeCell ref="A4:${last}4"/></mergeCells>
<autoFilter ref="A6:${last}${Math.max(6, rows.length + 6)}"/>
<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
  }
  function makeXlsx(workbook, meta) {
    const sheets = workbook.sheets || [];
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${escXml((s.name || `Sheet${i + 1}`).slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#.##0;[Red](#.##0);-"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="0.00%"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FF062F55"/><sz val="15"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B73F6"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` }
    ];
    sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: worksheetXml(s, meta) }));
    return zipFiles(files);
  }

  function docxParagraph(text, bold = false) {
    return `<w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
  }
  function docxTable(sheet) {
    const cells = (values, header = false) => `<w:tr>${values.map((v) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:r>${header ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t>${escXml(v ?? '')}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`;
    return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${cells(sheet.columns.map((c) => c.label), true)}${sheet.rows.map((r) => cells(sheet.columns.map((c) => c.type === 'money' ? fmt.format(Number(r[c.key]) || 0) : r[c.key]))).join('')}</w:tbl>`;
  }
  function makeDocx(workbook, meta) {
    const body = [docxParagraph(meta.company, true), docxParagraph(`${meta.address || ''}${meta.taxCode ? ` • MST: ${meta.taxCode}` : ''}`), docxParagraph(workbook.title, true), docxParagraph(`Chế độ: ${meta.regime || 'Chưa khai báo'} • Kỳ: ${meta.range.from || 'Tất cả'} — ${meta.range.to || 'Tất cả'} • Đơn vị: ${meta.unit || 'VND'}`)];
    workbook.sheets.forEach((s) => { body.push(docxParagraph(s.title || s.name, true), docxTable(s)); });
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>` }
    ];
    return zipFiles(files);
  }

  function workbookXml(workbook, meta) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<AlphaERPExport version="${escXml(releaseVersion())}" generatedAt="${new Date().toISOString()}" company="${escXml(meta.company)}" taxCode="${escXml(meta.taxCode || '')}" address="${escXml(meta.address || '')}" accountingRegime="${escXml(meta.regime || '')}" unit="${escXml(meta.unit || 'VND')}" from="${escXml(meta.range.from || '')}" to="${escXml(meta.range.to || '')}">${workbook.sheets.map((s) => `<Dataset name="${escXml(s.name)}" title="${escXml(s.title || s.name)}">${s.rows.map((r) => `<Row>${s.columns.map((c) => `<Field name="${escXml(c.key)}" label="${escXml(c.label)}">${escXml(r[c.key] ?? '')}</Field>`).join('')}</Row>`).join('')}</Dataset>`).join('')}</AlphaERPExport>`;
  }

  function reportHtml(workbook, meta) {
    const tables = workbook.sheets.map((s) => `<section><h2>${escHtml(s.title || s.name)}</h2><table><thead><tr>${s.columns.map((c) => `<th>${escHtml(c.label)}</th>`).join('')}</tr></thead><tbody>${s.rows.map((r) => `<tr>${s.columns.map((c) => `<td class="${c.type === 'money' || c.type === 'number' ? 'num' : ''}">${c.type === 'money' ? fmt.format(Number(r[c.key]) || 0) : escHtml(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('');
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${escHtml(workbook.title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#102a43;font-size:10px}header{border-bottom:3px solid #0b73f6;margin-bottom:15px;padding-bottom:8px}h1{font-size:20px;margin:0;color:#062f55}h2{font-size:13px;color:#062f55;margin:18px 0 7px}p{margin:3px 0}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #cad5e1;padding:5px 6px;vertical-align:top}th{background:#0b73f6;color:white;text-align:left}.num{text-align:right;font-variant-numeric:tabular-nums}footer{margin-top:20px;font-size:9px;color:#627d98}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;text-align:center;margin-top:36px}.sign div{min-height:70px}</style></head><body><header><h1>${escHtml(meta.company)}</h1><p>${escHtml(meta.address || '')}${meta.taxCode ? ` • MST: ${escHtml(meta.taxCode)}` : ''}</p><p><strong>${escHtml(workbook.title)}</strong></p><p>Chế độ: ${escHtml(meta.regime || 'Chưa khai báo')} • Kỳ: ${escHtml(meta.range.from || 'Tất cả')} — ${escHtml(meta.range.to || 'Tất cả')} • Đơn vị: ${escHtml(meta.unit || 'VND')} • Kết xuất ${new Date().toLocaleString('vi-VN')}</p></header>${tables}<div class="sign"><div><strong>Người lập</strong><p>(Ký, họ tên)</p></div><div><strong>Kế toán trưởng</strong><p>(Ký, họ tên)</p></div><div><strong>Giám đốc</strong><p>(Ký, họ tên, đóng dấu)</p></div></div><footer>ALPHA DESIGN ERP Cloud v${escHtml(releaseVersion())} • Dữ liệu phải được kiểm tra và phê duyệt trước khi sử dụng pháp định.</footer></body></html>`;
  }

  function lookup(db) {
    const map = (arr) => new Map((arr || []).map((x) => [x.id, x]));
    const clients = map(db.clients), vendors = map(db.vendors), people = map(db.people), projects = map(db.projects);
    return {
      client: (id) => clients.get(id)?.name || '', vendor: (id) => vendors.get(id)?.name || '', person: (id) => people.get(id)?.name || '', project: (id) => projects.get(id)?.name || '',
      partner: (type, id) => type === 'client' ? clients.get(id)?.name || '' : type === 'vendor' ? vendors.get(id)?.name || '' : ''
    };
  }
  const C = (key, label, type = 'text', width = 20) => ({ key, label, type, width });
  const sheet = (name, title, columns, rows) => ({ name, title, columns, rows });

  function catalog(db, range) {
    const Calc = window.AlphaCalc, L = lookup(db);
    const posted = Calc.postedEntries(db, range);
    const lines = Calc.postedLines(db, range);
    const cloudNotes = window.AlphaERP?.getStatutoryCloudNotes?.() || [];
    const tt133ReportDb = cloudNotes.length ? { ...db, reportNotesTT133: cloudNotes } : db;
    const trial = Calc.tt133F01(db, range);
    const templateManager=window.AlphaStatutoryTemplateManager,activeTemplate=templateManager?.getActiveTemplate?.(db,db.settings?.accountingRegime);
    const b01Raw = Calc.tt133B01a(tt133ReportDb, range), b02Raw = Calc.tt133B02(tt133ReportDb, range), b03Raw = Calc.tt133B03Direct(tt133ReportDb, range);
    const b01 = templateManager?.applyReport?.(b01Raw,activeTemplate,'B01a-DNN')||b01Raw, b02 = templateManager?.applyReport?.(b02Raw,activeTemplate,'B02-DNN')||b02Raw, b03 = templateManager?.applyReport?.(b03Raw,activeTemplate,'B03-DNN')||b03Raw, b09 = Calc.tt133B09(tt133ReportDb, range);
    const t99b01Raw=Calc.tt99B01(db,range),t99b02Raw=Calc.tt99B02(db,range),t99b03Raw=Calc.tt99B03Direct(db,range),t99b09=Calc.tt99B09(db,range);
    const isTT99Regime=String(db.settings?.accountingRegime||'').includes('TT99'),isTT132Regime=String(db.settings?.accountingRegime||'').includes('TT132');
    const t99b01=templateManager?.applyReport?.(t99b01Raw,activeTemplate,'B01-DN')||t99b01Raw,t99b02=templateManager?.applyReport?.(t99b02Raw,activeTemplate,'B02-DN')||t99b02Raw,t99b03=templateManager?.applyReport?.(t99b03Raw,activeTemplate,'B03-DN')||t99b03Raw;
    const t132b01Raw=Calc.tt132B01(db,range),t132b02Raw=Calc.tt132B02(db,range),t132f01=Calc.tt132F01(db,range),t132f02Raw=Calc.tt132F02(db,range);
    const t132b01=templateManager?.applyReport?.(t132b01Raw,activeTemplate,'B01-DNSN')||t132b01Raw,t132b02=templateManager?.applyReport?.(t132b02Raw,activeTemplate,'B02-DNSN')||t132b02Raw,t132f02=templateManager?.applyReport?.(t132f02Raw,activeTemplate,'F02-DNSN')||t132f02Raw;
    const projectRows = (db.projects || []).map((p) => {
      const plines = lines.filter((x) => x.projectId === p.id), rev = plines.filter((x) => (db.accounts || []).find((a) => a.code === x.accountCode)?.type === 'Revenue').reduce((s, x) => s + money(x.credit) - money(x.debit), 0), cost = plines.filter((x) => (db.accounts || []).find((a) => a.code === x.accountCode)?.type === 'Expense').reduce((s, x) => s + money(x.debit) - money(x.credit), 0);
      return { code: p.code, name: p.name, client: L.client(p.clientId), pm: L.person(p.pmId), status: p.status, progress: p.progress, contractValue: p.contractValue, budget: p.directBudget, revenue: rev, cost, profit: rev - cost };
    });
    const journalRows = posted.map((e) => ({ date: e.date, documentNo: e.documentNo, sourceType: e.sourceType, description: e.description, project: L.project(e.projectId), partner: L.partner(e.partnerType, e.partnerId), debit: (e.lines || []).reduce((s, x) => s + money(x.debit), 0), credit: (e.lines || []).reduce((s, x) => s + money(x.credit), 0), status: e.status }));
    const ledgerRows = lines.map((x) => ({ date: x.date, documentNo: x.documentNo, accountCode: x.accountCode, accountName: (db.accounts || []).find((a) => a.code === x.accountCode)?.name || '', description: x.description || x.entryDescription, project: L.project(x.projectId), partner: L.partner(x.partnerType, x.partnerId), debit: x.debit, credit: x.credit }));
    const cashBook = ledgerRows.filter((x) => String(x.accountCode).startsWith('111'));
    const bankBook = ledgerRows.filter((x) => String(x.accountCode).startsWith('112'));
    const ar = Calc.partnerBalances(db, '131', 'client', { to: range.to }).map((x) => ({ partnerCode: (db.clients || []).find((p) => p.id === x.partnerId)?.code || '', partner: L.client(x.partnerId), debit: x.debit, credit: x.credit, balance: x.balance }));
    const ap = Calc.partnerBalances(db, '331', 'vendor', { to: range.to }).map((x) => ({ partnerCode: (db.vendors || []).find((p) => p.id === x.partnerId)?.code || '', partner: L.vendor(x.partnerId), debit: x.debit, credit: x.credit, balance: x.balance }));
    const vatDeduction=Calc.vatInputDeductionAssessment(db,range),vatDeductionById=new Map(vatDeduction.rows.filter(row=>row.id).map(row=>[row.id,row]));
    const vatRows = (db.taxInvoices || []).filter((x) => inRange(x.date, range)).map((x) => {const deduction=vatDeductionById.get(String(x.id||''));return { date: x.date, direction: x.direction, serial: x.serial, invoiceNo: x.invoiceNo, partner: L.partner(x.partnerType, x.partnerId), taxCode: x.taxCode, description: x.description, project: L.project(x.projectId), taxBase: x.taxBase, vatRate: x.vatRate, vatAmount: x.vatAmount, totalAmount: x.totalAmount, deductible: x.direction==='Input'?(deduction?.eligible?'Có':deduction?.claimed?'Không — bị chặn':'Không'):'—', deductionReason:deduction?.reason||'', paymentStatus: x.paymentStatus, status: x.status };});
    const pitRows = (db.pitWithholdings || []).filter((x) => inRange(x.date, range)).map((x) => ({ date: x.date, recipient: L.partner(x.recipientType, x.recipientId), taxCode: x.taxCode, contractType: x.contractType, grossIncome: x.grossIncome, taxableIncome: x.taxableIncome, rate: x.rate, taxWithheld: x.taxWithheld, netPaid: x.netPaid, period: x.period, status: x.status }));
    const timesheets = (db.timesheets || []).filter((x) => inRange(x.date, range)).map((x) => ({ date: x.date, project: L.project(x.projectId), person: L.person(x.personId), hours: x.hours, billable: x.billable ? 'Có' : 'Không', description: x.description, approved: x.approved ? 'Đã duyệt' : 'Chưa duyệt' }));
    const payrollRows = (db.people || []).map((p) => { const hours = (db.timesheets || []).filter((x) => x.personId === p.id && x.approved && inRange(x.date, range)).reduce((s, x) => s + Number(x.hours || 0), 0), billable = (db.timesheets || []).filter((x) => x.personId === p.id && x.approved && x.billable && inRange(x.date, range)).reduce((s, x) => s + Number(x.hours || 0), 0), cph = Calc.costPerHour(p, db.settings); return { code: p.code, name: p.name, department: p.department, role: p.role, type: p.type, monthlySalary: p.monthlySalary, hourlyRate: p.hourlyRate, hours, billableHours: billable, costPerHour: cph, allocatedCost: hours * cph, recoveredRevenue: billable * Number(p.billingRate || 0), utilization: hours ? billable / hours * 100 : 0 }; });
    const Payroll=window.AlphaPayrollDetail;
    const payrollMonths=[...new Set((db.payrollPeriods||[]).map(p=>p.month||String(p.periodCode||p.period_code||'').replace('PAY-','')).filter(key=>/^\d{4}-\d{2}$/.test(key)&&(!range.from||`${key}-31`>=range.from)&&(!range.to||`${key}-01`<=range.to)))].sort();
    const detailedPayrollRows=Payroll?payrollMonths.flatMap(key=>Payroll.calculatePeriod(db,key).map(row=>({period:row.month,code:row.employeeCode,name:row.employeeName,department:row.department,role:row.role,type:row.type,standardWorkdays:row.standardWorkdays,payableWorkdays:row.payableWorkdays,attendanceDays:row.attendanceDays,approvedHours:row.approvedHours,overtimeHours:row.overtimeHours,billableHours:row.billableHours,baseSalary:row.baseSalary,allowances:row.allowances,allowanceMode:row.allowanceMode,overtimePay:row.overtimePay,overtimeMode:row.overtimeMode,bonus:row.bonus,otherIncome:row.otherIncome,grossIncome:row.grossIncome,insuranceBase:row.insuranceBase,employeeInsurance:row.employeeInsurance,insuranceMode:row.insuranceMode,taxableIncome:row.taxableIncome,personalIncomeTax:row.personalIncomeTax,pitMode:row.pitMode,advanceDeduction:row.advanceDeduction,otherDeductions:row.otherDeductions,netPay:row.netPay,employerInsurance:row.employerInsurance,totalEmployerCost:row.totalEmployerCost,projectAllocatedCost:row.projectAllocatedCost,recoverableRevenue:row.recoverableRevenue,utilization:row.utilization,recoveryRatio:row.recoveryRatio,calculationVersion:row.calculationVersion,status:row.status,notes:row.notes}))) : [];
    const Benefits=window.AlphaAnnualBenefits;
    const annualBenefitRows=Benefits?(db.annualBenefitBudgets||[]).flatMap(plan=>{const result=Benefits.calculateAnnualBudget(db,plan.year,plan);return result.bonus.rows.map(row=>({year:result.year,code:row.employeeCode,name:row.employeeName,department:row.department,averageSalary:row.averageSalary,serviceDays:row.serviceDays,serviceRatio:row.serviceRatio*100,employeeFactor:row.employeeFactor,companyFactor:row.companyFactor,grossBonus:row.grossBonus,pitProvision:row.pitProvision,cashBudget:row.cashBudget,status:plan.status}));}):[];
    const annualTravelRows=Benefits?(db.annualBenefitBudgets||[]).map(plan=>{const result=Benefits.calculateAnnualBudget(db,plan.year,plan),x=result.travel;return {year:result.year,eligibleCount:x.eligibleCount,expectedParticipants:x.expectedParticipants,participationRate:x.participationRate,costPerPerson:x.costPerPerson,perPersonTotal:x.perPersonTotal,commonCost:x.commonCost,contingency:x.contingency,total:x.total,payrollFund:x.payrollFund,welfareCeiling:x.welfareCeiling,otherWelfareSpent:x.otherWelfareSpent,remainingBeforeTravel:x.remainingBeforeTravel,potentialExcess:x.potentialExcess,status:plan.status};}):[];
    const integrity = Calc.integrityChecks(db, range);

    return {
      tt132: { id:'tt132', title:'Bộ báo cáo tài chính TT132', description:'B01-DNSN, B02-DNSN, F01-DNSN và F02-DNSN dành cho doanh nghiệp siêu nhỏ', sheets:[
        sheet('B01_DNSN','B01-DNSN • Báo cáo tình hình tài chính',[C('code','Mã số'),C('label','Chỉ tiêu','text',52),C('noteRef','Thuyết minh','text',14),C('start','Số đầu năm','money'),C('end','Số cuối kỳ','money')],t132b01.rows),
        sheet('B02_DNSN','B02-DNSN • Báo cáo kết quả hoạt động kinh doanh',[C('code','Mã số'),C('label','Chỉ tiêu','text',58),C('noteRef','Thuyết minh','text',14),C('value','Năm nay','money'),C('previous','Năm trước','money')],t132b02.rows),
        sheet('F01_DNSN','F01-DNSN • Bảng cân đối tài khoản',[C('code','Tài khoản'),C('name','Tên tài khoản','text',42),C('openingDebit','Dư Nợ đầu kỳ','money'),C('openingCredit','Dư Có đầu kỳ','money'),C('debit','Phát sinh Nợ','money'),C('credit','Phát sinh Có','money'),C('endingDebit','Dư Nợ cuối kỳ','money'),C('endingCredit','Dư Có cuối kỳ','money')],t132f01.rows),
        sheet('F02_DNSN','F02-DNSN • Tình hình thực hiện nghĩa vụ với NSNN',[C('code','Mã số'),C('label','Chỉ tiêu','text',58),C('openingPayable','Còn phải nộp đầu năm','money'),C('arisingPayable','Phải nộp phát sinh','money'),C('paid','Đã nộp trong năm','money'),C('endingPayable','Còn phải nộp cuối năm','money')],t132f02.rows)
      ],statutoryChecks:{b01Balanced:t132b01Raw.balanced,equityDetailBalanced:t132b01Raw.equityDetailBalanced,b02FormulaValid:t132b02Raw.formulaValid,f01Balanced:t132f01.balanced,f02Reconciled:t132f02Raw.reconciled},templateMeta:activeTemplate?{id:activeTemplate.id,version:activeTemplate.version,sha256:activeTemplate.packageSha256,effectiveFrom:activeTemplate.effectiveFrom}:null},
      tt99: { id:'tt99', title:'Bộ báo cáo tài chính TT99', description:'B01-DN, B02-DN, B03-DN, B09-DN và Bảng cân đối số phát sinh; tự đồng bộ theo chế độ kế toán', sheets:[
        sheet('B01_DN','B01-DN • Báo cáo tình hình tài chính',[C('code','Mã số'),C('label','Chỉ tiêu','text',48),C('noteRef','Thuyết minh','text',14),C('start','Số đầu năm','money'),C('end','Số cuối kỳ','money')],t99b01.rows),
        sheet('B02_DN','B02-DN • Báo cáo kết quả hoạt động kinh doanh',[C('code','Mã số'),C('label','Chỉ tiêu','text',48),C('noteRef','Thuyết minh','text',14),C('value','Năm nay','money'),C('previous','Năm trước','money')],t99b02.rows),
        sheet('B03_DN','B03-DN • Báo cáo lưu chuyển tiền tệ',[C('code','Mã số'),C('label','Chỉ tiêu','text',48),C('noteRef','Thuyết minh','text',14),C('value','Năm nay','money'),C('previous','Năm trước','money')],t99b03.rows),
        sheet('BCDSPS','Bảng cân đối số phát sinh',[C('code','Tài khoản'),C('name','Tên tài khoản','text',42),C('openingDebit','Dư Nợ đầu kỳ','money'),C('openingCredit','Dư Có đầu kỳ','money'),C('debit','Phát sinh Nợ','money'),C('credit','Phát sinh Có','money'),C('endingDebit','Dư Nợ cuối kỳ','money'),C('endingCredit','Dư Có cuối kỳ','money')],trial.rows),
        sheet('B09_DN','B09-DN • Thuyết minh Báo cáo tài chính',[C('sectionCode','Mục','text',10),C('title','Nội dung','text',48),C('status','Trạng thái','text',16),C('content','Thuyết minh','text',80),C('source','Nguồn','text',18)],t99b09.sections)
      ],statutoryChecks:{b01Balanced:t99b01Raw.balanced,classificationValid:t99b01Raw.classificationValid,b03Reconciled:t99b03Raw.reconciled,b03DirectionValid:!(t99b03Raw.invalidDirections||[]).length,b09Complete:t99b09.complete,mappingValidated:false},templateMeta:activeTemplate?{id:activeTemplate.id,version:activeTemplate.version,sha256:activeTemplate.packageSha256,effectiveFrom:activeTemplate.effectiveFrom}:null},
      tt133: { id: 'tt133', title: 'Bộ báo cáo tài chính TT133', description: 'B01a-DNN, B02-DNN, B03-DNN, B09-DNN và F01-DNN; chỉ phát hành khi vượt cổng kiểm soát', sheets: [
        sheet('B01a_DNN', 'B01a-DNN • Báo cáo tình hình tài chính', [C('code', 'Mã số'), C('label', 'Chỉ tiêu', 'text', 48), C('noteRef', 'Thuyết minh', 'text', 14), C('start', 'Số đầu năm', 'money'), C('end', 'Số cuối kỳ', 'money')], b01.rows),
        sheet('B02_DNN', 'B02-DNN • Báo cáo kết quả hoạt động kinh doanh', [C('code', 'Mã số'), C('label', 'Chỉ tiêu', 'text', 48), C('noteRef', 'Thuyết minh', 'text', 14), C('value', 'Năm nay', 'money'), C('previous', 'Năm trước', 'money')], b02.rows),
        sheet('B03_DNN', 'B03-DNN • Báo cáo lưu chuyển tiền tệ', [C('code', 'Mã số'), C('label', 'Chỉ tiêu', 'text', 48), C('noteRef', 'Thuyết minh', 'text', 14), C('value', 'Năm nay', 'money'), C('previous', 'Năm trước', 'money')], b03.rows),
        sheet('F01_DNN', 'F01-DNN • Bảng cân đối tài khoản', [C('code', 'Tài khoản'), C('name', 'Tên tài khoản', 'text', 42), C('openingDebit', 'Dư Nợ đầu kỳ', 'money'), C('openingCredit', 'Dư Có đầu kỳ', 'money'), C('debit', 'Phát sinh Nợ', 'money'), C('credit', 'Phát sinh Có', 'money'), C('endingDebit', 'Dư Nợ cuối kỳ', 'money'), C('endingCredit', 'Dư Có cuối kỳ', 'money')], trial.rows),
        sheet('B09_DNN', 'B09-DNN • Thuyết minh Báo cáo tài chính', [C('sectionCode', 'Mục', 'text', 10), C('title', 'Nội dung', 'text', 48), C('status', 'Phê duyệt', 'text', 16), C('content', 'Thuyết minh', 'text', 80), C('source', 'Nguồn', 'text', 14)], b09.sections)
      ], statutoryChecks: { b01Balanced: b01Raw.balanced, classificationValid: b01Raw.classificationValid, b03Reconciled: b03Raw.reconciled, b03DirectionValid: !(b03Raw.invalidDirections || []).length, b09Complete: b09.complete }, templateMeta: activeTemplate?{id:activeTemplate.id,version:activeTemplate.version,sha256:activeTemplate.packageSha256,effectiveFrom:activeTemplate.effectiveFrom}:null },
      accounting: { id: 'accounting', title: 'Sổ sách kế toán', description: 'Nhật ký chung, Sổ cái, Sổ quỹ, Sổ tiền gửi, công nợ và bảng cân đối', sheets: [
        sheet('Nhat_ky_chung', 'Sổ nhật ký chung', [C('date', 'Ngày', 'date'), C('documentNo', 'Số chứng từ'), C('sourceType', 'Loại chứng từ'), C('description', 'Diễn giải', 'text', 52), C('project', 'Dự án', 'text', 32), C('partner', 'Đối tượng', 'text', 32), C('debit', 'Tổng Nợ', 'money'), C('credit', 'Tổng Có', 'money'), C('status', 'Trạng thái')], journalRows),
        sheet('So_cai', 'Sổ cái chi tiết', [C('date', 'Ngày', 'date'), C('documentNo', 'Số chứng từ'), C('accountCode', 'TK'), C('accountName', 'Tên tài khoản', 'text', 38), C('description', 'Diễn giải', 'text', 45), C('project', 'Dự án'), C('partner', 'Đối tượng'), C('debit', 'Nợ', 'money'), C('credit', 'Có', 'money')], ledgerRows),
        sheet('So_quy', 'Sổ quỹ tiền mặt', [C('date', 'Ngày', 'date'), C('documentNo', 'Số chứng từ'), C('description', 'Diễn giải', 'text', 48), C('debit', 'Thu', 'money'), C('credit', 'Chi', 'money')], cashBook),
        sheet('So_tien_gui', 'Sổ tiền gửi ngân hàng', [C('date', 'Ngày', 'date'), C('documentNo', 'Số chứng từ'), C('description', 'Diễn giải', 'text', 48), C('debit', 'Thu', 'money'), C('credit', 'Chi', 'money')], bankBook),
        sheet('Cong_no_131', 'Công nợ phải thu khách hàng', [C('partnerCode', 'Mã KH'), C('partner', 'Khách hàng', 'text', 40), C('debit', 'Phát sinh Nợ', 'money'), C('credit', 'Phát sinh Có', 'money'), C('balance', 'Còn phải thu', 'money')], ar),
        sheet('Cong_no_331', 'Công nợ phải trả nhà cung cấp', [C('partnerCode', 'Mã NCC'), C('partner', 'Nhà cung cấp', 'text', 40), C('debit', 'Phát sinh Nợ', 'money'), C('credit', 'Phát sinh Có', 'money'), C('balance', 'Còn phải trả', 'money')], ap),
        sheet('Can_doi_tai_khoan', 'Bảng cân đối tài khoản', [C('code', 'Tài khoản'), C('name', 'Tên tài khoản', 'text', 42), C('openingDebit', 'Dư Nợ đầu kỳ', 'money'), C('openingCredit', 'Dư Có đầu kỳ', 'money'), C('debit', 'Phát sinh Nợ', 'money'), C('credit', 'Phát sinh Có', 'money'), C('endingDebit', 'Dư Nợ cuối kỳ', 'money'), C('endingCredit', 'Dư Có cuối kỳ', 'money')], trial.rows)
      ] },
      tax: { id: 'tax', title: 'Thuế và hóa đơn', description: 'VAT, TNCN, TNDN và lịch nghĩa vụ thuế', sheets: [
        sheet('Hoa_don_VAT', 'Sổ hóa đơn VAT', [C('date', 'Ngày HĐ', 'date'), C('direction', 'Đầu vào/ra'), C('serial', 'Ký hiệu'), C('invoiceNo', 'Số hóa đơn'), C('partner', 'Đối tượng', 'text', 36), C('taxCode', 'MST'), C('description', 'Diễn giải', 'text', 44), C('project', 'Dự án'), C('taxBase', 'Tiền chưa thuế', 'money'), C('vatRate', 'Thuế suất (%)', 'number'), C('vatAmount', 'Tiền VAT', 'money'), C('totalAmount', 'Tổng thanh toán', 'money'), C('deductible', 'Được khấu trừ'), C('deductionReason', 'Căn cứ kiểm soát khấu trừ', 'text', 56), C('paymentStatus', 'Thanh toán'), C('status', 'Trạng thái')], vatRows),
        sheet('Khau_tru_TNCN', 'Sổ khấu trừ thuế TNCN', [C('date', 'Ngày chi trả', 'date'), C('recipient', 'Người nhận', 'text', 36), C('taxCode', 'MST/CCCD'), C('contractType', 'Loại hợp đồng'), C('grossIncome', 'Thu nhập gộp', 'money'), C('taxableIncome', 'Thu nhập tính thuế', 'money'), C('rate', 'Thuế suất (%)', 'number'), C('taxWithheld', 'Thuế khấu trừ', 'money'), C('netPaid', 'Thực nhận', 'money'), C('period', 'Kỳ kê khai'), C('status', 'Trạng thái')], pitRows),
        sheet('Dieu_chinh_TNDN', 'Điều chỉnh thuế TNDN', [C('date', 'Ngày', 'date'), C('fiscalYear', 'Năm'), C('type', 'Loại'), C('category', 'Nhóm điều chỉnh'), C('description', 'Diễn giải', 'text', 50), C('amount', 'Giá trị', 'money'), C('evidenceStatus', 'Hồ sơ'), C('status', 'Trạng thái')], (db.citAdjustments || []).filter((x) => inRange(x.date, range))),
        sheet('Lich_thue', 'Lịch kê khai và nộp thuế', [C('taxType', 'Loại thuế'), C('period', 'Kỳ'), C('frequency', 'Tần suất'), C('dueDate', 'Hạn nộp', 'date'), C('filingStatus', 'Trạng thái hồ sơ'), C('payableAmount', 'Số phải nộp', 'money'), C('paymentStatus', 'Trạng thái tiền'), C('paymentDate', 'Ngày nộp', 'date'), C('referenceNo', 'Mã tiếp nhận'), C('notes', 'Ghi chú', 'text', 44)], db.taxFilings || [])
      ] },
      projects: { id: 'projects', title: 'Dự án và hiệu quả', description: 'Danh mục dự án, P&L dự án, công việc và timesheet', sheets: [
        sheet('Du_an', 'Danh sách dự án', [C('code', 'Mã dự án'), C('name', 'Tên dự án', 'text', 40), C('client', 'Khách hàng', 'text', 36), C('pm', 'PM'), C('status', 'Trạng thái'), C('progress', 'Tiến độ (%)', 'number'), C('contractValue', 'Giá trị hợp đồng', 'money'), C('budget', 'Ngân sách trực tiếp', 'money'), C('revenue', 'Doanh thu kế toán', 'money'), C('cost', 'Chi phí P&L', 'money'), C('profit', 'Lợi nhuận', 'money')], projectRows),
        sheet('Cong_viec', 'Danh sách công việc', [C('title', 'Công việc', 'text', 42), C('project', 'Dự án'), C('assignee', 'Người phụ trách'), C('status', 'Trạng thái'), C('priority', 'Ưu tiên'), C('startDate', 'Bắt đầu', 'date'), C('dueDate', 'Hạn', 'date'), C('estimatedHours', 'Giờ KH', 'number'), C('actualHours', 'Giờ thực tế', 'number')], (db.tasks || []).map((x) => ({ ...x, project: L.project(x.projectId), assignee: L.person(x.assigneeId) }))),
        sheet('Timesheet', 'Timesheet dự án', [C('date', 'Ngày', 'date'), C('project', 'Dự án'), C('person', 'Nhân sự'), C('hours', 'Số giờ', 'number'), C('billable', 'Billable'), C('description', 'Nội dung', 'text', 46), C('approved', 'Phê duyệt')], timesheets)
      ] },
      hr: { id: 'hr', title: 'Nhân sự, chấm công và lương', description: 'Danh sách nhân sự, timesheet và chi phí lao động', sheets: [
        sheet('Nhan_su', 'Danh sách nhân sự', [C('code', 'Mã NV'), C('name', 'Họ tên', 'text', 32), C('role', 'Chức danh'), C('department', 'Bộ môn'), C('type', 'Loại'), C('monthlySalary', 'Lương tháng', 'money'), C('hourlyRate', 'Đơn giá giờ', 'money'), C('billingRate', 'Billing rate', 'money'), C('status', 'Trạng thái')], db.people || []),
        sheet('Timesheet', 'Timesheet', [C('date', 'Ngày', 'date'), C('project', 'Dự án'), C('person', 'Nhân sự'), C('hours', 'Số giờ', 'number'), C('billable', 'Billable'), C('description', 'Nội dung', 'text', 46), C('approved', 'Phê duyệt')], timesheets),
        sheet('Chi_phi_lao_dong', 'Chi phí lao động và khả năng thu hồi', [C('code', 'Mã NV'), C('name', 'Họ tên'), C('department', 'Bộ môn'), C('role', 'Chức danh'), C('type', 'Loại'), C('monthlySalary', 'Lương tháng', 'money'), C('hourlyRate', 'Đơn giá CTV/giờ', 'money'), C('hours', 'Giờ duyệt', 'number'), C('billableHours', 'Giờ billable', 'number'), C('costPerHour', 'Cost/giờ', 'money'), C('allocatedCost', 'Chi phí phân bổ', 'money'), C('recoveredRevenue', 'Doanh thu thu hồi', 'money'), C('utilization', 'Utilization', 'percent')], payrollRows),
        sheet('Bang_luong_chi_tiet', 'Bảng lương chi tiết theo nhân viên', [C('period','Kỳ lương'),C('code','Mã NV'),C('name','Họ tên','text',32),C('department','Bộ môn'),C('role','Chức danh'),C('type','Loại'),C('standardWorkdays','Ngày công chuẩn','number'),C('payableWorkdays','Ngày hưởng lương','number'),C('attendanceDays','Ngày có chấm công','number'),C('approvedHours','Giờ duyệt','number'),C('overtimeHours','Giờ làm thêm','number'),C('billableHours','Giờ billable','number'),C('baseSalary','Lương/tiền công','money'),C('allowances','Phụ cấp','money'),C('allowanceMode','Nguồn phụ cấp'),C('overtimePay','Làm thêm','money'),C('overtimeMode','Nguồn làm thêm'),C('bonus','Thưởng','money'),C('otherIncome','Thu nhập khác','money'),C('grossIncome','Tổng thu nhập','money'),C('insuranceBase','Mức lương đóng BH','money'),C('employeeInsurance','BH người lao động','money'),C('insuranceMode','Nguồn bảo hiểm'),C('taxableIncome','Thu nhập tính thuế','money'),C('personalIncomeTax','Thuế TNCN','money'),C('pitMode','Nguồn TNCN'),C('advanceDeduction','Tạm ứng','money'),C('otherDeductions','Khấu trừ khác','money'),C('netPay','Thực nhận','money'),C('employerInsurance','BH doanh nghiệp','money'),C('totalEmployerCost','Tổng chi phí DN','money'),C('projectAllocatedCost','Phân bổ dự án','money'),C('recoverableRevenue','Doanh thu thu hồi','money'),C('utilization','Utilization','percent'),C('recoveryRatio','Cost Recovery','percent'),C('calculationVersion','Phiên bản công thức'),C('status','Trạng thái'),C('notes','Ghi chú','text',40)], detailedPayrollRows),
        sheet('Thuong_thang_13', 'Ngân sách thưởng tháng lương 13', [C('year','Năm'),C('code','Mã NV'),C('name','Họ tên','text',32),C('department','Bộ môn'),C('averageSalary','Lương bình quân','money'),C('serviceDays','Ngày đủ điều kiện','number'),C('serviceRatio','Tỷ lệ thời gian','percent'),C('employeeFactor','Hệ số cá nhân','number'),C('companyFactor','Hệ số công ty','number'),C('grossBonus','Thưởng dự kiến','money'),C('pitProvision','Dự phòng thuế/gross-up','money'),C('cashBudget','Ngân sách tiền mặt','money'),C('status','Trạng thái')], annualBenefitRows),
        sheet('Quy_du_lich', 'Ngân sách quỹ du lịch hàng năm', [C('year','Năm'),C('eligibleCount','Nhân sự đủ điều kiện','number'),C('expectedParticipants','Số người dự kiến','number'),C('participationRate','Tỷ lệ tham gia','percent'),C('costPerPerson','Chi phí/người','money'),C('perPersonTotal','Chi phí theo đầu người','money'),C('commonCost','Chi phí chung','money'),C('contingency','Dự phòng','money'),C('total','Tổng quỹ du lịch','money'),C('payrollFund','Quỹ lương thực hiện','money'),C('welfareCeiling','Hạn mức phúc lợi ước tính','money'),C('otherWelfareSpent','Phúc lợi khác','money'),C('remainingBeforeTravel','Hạn mức còn lại','money'),C('potentialExcess','Có khả năng vượt hạn mức','money'),C('status','Trạng thái')], annualTravelRows)
      ] },
      crm: { id: 'crm', title: 'Khách hàng, báo giá và doanh thu', description: 'Danh mục khách hàng, pipeline, hóa đơn đầu ra và công nợ', sheets: [
        sheet('Khach_hang', 'Danh sách khách hàng', [C('code', 'Mã KH'), C('name', 'Tên khách hàng', 'text', 42), C('taxCode', 'MST'), C('contact', 'Liên hệ'), C('phone', 'Điện thoại'), C('email', 'Email'), C('status', 'Trạng thái')], db.clients || []),
        sheet('Bao_gia', 'Pipeline báo giá', [C('date', 'Ngày', 'date'), C('client', 'Khách hàng'), C('projectName', 'Cơ hội/Dự án', 'text', 42), C('amount', 'Giá trị', 'money'), C('probability', 'Xác suất (%)', 'number'), C('weighted', 'Doanh thu trọng số', 'money'), C('status', 'Trạng thái')], (db.quotes || []).filter((x) => inRange(x.date, range)).map((x) => ({ ...x, client: L.client(x.clientId), weighted: money(x.amount) * Number(x.probability || 0) / 100 }))),
        sheet('Hoa_don_dau_ra', 'Hóa đơn đầu ra', [C('date', 'Ngày', 'date'), C('serial', 'Ký hiệu'), C('invoiceNo', 'Số HĐ'), C('partner', 'Khách hàng'), C('taxCode', 'MST'), C('description', 'Diễn giải', 'text', 44), C('taxBase', 'Doanh thu chưa VAT', 'money'), C('vatAmount', 'VAT', 'money'), C('totalAmount', 'Tổng thanh toán', 'money'), C('paymentStatus', 'Thanh toán')], vatRows.filter((x) => x.direction === 'Output')),
        sheet('Cong_no_131', 'Công nợ phải thu', [C('partnerCode', 'Mã KH'), C('partner', 'Khách hàng', 'text', 40), C('debit', 'Phát sinh Nợ', 'money'), C('credit', 'Phát sinh Có', 'money'), C('balance', 'Còn phải thu', 'money')], ar)
      ] },
      cashflow: { id: 'cashflow', title: 'Dòng tiền và thanh khoản', description: 'Thu chi quản trị, sổ quỹ và sổ ngân hàng', sheets: [
        sheet('Thu_chi', 'Giao dịch thu chi quản trị', [C('date', 'Ngày', 'date'), C('type', 'Loại'), C('category', 'Nhóm'), C('project', 'Dự án'), C('description', 'Diễn giải', 'text', 48), C('amount', 'Số tiền', 'money'), C('status', 'Trạng thái')], (db.finance || []).filter((x) => inRange(x.date, range)).map((x) => ({ ...x, project: L.project(x.projectId) }))),
        sheet('So_quy', 'Sổ quỹ tiền mặt', [C('date', 'Ngày', 'date'), C('documentNo', 'Số chứng từ'), C('description', 'Diễn giải', 'text', 48), C('debit', 'Thu', 'money'), C('credit', 'Chi', 'money')], cashBook),
        sheet('So_tien_gui', 'Sổ tiền gửi ngân hàng', [C('date', 'Ngày', 'date'), C('documentNo', 'Số chứng từ'), C('description', 'Diễn giải', 'text', 48), C('debit', 'Thu', 'money'), C('credit', 'Chi', 'money')], bankBook),
        sheet(isTT132Regime?'Dong_tien_quan_tri':isTT99Regime?'B03_DN':'B03_DNN', `${isTT132Regime?'Báo cáo dòng tiền quản trị':isTT99Regime?'B03-DN • Báo cáo lưu chuyển tiền tệ':'B03-DNN • Báo cáo lưu chuyển tiền tệ'}`, [C('code', 'Mã số'), C('label', 'Chỉ tiêu', 'text', 48), C('value', 'Số kỳ này', 'money')], (isTT99Regime?t99b03:b03).rows)
      ] },
      master: { id: 'master', title: 'Danh mục và số dư', description: 'Tài khoản, khách hàng, nhà cung cấp, nhân sự, dự án và số dư đầu kỳ', sheets: [
        sheet('Tai_khoan', `Hệ thống tài khoản ${isTT99Regime?'TT99':isTT132Regime?'TT132':'TT133'}`, [C('code', 'Số hiệu TK'), C('name', 'Tên tài khoản', 'text', 48), C('type', 'Loại'), C('normalSide', 'Tính chất'), C('active', 'Hoạt động'), C('postable', 'Được hạch toán'), C('parentCode', 'TK cha')], db.accounts || []),
        sheet('Khach_hang', 'Khách hàng', [C('code', 'Mã KH'), C('name', 'Tên khách hàng', 'text', 42), C('taxCode', 'MST'), C('contact', 'Liên hệ'), C('phone', 'Điện thoại'), C('email', 'Email'), C('status', 'Trạng thái')], db.clients || []),
        sheet('Nha_cung_cap', 'Nhà cung cấp / CTV', [C('code', 'Mã NCC'), C('name', 'Tên NCC/CTV', 'text', 42), C('taxCode', 'MST/CCCD'), C('type', 'Loại'), C('contractType', 'Hợp đồng'), C('phone', 'Điện thoại'), C('email', 'Email'), C('status', 'Trạng thái')], db.vendors || []),
        sheet('Nhan_su', 'Nhân sự', [C('code', 'Mã NV'), C('name', 'Họ tên'), C('role', 'Chức danh'), C('department', 'Bộ môn'), C('type', 'Loại'), C('monthlySalary', 'Lương tháng', 'money'), C('hourlyRate', 'Đơn giá giờ', 'money'), C('billingRate', 'Billing rate', 'money'), C('status', 'Trạng thái')], db.people || []),
        sheet('Du_an', 'Dự án', [C('code', 'Mã dự án'), C('name', 'Tên dự án'), C('clientId', 'ID khách hàng'), C('type', 'Loại công trình'), C('stage', 'Giai đoạn'), C('pmId', 'ID PM'), C('status', 'Trạng thái'), C('startDate', 'Bắt đầu', 'date'), C('endDate', 'Kết thúc', 'date'), C('contractValue', 'Giá trị HĐ', 'money'), C('directBudget', 'Ngân sách', 'money'), C('progress', 'Tiến độ (%)', 'number')], db.projects || []),
        sheet('So_du_dau_ky', 'Số dư đầu kỳ', [C('accountCode', 'Tài khoản'), C('description', 'Diễn giải'), C('debit', 'Dư Nợ', 'money'), C('credit', 'Dư Có', 'money')], db.openingBalances || [])
      ] },
      control: { id: 'control', title: 'Kiểm soát, audit và sao lưu', description: 'Bộ kiểm tra toàn vẹn, nhật ký xuất dữ liệu và bản sao JSON', sheets: [
        sheet('Kiem_tra_toan_ven', 'Bộ kiểm tra toàn vẹn dữ liệu', [C('code', 'Mã kiểm tra'), C('title', 'Nội dung', 'text', 44), C('passText', 'Kết quả'), C('severity', 'Mức độ'), C('detail', 'Chi tiết', 'text', 68), C('count', 'Số lỗi', 'number')], integrity.checks.map((x) => ({ ...x, passText: x.pass ? 'Đạt' : 'Không đạt' }))),
        sheet('Lich_su_xuat', 'Nhật ký kết xuất', [C('createdAt', 'Thời điểm'), C('user', 'Người thực hiện'), C('reportId', 'Báo cáo'), C('format', 'Định dạng'), C('scope', 'Phạm vi'), C('rowCount', 'Số dòng', 'number'), C('status', 'Trạng thái')], db.exportLogs || [])
      ] }
    };
  }

  const state = { api: null, selected: '', format: 'xlsx', scope: 'range', includeHeaders: true };
  const statutoryIds = new Set(['tt133', 'tt99', 'tt132']);
  const accountingRegimeId = (db = {}) => String(db.settings?.accountingRegime || '').includes('TT99') ? 'tt99' : String(db.settings?.accountingRegime || '').includes('TT132') ? 'tt132' : 'tt133';
  const statutoryRegimeCode = (workbook = {}) => workbook.id === 'tt99' ? 'TT99' : workbook.id === 'tt132' ? 'TT132' : workbook.id === 'tt133' ? 'TT133' : '';

  function meta() {
    const db = state.api.getDB(), range = state.api.range(), settings = db.settings || {};
    return {
      company: settings.companyName || 'ALPHA DESIGN CO., LTD', address: settings.companyAddress || '',
      taxCode: settings.taxpayerCode || '', unit: settings.reportUnit || settings.currency || 'VND',
      regime: settings.accountingRegime || '', regimeEffectiveDate: settings.accountingRegimeEffectiveDate || '', range
    };
  }
  function statutoryReleaseGate(workbook) {
    if (!statutoryIds.has(workbook?.id)) return { pass: true, errors: [] };
    const db = state.api.getDB(), regime = String(db.settings?.accountingRegime || '');
    const expectedRegime = statutoryRegimeCode(workbook);
    const isTT99 = workbook.id === 'tt99',isTT132=workbook.id==='tt132';
    const errors = [];
    if (!regime.includes(expectedRegime)) errors.push(`Bộ ${expectedRegime} không khớp chế độ kế toán đang cấu hình (${regime || 'chưa xác định'}). Hãy đổi chế độ tại Thiết lập trước khi phát hành.`);
    const c = workbook.statutoryChecks || {};
    if(isTT132){
      if(!c.b01Balanced)errors.push('B01-DNSN chưa cân đối tài sản và nguồn vốn.');
      if(!c.equityDetailBalanced)errors.push('B01-DNSN chưa khớp chỉ tiêu vốn chủ sở hữu 400 = 410 + 420.');
      if(!c.b02FormulaValid)errors.push('B02-DNSN chưa khớp công thức chỉ tiêu 03 = 01 - 02.');
      if(!c.f01Balanced)errors.push('F01-DNSN chưa cân bằng phát sinh Nợ/Có hoặc số dư cuối kỳ.');
      if(!c.f02Reconciled)errors.push('F02-DNSN chưa đối chiếu số đầu năm + phát sinh - đã nộp = số cuối năm.');
    }else{
      if (!c.b01Balanced) errors.push(`${isTT99 ? 'B01-DN' : 'B01a-DNN'} chưa cân đối tài sản và nguồn vốn.`);
      if (!c.classificationValid) errors.push(`${isTT99 ? 'B01-DN' : 'B01a-DNN'} chưa vượt kiểm tra phân loại tài sản.`);
      if (!c.b03Reconciled) errors.push(`${isTT99 ? 'B03-DN' : 'B03-DNN'} chưa khớp số dư tiền với sổ cái.`);
      if (!c.b03DirectionValid) errors.push(`Có chứng từ tiền dùng mã lưu chuyển tiền sai chiều trên ${isTT99 ? 'B03-DN' : 'B03-DNN'}.`);
      if (!c.b09Complete) errors.push(`${isTT99 ? 'B09-DN' : 'B09-DNN'} chưa hoàn tất các mục thuyết minh.`);
      if (isTT99 && c.mappingValidated !== true) errors.push('TT99 bị khóa phát hành: mapping hiện tại là bản xem trước suy ra từ TT133, chưa đối chiếu đầy đủ Phụ lục IV Thông tư 99/2025/TT-BTC.');
    }

    // The current Cloud certification endpoint and hash contract are TT133-specific.
    // TT99 and TT132 use their local statutory integrity gates until a regime-specific server certificate contract is deployed.
    if (workbook.id==='tt133') {
      const cloud = window.AlphaERP?.getStatutoryCloudAudit?.();
      const range = state.api.range(), revision = Number(db.meta?.revision || 0);
      if (!cloud) errors.push('Chưa chạy đối chiếu BCTC giữa trình duyệt và Supabase.');
      else {
        if (!cloud.pass) errors.push(`Đối chiếu Cloud còn lệch ${cloud.differenceCount || 1} chỉ tiêu.`);
        if (cloud.range?.from !== range.from || cloud.range?.to !== range.to) errors.push('Bằng chứng Cloud không thuộc đúng kỳ báo cáo đang xuất.');
        if (Number(cloud.dbRevision) !== revision) errors.push('Dữ liệu đã thay đổi sau lần đối chiếu Cloud; phải đối chiếu lại.');
        const cert = cloud.certification || {};
        if (cert.status !== 'active') errors.push('Chưa có chứng nhận BCTC do Supabase phát hành.');
        if (String(cert.release_version || '') !== releaseVersion() || Number(cert.migration_version) !== DATABASE_MIGRATION_VERSION) errors.push(`Chứng nhận Cloud không đúng phiên bản ${releaseVersion()} / migration ${String(DATABASE_MIGRATION_VERSION).padStart(3,'0')}.`);
        if (!cert.expires_at || new Date(cert.expires_at) <= new Date()) errors.push('Chứng nhận Cloud đã hết hạn; phải chứng nhận lại.');
        if (!cloud.certificationVerifiedAt || Date.now() - new Date(cloud.certificationVerifiedAt).getTime() > 300000) errors.push('Chứng nhận chưa được xác minh trực tiếp với Supabase trong 5 phút gần nhất.');
        if (Number(cert.b09_approved_count) !== 8) errors.push('Chứng nhận Cloud không xác nhận đủ 8/8 phần B09.');
      }
    }
    return { pass: errors.length === 0, errors };
  }
  async function sha256Canonical(value) {
    if (!globalThis.crypto?.subtle) throw new Error('Trình duyệt không hỗ trợ SHA-256 để xác minh BCTC.');
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  async function statutoryCertificateHashErrors(workbook, certification) {
    const errors = [], Calc = window.AlphaCalc;
    if (!certification) return ['Không có chứng nhận Cloud còn hiệu lực.'];
    const byName = new Map((workbook.sheets || []).map((x) => [x.name, x]));
    const normalized = (name, isB01 = false) => (byName.get(name)?.rows || []).slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
      .map((row) => isB01 ? [String(row.code), Calc.vnd(row.start), Calc.vnd(row.end)] : [String(row.code), Calc.vnd(row.value)]);
    const notes = (window.AlphaERP?.getStatutoryCloudNotes?.() || []).slice()
      .sort((a, b) => String(a.sectionCode).localeCompare(String(b.sectionCode)))
      .map((n) => [String(n.sectionCode), String(n.status || ''), String(n.contentSha256 || ''), String(n.preparedBy || ''), String(n.reviewedBy || ''), String(n.approvedBy || ''), Number(n.workflowVersion || 1)]);
    const [b01, b02, b03, b09] = await Promise.all([
      sha256Canonical(normalized('B01a_DNN', true)), sha256Canonical(normalized('B02_DNN')),
      sha256Canonical(normalized('B03_DNN')), sha256Canonical(notes)
    ]);
    for (const [label, actual, expected] of [
      ['B01', b01, certification.b01_sha256], ['B02', b02, certification.b02_sha256],
      ['B03', b03, certification.b03_sha256], ['B09', b09, certification.b09_sha256]
    ]) if (String(actual).toLowerCase() !== String(expected || '').toLowerCase()) errors.push(`${label} hiện tại không khớp hash trong chứng nhận Supabase.`);
    return errors;
  }

  async function ensureStatutoryReleaseReady(workbook, m = meta()) {
    if (!statutoryIds.has(workbook?.id)) return;
    if (workbook.id === 'tt133') {
      const refresh = window.AlphaERP?.refreshStatutoryCertification;
      if (typeof refresh !== 'function') throw new Error('Không có hàm xác minh chứng nhận Cloud trực tiếp; đã chặn kết xuất BCTC.');
      const certification = await refresh(m.range);
      const hashErrors = await statutoryCertificateHashErrors(workbook, certification);
      if (hashErrors.length) throw new Error(`Bộ BCTC không khớp chứng nhận Cloud:
- ${hashErrors.join('\n- ')}`);
    }
    const gate = statutoryReleaseGate(workbook);
    if (!gate.pass) throw new Error(`Bộ BCTC chưa đủ điều kiện phát hành:
- ${gate.errors.join('\n- ')}`);
  }

  function selectedWorkbook() {
    const db = state.api.getDB(), range = state.api.range(), all = catalog(db, range);
    const regime = accountingRegimeId(db);
    if (!state.selected || !all[state.selected]) state.selected = regime;
    return all[state.selected] || all[regime] || all.tt133;
  }
  function rowCount(workbook) { return (workbook.sheets || []).reduce((s, x) => s + (x.rows || []).length, 0); }
  function logExport(workbook, format, status = 'Success') {
    try {
      const db = state.api.getDB();
      db.exportLogs = Array.isArray(db.exportLogs) ? db.exportLogs : [];
      db.exportLogs.unshift({ id: uid('export'), createdAt: new Date().toISOString(), user: state.api.user?.() || 'Người dùng hiện tại', reportId: workbook.id, format: format.toUpperCase(), scope: state.scope, rowCount: rowCount(workbook), status });
      if (db.exportLogs.length > 5000) db.exportLogs.length = 5000;
      state.api.commit(db, { silent: true });
    } catch (_) { /* audit should not block download */ }
  }

  async function exportSelected() {
    const wb = selectedWorkbook(), m = meta(), base = `${safeName(wb.title)}_${m.range.from || 'ALL'}_${m.range.to || 'ALL'}`;
    try {
      await ensureStatutoryReleaseReady(wb, m);
      if (state.format === 'xlsx') downloadBytes(makeXlsx(wb, m), `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      else if (state.format === 'csv') {
        if (wb.sheets.length === 1) downloadBytes(csvText(wb.sheets[0].columns, wb.sheets[0].rows), `${base}.csv`, 'text/csv;charset=utf-8');
        else downloadBytes(zipFiles(wb.sheets.map((s) => ({ name: `${safeName(s.name)}.csv`, data: csvText(s.columns, s.rows) }))), `${base}_CSV.zip`, 'application/zip');
      } else if (state.format === 'xml') downloadBytes(workbookXml(wb, m), `${base}.xml`, 'application/xml;charset=utf-8');
      else if (state.format === 'json') downloadBytes(JSON.stringify({ meta: m, report: wb }, null, 2), `${base}.json`, 'application/json;charset=utf-8');
      else if (state.format === 'docx') downloadBytes(makeDocx(wb, m), `${base}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      else if (state.format === 'pdf') printWorkbook(wb, m);
      logExport(wb, state.format);
      state.api.toast(`Đã kết xuất ${state.format.toUpperCase()}`);
    } catch (e) {
      logExport(wb, state.format, 'Failed');
      alert(`Không thể kết xuất: ${e.message || e}`);
    }
  }

  function printWorkbook(wb = selectedWorkbook(), m = meta()) {
    const gate = statutoryReleaseGate(wb);
    if (!gate.pass) throw new Error(`Bộ BCTC chưa đủ điều kiện in/phát hành:\n- ${gate.errors.join('\n- ')}`);
    const w = window.open('', '_blank');
    if (!w) throw new Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up cho trang ERP.');
    w.document.open(); w.document.write(reportHtml(wb, m)); w.document.close();
    w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 250);
    return true;
  }

  async function printSelectedWorkbook() {
    const wb = selectedWorkbook(), m = meta();
    try {
      await ensureStatutoryReleaseReady(wb, m);
      printWorkbook(wb, m);
      logExport(wb, 'pdf');
      state.api.toast('Đã mở bản in / PDF');
    } catch (e) {
      logExport(wb, 'pdf', 'Failed');
      alert(`Không thể in/phát hành: ${e.message || e}`);
    }
  }

  async function exportPackage() {
    const db = state.api.getDB(), range = state.api.range(), all = catalog(db, range), m = meta(), files = [];
    const regime = accountingRegimeId(db);
    const activeStatutory = all[regime];
    try {
      await ensureStatutoryReleaseReady(activeStatutory, m);
      Object.values(all).filter((wb) => !statutoryIds.has(wb.id) || wb.id === regime).forEach((wb) => {
        files.push({ name: `01_EXCEL/${safeName(wb.title)}.xlsx`, data: makeXlsx(wb, m) });
        files.push({ name: `02_XML/${safeName(wb.title)}.xml`, data: workbookXml(wb, m) });
        wb.sheets.forEach((s) => files.push({ name: `03_CSV/${safeName(wb.title)}/${safeName(s.name)}.csv`, data: csvText(s.columns, s.rows) }));
      });
      files.push({ name: '04_BACKUP/ALPHA_DESIGN_ERP_Backup.json', data: JSON.stringify(db, null, 2) });
      files.push({ name: 'README.txt', data: `ALPHA DESIGN ERP Cloud v${releaseVersion()}\nGói hồ sơ được tạo: ${new Date().toLocaleString('vi-VN')}\nKỳ: ${range.from || 'Tất cả'} — ${range.to || 'Tất cả'}\n\nLưu ý: XML trong gói là chuẩn trao đổi dữ liệu nội bộ ALPHA ERP. XML nộp cơ quan thuế/hóa đơn điện tử phải qua adapter và kiểm tra schema của cơ quan/nhà cung cấp đang áp dụng.` });
      downloadBytes(zipFiles(files), `ALPHA_DESIGN_ERP_Export_Package_${isoToday()}.zip`, 'application/zip');
      logExport({ id: 'full_package', sheets: Object.values(all).flatMap((x) => x.sheets) }, 'zip');
      state.api.toast('Đã tạo gói hồ sơ ZIP đầy đủ');
    } catch (e) {
      logExport({ id: 'full_package', sheets: activeStatutory?.sheets || [] }, 'zip', 'Failed');
      alert(`Không thể tạo gói ZIP: ${e.message || e}`);
    }
  }

  function templateWorkbook(type) {
    const templates = {
      clients: sheet('Khach_hang', 'Mẫu nhập khách hàng', [C('code', 'Mã khách hàng'), C('name', 'Tên khách hàng'), C('taxCode', 'Mã số thuế'), C('contact', 'Người liên hệ'), C('phone', 'Điện thoại'), C('email', 'Email'), C('status', 'Trạng thái')], [{ code: 'KH-TEST', name: 'Khách hàng mẫu', taxCode: '0100000000', contact: 'Nguyễn Văn A', phone: '0900000000', email: 'test@example.com', status: 'Active' }]),
      vendors: sheet('Nha_cung_cap', 'Mẫu nhập nhà cung cấp/CTV', [C('code', 'Mã NCC'), C('name', 'Tên NCC/CTV'), C('taxCode', 'MST/CCCD'), C('type', 'Loại'), C('contractType', 'Loại hợp đồng'), C('phone', 'Điện thoại'), C('email', 'Email'), C('status', 'Trạng thái')], [{ code: 'NCC-TEST', name: 'Nhà cung cấp mẫu', taxCode: '0100000000', type: 'Company', contractType: 'Nhà cung cấp', phone: '0900000000', email: 'ncc@example.com', status: 'Active' }]),
      projects: sheet('Du_an', 'Mẫu nhập dự án', [C('code', 'Mã dự án'), C('name', 'Tên dự án'), C('clientId', 'ID khách hàng'), C('type', 'Loại công trình'), C('stage', 'Giai đoạn'), C('pmId', 'ID PM'), C('status', 'Trạng thái'), C('startDate', 'Ngày bắt đầu'), C('endDate', 'Ngày kết thúc'), C('contractValue', 'Giá trị HĐ'), C('directBudget', 'Ngân sách'), C('progress', 'Tiến độ')], [{ code: 'AD-TEST', name: 'Dự án mẫu', clientId: 'c1', type: 'Hotel', stage: 'TKCS', pmId: 'p2', status: 'Proposal', startDate: isoToday(), endDate: '', contractValue: 100000000, directBudget: 40000000, progress: 0 }]),
      opening: sheet('So_du_dau_ky', 'Mẫu nhập số dư đầu kỳ', [C('accountCode', 'Tài khoản'), C('description', 'Diễn giải'), C('debit', 'Dư Nợ'), C('credit', 'Dư Có')], [{ accountCode: '1121', description: 'Số dư đầu kỳ', debit: 100000000, credit: 0 }]),
      journals: sheet('Chung_tu', 'Mẫu nhập chứng từ kế toán', [C('date', 'Ngày'), C('documentNo', 'Số chứng từ'), C('sourceType', 'Loại chứng từ'), C('description', 'Diễn giải'), C('projectId', 'ID dự án'), C('partnerType', 'Loại đối tượng'), C('partnerId', 'ID đối tượng'), C('cashFlowCode', 'Mã LCTT'), C('accountCode', 'Tài khoản'), C('lineDescription', 'Diễn giải dòng'), C('debit', 'Nợ'), C('credit', 'Có')], [{ date: isoToday(), documentNo: 'PKT-TEST', sourceType: 'Phiếu kế toán', description: 'Chứng từ mẫu', projectId: '', partnerType: '', partnerId: '', cashFlowCode: '', accountCode: '6422', lineDescription: 'Chi phí mẫu', debit: 1000000, credit: 0 }, { date: isoToday(), documentNo: 'PKT-TEST', sourceType: 'Phiếu kế toán', description: 'Chứng từ mẫu', projectId: '', partnerType: '', partnerId: '', cashFlowCode: '', accountCode: '331', lineDescription: 'Phải trả mẫu', debit: 0, credit: 1000000 }]),
      taxInvoices: sheet('Hoa_don_VAT', 'Mẫu nhập hóa đơn VAT', [C('direction', 'Output/Input'), C('date', 'Ngày'), C('serial', 'Ký hiệu'), C('invoiceNo', 'Số HĐ'), C('partnerType', 'client/vendor'), C('partnerId', 'ID đối tượng'), C('taxCode', 'MST'), C('description', 'Diễn giải'), C('projectId', 'ID dự án'), C('taxBase', 'Tiền chưa thuế'), C('vatRate', 'Thuế suất'), C('deductible', 'Được khấu trừ true/false'), C('paymentMethod', 'Phương thức'), C('paymentStatus', 'Thanh toán'), C('status', 'Trạng thái')], [{ direction: 'Input', date: isoToday(), serial: '1C26TAA', invoiceNo: '00000001', partnerType: 'vendor', partnerId: 'v2', taxCode: '0100000000', description: 'Hóa đơn mẫu', projectId: '', taxBase: 1000000, vatRate: 10, deductible: true, paymentMethod: 'Bank', paymentStatus: 'Paid', status: 'Valid' }])
    };
    const s = templates[type] || templates.clients;
    return { id: `template_${type}`, title: s.title, description: 'Mẫu nhập liệu chuẩn ALPHA ERP', sheets: [s] };
  }
  function exportTemplate(type) {
    const wb = templateWorkbook(type), m = meta();
    downloadBytes(makeXlsx(wb, m), `ALPHA_DESIGN_Mau_nhap_${safeName(type)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    state.api.toast('Đã tải mẫu Excel nhập liệu');
  }


  function parseCsv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    text = String(text || '').replace(/^\ufeff/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    const headers = rows.shift() || [];
    return rows.filter((r) => r.some((v) => String(v).trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [String(h).trim(), r[i] ?? ''])));
  }
  function readStoredZip(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), files = new Map(); let at = 0;
    const td = new TextDecoder('utf-8');
    while (at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
      const method = view.getUint16(at + 8, true), compSize = view.getUint32(at + 18, true), nameLen = view.getUint16(at + 26, true), extraLen = view.getUint16(at + 28, true);
      const nameStart = at + 30, dataStart = nameStart + nameLen + extraLen, name = td.decode(bytes.slice(nameStart, nameStart + nameLen));
      if (method !== 0) throw new Error('File Excel dùng nén không được hỗ trợ trong trình nhập cục bộ. Hãy dùng mẫu Excel do ALPHA ERP phát hành hoặc lưu thành CSV UTF-8.');
      files.set(name, bytes.slice(dataStart, dataStart + compSize)); at = dataStart + compSize;
    }
    return files;
  }
  function xlsxTemplateRows(buffer, type) {
    const files = readStoredZip(buffer), td = new TextDecoder('utf-8'), xml = files.get('xl/worksheets/sheet1.xml');
    if (!xml) throw new Error('Không tìm thấy sheet dữ liệu trong file Excel.');
    const doc = new DOMParser().parseFromString(td.decode(xml), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('File Excel không đọc được.');
    const cellsByRow = [];
    doc.querySelectorAll('sheetData > row').forEach((r) => {
      const ri = Number(r.getAttribute('r') || 0), cells = {};
      r.querySelectorAll('c').forEach((c) => {
        const ref = c.getAttribute('r') || '', col = ref.replace(/\d/g, ''), inline = c.querySelector('is t'), value = inline ? inline.textContent : c.querySelector('v')?.textContent || '';
        cells[col] = value;
      });
      cellsByRow[ri] = cells;
    });
    const tmpl = templateWorkbook(type).sheets[0], letters = tmpl.columns.map((_, i) => colLetter(i + 1));
    const header = cellsByRow[6] || {}, keyByCol = {};
    letters.forEach((l) => { const label = header[l]; const col = tmpl.columns.find((c) => c.label === label || c.key === label); if (col) keyByCol[l] = col.key; });
    if (!Object.keys(keyByCol).length) throw new Error('Tiêu đề cột không khớp mẫu nhập ALPHA ERP.');
    return cellsByRow.slice(7).filter(Boolean).map((cells) => Object.fromEntries(Object.entries(keyByCol).map(([l, key]) => [key, cells[l] ?? '']))).filter((r) => Object.values(r).some((v) => String(v).trim()));
  }
  const num = (v) => Number(String(v ?? '').replace(/[,.\s]/g, '')) || 0;
  const bool = (v) => ['true', '1', 'yes', 'co', 'có'].includes(String(v).trim().toLowerCase());
  function normalizeRows(type, rows) {
    const tmpl = templateWorkbook(type).sheets[0];
    return rows.map((r) => {
      const out = {};
      tmpl.columns.forEach((c) => {
        const raw = r[c.key] ?? r[c.label] ?? '';
        out[c.key] = ['money', 'number'].includes(c.type) || ['contractValue','directBudget','progress','debit','credit','taxBase','vatRate'].includes(c.key) ? num(raw) : raw;
      });
      return out;
    });
  }
  function applyImport(type, rawRows) {
    const db = state.api.getDB(), rows = normalizeRows(type, rawRows), errors = [], created = [];
    const unique = (list, key, value) => !(list || []).some((x) => String(x[key]).trim().toLowerCase() === String(value).trim().toLowerCase());
    if (!rows.length) throw new Error('Không có dòng dữ liệu để nhập.');
    if (type === 'clients') rows.forEach((r, i) => { if (!r.code || !r.name) errors.push(`Dòng ${i + 1}: thiếu mã hoặc tên khách hàng.`); else if (!unique(db.clients, 'code', r.code)) errors.push(`Dòng ${i + 1}: trùng mã khách hàng ${r.code}.`); else created.push({ id: uid('c'), ...r, status: r.status || 'Active' }); });
    if (type === 'vendors') rows.forEach((r, i) => { if (!r.code || !r.name) errors.push(`Dòng ${i + 1}: thiếu mã hoặc tên nhà cung cấp.`); else if (!unique(db.vendors, 'code', r.code)) errors.push(`Dòng ${i + 1}: trùng mã NCC ${r.code}.`); else created.push({ id: uid('v'), ...r, status: r.status || 'Active', resident: true }); });
    if (type === 'projects') rows.forEach((r, i) => { if (!r.code || !r.name) errors.push(`Dòng ${i + 1}: thiếu mã hoặc tên dự án.`); else if (!unique(db.projects, 'code', r.code)) errors.push(`Dòng ${i + 1}: trùng mã dự án ${r.code}.`); else if (r.clientId && !(db.clients || []).some((x) => x.id === r.clientId)) errors.push(`Dòng ${i + 1}: clientId không tồn tại.`); else created.push({ id: uid('pr'), risk: 'Low', ...r, progress: num(r.progress), contractValue: num(r.contractValue), directBudget: num(r.directBudget) }); });
    if (type === 'opening') rows.forEach((r, i) => { if (!(db.accounts || []).some((x) => x.code === String(r.accountCode))) errors.push(`Dòng ${i + 1}: tài khoản ${r.accountCode} không tồn tại.`); else if (num(r.debit) && num(r.credit)) errors.push(`Dòng ${i + 1}: không được đồng thời có Dư Nợ và Dư Có.`); else created.push({ id: uid('ob'), accountCode: String(r.accountCode), description: r.description || 'Số dư đầu kỳ', debit: num(r.debit), credit: num(r.credit) }); });
    if (type === 'taxInvoices') rows.forEach((r, i) => { const base = num(r.taxBase), rate = num(r.vatRate); if (!r.invoiceNo || !r.serial || !r.date) errors.push(`Dòng ${i + 1}: thiếu ngày, ký hiệu hoặc số hóa đơn.`); else if (!['Input', 'Output'].includes(r.direction)) errors.push(`Dòng ${i + 1}: direction phải là Input hoặc Output.`); else if (!(db[r.partnerType === 'client' ? 'clients' : 'vendors'] || []).some((x) => x.id === r.partnerId)) errors.push(`Dòng ${i + 1}: đối tượng không tồn tại.`); else { const vatAmount = money(base * rate / 100); created.push({ id: uid('txi'), ...r, taxBase: base, vatRate: rate, vatAmount, totalAmount: base + vatAmount, deductible: bool(r.deductible), journalEntryId: '', notes: '' }); } });
    if (type === 'journals') {
      const groups = new Map(); rows.forEach((r) => { const k = r.documentNo; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
      groups.forEach((g, doc) => { const first = g[0], debit = g.reduce((s, r) => s + num(r.debit), 0), credit = g.reduce((s, r) => s + num(r.credit), 0); if (!doc || !first.date) errors.push(`Chứng từ ${doc || '(trống)'}: thiếu số hoặc ngày.`); else if ((db.journalEntries || []).some((x) => x.documentNo === doc)) errors.push(`Chứng từ ${doc}: số chứng từ đã tồn tại.`); else if (!debit || debit !== credit) errors.push(`Chứng từ ${doc}: Tổng Nợ ${debit} không bằng Tổng Có ${credit}.`); else if (g.some((r) => !(db.accounts || []).some((a) => a.code === String(r.accountCode)))) errors.push(`Chứng từ ${doc}: có tài khoản không tồn tại.`); else created.push({ id: uid('je'), date: first.date, documentNo: doc, sourceType: first.sourceType || 'Nhập Excel', description: first.description || '', projectId: first.projectId || '', partnerType: first.partnerType || '', partnerId: first.partnerId || '', cashFlowCode: first.cashFlowCode || '', status: 'Draft', lines: g.map((r) => ({ accountCode: String(r.accountCode), description: r.lineDescription || r.description || '', debit: num(r.debit), credit: num(r.credit) })) }); });
    }
    if (errors.length) throw new Error(`Dữ liệu chưa hợp lệ:\n${errors.slice(0, 20).join('\n')}${errors.length > 20 ? `\n... và ${errors.length - 20} lỗi khác` : ''}`);
    const key = ({ clients: 'clients', vendors: 'vendors', projects: 'projects', opening: 'openingBalances', journals: 'journalEntries', taxInvoices: 'taxInvoices' })[type];
    db[key] = [...created, ...(db[key] || [])];
    db.importLogs = Array.isArray(db.importLogs) ? db.importLogs : [];
    db.importLogs.unshift({ id: uid('import'), createdAt: new Date().toISOString(), user: state.api.user?.() || 'Người dùng', type, rowCount: created.length, status: 'Success' });
    if(state.api.commit(db)===false)throw new Error('Hệ thống đang khóa ghi hoặc phiên xác thực không đủ quyền.');
    state.api.toast(`Đã nhập ${created.length} bản ghi hợp lệ`);
  }
  async function importFile(file, type) {
    if (!file) return;
    if(file.size>10*1024*1024)throw new Error('Tệp nhập vượt giới hạn 10 MB.');
    let rows;
    if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text());
    else if (/\.xlsx$/i.test(file.name)) rows = xlsxTemplateRows(await file.arrayBuffer(), type);
    else if (/\.json$/i.test(file.name)) {
      const value = JSON.parse(await file.text());
      if (value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.projects)&&Array.isArray(value.people)) { const count=Object.values(value).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0); if(count>100000)throw new Error('Bản sao vượt giới hạn 100.000 bản ghi.'); if (!confirm('Đây là bản sao toàn bộ dữ liệu. Tiếp tục sẽ thay thế dữ liệu hiện tại?')) return; if(state.api.commit(value)===false)throw new Error('Hệ thống đang khóa ghi hoặc phiên xác thực không đủ quyền.'); state.api.toast('Đã phục hồi bản sao JSON'); return; }
      rows = Array.isArray(value) ? value : value?.rows || [];
    } else throw new Error('Chỉ hỗ trợ .xlsx từ mẫu ALPHA ERP, .csv UTF-8 hoặc .json.');
    if(!Array.isArray(rows))throw new Error('Cấu trúc dòng dữ liệu không hợp lệ.');
    if(rows.length>50000)throw new Error('Tệp nhập vượt giới hạn 50.000 dòng.');
    if (!confirm(`Nhập ${rows.length} dòng vào phân hệ đã chọn? Hệ thống sẽ kiểm tra toàn bộ trước khi ghi dữ liệu.`)) return;
    applyImport(type, rows);
  }

  function render(db, range) {
    const cats = catalog(db, range), regime = accountingRegimeId(db);
    if (!state.selected || !cats[state.selected]) state.selected = regime;
    const current = cats[state.selected] || cats[regime] || cats.tt133;
    const currentRegimeCode = statutoryRegimeCode(current);
    const configuredRegimeCode = regime === 'tt99' ? 'TT99' : regime === 'tt132' ? 'TT132' : 'TT133';
    const regimeMismatch = Boolean(currentRegimeCode && currentRegimeCode !== configuredRegimeCode);
    const formatCards = [
      ['xlsx', 'Excel .XLSX', 'Nhiều sheet, tiêu đề, định dạng tiền và bộ lọc'],
      ['pdf', 'PDF', 'Mở bản in chuẩn A4 để Lưu PDF'],
      ['csv', 'CSV UTF-8', 'Một file hoặc ZIP nhiều bảng'],
      ['xml', 'XML', 'Trao đổi dữ liệu có cấu trúc'],
      ['docx', 'Word .DOCX', 'Báo cáo có bảng và vùng ký'],
      ['json', 'JSON', 'Dữ liệu máy đọc và kiểm toán']
    ];
    return `<div class="export-center">
      <div class="grid export-kpi-grid">
        <div class="card export-summary"><span class="export-icon">⇩</span><div><small>Trung tâm kết xuất</small><strong>6 định dạng</strong><p>Excel, PDF, CSV, XML, Word và JSON</p></div></div>
        <div class="card export-summary"><span class="export-icon cyan">▦</span><div><small>Bộ báo cáo</small><strong>${Object.keys(cats).length} nhóm</strong><p>TT133/TT99/TT132, sổ sách, thuế, dự án, HR và dữ liệu nền</p></div></div>
        <div class="card export-summary"><span class="export-icon green">✓</span><div><small>Phạm vi</small><strong>${range.from || 'Tất cả'} → ${range.to || 'Tất cả'}</strong><p>Theo kỳ báo cáo đang chọn</p></div></div>
        <div class="card export-summary"><span class="export-icon purple">▣</span><div><small>Nhật ký</small><strong>${(db.exportLogs || []).length} lượt</strong><p>Lưu dấu vết kết xuất gần nhất</p></div></div>
      </div>
      <div class="grid export-main-grid section">
        <div class="card export-panel">
          <div class="section-header"><div><h2>1. Chọn bộ dữ liệu / báo cáo</h2><p>Kết xuất theo kỳ và dữ liệu đã ghi sổ.</p></div></div>
          <div class="export-report-list">${Object.values(cats).map((x) => `<button class="export-report ${x.id === state.selected ? 'active' : ''}" data-export-report="${x.id}"><span class="report-radio"></span><div><strong>${escHtml(x.title)}</strong><small>${escHtml(x.description)}</small></div><b>${x.sheets.length} sheet</b></button>`).join('')}</div>
        </div>
        <div class="card export-panel">
          <div class="section-header"><div><h2>2. Chọn định dạng</h2><p>Định dạng tương thích cho lưu trữ, đối chiếu và chia sẻ.</p></div></div>
          <div class="format-grid">${formatCards.map((x) => `<button class="format-card ${x[0] === state.format ? 'active' : ''}" data-export-format="${x[0]}"><span>${x[0].toUpperCase()}</span><strong>${x[1]}</strong><small>${x[2]}</small></button>`).join('')}</div>
          <div class="export-preview"><h3>${escHtml(current.title)}</h3><p>${escHtml(current.description)}</p><div class="preview-tags">${current.sheets.map((s) => `<span>${escHtml(s.name)} • ${s.rows.length} dòng</span>`).join('')}</div>${regimeMismatch ? `<div class="note warning-note export-regime-notice"><strong>Đang xem trước bộ ${escHtml(currentRegimeCode)}.</strong> Chế độ kế toán hiện tại là ${escHtml(configuredRegimeCode)}. Hãy đổi tại Thiết lập trước khi kết xuất hoặc phát hành.</div>` : ''}</div>
          <div class="export-actions"><button class="primary-btn" id="runExport">Kết xuất ${state.format.toUpperCase()}</button><button class="secondary-btn" id="printExport">Xem bản in / PDF</button><button class="secondary-btn" id="fullPackage">Tạo gói ZIP đầy đủ</button></div>
        </div>
      </div>
      <div class="grid two-col section">
        <div class="card export-panel"><div class="section-header"><div><h2>Mẫu Excel nhập liệu</h2><p>Tải mẫu chuẩn để nhập danh mục, số dư và chứng từ.</p></div></div><div class="template-grid">${[['clients','Khách hàng'],['vendors','Nhà cung cấp / CTV'],['projects','Dự án'],['opening','Số dư đầu kỳ'],['journals','Chứng từ kế toán'],['taxInvoices','Hóa đơn VAT']].map((x) => `<button class="template-btn" data-export-template="${x[0]}"><span>⇩</span><strong>${x[1]}</strong><small>.xlsx</small></button>`).join('')}</div><div class="import-box"><h3>Nhập dữ liệu từ mẫu</h3><div class="import-controls"><select id="importTarget" aria-label="Chọn loại dữ liệu cần nhập"><option value="clients">Khách hàng</option><option value="vendors">Nhà cung cấp / CTV</option><option value="projects">Dự án</option><option value="opening">Số dư đầu kỳ</option><option value="journals">Chứng từ kế toán</option><option value="taxInvoices">Hóa đơn VAT</option></select><label class="secondary-btn import-file-label">Chọn file .xlsx / .csv / .json<input id="dataImportFile" type="file" accept=".xlsx,.csv,.json" hidden></label></div></div><div class="note accounting-note"><strong>Kiểm soát nhập liệu:</strong> chỉ dùng mẫu do hệ thống phát hành; toàn bộ dòng được kiểm tra trước khi ghi. Chứng từ nhập từ Excel luôn ở trạng thái Draft và chỉ được Posted sau khi cân đối, phân quyền và kiểm tra kỳ khóa.</div></div>
        <div class="card export-panel"><div class="section-header"><div><h2>Phạm vi hỗ trợ</h2><p>Mức tương thích của từng định dạng.</p></div></div><div class="export-capabilities"><div><span>Excel/CSV/PDF/Word/JSON</span><strong class="badge success">Hoạt động</strong></div><div><span>XML trao đổi dữ liệu ALPHA ERP</span><strong class="badge success">Hoạt động</strong></div><div><span>XML nộp cơ quan thuế / hóa đơn điện tử</span><strong class="badge warning">Cần adapter</strong></div><div><span>Import Excel tùy ý ngoài mẫu</span><strong class="badge warning">Cần kiểm tra mapping</strong></div><div><span>Kết xuất phía server cho hàng triệu dòng</span><strong class="badge warning">Cần worker production</strong></div></div><div class="note danger-note"><strong>Lưu ý pháp lý:</strong> XML nộp thuế và XML hóa đơn điện tử phải đúng schema hiện hành của cơ quan thuế/nhà cung cấp, được ký số và kiểm thử trên môi trường thật. Bản v${escHtml(releaseVersion())} không tự tuyên bố XML nội bộ là hồ sơ nộp chính thức.</div></div>
      </div>
      <div class="card table-card section content-fit-card export-log-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Nhật ký kết xuất gần đây</h2><p>Phục vụ kiểm toán và truy vết dữ liệu.</p></div></div><div class="table-wrap"><table class="table-fit-wide table-export-log"><thead><tr><th>Thời điểm</th><th>Người dùng</th><th>Báo cáo</th><th>Định dạng</th><th class="numeric">Số dòng</th><th>Trạng thái</th></tr></thead><tbody>${(db.exportLogs || []).slice(0, 20).map((x) => `<tr><td>${escHtml(new Date(x.createdAt).toLocaleString('vi-VN'))}</td><td>${escHtml(x.user || '')}</td><td>${escHtml(x.reportId || '')}</td><td><span class="badge info">${escHtml(x.format || '')}</span></td><td class="numeric">${fmt.format(x.rowCount || 0)}</td><td><span class="badge ${x.status === 'Success' ? 'success' : 'danger'}">${escHtml(x.status || '')}</span></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Chưa có lượt kết xuất nào.</td></tr>'}</tbody></table></div></div>
    </div>`;
  }

  function bind(api) {
    state.api = api;
    document.querySelectorAll('[data-export-report]').forEach((b) => b.onclick = () => { state.selected = b.dataset.exportReport; api.rerender(); });
    document.querySelectorAll('[data-export-format]').forEach((b) => b.onclick = () => { state.format = b.dataset.exportFormat; api.rerender(); });
    document.querySelectorAll('[data-export-template]').forEach((b) => b.onclick = () => exportTemplate(b.dataset.exportTemplate));
    document.getElementById('runExport')?.addEventListener('click', exportSelected);
    document.getElementById('printExport')?.addEventListener('click', () => { void printSelectedWorkbook(); });
    document.getElementById('fullPackage')?.addEventListener('click', () => { void exportPackage(); });
    document.getElementById('dataImportFile')?.addEventListener('change', async (e) => { try { await importFile(e.target.files?.[0], document.getElementById('importTarget')?.value || 'clients'); } catch (err) { alert(err.message || err); } finally { e.target.value = ''; } });
  }

  window.AlphaExportCenter = { render, bind, makeXlsx, makeDocx, zipFiles, catalog };
})();
