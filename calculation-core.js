(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AlphaCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const isNumeric = (v) => v !== null && v !== '' && Number.isFinite(Number(v));
  // VND has no decimal subunit. Preserve exact integers and round halves
  // away from zero. The previous relative EPSILON adjustment grew with the
  // amount and could add several VND near Number.MAX_SAFE_INTEGER.
  const vnd = (v) => {
    const value = n(v);
    if (!value) return 0;
    if (Number.isInteger(value)) return Object.is(value, -0) ? 0 : value;
    const absolute = Math.abs(value);
    const whole = Math.floor(absolute);
    const fraction = absolute - whole;
    const tolerance = Math.min(0.00025, Number.EPSILON * Math.max(1, absolute) * 2);
    const rounded = fraction > 0.5 || Math.abs(fraction - 0.5) <= tolerance ? whole + 1 : whole;
    if (rounded === 0) return 0;
    return value < 0 ? -rounded : rounded;
  };
  const sum = (rows, selector = (x) => x) => (Array.isArray(rows) ? rows : []).reduce((s, x) => s + n(selector(x)), 0);
  const norm = (v) => String(v ?? '').trim().toLowerCase();
  const statusIs = (value, ...expected) => expected.map(norm).includes(norm(value));
  const boolish = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : fallback;
    const text = norm(value);
    if (['true','1','yes','y','on','approved','deductible'].includes(text)) return true;
    if (['false','0','no','n','off','none','null','undefined',''].includes(text)) return false;
    return fallback;
  };
  const idKey = (value) => value === undefined || value === null ? '' : String(value);
  const hasId = (value) => value !== undefined && value !== null && String(value) !== '';
  const sameId = (a, b) => hasId(a) && idKey(a) === idKey(b);
  const distributeVnd = (value, count) => {
    const total = Math.max(0, vnd(value));
    const parts = Math.max(1, Math.trunc(n(count)) || 1);
    const base = Math.floor(total / parts), remainder = total - base * parts;
    return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
  };
  const PIPELINE_PROJECT_STATUSES = new Set(['lead','opportunity','proposal','quotation','tender','negotiation','prospect']);
  const CANCELLED_PROJECT_STATUSES = new Set(['cancelled','canceled','terminated','rejected','deleted','void']);
  const COMMITTED_CONTRACT_STATUSES = new Set(['active','signed','effective','approved','completed','closed','fulfilled']);
  const EXCLUDED_CONTRACT_STATUSES = new Set(['draft','proposal','quotation','submitted','pending','review','rejected','cancelled','canceled','terminated','deleted','void','superseded']);
  const INCLUDED_COMMITMENT_STATUSES = new Set(['approved','active','ordered','committed','partially fulfilled','partially paid','open']);
  const RECOGNIZED_INVOICE_STATUSES = new Set(['valid','adjusted','issued','posted','approved','accepted','active','completed']);
  const RECOGNIZED_PIT_STATUSES = new Set(['withheld','declared','paid','posted','approved','completed']);
  const projectLifecycle = (project = {}) => {
    const status = norm(project.status);
    if (CANCELLED_PROJECT_STATUSES.has(status)) return 'excluded';
    if (PIPELINE_PROJECT_STATUSES.has(status)) return 'pipeline';
    if (status === 'completed' || status === 'closed') return 'completed';
    if (status === 'on hold' || status === 'paused') return 'on-hold';
    return 'active';
  };
  const contractIsCommitted = (contract = {}) => {
    const status = norm(contract.status);
    if (EXCLUDED_CONTRACT_STATUSES.has(status)) return false;
    if (COMMITTED_CONTRACT_STATUSES.has(status)) return true;
    if (isISODate(contract.signedDate ?? contract.signed_date)) return true;
    // Legacy imports often omitted status. Count them unless explicitly excluded.
    return !status;
  };
  const commitmentIsIncluded = (row = {}) => {
    const status = norm(row.status);
    return INCLUDED_COMMITMENT_STATUSES.has(status) || (!status && Boolean(row.approved === true));
  };
  const activeInvoice = (invoice = {}) => {
    const status = norm(invoice.status);
    // Preserve explicitly status-less legacy invoices, but never let workflow drafts
    // or replaced/cancelled documents enter VAT, AR, revenue-link or aging totals.
    return !status || RECOGNIZED_INVOICE_STATUSES.has(status);
  };
  const invoiceBase = (invoice = {}) => Math.max(0, vnd(invoice.taxBase ?? invoice.tax_base ?? invoice.netAmount ?? invoice.net_amount));
  const invoiceVat = (invoice = {}) => Math.max(0, vnd(invoice.vatAmount ?? invoice.vat_amount ?? invoice.taxAmount ?? invoice.tax_amount));
  const invoiceTotal = (invoice = {}) => Math.max(0, vnd(invoice.totalAmount ?? invoice.total_amount ?? (invoiceBase(invoice) + invoiceVat(invoice))));
  const rowId = (row = {}) => row.id ?? row.uuid ?? row.code ?? '';
  // Management cash actuals are cash-settlement facts, not accounting workflow states.
  // Posted journal entries remain authoritative for P&L; only Paid finance rows enter cash.
  const financePaid = (row = {}) => statusIs(row.status, 'paid');
  const allocationIsPosted = (row = {}) => statusIs(row.status || 'Posted', 'posted', 'paid', 'applied', 'completed');
  const pitWithholdingIsRecognized = (row = {}) => {
    const status = norm(row.status);
    // Status-less imports are retained as recognized legacy evidence; every new
    // browser/server write is required to carry an explicit workflow status.
    return !status || RECOGNIZED_PIT_STATUSES.has(status);
  };
  const allocationDate = (row = {}) => row.date ?? row.allocationDate ?? row.allocation_date ?? row.paymentDate ?? row.payment_date ?? '';
  const allocationAmount = (row = {}) => Math.max(0, vnd(row.amount ?? row.allocatedAmount ?? row.allocated_amount));
  const allocationInvoiceId = (row = {}) => String(row.invoiceId ?? row.invoice_id ?? '');
  const allocationPaymentId = (row = {}) => String(row.paymentId ?? row.payment_id ?? '');
  const allocationOrder = (a, b) => String(allocationDate(a)).localeCompare(String(allocationDate(b))) || String(rowId(a)).localeCompare(String(rowId(b)));
  function allocationRecognitionBase(db = {}, row = {}, linkedInvoice = null, state = null) {
    if (!allocationIsPosted(row) || allocationAmount(row) <= 0 || !isISODate(allocationDate(row))) return false;
    const invoice = linkedInvoice || state?.invoiceById.get(allocationInvoiceId(row)) || (db.taxInvoices || []).find((x) => String(rowId(x)) === allocationInvoiceId(row));
    if (!invoice || !activeInvoice(invoice) || !statusIs(invoice.direction, 'output')) return false;
    const paymentId = allocationPaymentId(row);
    // Legacy allocations without paymentId remain documentary evidence. New rows
    // are constrained by the browser/database validators to carry paymentId.
    if (!paymentId) return true;
    const payment = state?.paymentById.get(paymentId) || (db.finance || []).find((x) => String(rowId(x)) === paymentId);
    if (!payment || !financePaid(payment) || !statusIs(payment.type, 'income') || isInternalTransfer(payment)) return false;
    if (!isISODate(payment.date) || payment.date > allocationDate(row)) return false;
    const paymentProject = payment.projectId ?? payment.project_id;
    const invoiceProject = invoice.projectId ?? invoice.project_id;
    return !(paymentProject && invoiceProject && String(paymentProject) !== String(invoiceProject));
  }
  function buildAllocationState(db = {}) {
    const cache = cacheFor(db);
    if (cache?.allocationState) return cache.allocationState;
    const invoiceById = new Map((db.taxInvoices || []).map((row) => [String(rowId(row)), row]).filter(([id]) => id));
    const paymentById = new Map((db.finance || []).map((row) => [String(rowId(row)), row]).filter(([id]) => id));
    const allByInvoice = new Map(), allByPayment = new Map(), baseByInvoice = new Map(), baseByPayment = new Map();
    const baseRecognized = new Set(), invoiceAccepted = new Set(), paymentAccepted = new Set(), accepted = new Set();
    const push = (map, key, row) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
    for (const row of (db.paymentAllocations || [])) {
      const invoiceId = allocationInvoiceId(row), paymentId = allocationPaymentId(row);
      push(allByInvoice, invoiceId, row); push(allByPayment, paymentId, row);
      const invoice = invoiceById.get(invoiceId);
      if (!allocationRecognitionBase(db, row, invoice, { invoiceById, paymentById })) continue;
      baseRecognized.add(row); push(baseByInvoice, invoiceId, row); push(baseByPayment, paymentId, row);
    }
    const admit = (rows, cap, targetSet) => {
      let used = 0;
      for (const row of rows.slice().sort(allocationOrder)) {
        const amount = allocationAmount(row);
        if (used + amount > cap + 1) continue;
        used += amount; targetSet.add(row);
      }
      return vnd(used);
    };
    const baseInvoiceTotals = new Map(), basePaymentTotals = new Map();
    for (const [id, rows] of baseByInvoice) {
      baseInvoiceTotals.set(id, vnd(sum(rows, allocationAmount)));
      admit(rows, invoiceTotal(invoiceById.get(id) || {}), invoiceAccepted);
    }
    for (const [id, rows] of baseByPayment) {
      if (!id) continue;
      basePaymentTotals.set(id, vnd(sum(rows, allocationAmount)));
      admit(rows, Math.max(0, vnd(paymentById.get(id)?.amount)), paymentAccepted);
    }
    for (const row of baseRecognized) {
      if (invoiceAccepted.has(row) && (!allocationPaymentId(row) || paymentAccepted.has(row))) accepted.add(row);
    }
    const state = { invoiceById, paymentById, allByInvoice, allByPayment, baseByInvoice, baseByPayment, baseRecognized, invoiceAccepted, paymentAccepted, accepted, baseInvoiceTotals, basePaymentTotals };
    if (cache) cache.allocationState = state;
    return state;
  }
  function allocationIsRecognized(db = {}, row = {}, invoice = null) {
    const state = buildAllocationState(db);
    const invoiceId = allocationInvoiceId(row);
    // Support validation of a prospective row/invoice not yet present in db.
    if (invoice && !state.invoiceById.has(invoiceId)) return allocationRecognitionBase(db, row, invoice, state);
    return state.baseRecognized.has(row);
  }
  function allocationWithinSourceCaps(db = {}, row = {}, invoice = null) {
    const state = buildAllocationState(db);
    const invoiceId = allocationInvoiceId(row);
    if (invoice && !state.invoiceById.has(invoiceId)) {
      // Prospective validation falls back to the exact ordered-cap algorithm.
      if (!allocationRecognitionBase(db, row, invoice, state)) return false;
      const sameRow = (candidate) => {
        const candidateId=rowId(candidate), targetId=rowId(row);
        return candidateId&&targetId?String(candidateId)===String(targetId):candidate===row;
      };
      const admitted = (rows, target) => {
        let used=0;
        for (const candidate of rows.slice().sort(allocationOrder)) {
          const amount=allocationAmount(candidate);
          if (used+amount>target+1) { if (sameRow(candidate)) return false; continue; }
          used+=amount; if (sameRow(candidate)) return true;
        }
        return false;
      };
      const invoiceRows=[...(state.allByInvoice.get(String(rowId(invoice)))||[]),row].filter((candidate)=>allocationRecognitionBase(db,candidate,invoice,state));
      if(!admitted(invoiceRows,invoiceTotal(invoice)))return false;
      const paymentId=allocationPaymentId(row); if(!paymentId)return true;
      const payment=state.paymentById.get(paymentId);
      const paymentRows=[...(state.allByPayment.get(paymentId)||[]),row].filter((candidate)=>allocationRecognitionBase(db,candidate,null,state));
      return Boolean(payment&&admitted(paymentRows,Math.max(0,vnd(payment.amount))));
    }
    return state.accepted.has(row);
  }
  const isInternalTransfer = (row = {}) => Boolean(row.transferId ?? row.transfer_id) || statusIs(row.transactionNature ?? row.transaction_nature, 'internal transfer', 'transfer', 'chuyển nội bộ') || /chuyển\s*(quỹ|tiền|nội bộ)|internal\s*transfer/i.test(String(row.category || ''));
  const entryCashFlowCode = (entry = {}) => entry.cashFlowCode ?? entry.cash_flow_code ?? '';
  const CASH_FLOW_DIRECTIONS = Object.freeze({
    '01':'inflow','02':'outflow','03':'outflow','04':'outflow','05':'outflow','06':'inflow','07':'outflow',
    '21':'outflow','22':'inflow','23':'outflow','24':'inflow','25':'outflow','26':'inflow','27':'inflow',
    '31':'inflow','32':'outflow','33':'inflow','34':'outflow','35':'outflow','36':'outflow','61':'either'
  });
  const cashFlowCodeNormalized = (entryOrCode = '') => String(typeof entryOrCode === 'object' ? entryCashFlowCode(entryOrCode) : entryOrCode).trim().padStart(2,'0');
  const cashFlowExpectedDirection = (entryOrCode = '') => CASH_FLOW_DIRECTIONS[cashFlowCodeNormalized(entryOrCode)] || '';
  const cashFlowActualDirection = (entry = {}) => { const net=journalCashNet(entry); return net>0?'inflow':net<0?'outflow':'none'; };
  const lineAccountCode = (line = {}) => String(line.accountCode ?? line.account_code ?? '');
  function journalProjectIds(entry = {}) {
    return new Set([
      entry.projectId ?? entry.project_id,
      ...(entry.lines || []).map((line) => line.projectId ?? line.project_id)
    ].filter(Boolean).map(String));
  }
  function journalCashNet(entry = {}) {
    return vnd(sum(entry.lines || [], (line) => /^(111|112)/.test(String(line.accountCode ?? line.account_code ?? ''))
      ? vnd(line.debit) - vnd(line.credit)
      : 0));
  }
  function financeJournalMatch(db = {}, row = {}, candidate = null) {
    if (!financePaid(row) || isInternalTransfer(row) || !statusIs(row.type, 'income', 'expense')) return false;
    const linkedId = row.journalEntryId ?? row.journal_entry_id ?? row.postingId ?? row.posting_id ?? '';
    const entry = candidate || (db.journalEntries || []).find((item) => String(rowId(item)) === String(linkedId));
    if (!entry || !statusIs(entry.status, 'posted') || !isISODate(row.date) || entry.date !== row.date) return false;
    const amount = Math.max(0, vnd(row.amount));
    if (!amount) return false;
    const expectedCashNet = statusIs(row.type, 'income') ? amount : -amount;
    if (journalCashNet(entry) !== expectedCashNet) return false;
    const projectId = row.projectId ?? row.project_id ?? '';
    return !hasId(projectId) || journalProjectIds(entry).has(String(projectId));
  }
  const linkedInputInvoiceId = (row = {}) => String(row.invoiceId ?? row.invoice_id ?? row.taxInvoiceId ?? row.tax_invoice_id ?? '');
  function inputInvoiceVendorId(db = {}, invoice = {}) {
    const direct = invoice.vendorId ?? invoice.vendor_id;
    if (hasId(direct)) return String(direct);
    if (statusIs(invoice.partnerType ?? invoice.partner_type, 'vendor') && hasId(invoice.partnerId ?? invoice.partner_id)) return String(invoice.partnerId ?? invoice.partner_id);
    const taxCode = String(invoice.taxCode ?? invoice.tax_code ?? '').replace(/\s+/g, '');
    if (!taxCode) return '';
    const vendor = (db.vendors || []).find((row) => String(row.taxCode ?? row.tax_code ?? '').replace(/\s+/g, '') === taxCode);
    return vendor ? String(rowId(vendor)) : '';
  }
  function financeVendorId(row = {}) {
    const direct = row.vendorId ?? row.vendor_id;
    if (hasId(direct)) return String(direct);
    if (statusIs(row.partnerType ?? row.partner_type, 'vendor') && hasId(row.partnerId ?? row.partner_id)) return String(row.partnerId ?? row.partner_id);
    return '';
  }
  function inputVatPaymentPartyMatch(db = {}, invoice = {}, payment = {}, journal = null) {
    const invoiceVendor = inputInvoiceVendorId(db, invoice);
    if (!invoiceVendor) return false;
    const paymentVendor = financeVendorId(payment);
    if (paymentVendor) return paymentVendor === invoiceVendor;
    const entry = journal || (db.journalEntries || []).find((row) => String(rowId(row)) === String(payment.journalEntryId ?? payment.journal_entry_id ?? payment.postingId ?? payment.posting_id ?? ''));
    if (!entry) return false;
    const partyMatches = (row) => statusIs(row.partnerType ?? row.partner_type, 'vendor')
      && String(row.partnerId ?? row.partner_id ?? '') === invoiceVendor;
    return partyMatches(entry) || (entry.lines || []).some(partyMatches);
  }
  function inputVatBankPaymentMatch(db = {}, invoice = {}, payment = {}, candidateJournal = null) {
    if (!activeInvoice(invoice) || !statusIs(invoice.direction, 'input') || !financePaid(payment) || !statusIs(payment.type, 'expense') || isInternalTransfer(payment)) return false;
    if (linkedInputInvoiceId(payment) !== String(rowId(invoice))) return false;
    if (!isISODate(payment.date)) return false;
    const entry = candidateJournal || (db.journalEntries || []).find((row) => String(rowId(row)) === String(payment.journalEntryId ?? payment.journal_entry_id ?? payment.postingId ?? payment.posting_id ?? ''));
    if (!financeJournalMatch(db, payment, entry)) return false;
    const bankNet = vnd(sum(entry.lines || [], (line) => /^112/.test(lineAccountCode(line)) ? vnd(line.debit) - vnd(line.credit) : 0));
    const cashNet = vnd(sum(entry.lines || [], (line) => /^111/.test(lineAccountCode(line)) ? vnd(line.debit) - vnd(line.credit) : 0));
    if (bankNet !== -Math.max(0, vnd(payment.amount)) || cashNet !== 0) return false;
    return inputVatPaymentPartyMatch(db, invoice, payment, entry);
  }
  function inputVatPaymentEvidence(db = {}, invoice = {}, options = {}) {
    const asOf = isISODate(options.asOf ?? options.as_of ?? options.to) ? (options.asOf ?? options.as_of ?? options.to) : localISODate();
    const invoiceId = String(rowId(invoice));
    const invoiceGross = invoiceTotal(invoice);
    const linked = (db.finance || []).filter((row) => linkedInputInvoiceId(row) === invoiceId);
    const qualifying = linked.filter((row) => row.date <= asOf && inputVatBankPaymentMatch(db, invoice, row)).sort((a,b) => String(a.date).localeCompare(String(b.date)) || String(rowId(a)).localeCompare(String(rowId(b))));
    const accepted = [], rejected = [];
    let paidGross = 0;
    for (const row of qualifying) {
      const amount = Math.max(0, vnd(row.amount));
      if (!amount || paidGross + amount > invoiceGross + 1) { rejected.push(row); continue; }
      paidGross += amount; accepted.push(row);
    }
    const qualifyingIds = new Set(qualifying.map((row) => row));
    linked.forEach((row) => { if (!qualifyingIds.has(row)) rejected.push(row); });
    return { asOf, invoiceId, invoiceGross, paidGross:Math.min(invoiceGross,vnd(paidGross)), accepted, rejected, linkedCount:linked.length };
  }
  function inputInvoicePaymentConstraint(db = {}, payment = {}, paymentId = '') {
    const invoiceId = linkedInputInvoiceId(payment);
    if (!invoiceId) return { valid:true, errors:[], invoice:null, linkedTotal:0 };
    const invoice = (db.taxInvoices || []).find((row) => String(rowId(row)) === invoiceId);
    const errors = [];
    if (!invoice || !activeInvoice(invoice) || !statusIs(invoice.direction, 'input')) errors.push('Khoản chi chỉ được liên kết với hóa đơn đầu vào hợp lệ.');
    if (!statusIs(payment.type, 'expense')) errors.push('Thanh toán hóa đơn đầu vào phải là giao dịch Expense.');
    const invoiceProject = invoice?.projectId ?? invoice?.project_id ?? '';
    const paymentProject = payment.projectId ?? payment.project_id ?? '';
    if (invoiceProject && paymentProject && String(invoiceProject) !== String(paymentProject)) errors.push('Khoản chi và hóa đơn đầu vào phải thuộc cùng dự án.');
    const invoiceVendor = invoice ? inputInvoiceVendorId(db, invoice) : '';
    const paymentVendor = financeVendorId(payment);
    if (invoiceVendor && paymentVendor && invoiceVendor !== paymentVendor) errors.push('Nhà cung cấp trên khoản chi không khớp hóa đơn đầu vào.');
    if (invoice && financePaid(payment) && !inputVatBankPaymentMatch(db, invoice, payment)) errors.push('Khoản Paid phải có bút toán ngân hàng 112 Posted đúng số tiền và đúng nhà cung cấp.');
    const id = String(paymentId || rowId(payment) || '');
    const linkedTotal = vnd(sum((db.finance || []).filter((row) => String(rowId(row)) !== id && linkedInputInvoiceId(row) === invoiceId && financePaid(row)), (row) => row.amount));
    if (invoice && financePaid(payment) && linkedTotal + Math.max(0,vnd(payment.amount)) > invoiceTotal(invoice) + 1) errors.push('Tổng khoản chi Paid liên kết vượt tổng thanh toán của hóa đơn đầu vào.');
    return { valid:errors.length===0, errors, invoice, linkedTotal };
  }
  function financeJournalCandidates(db = {}, row = {}) {
    return (db.journalEntries || []).filter((entry) => financeJournalMatch(db, row, entry));
  }
  function invoiceAllocationConstraint(db = {}, invoice = {}, invoiceId = '') {
    const id = String(invoiceId || rowId(invoice) || '');
    const linked = (db.paymentAllocations || []).filter((allocation) =>
      String(allocation.invoiceId ?? allocation.invoice_id ?? '') === id
      && allocationIsPosted(allocation)
      && allocationAmount(allocation) > 0
      && isISODate(allocationDate(allocation)));
    const allocated = vnd(sum(linked, allocationAmount));
    const errors = [];
    if (allocated > 0) {
      if (!statusIs(invoice.direction, 'output') || !activeInvoice(invoice)) errors.push('Hóa đơn đã có phân bổ thu tiền phải tiếp tục là hóa đơn đầu ra ở trạng thái được ghi nhận.');
      if (invoiceTotal(invoice) + 1 < allocated) errors.push(`Tổng hóa đơn không được thấp hơn số đã phân bổ ${allocated} VND.`);
      const invoiceProject = invoice.projectId ?? invoice.project_id ?? '';
      const crossProject = linked.some((allocation) => {
        const paymentId = allocation.paymentId ?? allocation.payment_id ?? '';
        const payment = (db.finance || []).find((row) => String(rowId(row)) === String(paymentId));
        const paymentProject = payment?.projectId ?? payment?.project_id ?? '';
        return paymentProject && String(invoiceProject || '') !== String(paymentProject);
      });
      if (crossProject) errors.push('Dự án của hóa đơn không được khác dự án trên khoản thu đã phân bổ.');
    }
    return { valid: errors.length === 0, errors, allocated, linked };
  }
  function paymentAllocationConstraint(db = {}, payment = {}, paymentId = '') {
    const id = String(paymentId || rowId(payment) || '');
    const linked = (db.paymentAllocations || []).filter((allocation) =>
      String(allocation.paymentId ?? allocation.payment_id ?? '') === id
      && allocationIsPosted(allocation)
      && allocationAmount(allocation) > 0
      && isISODate(allocationDate(allocation)));
    const allocated = vnd(sum(linked, allocationAmount));
    const errors = [];
    if (allocated > 0) {
      if (!financePaid(payment) || !statusIs(payment.type, 'income') || isInternalTransfer(payment)) errors.push('Khoản tiền đã phân bổ phải tiếp tục là khoản thu Paid, không phải chuyển nội bộ.');
      if (vnd(payment.amount) + 1 < allocated) errors.push(`Số tiền khoản thu không được thấp hơn số đã phân bổ ${allocated} VND.`);
      if (!isISODate(payment.date) || linked.some((allocation) => allocationDate(allocation) < payment.date)) errors.push('Ngày khoản thu không được sau ngày phân bổ hóa đơn.');
      const paymentProject = payment.projectId ?? payment.project_id ?? '';
      const crossProject = linked.some((allocation) => {
        const invoiceId = allocation.invoiceId ?? allocation.invoice_id ?? '';
        const invoice = (db.taxInvoices || []).find((row) => String(rowId(row)) === String(invoiceId));
        const invoiceProject = invoice?.projectId ?? invoice?.project_id ?? '';
        return invoiceProject && String(paymentProject || '') !== String(invoiceProject);
      });
      if (crossProject) errors.push('Dự án của khoản thu không được khác dự án trên hóa đơn đã phân bổ.');
    }
    return { valid: errors.length === 0, errors, allocated, linked };
  }
  const cacheByDb = typeof WeakMap === 'function' ? new WeakMap() : null;
  const cacheFor = (db) => {
    if (!db || !cacheByDb || !Number.isFinite(Number(db?.meta?.revision))) return null;
    const revision = Number(db.meta.revision);
    const existing = cacheByDb.get(db);
    if (existing?.revision === revision) return existing;
    const fresh = { revision };
    cacheByDb.set(db, fresh);
    return fresh;
  };
  function cachedIdMap(db, cacheName, rows = []) {
    const cache = cacheFor(db);
    if (cache?.[cacheName]) return cache[cacheName];
    const map = new Map(rows.map((row) => [String(rowId(row)), row]).filter(([id]) => id));
    if (cache) cache[cacheName] = map;
    return map;
  }
  function cachedGroups(db, cacheName, rows = [], keyOf = () => '') {
    const cache = cacheFor(db);
    if (cache?.[cacheName]) return cache[cacheName];
    const groups = new Map();
    for (const row of rows) {
      const key = String(keyOf(row) ?? '');
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    if (cache) cache[cacheName] = groups;
    return groups;
  }
  const isISODate = (value) => {
    const text = String(value || '');
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  const localISODate = (d = new Date()) => {
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return '';
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const inRange = (date, from = '', to = '') => isISODate(date) && (!from || (isISODate(from) && date >= from)) && (!to || (isISODate(to) && date <= to));
  const monthOf = (date) => String(date || '').slice(0, 7);
  const dateAtNoon = (value) => isISODate(value) ? new Date(`${value}T12:00:00`) : null;
  const addDaysISO = (value, days) => {
    const date = dateAtNoon(value);
    if (!date) return '';
    date.setDate(date.getDate() + Number(days || 0));
    return localISODate(date);
  };
  const monthBounds = (key) => {
    if (!/^\d{4}-\d{2}$/.test(String(key))) return { from: '', to: '' };
    const [year, month] = String(key).split('-').map(Number);
    if (month < 1 || month > 12) return { from: '', to: '' };
    return { from: `${year}-${String(month).padStart(2, '0')}-01`, to: localISODate(new Date(year, month, 0)) };
  };
  const employmentDates = (person = {}) => ({
    from: person.startDate ?? person.start_date ?? person.hireDate ?? person.hire_date ?? person.joinDate ?? person.join_date ?? '',
    to: person.endDate ?? person.end_date ?? person.terminationDate ?? person.termination_date ?? person.leaveDate ?? person.leave_date ?? ''
  });
  const activeDuring = (person = {}, range = {}) => {
    const employment = employmentDates(person);
    const from = isISODate(range.from) ? range.from : '';
    const to = isISODate(range.to) ? range.to : '';
    const hasEmploymentDates = isISODate(employment.from) || isISODate(employment.to);
    if (isISODate(employment.from) && to && employment.from > to) return false;
    if (isISODate(employment.to) && from && employment.to < from) return false;
    // Nhân sự đã nghỉ vẫn phải được tính đúng cho giai đoạn lịch sử trước ngày nghỉ.
    if (hasEmploymentDates) return true;
    return !statusIs(person.status, 'inactive', 'terminated', 'resigned', 'deleted');
  };
  function workingDaysInRange(range = {}, settings = {}, person = null) {
    if (!isISODate(range.from) || !isISODate(range.to) || range.from > range.to) return 0;
    let from = range.from, to = range.to;
    if (person) {
      const employment = employmentDates(person);
      if (isISODate(employment.from) && employment.from > from) from = employment.from;
      if (isISODate(employment.to) && employment.to < to) to = employment.to;
      if (from > to || !activeDuring(person, { from, to })) return 0;
    }
    const configuredWeekdays = settings.workWeekdays ?? settings.work_weekdays;
    const configured = Array.isArray(configuredWeekdays) ? configuredWeekdays : [1,2,3,4,5];
    const weekdays = new Set(configured.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6));
    const holidayRows = settings.holidays ?? settings.holiday_dates ?? [];
    const holidays = new Set((Array.isArray(holidayRows) ? holidayRows : []).filter(isISODate));
    let count = 0;
    for (let cursor = from; cursor <= to; cursor = addDaysISO(cursor, 1)) {
      const date = dateAtNoon(cursor);
      if (date && weekdays.has(date.getDay()) && !holidays.has(cursor)) count += 1;
    }
    return count;
  }
  function monthlyEmploymentCost(person = {}, key = '', settings = {}, reportRange = {}) {
    const month = monthBounds(key);
    if (!month.from) return 0;
    const bounds = {
      from: isISODate(reportRange.from) && reportRange.from > month.from ? reportRange.from : month.from,
      to: isISODate(reportRange.to) && reportRange.to < month.to ? reportRange.to : month.to
    };
    if (bounds.from > bounds.to || !activeDuring(person, bounds)) return 0;
    const workdays = workingDaysInRange(bounds, settings, person);
    const standardDays = workingDaysInRange(month, settings);
    if (!standardDays || !workdays) return 0;
    const salary = Math.max(0, n(person.monthlySalary ?? person.monthly_salary));
    const burden = 1 + Math.max(0, n(settings.employerBurdenRate ?? settings.employer_burden_rate)) / 100;
    return salary * burden * Math.min(1, workdays / standardDays);
  }
  const accountMap = (db) => {
    const cache = cacheFor(db);
    if (cache?.accountMap) return cache.accountMap;
    const map = new Map((db.accounts || []).map((a) => [String(a.code), a]));
    if (cache) cache.accountMap = map;
    return map;
  };

  function isPeriodLocked(db, date) {
    return (db.accountingPeriods || []).some((p) => p.locked && inRange(date, p.from, p.to));
  }

  function journalTotal(entry, side) {
    return vnd(sum(entry.lines || [], (line) => line[side]));
  }
  function documentIdentity(entry = {}, settings = {}) {
    const number = String(entry.documentNo ?? entry.document_no ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const scope = norm(settings.documentNumberScope || 'source-year');
    const book = String(entry.bookCode ?? entry.book_code ?? entry.sourceType ?? entry.source_type ?? 'general').trim().toLowerCase();
    const year = isISODate(entry.date) ? entry.date.slice(0, 4) : '';
    if (scope === 'global') return number;
    if (scope === 'source') return `${book}|${number}`;
    return `${book}|${year}|${number}`;
  }

  function entryValidation(db, entry, existingId = '', context = {}) {
    const errors = [];
    const accounts = accountMap(db);
    const lines = (entry.lines || []).filter((l) => (l.accountCode ?? l.account_code) || n(l.debit) || n(l.credit));
    if (!entry.date) errors.push('Thiếu ngày chứng từ.');
    else if (!isISODate(entry.date)) errors.push('Ngày chứng từ không hợp lệ.');
    if (!String(entry.documentNo ?? entry.document_no ?? '').trim()) errors.push('Thiếu số chứng từ.');
    const identity = documentIdentity(entry, db.settings || {});
    const existing = (db.journalEntries || []).find((x) => x.id === existingId);
    const unchanged = Boolean(existing && norm(existing.status) === norm(entry.status) && stableEntryString(existing) === stableEntryString(entry));
    const duplicateIdentity = identity && context.documentIdentityCounts instanceof Map
      ? n(context.documentIdentityCounts.get(identity)) > (existing ? 1 : 0)
      : identity && (db.journalEntries || []).some((x) => x.id !== existingId && !statusIs(x.status, 'cancelled', 'deleted', 'void') && documentIdentity(x, db.settings || {}) === identity);
    if (duplicateIdentity) errors.push('Số chứng từ đã tồn tại trong cùng sổ và năm tài chính.');
    if (existing && statusIs(existing.status, 'posted') && !unchanged) errors.push('Chứng từ đã ghi sổ là bất biến; phải lập chứng từ điều chỉnh hoặc chứng từ đảo thay vì sửa trực tiếp.');
    if (isPeriodLocked(db, entry.date) && !unchanged) errors.push('Kỳ kế toán đã khóa; không được thêm mới, ghi sổ hoặc sửa chứng từ trong kỳ này.');
    if (lines.length < 2) errors.push('Chứng từ cần ít nhất 2 dòng định khoản.');
    const cashLines = lines.filter((l) => /^11(1|2)/.test(String(l.accountCode ?? l.account_code ?? '')));
    const netCash = vnd(sum(cashLines, (l) => l.debit) - sum(cashLines, (l) => l.credit));
    const fxOnly = lines.filter((l) => !/^11(1|2)/.test(String(l.accountCode ?? l.account_code ?? ''))).some((l) => String(l.accountCode ?? l.account_code ?? '').startsWith('413'));
    if (statusIs(entry.status, 'posted') && netCash !== 0 && !fxOnly) {
      const code=String(entry.cashFlowCode ?? entry.cash_flow_code ?? '').trim();
      if (!code) errors.push('Chứng từ làm thay đổi tiền mặt/ngân hàng đã ghi sổ phải có mã lưu chuyển tiền tệ B03-DNN.');
      else {
        const expected=cashFlowExpectedDirection(code), actual=netCash>0?'inflow':'outflow';
        if (!expected) errors.push(`Mã lưu chuyển tiền tệ ${code} không tồn tại trong danh mục B03-DNN.`);
        else if (expected!=='either' && expected!==actual) errors.push(`Mã lưu chuyển tiền tệ ${cashFlowCodeNormalized(code)} sai chiều: chứng từ là ${actual==='inflow'?'thu':'chi'} tiền nhưng mã yêu cầu ${expected==='inflow'?'thu':'chi'}.`);
      }
    }
    lines.forEach((line, index) => {
      const accountCode = String(line.accountCode ?? line.account_code ?? '');
      const debit = vnd(line.debit), credit = vnd(line.credit), account = accounts.get(accountCode);
      if ((line.debit !== '' && line.debit != null && !isNumeric(line.debit)) || (line.credit !== '' && line.credit != null && !isNumeric(line.credit))) errors.push(`Dòng ${index + 1}: số tiền không hợp lệ.`);
      if (!account) errors.push(`Dòng ${index + 1}: tài khoản không tồn tại.`);
      else if (!account.active || account.postable === false) errors.push(`Dòng ${index + 1}: tài khoản ${account.code} không được phép hạch toán.`);
      if (debit < 0 || credit < 0) errors.push(`Dòng ${index + 1}: số tiền không được âm.`);
      if (debit > 0 && credit > 0) errors.push(`Dòng ${index + 1}: không được đồng thời ghi Nợ và Có.`);
      if (debit === 0 && credit === 0) errors.push(`Dòng ${index + 1}: chưa có số phát sinh.`);
      const rawDebit = Number(line.debit || 0), rawCredit = Number(line.credit || 0);
      if (!Number.isInteger(rawDebit) || !Number.isInteger(rawCredit)) errors.push(`Dòng ${index + 1}: VND phải được ghi bằng số nguyên.`);
      else if (!Number.isSafeInteger(rawDebit) || !Number.isSafeInteger(rawCredit)) errors.push(`Dòng ${index + 1}: số tiền vượt phạm vi số nguyên an toàn của hệ thống.`);
    });
    const rawDebitTotal = sum(lines, (x) => x.debit), rawCreditTotal = sum(lines, (x) => x.credit);
    const debit = vnd(rawDebitTotal), credit = vnd(rawCreditTotal);
    if (!Number.isSafeInteger(rawDebitTotal) || !Number.isSafeInteger(rawCreditTotal)) errors.push('Tổng chứng từ vượt phạm vi số nguyên an toàn của hệ thống.');
    if (debit <= 0) errors.push('Tổng phát sinh phải lớn hơn 0.');
    if (debit !== credit) errors.push(`Chứng từ chưa cân bằng: Nợ ${debit} / Có ${credit}.`);
    if (statusIs(entry.status, 'posted') && entry.postingHash && !verifyPostingHash(entry)) errors.push('Dấu kiểm soát chứng từ không hợp lệ; dữ liệu có thể đã bị thay đổi sau khi ghi sổ.');
    return { valid: errors.length === 0, errors, debit, credit, lines, documentIdentity: identity };
  }

  function stableEntryString(entry) {
    const clean = {
      date: entry.date || '', documentNo: entry.documentNo ?? entry.document_no ?? '', bookCode: entry.bookCode ?? entry.book_code ?? '',
      sourceType: entry.sourceType ?? entry.source_type ?? '', cashFlowCode: entry.cashFlowCode ?? entry.cash_flow_code ?? '', description: entry.description || '',
      projectId: entry.projectId ?? entry.project_id ?? '', partnerType: entry.partnerType ?? entry.partner_type ?? '', partnerId: entry.partnerId ?? entry.partner_id ?? '',
      currency: entry.currency || 'VND', exchangeRate: n(entry.exchangeRate ?? entry.exchange_rate ?? 1),
      lines: (entry.lines || []).map((l) => ({
        accountCode: String(l.accountCode ?? l.account_code ?? ''), debit: vnd(l.debit), credit: vnd(l.credit), description: l.description || '',
        projectId: l.projectId ?? l.project_id ?? '', partnerType: l.partnerType ?? l.partner_type ?? '', partnerId: l.partnerId ?? l.partner_id ?? '',
        contractId: l.contractId ?? l.contract_id ?? '', invoiceId: l.invoiceId ?? l.invoice_id ?? '', costItemId: l.costItemId ?? l.cost_item_id ?? ''
      }))
    };
    return JSON.stringify(clean);
  }
  function legacyChecksum(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }
  const SHA256_K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));
  function sha256(text) {
    const input = String(text ?? '');
    const bytes = typeof TextEncoder === 'function'
      ? new TextEncoder().encode(input)
      : Uint8Array.from(unescape(encodeURIComponent(input)), (c) => c.charCodeAt(0));
    const bitLength = bytes.length * 8;
    const totalLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new Uint8Array(totalLength); data.set(bytes); data[bytes.length] = 0x80;
    const view = new DataView(data.buffer);
    view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(totalLength - 4, bitLength >>> 0, false);
    const hash = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const words = new Uint32Array(64);
    for (let offset = 0; offset < totalLength; offset += 64) {
      for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(words[i - 15], 7) ^ rotr(words[i - 15], 18) ^ (words[i - 15] >>> 3);
        const s1 = rotr(words[i - 2], 17) ^ rotr(words[i - 2], 19) ^ (words[i - 2] >>> 10);
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
      }
      let [a,b,c,d,e,f,g,h] = hash;
      for (let i = 0; i < 64; i += 1) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + SHA256_K[i] + words[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      hash[0]=(hash[0]+a)>>>0;hash[1]=(hash[1]+b)>>>0;hash[2]=(hash[2]+c)>>>0;hash[3]=(hash[3]+d)>>>0;
      hash[4]=(hash[4]+e)>>>0;hash[5]=(hash[5]+f)>>>0;hash[6]=(hash[6]+g)>>>0;hash[7]=(hash[7]+h)>>>0;
    }
    return [...hash].map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  function legacyStableEntryStringV371(entry = {}) {
    return JSON.stringify({
      date: entry.date || '', documentNo: entry.documentNo || '', sourceType: entry.sourceType || '', cashFlowCode: entry.cashFlowCode || '',
      description: entry.description || '', projectId: entry.projectId || '', partnerType: entry.partnerType || '', partnerId: entry.partnerId || '',
      lines: (entry.lines || []).map((l) => ({ accountCode: String(l.accountCode || ''), debit: vnd(l.debit), credit: vnd(l.credit), description: l.description || '' }))
    });
  }
  const legacyPostingHash = (entry) => legacyChecksum(legacyStableEntryStringV371(entry));
  const postingHash = (entry) => sha256(stableEntryString(entry));
  const upgradePostingHash = (entry = {}) => {
    const value=String(entry.postingHash||'').toLowerCase();
    if(/^[a-f0-9]{64}$/.test(value)&&value===postingHash(entry))return {...entry,postingHash:value,postingHashVersion:'sha256-v380',allowLegacyHash:false};
    if(/^[a-f0-9]{8}$/.test(value)&&value===legacyPostingHash(entry))return {...entry,postingHash:postingHash(entry),postingHashVersion:'sha256-v380',legacyPostingHash:value,allowLegacyHash:false};
    return {...entry};
  };
  const verifyPostingHash = (entry) => {
    if (!statusIs(entry?.status, 'posted')) return true;
    const value = String(entry.postingHash || '').toLowerCase();
    if (/^[a-f0-9]{64}$/.test(value)) return value === postingHash(entry);
    return Boolean(entry.allowLegacyHash === true && /^[a-f0-9]{8}$/.test(value) && value === legacyPostingHash(entry));
  };

  function postedEntries(db, range = {}) {
    const cache = cacheFor(db);
    let all = cache?.postedEntries;
    if (!all) {
      all = (db.journalEntries || []).filter((x) => statusIs(x.status, 'posted'));
      if (cache) cache.postedEntries = all;
    }
    if (!range.from && !range.to) return all.slice();
    return all.filter((x) => inRange(x.date, range.from, range.to));
  }
  function postedLines(db, range = {}) {
    const cache = cacheFor(db);
    let all = cache?.postedLines;
    if (!all) {
      all = postedEntries(db).flatMap((entry) => (entry.lines || []).map((line) => ({
        ...line, accountCode: String(line.accountCode ?? line.account_code ?? ''), debit: vnd(line.debit), credit: vnd(line.credit), entryId: entry.id, date: entry.date,
        documentNo: entry.documentNo ?? entry.document_no ?? '', entryDescription: entry.description,
        projectId: line.projectId ?? line.project_id ?? entry.projectId ?? entry.project_id ?? '',
        partnerType: line.partnerType ?? line.partner_type ?? entry.partnerType ?? entry.partner_type ?? '',
        partnerId: line.partnerId ?? line.partner_id ?? entry.partnerId ?? entry.partner_id ?? ''
      })));
      if (cache) cache.postedLines = all;
    }
    if (!range.from && !range.to) return all.slice();
    return all.filter((x) => inRange(x.date, range.from, range.to));
  }
  function accountMovement(db, code, range = {}) {
    return postedLines(db, range).filter((x) => String(x.accountCode) === String(code)).reduce((r, x) => ({ debit: r.debit + vnd(x.debit), credit: r.credit + vnd(x.credit) }), { debit: 0, credit: 0 });
  }
  function openingMovement(db, code, beforeDate = '', balanceDate = '') {
    // Opening balances may be effective from a specific date. A future opening
    // balance must never leak into a historical balance-sheet or ratio period.
    const cutoff = isISODate(beforeDate) ? beforeDate : (isISODate(balanceDate) ? balanceDate : '');
    const base = (db.openingBalances || [])
      .filter((x) => String(x.accountCode ?? x.account_code ?? '') === String(code))
      .filter((x) => {
        const effective = x.asOfDate ?? x.as_of_date ?? x.date ?? '';
        return !isISODate(effective) || !cutoff || effective <= cutoff;
      })
      .reduce((r, x) => ({ debit: r.debit + vnd(x.debit), credit: r.credit + vnd(x.credit) }), { debit: 0, credit: 0 });
    if (isISODate(beforeDate)) {
      const priorTo = previousDate(beforeDate);
      const prior = postedLines(db, { to: priorTo }).filter((x) => String(x.accountCode) === String(code)).reduce((r, x) => ({ debit: r.debit + vnd(x.debit), credit: r.credit + vnd(x.credit) }), { debit: 0, credit: 0 });
      base.debit += prior.debit; base.credit += prior.credit;
    }
    return base;
  }
  function accountEnding(db, code, range = {}) {
    const opening = openingMovement(db, code, range.from || '', range.to || ''), movement = accountMovement(db, code, range);
    const net = opening.debit - opening.credit + movement.debit - movement.credit;
    return { openingDebit: Math.max(0, opening.debit - opening.credit), openingCredit: Math.max(0, opening.credit - opening.debit), debit: movement.debit, credit: movement.credit, endingDebit: Math.max(0, net), endingCredit: Math.max(0, -net) };
  }
  function trialBalance(db, range = {}) {
    const rows = (db.accounts || []).map((a) => ({ ...a, ...accountEnding(db, a.code, range) })).filter((x) => x.openingDebit || x.openingCredit || x.debit || x.credit || x.endingDebit || x.endingCredit);
    const totals = ['openingDebit', 'openingCredit', 'debit', 'credit', 'endingDebit', 'endingCredit'].reduce((o, key) => ({ ...o, [key]: vnd(sum(rows, (x) => x[key])) }), {});
    return { rows, totals, balanced: totals.debit === totals.credit && totals.endingDebit === totals.endingCredit };
  }
  function accountTypeMovement(db, type, range = {}, excludePrefixes = []) {
    const accounts = accountMap(db);
    return postedLines(db, range).reduce((total, line) => {
      const a = accounts.get(String(line.accountCode));
      if (!a || a.type !== type || excludePrefixes.some((p) => String(a.code).startsWith(p))) return total;
      return total + ((type === 'Revenue' || type === 'Liability' || type === 'Equity') ? vnd(line.credit) - vnd(line.debit) : vnd(line.debit) - vnd(line.credit));
    }, 0);
  }
  function profitAndLoss(db, range = {}) {
    const revenue = vnd(accountTypeMovement(db, 'Revenue', range));
    const expenseBeforeTax = vnd(accountTypeMovement(db, 'Expense', range, ['821']));
    const incomeTaxExpense = vnd((db.accounts || []).filter((a) => String(a.code).startsWith('821')).reduce((s, a) => { const m = accountMovement(db, a.code, range); return s + m.debit - m.credit; }, 0));
    const profitBeforeTax = revenue - expenseBeforeTax;
    const profitAfterTax = profitBeforeTax - incomeTaxExpense;
    return { revenue, expenseBeforeTax, incomeTaxExpense, profitBeforeTax, profitAfterTax, marginBeforeTax: revenue ? profitBeforeTax / revenue * 100 : 0 };
  }
  function accountBalance(db, code, range = {}) { return accountEnding(db, code, range); }
  function partnerBalances(db, accountCode, partnerType, range = {}) {
    const map = new Map();
    const touch = (partnerId) => {
      const key = String(partnerId || '');
      if (!key) return null;
      const row = map.get(key) || { partnerId: key, debit: 0, credit: 0 };
      map.set(key, row); return row;
    };
    (db.openingPartnerBalances || db.partnerOpeningBalances || db.openingBalances || []).filter((x) => String(x.accountCode ?? x.account_code) === String(accountCode) && (x.partnerType ?? x.partner_type) === partnerType && (x.partnerId ?? x.partner_id)).forEach((x) => {
      const row = touch(x.partnerId ?? x.partner_id); if (!row) return;
      row.debit += vnd(x.debit); row.credit += vnd(x.credit);
    });
    postedLines(db, { to: isISODate(range.to) ? range.to : localISODate() }).filter((x) => String(x.accountCode) === String(accountCode) && x.partnerType === partnerType && x.partnerId).forEach((x) => {
      const row = touch(x.partnerId); if (!row) return;
      row.debit += vnd(x.debit); row.credit += vnd(x.credit);
    });
    const normal = accountMap(db).get(String(accountCode))?.normalSide || (String(accountCode).startsWith('131') ? 'Debit' : 'Credit');
    return [...map.values()].map((x) => {
      const signed = vnd(x.debit - x.credit);
      const debitBalance = Math.max(0, signed), creditBalance = Math.max(0, -signed);
      return { ...x, debitBalance, creditBalance, balance: normal === 'Credit' ? creditBalance : debitBalance };
    }).filter((x) => x.balance > 0).sort((a,b) => b.balance - a.balance);
  }

  function costPerHour(person, settings = {}) {
    if (!person) return 0;
    if (statusIs(person.type, 'CTV')) return Math.max(0, n(person.hourlyRate ?? person.hourly_rate));
    const hours = Math.max(1, n(settings.monthlyWorkingHours ?? settings.monthly_working_hours) || 176);
    const burden = Math.max(0, n(settings.employerBurdenRate ?? settings.employer_burden_rate));
    return Math.max(0, n(person.monthlySalary ?? person.monthly_salary)) * (1 + burden / 100) / hours;
  }
  function approvedTimesheets(db, filter = {}) {
    const cache = cacheFor(db);
    let all = cache?.approvedTimesheets;
    if (!all) {
      all = (db.timesheets || []).filter((x) => x.approved === true || statusIs(x.status, 'approved', 'posted'));
      if (cache) {
        cache.approvedTimesheets = all;
        cache.approvedTimesheetsByProject = new Map();
        cache.approvedTimesheetsByPerson = new Map();
        all.forEach((x) => {
          const projectId = x.projectId ?? x.project_id;
          const personId = x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id;
          if (projectId !== undefined && projectId !== null) {
            const key = String(projectId), rows = cache.approvedTimesheetsByProject.get(key) || [];
            rows.push(x); cache.approvedTimesheetsByProject.set(key, rows);
          }
          if (personId !== undefined && personId !== null) {
            const key = String(personId), rows = cache.approvedTimesheetsByPerson.get(key) || [];
            rows.push(x); cache.approvedTimesheetsByPerson.set(key, rows);
          }
        });
      }
    }
    let rows = all;
    const hasProjectFilter = hasId(filter.projectId), hasPersonFilter = hasId(filter.personId);
    if (hasProjectFilter && cache?.approvedTimesheetsByProject) rows = cache.approvedTimesheetsByProject.get(String(filter.projectId)) || [];
    if (hasPersonFilter) {
      const byPerson = cache?.approvedTimesheetsByPerson?.get(String(filter.personId));
      rows = byPerson || rows.filter((x) => sameId(x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id, filter.personId));
    }
    return rows.filter((x) => (!hasProjectFilter || sameId(x.projectId ?? x.project_id, filter.projectId)) && (!hasPersonFilter || sameId(x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id, filter.personId)) && inRange(x.date, filter.from, filter.to));
  }
  function laborCost(db, filter = {}) {
    const people = new Map((db.people || []).map((p) => [idKey(p.id), p]));
    return vnd(sum(approvedTimesheets(db, filter), (x) => {
      const personId = x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id;
      return n(x.hours) * costPerHour(people.get(idKey(personId)), db.settings || {});
    }));
  }
  function classifyCostNature(row) {
    const explicit = String(row.costNature ?? row.cost_nature ?? '').trim();
    if (explicit) {
      const normalized = explicit.toLowerCase().replace(/[\s_-]+/g, '');
      if (normalized === 'directnonlabor' || normalized === 'direct') return 'DirectNonLabor';
      if (normalized === 'laboralreadycosted' || normalized === 'labor') return 'LaborAlreadyCosted';
      if (normalized === 'overhead') return 'Overhead';
      return explicit;
    }
    const cat = String(row.category || '').toLowerCase();
    if (/ctv|lương|nhân công|payroll|tiền công/.test(cat)) return 'LaborAlreadyCosted';
    if (/văn phòng|quản lý|overhead|thuế|phí ngân hàng/.test(cat)) return 'Overhead';
    return 'DirectNonLabor';
  }
  function projectDirectExpenses(db, projectId, range = {}) {
    const cache = cacheFor(db);
    let byProject = cache?.directExpensesByProject;
    if (!byProject) {
      byProject = new Map();
      (db.finance || []).forEach((x) => {
        if (!statusIs(x.type, 'Expense') || !financePaid(x) || isInternalTransfer(x) || classifyCostNature(x) !== 'DirectNonLabor') return;
        const key = String(x.projectId ?? x.project_id ?? '');
        const rows = byProject.get(key) || []; rows.push(x); byProject.set(key, rows);
      });
      if (cache) cache.directExpensesByProject = byProject;
    }
    const rows = byProject.get(String(projectId)) || [];
    return vnd(sum(rows.filter((x) => inRange(x.date, range.from, range.to)), (x) => x.amount));
  }
  function projectCost(db, projectId, range = {}) {
    const labor = laborCost(db, { ...range, projectId });
    const directNonLabor = projectDirectExpenses(db, projectId, range);
    return { labor, directNonLabor, total: labor + directNonLabor };
  }


  function projectCumulativeRange(range = {}) {
    return { to: isISODate(range.to) ? range.to : localISODate() };
  }
  function projectPostedCost(db, projectId, range = {}) {
    const accounts = accountMap(db);
    const entries = new Map((db.journalEntries || []).map((entry) => [entry.id, entry]));
    const lines = postedLines(db, projectCumulativeRange(range)).filter((x) => sameId(x.projectId, projectId));
    const directCostLine = (line) => {
      const code = String(line.accountCode || '');
      const account = accounts.get(code);
      const explicitNature = norm(line.costNature ?? line.cost_nature);
      if (explicitNature === 'overhead' || explicitNature === 'non-project') return false;
      if (explicitNature === 'directnonlabor' || explicitNature === 'laboralreadycosted' || explicitNature === 'direct') return true;
      if (/^(154|621|622|623|627|632)/.test(code)) return true;
      const entry = entries.get(line.entryId) || {};
      const text = `${entry.sourceType || ''} ${entry.description || ''} ${line.description || ''}`.toLowerCase();
      const directEvidence = /timesheet|payroll|lương|nhân công|tiền công|ctv|cộng tác viên|in ấn|printing|plot|render|mô hình|khảo sát|survey|công tác phí dự án|project travel|thuê ngoài dự án|subconsultant/.test(text);
      const overheadEvidence = /văn phòng|office rent|tiền thuê văn phòng|điện nước văn phòng|quản lý chung|general admin|overhead|phí ngân hàng|bank fee|thuế|tax/.test(text);
      // 642 is overhead by default. It is admitted only when a project-tagged line carries strong direct-cost evidence
      // and no conflicting overhead evidence. This preserves legacy ledgers without letting generic project tags pollute EAC.
      if (code.startsWith('642')) return directEvidence && !overheadEvidence;
      // Selling, finance, other and tax expenses are never direct project cost without an explicit cost-nature override.
      if (/^(635|811|821)/.test(code)) return false;
      return account?.type === 'Expense' && Boolean(line.includeInProjectCost ?? line.include_in_project_cost);
    };
    const included = lines.filter(directCostLine);
    const total = vnd(sum(included, (x) => vnd(x.debit) - vnd(x.credit)));
    const laborTagged = vnd(sum(included.filter((x) => {
      const entry = entries.get(x.entryId) || {};
      const code = String(x.accountCode || '');
      const explicitNature = norm(x.costNature ?? x.cost_nature);
      const text = `${entry.sourceType || ''} ${entry.description || ''} ${x.description || ''}`.toLowerCase();
      return explicitNature === 'laboralreadycosted' || code.startsWith('622') || /timesheet|payroll|lương|nhân công|tiền công|ctv|cộng tác viên/.test(text);
    }), (x) => vnd(x.debit) - vnd(x.credit)));
    const wip = vnd(sum(lines.filter((x) => String(x.accountCode || '').startsWith('154')), (x) => vnd(x.debit) - vnd(x.credit)));
    return { total: Math.max(0, total), laborTagged: Math.max(0, laborTagged), wip: Math.max(0, wip), lineCount: included.length };
  }

  function projectActualCost(db, projectId, range = {}) {
    const posted = projectPostedCost(db, projectId, range);
    const timesheet = laborCost(db, { ...projectCumulativeRange(range), projectId });
    const unpostedLabor = Math.max(0, timesheet - posted.laborTagged);
    const likelyLinkedToLedger = (financeRow) => {
      const explicitEntryId = financeRow.journalEntryId ?? financeRow.journal_entry_id ?? financeRow.postingId ?? financeRow.posting_id;
      // A link suppresses management cash from project actuals only when its
      // Posted journal has the exact date, project and net 111/112 movement.
      if (explicitEntryId) {
        const entry = (db.journalEntries || []).find((candidate) => String(rowId(candidate)) === String(explicitEntryId));
        return financeJournalMatch(db, financeRow, entry);
      }
      // For legacy imports without a link, only an exact accounting candidate
      // can prevent double counting. Text/date-window heuristics are deliberately
      // excluded because they can hide an unrelated payment.
      return financeJournalCandidates(db, financeRow).length > 0;
    };
    const unpostedFinanceRows = (db.finance || []).filter((x) => {
      if (!sameId(x.projectId ?? x.project_id, projectId) || !statusIs(x.type, 'Expense') || !financePaid(x) || isInternalTransfer(x)) return false;
      if (!inRange(x.date, '', projectCumulativeRange(range).to)) return false;
      if (classifyCostNature(x) !== 'DirectNonLabor') return false;
      return !likelyLinkedToLedger(x);
    });
    const unpostedDirectFinanceCost = vnd(sum(unpostedFinanceRows, (x) => x.amount));
    return {
      postedCost: posted.total,
      postedLaborCost: posted.laborTagged,
      timesheetLaborCost: timesheet,
      unpostedLaborCost: vnd(unpostedLabor),
      unpostedDirectFinanceCost,
      unpostedDirectFinanceCount: unpostedFinanceRows.length,
      actualCost: vnd(posted.total + unpostedLabor + unpostedDirectFinanceCost),
      wipLedger: posted.wip
    };
  }

  function projectContracts(db, projectId) {
    return (db.contracts || []).filter((x) => sameId(x.projectId ?? x.project_id, projectId) && !EXCLUDED_CONTRACT_STATUSES.has(norm(x.status)));
  }

  function projectCommercialValue(db, project = {}) {
    const allCustomerContracts = (db.contracts || []).filter((x) => sameId(x.projectId ?? x.project_id, project.id) && statusIs(x.contractType ?? x.contract_type ?? 'customer', 'customer'));
    const committedContracts = allCustomerContracts.filter(contractIsCommitted);
    const committedFromContracts = vnd(sum(committedContracts, (x) => x.valueExclVat ?? x.value_excl_vat ?? x.contractValue ?? x.contract_value));
    const masterValue = Math.max(0, vnd(project.contractValue ?? project.contract_value));
    const lifecycle = projectLifecycle(project);
    const fallbackCommitted = lifecycle !== 'pipeline' && lifecycle !== 'excluded' ? masterValue : 0;
    const committedValue = committedFromContracts > 0 ? committedFromContracts : fallbackCommitted;
    const pipelineValue = lifecycle === 'pipeline' && committedFromContracts <= 0 ? masterValue : 0;
    return {
      committedValue,
      pipelineValue,
      lifecycle,
      source: committedFromContracts > 0 ? 'committed-contracts' : fallbackCommitted > 0 ? 'project-master-fallback' : lifecycle === 'pipeline' ? 'pipeline-project-master' : 'none',
      committedContractCount: committedContracts.length,
      draftContractCount: allCustomerContracts.filter((x) => !contractIsCommitted(x)).length
    };
  }
  function projectContractValue(db, project = {}) {
    return projectCommercialValue(db, project).committedValue;
  }

  function invoiceAllocatedAmount(db, invoice = {}, options = {}) {
    const asOf = isISODate(options.asOf ?? options.to) ? (options.asOf ?? options.to) : '';
    const state = options.allocationState || buildAllocationState(db), invoiceId = String(rowId(invoice));
    const linkedRows = state.allByInvoice.get(invoiceId) || [];
    const recognized = linkedRows.filter((x) => state.accepted.has(x) && (!asOf || allocationDate(x) <= asOf));
    // Once an invoice has allocation rows, that sub-ledger becomes the source of
    // truth. Invalid, Draft or future rows are excluded and can never fall back
    // to a looser paymentStatus flag.
    if (linkedRows.length) return vnd(sum(recognized, allocationAmount));
    const paidDate = invoice.paidDate ?? invoice.paid_date ?? invoice.paymentDate ?? invoice.payment_date ?? '';
    const total = invoiceTotal(invoice);
    // Báo cáo lịch sử chỉ ghi nhận trạng thái Paid khi có ngày thanh toán hợp lệ không vượt ngày chốt.
    if (asOf) {
      if (!isISODate(paidDate) || paidDate > asOf) return 0;
      if (statusIs(invoice.paymentStatus ?? invoice.payment_status, 'paid')) return total;
    } else if (statusIs(invoice.paymentStatus ?? invoice.payment_status, 'paid')) return total;
    return Math.min(total, Math.max(0, vnd(invoice.paidAmount ?? invoice.paid_amount)));
  }
  function invoiceAging(db, options = {}) {
    const requestedAsOf = options.asOf || options.to || localISODate();
    const asOf = isISODate(requestedAsOf) ? requestedAsOf : localISODate();
    const direction = options.direction || 'Output';
    const projectId = options.projectId ?? '', hasProjectFilter = hasId(projectId), allocationState = buildAllocationState(db);
    const rows = (db.taxInvoices || []).filter((x) => activeInvoice(x) && statusIs(x.direction, direction) && (!hasProjectFilter || sameId(x.projectId ?? x.project_id, projectId)) && inRange(x.date, options.from, options.to)).map((x) => {
      const original = invoiceTotal(x);
      const allocated = Math.min(original, invoiceAllocatedAmount(db, x, { asOf, allocationState }));
      const outstanding = Math.max(0, original - allocated);
      const invoiceDate = isISODate(x.date) ? x.date : (isISODate(asOf) ? asOf : localISODate());
      const rawDueDate = x.dueDate ?? x.due_date;
      const dueDate = isISODate(rawDueDate) ? rawDueDate : localISODate(new Date(`${invoiceDate}T12:00:00`).getTime() + 30 * 86400000);
      const daysOverdue = outstanding > 0 && dueDate < asOf ? Math.max(0, Math.floor((new Date(`${asOf}T12:00:00`) - new Date(`${dueDate}T12:00:00`)) / 86400000)) : 0;
      const bucket = outstanding <= 0 ? 'Paid' : daysOverdue <= 0 ? 'Current' : daysOverdue <= 30 ? '1-30' : daysOverdue <= 60 ? '31-60' : daysOverdue <= 90 ? '61-90' : '90+';
      return { ...x, original, allocated, outstanding, dueDate, daysOverdue, bucket };
    });
    const totals = rows.reduce((o, x) => {
      o.original += x.original; o.allocated += x.allocated; o.outstanding += x.outstanding;
      o.buckets[x.bucket] = (o.buckets[x.bucket] || 0) + x.outstanding;
      return o;
    }, { original: 0, allocated: 0, outstanding: 0, buckets: { Current:0,'1-30':0,'31-60':0,'61-90':0,'90+':0,Paid:0 } });
    Object.keys(totals).filter((k) => k !== 'buckets').forEach((k) => { totals[k] = vnd(totals[k]); });
    Object.keys(totals.buckets).forEach((k) => { totals.buckets[k] = vnd(totals.buckets[k]); });
    return { rows, totals };
  }
  function projectCommercials(db, projectId, range = {}) {
    const cumulative = projectCumulativeRange(range), allocationState = buildAllocationState(db);
    const outputInvoices = (db.taxInvoices || []).filter((x) => activeInvoice(x) && statusIs(x.direction, 'Output') && sameId(x.projectId ?? x.project_id, projectId) && inRange(x.date, '', cumulative.to));
    const invoicedNet = vnd(sum(outputInvoices, invoiceBase));
    const invoicedGross = vnd(sum(outputInvoices, invoiceTotal));
    const allocatedGross = vnd(sum(outputInvoices, (x) => Math.min(invoiceTotal(x), invoiceAllocatedAmount(db, x, { asOf: cumulative.to, allocationState }))));
    const allocatedNet = vnd(sum(outputInvoices, (x) => {
      const gross = invoiceTotal(x), net = invoiceBase(x), receipt = Math.min(gross, invoiceAllocatedAmount(db, x, { asOf: cumulative.to, allocationState }));
      return gross > 0 ? Math.min(net, receipt * net / gross) : 0;
    }));
    const projectReceiptRows = (db.finance || []).filter((x) => sameId(x.projectId ?? x.project_id, projectId) && statusIs(x.type, 'Income') && financePaid(x) && !isInternalTransfer(x) && inRange(x.date, '', cumulative.to));
    const projectCashReceipts = vnd(sum(projectReceiptRows, (x) => x.amount));
    const invoiceIds = new Set(outputInvoices.map((x) => String(rowId(x))));
    const recognizedAllocations = (db.paymentAllocations || []).filter((x) => invoiceIds.has(allocationInvoiceId(x)) && allocationState.accepted.has(x) && (!cumulative.to || allocationDate(x) <= cumulative.to));
    // Allocate legacy rows (without paymentId) against same-day Paid receipts
    // before treating them as extra cash evidence. This avoids both the old
    // Math.max undercount and double-counting a normal same-day receipt.
    const remainingReceipt = new Map(projectReceiptRows.map((x) => [String(rowId(x)), Math.max(0, vnd(x.amount))]));
    let appliedAgainstFinanceGross = 0;
    let unmatchedLegacyAllocationGross = 0;
    recognizedAllocations.forEach((allocation) => {
      const amount = allocationAmount(allocation);
      const paymentId = allocation.paymentId ?? allocation.payment_id;
      if (paymentId) {
        const available = remainingReceipt.get(String(paymentId)) || 0;
        const matched = Math.min(available, amount);
        remainingReceipt.set(String(paymentId), Math.max(0, available - matched));
        appliedAgainstFinanceGross += matched;
        return;
      }
      const sameDay = projectReceiptRows.filter((receipt) => receipt.date === allocationDate(allocation) && (remainingReceipt.get(String(rowId(receipt))) || 0) > 0);
      let pending = amount;
      sameDay.forEach((receipt) => {
        if (pending <= 0) return;
        const key = String(rowId(receipt)), available = remainingReceipt.get(key) || 0, matched = Math.min(available, pending);
        remainingReceipt.set(key, available - matched);
        pending -= matched;
        appliedAgainstFinanceGross += matched;
      });
      unmatchedLegacyAllocationGross += pending;
    });
    // Commercial collection remains invoice-applied cash. Actual project cash
    // also includes Paid receipts and unmatched legacy allocation evidence.
    const cashReceivedGross = vnd(projectCashReceipts + unmatchedLegacyAllocationGross);
    // Net-of-VAT cash is only verifiable for allocated invoice receipts; unapplied cash remains gross until classified.
    const cashReceivedNet = allocatedNet;
    const collectedGross = allocatedGross;
    const collectedNet = allocatedNet;
    const collectionSource = 'invoice-allocations';
    const aging = invoiceAging(db, { direction: 'Output', projectId, to: cumulative.to, asOf: cumulative.to });
    const receivableNet = Math.max(0, vnd(invoicedNet - allocatedNet));
    const cashPaid = vnd(sum((db.finance || []).filter((x) => sameId(x.projectId ?? x.project_id, projectId) && statusIs(x.type, 'Expense') && financePaid(x) && !isInternalTransfer(x) && inRange(x.date, '', cumulative.to)), (x) => x.amount));
    return {
      invoicedNet, invoicedGross, allocatedNet, allocatedGross,
      collectedNet, collectedGross, cashReceivedNet, cashReceivedGross, collectionSource,
      receivableNet, receivableGross: aging.totals.outstanding, aging, cashPaid,
      unmatchedLegacyAllocationGross: vnd(unmatchedLegacyAllocationGross),
      unappliedCashGross: Math.max(0, vnd(projectCashReceipts - appliedAgainstFinanceGross)),
      netProjectCash: vnd(cashReceivedGross - cashPaid)
    };
  }

  function approvedBudget(db, projectId, options = {}) {
    const cutoff = isISODate(options.asOf ?? options.to) ? (options.asOf ?? options.to) : localISODate();
    const approvedAll = (db.projectBudgetVersions || []).filter((x) => sameId(x.projectId ?? x.project_id, projectId) && statusIs(x.status, 'approved'));
    const eligible = approvedAll.filter((x) => {
      const effective = x.effectiveFrom ?? x.effective_from ?? '';
      return !isISODate(effective) || effective <= cutoff;
    }).sort((a,b) => {
      const ae = a.effectiveFrom ?? a.effective_from ?? '', be = b.effectiveFrom ?? b.effective_from ?? '';
      return String(be).localeCompare(String(ae)) || n(b.versionNo ?? b.version_no) - n(a.versionNo ?? a.version_no);
    });
    const version = eligible[0] || null;
    if (!version) return { version: null, lines: [], directBudget: 0, contingency: 0, lineTotal: 0, duplicateApprovedCount: approvedAll.length, mismatch: false, source: 'none' };
    const lines = (db.projectBudgetLines || []).filter((x) => (x.budgetVersionId ?? x.budget_version_id) === version.id);
    const lineTotal = vnd(sum(lines, (x) => x.amount ?? n(x.quantity) * n(x.unitRate ?? x.unit_rate)));
    const headerBudget = Math.max(0, vnd(version.directBudget ?? version.direct_budget));
    const directBudget = headerBudget > 0 ? headerBudget : lineTotal;
    return {
      version, lines, directBudget, contingency: Math.max(0, vnd(version.contingency)), lineTotal,
      duplicateApprovedCount: approvedAll.length,
      mismatch: Boolean(lines.length && Math.abs(lineTotal - directBudget) > 1),
      source: headerBudget > 0 ? 'approved-budget-header' : lineTotal > 0 ? 'approved-budget-lines' : 'approved-budget-zero'
    };
  }

  function projectStageProgress(db, project = {}, asOfDate = localISODate()) {
    const progressMode = norm(project.progressMode ?? project.progress_mode);
    const manualProgress = ['manual','project-master','quick-input','quick'].includes(progressMode) || project.manualProgressOverride === true || project.manual_progress_override === true;
    if (manualProgress) return { progress: clamp(project.progress), scheduleProgress: projectScheduleProgress(project, asOfDate), source: 'project-master-manual', weightTotal: 0, confidence: 'Medium', warnings: [] };
    const rows = (db.projectStages || []).filter((x) => sameId(x.projectId ?? x.project_id, project.id) && !statusIs(x.status, 'cancelled', 'canceled', 'deleted'));
    if (!rows.length) return { progress: clamp(project.progress), scheduleProgress: projectScheduleProgress(project, asOfDate), source: 'project-master', weightTotal: 0, confidence: 'Low', warnings: ['Chưa có giai đoạn chi tiết để kiểm chứng tiến độ.'] };
    const weightOf = (x) => Math.max(0, n(x.weightPercent ?? x.weight_percent ?? x.budgetWeight ?? x.budget_weight ?? x.budgetCost ?? x.budget_cost ?? x.budgetHours ?? x.budget_hours));
    const stageProgress = (x) => {
      const raw = x.progress ?? x.progressPercent ?? x.progress_percent;
      if (isNumeric(raw)) return clamp(raw);
      if (statusIs(x.status, 'completed', 'done', 'approved')) return 100;
      return 0;
    };
    const weights = rows.map(weightOf), totalWeight = sum(weights);
    if (totalWeight <= 0) return { progress: clamp(project.progress), scheduleProgress: projectScheduleProgress(project, asOfDate), source: 'project-master', weightTotal: 0, confidence: 'Low', warnings: ['Tổng trọng số giai đoạn bằng 0.'] };
    const progress = clamp(rows.reduce((total, x, i) => total + weights[i] * stageProgress(x), 0) / totalWeight);
    const scheduleProgress = clamp(rows.reduce((total, x, i) => total + weights[i] * projectScheduleProgress({ startDate: x.plannedStart ?? x.planned_start, endDate: x.plannedEnd ?? x.planned_end }, asOfDate), 0) / totalWeight);
    const warnings = [];
    if (Math.abs(totalWeight - 100) > 0.5) warnings.push(`Tổng trọng số giai đoạn là ${Math.round(totalWeight * 100) / 100}%, hệ thống đã chuẩn hóa về 100%.`);
    const invalidDates = rows.filter((x) => !isISODate(x.plannedStart ?? x.planned_start) || !isISODate(x.plannedEnd ?? x.planned_end)).length;
    if (invalidDates) warnings.push(`${invalidDates} giai đoạn thiếu ngày kế hoạch hợp lệ.`);
    const confidence = warnings.length ? 'Medium' : 'High';
    return { progress, scheduleProgress, source: 'weighted-stages', weightTotal: totalWeight, confidence, warnings };
  }

  function remainingResourcePlanCost(db, projectId, range = {}) {
    const cutoff = isISODate(range.to) ? range.to : localISODate();
    const cutoffMonth = monthOf(cutoff);
    const people = new Map((db.people || []).map((x) => [x.id, x]));
    const rows = (db.resourcePlans || []).filter((x) => sameId(x.projectId ?? x.project_id, projectId) && statusIs(x.status || 'Approved', 'approved', 'active'));
    const details = rows.map((x) => {
      const personId = x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id;
      const key = x.month || monthOf(x.planMonth ?? x.plan_month ?? x.startDate ?? x.date ?? cutoff);
      const plan = Math.max(0, n(x.plannedHours ?? x.planned_hours));
      const actual = sum(approvedTimesheets(db, { projectId, personId, from: `${key}-01`, to: cutoff }).filter((t) => monthOf(t.date) === key), (t) => t.hours);
      const rate = Math.max(0, n(x.costRate ?? x.cost_rate) || costPerHour(people.get(personId), db.settings || {}));
      return { ...x, personId, month: key, plannedHours: plan, actualHours: actual, costRate: rate, plannedCost: vnd(plan * rate), remainingHours: 0, remainingCost: 0 };
    });
    const groups = new Map();
    details.forEach((x) => { const g=groups.get(x.personId)||[]; g.push(x); groups.set(x.personId,g); });
    let plannedHours = 0, plannedCost = 0, remainingHours = 0, remainingCost = 0, slippedHours = 0, futureHours = 0;
    groups.forEach((personRows, personId) => {
      personRows.sort((a,b)=>a.month.localeCompare(b.month));
      const pastAndCurrent=personRows.filter((x)=>x.month<=cutoffMonth), future=personRows.filter((x)=>x.month>cutoffMonth);
      const earliest=pastAndCurrent[0]?.month;
      const plannedToDate=sum(pastAndCurrent,(x)=>x.plannedHours);
      const actualToDate=earliest ? sum(approvedTimesheets(db,{projectId,personId,from:`${earliest}-01`,to:cutoff}),(t)=>t.hours) : 0;
      const slipped=Math.max(0,plannedToDate-actualToDate);
      const rateWeight=sum(pastAndCurrent,(x)=>x.plannedHours);
      const avgRate=rateWeight>0 ? sum(pastAndCurrent,(x)=>x.plannedHours*x.costRate)/rateWeight : costPerHour(people.get(personId),db.settings||{});
      if(pastAndCurrent.length){
        const target=pastAndCurrent[pastAndCurrent.length-1];
        target.remainingHours=Math.round(slipped*100)/100;
        target.remainingCost=vnd(slipped*avgRate);
      }
      slippedHours+=slipped; remainingHours+=slipped; remainingCost+=slipped*avgRate;
      future.forEach((x)=>{x.remainingHours=x.plannedHours;x.remainingCost=vnd(x.plannedHours*x.costRate);futureHours+=x.plannedHours;remainingHours+=x.plannedHours;remainingCost+=x.remainingCost;});
      plannedHours+=sum(personRows,(x)=>x.plannedHours);
      plannedCost+=sum(personRows,(x)=>x.plannedCost);
    });
    return { rows: details, planCount: rows.length, plannedHours, plannedCost:vnd(plannedCost), remainingHours, remainingCost: vnd(remainingCost), slippedHours, futureHours };
  }

  function projectCommitments(db, projectId, range = {}) {
    const cutoff = isISODate(range.to) ? range.to : localISODate();
    const rows = (db.commitments || []).filter((x) => sameId(x.projectId ?? x.project_id, projectId) && commitmentIsIncluded(x));
    const details = rows.map((x) => {
      const amount = Math.max(0, vnd(x.amount));
      const recognized = Math.min(amount, Math.max(0, vnd(x.recognizedAmount ?? x.recognized_amount)));
      const outstanding = Math.max(0, amount - recognized);
      return { ...x, amount, recognized, outstanding, due: Boolean(isISODate(x.dueDate ?? x.due_date) && (x.dueDate ?? x.due_date) <= cutoff) };
    });
    return { rows: details, total: vnd(sum(details, (x) => x.amount)), recognized: vnd(sum(details, (x) => x.recognized)), outstanding: vnd(sum(details, (x) => x.outstanding)) };
  }

  function cashFlow(db, range = {}) {
    const paid = (db.finance || []).filter((x) => financePaid(x) && inRange(x.date, range.from, range.to));
    const transfers = paid.filter(isInternalTransfer);
    const operating = paid.filter((x) => !isInternalTransfer(x));
    const cashIn = vnd(sum(operating.filter((x) => statusIs(x.type, 'Income')), (x) => x.amount));
    const cashOut = vnd(sum(operating.filter((x) => statusIs(x.type, 'Expense')), (x) => x.amount));
    const result = { cashIn, cashOut, net: cashIn - cashOut };
    const internalTransfers = vnd(sum(transfers, (x) => Math.abs(vnd(x.amount))));
    if (internalTransfers) result.internalTransfers = internalTransfers;
    return result;
  }
  function ledgerCashFlow(db, range = {}) {
    let inflow=0,outflow=0;
    postedEntries(db,range).forEach((entry)=>{
      const cash=(entry.lines||[]).filter((x)=>/^11(1|2)/.test(String(x.accountCode||'')));
      const net=vnd(sum(cash,(x)=>x.debit)-sum(cash,(x)=>x.credit));
      if(net>0)inflow+=net;else if(net<0)outflow+=-net;
    });
    return { inflow:vnd(inflow), outflow:vnd(outflow), net:vnd(inflow-outflow) };
  }

  function invoiceRegister(db, range = {}) {
    return (db.taxInvoices || []).filter((x) => activeInvoice(x) && inRange(x.date, range.from, range.to));
  }
  function pitRegisterSummary(db, range = {}) {
    const rows = (db.pitWithholdings || []).filter((x) => pitWithholdingIsRecognized(x) && inRange(x.date, range.from, range.to));
    return {
      rows,
      gross: vnd(sum(rows, (x) => x.grossIncome ?? x.gross_income)),
      taxable: vnd(sum(rows, (x) => x.taxableIncome ?? x.taxable_income)),
      tax: vnd(sum(rows, (x) => x.taxWithheld ?? x.tax_withheld)),
      net: vnd(sum(rows, (x) => x.netPaid ?? x.net_paid))
    };
  }
  const VAT_NON_CASH_PAYMENT_THRESHOLD = 5000000;
  function vatPaymentMethodClass(value) {
    const method = norm(value);
    if (!method) return 'missing';
    if (['cash','tiền mặt','tien mat'].includes(method)) return 'cash';
    if (['bank','bank transfer','transfer','wire','chuyển khoản','chuyen khoan','card','credit card','debit card','offset','bù trừ','bu tru','clearing'].includes(method)) return 'noncash';
    return 'other';
  }
  function vatInputDeductionAssessment(db, range = {}) {
    const settings = db.settings || {};
    const threshold = Math.max(0, vnd(settings.vatNonCashPaymentThreshold ?? settings.vat_non_cash_payment_threshold ?? VAT_NON_CASH_PAYMENT_THRESHOLD));
    const asOf = isISODate(range.asOf ?? range.as_of) ? (range.asOf ?? range.as_of) : isISODate(range.to) ? range.to : localISODate();
    const invoices = invoiceRegister(db, range).filter((x) => statusIs(x.direction, 'input'));
    const groups = new Map();
    const identity = (invoice, index) => {
      const date = String(invoice.date || '');
      const taxCode = String(invoice.taxCode ?? invoice.tax_code ?? '').replace(/\s+/g, '').toLowerCase();
      const partnerId = String(invoice.partnerId ?? invoice.partner_id ?? '').trim().toLowerCase();
      const partnerType = String(invoice.partnerType ?? invoice.partner_type ?? 'vendor').trim().toLowerCase();
      const party = taxCode ? `tax:${taxCode}` : partnerId ? `${partnerType}:${partnerId}` : `invoice:${String(rowId(invoice) || index)}`;
      return `${date}|${party}`;
    };
    invoices.forEach((invoice, index) => {
      const explicitGross = isNumeric(invoice.totalAmount ?? invoice.total_amount) || isNumeric(invoice.taxBase ?? invoice.tax_base ?? invoice.baseAmount ?? invoice.base_amount);
      const key = identity(invoice, index);
      const current = groups.get(key) || { total:0, explicit:false };
      current.total = vnd(current.total + (explicitGross ? invoiceTotal(invoice) : 0));
      current.explicit = current.explicit || explicitGross;
      groups.set(key, current);
    });
    const rows = invoices.map((invoice, index) => {
      const claimed = boolish(invoice.deductible ?? invoice.isDeductible ?? invoice.is_deductible, false);
      const vatAmount = invoiceVat(invoice);
      const grossAmount = invoiceTotal(invoice);
      const explicitGross = isNumeric(invoice.totalAmount ?? invoice.total_amount) || isNumeric(invoice.taxBase ?? invoice.tax_base ?? invoice.baseAmount ?? invoice.base_amount);
      const group = groups.get(identity(invoice, index)) || { total:0, explicit:false };
      const groupTotal = vnd(group.total);
      const thresholdRelevant = claimed && explicitGross && group.explicit && groupTotal >= threshold;
      const paymentMethod = invoice.paymentMethod ?? invoice.payment_method ?? '';
      const methodClass = vatPaymentMethodClass(paymentMethod);
      const dueDate = invoice.dueDate ?? invoice.due_date ?? '';
      const evidence = inputVatPaymentEvidence(db, invoice, { asOf });
      let deductibleVat = claimed ? vatAmount : 0;
      let provisional = false;
      let reason = claimed ? 'Hóa đơn dưới ngưỡng thanh toán không dùng tiền mặt.' : 'Không đề nghị khấu trừ.';
      if (claimed && !explicitGross) {
        reason = 'Dữ liệu cũ chưa có tổng thanh toán; giữ số đã khai nhưng phải bổ sung hồ sơ để kiểm soát.';
        provisional = true;
      } else if (thresholdRelevant) {
        if (methodClass === 'cash') {
          deductibleVat = 0;
          reason = `Thanh toán tiền mặt trong nhóm mua cùng nhà cung cấp/ngày từ ${threshold.toLocaleString('vi-VN')} VND.`;
        } else if (methodClass === 'noncash') {
          if (evidence.paidGross >= grossAmount - 1) {
            deductibleVat = vatAmount;
            reason = `Đã đối chiếu đủ ${evidence.paidGross.toLocaleString('vi-VN')} VND với khoản chi Paid và bút toán ngân hàng 112 Posted.`;
          } else if (isISODate(dueDate) && asOf < dueDate) {
            provisional = true;
            reason = `Được theo dõi tạm thời theo điều khoản trả chậm đến ${dueDate}; phải điều chỉnh nếu quá hạn mà thiếu chứng từ không dùng tiền mặt.`;
          } else {
            deductibleVat = grossAmount > 0 ? Math.min(vatAmount,Math.max(0,vnd(vatAmount * evidence.paidGross / grossAmount))) : 0;
            reason = evidence.paidGross > 0
              ? `Đến ngày chốt mới đối chiếu được ${evidence.paidGross.toLocaleString('vi-VN')}/${grossAmount.toLocaleString('vi-VN')} VND; VAT chỉ được tính theo phần có chứng từ ngân hàng hợp lệ.`
              : isISODate(dueDate) && dueDate <= asOf
                ? `Đã đến hạn ${dueDate} nhưng chưa có khoản chi Paid liên kết và bút toán ngân hàng 112 hợp lệ.`
                : 'Thiếu hạn thanh toán hoặc bằng chứng thanh toán không dùng tiền mặt đã liên kết.';
          }
        } else {
          deductibleVat = 0;
          reason = methodClass === 'missing'
            ? 'Thiếu phương thức thanh toán cho hóa đơn/nhóm hóa đơn từ ngưỡng kiểm soát.'
            : 'Phương thức “Khác”/bù trừ chưa có hồ sơ thanh toán được xác minh bằng luồng chứng từ hỗ trợ.';
        }
      }
      deductibleVat = Math.min(vatAmount,Math.max(0,vnd(deductibleVat)));
      const blockedVat = Math.max(0,vnd(vatAmount-deductibleVat));
      const eligible = claimed && blockedVat === 0;
      return {
        id:String(rowId(invoice) || ''), index, claimed, eligible:Boolean(eligible), partial:claimed && deductibleVat>0 && deductibleVat<vatAmount, provisional,
        vatAmount, deductibleVat, blockedVat, invoiceTotal:grossAmount, verifiedPaidGross:evidence.paidGross, evidenceCount:evidence.accepted.length, rejectedEvidenceCount:evidence.rejected.length, groupTotal, thresholdRelevant,
        paymentMethod:String(paymentMethod || ''), paymentStatus:String(invoice.paymentStatus ?? invoice.payment_status ?? ''),
        dueDate:String(dueDate || ''), reason
      };
    });
    const blockedRows = rows.filter((row) => row.claimed && row.deductibleVat <= 0 && !row.provisional);
    const partialRows = rows.filter((row) => row.claimed && row.partial && !row.provisional);
    const reviewRows = rows.filter((row) => row.claimed && (row.provisional || row.partial));
    const fullyBlockedVat = vnd(sum(blockedRows, (row) => row.blockedVat));
    const partialBlockedVat = vnd(sum(partialRows, (row) => row.blockedVat));
    return {
      threshold, asOf, rows, blockedRows, partialRows, reviewRows, fullyBlockedVat, partialBlockedVat,
      claimedVat:vnd(sum(rows.filter((row) => row.claimed), (row) => row.vatAmount)),
      deductibleVat:vnd(sum(rows.filter((row) => row.claimed), (row) => row.deductibleVat)),
      blockedVat:vnd(sum(rows.filter((row) => row.claimed), (row) => row.blockedVat))
    };
  }
  function vatRegisterSummary(db, range = {}) {
    const rows = invoiceRegister(db, range);
    const output = vnd(sum(rows.filter((x) => statusIs(x.direction, 'output')), invoiceVat));
    const inputAll = vnd(sum(rows.filter((x) => statusIs(x.direction, 'input')), invoiceVat));
    const inputDeductible = vatInputDeductionAssessment(db, range).deductibleVat;
    return { output, inputAll, inputDeductible, payable: Math.max(0, output - inputDeductible), creditCarry: Math.max(0, inputDeductible - output) };
  }
  function vatLedgerSummary(db, range = {}) {
    const out = accountMovement(db, '33311', range), input = accountMovement(db, '1331', range);
    return {
      output: vnd(out.credit - out.debit),
      outputGross: out.credit,
      outputAdjustments: out.debit,
      input: vnd(input.debit - input.credit),
      inputGross: input.debit,
      inputAdjustments: input.credit
    };
  }
  const boundedRate = (value, fallback = 0) => Math.min(100, Math.max(0, isNumeric(value) ? n(value) : fallback));
  function citPolicyYear(options = {}) {
    const configured = Number(options.taxYear ?? options.tax_year);
    if (Number.isInteger(configured) && configured >= 1900 && configured <= 9999) return configured;
    for (const value of [options.to, options.asOf, options.as_of, options.date, options.from]) {
      if (isISODate(value)) return Number(String(value).slice(0, 4));
    }
    return Number(localISODate().slice(0, 4));
  }
  function citRate(settings = {}, options = {}) {
    if (statusIs(settings.citRateMode ?? settings.cit_rate_mode, 'manual')) {
      const taxYear = citPolicyYear(options);
      const rangeDate = isISODate(options.to) ? options.to : `${taxYear}-12-31`;
      const historyRaw = settings.citManualRateHistory ?? settings.cit_manual_rate_history;
      const history = Array.isArray(historyRaw) ? historyRaw.map((row) => ({
        effectiveFrom: row.effectiveFrom ?? row.effective_from,
        rate: boundedRate(row.rate, NaN),
        valid: isISODate(row.effectiveFrom ?? row.effective_from) && isNumeric(row.rate)
      })).filter((row) => row.valid && row.effectiveFrom <= rangeDate).sort((a,b)=>String(b.effectiveFrom).localeCompare(String(a.effectiveFrom))) : [];
      if (history.length) return history[0].rate;
      return boundedRate(settings.corporateTaxRate ?? settings.corporate_tax_rate, 20);
    }
    const standardRate = boundedRate(settings.citStandardRate ?? settings.cit_standard_rate, 20);
    const taxYear = citPolicyYear(options);
    const reducedRateEffectiveYear = Math.max(1900, Math.trunc(n(settings.citReducedRateEffectiveYear ?? settings.cit_reduced_rate_effective_year) || 2025));
    const exemptionEffectiveYear = Math.max(1900, Math.trunc(n(settings.citExemptionEffectiveYear ?? settings.cit_exemption_effective_year) || 2026));
    const revenue = Math.max(0, n(settings.previousYearTaxRevenueBasis ?? settings.previous_year_tax_revenue_basis ?? settings.previousYearRevenue ?? settings.previous_year_revenue));
    const exemptionThreshold = Math.max(0, n(settings.citExemptionRevenueThreshold ?? settings.cit_exemption_revenue_threshold ?? 1000000000));
    const exemptionApproved = statusIs(settings.citExemptionEligibility ?? settings.cit_exemption_eligibility, 'approved');
    if (taxYear >= exemptionEffectiveYear && exemptionApproved && revenue <= exemptionThreshold) return 0;
    if (taxYear < reducedRateEffectiveYear) return standardRate;
    if (!statusIs(settings.citReducedRateEligibility ?? settings.cit_reduced_rate_eligibility, 'approved')) return standardRate;
    const configuredBands = Array.isArray(settings.citRateBands ?? settings.cit_rate_bands) ? (settings.citRateBands ?? settings.cit_rate_bands) : [
      { maxRevenue: 3000000000, rate: 15, inclusive: true },
      { maxRevenue: 50000000000, rate: 17, inclusive: true },
      { maxRevenue: Number.MAX_SAFE_INTEGER, rate: standardRate, inclusive: true }
    ];
    const bands = configuredBands.map((x) => ({
      maxRevenue: Math.max(0, n(x.maxRevenue ?? x.max_revenue)),
      rate: boundedRate(x.rate),
      validRate: isNumeric(x.rate),
      inclusive: x.inclusive !== false && x.exclusive !== true
    })).filter((x) => x.maxRevenue > 0 && x.validRate).sort((a,b)=>a.maxRevenue-b.maxRevenue);
    const matchedBand = bands.find((x) => x.inclusive ? revenue <= x.maxRevenue : revenue < x.maxRevenue);
    return matchedBand ? matchedBand.rate : standardRate;
  }
  function citEstimate(db, range = {}) {
    const pnl = profitAndLoss(db, range);
    const reviewed = (db.citAdjustments || []).filter((x) => statusIs(x.status, 'reviewed', 'approved') && inRange(x.date, range.from, range.to));
    const increases = vnd(sum(reviewed.filter((x) => statusIs(x.type, 'increase')), (x) => x.amount));
    const decreases = vnd(sum(reviewed.filter((x) => statusIs(x.type, 'decrease')), (x) => x.amount));
    const losses = vnd(sum(reviewed.filter((x) => statusIs(x.type, 'loss carryforward')), (x) => x.amount));
    const taxable = Math.max(0, pnl.profitBeforeTax + increases - decreases - losses);
    const settings = db.settings || {};
    const taxYear = citPolicyYear(range);
    const reducedRateEffectiveYear = Math.max(1900, Math.trunc(n(settings.citReducedRateEffectiveYear ?? settings.cit_reduced_rate_effective_year) || 2025));
    const exemptionEffectiveYear = Math.max(1900, Math.trunc(n(settings.citExemptionEffectiveYear ?? settings.cit_exemption_effective_year) || 2026));
    const rate = citRate(settings, { ...range, taxYear });
    const autoMode = !statusIs(settings.citRateMode ?? settings.cit_rate_mode, 'manual');
    const revenueBasis = Math.max(0, n(settings.previousYearTaxRevenueBasis ?? settings.previous_year_tax_revenue_basis ?? settings.previousYearRevenue ?? settings.previous_year_revenue));
    const exemptionThreshold = Math.max(0, n(settings.citExemptionRevenueThreshold ?? settings.cit_exemption_revenue_threshold ?? 1000000000));
    const exemptionPolicyActive = taxYear >= exemptionEffectiveYear;
    const reducedRatePolicyActive = taxYear >= reducedRateEffectiveYear;
    const exemptionApplied = autoMode && exemptionPolicyActive && rate === 0 && statusIs(settings.citExemptionEligibility ?? settings.cit_exemption_eligibility, 'approved') && revenueBasis <= exemptionThreshold;
    const requiresExemptionReview = autoMode && exemptionPolicyActive && revenueBasis <= exemptionThreshold && statusIs(settings.citExemptionEligibility ?? settings.cit_exemption_eligibility ?? 'Unreviewed', 'unreviewed');
    const reducedRateRelevant = autoMode && reducedRatePolicyActive && !exemptionApplied && revenueBasis <= 50000000000;
    const requiresEligibilityReview = reducedRateRelevant && statusIs(settings.citReducedRateEligibility ?? settings.cit_reduced_rate_eligibility ?? 'Unreviewed', 'unreviewed');
    const fromYear = isISODate(range.from) ? Number(String(range.from).slice(0, 4)) : taxYear;
    const toYear = isISODate(range.to) ? Number(String(range.to).slice(0, 4)) : taxYear;
    const requiresEffectiveDateReview = fromYear !== toYear;
    return {
      accounting: pnl.profitBeforeTax,
      increases,
      decreases,
      losses,
      taxable,
      rate,
      tax: vnd(taxable * rate / 100),
      taxYear,
      revenueBasis,
      exemptionThreshold,
      reducedRateEffectiveYear,
      exemptionEffectiveYear,
      exemptionApplied,
      requiresExemptionReview,
      requiresEligibilityReview,
      requiresEffectiveDateReview
    };
  }
  function pitWithholdingThresholdForDate(input = {}, settings = {}) {
    const current = Math.max(0, vnd(settings.pitWithholdingThreshold ?? settings.pit_withholding_threshold ?? 5000000));
    const previous = Math.max(0, vnd(settings.pitWithholdingThresholdPrevious ?? settings.pit_withholding_threshold_previous ?? 2000000));
    const effectiveDate = isISODate(settings.pitWithholdingThresholdEffectiveDate ?? settings.pit_withholding_threshold_effective_date) ? settings.pitWithholdingThresholdEffectiveDate ?? settings.pit_withholding_threshold_effective_date : '2026-07-01';
    const paymentDate = input.date ?? input.paymentDate ?? input.payment_date ?? '';
    return isISODate(paymentDate) && paymentDate < effectiveDate ? previous : current;
  }
  function pitWithholding(input, settings = {}) {
    const gross = Math.max(0, vnd(input.grossIncome ?? input.gross_income));
    const taxable = Math.min(gross, Math.max(0, vnd(input.taxableIncome ?? input.taxable_income ?? gross)));
    const method = input.withholdingMethod ?? input.withholding_method ?? 'Khấu trừ tỷ lệ';
    const rate = boundedRate(input.rate ?? settings.pitWithholdingRate ?? settings.pit_withholding_rate, 10);
    const threshold = pitWithholdingThresholdForDate(input, settings);
    const commitmentExempt = input.commitmentExempt ?? input.commitment_exempt;
    let tax = 0;
    if (method === 'Không khấu trừ' || commitmentExempt) tax = 0;
    else if (method === 'Khấu trừ tỷ lệ') tax = gross >= threshold ? vnd(taxable * rate / 100) : 0;
    else tax = Math.max(0, vnd(input.taxWithheld ?? input.tax_withheld)); // biểu lũy tiến cần dữ liệu giảm trừ đầy đủ, không tự suy đoán
    tax = Math.min(gross, tax);
    return { gross, taxable, rate, tax, net: gross - tax, requiresManualReview: method !== 'Khấu trừ tỷ lệ' && method !== 'Không khấu trừ' };
  }

  function monthsForRange(range = {}) {
    const end = isISODate(range.to) ? new Date(`${range.to}T12:00:00`) : new Date();
    const start = isISODate(range.from) ? new Date(`${range.from}T12:00:00`) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
    const result = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last && result.length < 36) { result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`); cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); }
    return result;
  }
  function monthlySeries(db, range = {}) {
    const keys = monthsForRange(range);
    const accounts = accountMap(db), lines = postedLines(db, range), people = new Map((db.people || []).map((p) => [p.id, p]));
    const bucket = (fn) => keys.map((key) => vnd(sum(lines.filter((x) => monthOf(x.date) === key), fn)));
    const revenue = bucket((x) => accounts.get(String(x.accountCode))?.type === 'Revenue' ? vnd(x.credit) - vnd(x.debit) : 0).map((x) => x / 1e6);
    const cost = bucket((x) => accounts.get(String(x.accountCode))?.type === 'Expense' && !String(x.accountCode).startsWith('821') ? vnd(x.debit) - vnd(x.credit) : 0).map((x) => x / 1e6);
    const paid = (db.finance || []).filter((x) => financePaid(x) && !isInternalTransfer(x) && inRange(x.date, range.from, range.to));
    const cashIn = keys.map((key) => vnd(sum(paid.filter((x) => statusIs(x.type, 'Income') && monthOf(x.date) === key), (x) => x.amount)) / 1e6);
    const cashOut = keys.map((key) => vnd(sum(paid.filter((x) => statusIs(x.type, 'Expense') && monthOf(x.date) === key), (x) => x.amount)) / 1e6);
    const ts = approvedTimesheets(db, range);
    const currentKey = monthOf(localISODate()), rangeEndKey = monthOf(range.to || localISODate()), effectiveEndKey = rangeEndKey && rangeEndKey < currentKey ? rangeEndKey : currentKey;
    const fixedPeople = (db.people || []).filter((p) => !statusIs(p.type, 'CTV'));
    const payrollFixed = keys.map((key) => key <= effectiveEndKey ? vnd(sum(fixedPeople, (p) => monthlyEmploymentCost(p, key, db.settings || {}, range))) / 1e6 : 0);
    const payrollCtv = keys.map((key) => vnd(sum(ts.filter((x) => {
      const person = people.get(x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id);
      return monthOf(x.date) === key && statusIs(person?.type, 'CTV');
    }), (x) => {
      const person = people.get(x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id);
      return n(x.hours) * costPerHour(person, db.settings || {});
    })) / 1e6);
    const recovered = keys.map((key) => vnd(sum(ts.filter((x) => monthOf(x.date) === key && x.billable), (x) => {
      const person = people.get(x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id);
      return n(x.hours) * n(person?.billingRate ?? person?.billing_rate);
    })) / 1e6);
    const billable = keys.map((key) => sum(ts.filter((x) => monthOf(x.date) === key && x.billable), (x) => x.hours));
    const nonBillable = keys.map((key) => sum(ts.filter((x) => monthOf(x.date) === key && !x.billable), (x) => x.hours));
    return { keys, months: keys.map((x) => `T${x.slice(5)}`), revenue, cost, cashIn, cashOut, payrollFixed, payrollCtv, recovered, billable, nonBillable };
  }
  function revenueByDepartment(db, range = {}) {
    const people = new Map((db.people || []).map((p) => [p.id, p])), projects = new Map((db.projects || []).map((p) => [p.id, p]));
    const map = new Map();
    postedLines(db, range).forEach((line) => {
      const a = accountMap(db).get(String(line.accountCode)); if (a?.type !== 'Revenue') return;
      const p = projects.get(line.projectId ?? line.project_id), pmId = p?.pmId ?? p?.pm_id;
      const dept = people.get(pmId)?.department || p?.type || 'Khác';
      map.set(dept, (map.get(dept) || 0) + vnd(line.credit) - vnd(line.debit));
    });
    const colors = ['#0b73f6', '#14b8a6', '#f59e0b', '#8b5cf6', '#22a447', '#ef4444'];
    return [...map.entries()].filter(([, value]) => value > 0).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }


  function rangeDays(range = {}) {
    if (!isISODate(range.from) || !isISODate(range.to) || range.from > range.to) return 0;
    const start = new Date(`${range.from}T12:00:00`), end = new Date(`${range.to}T12:00:00`);
    return Math.max(0, Math.floor((end - start) / 86400000) + 1);
  }
  function monthEnd(key) {
    if(!/^\d{4}-\d{2}$/.test(String(key)))return '';
    const [y, m] = String(key).split('-').map(Number);
    if(m<1||m>12)return '';
    return localISODate(new Date(y, m, 0));
  }
  function monthlyAccountBalance(db, code, range = {}, side = 'Debit') {
    const keys = monthsForRange(range);
    return {
      keys,
      values: keys.map((key) => {
        const end = range.to && monthEnd(key) > range.to ? range.to : monthEnd(key);
        const b = accountEnding(db, code, { to: end });
        return (side === 'Credit' ? b.endingCredit : b.endingDebit) / 1e6;
      })
    };
  }
  function financeBreakdown(db, range = {}, type = 'Income') {
    const map = new Map();
    (db.finance || []).filter((x) => financePaid(x) && !isInternalTransfer(x) && statusIs(x.type, type) && inRange(x.date, range.from, range.to)).forEach((x) => {
      const name = String(x.category || 'Khác').trim() || 'Khác';
      map.set(name, (map.get(name) || 0) + vnd(x.amount));
    });
    const colors = ['#0b73f6', '#14b8a6', '#f59e0b', '#8b5cf6', '#22a447', '#ef4444', '#64748b'];
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([name,value],i)=>({name,value,color:colors[i%colors.length]}));
  }
  function monthlyFinanceByCategory(db, range = {}, type = 'Expense') {
    const keys = monthsForRange(range), rows = (db.finance || []).filter((x) => financePaid(x) && !isInternalTransfer(x) && statusIs(x.type, type) && inRange(x.date, range.from, range.to));
    const categories = [...new Set(rows.map((x) => String(x.category || 'Khác').trim() || 'Khác'))];
    const colors = ['#0b73f6', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#22a447', '#64748b'];
    return categories.map((name,i)=>({name,color:colors[i%colors.length],values:keys.map((key)=>vnd(sum(rows.filter((x)=>monthOf(x.date)===key && (String(x.category || 'Khác').trim() || 'Khác')===name),(x)=>x.amount))/1e6)}));
  }
  function headcountByDepartment(db, range = {}) {
    const map = new Map();
    const asOf = isISODate(range.to) ? range.to : localISODate();
    (db.people || []).filter((person) => activeDuring(person, { from: asOf, to: asOf })).forEach((person)=>{
      const name=String(person.department||'Chưa phân loại').trim()||'Chưa phân loại';
      map.set(name,(map.get(name)||0)+1);
    });
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  }
  function peopleUtilization(db, range = {}) {
    const settings = db.settings || {};
    const people = (db.people || []).filter((person) => activeDuring(person, range));
    const ts = approvedTimesheets(db, range);
    const dailyHours = Math.max(1, n(settings.dailyWorkingHours) || (n(settings.monthlyWorkingHours) || 176) / 22);
    return people.map((p)=>{
      const personId = p.id;
      const rows=ts.filter((x)=>(x.personId ?? x.person_id)===personId), hours=sum(rows,(x)=>x.hours), billable=sum(rows.filter((x)=>x.billable),(x)=>x.hours);
      const capacity = Math.max(0, workingDaysInRange(range, settings, p) * dailyHours);
      const load = capacity ? hours / capacity * 100 : 0;
      const chargeability = hours ? billable / hours * 100 : 0;
      return {...p,hours,billable,capacity,load,utilization:load,chargeability,billableRatio:chargeability};
    });
  }
  function payrollByDepartment(db, range = {}) {
    const map=new Map(), settings=db.settings||{};
    const keys=monthsForRange(range), currentKey=monthOf(localISODate()), rangeEndKey=monthOf(range.to||localISODate()), effectiveEndKey=rangeEndKey&&rangeEndKey<currentKey?rangeEndKey:currentKey;
    (db.people||[]).filter((p)=>!statusIs(p.type,'CTV')).forEach((p)=>{
      const name=String(p.department||'Chưa phân loại').trim()||'Chưa phân loại';
      const employmentCost=sum(keys.filter((key)=>key<=effectiveEndKey),(key)=>monthlyEmploymentCost(p,key,settings,range));
      if(employmentCost>0) map.set(name,(map.get(name)||0)+employmentCost);
    });
    const people=new Map((db.people||[]).map((p)=>[p.id,p]));
    approvedTimesheets(db,range).forEach((x)=>{const p=people.get(x.personId ?? x.person_id);if(!p||!statusIs(p.type,'CTV'))return;const name=String(p.department||'Chưa phân loại').trim()||'Chưa phân loại';map.set(name,(map.get(name)||0)+n(x.hours)*costPerHour(p,settings));});
    const colors=['#0b73f6','#14b8a6','#f59e0b','#8b5cf6','#22a447','#ef4444'];
    return [...map.entries()].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([name,value],i)=>({name,value:vnd(value),color:colors[i%colors.length]}));
  }
  function revenueByClient(db, range = {}) {
    const clients=new Map((db.clients||[]).map((x)=>[x.id,x])), map=new Map(), accounts=accountMap(db);
    postedLines(db,range).forEach((line)=>{if(accounts.get(String(line.accountCode))?.type!=='Revenue')return;const id=line.partnerType==='client'?line.partnerId:'';const name=clients.get(id)?.name||'Chưa gắn khách hàng';map.set(name,(map.get(name)||0)+vnd(line.credit)-vnd(line.debit));});
    return [...map.entries()].filter(([,v])=>v!==0).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  }
  function revenueByStage(db, range = {}) {
    const projects=new Map((db.projects||[]).map((x)=>[x.id,x])), accounts=accountMap(db), map=new Map();
    postedLines(db,range).forEach((line)=>{if(accounts.get(String(line.accountCode))?.type!=='Revenue')return;const name=projects.get(line.projectId)?.stage||'Chưa phân loại';map.set(name,(map.get(name)||0)+vnd(line.credit)-vnd(line.debit));});
    return [...map.entries()].filter(([,v])=>v!==0).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  }
  function expenseByGroup(db, range = {}) {
    const accounts=accountMap(db), map=new Map();
    postedLines(db,range).forEach((line)=>{const a=accounts.get(String(line.accountCode));if(a?.type!=='Expense')return;let name='Chi phí khác';const code=String(a.code);if(code.startsWith('632'))name='Giá vốn dịch vụ';else if(code.startsWith('6421'))name='Chi phí bán hàng';else if(code.startsWith('6422'))name='Chi phí quản lý';else if(code.startsWith('821'))name='Thuế TNDN';else if(code.startsWith('811'))name='Chi phí khác';map.set(name,(map.get(name)||0)+vnd(line.debit)-vnd(line.credit));});
    const colors=['#0b73f6','#14b8a6','#f59e0b','#8b5cf6','#ef4444'];
    return [...map.entries()].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([name,value],i)=>({name,value,color:colors[i%colors.length]}));
  }
  function dso(db, range = {}) {
    const revenue = profitAndLoss(db, range).revenue;
    const days = rangeDays(range);
    const to = isISODate(range.to) ? range.to : localISODate();
    const endingAr = accountEnding(db, '131', { to }).endingDebit;
    const openingAr = isISODate(range.from) ? accountEnding(openingSnapshotDB(db, range.from), '131', { to: range.from }).endingDebit : endingAr;
    const averageAr = Math.max(0, (openingAr + endingAr) / 2);
    return revenue > 0 && days > 0 ? averageAr / revenue * days : 0;
  }


  // ---- TT133/2016/TT-BTC statutory-report calculation layer ----
  function previousDate(date) {
    if (!isISODate(date)) return '';
    return localISODate(new Date(new Date(`${date}T12:00:00`).getTime() - 86400000));
  }
  function openingSnapshotDB(db, fromDate) {
    if (!isISODate(fromDate)) return db;
    // Opening balances effective on the first day belong to the opening snapshot,
    // while journal entries dated on that day belong to period movement.
    return {...db, journalEntries:(db.journalEntries || []).filter((entry) => isISODate(entry.date) && entry.date < fromDate)};
  }
  function fiscalYearStartFor(db, date = localISODate()) {
    const target = isISODate(date) ? date : localISODate();
    const year = Number(target.slice(0, 4));
    const raw = db?.settings?.fiscalYearStart ?? db?.settings?.fiscal_year_start ?? '01-01';
    let month = 1, day = 1;
    if (/^\d{2}-\d{2}$/.test(String(raw))) {
      month = Number(String(raw).slice(0, 2)); day = Number(String(raw).slice(3, 5));
    } else if (Number.isInteger(Number(raw)) && Number(raw) >= 1 && Number(raw) <= 12) month = Number(raw);
    const candidateThisYear = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const validThisYear = isISODate(candidateThisYear) ? candidateThisYear : `${year}-01-01`;
    if (target >= validThisYear) return validThisYear;
    const previous = `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return isISODate(previous) ? previous : `${year - 1}-01-01`;
  }
  function shiftISOYear(date, offset = -1) {
    if (!isISODate(date)) return '';
    const [year,month,day]=date.split('-').map(Number), targetYear=year+Number(offset||0);
    const maxDay=new Date(targetYear,month,0).getDate();
    return `${targetYear}-${String(month).padStart(2,'0')}-${String(Math.min(day,maxDay)).padStart(2,'0')}`;
  }
  function previousComparableRange(db, range = {}) {
    const to=isISODate(range.to)?range.to:localISODate();
    const from=isISODate(range.from)?range.from:fiscalYearStartFor(db,to);
    return {from:shiftISOYear(from,-1),to:shiftISOYear(to,-1)};
  }
  function accountsByPrefixes(db, prefixes = [], excludePrefixes = []) {
    return (db.accounts || []).filter((a) => prefixes.some((p) => String(a.code).startsWith(String(p))) && !excludePrefixes.some((p) => String(a.code).startsWith(String(p))));
  }
  function endingDebitByPrefixes(db, prefixes, range = {}, excludePrefixes = []) {
    return vnd(sum(accountsByPrefixes(db, prefixes, excludePrefixes), (a) => accountEnding(db, a.code, range).endingDebit));
  }
  function endingCreditByPrefixes(db, prefixes, range = {}, excludePrefixes = []) {
    return vnd(sum(accountsByPrefixes(db, prefixes, excludePrefixes), (a) => accountEnding(db, a.code, range).endingCredit));
  }
  function movementNetByPrefixes(db, prefixes, range = {}, normal = 'Debit', excludePrefixes = []) {
    return vnd(sum(accountsByPrefixes(db, prefixes, excludePrefixes), (a) => {
      const m = accountMovement(db, a.code, range);
      return normal === 'Credit' ? m.credit - m.debit : m.debit - m.credit;
    }));
  }
  function tt133B01a(db, range = {}) {
    const endDate = isISODate(range.to) ? range.to : localISODate();
    const endRange = { to: endDate };
    const fiscalStart = fiscalYearStartFor(db, endDate);
    const startRange = { to: fiscalStart };
    const startDb = openingSnapshotDB(db, fiscalStart);
    const valueAt = (which, fn) => fn(which === 'end' ? db : startDb, which === 'end' ? endRange : startRange);
    const make = (code, label, endFn, startFn = endFn, level = 0, bold = false, noteRef = '') => ({
      code, label, level, bold, noteRef, end: vnd(valueAt('end', endFn)), start: vnd(valueAt('start', startFn))
    });
    const reportClass=(a)=>String(a.reportClass??a.report_class??a.balanceSheetClass??a.balance_sheet_class??'').trim().toLowerCase();
    const debitByClass=(d,className,r)=>vnd(sum((d.accounts||[]).filter(a=>reportClass(a)===className),(a)=>accountEnding(d,a.code,r).endingDebit));
    const cash = (d,r)=>endingDebitByPrefixes(d,['111','112'],r);
    const shortInvest = (d,r)=>endingDebitByPrefixes(d,['121','1281','1288'],r)-endingCreditByPrefixes(d,['2291'],r);
    const ar = (d,r)=>endingDebitByPrefixes(d,['131'],r);
    const advances = (d,r)=>endingDebitByPrefixes(d,['331'],r);
    const otherReceivables = (d,r)=>endingDebitByPrefixes(d,['136','138','141'],r)-endingCreditByPrefixes(d,['2293'],r);
    const inventory = (d,r)=>endingDebitByPrefixes(d,['151','152','153','154','155','156','157'],r)-endingCreditByPrefixes(d,['2294'],r);
    const classifiedCurrentOther=(d,r)=>debitByClass(d,'current_other_asset',r);
    const otherCurrent = (d,r)=>endingDebitByPrefixes(d,['133'],r)+classifiedCurrentOther(d,r);
    const fixedGross = (d,r)=>endingDebitByPrefixes(d,['211','213'],r);
    const fixedDep = (d,r)=>-endingCreditByPrefixes(d,['214'],r,['2147']);
    const fixedNet = (d,r)=>fixedGross(d,r)+fixedDep(d,r);
    const investmentPropertyGross=(d,r)=>endingDebitByPrefixes(d,['217'],r);
    const investmentPropertyDep=(d,r)=>-endingCreditByPrefixes(d,['2147'],r);
    const investmentPropertyNet=(d,r)=>investmentPropertyGross(d,r)+investmentPropertyDep(d,r);
    const construction = (d,r)=>endingDebitByPrefixes(d,['241'],r);
    const longInvest = (d,r)=>endingDebitByPrefixes(d,['228'],r)-endingCreditByPrefixes(d,['2292'],r);
    const otherLong = (d,r)=>vnd(sum(accountsByPrefixes(d,['242','244']).filter(a=>reportClass(a)!=='current_other_asset'),a=>accountEnding(d,a.code,r).endingDebit));
    const currentAssets = (d,r)=>cash(d,r)+shortInvest(d,r)+ar(d,r)+advances(d,r)+otherReceivables(d,r)+inventory(d,r)+otherCurrent(d,r);
    const nonCurrentAssets = (d,r)=>fixedNet(d,r)+investmentPropertyNet(d,r)+construction(d,r)+longInvest(d,r)+otherLong(d,r);
    const totalAssets = (d,r)=>currentAssets(d,r)+nonCurrentAssets(d,r);

    const tradePayables = (d,r)=>endingCreditByPrefixes(d,['331'],r);
    const customerAdvances = (d,r)=>endingCreditByPrefixes(d,['131'],r);
    const taxes = (d,r)=>endingCreditByPrefixes(d,['333'],r);
    const employees = (d,r)=>endingCreditByPrefixes(d,['334'],r);
    const otherPayables = (d,r)=>endingCreditByPrefixes(d,['335','336','338'],r);
    const loans = (d,r)=>endingCreditByPrefixes(d,['341'],r);
    const provisions = (d,r)=>endingCreditByPrefixes(d,['352'],r);
    const funds = (d,r)=>endingCreditByPrefixes(d,['353','356'],r);
    const liabilities = (d,r)=>tradePayables(d,r)+customerAdvances(d,r)+taxes(d,r)+employees(d,r)+otherPayables(d,r)+loans(d,r)+provisions(d,r)+funds(d,r);
    const exactNetCredit = (d,code,r)=>vnd(sum((d.accounts||[]).filter((account)=>String(account.code)===String(code)),(account)=>{
      const ending=accountEnding(d,account.code,r);return ending.endingCredit-ending.endingDebit;
    }));
    const netCreditByPrefixes = (d,prefixes,r)=>endingCreditByPrefixes(d,prefixes,r)-endingDebitByPrefixes(d,prefixes,r);
    const contributed = (d,r)=>netCreditByPrefixes(d,['4111'],r)+exactNetCredit(d,'411',r);
    const sharePremium = (d,r)=>netCreditByPrefixes(d,['4112'],r);
    const otherOwnerCapital = (d,r)=>netCreditByPrefixes(d,['4118'],r);
    const fx = (d,r)=>endingCreditByPrefixes(d,['413'],r)-endingDebitByPrefixes(d,['413'],r);
    const ownerFunds = (d,r)=>endingCreditByPrefixes(d,['418'],r);
    const treasury = (d,r)=>-endingDebitByPrefixes(d,['419'],r);
    const retained = (d,r)=>endingCreditByPrefixes(d,['421'],r)-endingDebitByPrefixes(d,['421'],r);
    const unclosedResult = (d,r)=>profitAndLoss(d,{from:fiscalYearStartFor(d,r.to||localISODate()),to:r.to||localISODate()}).profitAfterTax;
    const retainedAndCurrentResult = (d,r)=>retained(d,r)+unclosedResult(d,r);
    const equity = (d,r)=>contributed(d,r)+sharePremium(d,r)+otherOwnerCapital(d,r)+treasury(d,r)+fx(d,r)+ownerFunds(d,r)+retainedAndCurrentResult(d,r);
    const totalSources = (d,r)=>liabilities(d,r)+equity(d,r);

    const rows = [
      make('100','TÀI SẢN NGẮN HẠN',currentAssets,currentAssets,0,true),
      make('110','Tiền và các khoản tương đương tiền',cash,cash,1,false,'V.01'),
      make('120','Đầu tư tài chính ngắn hạn',shortInvest,shortInvest,1,false,'V.02'),
      make('130','Các khoản phải thu ngắn hạn',(d,r)=>ar(d,r)+advances(d,r)+otherReceivables(d,r),undefined,1,false,'V.03'),
      make('131','Phải thu ngắn hạn của khách hàng',ar,ar,2),
      make('132','Trả trước cho người bán ngắn hạn',advances,advances,2),
      make('134','Phải thu ngắn hạn khác',otherReceivables,otherReceivables,2),
      make('140','Hàng tồn kho',inventory,inventory,1,false,'V.04'),
      make('150','Tài sản ngắn hạn khác',otherCurrent,otherCurrent,1,false,'V.05'),
      make('200','TÀI SẢN DÀI HẠN',nonCurrentAssets,nonCurrentAssets,0,true),
      make('220','Tài sản cố định',fixedNet,fixedNet,1,false,'V.06'),
      make('221','Nguyên giá tài sản cố định',fixedGross,fixedGross,2),
      make('222','Giá trị hao mòn lũy kế',fixedDep,fixedDep,2),
      make('230','Bất động sản đầu tư',investmentPropertyNet,investmentPropertyNet,1,false,'V.07'),
      make('231','Nguyên giá bất động sản đầu tư',investmentPropertyGross,investmentPropertyGross,2),
      make('232','Giá trị hao mòn lũy kế bất động sản đầu tư',investmentPropertyDep,investmentPropertyDep,2),
      make('240','Xây dựng cơ bản dở dang',construction,construction,1,false,'V.08'),
      make('250','Đầu tư tài chính dài hạn',longInvest,longInvest,1,false,'V.09'),
      make('260','Tài sản dài hạn khác',otherLong,otherLong,1,false,'V.10'),
      make('270','TỔNG CỘNG TÀI SẢN',totalAssets,totalAssets,0,true),
      make('300','NỢ PHẢI TRẢ',liabilities,liabilities,0,true),
      make('311','Phải trả người bán',tradePayables,tradePayables,1,false,'V.11'),
      make('312','Người mua trả tiền trước',customerAdvances,customerAdvances,1,false,'V.12'),
      make('313','Thuế và các khoản phải nộp Nhà nước',taxes,taxes,1,false,'V.13'),
      make('314','Phải trả người lao động',employees,employees,1,false,'V.14'),
      make('315','Phải trả khác',otherPayables,otherPayables,1,false,'V.15'),
      make('316','Vay và nợ thuê tài chính',loans,loans,1,false,'V.16'),
      make('317','Dự phòng phải trả',provisions,provisions,1,false,'V.17'),
      make('318','Quỹ khen thưởng, phúc lợi và quỹ khác',funds,funds,1,false,'V.18'),
      make('400','VỐN CHỦ SỞ HỮU',equity,equity,0,true),
      make('411','Vốn góp của chủ sở hữu',contributed,contributed,1,false,'V.19'),
      make('412','Thặng dư vốn cổ phần',sharePremium,sharePremium,1),
      make('413','Vốn khác của chủ sở hữu',otherOwnerCapital,otherOwnerCapital,1),
      make('414','Cổ phiếu quỹ',treasury,treasury,1),
      make('415','Chênh lệch tỷ giá hối đoái',fx,fx,1),
      make('416','Các quỹ thuộc vốn chủ sở hữu',ownerFunds,ownerFunds,1),
      make('417','Lợi nhuận sau thuế chưa phân phối',retainedAndCurrentResult,retainedAndCurrentResult,1,false,'V.20'),
      make('440','TỔNG CỘNG NGUỒN VỐN',totalSources,totalSources,0,true)
    ];
    const equityRow=rows.find((row)=>row.code==='400');
    const equityDetail=rows.filter((row)=>['411','412','413','414','415','416','417'].includes(row.code));
    const equityDetailEnd=vnd(sum(equityDetail,(row)=>row.end)),equityDetailStart=vnd(sum(equityDetail,(row)=>row.start));
    const classificationValid=[fixedGross(db,endRange),investmentPropertyGross(db,endRange),otherLong(db,endRange)].every(v=>v>=0)
      && fixedNet(db,endRange)>=0 && investmentPropertyNet(db,endRange)>=0;
    return {
      form:'B01a-DNN', title:'Báo cáo tình hình tài chính', rows, fiscalStart,
      totalAssets:vnd(totalAssets(db,endRange)), totalSources:vnd(totalSources(db,endRange)),
      balanced:vnd(totalAssets(db,endRange))===vnd(totalSources(db,endRange)), classificationValid,
      equityDetailBalanced:equityDetailEnd===equityRow.end&&equityDetailStart===equityRow.start,
      equityDetailEnd,equityDetailStart
    };
  }
  function tt133B02(db, range = {}) {
    const calculate=(reportRange)=>{
      const net = (p, normal='Credit')=>movementNetByPrefixes(db,p,reportRange,normal);
      const sales = net(['511'],'Credit'), deductions = net(['521'],'Debit'), netRevenue = sales-deductions;
      const cogs=net(['632'],'Debit'), gross=netRevenue-cogs, financeIncome=net(['515'],'Credit'), financeCost=net(['635'],'Debit');
      const interest=movementNetByPrefixes(db,['6351'],reportRange,'Debit'), management=net(['642'],'Debit'), operating=gross+financeIncome-financeCost-management;
      const otherIncome=net(['711'],'Credit'), otherCost=net(['811'],'Debit'), otherProfit=otherIncome-otherCost, pbt=operating+otherProfit;
      const tax=net(['821'],'Debit'), pat=pbt-tax;
      return {sales,deductions,netRevenue,cogs,gross,financeIncome,financeCost,interest,management,operating,otherIncome,otherCost,otherProfit,pbt,tax,pat};
    };
    const current=calculate(range), previousRange=previousComparableRange(db,range), previous=calculate(previousRange);
    const defs=[
      ['01','Doanh thu bán hàng và cung cấp dịch vụ','sales','VI.01'],['02','Các khoản giảm trừ doanh thu','deductions','VI.02'],['10','Doanh thu thuần','netRevenue',''],['11','Giá vốn hàng bán','cogs','VI.03'],['20','Lợi nhuận gộp','gross',''],['21','Doanh thu hoạt động tài chính','financeIncome','VI.04'],['22','Chi phí tài chính','financeCost','VI.05'],['23','Trong đó: Chi phí lãi vay','interest',''],['24','Chi phí quản lý kinh doanh','management','VI.06'],['30','Lợi nhuận thuần từ hoạt động kinh doanh','operating',''],['31','Thu nhập khác','otherIncome','VI.07'],['32','Chi phí khác','otherCost','VI.08'],['40','Lợi nhuận khác','otherProfit',''],['50','Tổng lợi nhuận kế toán trước thuế','pbt',''],['51','Chi phí thuế TNDN','tax','VI.09'],['60','Lợi nhuận sau thuế TNDN','pat','']
    ];
    const rows=defs.map(([code,label,key,noteRef])=>({code,label,noteRef,value:vnd(current[key]),previous:vnd(previous[key]),bold:['10','20','30','40','50','60'].includes(code)}));
    return {form:'B02-DNN',title:'Báo cáo kết quả hoạt động kinh doanh',rows,previousRange,profitBeforeTax:vnd(current.pbt),profitAfterTax:vnd(current.pat)};
  }
  function tt133B03Direct(db, range = {}) {
    const calculate=(reportRange)=>{
      const cashCodes=['111','112'];
      const classes={customer:0,supplier:0,employee:0,interest:0,cit:0,otherOperatingIn:0,otherOperatingOut:0,assetPurchase:0,assetSale:0,loanInvestmentOut:0,loanInvestmentIn:0,equityInvestmentOut:0,equityInvestmentIn:0,interestDividend:0,ownerIn:0,capitalReturnOut:0,borrowIn:0,loanPrincipalOut:0,leasePrincipalOut:0,dividendOut:0,fx:0};
      const invalidDirections=[];
      postedEntries(db,reportRange).forEach((entry)=>{
        const cashLines=(entry.lines||[]).filter(l=>cashCodes.some(p=>String(l.accountCode??l.account_code??'').startsWith(p)));
        const grossIn=vnd(sum(cashLines,x=>x.debit)), grossOut=vnd(sum(cashLines,x=>x.credit));
        const netCash=vnd(grossIn-grossOut), inflow=Math.max(0,netCash), outflow=Math.max(0,-netCash);
        if(!inflow&&!outflow)return;
        const cps=(entry.lines||[]).filter(l=>!cashCodes.some(p=>String(l.accountCode??l.account_code??'').startsWith(p))).map(l=>String(l.accountCode??l.account_code??''));
        const has=(...p)=>cps.some(c=>p.some(x=>c.startsWith(x)));
        if(has('413')){classes.fx+=netCash;return;}
        const code=cashFlowCodeNormalized(entryCashFlowCode(entry));
        const expected=cashFlowExpectedDirection(code),actual=inflow?'inflow':'outflow';
        if(expected && expected!=='either' && expected!==actual) invalidDirections.push({entryId:rowId(entry),documentNo:entry.documentNo??entry.document_no??'',code,expected,actual,amount:Math.abs(netCash)});
        const directMap={
          '01':['customer','in'],'02':['supplier','out'],'03':['employee','out'],'04':['interest','out'],'05':['cit','out'],'06':['otherOperatingIn','in'],'07':['otherOperatingOut','out'],
          '21':['assetPurchase','out'],'22':['assetSale','in'],'23':['loanInvestmentOut','out'],'24':['loanInvestmentIn','in'],'25':['equityInvestmentOut','out'],'26':['equityInvestmentIn','in'],'27':['interestDividend','in'],
          '31':['ownerIn','in'],'32':['capitalReturnOut','out'],'33':['borrowIn','in'],'34':['loanPrincipalOut','out'],'35':['leasePrincipalOut','out'],'36':['dividendOut','out']
        };
        if(directMap[code] && (!expected || expected===actual || expected==='either')){
          const [bucket,direction]=directMap[code];classes[bucket]+=direction==='in'?inflow:outflow;return;
        }
        if(inflow){
          if(has('131','511'))classes.customer+=inflow;
          else if(has('211','213','217','241'))classes.assetSale+=inflow;
          else if(has('228'))classes.equityInvestmentIn+=inflow;
          else if(has('121','128'))classes.loanInvestmentIn+=inflow;
          else if(has('515'))classes.interestDividend+=inflow;
          else if(has('341'))classes.borrowIn+=inflow;
          else if(has('411'))classes.ownerIn+=inflow;
          else classes.otherOperatingIn+=inflow;
        }
        if(outflow){
          if(has('334'))classes.employee+=outflow;
          else if(has('635'))classes.interest+=outflow;
          else if(has('3334'))classes.cit+=outflow;
          else if(has('211','213','217','241'))classes.assetPurchase+=outflow;
          else if(has('228'))classes.equityInvestmentOut+=outflow;
          else if(has('121','128'))classes.loanInvestmentOut+=outflow;
          else if(has('3412'))classes.leasePrincipalOut+=outflow;
          else if(has('341'))classes.loanPrincipalOut+=outflow;
          else if(has('421'))classes.dividendOut+=outflow;
          else if(has('411','419'))classes.capitalReturnOut+=outflow;
          else if(has('331','151','152','153','154','156','632','642'))classes.supplier+=outflow;
          else classes.otherOperatingOut+=outflow;
        }
      });
      const op=classes.customer-classes.supplier-classes.employee-classes.interest-classes.cit+classes.otherOperatingIn-classes.otherOperatingOut;
      const inv=-classes.assetPurchase+classes.assetSale-classes.loanInvestmentOut+classes.loanInvestmentIn-classes.equityInvestmentOut+classes.equityInvestmentIn+classes.interestDividend;
      const fin=classes.ownerIn-classes.capitalReturnOut+classes.borrowIn-classes.loanPrincipalOut-classes.leasePrincipalOut-classes.dividendOut;
      const net=op+inv+fin;
      const defaultFrom=fiscalYearStartFor(db,isISODate(reportRange.to)?reportRange.to:localISODate());
      const periodFrom=isISODate(reportRange.from)?reportRange.from:defaultFrom;
      const opening=endingDebitByPrefixes(openingSnapshotDB(db,periodFrom),cashCodes,{to:periodFrom});
      const closing=endingDebitByPrefixes(db,cashCodes,{to:isISODate(reportRange.to)?reportRange.to:localISODate()});
      const fx=vnd(classes.fx);
      return {classes,op,inv,fin,net,opening,closing,fx,invalidDirections};
    };
    const current=calculate(range), previousRange=previousComparableRange(db,range), previous=calculate(previousRange);
    const defs=[
      ['01','Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác','customer','in','VII.01'],['02','Tiền chi trả cho người cung cấp hàng hóa, dịch vụ','supplier','out','VII.02'],['03','Tiền chi trả cho người lao động','employee','out','VII.03'],['04','Tiền lãi vay đã trả','interest','out','VII.04'],['05','Thuế TNDN đã nộp','cit','out','VII.05'],['06','Tiền thu khác từ hoạt động kinh doanh','otherOperatingIn','in','VII.06'],['07','Tiền chi khác cho hoạt động kinh doanh','otherOperatingOut','out','VII.07'],
      ['20','Lưu chuyển tiền thuần từ hoạt động kinh doanh','op','net',''],['21','Tiền chi mua sắm, xây dựng TSCĐ và tài sản dài hạn','assetPurchase','out','VII.08'],['22','Tiền thu thanh lý, nhượng bán TSCĐ và tài sản dài hạn','assetSale','in','VII.09'],['23','Tiền chi cho vay, mua các công cụ nợ của đơn vị khác','loanInvestmentOut','out','VII.10'],['24','Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác','loanInvestmentIn','in','VII.11'],['25','Tiền chi đầu tư góp vốn vào đơn vị khác','equityInvestmentOut','out','VII.12'],['26','Tiền thu hồi đầu tư góp vốn vào đơn vị khác','equityInvestmentIn','in','VII.13'],['27','Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia','interestDividend','in','VII.14'],['30','Lưu chuyển tiền thuần từ hoạt động đầu tư','inv','net',''],['31','Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu','ownerIn','in','VII.15'],['32','Tiền trả lại vốn góp cho chủ sở hữu, mua lại cổ phiếu đã phát hành','capitalReturnOut','out','VII.16'],['33','Tiền thu từ đi vay','borrowIn','in','VII.17'],['34','Tiền trả nợ gốc vay','loanPrincipalOut','out','VII.18'],['35','Tiền trả nợ gốc thuê tài chính','leasePrincipalOut','out','VII.19'],['36','Cổ tức, lợi nhuận đã trả cho chủ sở hữu','dividendOut','out','VII.20'],['40','Lưu chuyển tiền thuần từ hoạt động tài chính','fin','net',''],['50','Lưu chuyển tiền thuần trong kỳ','net','net',''],['60','Tiền và tương đương tiền đầu kỳ','opening','net',''],['61','Ảnh hưởng thay đổi tỷ giá quy đổi ngoại tệ','fx','net',''],['70','Tiền và tương đương tiền cuối kỳ','closing','net','']
    ];
    const get=(x,key,kind)=>kind==='net'?x[key]:kind==='out'?-x.classes[key]:x.classes[key];
    const rows=defs.map(([code,label,key,kind,noteRef])=>({code,label,noteRef,value:vnd(get(current,key,kind)),previous:vnd(get(previous,key,kind)),bold:['20','30','40','50','70'].includes(code)}));
    return {form:'B03-DNN',title:'Báo cáo lưu chuyển tiền tệ (phương pháp trực tiếp)',rows,previousRange,opening:vnd(current.opening),net:vnd(current.net),fx:vnd(current.fx),closing:vnd(current.closing),invalidDirections:current.invalidDirections,reconciled:vnd(current.opening+current.net+current.fx)===vnd(current.closing)};
  }
  function tt133F01(db, range = {}) {
    return {form:'F01-DNN',title:'Bảng cân đối tài khoản',...trialBalance(db,range)};
  }
  function tt133B09(db, range = {}) {
    const b01=tt133B01a(db,range), b02=tt133B02(db,range), b03=tt133B03Direct(db,range);
    const notes=Array.isArray(db.reportNotesTT133)?db.reportNotesTT133:Array.isArray(db.report_notes_tt133)?db.report_notes_tt133:[];
    const required=[
      ['I','Đặc điểm hoạt động của doanh nghiệp'],['II','Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán'],['III','Chuẩn mực và chế độ kế toán áp dụng'],['IV','Các chính sách kế toán áp dụng'],['V','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính'],['VI','Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh'],['VII','Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ'],['VIII','Những thông tin khác']
    ];
    const automatic={
      I:`Doanh nghiệp hoạt động trong lĩnh vực tư vấn thiết kế. Kỳ báo cáo từ ${range.from||b01.fiscalStart||''} đến ${range.to||''}.`,
      II:`Năm tài chính bắt đầu ${db.settings?.fiscalYearStart||'01-01'}; đơn vị tiền tệ sử dụng trong kế toán: ${db.settings?.currency||'VND'}.`,
      III:`Chế độ kế toán: ${db.settings?.accountingRegime||'Chưa khai báo'}. Báo cáo được lập trên giả định hoạt động liên tục.`,
      IV:`Cơ sở dồn tích; nguyên tắc giá gốc; phương pháp VAT: ${db.settings?.vatMethod||'Khấu trừ'}. Chính sách chi tiết phải được kế toán trưởng phê duyệt.`,
      V:`Tiền cuối kỳ ${vnd(b03.closing)}; phải thu khách hàng ${endingDebitByPrefixes(db,['131'],{to:range.to||localISODate()})}; hàng tồn kho và chi phí dở dang ${endingDebitByPrefixes(db,['151','152','153','154','155','156','157'],{to:range.to||localISODate()})}; phải trả người bán ${endingCreditByPrefixes(db,['331'],{to:range.to||localISODate()})}.`,
      VI:`Doanh thu thuần ${b02.rows.find(x=>x.code==='10')?.value||0}; lợi nhuận trước thuế ${b02.profitBeforeTax}; lợi nhuận sau thuế ${b02.profitAfterTax}.`,
      VII:`Lưu chuyển tiền thuần trong kỳ ${b03.net}; tiền cuối kỳ ${b03.closing}; trạng thái đối chiếu ${b03.reconciled?'khớp sổ cái':'chưa khớp sổ cái'}.`,
      VIII:`B01a ${b01.balanced&&b01.classificationValid?'cân đối và vượt kiểm tra phân loại':'cần rà soát'}; số thuyết minh phải được cập nhật, soát xét và phê duyệt trước phát hành.`
    };
    const contentText=(value)=>{
      if(value==null)return '';
      if(typeof value==='string')return value;
      if(Array.isArray(value))return value.map(contentText).filter(Boolean).join('\n');
      if(typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join('\n');
      return String(value);
    };
    const sections=required.map(([sectionCode,title])=>{
      const note=notes.find(n=>String(n.sectionCode??n.section_code??'')===sectionCode && (!range.from||String(n.periodFrom??n.period_from??'')===range.from) && (!range.to||String(n.periodTo??n.period_to??'')===range.to));
      const status=String(note?.status||'draft').toLowerCase();
      const preparedBy=String(note?.preparedBy??note?.prepared_by??'');
      const reviewedBy=String(note?.reviewedBy??note?.reviewed_by??'');
      const approvedBy=String(note?.approvedBy??note?.approved_by??'');
      const preparedAt=String(note?.preparedAt??note?.prepared_at??'');
      const reviewedAt=String(note?.reviewedAt??note?.reviewed_at??'');
      const approvedAt=String(note?.approvedAt??note?.approved_at??'');
      const content=contentText(note?.content)||automatic[sectionCode];
      const contentHash=String(note?.contentSha256??note?.content_sha256??'');
      const serverWorkflow=note?.workflowComplete??note?.workflow_complete;
      const distinctActors=preparedBy&&reviewedBy&&approvedBy&&preparedBy!==reviewedBy&&preparedBy!==approvedBy&&reviewedBy!==approvedBy;
      const workflowComplete=serverWorkflow===true||(serverWorkflow!==false&&status==='approved'&&content.trim().length>=20&&Boolean(contentHash)&&Boolean(preparedAt&&reviewedAt&&approvedAt)&&Boolean(distinctActors));
      const evidenceScope=String(note?.evidenceScope??note?.evidence_scope??'');
      const source=note?(evidenceScope==='demo-simulated'?'demo-simulated-note':'controlled-cloud-note'):'automatic-draft';
      return {sectionCode,title:note?.sectionTitle??note?.section_title??title,status,content,source,evidenceScope,id:note?.id||'',contentHash,preparedBy,preparedAt,reviewedBy,reviewedAt,approvedBy,approvedAt,workflowVersion:Number(note?.workflowVersion??note?.workflow_version??1)||1,workflowComplete};
    });
    return {form:'B09-DNN',title:'Bản thuyết minh Báo cáo tài chính',sections,complete:sections.every(x=>x.workflowComplete),approvedCount:sections.filter(x=>x.workflowComplete).length,statusApprovedCount:sections.filter(x=>x.status==='approved').length};
  }
  function normalizeCloudReportRows(rows = []) {
    return (Array.isArray(rows)?rows:[]).map(row=>({
      code:String(row.code??row.account_code??''),
      current:vnd(row.ending_amount??row.amount??row.value??0),
      opening:vnd(row.opening_amount??row.start??0)
    }));
  }
  function renameStatutoryReport(report,form,title){return {...report,form,title};}
  function tt99B01(db,range={}){return renameStatutoryReport(tt133B01a(db,range),'B01-DN','Báo cáo tình hình tài chính');}
  function tt99B02(db,range={}){return renameStatutoryReport(tt133B02(db,range),'B02-DN','Báo cáo kết quả hoạt động kinh doanh');}
  function tt99B03Direct(db,range={}){return renameStatutoryReport(tt133B03Direct(db,range),'B03-DN','Báo cáo lưu chuyển tiền tệ (phương pháp trực tiếp)');}
  function tt99B09(db,range={}){
    const reportDb=Array.isArray(db?.reportNotesTT99)?{...db,reportNotesTT133:db.reportNotesTT99}:db;
    const base=tt133B09(reportDb,range);
    return {...base,form:'B09-DN',title:'Bản thuyết minh Báo cáo tài chính',sections:(base.sections||[]).map(x=>({...x,source:x.source==='manual'?'manual':'TT99 integrated mapping'}))};
  }
  function tt99ReportChecks(db,range={}){
    const base=tt133ReportChecks(db,range);
    const mappingCheck={
      code:'TT99_MAPPING_VALIDATED',pass:false,severity:'critical',title:'Mapping TT99 được đối chiếu Phụ lục IV',
      detail:'Bản hiện tại chỉ là bản xem trước tương thích được suy ra từ TT133; chưa được phép phát hành như biểu B01-DN/B02-DN/B03-DN/B09-DN theo TT99.'
    };
    const checks=[...base.checks,mappingCheck];
    return {...base,checks,pass:false,allApproved:false,mappingValidated:false,releaseBlocked:true,regime:'TT99',forms:['B01-DN','B02-DN','B03-DN','B09-DN']};
  }

  function tt132B01(db,range={}){
    const base=tt133B01a(db,range),byCode=new Map((base.rows||[]).map(row=>[String(row.code),row]));
    const at=(code,key)=>vnd(byCode.get(String(code))?.[key]||0);
    const add=(codes,key)=>vnd(sum(codes,code=>at(code,key)));
    const endDate=isISODate(range.to)?range.to:localISODate(),fiscalStart=base.fiscalStart||fiscalYearStartFor(db,endDate);
    const endRange={to:endDate},startRange={to:fiscalStart},startDb=openingSnapshotDB(db,fiscalStart);
    const taxAt=(data,reportRange)=>vnd(endingCreditByPrefixes(data,['3313','333'],reportRange));
    const retainedAt=(data,reportRange,baseValue)=>vnd(baseValue+endingCreditByPrefixes(data,['4118'],reportRange)-endingDebitByPrefixes(data,['4118'],reportRange));
    const taxEnd=taxAt(db,endRange),taxStart=taxAt(startDb,startRange);
    const retainedEnd=retainedAt(db,endRange,at('417','end')),retainedStart=retainedAt(startDb,startRange,at('417','start'));
    const row=(code,label,start,end,level=0,bold=false)=>({code,label,noteRef:'',level,bold,start:vnd(start),end:vnd(end)});
    const rows=[
      row('110','Tiền',at('110','start'),at('110','end'),0,false),
      row('120','Các khoản nợ phải thu',add(['120','130','150'],'start'),add(['120','130','150'],'end')),
      row('130','Hàng tồn kho',at('140','start'),at('140','end')),
      row('140','Giá trị còn lại của tài sản cố định',add(['220','230'],'start'),add(['220','230'],'end')),
      row('150','Tài sản khác',add(['240','250','260'],'start'),add(['240','250','260'],'end')),
      row('200','TỔNG CỘNG TÀI SẢN',at('270','start'),at('270','end'),0,true),
      row('300','I. Nợ phải trả',at('300','start'),at('300','end'),0,true),
      row('310','Các khoản nợ phải trả',at('300','start')-taxStart,at('300','end')-taxEnd,1,false),
      row('320','Thuế và các khoản phải nộp Nhà nước',taxStart,taxEnd,1,false),
      row('400','II. Vốn chủ sở hữu',at('400','start'),at('400','end'),0,true),
      row('410','Vốn đầu tư của chủ sở hữu',at('400','start')-retainedStart,at('400','end')-retainedEnd,1,false),
      row('420','Lợi nhuận sau thuế chưa phân phối',retainedStart,retainedEnd,1,false),
      row('500','TỔNG CỘNG NGUỒN VỐN',at('440','start'),at('440','end'),0,true)
    ];
    const totalAssets=at('270','end'),totalSources=at('440','end');
    return {form:'B01-DNSN',title:'Báo cáo tình hình tài chính',rows,fiscalStart,totalAssets,totalSources,balanced:totalAssets===totalSources,equityDetailBalanced:vnd(rows.find(x=>x.code==='410').end+rows.find(x=>x.code==='420').end)===at('400','end')&&vnd(rows.find(x=>x.code==='410').start+rows.find(x=>x.code==='420').start)===at('400','start')};
  }

  function tt132B02(db,range={}){
    const calculate=(reportRange)=>{
      const nativeRevenue=movementNetByPrefixes(db,['9111'],reportRange,'Credit'),nativeExpenses=movementNetByPrefixes(db,['9112'],reportRange,'Debit');
      if(nativeRevenue||nativeExpenses)return {revenue:vnd(nativeRevenue),expenses:vnd(nativeExpenses),profit:vnd(nativeRevenue-nativeExpenses),mapping:'TT132 native 9111/9112'};
      const detailed=tt133B02(db,reportRange),map=new Map((detailed.rows||[]).map(row=>[String(row.code),vnd(row.value)]));
      const revenue=vnd((map.get('10')||0)+(map.get('21')||0)+(map.get('31')||0));
      const expenses=vnd((map.get('11')||0)+(map.get('22')||0)+(map.get('24')||0)+(map.get('32')||0)+(map.get('51')||0));
      return {revenue,expenses,profit:vnd(revenue-expenses),mapping:'TT133-compatible chart collapsed to TT132'};
    };
    const current=calculate(range),previousRange=previousComparableRange(db,range),previous=calculate(previousRange);
    const rows=[
      {code:'01',label:'Doanh thu và thu nhập thuần',noteRef:'',value:current.revenue,previous:previous.revenue,bold:false},
      {code:'02',label:'Các khoản chi phí',noteRef:'',value:current.expenses,previous:previous.expenses,bold:false},
      {code:'03',label:'Lợi nhuận kế toán sau thuế TNDN (03 = 01 - 02)',noteRef:'',value:current.profit,previous:previous.profit,bold:true}
    ];
    return {form:'B02-DNSN',title:'Báo cáo kết quả hoạt động kinh doanh',rows,previousRange,profitAfterTax:current.profit,formulaValid:vnd(current.revenue-current.expenses)===vnd(current.profit),mapping:current.mapping};
  }

  function tt132F01(db,range={}){return {form:'F01-DNSN',title:'Bảng cân đối tài khoản',...trialBalance(db,range)};}

  function tt132F02(db,range={}){
    const aggregate=(prefixes,excludePrefixes=[])=>{
      const values=accountsByPrefixes(db,prefixes,excludePrefixes).reduce((out,account)=>{
        const ending=accountEnding(db,account.code,range);
        out.openingPayable+=ending.openingCredit-ending.openingDebit;out.arisingPayable+=ending.credit;out.paid+=ending.debit;out.endingPayable+=ending.endingCredit-ending.endingDebit;return out;
      },{openingPayable:0,arisingPayable:0,paid:0,endingPayable:0});
      Object.keys(values).forEach(key=>values[key]=vnd(values[key]));
      values.reconciled=vnd(values.openingPayable+values.arisingPayable-values.paid)===values.endingPayable;
      return values;
    };
    const defs=[
      ['01','Thuế GTGT',['33131','33311'],[]],
      ['02','Thuế TNDN',['33134','3334'],[]],
      ['03','Các loại thuế, phí, lệ phí và các khoản phải nộp khác vào NSNN',['33138','333'],['33311','3334']]
    ];
    const rows=defs.map(([code,label,prefixes,exclusions])=>({code,label,...aggregate(prefixes,exclusions),bold:false}));
    const total={code:'10',label:'TỔNG CỘNG',openingPayable:vnd(sum(rows,x=>x.openingPayable)),arisingPayable:vnd(sum(rows,x=>x.arisingPayable)),paid:vnd(sum(rows,x=>x.paid)),endingPayable:vnd(sum(rows,x=>x.endingPayable)),bold:true};
    total.reconciled=vnd(total.openingPayable+total.arisingPayable-total.paid)===total.endingPayable;
    rows.push(total);
    return {form:'F02-DNSN',title:'Báo cáo tình hình thực hiện nghĩa vụ với ngân sách nhà nước',rows,reconciled:rows.every(row=>row.reconciled)};
  }

  function tt132ReportChecks(db,range={}){
    const b01=tt132B01(db,range),b02=tt132B02(db,range),f01=tt132F01(db,range),f02=tt132F02(db,range);
    const checks=[
      {code:'TT132_B01',pass:b01.balanced,severity:'critical',title:'B01-DNSN cân đối',detail:b01.balanced?'Tổng tài sản bằng tổng nguồn vốn.':`Lệch ${vnd(b01.totalAssets-b01.totalSources)} VND.`},
      {code:'TT132_B01_EQUITY',pass:b01.equityDetailBalanced,severity:'critical',title:'B01-DNSN cộng ngang vốn chủ sở hữu',detail:b01.equityDetailBalanced?'Chỉ tiêu 400 bằng 410 + 420 ở đầu kỳ và cuối kỳ.':'Chi tiết vốn chủ sở hữu chưa khớp chỉ tiêu 400.'},
      {code:'TT132_B02',pass:b02.formulaValid,severity:'critical',title:'B02-DNSN đúng công thức',detail:b02.formulaValid?'Lợi nhuận sau thuế bằng doanh thu, thu nhập thuần trừ chi phí.':'Chỉ tiêu 03 chưa bằng 01 - 02.'},
      {code:'TT132_F01',pass:f01.balanced,severity:'critical',title:'F01-DNSN cân đối',detail:f01.balanced?'Phát sinh Nợ/Có và số dư cuối kỳ cân bằng.':'Bảng cân đối tài khoản chưa cân bằng.'},
      {code:'TT132_F02',pass:f02.reconciled,severity:'critical',title:'F02-DNSN đối chiếu nghĩa vụ NSNN',detail:f02.reconciled?'Số đầu năm + phát sinh phải nộp - đã nộp = số cuối năm.':'Có dòng nghĩa vụ ngân sách chưa đối chiếu.'}
    ];
    return {regime:'TT132',forms:['B01-DNSN','B02-DNSN','F01-DNSN','F02-DNSN'],checks,pass:checks.filter(x=>x.severity==='critical').every(x=>x.pass),allApproved:checks.every(x=>x.pass)};
  }
  function tt133ReportParity(clientReport, cloudRows = []) {
    const server=new Map(normalizeCloudReportRows(cloudRows).map(x=>[x.code,x]));
    const differences=(clientReport?.rows||[]).map(row=>{
      const cloud=server.get(String(row.code));
      const clientCurrent=vnd(row.end??row.value??0),clientOpening=vnd(row.start??0);
      return {code:String(row.code),clientCurrent,cloudCurrent:cloud?.current??null,currentDifference:cloud==null?null:vnd(clientCurrent-cloud.current),clientOpening,cloudOpening:cloud?.opening??null,openingDifference:cloud==null?null:vnd(clientOpening-cloud.opening)};
    }).filter(x=>x.cloudCurrent==null||x.currentDifference!==0||(clientReport?.form==='B01a-DNN'&&x.openingDifference!==0));
    return {pass:differences.length===0,differences};
  }
  function tt133ReportChecks(db, range = {}) {
    const b01=tt133B01a(db,range), b02=tt133B02(db,range), b03=tt133B03Direct(db,range), b09=tt133B09(db,range), pnl=profitAndLoss(db,range);
    const checks=[
      {code:'TT133_B01',pass:b01.balanced,severity:'critical',title:'B01a-DNN cân đối',detail:b01.balanced?'Tổng tài sản bằng tổng nguồn vốn.':`Lệch ${vnd(b01.totalAssets-b01.totalSources)} VND.`},
      {code:'TT133_B01_CLASSIFICATION',pass:b01.classificationValid,severity:'critical',title:'B01a-DNN phân loại tài sản',detail:b01.classificationValid?'TSCĐ, bất động sản đầu tư và tài sản dài hạn không âm bất hợp lý.':'Có chỉ tiêu tài sản âm hoặc phân loại TK 217/2147 chưa hợp lệ.'},
      {code:'TT133_B01_EQUITY',pass:b01.equityDetailBalanced,severity:'critical',title:'B01a-DNN cộng ngang vốn chủ sở hữu',detail:b01.equityDetailBalanced?'Chỉ tiêu 400 bằng tổng các chỉ tiêu 411–417 ở đầu kỳ và cuối kỳ.':'Chi tiết vốn chủ sở hữu 411–417 chưa khớp chỉ tiêu 400.'},
      {code:'TT133_B02',pass:vnd(b02.profitBeforeTax)===vnd(pnl.profitBeforeTax),severity:'critical',title:'B02-DNN khớp sổ cái',detail:vnd(b02.profitBeforeTax)===vnd(pnl.profitBeforeTax)?'Lợi nhuận trước thuế khớp engine P&L.':'Lợi nhuận trước thuế đang lệch.'},
      {code:'TT133_B03_DIRECTION',pass:b03.invalidDirections.length===0,severity:'critical',title:'B03-DNN đúng chiều mã lưu chuyển',detail:b03.invalidDirections.length?`${b03.invalidDirections.length} chứng từ gắn mã thu/chi sai chiều.`:'Không có chứng từ tiền gắn mã B03 sai chiều.'},
      {code:'TT133_B03',pass:b03.reconciled,severity:'critical',title:'B03-DNN khớp tiền cuối kỳ',detail:b03.reconciled?'Tiền đầu kỳ + lưu chuyển + tỷ giá = tiền cuối kỳ.':'Báo cáo lưu chuyển tiền tệ chưa khớp.'},
      {code:'TT133_B09',pass:b09.complete,severity:'warning',title:'B09-DNN được phê duyệt đầy đủ',detail:`Đã phê duyệt ${b09.approvedCount}/8 phần thuyết minh.`}
    ];
    return {checks,pass:checks.filter(x=>x.severity==='critical').every(x=>x.pass),allApproved:checks.every(x=>x.pass)};
  }


  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, n(value)));

  function validateProject(project = {}) {
    const errors = [], warnings = [];
    const contractValue = vnd(project.contractValue ?? project.contract_value), directBudget = vnd(project.directBudget ?? project.direct_budget);
    const progress = n(project.progress);
    const startDate = project.startDate ?? project.start_date;
    const endDate = project.endDate ?? project.end_date;
    if (!String(project.code || '').trim()) errors.push('Thiếu mã dự án.');
    if (!String(project.name || '').trim()) errors.push('Thiếu tên dự án.');
    if (!String(project.clientId ?? project.client_id ?? '').trim()) errors.push('Thiếu khách hàng của dự án.');
    if (!String(project.pmId ?? project.pm_id ?? '').trim()) errors.push('Thiếu người quản lý phụ trách dự án.');
    if (contractValue <= 0) errors.push('Giá trị hợp đồng phải lớn hơn 0.');
    if (directBudget < 0) errors.push('Ngân sách trực tiếp không được âm.');
    if (contractValue > 0 && directBudget > contractValue) warnings.push('Ngân sách trực tiếp đang lớn hơn giá trị hợp đồng.');
    if (progress < 0 || progress > 100) errors.push('Tiến độ phải nằm trong khoảng 0–100%.');
    if (startDate && !isISODate(startDate)) errors.push('Ngày bắt đầu không hợp lệ.');
    if (endDate && !isISODate(endDate)) errors.push('Ngày kết thúc không hợp lệ.');
    if (isISODate(startDate) && isISODate(endDate) && startDate > endDate) errors.push('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    return { valid: errors.length === 0, errors, warnings };
  }

  function validateTimesheet(db, row = {}, existingId = '') {
    const errors = [], warnings = [];
    const hours = n(row.hours);
    const personId = row.personId ?? row.person_id ?? row.employeeId ?? row.employee_id;
    const projectId = row.projectId ?? row.project_id;
    if (!row.date) errors.push('Thiếu ngày làm việc.');
    else if (!isISODate(row.date)) errors.push('Ngày làm việc không hợp lệ.');
    if (!(db.people || []).some((x) => sameId(x.id, personId))) errors.push('Nhân sự không tồn tại.');
    if (!(db.projects || []).some((x) => sameId(x.id, projectId))) errors.push('Dự án không tồn tại.');
    if (hours <= 0 || hours > 24) errors.push('Số giờ phải lớn hơn 0 và không vượt 24 giờ.');
    const dailyHours = sum((db.timesheets || []).filter((x) => {
      const existingPersonId = x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id;
      return x.id !== existingId && sameId(existingPersonId, personId) && x.date === row.date;
    }), (x) => x.hours) + hours;
    if (dailyHours > 24) errors.push(`Tổng giờ trong ngày vượt 24 giờ (${dailyHours} giờ).`);
    if (dailyHours > 12) warnings.push(`Tổng giờ trong ngày cao (${dailyHours} giờ), cần quản lý phê duyệt.`);
    if (!String(row.description || '').trim()) warnings.push('Chưa có mô tả công việc.');
    return { valid: errors.length === 0, errors, warnings, dailyHours };
  }

  function projectScheduleProgress(project = {}, asOfDate = localISODate()) {
    const startDate = project.startDate ?? project.start_date;
    const endDate = project.endDate ?? project.end_date;
    if (!isISODate(startDate) || !isISODate(endDate) || !isISODate(asOfDate) || startDate > endDate) return 0;
    const start = new Date(`${startDate}T12:00:00`), end = new Date(`${endDate}T12:00:00`), asOf = new Date(`${asOfDate}T12:00:00`);
    if (asOf <= start) return 0;
    if (asOf >= end) return 100;
    return clamp((asOf - start) / Math.max(1, end - start) * 100);
  }

  function syncProjectQuickInputs(db, projectId, options = {}) {
    const project = (db.projects || []).find((x) => sameId(x.id, projectId));
    if (!project) return { ok:false, projectId, errors:['Không tìm thấy dự án.'], warnings:[], updated:[] };
    const idFactory = typeof options.idFactory === 'function' ? options.idFactory : (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
    const updated = [], warnings = [], created = [];
    const targetContract = Math.max(0, vnd(project.contractValue ?? project.contract_value));
    const targetBudget = Math.max(0, vnd(project.directBudget ?? project.direct_budget));
    project.progressMode = options.progressMode || project.progressMode || 'manual';

    db.contracts = Array.isArray(db.contracts) ? db.contracts : [];
    db.billingMilestones = Array.isArray(db.billingMilestones) ? db.billingMilestones : [];
    db.projectBudgetVersions = Array.isArray(db.projectBudgetVersions) ? db.projectBudgetVersions : [];
    db.projectBudgetLines = Array.isArray(db.projectBudgetLines) ? db.projectBudgetLines : [];

    const customerContracts = db.contracts.filter((x) => sameId(x.projectId ?? x.project_id, projectId) && statusIs(x.contractType ?? x.contract_type ?? 'customer','customer') && !statusIs(x.status,'cancelled','terminated'));
    let primaryContract = customerContracts.find((x) => x.isPrimary === true || x.is_primary === true) || customerContracts.find((x) => statusIs(x.status,'active')) || customerContracts[0] || null;
    if (!primaryContract && targetContract > 0) {
      primaryContract = { id:idFactory('ct'), projectId, clientId:project.clientId ?? project.client_id ?? '', contractNo:`${project.code || projectId}-HD-01`, contractType:'customer', signedDate:'', effectiveDate:project.startDate ?? project.start_date ?? localISODate(), expiryDate:project.endDate ?? project.end_date ?? '', valueExclVat:targetContract, vatRate:n(options.defaultVatRate ?? db.settings?.defaultVatRate ?? db.settings?.default_vat_rate ?? 10), status:'Active', isPrimary:true };
      db.contracts.unshift(primaryContract); created.push('contract');
    } else if (primaryContract) {
      const otherValue = vnd(sum(customerContracts.filter((x) => x.id !== primaryContract.id), (x) => x.valueExclVat ?? x.value_excl_vat ?? x.contractValue ?? x.contract_value));
      if (otherValue > targetContract) warnings.push('Tổng các hợp đồng khách hàng khác đã lớn hơn giá trị nhập nhanh; không thể đồng bộ chính xác toàn bộ contract value.');
      primaryContract.projectId = projectId;
      primaryContract.clientId = project.clientId ?? project.client_id ?? primaryContract.clientId ?? primaryContract.client_id ?? '';
      primaryContract.valueExclVat = Math.max(0, vnd(targetContract - Math.min(targetContract, otherValue)));
      primaryContract.isPrimary = true;
      updated.push('contract');
    }
    if (primaryContract) {
      const milestones = db.billingMilestones.filter((x) => (x.contractId ?? x.contract_id) === primaryContract.id && !statusIs(x.status,'cancelled'));
      if (milestones.length) {
        const contractAmount = Math.max(0, vnd(primaryContract.valueExclVat ?? primaryContract.value_excl_vat));
        let weights = milestones.map((x) => Math.max(0,n(x.percentage)));
        let weightTotal = sum(weights);
        if (weightTotal <= 0) { weights = milestones.map((x) => Math.max(0,vnd(x.amountExclVat ?? x.amount_excl_vat ?? x.amount))); weightTotal = sum(weights); }
        if (weightTotal <= 0) { weights = milestones.map((_,i) => i === 0 ? 1 : 0); weightTotal = 1; }
        let assigned = 0;
        const remainderIndex = (() => { for (let i = weights.length - 1; i >= 0; i -= 1) if (weights[i] > 0) return i; return Math.max(0, milestones.length - 1); })();
        milestones.forEach((x,i) => {
          const remaining = Math.max(0, contractAmount - assigned);
          const proportional = vnd(contractAmount * weights[i] / weightTotal);
          const amount = i === remainderIndex ? remaining : Math.min(remaining, Math.max(0, proportional));
          assigned += amount; x.amountExclVat = amount; x.projectId = projectId;
        });
        updated.push('billing-milestones');
      }
    }

    const approved = db.projectBudgetVersions.filter((x) => sameId(x.projectId ?? x.project_id, projectId) && statusIs(x.status,'approved')).sort((a,b) => n(b.versionNo ?? b.version_no) - n(a.versionNo ?? a.version_no));
    let budgetVersion = approved[0] || null;
    if (!budgetVersion && targetBudget > 0) {
      budgetVersion = { id:idFactory('pbv'), projectId, versionNo:1, versionName:'Budget Baseline — Quick Input', status:'Approved', contractValue:targetContract, directBudget:targetBudget, contingency:0, targetMarginPercent:n(db.settings?.targetMargin ?? db.settings?.target_margin ?? 30), effectiveFrom:project.startDate ?? project.start_date ?? localISODate(), expectedRiskCost:Math.max(0,vnd(project.expectedRiskCost ?? project.expected_risk_cost)) };
      db.projectBudgetVersions.unshift(budgetVersion); created.push('budget-version');
      db.projectBudgetLines.unshift({ id:idFactory('pbl'), budgetVersionId:budgetVersion.id, costType:'other_direct', description:'Ngân sách trực tiếp nhập nhanh từ hồ sơ dự án', quantity:1, unitRate:targetBudget, amount:targetBudget, plannedHours:0 });
      created.push('budget-line');
    } else if (budgetVersion) {
      const previousBudget = Math.max(0, vnd(budgetVersion.directBudget ?? budgetVersion.direct_budget));
      budgetVersion.projectId = projectId;
      budgetVersion.contractValue = targetContract;
      budgetVersion.directBudget = targetBudget;
      if (previousBudget > 0 && Number.isFinite(Number(budgetVersion.contingency))) budgetVersion.contingency = vnd(n(budgetVersion.contingency) * targetBudget / previousBudget);
      const lines = db.projectBudgetLines.filter((x) => (x.budgetVersionId ?? x.budget_version_id) === budgetVersion.id);
      if (lines.length) {
        const oldAmounts = lines.map((x) => Math.max(0,vnd(x.amount ?? n(x.quantity) * n(x.unitRate ?? x.unit_rate))));
        let total = sum(oldAmounts); if (total <= 0) { total = lines.length; oldAmounts.fill(1); }
        let assigned = 0;
        lines.forEach((x,i) => {
          const amount = i === lines.length - 1 ? Math.max(0,targetBudget-assigned) : vnd(targetBudget * oldAmounts[i] / total);
          assigned += amount; x.amount = amount; const qty=Math.max(0,n(x.quantity)); if(qty>0)x.unitRate=vnd(amount/qty);
        });
      } else if (targetBudget > 0) {
        db.projectBudgetLines.unshift({ id:idFactory('pbl'), budgetVersionId:budgetVersion.id, costType:'other_direct', description:'Ngân sách trực tiếp nhập nhanh từ hồ sơ dự án', quantity:1, unitRate:targetBudget, amount:targetBudget, plannedHours:0 });
        created.push('budget-line');
      }
      updated.push('budget-version','budget-lines');
    }
    return { ok:true, projectId, contractValue:targetContract, directBudget:targetBudget, progress:clamp(project.progress), progressMode:project.progressMode, primaryContractId:primaryContract?.id || '', budgetVersionId:budgetVersion?.id || '', updated:[...new Set(updated)], created:[...new Set(created)], warnings, errors:[] };
  }

  function projectFinancials(db, projectId, range = {}) {
    const project = (db.projects || []).find((x) => sameId(x.id, projectId));
    if (!project) return { valid: false, errors: ['Không tìm thấy dự án.'], projectId };
    const validation = validateProject(project);
    const cumulative = projectCumulativeRange(range);
    const commercialValue = projectCommercialValue(db, project);
    const budget = approvedBudget(db, projectId, cumulative);
    const contractValue = commercialValue.committedValue;
    const pipelineValue = commercialValue.pipelineValue;
    const directBudget = budget.directBudget > 0 ? budget.directBudget : Math.max(0, vnd(project.directBudget ?? project.direct_budget));
    const progressInfo = projectStageProgress(db, project, cumulative.to);
    const progress = progressInfo.progress;
    const scheduleProgress = progressInfo.scheduleProgress;
    const actual = projectActualCost(db, projectId, cumulative);
    const actualCost = actual.actualCost;
    const earnedValue = vnd(directBudget * progress / 100);
    const plannedValue = vnd(directBudget * scheduleProgress / 100);
    const cpi = actualCost > 0 ? earnedValue / actualCost : (earnedValue > 0 ? null : 1);
    const spi = plannedValue > 0 ? earnedValue / plannedValue : (earnedValue > 0 ? null : 1);
    const resourcePlan = remainingResourcePlanCost(db, projectId, cumulative);
    const commitments = projectCommitments(db, projectId, cumulative);
    const approvedRiskCost = budget.version ? (budget.version.expectedRiskCost ?? budget.version.expected_risk_cost) : undefined;
    const expectedRiskCost = Math.max(0, vnd(approvedRiskCost ?? project.expectedRiskCost ?? project.expected_risk_cost));
    const knownRemainingCost = vnd(resourcePlan.remainingCost + commitments.outstanding + expectedRiskCost);
    const planBasedEAC = vnd(actualCost + knownRemainingCost);
    let statisticalEAC = Math.max(actualCost, directBudget);
    if (cpi !== null && cpi > 0 && earnedValue > 0) statisticalEAC = Math.max(actualCost, vnd(directBudget / cpi));
    else if (progress > 0) statisticalEAC = Math.max(actualCost, vnd(actualCost / (progress / 100)));
    else if (actualCost > 0) statisticalEAC = Math.max(directBudget, actualCost);
    const baselineRemaining = Math.max(0, directBudget - actualCost);
    const planCoverage = baselineRemaining > 0 ? Math.min(1, knownRemainingCost / baselineRemaining) : 1;
    const completed = progress >= 99.5 || commercialValue.lifecycle === 'completed';
    let estimateAtCompletion;
    let eacMethod;
    if (completed) {
      estimateAtCompletion = Math.max(actualCost, planBasedEAC);
      eacMethod = 'Completion actual + open commitments';
    } else if (planCoverage >= 0.9 && resourcePlan.planCount > 0) {
      estimateAtCompletion = Math.max(actualCost, planBasedEAC, cpi !== null && cpi < 1 ? statisticalEAC : 0);
      eacMethod = 'Coverage-qualified approved plan';
    } else {
      estimateAtCompletion = Math.max(actualCost, directBudget, planBasedEAC, statisticalEAC);
      eacMethod = 'Hybrid conservative forecast';
    }
    estimateAtCompletion = vnd(estimateAtCompletion);
    const eacConfidence = budget.version && progressInfo.confidence === 'High' && planCoverage >= 0.9 && resourcePlan.planCount > 0
      ? 'High' : budget.version && planCoverage >= 0.5 ? 'Medium' : 'Low';
    const forecastCostToComplete = Math.max(0, estimateAtCompletion - actualCost);
    const budgetVariance = vnd(directBudget - estimateAtCompletion);
    const actualBudgetVariance = vnd(directBudget - actualCost);
    const commercials = projectCommercials(db, projectId, cumulative);
    const recognizedRevenue = vnd(sum(postedLines(db, cumulative).filter((x) => sameId(x.projectId, projectId) && accountMap(db).get(String(x.accountCode))?.type === 'Revenue'), (x) => vnd(x.credit) - vnd(x.debit)));
    const actualProfit = vnd(recognizedRevenue - actualCost);
    const actualMargin = recognizedRevenue > 0 ? actualProfit / recognizedRevenue * 100 : 0;
    const forecastProfit = vnd(contractValue - estimateAtCompletion);
    const forecastMargin = contractValue > 0 ? forecastProfit / contractValue * 100 : 0;
    const earnedRevenue = vnd(contractValue * progress / 100);
    const backlog = Math.max(0, vnd(contractValue - commercials.invoicedNet));
    const unbilledEarnedRevenue = Math.max(0, vnd(earnedRevenue - commercials.invoicedNet));
    const deferredRevenue = Math.max(0, vnd(commercials.invoicedNet - earnedRevenue));
    const contractCollectionRate = contractValue ? commercials.allocatedNet / contractValue * 100 : 0;
    const invoiceCollectionRate = commercials.invoicedGross ? commercials.allocatedGross / commercials.invoicedGross * 100 : 0;
    const warnings = [...validation.warnings, ...(progressInfo.warnings || [])];
    if (commercialValue.lifecycle === 'pipeline' && contractValue === 0) warnings.push('Dự án đang ở pipeline; giá trị chưa được tính vào hợp đồng đã cam kết.');
    if (commercialValue.draftContractCount > 0 && commercialValue.committedContractCount === 0) warnings.push('Chỉ có hợp đồng Draft/Proposal; chưa được tính vào Contract Value.');
    if (budget.duplicateApprovedCount > 1) warnings.push('Có nhiều hơn một budget baseline Approved; hệ thống dùng phiên bản hiệu lực mới nhất.');
    if (budget.mismatch) warnings.push('Tổng dòng ngân sách không khớp Direct Budget của baseline.');
    if (estimateAtCompletion > directBudget) warnings.push(`Dự báo vượt ngân sách ${vnd(estimateAtCompletion - directBudget)} VND.`);
    if (cpi !== null && cpi < 0.9) warnings.push('Chỉ số hiệu quả chi phí dưới 0,90.');
    if (spi !== null && spi < 0.9) warnings.push('Chỉ số hiệu quả tiến độ dưới 0,90; tiến độ thực hiện đang chậm hơn kế hoạch.');
    if (contractValue > 0 && forecastMargin < n(db.settings?.targetMargin ?? 30)) warnings.push('Biên lợi nhuận dự báo thấp hơn mục tiêu công ty.');
    if (commercials.invoicedGross > 0 && invoiceCollectionRate < 80) warnings.push('Tỷ lệ thu trên hóa đơn dưới 80%.');
    if (contractValue > 0 && progress > 0 && commercials.invoicedNet / Math.max(1, contractValue) < progress / 100 - 0.15) warnings.push('Xuất hóa đơn chậm hơn tiến độ thực hiện trên 15 điểm %.');
    if (!completed && planCoverage < 0.5) warnings.push(`Kế hoạch chi phí còn lại mới bao phủ ${Math.round(planCoverage*100)}% phần ngân sách chưa sử dụng; chi phí ước tính khi hoàn thành dùng nguyên tắc thận trọng.`);
    if (eacConfidence === 'Low') warnings.push('Độ tin cậy của chi phí ước tính khi hoàn thành thấp do ngân sách cơ sở, trọng số tiến độ hoặc kế hoạch chi phí còn thiếu.');
    if (resourcePlan.slippedHours > 0) warnings.push(`Còn ${Math.round(resourcePlan.slippedHours*100)/100} giờ kế hoạch quá hạn chưa được bù bởi timesheet; cần reforecast nguồn lực.`);
    if (actual.unpostedDirectFinanceCost > 0) warnings.push(`${actual.unpostedDirectFinanceCount} khoản chi trực tiếp đã Paid nhưng chưa liên kết chứng từ Posted đang được cộng tạm vào Actual Cost.`);
    if (commercials.unappliedCashGross > 0) warnings.push(`Còn ${vnd(commercials.unappliedCashGross)} VND tiền thu chưa phân bổ tới hóa đơn.`);
    if (commercials.invoicedNet > contractValue && contractValue > 0) warnings.push('Giá trị hóa đơn chưa VAT đang vượt Contract Value; cần kiểm tra phụ lục hoặc hóa đơn điều chỉnh.');
    return {
      valid: validation.valid, errors: validation.errors, warnings, projectId, formulaVersion:'ALPHA-SMART-CONTROL-4.0', dataCutoff:cumulative.to,
      lifecycle: commercialValue.lifecycle, contractValue, pipelineValue, contractValueSource:commercialValue.source, committedContractCount:commercialValue.committedContractCount, draftContractCount:commercialValue.draftContractCount,
      directBudget, budgetSource:budget.source, budgetMismatch:budget.mismatch,
      progress, progressSource: progressInfo.source, progressConfidence:progressInfo.confidence, scheduleProgress, laborCost: actual.timesheetLaborCost,
      postedCost: actual.postedCost, postedLaborCost: actual.postedLaborCost, unpostedLaborCost: actual.unpostedLaborCost, unpostedDirectFinanceCost:actual.unpostedDirectFinanceCost,
      directNonLabor: Math.max(0, actual.actualCost - Math.max(actual.timesheetLaborCost, actual.postedLaborCost)), actualCost, wipLedger: actual.wipLedger,
      earnedValue, plannedValue, cpi, spi, estimateAtCompletion, planBasedEAC, statisticalEAC, eacMethod, eacConfidence, planCoverage,
      remainingLaborCost: resourcePlan.remainingCost, plannedLaborCost:resourcePlan.plannedCost, committedCostToComplete: commitments.outstanding, expectedRiskCost, knownRemainingCost,
      forecastCostToComplete, budgetVariance, actualBudgetVariance, actualProfit, actualMargin, forecastProfit, forecastMargin,
      actualProjectContribution:actualProfit, actualProjectContributionMargin:actualMargin,
      forecastProjectContribution:forecastProfit, forecastProjectContributionMargin:forecastMargin,
      invoicedNet: commercials.invoicedNet, invoicedGross: commercials.invoicedGross,
      allocatedGross: commercials.allocatedGross, allocatedNet: commercials.allocatedNet,
      collected: commercials.collectedGross, collectedGross: commercials.collectedGross, collectedNet: commercials.collectedNet,
      cashReceivedGross: commercials.cashReceivedGross, cashReceivedNet: commercials.cashReceivedNet, unappliedCashGross: commercials.unappliedCashGross, collectionSource: commercials.collectionSource,
      receivable: commercials.receivableGross, receivableGross: commercials.receivableGross, receivableNet: commercials.receivableNet,
      cashPaid: commercials.cashPaid, netProjectCash: commercials.netProjectCash,
      backlog, earnedRevenue, unbilledEarnedRevenue, deferredRevenue,
      pendingCollection: commercials.receivableGross, collectionRate: contractCollectionRate,
      contractCollectionRate, invoiceCollectionRate, recognizedRevenue, aging: commercials.aging,
      budgetVersion: budget.version?.versionName ?? budget.version?.version_name ?? '', budgetLineTotal: budget.lineTotal,
      resourcePlanCount: resourcePlan.planCount, slippedPlanHours: resourcePlan.slippedHours, futurePlanHours: resourcePlan.futureHours, commitmentCount: commitments.rows.length,
      lineage:{actualCost:'posted direct project cost + approved timesheet labor not yet posted + paid direct non-labor not linked to ledger',recognizedRevenue:'posted revenue accounts',commercial:'valid output invoices + invoice allocations',cash:'paid project finance transactions',forecast:'approved budget + stage progress + plan coverage + commitments + risk reserve + statistical cross-check; forecast profit is project contribution before overhead and tax'}
    };
  }

  function portfolioHealth(db, range = {}) {
    const rows = (db.projects || []).map((project) => ({ project, ...projectFinancials(db, project.id, range) }));
    const contractedRows = rows.filter((x) => x.lifecycle !== 'pipeline' && x.lifecycle !== 'excluded' && x.contractValue > 0);
    const pipelineRows = rows.filter((x) => x.lifecycle === 'pipeline');
    const operationalRows = rows.filter((x) => x.lifecycle !== 'excluded');
    const contractValue = vnd(sum(contractedRows, (x) => x.contractValue));
    const pipelineValue = vnd(sum(pipelineRows, (x) => x.pipelineValue));
    const directBudget = vnd(sum(contractedRows, (x) => x.directBudget));
    const actualCost = vnd(sum(contractedRows, (x) => x.actualCost));
    const estimateAtCompletion = vnd(sum(contractedRows, (x) => x.estimateAtCompletion));
    const forecastProfit = vnd(sum(contractedRows, (x) => x.forecastProfit));
    const recognizedRevenue = vnd(sum(contractedRows, (x) => x.recognizedRevenue));
    const actualProfit = vnd(sum(contractedRows, (x) => x.actualProfit));
    const invoicedNet = vnd(sum(contractedRows, (x) => x.invoicedNet));
    const invoicedGross = vnd(sum(contractedRows, (x) => x.invoicedGross));
    const collected = vnd(sum(contractedRows, (x) => x.collected));
    const collectedNet = vnd(sum(contractedRows, (x) => x.collectedNet));
    const cashReceivedGross = vnd(sum(contractedRows, (x) => x.cashReceivedGross));
    const receivable = vnd(sum(contractedRows, (x) => x.receivable));
    const backlog = vnd(sum(contractedRows, (x) => x.backlog));
    const cashPaid = vnd(sum(contractedRows, (x) => x.cashPaid));
    const netProjectCash = vnd(sum(contractedRows, (x) => x.netProjectCash));
    const atRisk = contractedRows.filter((x) => x.warnings.length || !x.valid).length;
    const highConfidence = contractedRows.filter((x)=>x.eacConfidence==='High').length;
    const mediumConfidence = contractedRows.filter((x)=>x.eacConfidence==='Medium').length;
    const lowConfidence = contractedRows.filter((x)=>x.eacConfidence==='Low').length;
    const healthScore = contractedRows.length ? Math.round(sum(contractedRows,(x)=>{
      let score=100;
      if(!x.valid) score-=40;
      score-=Math.min(30,x.warnings.length*5);
      if(x.eacConfidence==='Low')score-=15;else if(x.eacConfidence==='Medium')score-=5;
      if(x.forecastMargin<0)score-=10;
      return Math.max(0,score);
    })/contractedRows.length) : 100;
    return {
      rows, contractedRows, pipelineRows, operationalRows,
      activeProjectCount: contractedRows.length, pipelineCount:pipelineRows.length, excludedProjectCount:rows.length-operationalRows.length,
      contractValue, pipelineValue, directBudget, actualCost, estimateAtCompletion, forecastProfit, recognizedRevenue, actualProfit,
      invoicedNet, invoicedGross, collected, collectedGross: collected, collectedNet, cashReceivedGross, receivable, backlog, cashPaid, netProjectCash, atRisk,
      highConfidence, mediumConfidence, lowConfidence, healthScore,
      actualMargin: recognizedRevenue ? actualProfit / recognizedRevenue * 100 : 0,
      forecastMargin: contractValue ? forecastProfit / contractValue * 100 : 0,
      contractCollectionRate: contractValue ? collectedNet / contractValue * 100 : 0,
      invoiceCollectionRate: invoicedGross ? vnd(sum(contractedRows,(x)=>x.allocatedGross)) / invoicedGross * 100 : 0,
      collectionRate: contractValue ? collectedNet / contractValue * 100 : 0,
      budgetVariance: vnd(directBudget - estimateAtCompletion)
    };
  }

  function classifyPurchase(input = {}, settings = {}) {
    const threshold = Math.max(0, vnd(settings.fixedAssetThreshold ?? settings.fixed_asset_threshold ?? 30000000));
    const quantity = Math.max(0, n(input.quantity ?? 1));
    const totalExclVat = vnd(input.totalExclVat ?? input.total_excl_vat ?? quantity * n(input.unitPrice ?? input.unit_price));
    const usefulLifeMonths = Math.max(0, Math.trunc(n(input.usefulLifeMonths ?? input.useful_life_months ?? 1)));
    const category = norm(input.category ?? input.purchaseCategory ?? input.purchase_category);
    const consumable = ['office supplies','office supply','stationery','paper','ink','service','services','consumable'].some((x) => category.includes(x));
    let classification = 'expense';
    let reason = 'Khoản mua dùng hết trong kỳ hoặc là hàng tiêu hao/dịch vụ.';
    if (!consumable && usefulLifeMonths > 12) {
      if (totalExclVat >= threshold) {
        classification = 'fixed_asset';
        reason = `Giá trị ${totalExclVat} đạt ngưỡng TSCĐ ${threshold} và thời gian sử dụng trên 12 tháng.`;
      } else {
        classification = 'tool';
        reason = `Sử dụng trên 12 tháng nhưng giá trị ${totalExclVat} thấp hơn ngưỡng TSCĐ ${threshold}.`;
      }
    }
    return { classification, totalExclVat, usefulLifeMonths, threshold, reason };
  }

  function straightLineSchedule(input = {}) {
    const sourceId = String(input.sourceId ?? input.source_id ?? '').trim();
    const kind = String(input.kind || 'tool').trim() || 'tool';
    const rawMonths = Number(input.months ?? 1);
    if (!sourceId) throw new Error('Thiếu mã nguồn của lịch phân bổ/khấu hao.');
    if (!Number.isInteger(rawMonths) || rawMonths < 1 || rawMonths > 1200) throw new Error('Số tháng phân bổ/khấu hao phải là số nguyên từ 1 đến 1200.');
    const months = rawMonths;
    const rawCost = Number(input.cost);
    const rawResidual = Number(input.residualValue ?? input.residual_value ?? 0);
    if (!Number.isFinite(rawCost) || rawCost < 0) throw new Error('Nguyên giá không hợp lệ.');
    if (!Number.isFinite(rawResidual) || rawResidual < 0 || rawResidual > rawCost) throw new Error('Giá trị thu hồi phải nằm từ 0 đến nguyên giá.');
    const cost = vnd(rawCost), residualValue = vnd(rawResidual), depreciable = Math.max(0, cost - residualValue);
    const rawStart = String(input.startDate ?? input.start_date ?? '').trim();
    const monthMatch = rawStart.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    const validMonth = monthMatch && Number(monthMatch[2]) >= 1 && Number(monthMatch[2]) <= 12;
    const validDate = monthMatch?.[3] ? isISODate(rawStart) : Boolean(validMonth);
    if (!validMonth || !validDate) throw new Error('Ngày bắt đầu phân bổ/khấu hao không hợp lệ.');
    const startYear = Number(monthMatch[1]), startMonth = Number(monthMatch[2]) - 1;
    const base = Math.floor(depreciable / months);
    let allocated = 0;
    return Array.from({ length: months }, (_, index) => {
      const date = new Date(startYear, startMonth + index, 1, 12, 0, 0);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = index === months - 1 ? depreciable - allocated : base;
      allocated += amount;
      return { id: `${kind}-${sourceId}-${period}`, sourceId, kind, period, amount: vnd(amount), status: 'Draft', journalEntryId: '' };
    });
  }

  function purchaseJournalBlueprint(input = {}, settings = {}) {
    const result = classifyPurchase(input, settings);
    const vatRate = boundedRate(input.vatRate ?? input.vat_rate, 0);
    const vat = vnd(result.totalExclVat * vatRate / 100);
    const category = norm(input.category);
    const debitAccount = result.classification === 'fixed_asset'
      ? (category.includes('vehicle') ? '2113' : (input.assetAccountCode || input.asset_account_code || '2112'))
      : result.classification === 'tool'
        ? '242'
        : (input.expenseAccountCode || input.expense_account_code || '6422');
    const payment = norm(input.paymentMethod ?? input.payment_method ?? 'payable');
    const creditAccount = payment.includes('bank') ? '1121' : payment.includes('cash') ? '1111' : '331';
    const projectId = input.projectId ?? input.project_id ?? '';
    const description = `Mua ${String(input.itemName ?? input.item_name ?? 'hàng hóa/tài sản')} • ${result.reason}`;
    const lines = [
      { accountCode: debitAccount, debit: result.totalExclVat, credit: 0, projectId, description },
      ...(vat > 0 ? [{ accountCode: '1331', debit: vat, credit: 0, projectId: '', description: `Thuế GTGT đầu vào • ${description}` }] : []),
      { accountCode: creditAccount, debit: 0, credit: result.totalExclVat + vat, projectId: '', partnerType: creditAccount === '331' ? 'vendor' : '', partnerId: creditAccount === '331' ? (input.vendorId ?? input.vendor_id ?? '') : '', description }
    ];
    return { date: input.invoiceDate ?? input.invoice_date ?? input.orderDate ?? input.order_date ?? localISODate(), documentPrefix: 'AUTO-MUA', description, classification: result.classification, lines };
  }

  function periodicJournalBlueprint(input = {}) {
    const amount = vnd(input.amount);
    if (amount <= 0) throw new Error('Số tiền phân bổ/khấu hao phải lớn hơn 0.');
    const description = String(input.description || 'Phân bổ/khấu hao định kỳ');
    const projectId = input.projectId ?? input.project_id ?? '';
    return {
      date: input.date || localISODate(),
      documentPrefix: 'AUTO-PB',
      description,
      lines: [
        { accountCode: input.expenseAccountCode || input.expense_account_code || '6422', debit: amount, credit: 0, projectId, description },
        { accountCode: input.creditAccountCode || input.credit_account_code || '242', debit: 0, credit: amount, projectId: '', description }
      ]
    };
  }

  function nextDocumentNumber(entries = [], prefix = 'AUTO', dateOrYear = localISODate()) {
    const safePrefix = String(prefix || 'AUTO').trim() || 'AUTO';
    const rawYear = String(dateOrYear ?? '');
    const yearMatch = rawYear.match(/^(\d{4})(?:-|$)/);
    const year = yearMatch ? yearMatch[1] : localISODate().slice(0, 4);
    const escaped = safePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}-${year}-(\\d+)$`, 'i');
    const max = (entries || []).reduce((current, entry) => {
      const match = String(entry.documentNo ?? entry.document_no ?? '').trim().match(pattern);
      if (!match) return current;
      const value = Number(match[1]);
      return Number.isSafeInteger(value) && value > current ? value : current;
    }, 0);
    const next = max + 1;
    if (!Number.isSafeInteger(next)) throw new Error('Dải số chứng từ tự động đã vượt giới hạn an toàn.');
    return `${safePrefix}-${year}-${String(next).padStart(4, '0')}`;
  }

  function scheduleRebuildPlan(db = {}, options = {}) {
    const kind = statusIs(options.kind, 'asset', 'fixedasset', 'fixed_asset') ? 'asset' : 'tool';
    const sourceId = String(options.sourceId ?? options.source_id ?? '').trim();
    const schedules = kind === 'asset' ? (db.depreciationSchedules || []) : (db.toolAllocationSchedules || []);
    const sourceType = kind === 'asset' ? 'asset_depreciation' : 'tool_allocation';
    const rows = schedules.filter((row) => String(row.sourceId ?? row.source_id ?? '') === sourceId);
    const linkedIds = new Set(rows.map((row) => row.journalEntryId ?? row.journal_entry_id).filter(Boolean).map(String));
    const sourcePrefix = `${sourceId}:`;
    const journals = (db.journalEntries || []).filter((entry) =>
      linkedIds.has(String(rowId(entry)))
      || (statusIs(entry.sourceType ?? entry.source_type, sourceType)
        && String(entry.sourceId ?? entry.source_id ?? '').startsWith(sourcePrefix)));
    const protectedRows = rows.filter((row) => statusIs(row.status, 'posted'));
    const protectedJournals = journals.filter((entry) => !statusIs(entry.status, 'draft'));
    const postedJournals = journals.filter((entry) => statusIs(entry.status, 'posted'));
    const allowed = protectedRows.length === 0 && protectedJournals.length === 0;
    const label = kind === 'asset' ? 'khấu hao TSCĐ' : 'phân bổ CCDC';
    const reason = allowed
      ? `Có thể tạo lại lịch ${label}; các chứng từ Draft cũ sẽ được thay thế.`
      : `Không thể tạo lại lịch ${label} vì đã có ${postedJournals.length || protectedJournals.length || protectedRows.length} kỳ/chứng từ được bảo vệ. Hãy lập điều chỉnh hoặc đảo chứng từ thay vì sửa lịch sử.`;
    return {
      allowed, kind, sourceId, rows, journals, protectedRows, protectedJournals, postedJournals, reason,
      draftJournalIds: journals.filter((entry) => statusIs(entry.status, 'draft')).map((entry) => String(rowId(entry)))
    };
  }
  function scheduleJournalMatch(db = {}, row = {}) {
    const journalId = row.journalEntryId ?? row.journal_entry_id ?? '';
    const entry = (db.journalEntries || []).find((candidate) => String(rowId(candidate)) === String(journalId));
    if (!entry || !statusIs(entry.status, 'draft', 'posted')) return false;
    const kind = statusIs(row.kind, 'asset') || statusIs(entry.sourceType ?? entry.source_type, 'asset_depreciation') ? 'asset' : 'tool';
    const expectedType = kind === 'asset' ? 'asset_depreciation' : 'tool_allocation';
    const expectedSource = `${row.sourceId ?? row.source_id}:${row.period}`;
    return statusIs(entry.sourceType ?? entry.source_type, expectedType)
      && String(entry.sourceId ?? entry.source_id ?? '') === String(expectedSource)
      && String(entry.date || '').slice(0, 7) === String(row.period || '')
      && journalTotal(entry, 'debit') === vnd(row.amount)
      && journalTotal(entry, 'credit') === vnd(row.amount);
  }

  function financialAccountNet(db, prefixes = [], asOf = localISODate(), normal = 'Debit', excludePrefixes = []) {
    const rows = accountsByPrefixes(db, prefixes, excludePrefixes);
    return vnd(sum(rows, (account) => {
      const balance = accountEnding(db, account.code, { to: asOf });
      return normal === 'Credit' ? balance.endingCredit - balance.endingDebit : balance.endingDebit - balance.endingCredit;
    }));
  }
  function contractValueOutliers(db, settings = {}) {
    const threshold = Math.max(1, vnd(settings.maxContractValue ?? settings.max_contract_value ?? db?.settings?.maxContractValue ?? 1000000000000));
    return (db.contracts || []).filter((contract) => {
      const raw = contract.valueExclVat ?? contract.value_excl_vat ?? contract.contractValue;
      const value = vnd(raw);
      return value > threshold || value <= 0 || !Number.isFinite(Number(raw));
    }).map((contract) => ({ contract, value: vnd(contract.valueExclVat ?? contract.value_excl_vat ?? contract.contractValue), threshold }));
  }

  function contractRegisterSummary(db, range = {}) {
    const cutoff = isISODate(range.to) ? range.to : localISODate();
    const allCustomerContracts = (db.contracts || []).filter((contract) => statusIs(contract.contractType ?? contract.contract_type ?? 'customer', 'customer'));
    const outliers = contractValueOutliers(db);
    const outlierIds = new Set(outliers.map((x) => String(rowId(x.contract))));
    const includedContracts = allCustomerContracts.filter((contract) => {
      if (!contractIsCommitted(contract) || outlierIds.has(String(rowId(contract)))) return false;
      const effective = contract.effectiveDate ?? contract.effective_date ?? contract.signedDate ?? contract.signed_date ?? '';
      return !isISODate(effective) || effective <= cutoff;
    });
    const contractIds = new Set(includedContracts.map((x) => String(rowId(x))));
    const projectIds = new Set(includedContracts.map((x) => String(x.projectId ?? x.project_id ?? '')).filter(Boolean));
    const invoices = (db.taxInvoices || []).filter((invoice) => {
      if (!activeInvoice(invoice) || !statusIs(invoice.direction, 'output')) return false;
      if (isISODate(invoice.date) && invoice.date > cutoff) return false;
      const contractId = String(invoice.contractId ?? invoice.contract_id ?? '');
      if (contractId) return contractIds.has(contractId);
      const projectId = String(invoice.projectId ?? invoice.project_id ?? '');
      return projectId && projectIds.has(projectId);
    });
    const contractValue = vnd(sum(includedContracts, (x) => x.valueExclVat ?? x.value_excl_vat ?? x.contractValue));
    const invoicedNet = vnd(sum(invoices, invoiceBase));
    const invoicedGross = vnd(sum(invoices, invoiceTotal));
    const allocatedGross = vnd(sum(invoices, (invoice) => invoiceAllocatedAmount(db, invoice, { asOf: cutoff })));
    const outstandingGross = Math.max(0, vnd(invoicedGross - allocatedGross));
    const backlogNet = Math.max(0, vnd(contractValue - invoicedNet));
    return { cutoff, allCustomerContracts, includedContracts, invoices, contractValue, invoicedNet, invoicedGross, allocatedGross, outstandingGross, backlogNet, outliers };
  }

  function contractDeletionPlan(db, contractId) {
    const contract = (db.contracts || []).find((x) => String(rowId(x)) === String(contractId));
    if (!contract) return { allowed: false, mode: 'missing', reason: 'Hợp đồng không tồn tại.', linked: {} };
    const milestones = (db.billingMilestones || db.contractMilestones || []).filter((x) => String(x.contractId ?? x.contract_id ?? '') === String(contractId));
    const invoices = (db.taxInvoices || []).filter((x) => String(x.contractId ?? x.contract_id ?? '') === String(contractId) && activeInvoice(x));
    const invoiceIds = new Set(invoices.map((x) => String(rowId(x))));
    const allocations = (db.paymentAllocations || []).filter((x) => invoiceIds.has(String(x.invoiceId ?? x.invoice_id ?? '')) && !statusIs(x.status, 'cancelled', 'deleted', 'void'));
    const finance = (db.finance || []).filter((x) => String(x.contractId ?? x.contract_id ?? '') === String(contractId) && financePaid(x));
    const journals = (db.journalEntries || []).filter((entry) => statusIs(entry.status, 'posted') && (String(entry.contractId ?? entry.contract_id ?? '') === String(contractId) || (entry.lines || []).some((line) => String(line.contractId ?? line.contract_id ?? '') === String(contractId))));
    const unsafeMilestones = milestones.filter((x) => !statusIs(x.status, 'draft', 'cancelled', 'canceled', '') || !statusIs(x.acceptanceStatus, 'not started', 'pending', '') || !statusIs(x.invoiceStatus, 'not invoiced', 'cancelled', '') || !statusIs(x.paymentStatus, 'unpaid', 'cancelled', ''));
    const protectedCount = invoices.length + allocations.length + finance.length + journals.length + unsafeMilestones.length;
    if (protectedCount) return { allowed: false, mode: 'cancel', reason: 'Hợp đồng đã phát sinh hóa đơn, thu tiền, chứng từ ghi sổ hoặc mốc nghiệp vụ; không được xóa vật lý.', linked: { milestones, invoices, allocations, finance, journals, unsafeMilestones } };
    return { allowed: true, mode: 'hard-delete', reason: 'Hợp đồng chưa phát sinh nghiệp vụ; có thể xóa cùng các mốc nháp.', linked: { milestones, invoices, allocations, finance, journals, unsafeMilestones } };
  }

  function entityDeletionPlan(db = {}, collection = '', recordId = '') {
    const id = String(recordId || '');
    const rows = Array.isArray(db[collection]) ? db[collection] : [];
    const target = rows.find((row) => String(rowId(row)) === id);
    if (!target) return { allowed: false, mode: 'missing', reason: 'Bản ghi không tồn tại.', dependencies: [] };
    const dependencies = [];
    const add = (name, predicate) => (db[name] || []).forEach((row) => {
      if (predicate(row)) dependencies.push({ collection: name, id: String(rowId(row) || '') });
    });
    const value = (row, ...keys) => {
      for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]) !== '') return String(row[key]);
      return '';
    };
    const linked = (row, keys) => keys.some((key) => value(row, key) === id);
    const partyLinked = (row, partyType) => statusIs(value(row, 'partnerType', 'partner_type'), partyType)
      && value(row, 'partnerId', 'partner_id') === id;
    const journalPartyOrProject = (entry, field = 'project') => {
      if (field === 'project') return value(entry, 'projectId', 'project_id') === id || (entry.lines || []).some((line) => value(line, 'projectId', 'project_id') === id);
      return partyLinked(entry, field) || (entry.lines || []).some((line) => partyLinked(line, field));
    };

    if (collection === 'projects') {
      ['tasks','timesheets','finance','quotes','approvals','documents','contracts','taxInvoices','billingMilestones','projectBudgetVersions','resourcePlans','commitments','projectStages','purchaseRequests','purchaseOrders','tools','fixedAssets','citAdjustments'].forEach((name) => add(name, (row) => linked(row, ['projectId','project_id'])));
      add('journalEntries', (entry) => journalPartyOrProject(entry, 'project'));
    } else if (collection === 'people') {
      add('projects', (row) => linked(row, ['pmId','pm_id']));
      add('tasks', (row) => linked(row, ['assigneeId','assignee_id']));
      add('timesheets', (row) => linked(row, ['personId','person_id']));
      add('approvals', (row) => linked(row, ['requesterId','requester_id']));
      add('documents', (row) => linked(row, ['ownerId','owner_id']));
      add('contracts', (row) => linked(row, ['ownerId','owner_id']));
      add('resourcePlans', (row) => linked(row, ['personId','person_id']));
      add('purchaseRequests', (row) => linked(row, ['requesterId','requester_id']));
      ['purchaseOrders','tools','fixedAssets'].forEach((name) => add(name, (row) => linked(row, ['custodianId','custodian_id'])));
      add('pitWithholdings', (row) => statusIs(value(row, 'recipientType','recipient_type'), 'person','employee') && linked(row, ['recipientId','recipient_id']));
      add('journalEntries', (entry) => journalPartyOrProject(entry, 'person') || journalPartyOrProject(entry, 'employee'));
    } else if (collection === 'clients') {
      ['projects','quotes','contracts'].forEach((name) => add(name, (row) => linked(row, ['clientId','client_id'])));
      add('taxInvoices', (row) => partyLinked(row, 'client'));
      add('journalEntries', (entry) => journalPartyOrProject(entry, 'client'));
    } else if (collection === 'vendors') {
      add('purchaseOrders', (row) => linked(row, ['vendorId','vendor_id']));
      add('finance', (row) => linked(row, ['vendorId','vendor_id']) || partyLinked(row, 'vendor'));
      add('pitWithholdings', (row) => statusIs(value(row, 'recipientType','recipient_type'), 'vendor') && linked(row, ['recipientId','recipient_id']));
      add('taxInvoices', (row) => partyLinked(row, 'vendor'));
      add('journalEntries', (entry) => journalPartyOrProject(entry, 'vendor'));
    } else if (collection === 'contracts') {
      ['taxInvoices','billingMilestones'].forEach((name) => add(name, (row) => linked(row, ['contractId','contract_id'])));
    } else if (collection === 'taxInvoices') {
      add('billingMilestones', (row) => linked(row, ['invoiceId','invoice_id']));
      add('paymentAllocations', (row) => linked(row, ['invoiceId','invoice_id']));
      add('finance', (row) => linked(row, ['invoiceId','invoice_id','taxInvoiceId','tax_invoice_id']));
    } else if (collection === 'finance') {
      add('paymentAllocations', (row) => linked(row, ['paymentId','payment_id']));
    } else if (collection === 'journalEntries') {
      ['finance','taxInvoices','pitWithholdings','purchaseOrders'].forEach((name) => add(name, (row) => linked(row, ['journalEntryId','journal_entry_id','postingId','posting_id'])));
      ['toolAllocationSchedules','depreciationSchedules'].forEach((name) => add(name, (row) => linked(row, ['journalEntryId','journal_entry_id'])));
      if (statusIs(target.status, 'posted')) dependencies.push({ collection: 'journalEntries', id, reason: 'posted' });
    } else if (collection === 'projectBudgetVersions') {
      add('projectBudgetLines', (row) => linked(row, ['budgetVersionId','budget_version_id']));
    } else if (collection === 'purchaseRequests') {
      add('purchaseOrders', (row) => linked(row, ['purchaseRequestId','purchase_request_id']));
    } else if (collection === 'purchaseOrders') {
      ['tools','fixedAssets'].forEach((name) => add(name, (row) => linked(row, ['purchaseOrderId','purchase_order_id'])));
      if (value(target, 'journalEntryId','journal_entry_id','toolId','tool_id','fixedAssetId','fixed_asset_id')) dependencies.push({ collection: 'purchaseOrders', id, reason: 'recognized' });
    } else if (collection === 'tools') {
      add('toolAllocationSchedules', (row) => linked(row, ['sourceId','source_id']));
    } else if (collection === 'fixedAssets') {
      add('depreciationSchedules', (row) => linked(row, ['sourceId','source_id']));
    } else if (collection === 'accounts') {
      const code = String(target.code || '');
      add('journalEntries', (entry) => (entry.lines || []).some((line) => String(line.accountCode ?? line.account_code ?? '') === code));
      add('openingBalances', (row) => String(row.accountCode ?? row.account_code ?? '') === code);
      ['tools','fixedAssets'].forEach((name) => add(name, (row) => [
        row.expenseAccountCode ?? row.expense_account_code,
        row.assetAccountCode ?? row.asset_account_code,
        row.depreciationAccountCode ?? row.depreciation_account_code
      ].some((accountCode) => String(accountCode || '') === code)));
    }
    const labels = {
      projects:'Dự án', people:'Nhân sự', clients:'Khách hàng', vendors:'Nhà cung cấp', contracts:'Hợp đồng',
      taxInvoices:'Hóa đơn', finance:'Khoản thu/chi', journalEntries:'Chứng từ', projectBudgetVersions:'Phiên bản ngân sách',
      purchaseRequests:'Đề nghị mua', purchaseOrders:'Đơn mua', tools:'CCDC', fixedAssets:'TSCĐ', accounts:'Tài khoản'
    };
    return dependencies.length
      ? { allowed: false, mode: 'protect', reason: `${labels[collection] || 'Bản ghi'} đang được ${dependencies.length} bản ghi nghiệp vụ tham chiếu; hãy chuyển trạng thái hoặc lập nghiệp vụ điều chỉnh thay vì xóa.`, dependencies }
      : { allowed: true, mode: 'hard-delete', reason: 'Không có dữ liệu phụ thuộc; có thể xóa bản ghi.', dependencies };
  }

  function financialPosition(db, asOfDate = localISODate()) {
    const asOf = isISODate(asOfDate) ? asOfDate : localISODate();
    const reportClass = (account = {}) => String(account.reportClass ?? account.report_class ?? account.balanceSheetClass ?? account.balance_sheet_class ?? '').trim().toLowerCase();
    const prepaidAccounts = accountsByPrefixes(db, ['242']);
    const prepaidCurrent = vnd(sum(prepaidAccounts.filter((account) => reportClass(account) === 'current_other_asset'), (account) => accountEnding(db, account.code, { to:asOf }).endingDebit));
    const prepaidLongTerm = vnd(sum(prepaidAccounts.filter((account) => reportClass(account) !== 'current_other_asset'), (account) => accountEnding(db, account.code, { to:asOf }).endingDebit));
    const prepaid = vnd(prepaidCurrent + prepaidLongTerm);
    const cash = financialAccountNet(db, ['111','112'], asOf, 'Debit');
    const shortTermInvestments = financialAccountNet(db, ['121','128'], asOf, 'Debit');
    const receivables = financialAccountNet(db, ['131','136','138','141'], asOf, 'Debit');
    const inventoryAndWip = financialAccountNet(db, ['151','152','153','154','155','156','157'], asOf, 'Debit');
    const taxCredits = financialAccountNet(db, ['133'], asOf, 'Debit');
    const currentAssets = vnd(cash + shortTermInvestments + receivables + inventoryAndWip + taxCredits + prepaidCurrent);
    const fixedAssetGross = financialAccountNet(db, ['211','213','217'], asOf, 'Debit');
    const accumulatedDepreciation = financialAccountNet(db, ['214'], asOf, 'Credit');
    const constructionInProgress = financialAccountNet(db, ['241'], asOf, 'Debit');
    const otherLongTermAssets = financialAccountNet(db, ['221','222','228','244'], asOf, 'Debit');
    const fixedAssetsNet = vnd(fixedAssetGross - accumulatedDepreciation);
    const longTermAssets = vnd(fixedAssetsNet + constructionInProgress + otherLongTermAssets + prepaidLongTerm);
    const assetAccounts = (db.accounts || []).filter((a) => a.type === 'Asset');
    const totalAssets = vnd(sum(assetAccounts, (a) => {
      const b = accountEnding(db, a.code, { to: asOf });
      return b.endingDebit - b.endingCredit;
    }));
    const currentLiabilities = financialAccountNet(db, ['311','331','333','334','335','336','338'], asOf, 'Credit');
    const borrowings = financialAccountNet(db, ['341'], asOf, 'Credit');
    const otherLongTermLiabilities = financialAccountNet(db, ['342','343','344','347','352'], asOf, 'Credit');
    const longTermLiabilities = vnd(borrowings + otherLongTermLiabilities);
    const liabilityAccounts = (db.accounts || []).filter((a) => a.type === 'Liability');
    const totalLiabilities = vnd(sum(liabilityAccounts, (a) => {
      const b = accountEnding(db, a.code, { to: asOf });
      return b.endingCredit - b.endingDebit;
    }));
    const equityAccounts = (db.accounts || []).filter((a) => a.type === 'Equity');
    const equityLedger = vnd(sum(equityAccounts, (a) => {
      const b = accountEnding(db, a.code, { to: asOf });
      return b.endingCredit - b.endingDebit;
    }));
    const fiscalStart = fiscalYearStartFor(db, asOf);
    const yearProfit = profitAndLoss(db, { from: fiscalStart, to: asOf }).profitAfterTax;
    const rawGap = vnd(totalAssets - totalLiabilities - equityLedger);
    const unclosedResult = Math.abs(rawGap - yearProfit) <= 2 ? yearProfit : 0;
    const totalEquity = vnd(equityLedger + unclosedResult);
    const balanceGap = vnd(totalAssets - totalLiabilities - totalEquity);
    const workingCapital = vnd(currentAssets - currentLiabilities);
    return {
      asOf, cash, shortTermInvestments, receivables, inventoryAndWip, taxCredits, prepaid, prepaidCurrent, prepaidLongTerm,
      currentAssets, fixedAssetGross, accumulatedDepreciation, fixedAssetsNet, constructionInProgress,
      longTermAssets, totalAssets, currentLiabilities, borrowings, unclassifiedBorrowings: borrowings, longTermLiabilities, totalLiabilities,
      equityLedger, unclosedResult, totalEquity, workingCapital, balanceGap,
      balanced: Math.abs(balanceGap) <= 2
    };
  }
  const safeDivide = (numerator, denominator, multiplier = 1) => Math.abs(n(denominator)) > 1e-9 ? n(numerator) / n(denominator) * multiplier : null;
  function financialRatioAssessment(id, value, settings = {}) {
    if (value === null || !Number.isFinite(Number(value))) return 'na';
    const v = Number(value);
    const grossTarget = Math.max(1, n(settings.targetGrossMargin ?? settings.targetMargin ?? 30));
    const netTarget = Math.max(1, n(settings.targetNetMargin ?? 12));
    if (id === 'currentRatio') return v >= 1.5 ? 'good' : v >= 1 ? 'watch' : 'risk';
    if (id === 'quickRatio') return v >= 1 ? 'good' : v >= 0.7 ? 'watch' : 'risk';
    if (id === 'cashRatio') return v >= 0.5 ? 'good' : v >= 0.2 ? 'watch' : 'risk';
    if (id === 'debtToAssets') return v <= 50 ? 'good' : v <= 70 ? 'watch' : 'risk';
    if (id === 'debtToEquity') return v <= 100 ? 'good' : v <= 200 ? 'watch' : 'risk';
    if (id === 'equityToAssets') return v >= 50 ? 'good' : v >= 30 ? 'watch' : 'risk';
    if (id === 'financialLeverage') return v <= 2 ? 'good' : v <= 3.5 ? 'watch' : 'risk';
    if (id === 'interestCoverage') return v >= 3 ? 'good' : v >= 1.5 ? 'watch' : 'risk';
    if (id === 'dso') return v <= 45 ? 'good' : v <= 75 ? 'watch' : 'risk';
    if (id === 'dpo') return v >= 20 && v <= 75 ? 'good' : v >= 10 && v <= 100 ? 'watch' : 'risk';
    if (id === 'cashConversionCycle') return v <= 45 ? 'good' : v <= 90 ? 'watch' : 'risk';
    if (id === 'grossMargin') return v >= grossTarget ? 'good' : v >= grossTarget * 0.65 ? 'watch' : 'risk';
    if (id === 'netMargin') return v >= netTarget ? 'good' : v >= netTarget * 0.5 ? 'watch' : 'risk';
    if (id === 'ebitdaMargin') return v >= netTarget + 5 ? 'good' : v >= netTarget ? 'watch' : 'risk';
    if (id === 'roa') return v >= 8 ? 'good' : v >= 3 ? 'watch' : 'risk';
    if (id === 'roe') return v >= 15 ? 'good' : v >= 7 ? 'watch' : 'risk';
    if (id === 'operatingCashRatio') return v >= 1 ? 'good' : v >= 0.5 ? 'watch' : 'risk';
    return 'neutral';
  }
  function priorYearISO(value) {
    if (!isISODate(value)) return '';
    const [year, month, day] = value.split('-').map(Number);
    const candidate = new Date(Date.UTC(year - 1, month - 1, day));
    if (candidate.getUTCMonth() !== month - 1) candidate.setUTCDate(0);
    return `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, '0')}-${String(candidate.getUTCDate()).padStart(2, '0')}`;
  }
  const growthPercent = (current, prior) => Math.abs(n(prior)) > 1e-9 ? (n(current) - n(prior)) / Math.abs(n(prior)) * 100 : null;
  function nonCashDepreciationAndAllocation(db, range = {}) {
    return vnd(sum(postedEntries(db, range).filter((entry) => statusIs(entry.sourceType, 'asset_depreciation', 'tool_allocation', 'prepaid_allocation', 'depreciation', 'amortization')), (entry) =>
      sum(entry.lines || [], (line) => /^(214|242)/.test(String(line.accountCode || '')) ? vnd(line.credit) - vnd(line.debit) : 0)
    ));
  }
  function financialRatios(db, range = {}) {
    const to = isISODate(range.to) ? range.to : localISODate();
    const from = isISODate(range.from) ? range.from : fiscalYearStartFor(db, to);
    const end = financialPosition(db, to);
    // Opening balance includes balances effective on the first day of the period,
    // but excludes journal entries dated on that first day.
    const openingDb = {...db, journalEntries:(db.journalEntries||[]).filter((entry)=>entry.date<from)};
    const opening = financialPosition(openingDb, from);
    const pnl = profitAndLoss(db, { from, to });
    const days = Math.max(1, rangeDays({ from, to }));
    const cogsMovement = movementNetByPrefixes(db, ['632'], { from, to }, 'Debit');
    const interestExpense = movementNetByPrefixes(db, ['635'], { from, to }, 'Debit');
    const depreciation = Math.max(0, nonCashDepreciationAndAllocation(db, { from, to }));
    const b03 = tt133B03Direct(db, { from, to });
    const operatingCash = vnd(b03.rows.find((row) => row.code === '20')?.value || 0);
    const avg = (a, b) => (n(a) + n(b)) / 2;
    const averageAssets = avg(opening.totalAssets, end.totalAssets);
    const averageEquity = avg(opening.totalEquity, end.totalEquity);
    const averageReceivables = avg(opening.receivables, end.receivables);
    const openingPayables = financialAccountNet(openingDb, ['331'], from, 'Credit');
    const endingPayables = financialAccountNet(db, ['331'], end.asOf, 'Credit');
    const averagePayables = avg(openingPayables, endingPayables);
    const averageInventory = avg(opening.inventoryAndWip, end.inventoryAndWip);
    const averageWorkingCapital = avg(opening.workingCapital, end.workingCapital);
    const grossProfit = vnd(pnl.revenue - cogsMovement);
    const ebit = vnd(pnl.profitBeforeTax + interestExpense);
    const ebitda = vnd(ebit + depreciation);
    const dso = safeDivide(averageReceivables, pnl.revenue, days);
    const dpo = safeDivide(averagePayables, cogsMovement || pnl.expenseBeforeTax, days);
    const dio = safeDivide(averageInventory, cogsMovement, days);
    const cashConversionCycle = dso === null || dpo === null ? null : dso + (dio || 0) - dpo;
    const metrics = [
      {id:'currentRatio',group:'Thanh khoản',label:'Hệ số thanh toán hiện hành',value:safeDivide(end.currentAssets,end.currentLiabilities),unit:'lần',formula:'Tài sản ngắn hạn / Nợ ngắn hạn'},
      {id:'quickRatio',group:'Thanh khoản',label:'Hệ số thanh toán nhanh',value:safeDivide(end.cash+end.shortTermInvestments+end.receivables,end.currentLiabilities),unit:'lần',formula:'(Tiền + Đầu tư NH + Phải thu) / Nợ ngắn hạn'},
      {id:'cashRatio',group:'Thanh khoản',label:'Hệ số thanh toán bằng tiền',value:safeDivide(end.cash,end.currentLiabilities),unit:'lần',formula:'Tiền và tương đương tiền / Nợ ngắn hạn'},
      {id:'debtToAssets',group:'Đòn bẩy',label:'Nợ phải trả / Tổng tài sản',value:safeDivide(end.totalLiabilities,end.totalAssets,100),unit:'%',formula:'Tổng nợ phải trả / Tổng tài sản'},
      {id:'debtToEquity',group:'Đòn bẩy',label:'Nợ phải trả / Vốn chủ sở hữu',value:safeDivide(end.totalLiabilities,end.totalEquity,100),unit:'%',formula:'Tổng nợ phải trả / Vốn chủ sở hữu'},
      {id:'equityToAssets',group:'Đòn bẩy',label:'Hệ số tự tài trợ',value:safeDivide(end.totalEquity,end.totalAssets,100),unit:'%',formula:'Vốn chủ sở hữu / Tổng tài sản'},
      {id:'financialLeverage',group:'Đòn bẩy',label:'Đòn bẩy tài chính',value:safeDivide(end.totalAssets,end.totalEquity),unit:'lần',formula:'Tổng tài sản / Vốn chủ sở hữu'},
      {id:'interestCoverage',group:'Đòn bẩy',label:'Khả năng thanh toán lãi vay',value:interestExpense>0?safeDivide(ebit,interestExpense):null,unit:'lần',formula:'EBIT / Chi phí lãi vay'},
      {id:'assetTurnover',group:'Hiệu suất',label:'Vòng quay tổng tài sản',value:safeDivide(pnl.revenue,averageAssets),unit:'vòng',formula:'Doanh thu thuần / Tổng tài sản bình quân'},
      {id:'receivableTurnover',group:'Hiệu suất',label:'Vòng quay phải thu',value:safeDivide(pnl.revenue,averageReceivables),unit:'vòng',formula:'Doanh thu thuần / Phải thu bình quân'},
      {id:'dso',group:'Hiệu suất',label:'Kỳ thu tiền bình quân (DSO)',value:dso,unit:'ngày',formula:'Phải thu bình quân / Doanh thu × Số ngày'},
      {id:'payableTurnover',group:'Hiệu suất',label:'Vòng quay phải trả',value:safeDivide(cogsMovement||pnl.expenseBeforeTax,averagePayables),unit:'vòng',formula:'Chi phí mua/giá vốn / Phải trả bình quân'},
      {id:'dpo',group:'Hiệu suất',label:'Kỳ trả tiền bình quân (DPO)',value:dpo,unit:'ngày',formula:'Phải trả bình quân / Chi phí mua × Số ngày'},
      {id:'inventoryTurnover',group:'Hiệu suất',label:'Vòng quay tồn kho & WIP',value:safeDivide(cogsMovement,averageInventory),unit:'vòng',formula:'Giá vốn / Tồn kho và WIP bình quân'},
      {id:'dio',group:'Hiệu suất',label:'Số ngày tồn kho & WIP (DIO)',value:dio,unit:'ngày',formula:'Tồn kho và WIP bình quân / Giá vốn × Số ngày'},
      {id:'cashConversionCycle',group:'Hiệu suất',label:'Chu kỳ chuyển đổi tiền (CCC)',value:cashConversionCycle,unit:'ngày',formula:'DSO + DIO − DPO'},
      {id:'workingCapitalTurnover',group:'Hiệu suất',label:'Vòng quay vốn lưu động',value:safeDivide(pnl.revenue,averageWorkingCapital),unit:'vòng',formula:'Doanh thu / Vốn lưu động bình quân'},
      {id:'grossMargin',group:'Sinh lời',label:'Biên lợi nhuận gộp',value:safeDivide(grossProfit,pnl.revenue,100),unit:'%',formula:'(Doanh thu − Giá vốn) / Doanh thu'},
      {id:'ebitdaMargin',group:'Sinh lời',label:'Biên EBITDA',value:safeDivide(ebitda,pnl.revenue,100),unit:'%',formula:'EBITDA / Doanh thu'},
      {id:'netMargin',group:'Sinh lời',label:'ROS – LNST / Doanh thu',value:safeDivide(pnl.profitAfterTax,pnl.revenue,100),unit:'%',formula:'Lợi nhuận sau thuế / Doanh thu thuần'},
      {id:'roa',group:'Sinh lời',label:'ROA – LNST / Tài sản bình quân',value:safeDivide(pnl.profitAfterTax,averageAssets,100),unit:'%',formula:'Lợi nhuận sau thuế / Tổng tài sản bình quân'},
      {id:'roe',group:'Sinh lời',label:'ROE – LNST / VCSH bình quân',value:safeDivide(pnl.profitAfterTax,averageEquity,100),unit:'%',formula:'Lợi nhuận sau thuế / VCSH bình quân'},
      {id:'operatingCashRatio',group:'Dòng tiền',label:'Khả năng trả nợ bằng dòng tiền HĐKD',value:safeDivide(operatingCash,end.currentLiabilities),unit:'lần',formula:'Lưu chuyển tiền thuần HĐKD / Nợ ngắn hạn'}
    ].map((x)=>({...x,assessment:financialRatioAssessment(x.id,x.value,db.settings||{})}));
    const priorRange = { from: priorYearISO(from), to: priorYearISO(to) };
    const priorPnl = priorRange.from && priorRange.to ? profitAndLoss(db, priorRange) : { revenue:0, profitAfterTax:0, profitBeforeTax:0 };
    const priorPosition = priorRange.to ? financialPosition(db, priorRange.to) : financialPosition(db, previousDate(from));
    const comparison = {
      priorRange,
      revenueGrowth: growthPercent(pnl.revenue, priorPnl.revenue),
      profitGrowth: growthPercent(pnl.profitAfterTax, priorPnl.profitAfterTax),
      assetGrowth: growthPercent(end.totalAssets, priorPosition.totalAssets),
      equityGrowth: growthPercent(end.totalEquity, priorPosition.totalEquity),
      cashGrowth: growthPercent(end.cash, priorPosition.cash),
      currentAssetShare: safeDivide(end.currentAssets,end.totalAssets,100),
      longTermAssetShare: safeDivide(end.longTermAssets,end.totalAssets,100),
      liabilityShare: safeDivide(end.totalLiabilities,end.totalAssets,100),
      equityShare: safeDivide(end.totalEquity,end.totalAssets,100),
      currentRevenue:pnl.revenue, priorRevenue:priorPnl.revenue,
      currentProfit:pnl.profitAfterTax, priorProfit:priorPnl.profitAfterTax
    };
    const quality = cashFlowForecastQuality(db,{from,to,deepIntegrity:false});
    return {from,to,opening,end,pnl,days,cogs:cogsMovement,interestExpense,depreciation,operatingCash,grossProfit,ebit,ebitda,metrics,comparison,quality};
  }
  function cashFlowForecastQuality(db, range = {}) {
    const checks = [];
    const add=(label,pass,weight,detail)=>checks.push({label,pass,weight,detail});
    const committed=(db.contracts||[]).filter(contractIsCommitted);
    const milestones=db.billingMilestones||db.contractMilestones||[];
    add('Hợp đồng có lịch thanh toán', committed.length===0 || committed.every((c)=>milestones.some((m)=>(m.contractId??m.contract_id)===c.id&&!statusIs(m.status,'cancelled'))),15,`${committed.filter((c)=>milestones.some((m)=>(m.contractId??m.contract_id)===c.id&&!statusIs(m.status,'cancelled'))).length}/${committed.length}`);
    const invoices=(db.taxInvoices||[]).filter((x)=>activeInvoice(x)&&statusIs(x.direction,'Output'));
    add('Hóa đơn có hạn thanh toán', invoices.length===0 || invoices.every((x)=>isISODate(x.dueDate??x.due_date)),10,`${invoices.filter((x)=>isISODate(x.dueDate??x.due_date)).length}/${invoices.length}`);
    const activeProjects=(db.projects||[]).filter((p)=>projectLifecycle(p)==='active');
    add('Dự án có budget Approved', activeProjects.length===0 || activeProjects.every((p)=>approvedBudget(db,p.id,{to:range.to}).version),15,`${activeProjects.filter((p)=>approvedBudget(db,p.id,{to:range.to}).version).length}/${activeProjects.length}`);
    const pnl=profitAndLoss(db,range),cogs=movementNetByPrefixes(db,['632'],range,'Debit');
    const costClassificationOk=pnl.revenue===0 || cogs>0 || pnl.expenseBeforeTax===0;
    add('Doanh thu đã kết chuyển giá vốn',costClassificationOk,10,costClassificationOk?`Giá vốn ${vnd(cogs)} VND`:'Có doanh thu nhưng TK 632 chưa có phát sinh; biên gộp có thể bị thổi phồng.');
    add('Sổ kế toán cân',trialBalance(db,range).balanced,20,'Trial balance');
    const position=financialPosition(db,range.to||localISODate());
    add('Khoản vay đã phân loại kỳ hạn',position.unclassifiedBorrowings===0,5,position.unclassifiedBorrowings===0?'Không có số dư TK 341 chưa phân loại.':`TK 341 còn ${vnd(position.unclassifiedBorrowings)} VND chưa có lịch đáo hạn; hệ số thanh khoản có thể bị cao hơn thực tế.`);
    const linkAudit=financialLinkAudit(db,range);
    add('Liên kết dữ liệu trọng yếu',linkAudit.passCritical,20,`${linkAudit.score}/100 linkage`);
    const deepIntegrity = range.deepIntegrity !== false;
    if (deepIntegrity) {
      const integrity=integrityChecks(db,range);
      add('Kiểm tra dữ liệu tổng thể',integrity.passCritical,10,`${integrity.score}% integrity`);
    } else {
      const linkIssues=dataLinkAudit(db);
      add('Kiểm tra liên kết nhanh',linkIssues.length===0,10,linkIssues.length?`${linkIssues.length} lỗi liên kết`:'Không phát hiện lỗi liên kết dữ liệu.');
    }
    const total=sum(checks,(x)=>x.weight),score=Math.round(sum(checks,(x)=>x.pass?x.weight:0)/Math.max(1,total)*100);
    return {score,confidence:score>=85?'High':score>=65?'Medium':'Low',checks,mode:deepIntegrity?'deep':'dashboard'};
  }
  function addMonthsKey(key, offset) {
    const match=String(key||'').match(/^(\d{4})-(\d{2})$/); if(!match)return '';
    const d=new Date(Number(match[1]),Number(match[2])-1+Number(offset||0),1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function financialForecast(db, options = {}) {
    const asOf=isISODate(options.asOf)?options.asOf:localISODate();
    const months=Math.max(3,Math.min(36,Math.round(n(options.months)||12)));
    const scenario=options.scenario||{};
    const startKey=addMonthsKey(monthOf(asOf),1);
    const keys=Array.from({length:months},(_,i)=>addMonthsKey(startKey,i));
    const labels=keys.map((x)=>`T${x.slice(5)}/${x.slice(2,4)}`);
    const position=financialPosition(db,asOf);
    const recentFrom=addMonthsISO(asOf,-5);
    const history=monthlySeries(db,{from:recentFrom,to:asOf});
    const positiveRevenue=history.revenue.filter((x)=>x>0);
    const recentRevenueAvg=positiveRevenue.length?sum(positiveRevenue)/positiveRevenue.length*1e6:0;
    const recurringShare=Math.max(0,Math.min(1,n(scenario.recurringRevenueShare??0.05)));
    const monthlyGrowth=n(scenario.monthlyRevenueGrowthPercent??0)/100;
    const collectionRate=Math.max(0,Math.min(1,n(scenario.collectionRatePercent??90)/100));
    // The ratio covers project delivery costs outside fixed payroll (CTV, subcontractors, printing, travel, etc.).
    // Fixed payroll is forecast separately to prevent double counting.
    const directCostRatio=Math.max(0,Math.min(1,n(scenario.nonPayrollDirectCostRatioPercent??scenario.directCostRatioPercent??18)/100));
    const pipelineFactor=Math.max(0,Math.min(1.5,n(scenario.pipelineFactorPercent??100)/100));
    const payrollGrowth=n(scenario.payrollGrowthPercent??0)/100;
    const overheadGrowth=n(scenario.overheadGrowthPercent??0)/100;
    const taxRate=Math.max(0,Math.min(1,n(scenario.taxRatePercent??db.settings?.corporateTaxRate??db.settings?.corporate_tax_rate??20)/100));
    const minCashBuffer=Math.max(0,vnd(scenario.minimumCashBuffer??db.settings?.minimumCashBuffer??db.settings?.minimum_cash_buffer??150000000));
    const activeRows=(db.projects||[]).map((project)=>({project,...projectFinancials(db,project.id,{to:asOf})})).filter((x)=>x.lifecycle!=='pipeline'&&x.lifecycle!=='excluded'&&x.contractValue>0);
    const backlogRevenue=Array(months).fill(0);
    activeRows.forEach((row)=>{
      const remaining=Math.max(0,vnd(row.contractValue-row.recognizedRevenue)); if(!remaining)return;
      const projectEndDate = row.project.endDate ?? row.project.end_date;
      const endKey=isISODate(projectEndDate)?monthOf(projectEndDate):addMonthsKey(startKey,5);
      const found=keys.findIndex((k)=>k>=endKey);
      const last=endKey<startKey?0:(found<0?months-1:found);
      const count=Math.max(1,last+1),allocation=distributeVnd(remaining,count);
      for(let i=0;i<count;i++)backlogRevenue[i]+=allocation[i];
    });
    const pipelineRevenue=Array(months).fill(0);
    (db.quotes||[]).filter((q)=>!statusIs(q.status,'rejected','lost','cancelled')).forEach((q)=>{
      const quoted=Math.max(0,n(q.amount??q.value??q.totalAmount??q.total_amount));
      const weighted=vnd(quoted*Math.max(0,Math.min(100,n(q.probability)))/100*pipelineFactor);
      const lag=Math.max(0,Math.round(n(scenario.pipelineLagMonths??2))),duration=Math.max(1,Math.round(n(scenario.pipelineDeliveryMonths??4)));
      const activeDuration=Math.max(0,Math.min(months,lag+duration)-lag),allocation=activeDuration?distributeVnd(weighted,activeDuration):[];
      for(let i=lag;i<Math.min(months,lag+duration);i++)pipelineRevenue[i]+=allocation[i-lag];
    });
    const recurringRevenue=keys.map((_,i)=>vnd(recentRevenueAvg*recurringShare*Math.pow(1+monthlyGrowth,i+1)));
    const revenue=keys.map((_,i)=>vnd(backlogRevenue[i]+pipelineRevenue[i]+recurringRevenue[i]));

    const burdenRate=Math.max(0,n(db.settings?.employerBurdenRate??db.settings?.employer_burden_rate))/100;
    const payrollBase=vnd(sum((db.people||[]).filter((p)=>!statusIs(p.type,'CTV')&&!statusIs(p.status,'inactive','terminated','resigned')),(p)=>n(p.monthlySalary??p.monthly_salary)*(1+burdenRate)));
    const overheadBase=Math.max(0,vnd(db.settings?.overheadMonthly??db.settings?.overhead_monthly));
    const payrollCost=keys.map((_,i)=>vnd(payrollBase*Math.pow(1+payrollGrowth,i/12)));
    const overheadCost=keys.map((_,i)=>vnd(overheadBase*Math.pow(1+overheadGrowth,i/12)));
    const nonCashByMonth=new Map();
    [...(db.depreciationSchedules||[]),...(db.toolAllocationSchedules||[])].forEach((row)=>{
      const key=row.period??row.month;if(key)nonCashByMonth.set(key,(nonCashByMonth.get(key)||0)+vnd(row.amount??row.allocationAmount??row.allocation_amount));
    });
    const nonCashExpense=keys.map((key)=>vnd(nonCashByMonth.get(key)||0));
    const commitmentByMonth=new Map();
    (db.commitments||[]).filter(commitmentIsIncluded).forEach((row)=>{
      const remaining=Math.max(0,vnd(row.amount)-vnd(row.recognizedAmount??row.recognized_amount));if(!remaining)return;
      const due=isISODate(row.dueDate??row.due_date)?monthOf(row.dueDate??row.due_date):startKey;
      const key=due<startKey?startKey:due;
      commitmentByMonth.set(key,(commitmentByMonth.get(key)||0)+remaining);
    });
    const purchaseCashByMonth=new Map(),purchaseExpenseByMonth=new Map();
    (db.purchaseOrders||[]).filter((po)=>!statusIs(po.status,'received','completed','cancelled','rejected')).forEach((po)=>{
      const result=classifyPurchase(po,db.settings||{});
      const keyRaw=monthOf(po.expectedDate??po.expected_date??po.orderDate??po.order_date);
      const key=keyRaw&&keyRaw>=startKey?keyRaw:startKey;
      const total=vnd(result.totalExclVat+result.vatAmount);
      if(result.classification==='fixed_asset'||result.classification==='tool')purchaseCashByMonth.set(key,(purchaseCashByMonth.get(key)||0)+total);
      else purchaseExpenseByMonth.set(key,(purchaseExpenseByMonth.get(key)||0)+result.totalExclVat);
    });
    const directCost=keys.map((key,i)=>vnd(Math.max(revenue[i]*directCostRatio,n(commitmentByMonth.get(key))+n(purchaseExpenseByMonth.get(key)))));
    const operatingCost=keys.map((_,i)=>vnd(directCost[i]+payrollCost[i]+overheadCost[i]+nonCashExpense[i]));
    const profitBeforeTax=revenue.map((x,i)=>vnd(x-operatingCost[i]));
    const tax=profitBeforeTax.map((x)=>vnd(Math.max(0,x)*taxRate));
    const profitAfterTax=profitBeforeTax.map((x,i)=>vnd(x-tax[i]));

    const receivableCollections=Array(months).fill(0);
    (db.taxInvoices||[]).filter((invoice)=>activeInvoice(invoice)&&statusIs(invoice.direction,'Output')).forEach((invoice)=>{
      const outstanding=Math.max(0,invoiceTotal(invoice)-invoiceAllocatedAmount(db,invoice,{asOf}));if(!outstanding)return;
      const due=invoice.dueDate??invoice.due_date;
      let idx=isISODate(due)&&due>asOf?keys.indexOf(monthOf(due)):0;
      if(idx<0)return;
      const collectible=vnd(outstanding*collectionRate);
      receivableCollections[idx]+=collectible*(idx===0?0.65:1);
      if(idx===0&&months>1)receivableCollections[1]+=collectible*0.35;
    });
    const milestoneCollections=Array(months).fill(0);
    let futureMilestoneNet=0;
    (db.billingMilestones||db.contractMilestones||[]).filter((m)=>!statusIs(m.invoiceStatus,'invoiced','cancelled')&&!statusIs(m.status,'cancelled')).forEach((m)=>{
      const net=vnd(m.amountExclVat??m.amount_excl_vat??m.amount);futureMilestoneNet+=Math.max(0,net);
      const due=m.dueDate??m.due_date;if(!isISODate(due)||due<=asOf)return;
      const idx=keys.indexOf(monthOf(due));if(idx>=0)milestoneCollections[idx]+=vnd(net*(1+n(m.vatRate??db.settings?.defaultVatRate??10)/100)*collectionRate);
    });
    const totalBacklog=Math.max(0,sum(backlogRevenue));
    const uncoveredBacklogRatio=totalBacklog>0?Math.max(0,Math.min(1,(totalBacklog-futureMilestoneNet)/totalBacklog)):0;
    const genericCollectibleRevenue=keys.map((_,i)=>vnd(pipelineRevenue[i]+recurringRevenue[i]+backlogRevenue[i]*uncoveredBacklogRatio));
    const genericCollections=Array(months).fill(0),vatFactor=1+n(db.settings?.defaultVatRate??10)/100;
    const collectionWeights=[0.2,0.6,0.2];
    genericCollectibleRevenue.forEach((amount,i)=>collectionWeights.forEach((weight,lag)=>{if(i+lag<months)genericCollections[i+lag]+=amount*vatFactor*collectionRate*weight;}));
    const cashIn=keys.map((_,i)=>vnd(receivableCollections[i]+milestoneCollections[i]+genericCollections[i]));

    const payableSettlements=Array(months).fill(0);
    const openingPayables=Math.max(0,financialAccountNet(db,['331'],asOf,'Credit'));
    if(openingPayables>0){payableSettlements[0]=vnd(openingPayables*0.6);if(months>1)payableSettlements[1]=vnd(openingPayables-payableSettlements[0]);}
    const taxPayments=Array(months).fill(0),taxLag=Math.max(0,Math.min(6,Math.round(n(scenario.taxPaymentLagMonths??1))));
    tax.forEach((amount,i)=>{if(i+taxLag<months)taxPayments[i+taxLag]+=amount;});
    const cashOperatingCost=keys.map((_,i)=>vnd(directCost[i]+payrollCost[i]+overheadCost[i]));
    const cashOut=keys.map((key,i)=>vnd(cashOperatingCost[i]+payableSettlements[i]+taxPayments[i]+n(purchaseCashByMonth.get(key))));
    const openingCash=position.cash;
    const netCash=Array(months).fill(0),closingCash=Array(months).fill(0);
    for(let i=0;i<months;i++){netCash[i]=vnd(cashIn[i]-cashOut[i]);closingCash[i]=vnd((i?closingCash[i-1]:openingCash)+netCash[i]);}
    const minCash=Math.min(...closingCash),minCashIndex=closingCash.indexOf(minCash);
    const negativeMonth=closingCash.findIndex((x)=>x<0);
    const bufferBreach=closingCash.findIndex((x)=>x<minCashBuffer);
    const quality=cashFlowForecastQuality(db,{from:fiscalYearStartFor(db,asOf),to:asOf});
    return {asOf,keys,labels,scenario,revenue,backlogRevenue,pipelineRevenue,recurringRevenue,directCost,payrollCost,overheadCost,nonCashExpense,operatingCost,profitBeforeTax,tax,profitAfterTax,cashIn,cashOut,cashOperatingCost,receivableCollections,milestoneCollections,genericCollections,payableSettlements,taxPayments,netCash,closingCash,openingCash,minCash,minCashMonth:minCashIndex>=0?keys[minCashIndex]:'',negativeCashMonth:negativeMonth>=0?keys[negativeMonth]:'',bufferBreachMonth:bufferBreach>=0?keys[bufferBreach]:'',minimumCashBuffer:minCashBuffer,totalRevenue:vnd(sum(revenue)),totalProfit:vnd(sum(profitAfterTax)),endingCash:closingCash[closingCash.length-1]||openingCash,quality,lineage:{revenue:'remaining committed backlog + probability-weighted pipeline + limited recurring baseline',cashIn:'outstanding invoices + uninvoiced milestones + lagged collections for uncovered backlog/pipeline/recurring revenue',cost:'non-payroll direct-cost floor versus firm commitments/received operating purchases + fixed payroll + overhead + non-cash allocation/depreciation',cashOut:'cash operating cost + opening payables + delayed estimated CIT + approved asset/tool purchases; non-cash depreciation excluded'}};
  }
  function addMonthsISO(date, offset) {
    if(!isISODate(date))return '';
    const d=new Date(`${date}T12:00:00`);d.setMonth(d.getMonth()+Number(offset||0));
    return localISODate(d);
  }
  function repairExactLinks(db) {
    const repairs=[];
    const entries=(db.journalEntries||[]).filter((entry)=>statusIs(entry.status,'posted'));
    const entryProjectIds=(entry)=>new Set([entry.projectId??entry.project_id,...(entry.lines||[]).map((line)=>line.projectId??line.project_id)].filter(Boolean).map(String));
    const usedFinanceJournals=new Set((db.finance||[]).map((row)=>row.journalEntryId??row.journal_entry_id??row.postingId??row.posting_id).filter(Boolean).map(String));
    (db.finance||[]).filter((row)=>financePaid(row)&&!isInternalTransfer(row)&&!(row.journalEntryId??row.journal_entry_id??row.postingId??row.posting_id)).forEach((row)=>{
      const matches=financeJournalCandidates(db,row).filter((entry)=>!usedFinanceJournals.has(String(rowId(entry))));
      if(matches.length===1){row.journalEntryId=matches[0].id;usedFinanceJournals.add(String(rowId(matches[0])));repairs.push({type:'finance-journal',sourceId:row.id,targetId:matches[0].id});}
    });
    (db.taxInvoices||[]).filter((invoice)=>activeInvoice(invoice)&&!invoice.journalEntryId).forEach((invoice)=>{
      const total=invoiceTotal(invoice),direction=norm(invoice.direction);
      const matches=entries.filter((entry)=>entry.date===invoice.date&&(!invoice.projectId||entryProjectIds(entry).has(String(invoice.projectId)))&&(!invoice.partnerId||String(entry.partnerId??entry.partner_id??'')===String(invoice.partnerId))&&journalTotal(entry,direction==='output'?'debit':'credit')===total);
      if(matches.length===1){invoice.journalEntryId=matches[0].id;repairs.push({type:'invoice-journal',sourceId:invoice.id,targetId:matches[0].id});}
    });
    (db.purchaseOrders||[]).filter((po)=>!po.journalEntryId).forEach((po)=>{
      const matches=(db.journalEntries||[]).filter((entry)=>statusIs(entry.sourceType,'purchase_order')&&String(entry.sourceId)===String(po.id));
      if(matches.length===1){po.journalEntryId=matches[0].id;repairs.push({type:'purchase-journal',sourceId:po.id,targetId:matches[0].id});}
    });
    [...(db.toolAllocationSchedules||[]),...(db.depreciationSchedules||[])].filter((row)=>!row.journalEntryId).forEach((row)=>{
      const type=row.kind==='asset'?'asset_depreciation':'tool_allocation',sourceId=`${row.sourceId}:${row.period}`;
      const matches=(db.journalEntries||[]).filter((entry)=>statusIs(entry.sourceType,type)&&String(entry.sourceId)===sourceId);
      if(matches.length===1){row.journalEntryId=matches[0].id;repairs.push({type:'schedule-journal',sourceId,targetId:matches[0].id});}
    });
    (db.billingMilestones || db.contractMilestones || []).forEach((row) => {
      const contract = (db.contracts || []).find((x) => String(rowId(x)) === String(row.contractId ?? row.contract_id ?? ''));
      const expectedProjectId = contract?.projectId ?? contract?.project_id ?? '';
      if (expectedProjectId && String(row.projectId ?? row.project_id ?? '') !== String(expectedProjectId)) {
        row.projectId = expectedProjectId;
        repairs.push({ type: 'milestone-project', sourceId: rowId(row), targetId: expectedProjectId });
      }
    });
    return {count:repairs.length,repairs};
  }
  function financialLinkAudit(db, range = {}) {
    const rows=[];
    const add=(id,label,total,linked,detail,severity='warning')=>{
      const safeTotal=Math.max(0,Number(total)||0),safeLinked=Math.max(0,Math.min(safeTotal,Number(linked)||0));
      const percent=safeTotal?safeLinked/safeTotal*100:100;
      rows.push({id,label,total:safeTotal,linked:safeLinked,missing:Math.max(0,safeTotal-safeLinked),percent,pass:safeTotal===0||safeLinked===safeTotal,severity,detail});
    };
    const projectIds=new Set((db.projects||[]).map((x)=>String(x.id)));
    const personIds=new Set((db.people||[]).map((x)=>String(x.id)));
    const clientIds=new Set((db.clients||[]).map((x)=>String(x.id)));
    const vendorIds=new Set((db.vendors||[]).map((x)=>String(x.id)));
    const accountCodes=new Set((db.accounts||[]).map((x)=>String(x.code)));
    const contractIds=new Set((db.contracts||[]).map((x)=>String(x.id)));
    const entries=new Map((db.journalEntries||[]).map((x)=>[String(x.id),x]));

    const committedProjects=(db.projects||[]).filter((project)=>!['pipeline','excluded'].includes(projectLifecycle(project)));
    add('PROJECT_CONTRACT','Dự án vận hành ↔ Hợp đồng cam kết',committedProjects.length,committedProjects.filter((project)=>(db.contracts||[]).some((contract)=>String(contract.projectId??contract.project_id)===String(project.id)&&contractIsCommitted(contract))).length,'Dự án vận hành phải có hợp đồng thực tế; giá trị fallback trên hồ sơ dự án không được xem là liên kết.','critical');

    const pipelineProjects=(db.projects||[]).filter((project)=>projectLifecycle(project)==='pipeline');
    add('PIPELINE_QUOTE','Dự án Pipeline ↔ Báo giá/cơ hội',pipelineProjects.length,pipelineProjects.filter((project)=>(db.quotes||[]).some((quote)=>String(quote.projectId??quote.project_id)===String(project.id)&&!statusIs(quote.status,'rejected','lost','cancelled'))).length,'Pipeline chỉ được đưa vào forecast khi có báo giá/cơ hội xác suất và liên kết dự án.','warning');

    const contracts=(db.contracts||[]).filter(contractIsCommitted),milestones=db.billingMilestones||db.contractMilestones||[];
    add('CONTRACT_MASTER','Hợp đồng ↔ Dự án & Khách hàng',contracts.length,contracts.filter((contract)=>projectIds.has(String(contract.projectId??contract.project_id))&&clientIds.has(String(contract.clientId??contract.client_id))).length,'Không để hợp đồng mồ côi dự án hoặc khách hàng.','critical');
    add('CONTRACT_MILESTONE','Hợp đồng ↔ Lịch thanh toán',contracts.length,contracts.filter((contract)=>{
      const ms=milestones.filter((milestone)=>String(milestone.contractId??milestone.contract_id)===String(contract.id)&&!statusIs(milestone.status,'cancelled'));
      if(!ms.length)return false;
      const total=vnd(sum(ms,(milestone)=>milestone.amountExclVat??milestone.amount_excl_vat??milestone.amount));
      return Math.abs(total-vnd(contract.valueExclVat??contract.value_excl_vat??contract.contractValue))<=2;
    }).length,'Tổng các đợt thanh toán chưa VAT phải khớp giá trị hợp đồng.','critical');
    add('MILESTONE_REFERENCE','Lịch thanh toán ↔ Hợp đồng & Dự án',milestones.length,milestones.filter((milestone)=>contractIds.has(String(milestone.contractId??milestone.contract_id))&&projectIds.has(String(milestone.projectId??milestone.project_id))).length,'Mỗi đợt thanh toán phải trỏ đúng hợp đồng và dự án.','critical');

    const invoices=(db.taxInvoices||[]).filter(activeInvoice);
    add('INVOICE_MASTER','Hóa đơn ↔ Đối tác/Dự án/Hợp đồng',invoices.length,invoices.filter((invoice)=>{
      const partnerOk=statusIs(invoice.partnerType,'client')?clientIds.has(String(invoice.partnerId)):statusIs(invoice.partnerType,'vendor')?vendorIds.has(String(invoice.partnerId)):false;
      const projectOk=!invoice.projectId||projectIds.has(String(invoice.projectId));
      const contractOk=!invoice.contractId||contractIds.has(String(invoice.contractId));
      return partnerOk&&projectOk&&contractOk;
    }).length,'Hóa đơn phải trỏ đúng đối tác; dự án/hợp đồng nếu có phải tồn tại.','critical');
    add('INVOICE_JOURNAL','Hóa đơn ↔ Chứng từ kế toán',invoices.length,invoices.filter((invoice)=>{
      const entry=entries.get(String(invoice.journalEntryId||''));if(!entry)return false;
      const mustBePosted=statusIs(invoice.direction,'Output')||Boolean(invoice.deductible??invoice.isDeductible??invoice.is_deductible);
      return !mustBePosted||statusIs(entry.status,'posted');
    }).length,'Hóa đơn đầu ra và VAT đầu vào đề nghị khấu trừ phải nối chứng từ Posted; hồ sơ đầu vào chưa đủ điều kiện có thể nối Draft.','critical');
    const settledOutput=invoices.filter((invoice)=>statusIs(invoice.direction,'Output')&&(statusIs(invoice.paymentStatus,'Paid')||invoiceAllocatedAmount(db,invoice,{asOf:range.to||localISODate()})>=invoiceTotal(invoice)-1));
    add('INVOICE_ALLOCATION','Hóa đơn đã thu ↔ Phân bổ tiền',settledOutput.length,settledOutput.filter((invoice)=>invoiceAllocatedAmount(db,invoice,{asOf:range.to||localISODate()})>=invoiceTotal(invoice)-1).length,'Không suy diễn đã thu chỉ từ trạng thái hay TK 131; phải có phân bổ tới hóa đơn.','critical');

    const paidFinance=(db.finance||[]).filter((row)=>financePaid(row)&&!isInternalTransfer(row));
    const financeJournalUse=new Map();
    paidFinance.forEach((row)=>{const id=String(row.journalEntryId||row.journal_entry_id||row.postingId||row.posting_id||'');if(id)financeJournalUse.set(id,(financeJournalUse.get(id)||0)+1);});
    add('FINANCE_JOURNAL','Thu/chi tiền ↔ Chứng từ Posted khớp tuyệt đối',paidFinance.length,paidFinance.filter((row)=>{
      const id=String(row.journalEntryId||row.journal_entry_id||row.postingId||row.posting_id||''),entry=entries.get(id);
      return Boolean(entry&&financeJournalUse.get(id)===1&&financeJournalMatch(db,row,entry));
    }).length,'Dòng Paid phải nối chứng từ Posted khớp ngày, dự án, số tiền và chiều tăng/giảm TK 111/112.','critical');

    const receivedPO=(db.purchaseOrders||[]).filter((order)=>statusIs(order.status,'Received','Completed'));
    add('PROCUREMENT_JOURNAL','Đơn mua đã nhận ↔ Chứng từ mua',receivedPO.length,receivedPO.filter((order)=>order.journalEntryId&&entries.has(String(order.journalEntryId))).length,'Đơn mua đã nhận cần chứng từ mua Draft/Posted.','critical');
    const assetPO=receivedPO.filter((order)=>statusIs(order.classification,'tool','fixed_asset'));
    add('PROCUREMENT_ASSET','Đơn mua CCDC/TSCĐ ↔ Thẻ tài sản',assetPO.length,assetPO.filter((order)=>statusIs(order.classification,'tool')?Boolean(order.toolId&&(db.tools||[]).some((tool)=>String(tool.id)===String(order.toolId))):Boolean(order.fixedAssetId&&(db.fixedAssets||[]).some((asset)=>String(asset.id)===String(order.fixedAssetId)))).length,'Phân loại tài sản phải sinh đúng một thẻ quản lý.','critical');
    const schedules=[...(db.toolAllocationSchedules||[]),...(db.depreciationSchedules||[])];
    add('SCHEDULE_JOURNAL','Lịch phân bổ/khấu hao ↔ Chứng từ kỳ',schedules.length,schedules.filter((row)=>scheduleJournalMatch(db,row)).length,'Mỗi kỳ phải nối đúng chứng từ nguồn, kỳ và số tiền Nợ/Có.','critical');

    const activeProjects=(db.projects||[]).filter((project)=>projectLifecycle(project)==='active');
    add('PROJECT_BUDGET','Dự án đang chạy ↔ ngân sách được duyệt',activeProjects.length,activeProjects.filter((project)=>approvedBudget(db,project.id,{to:range.to}).version).length,'Chi phí ước tính khi hoàn thành chỉ đáng tin khi có ngân sách cơ sở được duyệt.','warning');
    const tasks=db.tasks||[];
    add('TASK_MASTER','Công việc ↔ Dự án & Nhân sự',tasks.length,tasks.filter((task)=>projectIds.has(String(task.projectId??task.project_id))&&(!task.assigneeId||personIds.has(String(task.assigneeId)))).length,'Công việc phải thuộc dự án; người phụ trách nếu có phải tồn tại.','critical');
    const timesheets=db.timesheets||[];
    add('TIMESHEET_MASTER','Timesheet ↔ Nhân sự & Dự án',timesheets.length,timesheets.filter((row)=>personIds.has(String(row.personId??row.person_id))&&projectIds.has(String(row.projectId??row.project_id))).length,'Timesheet phải trỏ đúng nhân sự và dự án.','critical');
    const documents=db.documents||[];
    add('DOCUMENT_PROJECT','Hồ sơ ↔ Dự án & Chủ sở hữu',documents.length,documents.filter((doc)=>(!doc.projectId||projectIds.has(String(doc.projectId)))&&(!doc.ownerId||personIds.has(String(doc.ownerId)))).length,'Hồ sơ dự án không được trỏ tới dự án/người sở hữu đã xóa.','warning');
    const journalLines=(db.journalEntries||[]).flatMap((entry)=>(entry.lines||[]).map((line)=>({entry,line})));
    add('JOURNAL_ACCOUNT','Dòng hạch toán ↔ Danh mục tài khoản',journalLines.length,journalLines.filter(({line})=>accountCodes.has(String(line.accountCode))).length,'Mọi dòng Nợ/Có phải dùng tài khoản đang tồn tại trong danh mục.','critical');
    const opening=db.openingBalances||[];
    add('OPENING_ACCOUNT','Số dư đầu kỳ ↔ Danh mục tài khoản',opening.length,opening.filter((row)=>accountCodes.has(String(row.accountCode))).length,'Không để số dư đầu kỳ tại tài khoản không tồn tại.','critical');

    const vat=vatRegisterSummary(db,range),vatLedger=vatLedgerSummary(db,range);
    const vatLinked=Math.abs(vat.output-vatLedger.output)<=2&&Math.abs(vat.inputDeductible-vatLedger.input)<=2;
    add('VAT_RECONCILIATION','Hóa đơn VAT ↔ Sổ cái VAT',1,vatLinked?1:0,`Chênh đầu ra ${vnd(vat.output-vatLedger.output)}; đầu vào ${vnd(vat.inputDeductible-vatLedger.input)} VND.`,'critical');
    const critical=rows.filter((row)=>row.severity==='critical');
    const denominator=Math.max(1,sum(rows,(row)=>row.severity==='critical'?2:1));
    const score=Math.round(sum(rows,(row)=>row.percent*(row.severity==='critical'?2:1))/denominator);
    return {rows,score,passCritical:critical.every((row)=>row.pass),criticalIssues:critical.filter((row)=>!row.pass).length,warningIssues:rows.filter((row)=>row.severity!=='critical'&&!row.pass).length};
  }

  const BUSINESS_COLLECTIONS = [
    'people','clients','projects','tasks','timesheets','finance','quotes','approvals','documents','vendors','accounts','journalEntries','taxInvoices','pitWithholdings','citAdjustments','taxFilings','contracts','billingMilestones','paymentAllocations','projectBudgetVersions','projectBudgetLines','resourcePlans','commitments','projectStages','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules','financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns','openingBalances','accountingPeriods','exportLogs','importLogs'
  ];
  function dataLinkAudit(db = {}) {
    const issues = [];
    const sets = {};
    for (const collection of BUSINESS_COLLECTIONS) sets[collection] = new Set((db[collection] || []).map((row) => String(rowId(row) || '').trim()).filter(Boolean));
    const accountCodes = new Set((db.accounts || []).map((x) => String(x.code || '').trim()).filter(Boolean));
    const issue = (collection, row, field, value, target, reason = 'missing_reference') => issues.push({ collection, recordId: String(rowId(row) || ''), field, value: String(value ?? ''), target, reason });
    const first = (row, fields) => { for (const field of fields) if (row?.[field] !== undefined && row?.[field] !== null && String(row[field]).trim() !== '') return { field, value: row[field] }; return null; };
    const ref = (collection, row, fields, target, required = false) => {
      const found = first(row, fields);
      if (!found) { if (required) issue(collection, row, fields[0], '', target, 'required_reference'); return; }
      const targetSet = target === 'accountCodes' ? accountCodes : sets[target];
      if (!targetSet?.has(String(found.value))) issue(collection, row, found.field, found.value, target);
    };
    const date = (collection, row, fields, required = false) => {
      const found = first(row, fields);
      if (!found) { if (required) issue(collection, row, fields[0], '', 'ISO-date', 'required_date'); return; }
      if (!isISODate(found.value)) issue(collection, row, found.field, found.value, 'ISO-date', 'invalid_date');
    };
    const partner = (collection, row, typeFields = ['partnerType','partner_type'], idFields = ['partnerId','partner_id']) => {
      const type = norm(first(row, typeFields)?.value), found = first(row, idFields);
      if (!found) return;
      const target = type === 'client' ? 'clients' : type === 'vendor' ? 'vendors' : ['person','employee'].includes(type) ? 'people' : '';
      if (!target) issue(collection, row, found.field, found.value, 'clients/vendors/people', 'invalid_partner_type'); else ref(collection, row, idFields, target, true);
    };

    (db.projects || []).forEach((x) => { ref('projects',x,['clientId','client_id'],'clients'); ref('projects',x,['pmId','pm_id'],'people'); date('projects',x,['startDate','start_date']); date('projects',x,['endDate','end_date']); if (isISODate(x.startDate) && isISODate(x.endDate) && x.endDate < x.startDate) issue('projects',x,'endDate',x.endDate,'startDate','date_order'); });
    (db.tasks || []).forEach((x) => { ref('tasks',x,['projectId','project_id'],'projects',true); ref('tasks',x,['assigneeId','assignee_id'],'people',true); date('tasks',x,['startDate','start_date']); date('tasks',x,['dueDate','due_date']); if (isISODate(x.startDate) && isISODate(x.dueDate) && x.dueDate < x.startDate) issue('tasks',x,'dueDate',x.dueDate,'startDate','date_order'); });
    (db.timesheets || []).forEach((x) => { ref('timesheets',x,['projectId','project_id'],'projects',true); ref('timesheets',x,['personId','person_id'],'people',true); date('timesheets',x,['date'],true); });
    (db.finance || []).forEach((x) => { ref('finance',x,['projectId','project_id'],'projects'); ref('finance',x,['vendorId','vendor_id'],'vendors'); ref('finance',x,['invoiceId','invoice_id','taxInvoiceId','tax_invoice_id'],'taxInvoices'); ref('finance',x,['journalEntryId','journal_entry_id','postingId','posting_id'],'journalEntries'); date('finance',x,['date'],true); });
    (db.quotes || []).forEach((x) => { ref('quotes',x,['clientId','client_id'],'clients',true); ref('quotes',x,['projectId','project_id'],'projects'); date('quotes',x,['date'],true); });
    (db.approvals || []).forEach((x) => { ref('approvals',x,['requesterId','requester_id'],'people',true); ref('approvals',x,['projectId','project_id'],'projects'); date('approvals',x,['date'],true); });
    (db.documents || []).forEach((x) => { ref('documents',x,['projectId','project_id'],'projects'); ref('documents',x,['ownerId','owner_id'],'people'); date('documents',x,['date']); });
    (db.openingBalances || []).forEach((x) => { ref('openingBalances',x,['accountCode','account_code'],'accountCodes',true); date('openingBalances',x,['asOfDate','as_of_date'],true); });
    (db.journalEntries || []).forEach((entry) => { ref('journalEntries',entry,['projectId','project_id'],'projects'); partner('journalEntries',entry); date('journalEntries',entry,['date'],true); (entry.lines || []).forEach((line) => { ref('journalEntries',line,['accountCode','account_code'],'accountCodes',true); ref('journalEntries',line,['projectId','project_id'],'projects'); partner('journalEntries',line); }); });
    (db.taxInvoices || []).forEach((x) => { ref('taxInvoices',x,['projectId','project_id'],'projects'); ref('taxInvoices',x,['contractId','contract_id'],'contracts'); ref('taxInvoices',x,['journalEntryId','journal_entry_id'],'journalEntries'); partner('taxInvoices',x); date('taxInvoices',x,['date'],true); date('taxInvoices',x,['dueDate','due_date']); const contract=(db.contracts||[]).find(c=>String(rowId(c))===String(x.contractId??x.contract_id??'')); if(contract&&x.projectId&&String(contract.projectId??contract.project_id)!==String(x.projectId))issue('taxInvoices',x,'contractId',x.contractId,'matching project','cross_project_reference'); });
    (db.pitWithholdings || []).forEach((x) => { const type=norm(x.recipientType??x.recipient_type), target=type==='vendor'?'vendors':['person','employee'].includes(type)?'people':''; if(target)ref('pitWithholdings',x,['recipientId','recipient_id'],target,true); else if(x.recipientId)issue('pitWithholdings',x,'recipientType',type,'vendor/people','invalid_partner_type'); ref('pitWithholdings',x,['journalEntryId','journal_entry_id'],'journalEntries'); date('pitWithholdings',x,['date'],true); });
    (db.citAdjustments || []).forEach((x) => { ref('citAdjustments',x,['projectId','project_id'],'projects'); date('citAdjustments',x,['date'],true); });
    (db.taxFilings || []).forEach((x) => { date('taxFilings',x,['dueDate','due_date'],true); date('taxFilings',x,['filedDate','filed_date']); date('taxFilings',x,['paymentDate','payment_date']); });
    (db.contracts || []).forEach((x) => { ref('contracts',x,['projectId','project_id'],'projects',true); ref('contracts',x,['clientId','client_id'],'clients',true); ref('contracts',x,['ownerId','owner_id'],'people'); date('contracts',x,['signedDate','signed_date']); date('contracts',x,['effectiveDate','effective_date']); date('contracts',x,['expiryDate','expiry_date']); const effective=x.effectiveDate??x.effective_date, expiry=x.expiryDate??x.expiry_date; if(isISODate(effective)&&isISODate(expiry)&&expiry<effective)issue('contracts',x,'expiryDate',expiry,'effectiveDate','date_order'); });
    (db.billingMilestones || []).forEach((x) => { ref('billingMilestones',x,['contractId','contract_id'],'contracts',true); ref('billingMilestones',x,['projectId','project_id'],'projects',true); ref('billingMilestones',x,['invoiceId','invoice_id'],'taxInvoices'); date('billingMilestones',x,['dueDate','due_date']); const contract=(db.contracts||[]).find(c=>String(rowId(c))===String(x.contractId??x.contract_id??'')); if(contract&&String(contract.projectId??contract.project_id??'')!==String(x.projectId??x.project_id??''))issue('billingMilestones',x,'projectId',x.projectId,'contract.projectId','cross_project_reference'); });
    (db.paymentAllocations || []).forEach((x) => { ref('paymentAllocations',x,['paymentId','payment_id'],'finance'); ref('paymentAllocations',x,['invoiceId','invoice_id'],'taxInvoices',true); date('paymentAllocations',x,['date','allocationDate','allocation_date','paymentDate','payment_date']); });
    (db.projectBudgetVersions || []).forEach((x) => { ref('projectBudgetVersions',x,['projectId','project_id'],'projects',true); date('projectBudgetVersions',x,['effectiveFrom','effective_from']); });
    (db.projectBudgetLines || []).forEach((x) => ref('projectBudgetLines',x,['budgetVersionId','budget_version_id'],'projectBudgetVersions',true));
    (db.resourcePlans || []).forEach((x) => { ref('resourcePlans',x,['projectId','project_id'],'projects',true); ref('resourcePlans',x,['personId','person_id'],'people',true); if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(x.month||'')))issue('resourcePlans',x,'month',x.month,'YYYY-MM','invalid_period'); });
    (db.commitments || []).forEach((x) => { ref('commitments',x,['projectId','project_id'],'projects',true); date('commitments',x,['dueDate','due_date']); });
    (db.projectStages || []).forEach((x) => { ref('projectStages',x,['projectId','project_id'],'projects',true); date('projectStages',x,['plannedStart','planned_start'],true); date('projectStages',x,['plannedEnd','planned_end'],true); if(isISODate(x.plannedStart)&&isISODate(x.plannedEnd)&&x.plannedEnd<x.plannedStart)issue('projectStages',x,'plannedEnd',x.plannedEnd,'plannedStart','date_order'); });
    (db.purchaseRequests || []).forEach((x) => { ref('purchaseRequests',x,['requesterId','requester_id'],'people',true); ref('purchaseRequests',x,['projectId','project_id'],'projects'); date('purchaseRequests',x,['date'],true); });
    (db.purchaseOrders || []).forEach((x) => { ref('purchaseOrders',x,['purchaseRequestId','purchase_request_id'],'purchaseRequests',true); ref('purchaseOrders',x,['vendorId','vendor_id'],'vendors',true); ref('purchaseOrders',x,['projectId','project_id'],'projects'); ref('purchaseOrders',x,['custodianId','custodian_id'],'people'); ref('purchaseOrders',x,['journalEntryId','journal_entry_id'],'journalEntries'); ref('purchaseOrders',x,['toolId','tool_id'],'tools'); ref('purchaseOrders',x,['fixedAssetId','fixed_asset_id'],'fixedAssets'); date('purchaseOrders',x,['orderDate','order_date'],true); date('purchaseOrders',x,['invoiceDate','invoice_date']); });
    (db.tools || []).forEach((x) => { ref('tools',x,['purchaseOrderId','purchase_order_id'],'purchaseOrders'); ref('tools',x,['projectId','project_id'],'projects'); ref('tools',x,['custodianId','custodian_id'],'people'); ref('tools',x,['expenseAccountCode','expense_account_code'],'accountCodes',true); date('tools',x,['startDate','start_date'],true); });
    (db.fixedAssets || []).forEach((x) => { ref('fixedAssets',x,['purchaseOrderId','purchase_order_id'],'purchaseOrders'); ref('fixedAssets',x,['projectId','project_id'],'projects'); ref('fixedAssets',x,['custodianId','custodian_id'],'people'); ref('fixedAssets',x,['assetAccountCode','asset_account_code'],'accountCodes',true); ref('fixedAssets',x,['depreciationAccountCode','depreciation_account_code'],'accountCodes',true); ref('fixedAssets',x,['expenseAccountCode','expense_account_code'],'accountCodes',true); date('fixedAssets',x,['acquisitionDate','acquisition_date'],true); date('fixedAssets',x,['inServiceDate','in_service_date'],true); });
    (db.toolAllocationSchedules || []).forEach((x) => { ref('toolAllocationSchedules',x,['sourceId','source_id'],'tools',true); ref('toolAllocationSchedules',x,['journalEntryId','journal_entry_id'],'journalEntries'); if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(x.period||'')))issue('toolAllocationSchedules',x,'period',x.period,'YYYY-MM','invalid_period'); });
    (db.depreciationSchedules || []).forEach((x) => { ref('depreciationSchedules',x,['sourceId','source_id'],'fixedAssets',true); ref('depreciationSchedules',x,['journalEntryId','journal_entry_id'],'journalEntries'); if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(x.period||'')))issue('depreciationSchedules',x,'period',x.period,'YYYY-MM','invalid_period'); });
    (db.accountingPeriods || []).forEach((x) => { date('accountingPeriods',x,['from'],true); date('accountingPeriods',x,['to'],true); if(isISODate(x.from)&&isISODate(x.to)&&x.to<x.from)issue('accountingPeriods',x,'to',x.to,'from','date_order'); });
    return issues;
  }

  function integrityChecks(db, range = {}) {
    const checks = [];
    const add = (code, pass, severity, title, detail, count = 0) => checks.push({ code, pass, severity, title, detail, count });
    // Large-volume audits must never repeatedly scan master ledgers for every
    // withholding, allocation, finance row or contract. Build immutable indexes
    // once for the current db revision and reuse them across all controls.
    const journalById = cachedIdMap(db, 'journalById', db.journalEntries || []);
    const allocationState = buildAllocationState(db);
    const docs = new Map(), duplicateDocs = [], documentIdentityCounts = new Map();
    (db.journalEntries || []).filter((x) => !statusIs(x.status, 'cancelled', 'deleted', 'void')).forEach((x) => {
      const k = documentIdentity(x, db.settings || {}); if (!k) return;
      documentIdentityCounts.set(k, n(documentIdentityCounts.get(k)) + 1);
      if (docs.has(k)) duplicateDocs.push(k); else docs.set(k, x.id);
    });
    const validationContext = { documentIdentityCounts };
    const invalidEntries = (db.journalEntries || []).filter((x) => statusIs(x.status, 'posted') && !entryValidation(db, x, x.id, validationContext).valid);
    add('JE_BALANCE', invalidEntries.length === 0, 'critical', 'Chứng từ ghi sổ cân bằng và hợp lệ', invalidEntries.length ? `${invalidEntries.length} chứng từ cần xử lý.` : 'Tất cả chứng từ Posted đều cân bằng Nợ/Có.', invalidEntries.length);
    add('JE_UNIQUE', duplicateDocs.length === 0, 'critical', 'Số chứng từ không trùng', duplicateDocs.length ? `Trùng: ${[...new Set(duplicateDocs)].join(', ')}` : 'Không có số chứng từ trùng.', duplicateDocs.length);
    const altered = (db.journalEntries || []).filter((x) => statusIs(x.status, 'posted') && !verifyPostingHash(x));
    add('JE_HASH', altered.length === 0, 'critical', 'Toàn vẹn chứng từ đã ghi sổ', altered.length ? `${altered.length} chứng từ có dấu hiệu bị sửa sau ghi sổ.` : 'Không phát hiện thay đổi nội dung sau ghi sổ.', altered.length);
    const tb = trialBalance(db, range);
    add('TB_BALANCE', tb.balanced, 'critical', 'Bảng cân đối số phát sinh', tb.balanced ? 'Tổng Nợ bằng tổng Có; dư cuối Nợ bằng dư cuối Có.' : 'Bảng cân đối đang lệch.', tb.balanced ? 0 : 1);
    const vatTolerance = Math.max(1, vnd(db.settings?.vatVarianceTolerance ?? db.settings?.vat_variance_tolerance ?? 1));
    const badInvoices = (db.taxInvoices || []).filter(activeInvoice).filter((x) => {
      const base=invoiceBase(x), vat=invoiceVat(x), total=invoiceTotal(x), rate=x.vatRate ?? x.vat_rate;
      return !isISODate(x.date) || !isNumeric(rate) || n(rate) < 0 || n(rate) > 100 || base < 0 || vat < 0 || total < 0 || Math.abs(vat - vnd(base * n(rate) / 100)) > vatTolerance || Math.abs(total - (base + vat)) > vatTolerance;
    });
    add('VAT_MATH', badInvoices.length === 0, 'critical', 'Công thức hóa đơn VAT', badInvoices.length ? `${badInvoices.length} hóa đơn sai ngày, tiền thuế hoặc tổng thanh toán.` : 'Ngày, tiền VAT và tổng thanh toán nằm trong ngưỡng làm tròn cho phép.', badInvoices.length);
    const invoiceKeys = new Set(), duplicates = [], missingInvoiceKeys=[];
    (db.taxInvoices || []).filter(activeInvoice).forEach((x) => { const parts=[x.direction,x.serial,x.invoiceNo??x.invoice_no,x.taxCode??x.tax_code].map((v)=>String(v||'').trim().toLowerCase()); if(!parts[2]||!parts[3]){missingInvoiceKeys.push(x.id);return;} const k=parts.join('|'); if (invoiceKeys.has(k)) duplicates.push(k); else invoiceKeys.add(k); });
    add('VAT_UNIQUE', duplicates.length === 0 && missingInvoiceKeys.length === 0, 'critical', 'Hóa đơn có khóa định danh đầy đủ và không trùng', duplicates.length || missingInvoiceKeys.length ? `${duplicates.length} hóa đơn có khả năng trùng; ${missingInvoiceKeys.length} hóa đơn thiếu số hoặc mã số thuế.` : 'Khóa hóa đơn đầy đủ và không phát hiện trùng.', duplicates.length + missingInvoiceKeys.length);
    const vatDeduction = vatInputDeductionAssessment(db, range);
    add('VAT_DEDUCTION_EVIDENCE', vatDeduction.blockedRows.length === 0, 'critical', 'Điều kiện thanh toán của VAT đầu vào khấu trừ', vatDeduction.blockedRows.length
      ? `${vatDeduction.blockedRows.length} hóa đơn đề nghị khấu trừ bị loại (${vnd(vatDeduction.fullyBlockedVat)} VND VAT): ${vatDeduction.blockedRows.slice(0,3).map((row)=>row.reason).join(' | ')}`
      : `Không có VAT đầu vào bị tính khấu trừ khi thiếu điều kiện thanh toán không dùng tiền mặt từ ${vatDeduction.threshold.toLocaleString('vi-VN')} VND.`, vatDeduction.blockedRows.length);
    add('VAT_PARTIAL_PAYMENT', vatDeduction.partialRows.length === 0, 'warning', 'VAT đầu vào thanh toán một phần đã được phân bổ', vatDeduction.partialRows.length
      ? `${vatDeduction.partialRows.length} hóa đơn chỉ được khấu trừ theo phần đã có chứng từ; ${vnd(vatDeduction.partialBlockedVat)} VND VAT còn bị loại/hoãn đến ngày chốt.`
      : 'Không có hóa đơn VAT đầu vào phải phân bổ theo thanh toán một phần.', vatDeduction.partialRows.length);
    const unclassifiedCash=(db.journalEntries||[]).filter((x)=>{
      if(!statusIs(x.status,'posted')||String(x.cashFlowCode ?? x.cash_flow_code ?? '').trim())return false;
      const cash=(x.lines||[]).filter((l)=>/^11(1|2)/.test(String(l.accountCode ?? l.account_code ?? '')));
      const net=vnd(sum(cash,l=>l.debit)-sum(cash,l=>l.credit));
      const counterpart=(x.lines||[]).filter((l)=>!/^11(1|2)/.test(String(l.accountCode ?? l.account_code ?? '')));
      return net!==0&&counterpart.length>0&&!counterpart.some(l=>String(l.accountCode ?? l.account_code ?? '').startsWith('413'));
    });
    add('B03_CLASSIFICATION',unclassifiedCash.length===0,'critical','Phân loại lưu chuyển tiền tệ B03-DNN',unclassifiedCash.length?`${unclassifiedCash.length} chứng từ tiền chưa có mã dòng tiền.`:'Tất cả chứng từ tiền đã có mã B03-DNN.',unclassifiedCash.length);
    const vatReg = vatRegisterSummary(db, range), vatLed = vatLedgerSummary(db, range);
    const vatDiff = Math.abs(vatReg.output - vatLed.output) + Math.abs(vatReg.inputDeductible - vatLed.input);
    add('VAT_RECON', vatDiff === 0, 'warning', 'Đối chiếu sổ hóa đơn và sổ cái', vatDiff === 0 ? 'VAT đầu ra/đầu vào khớp sổ cái.' : `Chênh lệch cần giải trình: ${vnd(vatDiff)} VND.`, vatDiff ? 1 : 0);
    const allowedPitStatuses = new Set(['pending','withheld','declared','paid','posted','approved','completed','cancelled','canceled','deleted','void']);
    const badPit = (db.pitWithholdings || []).filter((x) => {
      const gross=vnd(x.grossIncome??x.gross_income),taxable=vnd(x.taxableIncome??x.taxable_income),tax=vnd(x.taxWithheld??x.tax_withheld),net=vnd(x.netPaid??x.net_paid),rate=x.rate;
      const status=norm(x.status);
      return gross<=0 || taxable<0 || taxable>gross || tax<0 || tax>gross || net!==gross-tax || (isNumeric(rate)&&(n(rate)<0||n(rate)>100)) || (status&&!allowedPitStatuses.has(status));
    });
    add('PIT_MATH', badPit.length === 0, 'critical', 'Khấu trừ TNCN và thực nhận', badPit.length ? `${badPit.length} khoản chi trả sai trạng thái, Gross/Taxable/Tax/Net hoặc thuế suất.` : 'Các khoản chi trả có trạng thái hợp lệ và khớp Gross - Tax = Net.', badPit.length);
    const pitJournalIssues = (db.pitWithholdings || []).filter((x) => norm(x.status) && pitWithholdingIsRecognized(x)).filter((x) => {
      const journalId=x.journalEntryId??x.journal_entry_id;
      const journal=journalById.get(String(journalId||''));
      return !journalId || !journal || !statusIs(journal.status,'posted');
    });
    add('PIT_JOURNAL_LINK',pitJournalIssues.length===0,'warning','TNCN đã khấu trừ có chứng từ Posted',pitJournalIssues.length?`${pitJournalIssues.length} khoản TNCN đã ghi nhận chưa liên kết chứng từ Posted.`:'Các khoản TNCN đã ghi nhận đều có chứng từ Posted.',pitJournalIssues.length);
    const tsByDay = new Map(), badTs = [];
    (db.timesheets || []).forEach((x) => { if (n(x.hours) <= 0 || n(x.hours) > 24) badTs.push(x.id); const k = `${x.personId ?? x.person_id ?? x.employeeId ?? x.employee_id}|${x.date}`; tsByDay.set(k, (tsByDay.get(k) || 0) + n(x.hours)); });
    const over24 = [...tsByDay.values()].filter((x) => x > 24).length;
    add('TS_HOURS', badTs.length === 0 && over24 === 0, 'critical', 'Giờ công hợp lệ', badTs.length || over24 ? `${badTs.length} dòng không hợp lệ; ${over24} ngày vượt 24 giờ.` : 'Không có giờ âm, bằng 0 hoặc vượt 24 giờ/ngày.', badTs.length + over24);
    const invalidFinance = (db.finance || []).filter((x) => vnd(x.amount) <= 0 || !isISODate(x.date) || !statusIs(x.type, 'income', 'expense') || !statusIs(x.status || 'Pending', 'pending', 'paid', 'cancelled', 'canceled'));
    add('FINANCE_VALID', invalidFinance.length === 0, 'critical', 'Giao dịch dòng tiền hợp lệ', invalidFinance.length ? `${invalidFinance.length} giao dịch lỗi.` : 'Các giao dịch tiền có ngày, loại và số tiền hợp lệ.', invalidFinance.length);
    const managementCash = cashFlow(db, range), ledgerCash = ledgerCashFlow(db, range), cashDiff = Math.abs(managementCash.cashIn - ledgerCash.inflow) + Math.abs(managementCash.cashOut - ledgerCash.outflow);
    add('CASH_RECON', cashDiff === 0, 'warning', 'Đối chiếu dòng tiền và sổ ngân hàng/quỹ', cashDiff === 0 ? 'Thu/chi quản trị khớp phát sinh tài khoản tiền.' : `Chênh lệch cần liên kết chứng từ: ${vnd(cashDiff)} VND.`, cashDiff ? 1 : 0);
    const lockedPosted = (db.journalEntries || []).filter((x) => statusIs(x.status, 'posted') && isPeriodLocked(db, x.date) && !x.postedAt);
    add('PERIOD_LOCK', lockedPosted.length === 0, 'warning', 'Kiểm soát khóa kỳ', lockedPosted.length ? `${lockedPosted.length} chứng từ trong kỳ khóa chưa có dấu vết ghi sổ.` : 'Không phát hiện ngoại lệ khóa kỳ.', lockedPosted.length);
    tt133ReportChecks(db, range).checks.forEach((x) => add(x.code, x.pass, x.severity, x.title, x.detail, x.pass ? 0 : 1));
    const invalidProjects = (db.projects || []).filter((x) => !validateProject(x).valid);
    add('PROJECT_MASTER', invalidProjects.length === 0, 'critical', 'Danh mục dự án hợp lệ', invalidProjects.length ? `${invalidProjects.length} dự án có lỗi giá trị, tiến độ hoặc thời gian.` : 'Mã, giá trị, ngân sách, tiến độ và thời gian dự án hợp lệ.', invalidProjects.length);
    const portfolio = portfolioHealth(db, range);
    const overBudget = portfolio.rows.filter((x) => x.estimateAtCompletion > x.directBudget).length;
    add('PROJECT_EAC', overBudget === 0, 'warning', 'Dự báo ngân sách hoàn thành dự án', overBudget ? `${overBudget} dự án đang dự báo vượt ngân sách.` : 'Không có dự án dự báo vượt ngân sách trực tiếp.', overBudget);
    const lowConfidence = portfolio.contractedRows.filter((x) => x.eacConfidence === 'Low').length;
    add('PROJECT_EAC_CONFIDENCE', lowConfidence === 0, 'warning', 'Độ tin cậy của chi phí ước tính khi hoàn thành', lowConfidence ? `${lowConfidence} dự án chưa có kế hoạch nguồn lực hoặc chi phí cam kết đủ để lập dự báo hoàn thành tin cậy.` : 'Các dự án đều có nguồn dữ liệu kế hoạch cho chi phí ước tính khi hoàn thành.', lowConfidence);
    const invalidAllocationRows=(db.paymentAllocations||[]).filter((x)=>{
      const allocationDate=x.date ?? x.allocationDate ?? x.allocation_date ?? x.paymentDate ?? x.payment_date ?? '';
      return vnd(x.amount??x.allocatedAmount??x.allocated_amount)<=0 || !isISODate(allocationDate) || !statusIs(x.status||'Posted','draft','posted','paid','applied','completed','cancelled','canceled','deleted','void');
    });
    const overAllocatedInvoices = (db.taxInvoices || []).filter(activeInvoice).filter((invoice) => (allocationState.baseInvoiceTotals.get(String(rowId(invoice))) || 0) > invoiceTotal(invoice)+1).length;
    const overAllocatedPayments = (db.finance || []).filter(financePaid).filter((payment) => (allocationState.basePaymentTotals.get(String(rowId(payment))) || 0) > vnd(payment.amount) + 1).length;
    const invalidPaymentLinks = (db.paymentAllocations || []).filter(allocationIsPosted).filter((allocation) => {
      if (!allocationPaymentId(allocation)) return false;
      return !allocationState.baseRecognized.has(allocation);
    }).length;
    const allocationErrors=invalidAllocationRows.length+overAllocatedInvoices+overAllocatedPayments+invalidPaymentLinks;
    add('INVOICE_ALLOCATION', allocationErrors === 0, 'critical', 'Phân bổ thanh toán hợp lệ và không vượt nguồn', allocationErrors ? `${invalidAllocationRows.length} dòng sai ngày/trạng thái/số tiền; ${overAllocatedInvoices} hóa đơn và ${overAllocatedPayments} khoản thu bị phân bổ vượt; ${invalidPaymentLinks} liên kết tiền–hóa đơn không hợp lệ.` : 'Phân bổ đã ghi nhận không vượt hóa đơn/khoản thu và liên kết đúng dự án.', allocationErrors);
    const unlinkedPostedAllocations=(db.paymentAllocations||[]).filter(allocationIsPosted).filter((x)=>!(x.paymentId??x.payment_id)).length;
    add('ALLOCATION_PAYMENT_EVIDENCE',unlinkedPostedAllocations===0,'warning','Phân bổ thu tiền có chứng từ nguồn',unlinkedPostedAllocations?`${unlinkedPostedAllocations} phân bổ legacy chưa gắn khoản thu Paid; hệ thống vẫn giữ làm bằng chứng cũ nhưng yêu cầu liên kết cho bản ghi mới.`:'Mọi phân bổ đã ghi nhận đều gắn khoản thu Paid.',unlinkedPostedAllocations);
    const invalidFinanceJournals=(db.finance||[]).filter((row)=>financePaid(row)&&!isInternalTransfer(row)).filter((row)=>{
      const journalId=row.journalEntryId??row.journal_entry_id??row.postingId??row.posting_id??'';
      const entry=journalById.get(String(journalId));
      return !journalId||!financeJournalMatch(db,row,entry);
    });
    add('FINANCE_JOURNAL_EXACT',invalidFinanceJournals.length===0,'critical','Khoản thu/chi Paid khớp chứng từ tiền',invalidFinanceJournals.length?`${invalidFinanceJournals.length} khoản Paid thiếu chứng từ hoặc sai ngày, dự án, số tiền/chiều tiền 111–112.`:'Mọi khoản Paid đều khớp tuyệt đối với chứng từ Posted.',invalidFinanceJournals.length);
    const invalidInputVatPayments=(db.finance||[]).filter((row)=>linkedInputInvoiceId(row)).filter((row)=>!inputInvoicePaymentConstraint(db,row,rowId(row)).valid);
    add('VAT_PAYMENT_LINK',invalidInputVatPayments.length===0,'critical','Khoản thanh toán VAT đầu vào liên kết đúng hóa đơn và nhà cung cấp',invalidInputVatPayments.length?`${invalidInputVatPayments.length} khoản chi liên kết hóa đơn đầu vào sai loại, vượt giá trị, sai dự án, nhà cung cấp hoặc chứng từ ngân hàng.`:'Các khoản chi liên kết hóa đơn đầu vào đều có bằng chứng ngân hàng Posted và đúng nhà cung cấp.',invalidInputVatPayments.length);
    const financeJournalCounts=new Map();
    (db.finance||[]).filter((row)=>financePaid(row)&&!isInternalTransfer(row)).forEach((row)=>{const id=String(row.journalEntryId??row.journal_entry_id??row.postingId??row.posting_id??'');if(id)financeJournalCounts.set(id,(financeJournalCounts.get(id)||0)+1);});
    const duplicateFinanceJournalLinks=[...financeJournalCounts.values()].filter((count)=>count>1).reduce((total,count)=>total+count-1,0);
    add('FINANCE_JOURNAL_UNIQUE',duplicateFinanceJournalLinks===0,'critical','Một chứng từ tiền chỉ thuộc một khoản Paid',duplicateFinanceJournalLinks?`${duplicateFinanceJournalLinks} liên kết khoản Paid dùng trùng chứng từ kế toán.`:'Không có chứng từ tiền bị dùng cho nhiều khoản Paid.',duplicateFinanceJournalLinks);

    const duplicateMasterKeys = [];
    const findDuplicateKeys = (rows, label, selector) => {
      const seen = new Set();
      (rows || []).forEach((row) => {
        const raw = selector(row), key = norm(raw);
        if (!key) return;
        if (seen.has(key)) duplicateMasterKeys.push(`${label}:${String(raw).trim()}`); else seen.add(key);
      });
    };
    findDuplicateKeys(db.accounts, 'account.code', (x) => x.code);
    findDuplicateKeys(db.projects, 'project.code', (x) => x.code);
    findDuplicateKeys(db.people, 'person.code', (x) => x.code ?? x.employeeCode ?? x.employee_code);
    findDuplicateKeys(db.clients, 'client.code', (x) => x.code);
    findDuplicateKeys(db.clients, 'client.taxCode', (x) => x.taxCode ?? x.tax_code);
    findDuplicateKeys(db.vendors, 'vendor.code', (x) => x.code);
    findDuplicateKeys(db.vendors, 'vendor.taxCode', (x) => x.taxCode ?? x.tax_code);
    findDuplicateKeys(db.contracts, 'contract.no', (x) => x.contractNo ?? x.contract_no);
    findDuplicateKeys(db.purchaseRequests, 'purchaseRequest.no', (x) => x.requestNo ?? x.request_no);
    findDuplicateKeys(db.purchaseOrders, 'purchaseOrder.no', (x) => x.poNo ?? x.po_no);
    findDuplicateKeys(db.tools, 'tool.code', (x) => x.toolCode ?? x.tool_code);
    findDuplicateKeys(db.fixedAssets, 'asset.code', (x) => x.assetCode ?? x.asset_code);
    const idDuplicates = [], missingIds = [];
    for (const collection of BUSINESS_COLLECTIONS) {
      const seen = new Set();
      (db[collection] || []).forEach((row, index) => {
        const id = String(rowId(row) || '').trim();
        if (!id) { missingIds.push(`${collection}[${index}]`); return; }
        if (seen.has(id)) idDuplicates.push(`${collection}:${id}`); else seen.add(id);
      });
    }
    add('MASTER_UNIQUE', duplicateMasterKeys.length === 0 && idDuplicates.length === 0 && missingIds.length === 0, 'critical', 'Mã danh mục và khóa dữ liệu không trùng/không thiếu', duplicateMasterKeys.length || idDuplicates.length || missingIds.length ? `${duplicateMasterKeys.length} mã nghiệp vụ trùng; ${idDuplicates.length} ID trùng; ${missingIds.length} bản ghi thiếu ID.` : 'Không phát hiện mã nghiệp vụ trùng, ID trùng hoặc thiếu ID.', duplicateMasterKeys.length + idDuplicates.length + missingIds.length);

    const linkIssues = dataLinkAudit(db);
    add('REFERENTIAL_INTEGRITY', linkIssues.length === 0, 'critical', 'Dữ liệu liên kết không bị mồ côi hoặc chéo dự án', linkIssues.length ? `${linkIssues.length} lỗi khóa tham chiếu, ngày hoặc liên kết chéo phân hệ.` : 'Các liên kết nghiệp vụ được kiểm tra xuyên suốt dự án, hợp đồng, hóa đơn, kế toán, mua sắm và tài sản.', linkIssues.length);

    const invalidContracts=(db.contracts||[]).filter((x)=>vnd(x.valueExclVat??x.value_excl_vat??x.contractValue)<=0||n(x.vatRate??x.vat_rate)<0||n(x.vatRate??x.vat_rate)>100);
    add('CONTRACT_MATH',invalidContracts.length===0,'critical','Giá trị và VAT hợp đồng hợp lệ',invalidContracts.length?`${invalidContracts.length} hợp đồng có giá trị không dương hoặc VAT ngoài 0–100%.`:'Giá trị hợp đồng dương và VAT nằm trong 0–100%.',invalidContracts.length);
    const invalidBudgetLines=(db.projectBudgetLines||[]).filter((x)=>{const quantity=n(x.quantity),rate=n(x.unitRate??x.unit_rate),amount=vnd(x.amount??quantity*rate);return quantity<0||rate<0||amount<0||((x.amount!==undefined||x.amount_excl_vat!==undefined)&&Math.abs(amount-vnd(quantity*rate))>1);});
    add('BUDGET_LINE_MATH',invalidBudgetLines.length===0,'critical','Dòng ngân sách tính đúng số lượng × đơn giá',invalidBudgetLines.length?`${invalidBudgetLines.length} dòng ngân sách có số âm hoặc thành tiền không khớp.`:'Các dòng ngân sách không âm và thành tiền khớp số lượng × đơn giá.',invalidBudgetLines.length);
    const invalidPurchases=[...(db.purchaseRequests||[]),...(db.purchaseOrders||[])].filter((x)=>n(x.quantity)<=0||n(x.unitPrice??x.unit_price)<=0||n(x.vatRate??x.vat_rate)<0||n(x.vatRate??x.vat_rate)>100);
    add('PROCUREMENT_MATH',invalidPurchases.length===0,'critical','Số lượng, đơn giá và VAT mua sắm hợp lệ',invalidPurchases.length?`${invalidPurchases.length} đề nghị/đơn mua có số lượng, đơn giá hoặc VAT không hợp lệ.`:'Mua sắm có số lượng/đơn giá dương và VAT trong 0–100%.',invalidPurchases.length);
    const invalidAssets=(db.tools||[]).filter((x)=>vnd(x.originalCost)<=0||!Number.isInteger(Number(x.allocationMonths))||n(x.allocationMonths)<=0)
      .length+(db.fixedAssets||[]).filter((x)=>vnd(x.originalCost)<=0||vnd(x.residualValue)<0||vnd(x.residualValue)>=vnd(x.originalCost)||!Number.isInteger(Number(x.usefulLifeMonths))||n(x.usefulLifeMonths)<=12).length;
    add('ASSET_MASTER_MATH',invalidAssets===0,'critical','Nguyên giá và thời gian phân bổ/khấu hao hợp lệ',invalidAssets?`${invalidAssets} CCDC/TSCĐ có nguyên giá, giá trị thu hồi hoặc thời gian sử dụng không hợp lệ.`:'CCDC/TSCĐ có nguyên giá dương và thời gian hợp lệ.',invalidAssets);

    const invalidCommitments=(db.commitments||[]).filter((x)=>vnd(x.amount)<=0||vnd(x.recognizedAmount??x.recognized_amount)<0||vnd(x.recognizedAmount??x.recognized_amount)>vnd(x.amount));
    add('COMMITMENTS_VALID',invalidCommitments.length===0,'critical','Chi phí cam kết hợp lệ',invalidCommitments.length?`${invalidCommitments.length} cam kết có giá trị hoặc số đã ghi nhận không hợp lệ.`:'Số đã ghi nhận nằm trong giá trị cam kết.',invalidCommitments.length);
    const invalidMilestones = (db.contracts || []).filter((c) => {
      const ms=(db.billingMilestones || db.contractMilestones || []).filter((m)=>(m.contractId??m.contract_id)===c.id && String(m.status||'')!=='Cancelled');
      if(!ms.length)return false;
      const pct=sum(ms,(m)=>m.percentage), amount=vnd(sum(ms,(m)=>m.amountExclVat??m.amount_excl_vat??m.amount));
      const cv=vnd(c.valueExclVat??c.value_excl_vat??c.contractValue);
      return pct>100.01 || amount>cv+1;
    }).length;
    add('CONTRACT_MILESTONES', invalidMilestones === 0, 'critical', 'Lịch thanh toán không vượt hợp đồng', invalidMilestones ? `${invalidMilestones} hợp đồng có tổng tỷ lệ/giá trị đợt vượt hợp đồng.` : 'Lịch thanh toán nằm trong giá trị hợp đồng.', invalidMilestones);
    const contractOutliers = contractValueOutliers(db);
    add('CONTRACT_VALUE_OUTLIER', contractOutliers.length === 0, 'critical', 'Giá trị hợp đồng nằm trong ngưỡng kiểm soát', contractOutliers.length ? `${contractOutliers.length} hợp đồng có giá trị âm, không hợp lệ hoặc vượt ngưỡng kiểm soát.` : 'Không phát hiện giá trị hợp đồng bất thường.', contractOutliers.length);
    const budgetMismatch = (db.projectBudgetVersions || []).filter((v)=>String(v.status||'').toLowerCase()==='approved').filter((v)=>{
      const lines=(db.projectBudgetLines||[]).filter((l)=>(l.budgetVersionId??l.budget_version_id)===v.id);
      if(!lines.length)return false;
      const total=vnd(sum(lines,(l)=>l.amount??n(l.quantity)*n(l.unitRate??l.unit_rate)));
      return Math.abs(total-vnd(v.directBudget??v.direct_budget))>1;
    }).length;
    add('BUDGET_LINES', budgetMismatch === 0, 'warning', 'Chi tiết ngân sách khớp ngân sách được duyệt', budgetMismatch ? `${budgetMismatch} phiên bản ngân sách có tổng dòng không khớp direct budget.` : 'Tổng chi tiết ngân sách khớp direct budget.', budgetMismatch);

    const cutoff = isISODate(range.to) ? range.to : localISODate();
    const stageQualityIssues = (db.projects || []).filter((project) => {
      const mode = norm(project.progressMode ?? project.progress_mode);
      if (['manual','project-master','quick-input','quick'].includes(mode)) return false;
      const stages = (db.projectStages || []).filter((x) => sameId(x.projectId ?? x.project_id, project.id) && !statusIs(x.status,'cancelled','canceled','deleted'));
      if (!stages.length) return true;
      const info = projectStageProgress(db, project, cutoff);
      return info.confidence !== 'High' || Math.abs(info.weightTotal - 100) > 0.5;
    }).length;
    add('PROJECT_STAGE_QUALITY', stageQualityIssues === 0, 'warning', 'Tiến độ dự án có trọng số và lịch kế hoạch đáng tin cậy', stageQualityIssues ? `${stageQualityIssues} dự án thiếu giai đoạn, sai tổng trọng số hoặc thiếu ngày kế hoạch.` : 'Các dự án dùng tiến độ chi tiết có tổng trọng số 100% và ngày kế hoạch hợp lệ.', stageQualityIssues);

    const ambiguousBudgets = (db.projects || []).filter((project) => {
      const eligible = (db.projectBudgetVersions || []).filter((x) => sameId(x.projectId ?? x.project_id, project.id) && statusIs(x.status,'approved')).filter((x) => {
        const effective = x.effectiveFrom ?? x.effective_from ?? '';
        return !isISODate(effective) || effective <= cutoff;
      });
      if (eligible.length <= 1) return false;
      const missingEffective = eligible.filter((x) => !isISODate(x.effectiveFrom ?? x.effective_from)).length;
      const keys = new Set(eligible.map((x) => `${x.effectiveFrom ?? x.effective_from ?? ''}|${n(x.versionNo ?? x.version_no)}`));
      return missingEffective > 0 || keys.size !== eligible.length;
    }).length;
    add('BUDGET_BASELINE_CONTROL', ambiguousBudgets === 0, 'warning', 'Ngân sách Approved có hiệu lực và thứ tự phiên bản rõ ràng', ambiguousBudgets ? `${ambiguousBudgets} dự án có nhiều baseline Approved nhưng thiếu ngày hiệu lực hoặc trùng thứ tự phiên bản.` : 'Baseline Approved được xác định rõ theo ngày hiệu lực và số phiên bản.', ambiguousBudgets);

    const fallbackCommittedProjects = (db.projects || []).filter((project) => {
      const commercial = projectCommercialValue(db, project);
      return commercial.committedValue > 0 && commercial.source === 'project-master-fallback';
    }).length;
    add('CONTRACT_SOURCE_CONTROL', fallbackCommittedProjects === 0, 'warning', 'Giá trị hợp đồng có chứng từ nguồn', fallbackCommittedProjects ? `${fallbackCommittedProjects} dự án đang dùng giá trị tại hồ sơ dự án vì chưa có hợp đồng khách hàng đủ trạng thái cam kết.` : 'Giá trị hợp đồng đã lấy từ hợp đồng khách hàng đủ trạng thái cam kết.', fallbackCommittedProjects);

    const unpostedDirectCosts = (db.projects || []).reduce((total, project) => total + projectActualCost(db, project.id, {to:cutoff}).unpostedDirectFinanceCount, 0);
    add('PROJECT_COST_POSTING', unpostedDirectCosts === 0, 'warning', 'Chi phí trực tiếp đã liên kết sổ cái', unpostedDirectCosts ? `${unpostedDirectCosts} khoản chi trực tiếp đã thanh toán chưa có liên kết chứng từ ghi sổ; vẫn được đưa vào chi phí ước tính khi hoàn thành nhưng cần kế toán hoàn thiện.` : 'Không có khoản chi trực tiếp đã thanh toán bị thiếu liên kết sổ cái.', unpostedDirectCosts);

    const purchaseOrderIds = new Set((db.purchaseOrders || []).map((x) => String(x.id || '')).filter(Boolean));
    const invalidProcurementRefs = (db.tools || []).filter((x) => x.purchaseOrderId && !purchaseOrderIds.has(String(x.purchaseOrderId))).length
      + (db.fixedAssets || []).filter((x) => x.purchaseOrderId && !purchaseOrderIds.has(String(x.purchaseOrderId))).length;
    add('PROCUREMENT_REFERENCES', invalidProcurementRefs === 0, 'critical', 'CCDC/TSCĐ liên kết đúng đơn mua hàng', invalidProcurementRefs ? `${invalidProcurementRefs} tài sản hoặc CCDC trỏ tới đơn mua không tồn tại.` : 'Các thẻ CCDC/TSCĐ có liên kết đơn mua hợp lệ.', invalidProcurementRefs);

    const scheduleMismatch = [
      ...(db.tools || []).map((tool) => ({ source: tool, rows: (db.toolAllocationSchedules || []).filter((x) => String(x.sourceId) === String(tool.id)), target: vnd(tool.originalCost) })),
      ...(db.fixedAssets || []).map((asset) => ({ source: asset, rows: (db.depreciationSchedules || []).filter((x) => String(x.sourceId) === String(asset.id)), target: Math.max(0, vnd(asset.originalCost) - vnd(asset.residualValue)) }))
    ].filter((x) => x.rows.length && vnd(sum(x.rows, (r) => r.amount)) !== x.target).length;
    add('ASSET_SCHEDULE_TOTAL', scheduleMismatch === 0, 'critical', 'Tổng lịch phân bổ/khấu hao khớp giá trị phải phân bổ', scheduleMismatch ? `${scheduleMismatch} lịch không khớp nguyên giá trừ giá trị thu hồi.` : 'Tổng lịch phân bổ và khấu hao khớp chính xác tới đồng cuối cùng.', scheduleMismatch);
    const scheduleJournalMismatch=[...(db.toolAllocationSchedules||[]),...(db.depreciationSchedules||[])].filter((row)=>!scheduleJournalMatch(db,row)).length;
    add('ASSET_SCHEDULE_JOURNAL',scheduleJournalMismatch===0,'critical','Lịch tài sản khớp chứng từ định kỳ',scheduleJournalMismatch?`${scheduleJournalMismatch} kỳ có chứng từ sai nguồn, sai tháng hoặc sai số tiền.`:'Mọi kỳ phân bổ/khấu hao khớp chứng từ nguồn và số tiền.',scheduleJournalMismatch);

    const duplicateAutoJournals = (() => { const seen = new Set(); let count = 0; (db.journalEntries || []).forEach((x) => { if (!x.sourceType || !x.sourceId) return; const key = `${x.sourceType}|${x.sourceId}`; if (seen.has(key)) count += 1; else seen.add(key); }); return count; })();
    add('AUTO_JOURNAL_UNIQUE', duplicateAutoJournals === 0, 'critical', 'Chứng từ tự động không bị sinh trùng', duplicateAutoJournals ? `${duplicateAutoJournals} chứng từ tự động bị trùng nguồn.` : 'Mỗi nghiệp vụ nguồn chỉ sinh một chứng từ tự động.', duplicateAutoJournals);

    const passCritical = checks.filter((x) => x.severity === 'critical').every((x) => x.pass);
    const score = Math.round(checks.reduce((s, x) => s + (x.pass ? (x.severity === 'critical' ? 10 : 5) : 0), 0) / checks.reduce((s, x) => s + (x.severity === 'critical' ? 10 : 5), 0) * 100);
    return { checks, passCritical, score };
  }

  return {
    n, vnd, sum, isISODate, localISODate, inRange, statusIs, projectLifecycle, contractIsCommitted, activeInvoice, financePaid, allocationIsPosted, allocationIsRecognized, pitWithholdingIsRecognized, isInternalTransfer, financeJournalMatch, financeJournalCandidates, inputVatBankPaymentMatch, inputVatPaymentEvidence, inputInvoicePaymentConstraint, invoiceAllocationConstraint, paymentAllocationConstraint, workingDaysInRange, monthlyEmploymentCost, documentIdentity, stableEntryString, sha256, legacyPostingHash, upgradePostingHash, journalTotal, entryValidation, postingHash, verifyPostingHash,
    postedEntries, postedLines, accountMovement, accountEnding, trialBalance, accountTypeMovement, profitAndLoss,
    accountBalance, partnerBalances, costPerHour, approvedTimesheets, laborCost, classifyCostNature, projectDirectExpenses,
    projectCost, projectPostedCost, projectActualCost, projectContracts, projectCommercialValue, projectContractValue, invoiceAllocatedAmount, invoiceAging, contractRegisterSummary, contractDeletionPlan, entityDeletionPlan, contractValueOutliers,
    projectCommercials, approvedBudget, projectStageProgress, remainingResourcePlanCost, projectCommitments,
    cashFlow, ledgerCashFlow, vatInputDeductionAssessment, vatRegisterSummary, vatLedgerSummary, pitRegisterSummary, citPolicyYear, citRate, citEstimate, pitWithholdingThresholdForDate, pitWithholding,
    monthlySeries, revenueByDepartment, rangeDays, monthlyAccountBalance, financeBreakdown, monthlyFinanceByCategory,
    headcountByDepartment, peopleUtilization, payrollByDepartment, revenueByClient, revenueByStage, expenseByGroup, dso,
    integrityChecks, dataLinkAudit, isPeriodLocked, accountsByPrefixes, endingDebitByPrefixes, endingCreditByPrefixes, movementNetByPrefixes, fiscalYearStartFor, cashFlowExpectedDirection, cashFlowActualDirection,
    validateProject, validateTimesheet, projectScheduleProgress, syncProjectQuickInputs, projectFinancials, portfolioHealth,
    classifyPurchase, straightLineSchedule, purchaseJournalBlueprint, periodicJournalBlueprint, nextDocumentNumber, scheduleRebuildPlan, scheduleJournalMatch,
    financialPosition, financialRatios, financialForecast, financialLinkAudit, repairExactLinks, cashFlowForecastQuality,
    tt133B01a, tt133B02, tt133B03Direct, tt133F01, tt133B09, tt133ReportChecks, tt133ReportParity, tt99B01, tt99B02, tt99B03Direct, tt99B09, tt99ReportChecks, tt132B01, tt132B02, tt132F01, tt132F02, tt132ReportChecks
  };
});
