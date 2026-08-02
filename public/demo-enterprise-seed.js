(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AlphaEnterpriseDemo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const vnd = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return 0;
    return n < 0 ? -Math.round(Math.abs(n)) : Math.round(n);
  };
  const distribute = (value, count) => {
    const total = Math.max(0, vnd(value));
    const parts = Math.max(1, Math.trunc(Number(count)) || 1);
    const base = Math.floor(total / parts);
    const remainder = total - base * parts;
    return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const iso = (month, day) => `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const push = (db, key, row) => {
    if (!Array.isArray(db[key])) db[key] = [];
    db[key].push(row);
  };

  function createEnterpriseDemo(baseData, options = {}) {
    const db = clone(baseData || {});
    const projectCount = Math.max(1, Math.trunc(Number(options.projectCount ?? 48)));
    const targetPeople = Math.max(4, Math.trunc(Number(options.peopleCount ?? 100)));
    const committedProjectCount = Math.min(projectCount, Math.max(1, Math.trunc(Number(options.committedProjectCount ?? 40))));
    const basePeopleCount = Array.isArray(db.people) ? db.people.length : 0;
    const peopleToAdd = Math.max(0, targetPeople - basePeopleCount);
    const departments = ['Kiến trúc', 'Kết cấu', 'MEP', 'Quy hoạch', 'Cảnh quan', 'Nội thất', 'QS & Dự toán', 'PMO / QA'];
    const roles = ['Kiến trúc sư', 'Kỹ sư kết cấu', 'Kỹ sư MEP', 'Kiến trúc sư quy hoạch', 'Kiến trúc sư cảnh quan', 'Thiết kế nội thất', 'Kỹ sư dự toán', 'Điều phối dự án'];
    const projectTypes = ['Hotel', 'Resort', 'Mixed-use', 'Hospital', 'School', 'Factory', 'Urban Planning', 'Landscape'];
    const projectNames = ['Tổ hợp khách sạn biển', 'Khu nghỉ dưỡng sinh thái', 'Trung tâm thương mại hỗn hợp', 'Bệnh viện quốc tế', 'Trường liên cấp', 'Nhà máy công nghệ cao', 'Khu đô thị mới', 'Công viên cảnh quan'];

    db.version = '4.5.32';
    db.settings = {
      ...(db.settings || {}),
      employerBurdenRate: 23.5,
      targetUtilization: 75,
      overheadMonthly: 950000000,
      previousYearRevenue: 780000000000,
      previousYearTaxRevenueBasis: 780000000000,
      minimumCashBuffer: 5000000000
    };

    for (let i = 1; i <= peopleToAdd; i += 1) {
      const sequence = basePeopleCount + i;
      const departmentIndex = (sequence - 1) % departments.length;
      const isCtv = sequence > 72;
      const monthlySalary = isCtv ? 0 : 18000000 + (sequence % 11) * 1750000;
      const hourlyRate = isCtv ? 165000 + (sequence % 9) * 22000 : 0;
      push(db, 'people', {
        id: `ep-${String(sequence).padStart(3, '0')}`,
        code: isCtv ? `CTV-${String(sequence).padStart(3, '0')}` : `AD-${String(sequence).padStart(3, '0')}`,
        name: `Nhân sự kiểm thử ${String(sequence).padStart(3, '0')}`,
        role: roles[departmentIndex],
        department: departments[departmentIndex],
        type: isCtv ? 'CTV' : 'Fixed',
        monthlySalary,
        hourlyRate,
        billingRate: 330000 + departmentIndex * 45000 + (sequence % 5) * 15000,
        startDate: iso(1 + (sequence % 4), 1 + (sequence % 20)),
        status: 'Active'
      });
    }

    for (let i = 1; i <= 24; i += 1) {
      push(db, 'clients', {
        id: `ec-${String(i).padStart(3, '0')}`,
        code: `KH-LARGE-${String(i).padStart(3, '0')}`,
        name: `Chủ đầu tư mô phỏng quy mô lớn ${String(i).padStart(2, '0')}`,
        taxCode: `01${String(70000000 + i * 113).padStart(8, '0')}`,
        contact: `Đại diện khách hàng ${String(i).padStart(2, '0')}`,
        phone: `09${String(10000000 + i * 137).slice(-8)}`,
        email: `client${String(i).padStart(2, '0')}@demo.alpha.local`,
        status: i % 7 === 0 ? 'Lead' : 'Active'
      });
    }

    const people = db.people || [];
    let expectedContractValue = 0;
    let expectedPipelineValue = 0;
    let expectedOutputVat = 0;
    let expectedInputVat = 0;
    let expectedCashIn = 0;
    let expectedCashOut = 0;
    let expectedRevenue = 0;
    let expectedRecognizedCost = 0;

    for (let i = 1; i <= projectCount; i += 1) {
      const projectId = `lp-${String(i).padStart(3, '0')}`;
      const clientId = `ec-${String(((i - 1) % 24) + 1).padStart(3, '0')}`;
      const pm = people[(i * 7) % Math.min(72, people.length)] || people[0];
      const committed = i <= committedProjectCount;
      const contractValue = 10500000000 + i * 375000000;
      const budgetRatio = 0.38 + (i % 5) * 0.02;
      const directBudget = vnd(contractValue * budgetRatio);
      const projectStatus = committed ? (i % 11 === 0 ? 'Completed' : i % 5 === 0 ? 'Review' : 'In Progress') : 'Proposal';
      const startMonth = 1 + ((i - 1) % 6);
      const progress = committed ? Math.min(100, 18 + (i * 7) % 79) : 5 + (i % 12);
      const project = {
        id: projectId,
        code: `AD-LARGE-${String(i).padStart(3, '0')}`,
        name: `${projectNames[(i - 1) % projectNames.length]} ${String(i).padStart(2, '0')}`,
        clientId,
        type: projectTypes[(i - 1) % projectTypes.length],
        stage: ['Concept', 'TKCS', 'TKKT', 'TKTC'][i % 4],
        pmId: pm?.id || '',
        status: projectStatus,
        startDate: iso(startMonth, 1 + (i % 12)),
        endDate: iso(Math.min(12, startMonth + 5), 18 + (i % 10)),
        contractValue,
        directBudget,
        progress,
        risk: i % 9 === 0 ? 'High' : i % 3 === 0 ? 'Medium' : 'Low',
        expectedRiskCost: vnd(directBudget * (0.015 + (i % 3) * 0.005)),
        progressMode: 'weighted'
      };
      push(db, 'projects', project);
      if (committed) expectedContractValue += contractValue; else expectedPipelineValue += contractValue;

      const contractId = `lct-${String(i).padStart(3, '0')}`;
      push(db, 'contracts', {
        id: contractId,
        projectId,
        clientId,
        contractNo: `AD/HĐ-LARGE/${String(i).padStart(3, '0')}/2026`,
        contractType: 'customer',
        signedDate: committed ? iso(startMonth, 1 + (i % 8)) : '',
        effectiveDate: committed ? iso(startMonth, 1 + (i % 8)) : '',
        expiryDate: project.endDate,
        valueExclVat: contractValue,
        vatRate: i % 4 === 0 ? 8 : 10,
        status: committed ? (i % 11 === 0 ? 'Completed' : 'Signed') : 'Draft',
        ownerId: pm?.id || ''
      });

      const milestoneValues = distribute(contractValue, 4);
      ['Tạm ứng khởi động', 'Nghiệm thu thiết kế cơ sở', 'Nghiệm thu thiết kế kỹ thuật', 'Bàn giao hồ sơ hoàn chỉnh'].forEach((name, index) => {
        push(db, 'billingMilestones', {
          id: `lbm-${i}-${index + 1}`,
          contractId,
          projectId,
          milestoneNo: index + 1,
          name,
          percentage: vnd(milestoneValues[index] * 1000000 / contractValue) / 10000,
          amountExclVat: milestoneValues[index],
          dueDate: iso(Math.min(12, startMonth + index + 1), 10 + ((i + index) % 15)),
          acceptanceStatus: committed && index === 0 ? 'Approved' : committed && index === 1 ? 'Pending' : 'Not started',
          invoiceStatus: committed && index === 0 ? 'Invoiced' : 'Not invoiced',
          paymentStatus: committed && index === 0 && i % 4 === 0 ? 'Paid' : 'Unpaid'
        });
      });

      const budgetVersionId = `lbv-${String(i).padStart(3, '0')}`;
      push(db, 'projectBudgetVersions', {
        id: budgetVersionId,
        projectId,
        versionNo: 1,
        versionName: 'Enterprise Stress Baseline v1',
        status: 'Approved',
        contractValue,
        directBudget,
        contingency: vnd(directBudget * 0.04),
        targetMarginPercent: 32,
        effectiveFrom: project.startDate,
        expectedRiskCost: project.expectedRiskCost
      });
      const budgetParts = distribute(directBudget, 5);
      ['internal_labor', 'collaborator', 'consultant', 'printing', 'other_direct'].forEach((costType, index) => {
        push(db, 'projectBudgetLines', {
          id: `lbl-${i}-${index + 1}`,
          budgetVersionId,
          costType,
          description: `Ngân sách ${costType} dự án tải lớn ${String(i).padStart(2, '0')}`,
          quantity: 1,
          unitRate: budgetParts[index],
          amount: budgetParts[index],
          plannedHours: index < 3 ? 1600 + i * 12 + index * 320 : 0
        });
      });

      const stageProgress = [Math.min(100, progress + 25), Math.min(100, progress + 8), Math.max(0, progress - 10), Math.max(0, progress - 28)];
      ['CONCEPT', 'BASIC', 'TECHNICAL', 'ISSUE'].forEach((code, index) => {
        push(db, 'projectStages', {
          id: `lst-${i}-${index + 1}`,
          projectId,
          code,
          name: ['Concept & Brief', 'Thiết kế cơ sở', 'Thiết kế kỹ thuật', 'Phát hành hồ sơ'][index],
          weightPercent: [20, 30, 30, 20][index],
          plannedStart: iso(Math.min(12, startMonth + index), 1 + ((i + index) % 10)),
          plannedEnd: iso(Math.min(12, startMonth + index + 1), 15 + ((i + index) % 10)),
          progressPercent: stageProgress[index],
          status: stageProgress[index] >= 100 ? 'Completed' : stageProgress[index] > 0 ? 'In Progress' : 'Not Started'
        });
      });

      for (let taskIndex = 1; taskIndex <= 4; taskIndex += 1) {
        const assignee = people[(i * 11 + taskIndex * 13) % people.length];
        const taskStatus = ['In Progress', 'Review', 'Done', 'Not Started'][(i + taskIndex) % 4];
        push(db, 'tasks', {
          id: `ltk-${i}-${taskIndex}`,
          projectId,
          title: `${['Triển khai kiến trúc', 'Mô hình kết cấu', 'Phối hợp MEP', 'QA/QC phát hành'][taskIndex - 1]} — gói ${String(i).padStart(2, '0')}`,
          assigneeId: assignee?.id || '',
          status: taskStatus,
          priority: taskIndex === 4 ? 'High' : taskIndex === 1 ? 'Medium' : 'Normal',
          startDate: iso(1 + ((i + taskIndex) % 8), 1 + ((i * 3 + taskIndex) % 20)),
          dueDate: iso(4 + ((i + taskIndex) % 8), 8 + ((i * 5 + taskIndex) % 18)),
          estimatedHours: 80 + ((i * taskIndex) % 90),
          actualHours: taskStatus === 'Done' ? 75 + ((i * taskIndex) % 85) : 25 + ((i + taskIndex) % 55)
        });
      }

      for (let tsIndex = 1; tsIndex <= 12; tsIndex += 1) {
        const person = people[(i * 17 + tsIndex * 19) % people.length];
        const month = 1 + ((i + tsIndex) % 10);
        const hours = 4 + ((i * 3 + tsIndex) % 10) * 0.5;
        push(db, 'timesheets', {
          id: `lts-${i}-${tsIndex}`,
          date: iso(month, 1 + ((i * 7 + tsIndex * 2) % 27)),
          projectId,
          personId: person?.id || '',
          hours,
          billable: (i + tsIndex) % 5 !== 0,
          description: ['Thiết kế', 'Mô hình BIM', 'Phối hợp bộ môn', 'Kiểm tra hồ sơ'][tsIndex % 4],
          approved: (i + tsIndex) % 11 !== 0
        });
      }

      for (let planIndex = 1; planIndex <= 4; planIndex += 1) {
        const person = people[(i * 5 + planIndex * 23) % people.length];
        const rate = person?.type === 'CTV'
          ? Number(person.hourlyRate || 0)
          : vnd(Number(person?.monthlySalary || 0) * 1.235 / 176);
        push(db, 'resourcePlans', {
          id: `lrp-${i}-${planIndex}`,
          projectId,
          personId: person?.id || '',
          month: `2026-${String(8 + planIndex).padStart(2, '0')}`,
          plannedHours: 96 + ((i + planIndex) % 7) * 12,
          costRate: rate,
          status: 'Approved'
        });
      }

      for (let commitmentIndex = 1; commitmentIndex <= 2; commitmentIndex += 1) {
        const amount = vnd(directBudget * (0.018 + commitmentIndex * 0.007));
        push(db, 'commitments', {
          id: `lcm-${i}-${commitmentIndex}`,
          projectId,
          type: commitmentIndex === 1 ? 'Subconsultant' : 'Printing',
          description: `${commitmentIndex === 1 ? 'Tư vấn chuyên ngành' : 'In ấn phát hành'} dự án tải lớn`,
          amount,
          recognizedAmount: committed ? vnd(amount * 0.25) : 0,
          dueDate: iso(9 + commitmentIndex, 10 + (i % 15)),
          status: 'Approved'
        });
      }

      push(db, 'documents', {
        id: `ldoc-${i}-1`, title: `Hợp đồng dự án tải lớn ${String(i).padStart(2, '0')}`, type: 'Contract', projectId,
        version: '01', status: committed ? 'Signed' : 'Draft', ownerId: pm?.id || '', date: project.startDate
      });
      push(db, 'documents', {
        id: `ldoc-${i}-2`, title: `Bộ hồ sơ thiết kế dự án tải lớn ${String(i).padStart(2, '0')}`, type: 'Drawing Set', projectId,
        version: String(1 + (i % 5)).padStart(2, '0'), status: committed ? 'Review' : 'Draft', ownerId: pm?.id || '', date: iso(7 + (i % 4), 5 + (i % 20))
      });
      push(db, 'approvals', {
        id: `lap-${String(i).padStart(3, '0')}`,
        date: iso(6 + (i % 5), 2 + (i % 24)),
        type: i % 2 === 0 ? 'Đề nghị thanh toán' : 'Phê duyệt hồ sơ',
        title: `Yêu cầu kiểm thử dự án ${String(i).padStart(2, '0')}`,
        requesterId: pm?.id || '',
        amount: vnd(250000000 + i * 17500000),
        projectId,
        status: i % 5 === 0 ? 'Pending' : i % 7 === 0 ? 'Rejected' : 'Approved'
      });

      if (!committed) {
        push(db, 'quotes', {
          id: `lq-${String(i).padStart(3, '0')}`,
          date: iso(7 + (i % 3), 3 + (i % 20)),
          clientId,
          projectId,
          projectName: project.name,
          amount: contractValue,
          probability: 35 + (i % 6) * 10,
          status: i % 2 === 0 ? 'Negotiation' : 'Proposal'
        });
        continue;
      }

      const vatRate = i % 4 === 0 ? 8 : 10;
      const invoicePercent = 25 + (i % 4) * 10;
      const invoiceNet = vnd(contractValue * invoicePercent / 100);
      const outputVat = vnd(invoiceNet * vatRate / 100);
      const invoiceGross = invoiceNet + outputVat;
      const invoiceId = `lout-${String(i).padStart(3, '0')}`;
      const invoiceJournalId = `lje-out-${String(i).padStart(3, '0')}`;
      const invoiceDate = iso(3 + (i % 6), 2 + (i % 20));
      expectedOutputVat += outputVat;
      expectedRevenue += invoiceNet;
      push(db, 'taxInvoices', {
        id: invoiceId, direction: 'Output', date: invoiceDate, dueDate: iso(5 + (i % 6), 5 + (i % 20)),
        invoiceNo: String(10000000 + i), serial: '1C26LGA', partnerType: 'client', partnerId: clientId,
        taxCode: db.clients.find((x) => x.id === clientId)?.taxCode || '', description: `Dịch vụ thiết kế dự án tải lớn ${String(i).padStart(2, '0')}`,
        projectId, contractId, taxBase: invoiceNet, vatRate, vatAmount: outputVat, totalAmount: invoiceGross,
        status: 'Valid', deductible: true, paymentMethod: 'Bank', paymentStatus: 'Partial', journalEntryId: invoiceJournalId, notes: 'Dữ liệu kiểm thử tải lớn v4.5.32'
      });
      push(db, 'journalEntries', {
        id: invoiceJournalId, date: invoiceDate, documentNo: `HĐ-LARGE-${String(i).padStart(3, '0')}`, sourceType: 'Hóa đơn đầu ra',
        sourceId: invoiceId, description: `Ghi nhận doanh thu dự án tải lớn ${String(i).padStart(2, '0')}`, status: 'Posted', projectId,
        partnerType: 'client', partnerId: clientId, lines: [
          { accountCode: '131', debit: invoiceGross, credit: 0, description: 'Phải thu khách hàng' },
          { accountCode: '5113', debit: 0, credit: invoiceNet, description: 'Doanh thu dịch vụ thiết kế' },
          { accountCode: '33311', debit: 0, credit: outputVat, description: 'Thuế GTGT đầu ra' }
        ]
      });

      const collectionRate = [70, 80, 90, 100][i % 4];
      const paidGross = vnd(invoiceGross * collectionRate / 100);
      const receiptId = `lfin-in-${String(i).padStart(3, '0')}`;
      const receiptJournalId = `lje-in-${String(i).padStart(3, '0')}`;
      const receiptDate = iso(6 + (i % 5), 2 + (i % 24));
      expectedCashIn += paidGross;
      push(db, 'finance', {
        id: receiptId, date: receiptDate, type: 'Income', category: 'Thu tiền hợp đồng lớn', projectId,
        amount: paidGross, status: 'Paid', journalEntryId: receiptJournalId, description: `Thu ${collectionRate}% hóa đơn dự án tải lớn`
      });
      push(db, 'journalEntries', {
        id: receiptJournalId, date: receiptDate, documentNo: `BC-LARGE-${String(i).padStart(3, '0')}`, sourceType: 'Báo Có', cashFlowCode: '01',
        description: `Thu tiền dự án tải lớn ${String(i).padStart(2, '0')}`, status: 'Posted', projectId, partnerType: 'client', partnerId: clientId,
        lines: [
          { accountCode: '1121', debit: paidGross, credit: 0, description: 'Tiền gửi ngân hàng' },
          { accountCode: '131', debit: 0, credit: paidGross, description: 'Giảm phải thu khách hàng' }
        ]
      });
      push(db, 'paymentAllocations', { id: `lpa-${String(i).padStart(3, '0')}`, paymentId: receiptId, invoiceId, date: receiptDate, amount: paidGross, status: 'Posted' });

      const directNet = vnd(contractValue * (0.035 + (i % 4) * 0.005));
      const inputVat = vnd(directNet * vatRate / 100);
      const directGross = directNet + inputVat;
      const inputInvoiceId = `lin-${String(i).padStart(3, '0')}`;
      const costJournalId = `lje-cost-${String(i).padStart(3, '0')}`;
      const costRecognitionId = `lje-rec-${String(i).padStart(3, '0')}`;
      const paymentJournalId = `lje-pay-${String(i).padStart(3, '0')}`;
      const expenseFinanceId = `lfin-out-${String(i).padStart(3, '0')}`;
      const costDate = iso(4 + (i % 6), 3 + (i % 20));
      const paymentDate = iso(7 + (i % 5), 3 + (i % 23));
      const vendorId = i % 2 === 0 ? 'v2' : 'v1';
      expectedInputVat += inputVat;
      expectedCashOut += directGross;
      expectedRecognizedCost += directNet;
      push(db, 'taxInvoices', {
        id: inputInvoiceId, direction: 'Input', date: costDate, dueDate: paymentDate,
        invoiceNo: String(20000000 + i), serial: '1C26LGV', partnerType: 'vendor', partnerId: vendorId,
        taxCode: db.vendors?.find((x) => x.id === vendorId)?.taxCode || '', description: `Chi phí tư vấn và triển khai dự án lớn ${String(i).padStart(2, '0')}`,
        projectId, taxBase: directNet, vatRate, vatAmount: inputVat, totalAmount: directGross,
        status: 'Valid', deductible: true, paymentMethod: 'Bank', paymentStatus: 'Paid', paidDate: paymentDate,
        journalEntryId: costJournalId, notes: 'Dữ liệu kiểm thử tải lớn v4.5.32'
      });
      push(db, 'journalEntries', {
        id: costJournalId, date: costDate, documentNo: `MH-LARGE-${String(i).padStart(3, '0')}`, sourceType: 'Hóa đơn đầu vào', sourceId: inputInvoiceId,
        description: `Ghi nhận chi phí trực tiếp dự án lớn ${String(i).padStart(2, '0')}`, status: 'Posted', projectId, partnerType: 'vendor', partnerId: vendorId,
        lines: [
          { accountCode: '154', debit: directNet, credit: 0, description: 'Chi phí trực tiếp dự án' },
          { accountCode: '1331', debit: inputVat, credit: 0, description: 'VAT đầu vào được khấu trừ' },
          { accountCode: '331', debit: 0, credit: directGross, description: 'Phải trả nhà cung cấp' }
        ]
      });
      push(db, 'journalEntries', {
        id: costRecognitionId, date: costDate, documentNo: `GV-LARGE-${String(i).padStart(3, '0')}`, sourceType: 'Kết chuyển giá vốn',
        description: `Kết chuyển chi phí dự án tải lớn ${String(i).padStart(2, '0')}`, status: 'Posted', projectId,
        lines: [
          { accountCode: '632', debit: directNet, credit: 0, description: 'Giá vốn dịch vụ dự án' },
          { accountCode: '154', debit: 0, credit: directNet, description: 'Kết chuyển chi phí dở dang' }
        ]
      });
      push(db, 'finance', {
        id: expenseFinanceId, date: paymentDate, type: 'Expense', category: 'Chi phí trực tiếp dự án', projectId,
        vendorId, invoiceId: inputInvoiceId, amount: directGross, status: 'Paid', journalEntryId: paymentJournalId, costNature: 'DirectNonLabor', description: `Thanh toán chi phí trực tiếp dự án lớn ${String(i).padStart(2, '0')}`
      });
      push(db, 'journalEntries', {
        id: paymentJournalId, date: paymentDate, documentNo: `UNC-LARGE-${String(i).padStart(3, '0')}`, sourceType: 'Ủy nhiệm chi', cashFlowCode: '02',
        description: `Thanh toán nhà cung cấp dự án tải lớn ${String(i).padStart(2, '0')}`, status: 'Posted', projectId, partnerType: 'vendor', partnerId: vendorId,
        lines: [
          { accountCode: '331', debit: directGross, credit: 0, description: 'Thanh toán công nợ nhà cung cấp' },
          { accountCode: '1121', debit: 0, credit: directGross, description: 'Tiền gửi ngân hàng' }
        ]
      });
    }

    const totalRecords = Object.values(db).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    db.demoScenario = {
      id: 'ENTERPRISE_LOAD_100_PEOPLE_48_PROJECTS_V4532',
      releaseVersion: '4.5.32',
      generatedAt: '2026-07-29',
      deterministic: true,
      people: (db.people || []).length,
      addedLargeProjects: projectCount,
      projectsOver10B: (db.projects || []).filter((x) => Number(x.contractValue || 0) > 10000000000).length,
      committedLargeProjects: committedProjectCount,
      totalProjects: (db.projects || []).length,
      tasks: (db.tasks || []).length,
      timesheets: (db.timesheets || []).length,
      journalEntries: (db.journalEntries || []).length,
      taxInvoices: (db.taxInvoices || []).length,
      totalRecords,
      expected: {
        addedContractValue: vnd(expectedContractValue),
        addedPipelineValue: vnd(expectedPipelineValue),
        addedOutputVat: vnd(expectedOutputVat),
        addedInputVat: vnd(expectedInputVat),
        addedCashIn: vnd(expectedCashIn),
        addedCashOut: vnd(expectedCashOut),
        addedRevenue: vnd(expectedRevenue),
        addedRecognizedCost: vnd(expectedRecognizedCost)
      }
    };
    return db;
  }

  return { createEnterpriseDemo, distributeVnd: distribute, vnd };
});
