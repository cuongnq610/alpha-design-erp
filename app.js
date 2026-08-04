(() => {
  'use strict';

  const RELEASE_VERSION = '4.5.67';
  const DATABASE_MIGRATION_VERSION = 75;
  const RELEASE_LABEL = 'DEEP QA AUTOHEAL RELEASE';
  // legacy audit marker retained for compatibility: releaseVersion:'4.5.55',migrationVersion:68
  const STORAGE_KEY = 'alpha_design_erp_cloud_v4_5_58_tt99_export_activation';
  const REPORT_PERIOD_STORAGE_KEY = 'alpha_design_erp_reporting_period_v1';
  let suppressSyncCapture = false;
  const Calc = window.AlphaCalc;
  const ReportingPeriod = window.AlphaReportingPeriod;
  const StatutoryTemplates = window.AlphaStatutoryTemplateManager;
  const TaxPackages = window.AlphaTaxCompliancePackageManager;
  const TaxCalendar = window.AlphaTaxCalendar;
  const AccountingOps = window.AlphaAccountingOperations;
  const Payroll = window.AlphaPayrollDetail;
  const AnnualBenefits = window.AlphaAnnualBenefits;
  const RecycleBin = window.AlphaRecycleBin;
  if(!ReportingPeriod)throw new Error('Thiếu mô-đun kỳ báo cáo động.');
  if(!StatutoryTemplates)throw new Error('Thiếu mô-đun quản lý bộ mẫu BCTC.');
  if(!TaxPackages)throw new Error('Thiếu mô-đun quản lý gói tuân thủ thuế.');
  if(!TaxCalendar)throw new Error('Thiếu mô-đun lịch nghĩa vụ thuế tự động.');
  if(!AccountingOps)throw new Error('Thiếu mô-đun kiểm soát chu trình kế toán.');
  if(!Payroll)throw new Error('Thiếu mô-đun bảng lương chi tiết.');
  if(!AnnualBenefits)throw new Error('Thiếu mô-đun ngân sách thưởng và phúc lợi năm.');
  if(!RecycleBin)throw new Error('Thiếu mô-đun Thùng rác và khôi phục dữ liệu.');
  const LEGACY_STORAGE_KEYS = ['alpha_design_erp_cloud_v4_5_55_ui_tax_accounting_refinement','alpha_design_erp_cloud_v4_5_54_end_to_end_input_accounting_qa_ui_refinement','alpha_design_erp_cloud_v4_5_53_clear_charts_tax_calendar_manual_cit','alpha_design_erp_cloud_v4_5_47_accounting_operations_tax_package_hardening','alpha_design_erp_cloud_v4_5_46_sticky_table_workflow_formula_hardened','alpha_design_erp_cloud_v4_5_44_global_table_grid_alignment','alpha_design_erp_cloud_v4_5_43_payroll_header_layout_refinement','alpha_design_erp_cloud_v4_5_42_detailed_employee_payroll','alpha_design_erp_cloud_v4_5_41_stability_browser_qa_data_quality_hardened','alpha_design_erp_cloud_v4_5_40_template_manager_filter_chart_tax_refinement','alpha_design_erp_cloud_v4_5_38_production_financial_certification','alpha_design_erp_cloud_v4_5_35_table_filter_layout_refinement','alpha_design_erp_cloud_v4_5_34_targeted_ui_filter_fixes','alpha_design_erp_cloud_v4_5_0_responsive_mobile_tablet','alpha_design_erp_cloud_v4_4_0_notification_ui_formula_audit','alpha_design_erp_cloud_v4_3_0_ui_icon_formula_linkage_audit','alpha_design_erp_cloud_v4_1_0_financial_analytics_forecast','alpha_design_erp_cloud_v4_2_0_ui_rbac_linkage_audit','alpha_design_erp_cloud_v4_0_0_procurement_asset_control','alpha_design_erp_cloud_v3_9_1_control_tabs_hotfix','alpha_design_erp_cloud_v3_9_2_sidebar_scroll_hotfix','alpha_design_erp_cloud_v3_8_0_long_term_core','alpha_design_erp_cloud_v3_7_1_final_release','alpha_design_erp_cloud_v3_6_3_internal_pilot','alpha_design_erp_cloud_v3_5_algorithm_first','alpha_design_erp_cloud_v2_1_reliable','alpha_design_erp_cloud_v2','alpha_design_erp_web_v1','alpha_design_erp_core_v03','alpha_design_erp_core_v02','alpha_design_erp_core_v01'];
  LEGACY_STORAGE_KEYS.unshift('alpha_design_erp_cloud_v4_5_57_qa_hardened','alpha_design_erp_cloud_v4_5_56_version_final');
  const uid = (prefix) => {
    const strongId=globalThis.crypto?.randomUUID?.();
    return strongId?`${prefix}-${strongId}`:`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };
  const today = () => Calc.localISODate();
  const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const demoData = {
    version: '4.5.67',
    settings: {
      companyName: 'ALPHA DESIGN CO., LTD',
      companyAddress: '',
      taxpayerCode: '',
      reportUnit: 'VND',
      currency: 'VND',
      targetMargin: 30,
      laborBudgetRatio: 38,
      overheadMonthly: 120000000,
      monthlyWorkingHours: 176,
      dailyWorkingHours: 8,
      employeeInsuranceRate: 10.5,
      employerInsuranceRate: 21.5,
      personalDeduction: 15500000,
      dependentDeduction: 6200000,
      personalDeductionPrevious: 11000000,
      dependentDeductionPrevious: 4400000,
      fixedPitScheduleEffectiveDate: '2026-01-01',
      overtimeMultiplier: 1.5,
      insuranceProrateByWorkdays: false,
      payrollPolicyVersion: 'ALPHA-PAYROLL-2026.03',
      annualBenefitsPolicyVersion: 'ALPHA-BENEFITS-2026.01',
      accountingRegime: 'TT133/2016/TT-BTC (DNNVV)',
      accountingRegimeEffectiveDate: '2026-01-01',
      fiscalYearStart: '01-01',
      vatMethod: 'Khấu trừ',
      defaultVatRate: 10,
      reducedVatRate: 8,
      vatReductionEnd: '2026-12-31',
      taxFilingFrequency: 'Quarterly',
      taxReminderWindowDays: 30,
      pitWithholdingRate: 10,
      pitWithholdingThreshold: 5000000,
      pitWithholdingThresholdPrevious: 2000000,
      pitWithholdingThresholdEffectiveDate: '2026-07-01',
      citRateMode: 'Manual',
      corporateTaxRate: 20,
      corporateTaxRateEffectiveDate: '2026-01-01',
      citManualRateHistory: [{effectiveFrom:'2026-01-01',rate:20,note:'Thuế suất do kế toán nhập và phê duyệt thủ công'}],
      previousYearRevenue: 4200000000,
      previousYearTaxRevenueBasis: 4200000000,
      employerBurdenRate: 0,
      latePaymentDailyRate: 0.03,
      maxContractValue: 1000000000000,
      taxAuthority: '',
      taxContactEmail: '',
      taxRuleVersion: 'Luật Quản lý thuế 38/2019/QH14 • NĐ 126/2020/NĐ-CP • TT 80/2021/TT-BTC và văn bản sửa đổi • Luật Thuế TNDN 67/2025/QH15 • NĐ 320/2025/NĐ-CP • Luật 09/2026/QH16 • tham số thuế do kế toán trưởng phê duyệt',
      accountingPolicyVersion: 'ALPHA-TT133-2026.02',
      fixedAssetThreshold: 30000000,
      toolMaxAllocationMonths: 36,
      procurementPolicyVersion: 'ALPHA-PROC-ASSET-2026.01',
      financialAnalyticsPolicyVersion: 'ALPHA-FINANCE-ANALYTICS-2026.01',
      forecastHorizonMonths: 12,
      minimumCashBuffer: 150000000,
      activeStatutoryTemplateId: ''
    },
    statutoryReportTemplates: [],
    taxCompliancePackages: [],
    notificationReads: [],
    trashEntries: [],
    people: [
      {id:'p1',code:'AD-001',name:'Giám đốc Demo',role:'Giám đốc',department:'Ban giám đốc',type:'Fixed',monthlySalary:0,monthlyAllowance:0,insuranceSalary:0,insuranceEnabled:false,dependentCount:0,pitResidence:'Resident',overtimeMultiplier:1.5,hourlyRate:0,billingRate:0,startDate:'2026-01-01',endDate:'',status:'Active'},
      {id:'p2',code:'AD-002',name:'Kiến trúc sư Demo',role:'Chủ trì Kiến trúc',department:'Kiến trúc',type:'Fixed',monthlySalary:28000000,monthlyAllowance:1500000,insuranceSalary:28000000,insuranceEnabled:true,dependentCount:0,pitResidence:'Resident',overtimeMultiplier:1.5,hourlyRate:0,billingRate:420000,startDate:'2026-01-01',endDate:'',status:'Active'},
      {id:'p3',code:'AD-003',name:'Kỹ sư Demo',role:'Kỹ sư Kết cấu',department:'Kết cấu',type:'Fixed',monthlySalary:22000000,monthlyAllowance:1000000,insuranceSalary:22000000,insuranceEnabled:true,dependentCount:0,pitResidence:'Resident',overtimeMultiplier:1.5,hourlyRate:0,billingRate:330000,startDate:'2026-01-01',endDate:'',status:'Active'},
      {id:'p4',code:'CTV-011',name:'CTV Demo',role:'3D Visualizer',department:'Kiến trúc',type:'CTV',monthlySalary:0,monthlyAllowance:0,insuranceSalary:0,insuranceEnabled:false,dependentCount:0,pitResidence:'Resident',overtimeMultiplier:1.5,hourlyRate:180000,billingRate:350000,startDate:'2026-01-01',endDate:'',status:'Active'}
    ],
    clients: [
      {id:'c1',code:'KH-001',name:'Công ty CP Du lịch Aurora',taxCode:'0109988776',contact:'Nguyễn Văn Bình',phone:'0900000001',email:'binh@aurora.vn',status:'Active'},
      {id:'c2',code:'KH-002',name:'Công ty TNHH Green Bay',taxCode:'0108877665',contact:'Trần Hồng Hà',phone:'0900000002',email:'ha@greenbay.vn',status:'Lead'}
    ],
    projects: [
      {id:'pr1',code:'AD-2601',name:'Khách sạn Aurora 4 sao',clientId:'c1',type:'Hotel',stage:'TKCS',pmId:'p2',status:'In Progress',startDate:'2026-06-01',endDate:'2026-10-31',contractValue:750000000,directBudget:410000000,progress:42,risk:'Medium',expectedRiskCost:10000000,progressMode:'weighted'},
      {id:'pr2',code:'AD-2602',name:'Quy hoạch cảnh quan Green Bay',clientId:'c2',type:'Landscape',stage:'Concept',pmId:'p2',status:'Proposal',startDate:'2026-07-10',endDate:'2026-09-30',contractValue:420000000,directBudget:220000000,progress:12,risk:'Low',progressMode:'weighted'}
    ],
    tasks: [
      {id:'t1',projectId:'pr1',title:'Hoàn thiện mặt bằng kiến trúc TKCS',assigneeId:'p2',status:'In Progress',priority:'High',startDate:'2026-07-15',dueDate:'2026-07-24',estimatedHours:36,actualHours:20},
      {id:'t2',projectId:'pr1',title:'Mô hình kết cấu sơ bộ',assigneeId:'p3',status:'Review',priority:'High',startDate:'2026-07-14',dueDate:'2026-07-22',estimatedHours:28,actualHours:24},
      {id:'t3',projectId:'pr2',title:'Moodboard cảnh quan',assigneeId:'p4',status:'Done',priority:'Medium',startDate:'2026-07-11',dueDate:'2026-07-18',estimatedHours:18,actualHours:17}
    ],
    timesheets: [
      {id:'ts1',date:'2026-07-17',projectId:'pr1',personId:'p2',hours:8,billable:true,description:'Thiết kế mặt bằng',approved:true},
      {id:'ts2',date:'2026-07-18',projectId:'pr1',personId:'p3',hours:7.5,billable:true,description:'Mô hình kết cấu',approved:true},
      {id:'ts3',date:'2026-07-18',projectId:'pr2',personId:'p4',hours:6,billable:true,description:'Render concept',approved:true},
      {id:'ts4',date:'2026-07-19',projectId:'pr1',personId:'p2',hours:4,billable:false,description:'Họp nội bộ và chỉnh QA',approved:false}
    ],
    payrollPeriods: [
      {id:'payp-2026-07',periodCode:'PAY-2026-07',month:'2026-07',dateFrom:'2026-07-01',dateTo:'2026-07-31',status:'Draft',preparedBy:'',preparedAt:'',reviewedBy:'',reviewedAt:'',approvedBy:'',approvedAt:'',calculationVersion:'ALPHA-PAYROLL-4.5.61'}
    ],
    payrollItems: [
      {id:'payi-p1-2026-07',payrollPeriodId:'payp-2026-07',personId:'p1',unpaidLeaveDays:0,allowanceMode:'Auto profile',allowances:0,overtimeMode:'Auto timesheet',overtimePay:0,bonus:0,otherIncome:0,insuranceMode:'Auto policy',employeeInsurance:null,employerInsurance:null,pitMode:'Auto progressive',personalIncomeTax:0,advanceDeduction:0,otherDeductions:0,notes:'Giám đốc demo chưa thiết lập lương.'},
      {id:'payi-p2-2026-07',payrollPeriodId:'payp-2026-07',personId:'p2',unpaidLeaveDays:0,allowanceMode:'Auto profile',allowances:0,overtimeMode:'Auto timesheet',overtimePay:0,bonus:1000000,otherIncome:0,insuranceMode:'Auto policy',employeeInsurance:null,employerInsurance:null,pitMode:'Auto progressive',personalIncomeTax:0,advanceDeduction:0,otherDeductions:0,notes:'Phụ cấp, bảo hiểm và TNCN tự động từ hồ sơ nhân sự.'},
      {id:'payi-p3-2026-07',payrollPeriodId:'payp-2026-07',personId:'p3',unpaidLeaveDays:1,allowanceMode:'Auto profile',allowances:0,overtimeMode:'Auto timesheet',overtimePay:0,bonus:0,otherIncome:0,insuranceMode:'Auto policy',employeeInsurance:null,employerInsurance:null,pitMode:'Auto progressive',personalIncomeTax:0,advanceDeduction:0,otherDeductions:0,notes:'Lương được tự động giảm theo ngày nghỉ không lương.'},
      {id:'payi-p4-2026-07',payrollPeriodId:'payp-2026-07',personId:'p4',unpaidLeaveDays:0,allowanceMode:'Auto profile',allowances:0,overtimeMode:'Auto timesheet',overtimePay:0,bonus:0,otherIncome:0,insuranceMode:'Auto policy',employeeInsurance:null,employerInsurance:null,pitMode:'Auto CTV',personalIncomeTax:0,advanceDeduction:0,otherDeductions:0,notes:'Tiền công và TNCN CTV tính từ timesheet đã duyệt.'}
    ],
    annualBenefitBudgets: [
      {id:'benefit-2026',year:2026,status:'Draft',minimumServiceDays:30,includeCTVBonus:false,companyPerformanceFactor:0.9,defaultEmployeePerformanceFactor:1,employeePerformanceFactors:{p1:1,p2:1.1,p3:1},bonusPaymentMode:'Gross',bonusTaxProvisionRate:10,bonusContingencyRate:5,travelParticipationRate:90,travelCostPerPerson:5000000,travelCommonCost:25000000,travelContingencyRate:7,otherWelfareSpent:10000000,notes:'Dữ liệu kế hoạch mô phỏng; kế toán và Giám đốc phải phê duyệt trước khi sử dụng.',calculationVersion:'ALPHA-BENEFITS-4.5.46'}
    ],
    finance: [
      {id:'f1',date:'2026-06-20',type:'Income',category:'Tạm ứng hợp đồng',projectId:'pr1',amount:225000000,status:'Paid',journalEntryId:'je2',description:'Đợt 1 - 30% giá trị hợp đồng'},
      {id:'f2',date:'2026-07-06',type:'Expense',category:'Thanh toán CTV',projectId:'pr1',amount:43200000,status:'Paid',journalEntryId:'je4',costNature:'LaborAlreadyCosted',description:'Thực trả CTV sau khấu trừ TNCN'},
      {id:'f3',date:'2026-07-15',type:'Expense',category:'Văn phòng',projectId:'',vendorId:'v2',invoiceId:'txi2',amount:18000000,status:'Paid',journalEntryId:'je5',description:'Thuê văn phòng và dịch vụ'},
      {id:'f4',date:'2026-07-25',type:'Income',category:'Nghiệm thu giai đoạn',projectId:'pr1',amount:187500000,status:'Pending',description:'Đợt 2 - dự kiến thu'}
    ],
    quotes: [
      {id:'q1',date:'2026-07-10',clientId:'c2',projectId:'pr2',projectName:'Quy hoạch cảnh quan Green Bay',amount:420000000,probability:65,status:'Negotiation'},
      {id:'q2',date:'2026-07-18',clientId:'c1',projectName:'Nội thất sảnh Aurora',amount:280000000,probability:35,status:'Proposal'}
    ],
    approvals: [
      {id:'a1',date:'2026-07-19',type:'Đề nghị thanh toán',title:'Thanh toán CTV phối cảnh đợt 1',requesterId:'p2',amount:32000000,projectId:'pr1',status:'Pending'},
      {id:'a2',date:'2026-07-16',type:'Đề nghị mua hàng',title:'Mua thêm ổ cứng lưu trữ dự án',requesterId:'p3',amount:8500000,projectId:'',status:'Approved'}
    ],
    documents: [
      {id:'d1',title:'Hợp đồng tư vấn thiết kế Aurora',type:'Contract',projectId:'pr1',version:'01',status:'Signed',ownerId:'p1',date:'2026-05-28'},
      {id:'d2',title:'Biên bản nghiệm thu giai đoạn Concept',type:'Acceptance',projectId:'pr1',version:'02',status:'Draft',ownerId:'p2',date:'2026-07-18'},
      {id:'d3',title:'Báo giá Green Bay',type:'Quotation',projectId:'pr2',version:'03',status:'Issued',ownerId:'p1',date:'2026-07-10'}
    ],
    vendors: [
      {id:'v1',code:'NCC-001',name:'CTV Demo',taxCode:'001206012345',resident:true,contractType:'CTV dưới 3 tháng',phone:'0900000011',email:'lan.ctv@example.com',type:'Individual',status:'Active'},
      {id:'v2',code:'NCC-002',name:'Công ty TNHH Văn phòng Hà Nội',taxCode:'0101234567',resident:true,contractType:'Nhà cung cấp',phone:'0900000012',email:'billing@officehn.vn',type:'Company',status:'Active'}
    ],
    accounts: [
      {id:'acc1111',code:'1111',name:'Tiền Việt Nam tại quỹ',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc1121',code:'1121',name:'Tiền Việt Nam gửi ngân hàng',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc131',code:'131',name:'Phải thu của khách hàng',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc1331',code:'1331',name:'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc141',code:'141',name:'Tạm ứng',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc154',code:'154',name:'Chi phí sản xuất, kinh doanh dở dang',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc153',code:'153',name:'Công cụ, dụng cụ',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc2112',code:'2112',name:'Máy móc, thiết bị',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc2113',code:'2113',name:'Phương tiện vận tải, truyền dẫn',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc2141',code:'2141',name:'Hao mòn tài sản cố định hữu hình',type:'Asset',normalSide:'Credit',active:true},
      {id:'acc242',code:'242',name:'Chi phí trả trước',type:'Asset',normalSide:'Debit',active:true},
      {id:'acc331',code:'331',name:'Phải trả cho người bán',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc33311',code:'33311',name:'Thuế GTGT đầu ra phải nộp',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc3334',code:'3334',name:'Thuế thu nhập doanh nghiệp',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc3335',code:'3335',name:'Thuế thu nhập cá nhân',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc334',code:'334',name:'Phải trả người lao động',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc3383',code:'3383',name:'Bảo hiểm xã hội',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc3384',code:'3384',name:'Bảo hiểm y tế',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc3386',code:'3386',name:'Bảo hiểm thất nghiệp',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc3411',code:'3411',name:'Các khoản đi vay',type:'Liability',normalSide:'Credit',active:true},
      {id:'acc4111',code:'4111',name:'Vốn góp của chủ sở hữu',type:'Equity',normalSide:'Credit',active:true},
      {id:'acc4212',code:'4212',name:'Lợi nhuận sau thuế chưa phân phối năm nay',type:'Equity',normalSide:'Credit',active:true},
      {id:'acc5113',code:'5113',name:'Doanh thu cung cấp dịch vụ',type:'Revenue',normalSide:'Credit',active:true},
      {id:'acc515',code:'515',name:'Doanh thu hoạt động tài chính',type:'Revenue',normalSide:'Credit',active:true},
      {id:'acc632',code:'632',name:'Giá vốn dịch vụ đã cung cấp',type:'Expense',normalSide:'Debit',active:true},
      {id:'acc635',code:'635',name:'Chi phí tài chính',type:'Expense',normalSide:'Debit',active:true},
      {id:'acc6421',code:'6421',name:'Chi phí bán hàng',type:'Expense',normalSide:'Debit',active:true},
      {id:'acc6422',code:'6422',name:'Chi phí quản lý doanh nghiệp',type:'Expense',normalSide:'Debit',active:true},
      {id:'acc811',code:'811',name:'Chi phí khác',type:'Expense',normalSide:'Debit',active:true}
    ],
    openingBalances: [
      {id:'ob1',asOfDate:'2026-01-01',accountCode:'1121',debit:500000000,credit:0,description:'Vốn góp ban đầu tại ngân hàng'},
      {id:'ob2',asOfDate:'2026-01-01',accountCode:'4111',debit:0,credit:500000000,description:'Vốn góp của chủ sở hữu'}
    ],
    journalEntries: [
      {id:'je1',date:'2026-06-18',documentNo:'HĐ-0001',sourceType:'Hóa đơn đầu ra',description:'Ghi nhận doanh thu đợt 1 hợp đồng Aurora',status:'Posted',projectId:'pr1',partnerType:'client',partnerId:'c1',lines:[
        {accountCode:'131',debit:225000000,credit:0,description:'Phải thu khách hàng'},
        {accountCode:'5113',debit:0,credit:204545455,description:'Doanh thu dịch vụ thiết kế'},
        {accountCode:'33311',debit:0,credit:20454545,description:'Thuế GTGT đầu ra'}]},
      {id:'je2',date:'2026-06-20',documentNo:'BC-0001',sourceType:'Báo Có',cashFlowCode:'01',description:'Khách hàng Aurora thanh toán đợt 1',status:'Posted',projectId:'pr1',partnerType:'client',partnerId:'c1',lines:[
        {accountCode:'1121',debit:225000000,credit:0,description:'Tiền vào ngân hàng'},
        {accountCode:'131',debit:0,credit:225000000,description:'Giảm phải thu khách hàng'}]},
      {id:'je3',date:'2026-07-05',documentNo:'PKT-0001',sourceType:'Phiếu kế toán',description:'Ghi nhận chi phí CTV triển khai kiến trúc',status:'Posted',projectId:'pr1',partnerType:'vendor',partnerId:'v1',lines:[
        {accountCode:'154',debit:48000000,credit:0,description:'Chi phí CTV theo dự án'},
        {accountCode:'331',debit:0,credit:48000000,description:'Phải trả CTV'}]},
      {id:'je4',date:'2026-07-06',documentNo:'UNC-0001',sourceType:'Ủy nhiệm chi',cashFlowCode:'02',description:'Thanh toán CTV, khấu trừ thuế TNCN',status:'Posted',projectId:'pr1',partnerType:'vendor',partnerId:'v1',lines:[
        {accountCode:'331',debit:48000000,credit:0,description:'Thanh toán công nợ CTV'},
        {accountCode:'1121',debit:0,credit:43200000,description:'Chuyển khoản thực nhận'},
        {accountCode:'3335',debit:0,credit:4800000,description:'Thuế TNCN khấu trừ'}]},
      {id:'je5',date:'2026-07-15',documentNo:'UNC-0002',sourceType:'Ủy nhiệm chi',cashFlowCode:'02',description:'Chi phí thuê văn phòng tháng 7',status:'Posted',projectId:'',partnerType:'vendor',partnerId:'v2',lines:[
        {accountCode:'6422',debit:16363636,credit:0,description:'Chi phí thuê văn phòng'},
        {accountCode:'1331',debit:1636364,credit:0,description:'Thuế GTGT đầu vào'},
        {accountCode:'1121',debit:0,credit:18000000,description:'Thanh toán qua ngân hàng'}]},
      {id:'je6',date:'2026-07-19',documentNo:'PKT-0002',sourceType:'Phiếu kế toán',description:'Kết chuyển giá vốn dịch vụ dự án',status:'Posted',projectId:'pr1',partnerType:'',partnerId:'',lines:[
        {accountCode:'632',debit:48000000,credit:0,description:'Giá vốn dịch vụ'},
        {accountCode:'154',debit:0,credit:48000000,description:'Kết chuyển chi phí dở dang'}]},
      {id:'je7',date:'2026-07-19',documentNo:'MH-0003',sourceType:'Hóa đơn đầu vào',sourceId:'txi3',description:'Vật tư văn phòng chờ hoàn thiện điều kiện khấu trừ',status:'Draft',projectId:'',partnerType:'vendor',partnerId:'v2',lines:[
        {accountCode:'6422',debit:5400000,credit:0,description:'Chi phí gồm VAT chưa đủ điều kiện khấu trừ'},
        {accountCode:'331',debit:0,credit:5400000,description:'Phải trả nhà cung cấp'}]}

    ],
    taxInvoices: [
      {id:'txi1',direction:'Output',date:'2026-06-18',dueDate:'2026-07-18',invoiceNo:'00000001',serial:'1C26TAA',partnerType:'client',partnerId:'c1',taxCode:'0109988776',description:'Dịch vụ tư vấn thiết kế Aurora – đợt 1',projectId:'pr1',contractId:'ct1',taxBase:204545455,vatRate:10,vatAmount:20454545,totalAmount:225000000,status:'Valid',deductible:true,paymentMethod:'Bank',paymentStatus:'Paid',journalEntryId:'je1',notes:''},
      {id:'txi2',direction:'Input',date:'2026-07-15',invoiceNo:'00001258',serial:'1C26TYY',partnerType:'vendor',partnerId:'v2',taxCode:'0101234567',description:'Thuê văn phòng tháng 7',projectId:'',taxBase:16363636,vatRate:10,vatAmount:1636364,totalAmount:18000000,status:'Valid',deductible:true,paymentMethod:'Bank',paymentStatus:'Paid',journalEntryId:'je5',notes:'Đã đối chiếu chứng từ ngân hàng'},
      {id:'txi3',direction:'Input',date:'2026-07-19',invoiceNo:'00000421',serial:'1C26TST',partnerType:'vendor',partnerId:'v2',taxCode:'0101234567',description:'Vật tư văn phòng chưa đủ chứng từ thanh toán',projectId:'',taxBase:5000000,vatRate:8,vatAmount:400000,totalAmount:5400000,status:'Valid',deductible:false,paymentMethod:'Cash',paymentStatus:'Pending',journalEntryId:'je7',notes:'Chứng từ Draft; VAT đang tính vào chi phí cho tới khi đủ điều kiện khấu trừ'}
    ],
    pitWithholdings: [
      {id:'pit1',date:'2026-07-06',recipientType:'vendor',recipientId:'v1',taxCode:'001206012345',contractType:'CTV dưới 3 tháng',grossIncome:48000000,taxableIncome:48000000,withholdingMethod:'Khấu trừ tỷ lệ',rate:10,taxWithheld:4800000,netPaid:43200000,period:'Q3/2026',certificateNo:'',status:'Withheld',journalEntryId:'je4',notes:'Thanh toán phí triển khai kiến trúc'}
    ],
    citAdjustments: [
      {id:'cit1',date:'2026-07-19',fiscalYear:2026,type:'Increase',category:'Chi phí chưa đủ hồ sơ',amount:1500000,description:'Khoản chi quản trị đang chờ hoàn thiện chứng từ hợp lệ',projectId:'',evidenceStatus:'Missing',status:'Reviewed'},
      {id:'cit2',date:'2026-07-19',fiscalYear:2026,type:'Decrease',category:'Thu nhập đã tính thuế kỳ trước',amount:0,description:'Dòng mẫu để theo dõi khoản điều chỉnh giảm khi phát sinh',projectId:'',evidenceStatus:'Complete',status:'Draft'}
    ],
    taxFilings: [
      {id:'tf1',taxType:'VAT',period:'Q2/2026',frequency:'Quarterly',dueDate:'2026-07-31',filingStatus:'Preparing',filedDate:'',payableAmount:20454545,paymentStatus:'Unpaid',paymentDate:'',referenceNo:'',notes:'Đối chiếu hóa đơn đầu ra và đầu vào trước khi nộp'},
      {id:'tf2',taxType:'PIT',period:'Q2/2026',frequency:'Quarterly',dueDate:'2026-07-31',filingStatus:'Not required',filedDate:'',payableAmount:0,paymentStatus:'No payment',paymentDate:'',referenceNo:'',notes:'Không phát sinh khấu trừ trong quý II theo dữ liệu mẫu'},
      {id:'tf3',taxType:'CIT provisional',period:'Q2/2026',frequency:'Quarterly',dueDate:'2026-07-30',filingStatus:'Not required',filedDate:'',payableAmount:12000000,paymentStatus:'Unpaid',paymentDate:'',referenceNo:'',notes:'Theo dõi khoản tạm nộp; kiểm tra điều kiện gia hạn nếu thuộc đối tượng'},
      {id:'tf4',taxType:'VAT',period:'Q3/2026',frequency:'Quarterly',dueDate:'2026-11-02',filingStatus:'Not prepared',filedDate:'',payableAmount:0,paymentStatus:'Unpaid',paymentDate:'',referenceNo:'',notes:'Hạn chuẩn được điều chỉnh sang ngày làm việc tiếp theo'},
      {id:'tf5',taxType:'PIT',period:'Q3/2026',frequency:'Quarterly',dueDate:'2026-11-02',filingStatus:'Not prepared',filedDate:'',payableAmount:4800000,paymentStatus:'Unpaid',paymentDate:'',referenceNo:'',notes:'Bao gồm thuế TNCN đã khấu trừ CTV'},
      {id:'tf6',taxType:'Annual finalization',period:'FY2026',frequency:'Annual',dueDate:'2027-03-31',filingStatus:'Not prepared',filedDate:'',payableAmount:0,paymentStatus:'Unpaid',paymentDate:'',referenceNo:'',notes:'Quyết toán TNDN và TNCN tổ chức trả thu nhập'}
    ],
    contracts: [
      {id:'ct1',projectId:'pr1',clientId:'c1',contractNo:'AD-AURORA-2026-01',contractType:'customer',signedDate:'2026-05-28',effectiveDate:'2026-06-01',expiryDate:'2026-12-31',valueExclVat:750000000,vatRate:10,status:'Active',ownerId:'p1'},
      {id:'ct2',projectId:'pr2',clientId:'c2',contractNo:'AD-GREENBAY-2026-02',contractType:'customer',signedDate:'',effectiveDate:'2026-07-10',expiryDate:'2026-11-30',valueExclVat:420000000,vatRate:10,status:'Draft',ownerId:'p1'}
    ],
    billingMilestones: [
      {id:'bm1',contractId:'ct1',projectId:'pr1',milestoneNo:1,name:'Tạm ứng khởi động',percentage:27.2727,amountExclVat:204545455,dueDate:'2026-06-18',acceptanceStatus:'Approved',invoiceStatus:'Invoiced',paymentStatus:'Paid',invoiceId:'txi1'},
      {id:'bm2',contractId:'ct1',projectId:'pr1',milestoneNo:2,name:'Nghiệm thu hồ sơ TKCS 50%',percentage:25,amountExclVat:187500000,dueDate:'2026-07-25',acceptanceStatus:'Pending',invoiceStatus:'Not invoiced',paymentStatus:'Unpaid'},
      {id:'bm3',contractId:'ct1',projectId:'pr1',milestoneNo:3,name:'Bàn giao hồ sơ TKCS',percentage:47.7273,amountExclVat:357954545,dueDate:'2026-10-31',acceptanceStatus:'Not started',invoiceStatus:'Not invoiced',paymentStatus:'Unpaid'},
      {id:'bm4',contractId:'ct2',projectId:'pr2',milestoneNo:1,name:'Ký hợp đồng / tạm ứng',percentage:30,amountExclVat:126000000,dueDate:'2026-08-05',acceptanceStatus:'Not started',invoiceStatus:'Not invoiced',paymentStatus:'Unpaid'}
    ],
    paymentAllocations: [
      {id:'pa1',paymentId:'f1',invoiceId:'txi1',date:'2026-06-20',amount:225000000,status:'Posted'}
    ],
    projectBudgetVersions: [
      {id:'pbv1',projectId:'pr1',versionNo:1,versionName:'Budget Baseline v1',status:'Approved',contractValue:750000000,directBudget:410000000,contingency:20000000,targetMarginPercent:30,effectiveFrom:'2026-06-01',expectedRiskCost:10000000},
      {id:'pbv2',projectId:'pr2',versionNo:1,versionName:'Proposal Budget v1',status:'Approved',contractValue:420000000,directBudget:220000000,contingency:15000000,targetMarginPercent:32,effectiveFrom:'2026-07-10',expectedRiskCost:5000000}
    ],
    projectBudgetLines: [
      {id:'pbl1',budgetVersionId:'pbv1',costType:'internal_labor',description:'Nhân sự Kiến trúc + Kết cấu',quantity:1,unitRate:150000000,amount:150000000,plannedHours:720},
      {id:'pbl2',budgetVersionId:'pbv1',costType:'collaborator',description:'CTV triển khai và 3D',quantity:1,unitRate:100000000,amount:100000000,plannedHours:430},
      {id:'pbl3',budgetVersionId:'pbv1',costType:'consultant',description:'Chuyên gia MEP/PCCC',quantity:1,unitRate:50000000,amount:50000000,plannedHours:120},
      {id:'pbl4',budgetVersionId:'pbv1',costType:'printing',description:'In ấn và phát hành hồ sơ',quantity:1,unitRate:20000000,amount:20000000,plannedHours:0},
      {id:'pbl5',budgetVersionId:'pbv1',costType:'travel',description:'Khảo sát và công tác',quantity:1,unitRate:10000000,amount:10000000,plannedHours:0},
      {id:'pbl6',budgetVersionId:'pbv1',costType:'other_direct',description:'Chi phí trực tiếp khác',quantity:1,unitRate:60000000,amount:60000000,plannedHours:0},
      {id:'pbl7',budgetVersionId:'pbv1',costType:'contingency',description:'Dự phòng rủi ro',quantity:1,unitRate:20000000,amount:20000000,plannedHours:0},
      {id:'pbl8',budgetVersionId:'pbv2',costType:'internal_labor',description:'Thiết kế cảnh quan',quantity:1,unitRate:120000000,amount:120000000,plannedHours:560},
      {id:'pbl9',budgetVersionId:'pbv2',costType:'collaborator',description:'Render và khảo sát',quantity:1,unitRate:50000000,amount:50000000,plannedHours:220},
      {id:'pbl10',budgetVersionId:'pbv2',costType:'other_direct',description:'Chi phí trực tiếp khác',quantity:1,unitRate:35000000,amount:35000000,plannedHours:0},
      {id:'pbl11',budgetVersionId:'pbv2',costType:'contingency',description:'Dự phòng',quantity:1,unitRate:15000000,amount:15000000,plannedHours:0}
    ],
    resourcePlans: [
      {id:'rp1',projectId:'pr1',personId:'p2',month:'2026-07',plannedHours:80,costRate:190000,status:'Approved'},
      {id:'rp2',projectId:'pr1',personId:'p3',month:'2026-07',plannedHours:64,costRate:145000,status:'Approved'},
      {id:'rp3',projectId:'pr1',personId:'p2',month:'2026-08',plannedHours:110,costRate:190000,status:'Approved'},
      {id:'rp4',projectId:'pr1',personId:'p3',month:'2026-08',plannedHours:90,costRate:145000,status:'Approved'},
      {id:'rp5',projectId:'pr1',personId:'p4',month:'2026-08',plannedHours:80,costRate:180000,status:'Approved'},
      {id:'rp6',projectId:'pr1',personId:'p2',month:'2026-09',plannedHours:70,costRate:190000,status:'Approved'},
      {id:'rp7',projectId:'pr2',personId:'p2',month:'2026-08',plannedHours:90,costRate:190000,status:'Approved'},
      {id:'rp8',projectId:'pr2',personId:'p4',month:'2026-08',plannedHours:80,costRate:180000,status:'Approved'},
      {id:'rp9',projectId:'pr1',personId:'p2',month:'2026-09',plannedHours:120,costRate:190000,status:'Approved'},
      {id:'rp10',projectId:'pr1',personId:'p3',month:'2026-09',plannedHours:120,costRate:145000,status:'Approved'},
      {id:'rp11',projectId:'pr1',personId:'p4',month:'2026-10',plannedHours:30,costRate:180000,status:'Approved'}
    ],
    commitments: [
      {id:'cm1',projectId:'pr1',type:'Printing',description:'In hồ sơ nghiệm thu và bàn giao',amount:18000000,recognizedAmount:0,dueDate:'2026-10-20',status:'Approved'},
      {id:'cm2',projectId:'pr1',type:'Consultant',description:'Tư vấn rà soát PCCC/MEP',amount:35000000,recognizedAmount:10000000,dueDate:'2026-09-15',status:'Approved'},
      {id:'cm3',projectId:'pr2',type:'Survey',description:'Khảo sát hiện trạng bổ sung',amount:12000000,recognizedAmount:0,dueDate:'2026-08-10',status:'Approved'}
    ],
    projectStages: [
      {id:'ps1',projectId:'pr1',code:'CONCEPT',name:'Rà soát Concept',weightPercent:10,plannedStart:'2026-06-01',plannedEnd:'2026-06-20',progressPercent:100,status:'Completed'},
      {id:'ps2',projectId:'pr1',code:'ARCH',name:'Kiến trúc TKCS',weightPercent:35,plannedStart:'2026-06-15',plannedEnd:'2026-08-10',progressPercent:55,status:'In Progress'},
      {id:'ps3',projectId:'pr1',code:'STRUCT',name:'Kết cấu TKCS',weightPercent:25,plannedStart:'2026-07-01',plannedEnd:'2026-09-05',progressPercent:32,status:'In Progress'},
      {id:'ps4',projectId:'pr1',code:'MEP',name:'MEP/PCCC TKCS',weightPercent:20,plannedStart:'2026-07-20',plannedEnd:'2026-09-30',progressPercent:12,status:'In Progress'},
      {id:'ps5',projectId:'pr1',code:'ISSUE',name:'Tổng hợp và phát hành',weightPercent:10,plannedStart:'2026-10-01',plannedEnd:'2026-10-31',progressPercent:0,status:'Not Started'},
      {id:'ps6',projectId:'pr2',code:'CONCEPT',name:'Concept cảnh quan',weightPercent:55,plannedStart:'2026-07-10',plannedEnd:'2026-08-20',progressPercent:18,status:'In Progress'},
      {id:'ps7',projectId:'pr2',code:'DEVELOP',name:'Phát triển phương án',weightPercent:45,plannedStart:'2026-08-10',plannedEnd:'2026-09-30',progressPercent:0,status:'Not Started'}
    ],
    purchaseRequests: [
      {id:'prq1',requestNo:'PR-2026-001',date:'2026-07-15',itemName:'Giấy A3 và mực máy in',category:'Office supplies',quantity:1,unitPrice:6500000,vatRate:10,requesterId:'p2',projectId:'',purpose:'Văn phòng dùng chung',status:'Approved',suggestedClass:'expense'},
      {id:'prq2',requestNo:'PR-2026-002',date:'2026-07-18',itemName:'Máy in A3 màu',category:'Printer',quantity:1,unitPrice:24000000,vatRate:10,requesterId:'p3',projectId:'',purpose:'In hồ sơ thiết kế',status:'Approved',suggestedClass:'tool'},
      {id:'prq3',requestNo:'PR-2026-003',date:'2026-07-20',itemName:'Xe ô tô phục vụ công tác',category:'Vehicle',quantity:1,unitPrice:850000000,vatRate:10,requesterId:'p1',projectId:'',purpose:'Đi khảo sát và làm việc với khách hàng',status:'Pending',suggestedClass:'fixed_asset'}
    ],
    purchaseOrders: [
      {id:'po1',poNo:'PO-2026-001',purchaseRequestId:'prq1',vendorId:'v2',orderDate:'2026-07-16',invoiceDate:'2026-07-16',itemName:'Giấy A3 và mực máy in',category:'Office supplies',quantity:1,unitPrice:6500000,vatRate:10,paymentMethod:'Bank',projectId:'',directProject:false,usefulLifeMonths:1,allocationMonths:1,status:'Received',classification:'expense'},
      {id:'po2',poNo:'PO-2026-002',purchaseRequestId:'prq2',vendorId:'v2',orderDate:'2026-07-19',invoiceDate:'2026-07-19',itemName:'Máy in A3 màu',category:'Printer',quantity:1,unitPrice:24000000,vatRate:10,paymentMethod:'Payable',projectId:'',directProject:false,usefulLifeMonths:36,allocationMonths:24,status:'Received',classification:'tool',toolId:'tool1'}
    ],
    tools: [
      {id:'tool1',toolCode:'CCDC-2026-001',name:'Máy in A3 màu',purchaseOrderId:'po2',startDate:'2026-07-19',originalCost:24000000,allocatedAmount:0,allocationMonths:24,expenseAccountCode:'6422',projectId:'',department:'Văn phòng',custodianId:'p3',status:'In Use'}
    ],
    fixedAssets: [],
    toolAllocationSchedules: [],
    depreciationSchedules: [],
    financialForecastScenarios: [
      {id:'ffs-base',name:'Cơ sở',isDefault:true,monthlyRevenueGrowthPercent:0.5,collectionRatePercent:90,directCostRatioPercent:18,pipelineFactorPercent:100,pipelineLagMonths:2,pipelineDeliveryMonths:4,recurringRevenueShare:0.10,payrollGrowthPercent:6,overheadGrowthPercent:4,taxPaymentLagMonths:1,taxRatePercent:20,minimumCashBuffer:150000000},
      {id:'ffs-conservative',name:'Thận trọng',isDefault:false,monthlyRevenueGrowthPercent:-1,collectionRatePercent:75,directCostRatioPercent:24,pipelineFactorPercent:65,pipelineLagMonths:3,pipelineDeliveryMonths:5,recurringRevenueShare:0.05,payrollGrowthPercent:6,overheadGrowthPercent:6,taxPaymentLagMonths:1,taxRatePercent:20,minimumCashBuffer:200000000},
      {id:'ffs-growth',name:'Tăng trưởng',isDefault:false,monthlyRevenueGrowthPercent:1.5,collectionRatePercent:94,directCostRatioPercent:15,pipelineFactorPercent:120,pipelineLagMonths:1,pipelineDeliveryMonths:4,recurringRevenueShare:0.15,payrollGrowthPercent:9,overheadGrowthPercent:7,taxPaymentLagMonths:1,taxRatePercent:20,minimumCashBuffer:180000000}
    ],
    financialAnalysisSnapshots: [],
    financialLinkAuditRuns: [],
    reportNotesTT133: [
      {
            "id": "demo-b09-i",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "I",
            "sectionTitle": "Đặc điểm hoạt động của doanh nghiệp",
            "content": "ALPHA DESIGN hoạt động trong lĩnh vực tư vấn thiết kế kiến trúc, kết cấu, cơ điện, quy hoạch, cảnh quan và nội thất. Dữ liệu này chỉ phục vụ bản DEMO kiểm thử.",
            "status": "approved",
            "contentSha256": "cdb25bf872d43e9abdb7958bd642fcd7fbe5edffa46db19d6cbc40bd4f5356dd",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      },
      {
            "id": "demo-b09-ii",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "II",
            "sectionTitle": "Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán",
            "content": "Kỳ kế toán năm bắt đầu ngày 01 tháng 01 và kết thúc ngày 31 tháng 12. Đơn vị tiền tệ sử dụng trong kế toán là đồng Việt Nam.",
            "status": "approved",
            "contentSha256": "71899e30b75870755d452123f4293ec7dbad1fbe45a0874db3dc8afcc7218770",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      },
      {
            "id": "demo-b09-iii",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "III",
            "sectionTitle": "Chuẩn mực và chế độ kế toán áp dụng",
            "content": "Doanh nghiệp áp dụng chế độ kế toán doanh nghiệp nhỏ và vừa theo cấu hình TT133. Nội dung DEMO không thay thế hồ sơ phê duyệt thực tế trên Cloud.",
            "status": "approved",
            "contentSha256": "2863c557b3016b250f335086c4cd137ebc0966c07a3faff135604a8ac3b12cc7",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      },
      {
            "id": "demo-b09-iv",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "IV",
            "sectionTitle": "Các chính sách kế toán áp dụng",
            "content": "Báo cáo được lập trên cơ sở dồn tích, nguyên tắc giá gốc và phương pháp khấu trừ thuế GTGT. Chính sách thực tế phải do kế toán có thẩm quyền phê duyệt.",
            "status": "approved",
            "contentSha256": "bd72093c5ad6119c07d9e5bbc8e72c65b4f9f1554c9ff11dab9bec8d557cf3a2",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      },
      {
            "id": "demo-b09-v",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "V",
            "sectionTitle": "Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính",
            "content": "Thuyết minh DEMO trình bày tiền, phải thu, chi phí dở dang, thuế được khấu trừ, công nợ phải trả và vốn chủ sở hữu theo dữ liệu mô phỏng.",
            "status": "approved",
            "contentSha256": "e65e1da79d22f1365223bd08123ee4e63d9b76f1b4dcfa00cf39f5d2c356b0b9",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      },
      {
            "id": "demo-b09-vi",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "VI",
            "sectionTitle": "Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh",
            "content": "Thuyết minh DEMO trình bày doanh thu dịch vụ, giá vốn, chi phí quản lý, lợi nhuận trước thuế và lợi nhuận sau thuế của kỳ mô phỏng.",
            "status": "approved",
            "contentSha256": "fdb47d317838673105a26b4db1114ada795315601bef75dd5a7c4ee08ce14d56",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      },
      {
            "id": "demo-b09-vii",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "VII",
            "sectionTitle": "Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ",
            "content": "Thuyết minh DEMO trình bày các dòng tiền từ hoạt động kinh doanh, đầu tư và tài chính, đồng thời đối chiếu tiền đầu kỳ với tiền cuối kỳ.",
            "status": "approved",
            "contentSha256": "b76c8a4834bd7c91050a0cd9cf4d8b29a87e16c26a7383db3634757115223424",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      },
      {
            "id": "demo-b09-viii",
            "periodFrom": "2026-01-01",
            "periodTo": "2026-12-31",
            "sectionCode": "VIII",
            "sectionTitle": "Những thông tin khác",
            "content": "Các phê duyệt trong bộ dữ liệu DEMO là bằng chứng mô phỏng, không có giá trị pháp lý và không thể dùng để mở cổng phát hành Production hoặc nộp báo cáo nhà nước.",
            "status": "approved",
            "contentSha256": "3d652db533d2f9f07b0d97f270e7dd60be119b1d49ccb15db32fc43de40c48e4",
            "preparedBy": "demo-preparer",
            "preparedAt": "2026-12-20T08:00:00Z",
            "reviewedBy": "demo-reviewer",
            "reviewedAt": "2026-12-21T08:00:00Z",
            "approvedBy": "demo-approver",
            "approvedAt": "2026-12-22T08:00:00Z",
            "workflowVersion": 2,
            "workflowComplete": true,
            "evidenceScope": "demo-simulated"
      }
],
    analytics: {
      months:['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11','T12'],
      revenue:[7200,7800,8400,9600,10500,11200,11600,11000,10950,10800,9200,10100],
      cost:[4500,4900,5300,6000,6500,6900,7100,6800,6750,6700,5900,6795],
      cashIn:[9800,11200,10500,12800,12100,14200,13600,15100,14800,14400,13200,15400],
      cashOut:[8500,9300,9700,10300,11000,11800,11600,12600,12800,13000,12100,13940],
      payrollFixed:[6200,6800,7200,6900,7600,7300,7500,7800,8000,8200,8100,8500],
      payrollCtv:[1700,1800,1900,1750,2100,1850,1900,2000,2050,2200,2100,2300],
      recovered:[8200,8800,9300,8900,10200,9400,9500,10500,11000,10800,11200,11800],
      billable:[620,680,735,790,820,860,840,910,950,920,960,1020],
      nonBillable:[180,190,205,195,210,220,200,215,230,205,195,210],
      completion:[78,81,84,86,88,90,89,91,92,91,93,94],
      departments:[
        {name:'Kiến trúc',value:44,color:'#0b73f6'},
        {name:'Kết cấu',value:21,color:'#14b8a6'},
        {name:'MEP',value:16,color:'#f59e0b'},
        {name:'Nội thất',value:11,color:'#8b5cf6'},
        {name:'Cảnh quan',value:8,color:'#22a447'}
      ]
    }

  };

  // Mở rộng dữ liệu Demo bằng một bộ tải xác định trước: 100 nhân sự và 48 dự án trên 10 tỷ VND.
  // Bộ sinh được tách riêng để cùng một dữ liệu có thể được kiểm thử độc lập trong Node và hiển thị trong index Demo.
  if (window.AlphaEnterpriseDemo?.createEnterpriseDemo) {
    const enterpriseDemo = window.AlphaEnterpriseDemo.createEnterpriseDemo(demoData, { peopleCount: 100, projectCount: 48, committedProjectCount: 40 });
    Object.keys(demoData).forEach((key) => delete demoData[key]);
    Object.assign(demoData, enterpriseDemo);
  }

  // Chỉ dữ liệu mẫu đi kèm được đóng dấu toàn vẹn tại thời điểm phát hành.
  // Dữ liệu cũ/import thiếu hash không được tự động "hợp thức hóa" trong quá trình migrate.
  demoData.journalEntries=(demoData.journalEntries||[]).map(x=>x.status==='Posted'?{...x,postingHash:Calc.postingHash(x)}:x);

  const RUNTIME=window.ALPHA_RUNTIME_CONFIG||{};
  const ENVIRONMENT=String(RUNTIME.environment||'demo').toLowerCase();
  const IS_PRODUCTION=ENVIRONMENT==='production';
  const ALLOW_LOCAL_BUSINESS_DATA=RUNTIME.allowLocalBusinessData===true&&!IS_PRODUCTION;

  let db = loadDB();
  if(ALLOW_LOCAL_BUSINESS_DATA){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
      LEGACY_STORAGE_KEYS.forEach(key=>{if(key!==STORAGE_KEY)localStorage.removeItem(key);});
    }catch(e){}
  }
  let currentView = 'dashboard';
  let currentAccountingTab = 'overview';
  const tableFilterState = new Map();
  function tableFilterKey(scope,target=''){return `${scope||currentView}:${target||'table'}`;}
  function readTableFilterState(key){return tableFilterState.get(key)||{search:'',selects:[]};}
  function writeTableFilterState(key,next){tableFilterState.set(key,{...readTableFilterState(key),...next});}

  let currentControlTab = 'actual';
  let currentProcurementTab = 'requests';
  let currentFinancialTab = 'overview';
  let currentForecastScenarioId = 'ffs-base';
  let currentPayrollMonth = monthKey(new Date());
  let currentBenefitYear = new Date().getFullYear();
  let statutoryCloudAudit = null;
  let statutoryCloudNotes = [];
  let editing = null;
  let activeFilters = {view:'', status:'', project:'', department:''};
  let deferredInstallPrompt = null;
  let pendingFocus = null;
  const trashHandlers = new Map();
  let trashCleanupRunning = false;

  const content = document.getElementById('content');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  const pageIcon = document.getElementById('pageIcon');
  const primaryAction = document.getElementById('primaryAction');
  const modalBackdrop = document.getElementById('modalBackdrop');
  let lastModalFocus=null,lastDrawerFocus=null,activeDrawerId='';
  const modalForm = document.getElementById('modalForm');
  const modalTitle = document.getElementById('modalTitle');
  const modalHelp = document.getElementById('modalHelp');
  const toast = document.getElementById('toast');

  function clone(v){ return typeof structuredClone==='function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)); }
  function migrateDB(raw){
    const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?clone(raw):{};
    const out={...source,version:demoData.version,settings:{...clone(demoData.settings),...(source.settings||{})}};
    let recalculateDraftPayrollAfterPitMigration=false;
    if(source.version!==demoData.version&&Number(source.settings?.pitWithholdingThreshold)===2000000&&!source.settings?.pitWithholdingThresholdEffectiveDate){
      out.settings.pitWithholdingThresholdPrevious=2000000;
      out.settings.pitWithholdingThreshold=5000000;
      out.settings.pitWithholdingThresholdEffectiveDate='2026-07-01';
    }
    const sourceSettings=source.settings&&typeof source.settings==='object'?source.settings:{};
    if(!String(out.settings.companyAddress||'').trim())out.settings.companyAddress=String(sourceSettings.address||sourceSettings.company_address||'').trim();
    if(!String(out.settings.taxpayerCode||'').trim())out.settings.taxpayerCode=String(sourceSettings.taxCode||sourceSettings.tax_code||sourceSettings.taxpayer_code||sourceSettings.companyTaxCode||'').trim();
    out.settings.companyAddress=String(out.settings.companyAddress||'').trim();
    out.settings.taxpayerCode=String(out.settings.taxpayerCode||'').replace(/\s+/g,'').trim();
    const storedCompanyName=String(out.settings.companyName||'').trim();
    if(!storedCompanyName || (/ALPHA DESIGN/i.test(storedCompanyName) && /(ERP\s*CLOUD|INTERNAL\s*PILOT|FINANCIAL\s*ANALYTICS)/i.test(storedCompanyName))) out.settings.companyName='ALPHA DESIGN CO., LTD';
    if(!out.settings.accountingRegime) out.settings.accountingRegime='TT133/2016/TT-BTC (DNNVV)';
    if(!out.settings.accountingRegimeEffectiveDate) out.settings.accountingRegimeEffectiveDate=`${new Date().getFullYear()}-01-01`;
    if(!out.settings.accountingPolicyVersion || String(out.settings.accountingPolicyVersion).includes('ACC-2026')){const code=String(out.settings.accountingRegime||'').includes('TT99')?'TT99':String(out.settings.accountingRegime||'').includes('TT132')?'TT132':'TT133';out.settings.accountingPolicyVersion=code==='TT99'?'ALPHA-TT99-2026.01':code==='TT132'?'ALPHA-TT132-2026.01':'ALPHA-TT133-2026.04';}
    const legacyTaxRule='Luật Thuế TNDN 67/2025/QH15 • NĐ 320/2025/NĐ-CP • NĐ 253/2026/NĐ-CP (TNCN từ 01/07/2026) • tham số thuế do kế toán trưởng phê duyệt';
    if(!out.settings.taxRuleVersion || out.settings.taxRuleVersion===legacyTaxRule) out.settings.taxRuleVersion=demoData.settings.taxRuleVersion;
    ['people','clients','vendors','accounts','projects','tasks','timesheets','payrollPeriods','payrollItems','annualBenefitBudgets','contracts','journalEntries','finance','quotes','approvals','documents','taxInvoices','pitWithholdings','citAdjustments','taxFilings','billingMilestones','paymentAllocations','openingBalances','accountingPeriods','projectBudgetVersions','projectBudgetLines','resourcePlans','commitments','projectStages','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules','financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns','reportNotesTT133','reportNotesTT99','statutoryReportTemplates','taxCompliancePackages','notificationReads','exportLogs','importLogs','trashEntries'].forEach(k=>{if(!Array.isArray(out[k]))out[k]=[];});
    out.trashEntries=out.trashEntries.filter(entry=>entry&&typeof entry==='object'&&!Array.isArray(entry)&&entry.id&&entry.entityType&&entry.record&&typeof entry.record==='object').map(entry=>{
      const parsedDeletedAt=new Date(entry.deletedAt||Date.now()),deletedAt=Number.isNaN(parsedDeletedAt.getTime())?new Date().toISOString():parsedDeletedAt.toISOString();
      const parsedExpiresAt=new Date(entry.expiresAt||''),expiresAt=Number.isNaN(parsedExpiresAt.getTime())?RecycleBin.retentionDeadline(deletedAt):parsedExpiresAt.toISOString();
      return {...entry,deletedAt,expiresAt,retentionDays:RecycleBin.RETENTION_DAYS,relatedRecords:Array.isArray(entry.relatedRecords)?entry.relatedRecords:[],sourceContext:entry.sourceContext&&typeof entry.sourceContext==='object'&&!Array.isArray(entry.sourceContext)?entry.sourceContext:{}};
    });
    const payrollDefaults={dailyWorkingHours:8,monthlyWorkingHours:176,overtimeMultiplier:1.5,employeeInsuranceRate:10.5,employerInsuranceRate:21.5,personalDeduction:15500000,dependentDeduction:6200000,personalDeductionPrevious:11000000,dependentDeductionPrevious:4400000,fixedPitScheduleEffectiveDate:'2026-01-01',insuranceProrateByWorkdays:false,payrollPolicyVersion:'ALPHA-PAYROLL-2026.03'};
    Object.entries(payrollDefaults).forEach(([key,value])=>{if(out.settings[key]===undefined||out.settings[key]===null||out.settings[key]==='')out.settings[key]=value;});
    const storedFixedPitDate=String(sourceSettings.fixedPitScheduleEffectiveDate??sourceSettings.fixed_pit_schedule_effective_date??'');
    const storedPayrollPolicy=String(sourceSettings.payrollPolicyVersion??sourceSettings.payroll_policy_version??'');
    if(storedFixedPitDate==='2026-07-01'&&(!storedPayrollPolicy||storedPayrollPolicy==='ALPHA-PAYROLL-2026.02')){
      out.settings.fixedPitScheduleEffectiveDate='2026-01-01';
      out.settings.payrollPolicyVersion='ALPHA-PAYROLL-2026.03';
      recalculateDraftPayrollAfterPitMigration=true;
    }
    out.settings.citRateMode='Manual';
    out.settings.corporateTaxRate=Number.isFinite(Number(out.settings.corporateTaxRate))?Math.max(0,Math.min(100,Number(out.settings.corporateTaxRate))):20;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(out.settings.corporateTaxRateEffectiveDate||'')))out.settings.corporateTaxRateEffectiveDate=`${new Date().getFullYear()}-01-01`;
    if(!Array.isArray(out.settings.citManualRateHistory))out.settings.citManualRateHistory=[];
    if(!out.settings.citManualRateHistory.some(row=>String(row.effectiveFrom||row.effective_from)===String(out.settings.corporateTaxRateEffectiveDate))){
      out.settings.citManualRateHistory.push({effectiveFrom:out.settings.corporateTaxRateEffectiveDate,rate:out.settings.corporateTaxRate,note:'Chuyển đổi sang cơ chế nhập thuế suất thủ công'});
    }
    out.settings.citManualRateHistory=out.settings.citManualRateHistory.filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(String(row.effectiveFrom||row.effective_from||''))&&Number.isFinite(Number(row.rate))).map(row=>({effectiveFrom:String(row.effectiveFrom||row.effective_from),rate:Math.max(0,Math.min(100,Number(row.rate))),note:String(row.note||'')})).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
    out.settings.taxReminderWindowDays=Math.max(1,Math.min(90,Math.round(Number(out.settings.taxReminderWindowDays)||30)));
    out.people=out.people.map(person=>{const type=Calc.statusIs(person.type,'CTV')?'CTV':'Fixed';return {...person,startDate:person.startDate??person.start_date??person.hireDate??person.hire_date??'',endDate:person.endDate??person.end_date??person.terminationDate??person.termination_date??'',monthlyAllowance:Number(person.monthlyAllowance??person.monthly_allowance??0),insuranceSalary:Number(person.insuranceSalary??person.insurance_salary??person.monthlySalary??person.monthly_salary??0),insuranceEnabled:person.insuranceEnabled??person.insurance_enabled??(type!=='CTV'),dependentCount:Math.max(0,Math.floor(Number(person.dependentCount??person.dependent_count??0)||0)),pitResidence:String(person.pitResidence??person.pit_residence??'Resident'),overtimeMultiplier:Number(person.overtimeMultiplier??person.overtime_multiplier??out.settings.overtimeMultiplier??1.5)||1.5};});
    out.payrollItems=out.payrollItems.map(item=>{const person=out.people.find(p=>String(p.id)===String(item.personId??item.person_id??item.employeeId??item.employee_id));const modes=Payroll.automaticModes(person||{},item);return {...item,...modes,employeeInsurance:Calc.statusIs(modes.insuranceMode,'Auto policy')?null:(item.employeeInsurance??item.employee_insurance??0),employerInsurance:Calc.statusIs(modes.insuranceMode,'Auto policy')?null:(item.employerInsurance??item.employer_insurance??0),calculationVersion:item.calculationVersion||'ALPHA-PAYROLL-4.5.61'};});
    if(recalculateDraftPayrollAfterPitMigration)Payroll.refreshDraftPeriods(out,uid);
    if(!Array.isArray(out.openingBalances))out.openingBalances=[];
    if(!Array.isArray(out.accountingPeriods))out.accountingPeriods=[];
    if(!out.financialForecastScenarios.length&&ENVIRONMENT==='demo')out.financialForecastScenarios=clone(demoData.financialForecastScenarios||[]);
    out.projects=out.projects.map(project=>{const hasStages=out.projectStages.some(stage=>(stage.projectId??stage.project_id)===project.id&&String(stage.status||'').toLowerCase()!=='cancelled');return {...project,progressMode:project.progressMode??project.progress_mode??(hasStages?'weighted':'manual')};});
    out.finance=out.finance.map(x=>({...x,amount:Calc.vnd(x.amount),costNature:Calc.classifyCostNature(x)}));
    out.journalEntries=out.journalEntries.map(x=>{
      const normalized={...x,lines:(x.lines||[]).map(l=>({...l,debit:Calc.vnd(l.debit),credit:Calc.vnd(l.credit)})),postingHash:Calc.statusIs(x.status,'posted')?(x.postingHash||''):''};
      return Calc.statusIs(normalized.status,'posted')?Calc.upgradePostingHash(normalized):normalized;
    });
    if(ENVIRONMENT==='demo'&&!out.toolAllocationSchedules.length)out.toolAllocationSchedules=out.tools.flatMap(tool=>Calc.straightLineSchedule({sourceId:tool.id,startDate:tool.startDate,cost:tool.originalCost,residualValue:0,months:tool.allocationMonths,kind:'tool'}));
    if(ENVIRONMENT==='demo'&&!out.depreciationSchedules.length)out.depreciationSchedules=out.fixedAssets.flatMap(asset=>Calc.straightLineSchedule({sourceId:asset.id,startDate:asset.inServiceDate||asset.acquisitionDate,cost:asset.originalCost,residualValue:asset.residualValue||0,months:asset.usefulLifeMonths,kind:'asset'}));
    out.version=RELEASE_VERSION;
    out.meta={...(out.meta||{}),revision:Number.isFinite(Number(out.meta?.revision))?Number(out.meta.revision):0};
    const required=[
      {id:'acc511',code:'511',name:'Doanh thu bán hàng và cung cấp dịch vụ',type:'Revenue',normalSide:'Credit',active:true,postable:false,regime:'TT133'},
      {id:'acc642',code:'642',name:'Chi phí quản lý kinh doanh',type:'Expense',normalSide:'Debit',active:true,postable:false,regime:'TT133'},
      {id:'acc521',code:'521',name:'Các khoản giảm trừ doanh thu',type:'Revenue',normalSide:'Debit',active:true,postable:true,regime:'TT133'},
      {id:'acc711',code:'711',name:'Thu nhập khác',type:'Revenue',normalSide:'Credit',active:true,postable:true,regime:'TT133'},
      {id:'acc8211',code:'8211',name:'Chi phí thuế TNDN hiện hành',type:'Expense',normalSide:'Debit',active:true,postable:true,regime:'TT133'},
      {id:'acc911',code:'911',name:'Xác định kết quả kinh doanh',type:'Equity',normalSide:'Credit',active:true,postable:true,regime:'TT133'},
      {id:'acc153',code:'153',name:'Công cụ, dụng cụ',type:'Asset',normalSide:'Debit',active:true,postable:true,regime:'TT133'},
      {id:'acc2113',code:'2113',name:'Phương tiện vận tải, truyền dẫn',type:'Asset',normalSide:'Debit',active:true,postable:true,regime:'TT133'},
      {id:'acc635',code:'635',name:'Chi phí tài chính',type:'Expense',normalSide:'Debit',active:true,postable:true,regime:'TT133'}
    ];
    if(ENVIRONMENT==='demo')required.forEach(a=>{if(!out.accounts.some(x=>x.code===a.code))out.accounts.push(a);});
    const regimeCode=String(out.settings.accountingRegime||'TT133').includes('TT99')?'TT99':String(out.settings.accountingRegime||'').includes('TT132')?'TT132':'TT133';
    out.accounts=out.accounts.map(a=>({...a,regime:a.regime||regimeCode,reportClass:a.reportClass??a.report_class??a.balanceSheetClass??a.balance_sheet_class??'',postable:a.postable!==false,customDetail:['5113','6421','6422'].includes(a.code),parentCode:a.parentCode??a.parent_code??(a.code==='5113'?'511':a.code.startsWith('642')?'642':'')}));
    return out;
  }
  function readStorage(key){ try{return localStorage.getItem(key);}catch(e){return null;} }
  function emptyProductionDB(){
    const base=migrateDB(clone(demoData));
    ['people','clients','vendors','accounts','projects','tasks','timesheets','payrollPeriods','payrollItems','annualBenefitBudgets','contracts','journalEntries','finance','quotes','approvals','documents','taxInvoices','pitWithholdings','citAdjustments','taxFilings','billingMilestones','paymentAllocations','openingBalances','accountingPeriods','projectBudgetVersions','projectBudgetLines','resourcePlans','commitments','projectStages','purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules','financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns','reportNotesTT133','reportNotesTT99','statutoryReportTemplates','taxCompliancePackages','notificationReads','exportLogs','importLogs','trashEntries'].forEach(k=>base[k]=[]);
    base.meta={source:'awaiting-postgresql',loadedAt:new Date().toISOString(),revision:0};
    return base;
  }
  function loadDB(){
    if(IS_PRODUCTION||!ALLOW_LOCAL_BUSINESS_DATA)return emptyProductionDB();
    try {
      let stored = readStorage(STORAGE_KEY);
      if(!stored){
        for(const key of LEGACY_STORAGE_KEYS){stored = readStorage(key);if(stored) break;}
      }
      if(!stored) return migrateDB(clone(demoData));
      return migrateDB(JSON.parse(stored));
    } catch (e) {return migrateDB(clone(demoData));}
  }
  function cleanupLegacyStorage(){
    if(!ALLOW_LOCAL_BUSINESS_DATA)return;
    const candidates=new Set(LEGACY_STORAGE_KEYS);
    try{
      for(let i=0;i<localStorage.length;i+=1){
        const key=localStorage.key(i);
        if(key&&key.startsWith('alpha_design_erp_cloud_')&&key!==STORAGE_KEY)candidates.add(key);
      }
    }catch(_error){}
    candidates.forEach(key=>{if(key!==STORAGE_KEY){try{localStorage.removeItem(key);}catch(_error){}}});
  }
  function saveDB(){
    const beforeMeta=clone(db.meta||{});
    try{
      if(ENVIRONMENT!=='demo'&&window.AlphaProductionGuard&&!window.AlphaProductionGuard.canWrite())return false;
      statutoryCloudAudit=null;
      statutoryCloudNotes=[];
      db.meta={...(db.meta||{}),revision:Math.max(0,Number(db.meta?.revision)||0)+1,updatedAt:new Date().toISOString()};
      if(ALLOW_LOCAL_BUSINESS_DATA){
        const payload=JSON.stringify(db);
        cleanupLegacyStorage();
        try{localStorage.setItem(STORAGE_KEY,payload);}catch(firstError){
          cleanupLegacyStorage();
          try{localStorage.removeItem(STORAGE_KEY);}catch(_error){}
          localStorage.setItem(STORAGE_KEY,payload);
        }
      }
      if(!suppressSyncCapture){window.dispatchEvent(new CustomEvent('alpha:local-save',{detail:{db,savedAt:new Date().toISOString(),authoritative:IS_PRODUCTION}}));}
      return true;
    }catch(e){db.meta=beforeMeta;console.error('ALPHA ERP save failed',e);return false;}
  }
  function fmtMoney(v){ return new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND', maximumFractionDigits:0}).format(Number(v)||0); }
  function fmtNum(v, digits=1){ return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:digits}).format(Number(v)||0); }
  function fmtDate(v){ if(!v) return '—'; const text=String(v); const d=/^\d{4}-\d{2}-\d{2}$/.test(text)?new Date(`${text}T00:00:00`):new Date(text); return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('vi-VN').format(d); }
  function getById(list,id){ return list.find(x => x.id === id); }
  function personName(id){ return getById(db.people,id)?.name || '—'; }
  function projectName(id){ return getById(db.projects,id)?.name || 'Không gắn dự án'; }
  function clientName(id){ return getById(db.clients,id)?.name || '—'; }
  function badge(status){
    const s = String(status || '');
    const cls = /done|completed|paid|active|approved|signed|issued|withheld|reviewed/i.test(s) ? 'success' : /pending|review|proposal|negotiation|medium|due soon/i.test(s) ? 'warning' : /risk|late|overdue|rejected|inactive|high|missing|unlinked/i.test(s) ? 'danger' : /progress|draft/i.test(s) ? 'info' : 'neutral';
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }
  function toastMsg(msg){ toast.textContent = msg; toast.classList.remove('hidden'); setTimeout(() => toast.classList.add('hidden'), 2200); }
  function ensureWritable(){
    if(ENVIRONMENT==='demo') return true;
    const guard=window.AlphaProductionGuard;
    if(guard?.canWrite?.()) return true;
    const message=guard?.reason?.()||'Hệ thống đang ở chế độ chỉ đọc hoặc chưa xác thực quyền ghi.';
    alert(message);
    return false;
  }
  function currentSecurityContext(){
    return window.AlphaOnline?.getContext?.()||window.AlphaProductionGuard?.getContext?.()||null;
  }
  function contextHasPermission(context,required=[]){
    const needed=Array.isArray(required)?required:[required];
    const granted=Array.isArray(context?.permissions)?context.permissions:[];
    return granted.includes('*')||granted.includes('admin')||needed.some(code=>granted.includes(code));
  }
  async function requirePrivilegedAction(required,label='Thao tác đặc quyền'){
    if(!ensureWritable())return null;
    if(ENVIRONMENT==='demo')return {demo:true,user_id:'demo',display_name:'Giám đốc Demo',aal:'demo',permissions:['*']};
    const context=currentSecurityContext();
    if(!context){alert(`${label} bị chặn vì chưa xác minh được phiên Cloud.`);return null;}
    if(!contextHasPermission(context,required)){alert(`Không đủ quyền thực hiện ${label.toLowerCase()}.`);return null;}
    try{
      const needed=Array.isArray(required)?required:[required];
      const aal2Permissions=new Set(['accounting.post','accounting.close','accounting.period.lock','users.manage','roles.manage','reports.import','backup.restore','security.manage','release.approve','b09.review','b09.approve','financial_reports.certify','payroll.approve','payroll.lock','benefits.approve','benefits.lock','admin']);
      const needsAal2=needed.some(code=>aal2Permissions.has(code));
      const secured=needsAal2?(await window.AlphaAuthSecurity?.ensureRequiredMfa?.(context)||context):context;
      if(!contextHasPermission(secured,required))throw new Error('Quyền truy cập đã thay đổi. Vui lòng đăng nhập lại.');
      if(needsAal2&&secured?.mfa_required!==false&&secured?.aal!=='aal2')throw new Error('Thao tác này yêu cầu xác thực MFA cấp AAL2.');
      return secured;
    }catch(error){alert(`${label} không được thực hiện: ${error.message||error}`);return null;}
  }
  function auditActor(context){
    return context?.display_name||context?.full_name||context?.email||context?.user_id||'Người dùng';
  }
  function currentRange(){ return {from:document.getElementById('dateFrom')?.value||'',to:document.getElementById('dateTo')?.value||''}; }
  function previousRange(range=currentRange()){
    if(!range.from||!range.to)return {from:'',to:''};
    const from=new Date(`${range.from}T12:00:00`),to=new Date(`${range.to}T12:00:00`),days=Math.max(1,Math.round((to-from)/86400000)+1);
    const prevTo=new Date(from.getTime()-86400000),prevFrom=new Date(prevTo.getTime()-(days-1)*86400000);
    return {from:Calc.localISODate(prevFrom),to:Calc.localISODate(prevTo)};
  }
  function trendInfo(current,previous,inverse=false){
    const c=Number(current)||0,p=Number(previous)||0;
    if(Math.abs(p)<1)return {text:'',className:'trend-flat'};
    const pct=(c-p)/Math.abs(p)*100,good=inverse?pct<=0:pct>=0;
    return {text:`${pct>=0?'+':''}${fmtNum(pct,1)}%`,className:good?'trend-up':'trend-down'};
  }
  function elapsedMonthCount(range=currentRange()){
    const a=Calc.monthlySeries(db,range);return Math.max(1,a.payrollFixed.filter((x,i)=>x>0||a.payrollCtv[i]>0).length);
  }
  function costPerHour(person){ return Calc.costPerHour(person,db.settings); }
  function laborCost(projectId='', month=''){
    const r=currentRange(); if(month){r.from=`${month}-01`;r.to=`${month}-31`;}
    return Calc.laborCost(db,{...r,projectId});
  }
  function projectExpenses(projectId){ return Calc.projectDirectExpenses(db,projectId,currentRange()); }
  function projectCost(projectId){ return Calc.projectCost(db,projectId,{to:currentRange().to}).total; }
  function projectBudgetUsage(project){ const x=Calc.projectFinancials(db,project.id,{to:currentRange().to}); return x.directBudget ? x.actualCost/Number(x.directBudget)*100 : 0; }
  function totalCollected(){ return Calc.cashFlow(db,currentRange()).cashIn; }
  function totalPaid(){ return Calc.cashFlow(db,currentRange()).cashOut; }
  function receivables(){ return Calc.accountBalance(db,'131',{to:currentRange().to}).endingDebit; }
  function accountByCode(code){ return db.accounts.find(x=>x.code===code); }
  function vendorName(id){ return getById(db.vendors,id)?.name || '—'; }
  function partnerName(type,id){ return type==='client' ? clientName(id) : type==='vendor' ? vendorName(id) : '—'; }
  function postedEntries(){ return Calc.postedEntries(db,currentRange()); }
  function journalTotal(entry,side){ return Calc.journalTotal(entry,side); }
  function entryBalanced(entry){ return Calc.entryValidation(db,entry,entry.id||'').valid; }
  function postedLines(){ return Calc.postedLines(db,currentRange()); }
  function accountMovement(code){ return Calc.accountMovement(db,code,currentRange()); }
  function debitBalance(code){ return Calc.accountBalance(db,code,currentRange()).endingDebit; }
  function creditBalance(code){ return Calc.accountBalance(db,code,currentRange()).endingCredit; }
  function accountTypeTotal(type){ return Calc.accountTypeMovement(db,type,currentRange()); }
  function accountingProfit(){ return Calc.profitAndLoss(db,currentRange()).profitBeforeTax; }
  function cashBookBalance(){ return debitBalance('1111')+debitBalance('1121'); }
  function vatSummary(){ const v=Calc.vatLedgerSummary(db,currentRange());return {output:v.output,input:v.input,payable:Math.max(0,v.output-v.input),creditCarry:Math.max(0,v.input-v.output)}; }
  function taxPartnerName(type,id){ return partnerName(type,id); }
  function taxPartnerCode(type,id){ const x=type==='client'?getById(db.clients,id):getById(db.vendors,id); return x?.taxCode||''; }
  function taxPartnerOptions(){ return partnerOptions(); }
  function invoiceRegisterSummary(){ return Calc.vatRegisterSummary(db,currentRange()); }
  function effectiveCitRate(){ return Calc.citRate(db.settings,currentRange()); }
  function citEstimate(){ return Calc.citEstimate(db,currentRange()); }
  function pitRegisterSummary(){ return Calc.pitRegisterSummary(db,currentRange()); }
  function filingState(x){
    if(x.filingStatus==='Filed'&&['Paid','No payment'].includes(x.paymentStatus))return 'Completed';
    if(x.filingStatus==='Not required'&&(Calc.vnd(x.payableAmount)===0||x.paymentStatus==='Paid'))return 'Completed';
    const due=x.dueDate?new Date(`${x.dueDate}T23:59:59`):null,now=new Date();
    if(due&&due<now&&x.filingStatus!=='Filed')return 'Overdue';
    if(due){const days=Math.ceil((due-now)/86400000),windowDays=Math.max(1,Math.min(90,Number(db.settings.taxReminderWindowDays)||30));if(days<=windowDays)return 'Due soon';}
    return x.filingStatus||'Not prepared';
  }
  function filingStateLabel(state){return ({Completed:'Hoàn tất',Overdue:'Quá hạn','Due soon':'Sắp đến hạn','Not prepared':'Chưa chuẩn bị',Preparing:'Đang chuẩn bị',Filed:'Đã nộp','Not required':'Không phải nộp hồ sơ'})[state]||state||'Chưa chuẩn bị';}
  function daysUntilTaxDue(row){if(!row?.dueDate)return null;return Math.ceil((new Date(`${row.dueDate}T23:59:59`)-new Date())/86400000);}
  function taxCalendarRange({rule,year,index}){
    const frequency=String(rule?.frequency||'').toLowerCase();
    if(frequency==='monthly')return {from:`${year}-${String(index).padStart(2,'0')}-01`,to:Calc.localISODate(new Date(year,index,0))};
    if(frequency==='quarterly'){const startMonth=(index-1)*3+1;return {from:`${year}-${String(startMonth).padStart(2,'0')}-01`,to:Calc.localISODate(new Date(year,startMonth+2,0))};}
    return {from:`${year}-01-01`,to:`${year}-12-31`};
  }
  function taxCalendarAmount(context){
    const range=taxCalendarRange(context),type=String(context?.rule?.taxType||'');
    if(type==='VAT'){const v=Calc.vatRegisterSummary(db,range);return v.payable;}
    if(type==='PIT')return Calc.pitRegisterSummary(db,range).tax;
    if(type==='CIT provisional')return Calc.citEstimate(db,range).tax;
    return 0;
  }
  function activeTaxCalendarPackage(date=today()){
    return TaxPackages.getActivePackage(db,date)||window.AlphaTaxComplianceReference||null;
  }
  function taxCalendarSourceInfo(year){
    const active=activeTaxCalendarPackage(`${year}-12-31`),pkg=active?.package||active||{},manifest=pkg.manifest||active?.manifest||{};
    const references=(pkg.legalReferences||[]).map(row=>row.number||row.title||'').filter(Boolean);
    const rawStatus=String(manifest.status||active?.status||'reference-only');
    const status=rawStatus==='reference-only'?'tham chiếu nội bộ đã kiểm soát':rawStatus==='active'?'đang áp dụng':'cần rà soát';
    return {year,name:manifest.name||active?.name||'Gói lịch thuế nội bộ',status,verifiedOn:manifest.verifiedOn||manifest.verifiedAt||active?.verifiedAt||'',references,sourcePolicy:manifest.sourcePolicy||''};
  }
  function taxCalendarYears(){
    const years=new Set([Number(today().slice(0,4)),Number(today().slice(0,4))+1]);
    const range=currentRange();[range.from,range.to].forEach(value=>{if(/^\d{4}-/.test(String(value||'')))years.add(Number(String(value).slice(0,4)));});
    return [...years].filter(year=>Number.isInteger(year)&&year>=1900&&year<=9999).sort((a,b)=>a-b);
  }
  function refreshTaxCalendar({persist=false}={}){
    const years=taxCalendarYears(),frequency=db.settings.taxFilingFrequency||'Quarterly',versions=new Set();
    const generated=years.flatMap(year=>{
      const activePackage=activeTaxCalendarPackage(`${year}-12-31`);
      versions.add(activePackage?.version||activePackage?.manifest?.version||activePackage?.package?.manifest?.version||'lịch mặc định nội bộ');
      return TaxCalendar.generateYear({year,frequency,activePackage,nonWorkingDates:activePackage?.package?.nonWorkingDates||activePackage?.nonWorkingDates||[],amountResolver:taxCalendarAmount});
    });
    const next=TaxCalendar.merge(db.taxFilings||[],generated,years);
    const changed=TaxCalendar.diffSignature(next)!==TaxCalendar.diffSignature(db.taxFilings||[]);
    if(changed){db.taxFilings=next;if(persist)saveDB();}
    return {changed,count:next.length,years,packageVersion:[...versions].join(', ')};
  }
  function taxCalendarPriority(row){const state=filingState(row);return state==='Overdue'?0:state==='Due soon'?1:state==='Preparing'?2:state==='Not prepared'?3:state==='Filed'?4:5;}
  function taxCalendarCountdown(row){
    const state=filingState(row),days=daysUntilTaxDue(row);
    if(state==='Completed')return 'Đã hoàn tất';
    if(days===null)return filingStateLabel(state);
    if(days<0)return `Quá hạn ${Math.abs(days)} ngày`;
    if(days===0)return 'Đến hạn hôm nay';
    return `Còn ${days} ngày`;
  }
  function syncDynamicCompliance({persist=false,renderView=false,notify=false}={}){
    const result=refreshTaxCalendar({persist});buildNotifications();
    if(renderView&&result.changed&&currentView==='tax')render();
    if(notify&&result.changed)toastMsg(`Lịch thuế đã cập nhật cho ${result.years.join(', ')}`);
    return result;
  }
  function latePaymentEstimate(x){
    if(!x.dueDate||['Paid','No payment'].includes(x.paymentStatus)||Calc.vnd(x.payableAmount)<=0)return {days:0,amount:0};
    const due=new Date(`${x.dueDate}T23:59:59`),now=new Date();if(now<=due)return {days:0,amount:0};
    const days=Math.max(0,Math.ceil((now-due)/86400000));return {days,amount:Calc.vnd(Calc.vnd(x.payableAmount)*Number(db.settings.latePaymentDailyRate||0.03)/100*days)};
  }
  function taxReconciliation(){ const reg=Calc.vatRegisterSummary(db,currentRange()),ledger=Calc.vatLedgerSummary(db,currentRange());return {reg,ledger,outputDiff:reg.output-ledger.output,inputDiff:reg.inputDeductible-ledger.input}; }
  function taxIssueCount(){ return Calc.integrityChecks(db,currentRange()).checks.filter(x=>!x.pass).length; }
  function accountOptions(activeOnly=true){
    return db.accounts.filter(a=>(!activeOnly||a.active)&&a.postable!==false).sort((a,b)=>a.code.localeCompare(b.code)).map(a=>({value:a.code,label:`${a.code} — ${a.name}`}));
  }
  function partnerOptions(){
    return [{value:'',label:'— Không gắn đối tượng —'}]
      .concat(db.clients.map(x=>({value:`client:${x.id}`,label:`KH | ${x.code} — ${x.name}`})))
      .concat(db.vendors.map(x=>({value:`vendor:${x.id}`,label:`NCC | ${x.code} — ${x.name}`})));
  }
  function trialBalanceRows(){ return Calc.trialBalance(db,currentRange()).rows; }
  function partnerBalanceRows(accountCode,type){ return Calc.partnerBalances(db,accountCode,type,{to:currentRange().to}).map(x=>({...x,name:partnerName(type,x.partnerId)})); }
  function projectAccountingRows(){
    return db.projects.map(p=>{
      const lines=postedLines().filter(x=>x.projectId===p.id);
      const revenue=lines.filter(x=>accountByCode(x.accountCode)?.type==='Revenue').reduce((s,x)=>s+Number(x.credit||0)-Number(x.debit||0),0);
      const cost=lines.filter(x=>['Expense'].includes(accountByCode(x.accountCode)?.type)).reduce((s,x)=>s+Number(x.debit||0)-Number(x.credit||0),0);
      const wip=lines.filter(x=>x.accountCode==='154').reduce((s,x)=>s+Number(x.debit||0)-Number(x.credit||0),0);
      return {project:p,revenue,cost,wip,profit:revenue-cost};
    });
  }
  function overdueTask(t){ return t.status!=='Done' && t.dueDate && new Date(`${t.dueDate}T23:59:59`) < new Date(); }
  function field(name,label,type='text',value='',options=[],full=false,attrs=''){
    const cls = full ? 'field full' : 'field';
    const controlId=`field-${String(name).replace(/[^a-zA-Z0-9_-]+/g,'-')}`;
    if(type==='select'){
      return `<div class="${cls}"><label for="${controlId}">${label}</label><select id="${controlId}" name="${name}" ${attrs}>${options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }
    if(type==='textarea') return `<div class="${cls}"><label for="${controlId}">${label}</label><textarea id="${controlId}" name="${name}" ${attrs}>${esc(value)}</textarea></div>`;
    return `<div class="${cls}"><label for="${controlId}">${label}</label><input id="${controlId}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}/></div>`;
  }
  function options(list, labelFn=(x)=>x.name, includeBlank=true){
    const arr = includeBlank ? [{value:'',label:'— Chọn —'}] : [];
    return arr.concat(list.map(x=>({value:x.id,label:labelFn(x)})));
  }


  function compactMoney(v){
    const n=Number(v)||0, a=Math.abs(n);
    if(a>=1e9) return `${fmtNum(n/1e9,2)} tỷ`;
    if(a>=1e6) return `${fmtNum(n/1e6,1)} tr`;
    if(a>=1e3) return `${fmtNum(n/1e3,0)} nghìn`;
    return fmtNum(n,0);
  }
  const ACCOUNTING_REGIME_PROFILES={
    TT99:{code:'TT99',value:'TT99/2025/TT-BTC',label:'TT99/2025/TT-BTC — Chế độ kế toán doanh nghiệp',policyVersion:'ALPHA-TT99-2026.01',statutoryLabel:'BCTC TT99',description:'Chế độ kế toán doanh nghiệp áp dụng cho năm tài chính bắt đầu từ hoặc sau 01/01/2026.'},
    TT133:{code:'TT133',value:'TT133/2016/TT-BTC (DNNVV)',label:'TT133/2016/TT-BTC — Doanh nghiệp nhỏ và vừa',policyVersion:'ALPHA-TT133-2026.04',statutoryLabel:'BCTC TT133',description:'Chế độ kế toán doanh nghiệp nhỏ và vừa.'},
    TT132:{code:'TT132',value:'TT132/2018/TT-BTC (DNSN)',label:'TT132/2018/TT-BTC — Doanh nghiệp siêu nhỏ',policyVersion:'ALPHA-TT132-2026.01',statutoryLabel:'BCTC TT132',description:'Chế độ kế toán dành cho doanh nghiệp siêu nhỏ.'}
  };
  function accountingRegimeCode(value=db?.settings?.accountingRegime||''){
    const text=String(value||'').toUpperCase();
    if(text.includes('TT99'))return 'TT99';
    if(text.includes('TT132'))return 'TT132';
    return 'TT133';
  }
  function accountingRegimeProfile(value=db?.settings?.accountingRegime||''){return ACCOUNTING_REGIME_PROFILES[accountingRegimeCode(value)]||ACCOUNTING_REGIME_PROFILES.TT133;}
  function accountingRegimeOptions(){return Object.values(ACCOUNTING_REGIME_PROFILES).map(x=>({value:x.value,label:x.label}));}
  function applyAccountingRegimeProfile(previousRegime=''){
    const profile=accountingRegimeProfile();
    db.settings.accountingPolicyVersion=profile.policyVersion;
    db.accounts=(db.accounts||[]).map(account=>({...account,regime:profile.code,regimeEffectiveDate:db.settings.accountingRegimeEffectiveDate||'',policyVersion:profile.policyVersion}));
    const activeTemplate=(db.statutoryReportTemplates||[]).find(x=>String(x.id)===String(db.settings.activeStatutoryTemplateId||''));
    if(activeTemplate&&!String(activeTemplate.accountingRegime||'').toUpperCase().includes(profile.code))db.settings.activeStatutoryTemplateId='';
    if(previousRegime&&previousRegime!==db.settings.accountingRegime){
      db.settings.accountingRegimeAppliedAt=new Date().toISOString();
      db.settings.accountingRegimeAppliedCode=profile.code;
    }
    return profile;
  }
  function chartMoneyAxisMeta(maxValue){
    const max=Math.abs(Number(maxValue)||0);
    return max>=1000?{divisor:1000,unit:'tỷ',decimals:max>=10000?0:1}:{divisor:1,unit:'tr',decimals:max>=100?0:1};
  }
  function aData(){
    const x=Calc.monthlySeries(db,currentRange()), departments=Calc.revenueByDepartment(db,currentRange());
    const completion=x.keys.map((key)=>{const rows=db.tasks.filter((t)=>String(t.dueDate||'').startsWith(key));return rows.length?rows.filter((t)=>t.status==='Done').length/rows.length*100:0;});
    return {...x,departments:departments.length?departments:[{name:'Chưa phân loại',value:1,color:'#0b73f6'}],completion};
  }
  function inDateRange(date){
    const from=document.getElementById('dateFrom')?.value||'', to=document.getElementById('dateTo')?.value||'';
    return (!from||date>=from)&&(!to||date<=to);
  }
  function filtersForView(view=currentView){
    return activeFilters.view===view?activeFilters:{status:'',project:'',department:''};
  }
  function filterRecordStatus(record,view=currentView){
    if(view==='timesheets')return record.approved?'Approved':'Pending';
    if(view==='controls'&&record.project)return String(record.eacConfidence||record.project.risk||record.project.status||'');
    return String(record?.status||record?.paymentStatus||record?.invoiceStatus||'');
  }
  function filterRecordProjectIds(record){
    const ids=[];
    const add=(value)=>{if(value!==undefined&&value!==null&&String(value)!=='')ids.push(String(value));};
    add(record?.projectId);add(record?.project_id);add(record?.project?.id);
    if(record?.clientId!==undefined&&record?.contractValue!==undefined)add(record.id);
    (record?.lines||[]).forEach(line=>{add(line.projectId);add(line.project_id);});
    return [...new Set(ids)];
  }
  function filterRecordDepartment(record,view=currentView){
    if(record?.department)return String(record.department);
    const personId=record?.personId||record?.assigneeId||record?.ownerId||record?.requesterId||record?.pmId||record?.project?.pmId;
    return String(getById(db.people,personId)?.department||'');
  }
  function matchesViewFilters(record,view=currentView){
    const filters=filtersForView(view);
    const status=filterRecordStatus(record,view);
    const projectIds=filterRecordProjectIds(record);
    const department=filterRecordDepartment(record,view);
    return (!filters.status||status===filters.status)
      &&(!filters.project||projectIds.includes(String(filters.project)))
      &&(!filters.department||department===filters.department);
  }
  function filterRowsForView(rows,view=currentView){
    return (rows||[]).filter(row=>matchesViewFilters(row,view));
  }
  function filteredProjects(view=currentView){
    return filterRowsForView(db.projects,view);
  }
  function filteredDocuments(){
    return filterRowsForView(db.documents,'documents');
  }
  function filteredJournalEntries(){
    return filterRowsForView(db.journalEntries,'accounting');
  }
  function chartPolyline(values,maxValue=0){
    const max=maxValue||Math.max(...values,1), n=Math.max(values.length-1,1);
    return values.map((v,i)=>`${(i/n*1000).toFixed(1)},${(198-(Number(v)||0)/max*185).toFixed(1)}`).join(' ');
  }
  function lineCircles(values,maxValue,color){
    const max=maxValue||Math.max(...values,1), n=Math.max(values.length-1,1);
    return values.map((v,i)=>`<circle cx="${(i/n*1000).toFixed(1)}" cy="${(198-(Number(v)||0)/max*185).toFixed(1)}" r="5" fill="${color}"></circle>`).join('');
  }
  function comboChart(labels,barSeries,lineSeries=[],opts={}){
    const barValues=barSeries.flatMap(s=>s.values).map(Number),rawBarMax=Math.max(...barValues.map(v=>Math.abs(v)),1);
    const barMax=opts.integer?Math.max(1,Math.ceil(rawBarMax)):rawBarMax*1.1;
    const lineValues=lineSeries.flatMap(s=>s.values).map(Number),lineMax=opts.lineMax||Math.max(...lineValues.map(v=>Math.abs(v)),1)*1.1;
    const ticks=opts.integer?[barMax,Math.ceil(barMax*.75),Math.ceil(barMax*.5),Math.ceil(barMax*.25),0]:[barMax,barMax*.75,barMax*.5,barMax*.25,0];
    const chartClass=opts.className?` ${esc(opts.className)}`:'';
    const autoScroll=opts.scrollLabels===true||(opts.scrollLabels!==false&&labels.length>18);
    const plotMinWidth=autoScroll?Math.max(Number(opts.minPlotWidth||0),labels.length*78,840):0;
    const moneyMeta=chartMoneyAxisMeta(rawBarMax);
    const displayValue=value=>opts.integer?`${fmtNum(value,0)}${opts.axisUnit?` ${opts.axisUnit}`:''}`:opts.percent?`${fmtNum(value,0)}%`:`${fmtNum(Number(value)/moneyMeta.divisor,moneyMeta.decimals)} ${moneyMeta.unit}`;
    const plot=`<div class="plot"${plotMinWidth?` style="min-width:${plotMinWidth}px"`:''}><div class="bar-groups" style="grid-template-columns:repeat(${labels.length},minmax(0,1fr))">${labels.map((_,i)=>`<div class="bar-group">${barSeries.map(series=>`<i class="bar" title="${esc(`${series.name}: ${displayValue(Number(series.values[i])||0)}`)}" style="height:${Math.max(1,(Math.abs(Number(series.values[i])||0))/barMax*100)}%;background:${series.color}"></i>`).join('')}</div>`).join('')}</div>${lineSeries.map(series=>`<svg class="line-svg" viewBox="0 0 1000 200" preserveAspectRatio="none"><polyline points="${chartPolyline(series.values,lineMax)}" stroke="${series.color}"></polyline>${lineCircles(series.values,lineMax,series.color)}</svg>`).join('')}<div class="x-labels" style="grid-template-columns:repeat(${labels.length},1fr)">${labels.map(x=>`<span title="${esc(x)}">${esc(x)}</span>`).join('')}</div></div>`;
    const axisLabel=value=>displayValue(value);
    const axisUnit=opts.integer?(opts.axisUnit||''):opts.percent?'%':moneyMeta.unit;
    return `<div class="chart-legend">${[...barSeries,...lineSeries].map(series=>`<span class="legend-item"><i class="${lineSeries.includes(series)?'legend-line':'legend-dot'}" style="background:${series.color}"></i>${esc(series.name)}</span>`).join('')}<span class="chart-unit-badge">Đơn vị: ${esc(axisUnit)}</span></div><div class="combo-chart${chartClass}"><div class="y-axis">${ticks.map(value=>`<span>${axisLabel(value)}</span>`).join('')}</div>${autoScroll?`<div class="chart-horizontal-scroll">${plot}</div>`:plot}</div>`;
  }
  function lineChart(labels,series,opts={}){
    const max=Math.max(...series.flatMap(s=>s.values),1)*1.08;
    return `<div class="chart-legend">${series.map(s=>`<span class="legend-item"><i class="legend-line" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div><div class="mini-line"><svg viewBox="0 0 1000 210" preserveAspectRatio="none">${series.map(s=>`<polyline points="${chartPolyline(s.values,max)}" stroke="${s.color}"></polyline>${lineCircles(s.values,max,s.color)}`).join('')}</svg><div class="x-labels">${labels.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`;
  }
  function stackedChart(labels,series){
    const totals=labels.map((_,i)=>series.reduce((s,x)=>s+(Number(x.values[i])||0),0)), max=Math.max(...totals,1)*1.05;
    return `<div class="chart-legend">${series.map(s=>`<span class="legend-item"><i class="legend-dot" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div><div class="stacked-bars">${labels.map((_,i)=>`<div class="stacked-col">${series.map(s=>`<i class="stack-seg" style="height:${(Number(s.values[i])||0)/max*100}%;background:${s.color}"></i>`).join('')}</div>`).join('')}<div class="stacked-labels">${labels.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`;
  }
  function donutChart(items,centerLabel,centerValue){
    const total=items.reduce((s,x)=>s+Number(x.value||0),0)||1; let at=0; const stops=[];
    items.forEach(x=>{const start=at;at+=x.value/total*100;stops.push(`${x.color} ${start}% ${at}%`)});
    return `<div class="donut-layout"><div class="donut" style="background:conic-gradient(${stops.join(',')})"><div class="donut-center"><small>${esc(centerLabel)}</small><strong>${esc(centerValue)}</strong></div></div><div class="donut-list">${items.map(x=>`<div class="donut-row"><i style="background:${x.color}"></i><span>${esc(x.name)}</span><span>${fmtNum(x.value/total*100,1)}%</span></div>`).join('')}</div></div>`;
  }
  function waterfallChart(items){
    const max=Math.max(...items.map(x=>Math.abs(x.value)),1);
    return `<div class="waterfall">${items.map(x=>`<div class="wf-col"><b>${compactMoney(x.value*1000000)}</b><i class="wf-bar" style="height:${Math.max(6,Math.abs(x.value)/max*100)}%;background:${x.color}"></i><small>${esc(x.label)}</small></div>`).join('')}</div>`;
  }
  function heatmap(rows=Calc.peopleUtilization(db,currentRange())){
    const depts=[...new Set(rows.map((x)=>x.department||'Chưa phân loại'))];
    const matrix=depts.map((dept)=>{const p=rows.filter((x)=>(x.department||'Chưa phân loại')===dept),b=[0,0,0,0];p.forEach((x)=>{const v=x.load||0;b[v<50?0:v<75?1:v<=100?2:3]++;});return [dept,...b];});
    if(!matrix.length)return '<p class="muted">Chưa có dữ liệu nhân sự.</p>';
    return `<div class="heatmap"><div class="head"></div><div class="head">&lt;50%</div><div class="head">50–75%</div><div class="head">75–100%</div><div class="head">&gt;100%</div>${matrix.map(r=>`<div class="label">${esc(r[0])}</div>${r.slice(1).map((v,i)=>`<div class="heat-${i+1}">${v}</div>`).join('')}`).join('')}</div>`;
  }
  function dashboardTable(){
    const rows=filteredProjects().slice(0,5).map(project=>({project,...Calc.projectFinancials(db,project.id,{to:currentRange().to})}));
    return `<div class="table-wrap dashboard-project-table-wrap"><table class="table-fit-wide table-dashboard-projects"><colgroup><col class="dashboard-col-project"><col class="dashboard-col-client"><col class="dashboard-col-progress"><col class="dashboard-col-contract"><col class="dashboard-col-cost"><col class="dashboard-col-status"></colgroup><thead><tr><th>Dự án</th><th>Khách hàng</th><th>Tiến độ</th><th class="numeric">Hợp đồng đã ký</th><th class="numeric">Actual Cost</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.project.name)}</strong><div class="muted">${esc(x.project.code)}</div></td><td>${esc(clientName(x.project.clientId))}</td><td><div class="progress"><span style="width:${Math.max(0,Math.min(100,Number(x.progress)||0))}%"></span></div><small>${fmtNum(x.progress,0)}% • ${esc(x.progressSource)}</small></td><td class="numeric">${x.lifecycle==='pipeline'?`<span class="muted">Pipeline ${compactMoney(x.pipelineValue)}</span>`:fmtMoney(x.contractValue)}</td><td class="numeric">${fmtMoney(x.actualCost)}</td><td>${badge(x.project.status)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function activityPanel(){
    const acts=[['▣','Hợp đồng Aurora đã được cập nhật','10:30'],['✓','Timesheet kiến trúc đã được duyệt','09:15'],['₫','Phiếu chi CTV đang chờ phê duyệt','Hôm nay'],['▤','Bút toán doanh thu đã ghi sổ','Hôm qua']];
    return `<div class="activity-list">${acts.map(x=>`<div class="activity"><i class="activity-icon">${x[0]}</i><div><strong>${x[1]}</strong><small>ALPHA DESIGN ERP</small></div><small>${x[2]}</small></div>`).join('')}</div>`;
  }

  const viewMeta = {
    dashboard:['Tổng quan','Trung tâm điều hành ALPHA DESIGN','⌂'],
    tasks:['Công việc','Giao việc, tiến độ và chất lượng đầu ra','☑'],
    projects:['Dự án','Hợp đồng, ngân sách và hiệu quả dự án','▣'],
    controls:['Kiểm soát vận hành','Thực tế, dự báo, chi phí ước tính khi hoàn thành, hiệu quả chi phí, hiệu quả tiến độ và chất lượng dữ liệu','◈'],
    commercial:['Hợp đồng & Công nợ','Hợp đồng, lịch thanh toán, hóa đơn và tuổi nợ','⌘'],
    planning:['Ngân sách & Nguồn lực','Budget baseline, resource plan và chi phí cam kết','◇'],
    procurement:['Mua sắm & Tài sản','Đề nghị mua, đơn mua hàng, CCDC, TSCĐ và lịch phân bổ/khấu hao','▦'],
    crm:['Khách hàng & Doanh thu','Pipeline, doanh thu và công nợ phải thu','◎'],
    finance:['Dòng tiền','Tiền vào, tiền ra và thanh khoản','↕'],
    financialAnalytics:['Phân tích tài chính','Hệ số tài chính, kịch bản 12 tháng và kiểm toán liên kết','◉'],
    accounting:['Kế toán','Chứng từ, công nợ và báo cáo quản trị','▤'],
    tax:['Thuế','VAT, TNCN, TNDN và lịch tuân thủ','◫'],
    payroll:['Lương','Quỹ lương, CTV và khả năng thu hồi chi phí','₫'],
    people:['Nhân sự','Cơ cấu, tải công việc và hiệu suất','♙'],
    timesheets:['Chấm công','Timesheet, billable hours và phê duyệt','◷'],
    approvals:['Phê duyệt','Thanh toán, mua hàng và yêu cầu nội bộ','⌁'],
    documents:['Hồ sơ','Hợp đồng, biên bản và phiên bản tài liệu','▥'],
    exports:['Trung tâm xuất/nhập','Excel, PDF, CSV, XML, Word, JSON và gói hồ sơ ZIP','⇩'],
    trash:['Thùng rác','Khôi phục đúng phân hệ hoặc xóa vĩnh viễn; dữ liệu tự dọn sau 30 ngày','♲'],
    settings:['Thiết lập','Cấu hình hệ thống và quản trị dữ liệu','⚙']
  };

  function setNavGroupState(group,open){
    if(!group)return;
    group.classList.toggle('is-open',Boolean(open));
    group.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded',String(Boolean(open)));
  }
  function syncActiveNavGroup(){
    const active=document.querySelector('#nav .nav-item.active');
    const activeGroup=active?.closest('.nav-group');
    if(!activeGroup)return;
    document.querySelectorAll('#nav .nav-group').forEach(group=>setNavGroupState(group,group===activeGroup));
  }

  function tableViewportContext(){
    const range=currentRange(),filters=filtersForView(currentView);
    return JSON.stringify({
      view:currentView,
      accountingTab:currentView==='accounting'?currentAccountingTab:'',
      controlTab:currentView==='controls'?currentControlTab:'',
      procurementTab:currentView==='procurement'?currentProcurementTab:'',
      financialTab:currentView==='financialAnalytics'?currentFinancialTab:'',
      forecastScenario:currentView==='financialAnalytics'?currentForecastScenarioId:'',
      payrollMonth:currentView==='payroll'?currentPayrollMonth:'',
      benefitYear:currentView==='payroll'?currentBenefitYear:'',
      range:[range.from||'',range.to||''],
      filters:[filters.status||'',filters.project||'',filters.department||'']
    });
  }
  function tableViewportKey(wrap,index){
    const table=wrap.querySelector('table');
    const explicit=wrap.dataset.tableScrollKey||wrap.id||table?.id||wrap.closest('[data-local-table-filter]')?.dataset.localTableFilter||'';
    const headers=[...(table?.querySelectorAll('thead th')||[])].map(cell=>String(cell.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()).join('|');
    return `${index}::${explicit}::${headers}`;
  }
  function captureTableViewportState(nextContext){
    const previousContext=content.dataset.tableViewportContext||'';
    if(!previousContext||previousContext!==nextContext||pendingFocus)return null;
    const tables=[...content.querySelectorAll('.table-wrap')].map((wrap,index)=>{
      const wrapRect=wrap.getBoundingClientRect(),table=wrap.querySelector('table'),headerHeight=table?.tHead?.getBoundingClientRect().height||0;
      const visibleTop=wrapRect.top+headerHeight;
      const anchor=[...wrap.querySelectorAll('tbody tr[data-record-id]')].find(row=>row.getBoundingClientRect().bottom>visibleTop);
      return {
        key:tableViewportKey(wrap,index),
        index,
        top:wrap.scrollTop,
        left:wrap.scrollLeft,
        anchorId:anchor?.dataset.recordId||'',
        anchorOffset:anchor?anchor.offsetTop-wrap.scrollTop:0
      };
    });
    return {context:nextContext,tables,windowX:window.scrollX,windowY:window.scrollY};
  }
  function restoreTableViewportState(snapshot,currentContext){
    if(!snapshot||snapshot.context!==currentContext||pendingFocus)return;
    const savedByKey=new Map(snapshot.tables.map(state=>[state.key,state]));
    const currentTables=[...content.querySelectorAll('.table-wrap')];
    currentTables.forEach((wrap,index)=>{
      const state=savedByKey.get(tableViewportKey(wrap,index))||(snapshot.tables.length===currentTables.length?snapshot.tables[index]:null);
      if(!state)return;
      let nextTop=Number(state.top)||0;
      if(state.anchorId){
        const escaped=globalThis.CSS?.escape?CSS.escape(String(state.anchorId)):String(state.anchorId).replace(/["\\]/g,'\\$&');
        const anchor=wrap.querySelector(`tbody tr[data-record-id="${escaped}"]`);
        if(anchor)nextTop=anchor.offsetTop-(Number(state.anchorOffset)||0);
      }
      wrap.scrollTop=Math.max(0,Math.min(nextTop,Math.max(0,wrap.scrollHeight-wrap.clientHeight)));
      wrap.scrollLeft=Math.max(0,Math.min(Number(state.left)||0,Math.max(0,wrap.scrollWidth-wrap.clientWidth)));
      wrap.classList.toggle('at-scroll-end',wrap.scrollLeft+wrap.clientWidth>=wrap.scrollWidth-4);
    });
    window.scrollTo(snapshot.windowX,snapshot.windowY);
  }

  function render(options={}){
    const preserveTableViewport=options.preserveTableViewport!==false;
    const viewportContext=tableViewportContext();
    const viewportState=preserveTableViewport?captureTableViewportState(viewportContext):null;
    const meta=viewMeta[currentView]||viewMeta.dashboard; pageTitle.textContent=meta[0]; pageSubtitle.textContent=meta[1]; if(pageIcon) pageIcon.textContent=meta[2]||'⌂';
    primaryAction.style.display=['dashboard','controls','payroll','financialAnalytics','exports','trash','settings'].includes(currentView)?'none':'';
    primaryAction.textContent=currentView==='accounting'?'+ Chứng từ':currentView==='tax'?'+ Nghĩa vụ thuế':currentView==='commercial'?'+ Hợp đồng':currentView==='planning'?'+ Kế hoạch nguồn lực':currentView==='procurement'?'+ Đề nghị mua':'+ Thêm mới';
    document.querySelectorAll('.nav-item').forEach(b=>{
      const isActive=b.dataset.view===currentView;
      b.classList.toggle('active',isActive);
      if(isActive)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
      b.title=b.querySelector('.nav-label')?.textContent?.trim()||'';
    });
    syncActiveNavGroup();
    document.querySelectorAll('[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===currentView));
    const toolbarFilter=document.getElementById('filterBtn');if(toolbarFilter){const f=filtersForView(currentView);toolbarFilter.classList.toggle('has-active-filter',Boolean(f.status||f.project||f.department));toolbarFilter.setAttribute('aria-pressed',String(Boolean(f.status||f.project||f.department)));}
    const fn=renderers[currentView]||renderDashboard; content.innerHTML=fn(); content.dataset.tableViewportContext=viewportContext; bindViewEvents(); bindLocalTableFilters(); attachQuickTableFilters();
    // Khôi phục ngay trong cùng tác vụ render. Việc đo layout bên dưới buộc trình duyệt
    // hoàn tất bố cục trước khi JS nhường lại quyền vẽ, nên không có khung hình tạm ở dòng 1.
    enhanceResponsiveTables();
    restoreTableViewportState(viewportState,viewportContext);
    if(pendingFocus && pendingFocus.view===currentView){
      const focus=()=>{
        const row=content.querySelector(`[data-record-id="${CSS.escape(String(pendingFocus.id))}"]`);
        if(row){row.classList.add('record-focus');row.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>row.classList.remove('record-focus'),2600);}
        pendingFocus=null;
      };
      requestAnimationFrame(()=>requestAnimationFrame(focus));
    }
  }

  function renderDashboard(){
    const r=currentRange(),pr=previousRange(r),a=aData(),pnl=Calc.profitAndLoss(db,r),prevPnl=Calc.profitAndLoss(db,pr),revenue=pnl.revenue,profit=pnl.profitBeforeTax;
    const cash=Calc.cashFlow(db,r),prevCash=Calc.cashFlow(db,pr),tax=invoiceRegisterSummary().payable+pitRegisterSummary().tax+citEstimate().tax;
    const profitSeries=a.revenue.map((x,i)=>x-a.cost[i]),revTrend=trendInfo(revenue,prevPnl.revenue),profitTrend=trendInfo(profit,prevPnl.profitBeforeTax),cashTrend=trendInfo(cash.net,prevCash.net);
    const ar=receivables(),prevAr=Calc.accountBalance(db,'131',{to:pr.to}).endingDebit,arTrend=trendInfo(ar,prevAr,true),portfolio=Calc.portfolioHealth(db,{to:r.to});
    const portfolioProgress=portfolio.contractedRows.length?(portfolio.contractValue?portfolio.contractedRows.reduce((sum,row)=>sum+Number(row.progress||0)*Number(row.contractValue||0),0)/portfolio.contractValue:portfolio.contractedRows.reduce((sum,row)=>sum+Number(row.progress||0),0)/portfolio.contractedRows.length):0;
    return `<div class="grid dashboard-kpi-grid dashboard-core-grid">
      ${kpi('Doanh thu',compactMoney(revenue),revTrend.text?'so với kỳ liền trước':'Theo chứng từ Posted',true,{icon:'▥',color:'blue',trend:revTrend.text,trendClass:revTrend.className,unit:'VND'})}
      ${kpi('Lợi nhuận',compactMoney(profit),profitTrend.text?'so với kỳ liền trước':'Trước thuế',profit>=0,{icon:'↗',color:'green',trend:profitTrend.text,trendClass:profitTrend.className,unit:'VND'})}
      ${kpi('Dòng tiền thuần',compactMoney(cash.net),cashTrend.text?'so với kỳ liền trước':'Thu/chi đã thanh toán',cash.net>=0,{icon:'↕',color:'teal',trend:cashTrend.text,trendClass:cashTrend.className,unit:'VND'})}
      ${kpi('Công nợ phải thu',compactMoney(ar),arTrend.text?'so với cuối kỳ trước':'Số dư TK 131',ar===0,{icon:'▣',color:'orange',trend:arTrend.text,trendClass:arTrend.className,unit:'VND'})}
    </div>
    <div class="grid dashboard-context-grid section">
      ${kpi('Tổng dự án',fmtNum(db.projects.length,0),`${portfolio.activeProjectCount} đã ký • ${portfolio.pipelineCount} pipeline`,true,{icon:'◫',color:'purple',variant:'compact'})}
      ${kpi('Nhân sự',fmtNum(db.people.filter(x=>x.status==='Active').length,0),'Theo danh mục hiện tại',true,{icon:'♙',color:'blue',variant:'compact'})}
      ${kpi('Nghĩa vụ thuế ước tính',compactMoney(tax),'VAT + TNCN + TNDN quản trị',tax===0,{icon:'₫',color:'red',unit:'VND',variant:'compact'})}
    </div>
    <div class="note dashboard-source-note dashboard-source-card section"><strong>Phân biệt dữ liệu:</strong> Doanh thu, lợi nhuận, dòng tiền và công nợ chỉ thay đổi khi có chứng từ <b>Posted</b>, hóa đơn hoặc giao dịch <b>Paid</b>. Số nhập tại hồ sơ dự án được phản ánh trong nhóm kế hoạch bên dưới.</div>
    <div class="grid kpi-grid project-plan-kpi-grid section">
      ${kpi('Hợp đồng đã ký',compactMoney(portfolio.contractValue),'Chỉ Signed/Active; không cộng Draft/Proposal',true,{icon:'▣',color:'blue',unit:'VND'})}
      ${kpi('Pipeline chưa ký',compactMoney(portfolio.pipelineValue),`${portfolio.pipelineCount} cơ hội chưa vào Contract Value`,true,{icon:'◎',color:'teal',unit:'VND'})}
      ${kpi('Ngân sách trực tiếp',compactMoney(portfolio.directBudget),'Baseline Approved của dự án đã ký',portfolio.estimateAtCompletion<=portfolio.directBudget,{icon:'◇',color:'orange',unit:'VND'})}
      ${kpi('Đóng góp dự án dự báo',compactMoney(portfolio.forecastProfit),`${fmtNum(portfolio.forecastMargin,1)}% • chưa gồm overhead/thuế`,portfolio.forecastProfit>=0,{icon:'↗',color:'green',unit:'VND'})}
      ${kpi('Tiến độ danh mục',`${fmtNum(portfolioProgress,1)}%`,'Gia quyền theo hợp đồng đã cam kết',true,{icon:'◷',color:'purple'})}
      ${kpi('Điểm sức khỏe dữ liệu',`${fmtNum(portfolio.healthScore,0)}/100`,`${portfolio.highConfidence} dự báo hoàn thành tin cậy cao • ${portfolio.lowConfidence} tin cậy thấp`,portfolio.healthScore>=80,{icon:'◈',color:'blue'})}
    </div>
    <div class="grid two-col section"><div class="card chart-card"><div class="section-header"><div><h2>Doanh thu và lợi nhuận theo tháng</h2><p>Chỉ lấy chứng từ Posted • đơn vị tiền tự động chuyển triệu/tỷ VND</p></div><button class="section-link" data-go="crm">Xem doanh thu →</button></div>${comboChart(a.months,[{name:'Doanh thu',values:a.revenue,color:'#0b73f6'},{name:'Lợi nhuận',values:profitSeries,color:'#14b8a6'}],[{name:'Tỷ suất lợi nhuận',values:profitSeries.map((v,i)=>a.revenue[i]?v/a.revenue[i]*100:0),color:'#f59e0b'}],{lineMax:100})}</div><div class="card chart-card"><div class="section-header"><div><h2>Cơ cấu doanh thu theo bộ môn</h2><p>Phân loại theo dự án và PM phụ trách</p></div></div>${donutChart(a.departments,'Tổng doanh thu',compactMoney(revenue))}</div></div>
    <div class="grid three-col section"><div class="card chart-card compact"><div class="section-header"><div><h2>Dòng tiền theo tháng</h2><p>Chỉ giao dịch Paid</p></div></div>${comboChart(a.months,[{name:'Tiền vào',values:a.cashIn,color:'#14b8a6'},{name:'Tiền ra',values:a.cashOut,color:'#ef4444'}],[{name:'Dòng tiền thuần',values:a.cashIn.map((x,i)=>x-a.cashOut[i]),color:'#0b73f6'}])}</div><div class="card chart-card compact"><div class="section-header"><div><h2>Quỹ nhân sự kế hoạch và doanh thu thu hồi</h2><p>Lương kế hoạch từ danh mục + CTV theo timesheet đã duyệt</p></div></div>${comboChart(a.months,[{name:'Lương kế hoạch',values:a.payrollFixed,color:'#0b73f6'},{name:'CTV',values:a.payrollCtv,color:'#14b8a6'}],[{name:'Doanh thu thu hồi',values:a.recovered,color:'#f59e0b'}])}</div><div class="card card-pad"><div class="section-header"><div><h2>Nhắc việc thuế</h2><p>Lịch gần nhất</p></div><button class="section-link" data-go="tax">Xem tất cả</button></div><div class="alert-list">${db.taxFilings.slice().sort((x,y)=>x.dueDate.localeCompare(y.dueDate)).slice(0,4).map(x=>alertItem('◫',`${x.taxType} • ${x.period}`,`Hạn ${fmtDate(x.dueDate)} • ${filingState(x)}`)).join('')}</div></div></div>
    <div class="grid two-col section"><div class="card table-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Tình hình dự án</h2><p>Timesheet đã duyệt + chi trực tiếp phi lao động; P&amp;L xem tại Kế toán</p></div><button class="section-link" data-go="projects">Xem tất cả</button></div>${dashboardTable()}</div><div class="card card-pad"><div class="section-header"><div><h2>Hoạt động gần đây</h2><p>Cập nhật hệ thống</p></div></div>${activityPanel()}</div></div>`;
  }
  function kpi(label,value,foot,good=true,opts={}){
    const trend=opts.trend||'', trendClass=opts.trendClass||(trend.startsWith('-')?'trend-down':trend?'trend-up':'trend-flat');
    const attentionBadge=good?'':`<span class="kpi-status-badge" role="status">Cần chú ý</span>`;
    const variantClass=opts.variant?` kpi-card--${esc(opts.variant)}`:'';
    return `<div class="card kpi-card${variantClass} ${good?'is-positive':'is-attention'}" data-kpi-tone="${esc(opts.color||'blue')}">${attentionBadge}<div class="kpi-top"><i class="kpi-icon ${opts.color||'blue'}">${opts.icon||'▥'}</i><div class="kpi-label">${esc(label)}</div></div><div class="kpi-value">${value}</div>${opts.unit?`<div class="kpi-unit">${esc(opts.unit)}</div>`:''}<div class="kpi-foot"><strong class="${trendClass}">${trend||'—'}</strong><span>${foot||'Theo kỳ đang chọn'}</span></div></div>`;
  }
  function alertItem(icon,title,text){ return `<div class="alert-item"><div class="alert-icon">${icon}</div><div><h4>${esc(title)}</h4><p>${esc(text)}</p></div></div>`; }

  function projectsTable(rows){
    return `<div class="table-wrap project-list-table-wrap"><table><thead><tr><th>Mã / Dự án</th><th>Khách hàng</th><th>Giai đoạn</th><th>PM</th><th>Tiến độ</th><th class="numeric">Giá trị kiểm soát</th><th>Ngân sách dùng</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${rows.map(p=>{ const x=Calc.projectFinancials(db,p.id,{to:currentRange().to}),usage=x.directBudget?x.actualCost/x.directBudget*100:0; return `<tr><td><strong>${esc(p.code)}</strong><div class="muted">${esc(p.name)}</div></td><td>${esc(clientName(p.clientId))}</td><td>${esc(p.stage)}</td><td>${esc(personName(p.pmId))}</td><td><div class="progress"><span style="width:${Math.max(0,Math.min(100,Number(x.progress)||0))}%"></span></div><small>${fmtNum(x.progress)}% • ${esc(x.progressConfidence||'Low')}</small></td><td class="numeric strong">${x.lifecycle==='pipeline'?`<span class="muted">Pipeline ${compactMoney(x.pipelineValue)}</span>`:fmtMoney(x.contractValue)}</td><td><div class="progress ${usage>100?'danger':''}"><span style="width:${Math.min(100,usage)}%"></span></div><small>${fmtNum(usage)}%</small></td><td>${badge(p.status)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="projects" data-id="${esc(p.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="projects" data-id="${esc(p.id)}">Xóa</button></td></tr>`; }).join('')}
    </tbody></table></div>`;
  }
  function renderProjects(){
    return `<div class="card table-card"><div class="table-tools"><input class="search-input" data-table-search="project" aria-label="Tìm kiếm dự án" placeholder="Tìm mã, tên dự án, khách hàng..."><select class="filter-select" data-project-status aria-label="Lọc dự án theo trạng thái"><option value="">Tất cả trạng thái</option>${['Proposal','In Progress','Review','Completed','On Hold'].map(x=>`<option>${x}</option>`).join('')}</select></div><div id="projectTable">${projectsTable(filteredProjects('projects'))}</div></div>`;
  }
  function renderTasks(){
    const taskRows=filterRowsForView(db.tasks,'tasks');
    return `<div class="grid kpi-grid">${kpi('Tổng công việc',fmtNum(db.tasks.length,0),'Toàn bộ dự án')}${kpi('Đang thực hiện',fmtNum(db.tasks.filter(x=>x.status==='In Progress').length,0),'Cần cập nhật tiến độ')}${kpi('Chờ kiểm tra',fmtNum(db.tasks.filter(x=>x.status==='Review').length,0),'Cần QA/QC')}${kpi('Quá hạn',fmtNum(db.tasks.filter(overdueTask).length,0),'Ưu tiên xử lý',db.tasks.filter(overdueTask).length===0)}</div>
      <div class="card table-card section"><div class="table-tools"><input class="search-input" data-table-search="task" aria-label="Tìm kiếm công việc" placeholder="Tìm công việc, dự án, người phụ trách..."><select class="filter-select" data-task-status aria-label="Lọc công việc theo trạng thái"><option value="">Tất cả trạng thái</option>${['Not Started','In Progress','Review','Done','On Hold'].map(x=>`<option>${x}</option>`).join('')}</select></div><div id="taskTable">${tasksTable(taskRows)}</div></div>`;
  }
  function tasksTable(rows){ return `<div class="table-wrap"><table><thead><tr><th>Công việc</th><th>Dự án</th><th>Phụ trách</th><th>Ưu tiên</th><th>Hạn</th><th class="numeric">KH giờ</th><th class="numeric">Thực tế</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(t=>`<tr data-record-id="${esc(t.id)}"><td><strong>${esc(t.title)}</strong>${overdueTask(t)?'<div><span class="badge danger">Quá hạn</span></div>':''}</td><td>${esc(projectName(t.projectId))}</td><td>${esc(personName(t.assigneeId))}</td><td>${badge(t.priority)}</td><td>${fmtDate(t.dueDate)}</td><td class="numeric">${fmtNum(t.estimatedHours)}</td><td class="numeric">${fmtNum(t.actualHours)}</td><td>${badge(t.status)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="tasks" data-id="${esc(t.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="tasks" data-id="${esc(t.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`; }
  function renderTimesheets(){
    const r=currentRange(),rows=filterRowsForView(db.timesheets.filter(x=>Calc.inRange(x.date,r.from,r.to)),'timesheets');
    const hours=rows.reduce((sum,x)=>sum+Number(x.hours||0),0), billable=rows.filter(x=>x.billable).reduce((sum,x)=>sum+Number(x.hours||0),0), approved=rows.filter(x=>x.approved).reduce((sum,x)=>sum+Number(x.hours||0),0);
    return `<div class="grid kpi-grid">${kpi('Tổng giờ',fmtNum(hours),'Trong kỳ đang chọn')}${kpi('Billable hours',fmtNum(billable),`${hours?fmtNum(billable/hours*100):0}% tổng giờ trong kỳ`)}${kpi('Giờ đã duyệt',fmtNum(approved),'Được dùng để phân bổ chi phí')}${kpi('Giờ chờ duyệt',fmtNum(hours-approved),'Chưa vào giá thành dự án',hours===approved)}</div>
      <div class="card table-card section"><div class="table-tools"><input class="search-input" data-table-search="timesheet" aria-label="Tìm kiếm chấm công" placeholder="Tìm dự án, nhân sự, nội dung..."><select class="filter-select" data-ts-approved aria-label="Lọc chấm công theo trạng thái duyệt"><option value="">Tất cả</option><option value="true">Đã duyệt</option><option value="false">Chờ duyệt</option></select></div><div id="timesheetTable">${timesheetsTable(rows)}</div></div>`;
  }
  function timesheetsTable(rows){ return `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Nhân sự</th><th>Dự án</th><th>Nội dung</th><th class="numeric">Giờ</th><th>Billable</th><th>Phê duyệt</th><th>Thao tác</th></tr></thead><tbody>${rows.map(x=>`<tr data-record-id="${esc(x.id)}"><td>${fmtDate(x.date)}</td><td>${esc(personName(x.personId))}</td><td>${esc(projectName(x.projectId))}</td><td>${esc(x.description)}</td><td class="numeric strong">${fmtNum(x.hours)}</td><td>${x.billable?badge('Billable'):badge('Non-billable')}</td><td>${x.approved?badge('Approved'):badge('Pending')}</td><td class="actions timesheet-actions"><div class="table-action-group">${x.approved?'':`<button class="ghost-btn approve-timesheet" data-write-action data-id="${esc(x.id)}">Duyệt</button>`}<button class="ghost-btn edit-row" data-write-action data-type="timesheets" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="timesheets" data-id="${esc(x.id)}">Xóa</button></div></td></tr>`).join('')}</tbody></table></div>`; }
  function departmentStructure(active){
    const palette=['#0b73f6','#14b8a6','#f59e0b','#8b5cf6','#22a447','#ef4444','#64748b','#06b6d4','#ec4899'];
    const groups=[...new Set((active||[]).map(person=>String(person.department||'Chưa phân phòng').trim()||'Chưa phân phòng'))].map((department)=>{
      const people=(active||[]).filter(person=>(String(person.department||'Chưa phân phòng').trim()||'Chưa phân phòng')===department);
      const fixed=people.filter(person=>person.type==='Fixed').length,ctv=people.filter(person=>person.type==='CTV').length;
      const lead=people.find(person=>/giám đốc|trưởng|chủ trì|manager|lead/i.test(String(person.role||'')))||people[0];
      return {department,total:people.length,fixed,ctv,lead:lead?.name||'Chưa phân công'};
    }).sort((a,b)=>b.total-a.total||a.department.localeCompare(b.department,'vi')).map((group,index)=>({...group,color:palette[index%palette.length]}));
    const total=groups.reduce((sum,group)=>sum+group.total,0);
    let cursor=0;
    const slices=groups.map((group,index)=>{
      const start=cursor,end=index===groups.length-1?100:start+(total?group.total/total*100:0);cursor=end;
      const gap=groups.length>1?Math.min(.65,Math.max(.18,(end-start)*.06)):0,colorEnd=Math.max(start,end-gap);
      return gap?`${group.color} ${start.toFixed(2)}% ${colorEnd.toFixed(2)}%, var(--surface) ${colorEnd.toFixed(2)}% ${end.toFixed(2)}%`:`${group.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }).join(',');
    const ring=total&&slices?`conic-gradient(from -90deg,${slices})`:'#dceeff';
    const summary=total?`Cơ cấu ${groups.length} phòng / bộ môn, tổng ${total} nhân sự`:'Chưa có dữ liệu cơ cấu phòng ban';
    const breakdown=total?groups.map(group=>`${group.department}: ${group.total} người (${(group.total/total*100).toFixed(1)}%)`).join('; '):summary;
    return `<div class="department-structure"><div class="department-structure-summary" role="img" aria-label="${esc(summary)}" title="${esc(breakdown)}" style="--department-ring:${ring}"><strong>${groups.length}</strong><span>phòng / bộ môn</span></div><div class="department-structure-list">${groups.map(group=>`<article class="department-structure-row"><i style="background:${group.color}"></i><div><strong>${esc(group.department)}</strong><small>Phụ trách: ${esc(group.lead)}</small></div><span>${group.total} người</span><small>${group.fixed} chính thức • ${group.ctv} CTV</small></article>`).join('')}</div></div>`;
  }
  function renderPeople(){
    const a=aData(),active=filterRowsForView(db.people.filter(x=>x.status==='Active'),'people'),fixed=active.filter(x=>x.type==='Fixed'),ctv=active.filter(x=>x.type==='CTV'),utilRows=Calc.peopleUtilization(db,currentRange());
    const hours=utilRows.reduce((s,x)=>s+x.hours,0),billable=utilRows.reduce((s,x)=>s+x.billable,0),util=hours?billable/hours*100:0;
    const periodTasks=db.tasks.filter((t)=>inDateRange(t.dueDate||t.startDate)),taskBase=periodTasks.length?periodTasks:db.tasks,completion=taskBase.length?taskBase.filter((t)=>t.status==='Done').length/taskBase.length*100:0;
    const depts=Calc.headcountByDepartment(db),typeItems=[{name:'Chính thức',value:fixed.length,color:'#0b73f6'},{name:'CTV / Freelancer',value:ctv.length,color:'#f59e0b'}].filter(x=>x.value>0);
    return `<div class="grid kpi-grid">${kpi('Tổng nhân sự',fmtNum(active.length,0),'Theo danh mục hiện tại',true,{icon:'♙',color:'blue'})}${kpi('Nhân sự chính thức',fmtNum(fixed.length,0),'Hợp đồng lao động',true,{icon:'▥',color:'teal'})}${kpi('CTV / Freelancer',fmtNum(ctv.length,0),'Nguồn lực linh hoạt',true,{icon:'◎',color:'purple'})}${kpi('Utilization',`${fmtNum(util,1)}%`,'Billable / giờ đã duyệt',util>=Number(db.settings.targetUtilization||70),{icon:'◔',color:'orange'})}${kpi('Hoàn thành công việc',`${fmtNum(completion,1)}%`,'Theo hạn trong kỳ',completion>=80,{icon:'✓',color:'green'})}</div>
    <div class="grid two-col section people-structure-grid people-structure-final"><div class="card chart-card compact department-structure-card"><div class="section-header"><div><h2>Cơ cấu phòng ban</h2><p>Chi tiết số người, chính thức/CTV, tỷ trọng và người phụ trách từng phòng/bộ môn.</p></div></div>${departmentStructure(active)}</div><div class="card card-pad"><div class="section-header"><div><h2>Năng lực sử dụng / phân bổ nguồn lực</h2><p>Giờ đã duyệt / công suất kỳ</p></div></div>${heatmap(utilRows)}</div></div>
    <div class="card chart-card compact section people-completion-card"><div class="section-header"><div><h2>Tỷ lệ hoàn thành công việc theo tháng đến hạn</h2><p>Mỗi cột = số công việc Done / tổng công việc có hạn trong tháng; tháng không có công việc hiển thị 0%.</p></div></div>${comboChart(a.months,[{name:'Tỷ lệ hoàn thành (%)',values:a.completion,color:'#0b73f6'}],[],{percent:true,className:'people-completion-chart'})}<div class="completion-month-summary">${a.keys.map((key,i)=>{const monthTasks=db.tasks.filter(t=>String(t.dueDate||'').startsWith(key));const done=monthTasks.filter(t=>t.status==='Done').length;return `<span><strong>${esc(a.months[i])}</strong>${done}/${monthTasks.length}</span>`}).join('')}</div></div>
    <div class="card table-card section people-directory-card"><div class="section-header card-pad people-directory-header" style="margin-bottom:0"><div><h2>Danh sách nhân sự</h2><p>Mã nhân sự, vai trò, bộ môn, chi phí kế hoạch và trạng thái làm việc.</p></div></div><div class="table-tools"><input class="search-input" data-table-search="people" aria-label="Tìm kiếm nhân sự" placeholder="Tìm mã, tên, vai trò, bộ môn..."><select class="filter-select" data-people-type aria-label="Lọc nhân sự theo loại hợp đồng"><option value="">Tất cả loại</option><option>Fixed</option><option>CTV</option></select></div><div id="peopleTable">${peopleTable(active)}</div></div>`;
  }
  function peopleTable(rows){ return `<div class="table-wrap"><table class="table-fit-wide table-people-directory"><thead><tr><th>Mã / Họ tên</th><th>Vai trò</th><th>Bộ môn</th><th>Loại</th><th class="numeric">Lương tháng</th><th class="numeric">Cost / giờ</th><th class="numeric">Billing rate</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.code)}</strong><div class="muted">${esc(p.name)}</div></td><td>${esc(p.role)}</td><td>${esc(p.department)}</td><td>${badge(p.type)}</td><td class="numeric">${fmtMoney(p.monthlySalary)}</td><td class="numeric">${fmtMoney(costPerHour(p))}</td><td class="numeric">${fmtMoney(p.billingRate)}</td><td>${badge(p.status)}</td><td class="actions"><button class="ghost-btn edit-row" data-write-action data-type="people" data-id="${esc(p.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="people" data-id="${esc(p.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`; }
  function payrollMonthOptions(selected){
    const base=new Date(),keys=[];
    for(let offset=-18;offset<=12;offset++){
      const date=new Date(base.getFullYear(),base.getMonth()+offset,1);
      keys.push(monthKey(date));
    }
    if(selected&&!keys.includes(selected))keys.push(selected);
    return [...new Set(keys)].sort().reverse().map(key=>{const [year,month]=key.split('-');return `<option value="${key}" ${key===selected?'selected':''}>Tháng ${Number(month)}/${year}</option>`;}).join('');
  }
  function payrollPeriodState(period){
    const status=period?.status||'Chưa tạo';
    const className=Calc.statusIs(status,'Approved','Locked','Posted')?'success':Calc.statusIs(status,'Reviewed')?'warning':Calc.statusIs(status,'Draft')?'info':'neutral';
    return `<span class="badge ${className}">${esc(status)}</span>`;
  }
  function workflowGateAttrs(ready,reason=''){
    const message=ready?'Sẵn sàng thực hiện':String(reason||'Cần hoàn thành bước trước.');
    return `type="button" aria-disabled="${ready?'false':'true'}" data-workflow-ready="${ready?'true':'false'}" title="${esc(message)}"`;
  }
  function payrollWorkflowHint(period){
    const status=period?.status||'Chưa tạo';
    if(status==='Chưa tạo')return 'Bước tiếp theo: Tạo bảng lương.';
    if(Calc.statusIs(status,'Draft'))return 'Bước tiếp theo: kiểm tra các lưu ý, sau đó Soát xét.';
    if(Calc.statusIs(status,'Reviewed'))return 'Bước tiếp theo: Phê duyệt bởi người có thẩm quyền.';
    if(Calc.statusIs(status,'Approved'))return 'Bước tiếp theo: Khóa kỳ sau khi hoàn tất đối chiếu.';
    if(Calc.statusIs(status,'Locked'))return 'Kỳ lương đã khóa; chỉ được xuất và đối chiếu.';
    return `Trạng thái hiện tại: ${status}.`;
  }
  function annualBenefitWorkflowHint(plan){
    const status=plan?.status||'Chưa tạo';
    if(status==='Chưa tạo')return 'Bước tiếp theo: Tạo ngân sách năm.';
    if(Calc.statusIs(status,'Draft'))return 'Bước tiếp theo: kiểm tra tham số và Soát xét.';
    if(Calc.statusIs(status,'Reviewed'))return 'Bước tiếp theo: Phê duyệt ngân sách.';
    if(Calc.statusIs(status,'Approved'))return 'Bước tiếp theo: Khóa năm sau khi hoàn tất đối chiếu.';
    if(Calc.statusIs(status,'Locked'))return 'Ngân sách năm đã khóa; chỉ được xuất và đối chiếu.';
    return `Trạng thái hiện tại: ${status}.`;
  }
  function payrollDetailTable(rows,period){
    const locked=Payroll.isLockedStatus(period?.status);
    return `<div class="table-wrap payroll-detail-wrap" role="region" aria-label="Bảng lương chi tiết có thể cuộn ngang" tabindex="0"><table class="payroll-detail-table"><colgroup>${Array.from({length:25},(_,index)=>`<col class="payroll-width-${index+1}">`).join('')}</colgroup><thead><tr><th class="payroll-sticky-col payroll-col-person"><span class="payroll-header-label">Mã / Họ tên</span></th><th class="payroll-sticky-col payroll-col-dept"><span class="payroll-header-label">Bộ môn</span></th><th><span class="payroll-header-label">Loại</span></th><th class="numeric"><span class="payroll-header-label">Ngày công chuẩn</span></th><th class="numeric"><span class="payroll-header-label">Ngày hưởng lương</span></th><th class="numeric"><span class="payroll-header-label">Giờ duyệt</span></th><th class="numeric"><span class="payroll-header-label">Giờ billable</span></th><th class="numeric"><span class="payroll-header-label">Lương / tiền công</span></th><th class="numeric"><span class="payroll-header-label">Phụ cấp</span></th><th class="numeric"><span class="payroll-header-label">Làm thêm</span></th><th class="numeric"><span class="payroll-header-label">Thưởng</span></th><th class="numeric"><span class="payroll-header-label">Thu nhập khác</span></th><th class="numeric"><span class="payroll-header-label">Tổng thu nhập</span></th><th class="numeric"><span class="payroll-header-label">BH người lao động</span></th><th class="numeric"><span class="payroll-header-label">Thuế TNCN</span></th><th class="numeric"><span class="payroll-header-label">Tạm ứng</span></th><th class="numeric"><span class="payroll-header-label">Khấu trừ khác</span></th><th class="numeric"><span class="payroll-header-label">Thực nhận</span></th><th class="numeric"><span class="payroll-header-label">BH doanh nghiệp</span></th><th class="numeric"><span class="payroll-header-label">Tổng chi phí DN</span></th><th class="numeric"><span class="payroll-header-label">Phân bổ dự án</span></th><th class="numeric"><span class="payroll-header-label">Doanh thu thu hồi</span></th><th class="numeric"><span class="payroll-header-label">Utilization</span></th><th class="numeric"><span class="payroll-header-label">Cost Recovery</span></th><th><span class="payroll-header-label">Thao tác</span></th></tr></thead><tbody>${rows.map(row=>{
      const item=Payroll.findItem(db,period?.id,row.personId),issueCount=row.errors.length+row.warnings.length;
      return `<tr data-payroll-person="${esc(row.personId)}"><td class="payroll-sticky-col payroll-col-person"><strong>${esc(row.employeeCode)}</strong><div class="muted">${esc(row.employeeName)}</div></td><td class="payroll-sticky-col payroll-col-dept">${esc(row.department||'—')}</td><td>${badge(row.type)}</td><td class="numeric">${fmtNum(row.standardWorkdays,2)}</td><td class="numeric">${fmtNum(row.payableWorkdays,2)}</td><td class="numeric">${fmtNum(row.approvedHours,2)}</td><td class="numeric">${fmtNum(row.billableHours,2)}</td><td class="numeric strong">${fmtMoney(row.baseSalary)}</td><td class="numeric">${fmtMoney(row.allowances)}${row.allowanceMode==='Manual'?'<div class="cell-auto-source">Thủ công</div>':''}</td><td class="numeric">${fmtMoney(row.overtimePay)}<div class="cell-auto-source">${row.overtimeMode==='Manual'?'Thủ công':`${fmtNum(row.overtimeHours,1)} giờ OT`}</div></td><td class="numeric">${fmtMoney(row.bonus)}</td><td class="numeric">${fmtMoney(row.otherIncome)}</td><td class="numeric strong">${fmtMoney(row.grossIncome)}</td><td class="numeric">${fmtMoney(row.employeeInsurance)}${row.insuranceMode==='Manual'?'<div class="cell-auto-source">Thủ công</div>':''}</td><td class="numeric">${fmtMoney(row.personalIncomeTax)}${row.pitRequiresManualReview?'<div class="cell-warning">Cần rà soát</div>':row.pitMode.startsWith('Auto')?'':'<div class="cell-auto-source">Thủ công</div>'}</td><td class="numeric">${fmtMoney(row.advanceDeduction)}</td><td class="numeric">${fmtMoney(row.otherDeductions)}</td><td class="numeric strong ${row.netPay<0?'text-danger':''}">${fmtMoney(row.netPay)}</td><td class="numeric">${fmtMoney(row.employerInsurance)}</td><td class="numeric strong">${fmtMoney(row.totalEmployerCost)}</td><td class="numeric">${fmtMoney(row.projectAllocatedCost)}</td><td class="numeric">${fmtMoney(row.recoverableRevenue)}</td><td class="numeric">${fmtNum(row.utilization,1)}%</td><td class="numeric">${fmtNum(row.recoveryRatio,1)}%</td><td class="actions payroll-actions-cell"><div class="table-action-group payroll-control-cell">${issueCount?`<span class="badge warning" title="${esc([...row.errors,...row.warnings].join(' • '))}">${issueCount} lưu ý</span>`:'<span class="badge success">Hợp lệ</span>'}${item?`<button class="ghost-btn edit-payroll-item" data-write-action data-id="${esc(item.id)}" ${locked?'disabled':''}>Chi tiết</button>`:'<span class="muted">Tạo kỳ để nhập</span>'}</div></td></tr>`;
    }).join('')||'<tr><td colspan="25" class="empty-state">Chưa có nhân sự trong kỳ bảng lương.</td></tr>'}</tbody></table></div>`;
  }
  function benefitYearOptions(selected){
    const current=new Date().getFullYear(),years=[];
    for(let year=current-3;year<=current+3;year++)years.push(year);
    if(selected&&!years.includes(Number(selected)))years.push(Number(selected));
    return [...new Set(years)].sort((a,b)=>b-a).map(year=>`<option value="${year}" ${Number(selected)===year?'selected':''}>Năm ${year}</option>`).join('');
  }
  function annualBenefitState(plan){
    const status=plan?.status||'Chưa tạo';
    const className=Calc.statusIs(status,'Approved','Locked')?'success':Calc.statusIs(status,'Reviewed')?'warning':Calc.statusIs(status,'Draft')?'info':'neutral';
    return `<span class="badge ${className}">${esc(status)}</span>`;
  }
  function annualBonusBudgetTable(result){
    const rows=result.bonus.rows||[];
    return `<div class="table-wrap annual-benefit-table-wrap"><table class="annual-benefit-table"><colgroup><col class="annual-benefit-width-1"><col class="annual-benefit-width-2"><col class="annual-benefit-width-3"><col class="annual-benefit-width-4"><col class="annual-benefit-width-5"><col class="annual-benefit-width-6"><col class="annual-benefit-width-7"><col class="annual-benefit-width-8"><col class="annual-benefit-width-9"><col class="annual-benefit-width-10"></colgroup><thead><tr><th>Mã / Họ tên</th><th>Bộ môn</th><th class="numeric">Lương bình quân</th><th class="numeric">Ngày đủ điều kiện</th><th class="numeric">Tỷ lệ thời gian</th><th class="numeric">Hệ số cá nhân</th><th class="numeric">Hệ số công ty</th><th class="numeric">Thưởng dự kiến</th><th class="numeric">Ngân sách tiền mặt</th><th>Thao tác</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr><td><strong>${esc(row.employeeCode)}</strong><div class="muted">${esc(row.employeeName)}</div></td><td>${esc(row.department||'—')}</td><td class="numeric">${fmtMoney(row.averageSalary)}</td><td class="numeric">${fmtNum(row.serviceDays,0)}</td><td class="numeric">${fmtNum(row.serviceRatio*100,1)}%</td><td class="numeric">${fmtNum(row.employeeFactor,2)}</td><td class="numeric">${fmtNum(row.companyFactor,2)}</td><td class="numeric strong">${fmtMoney(row.grossBonus)}</td><td class="numeric strong">${fmtMoney(row.cashBudget)}</td><td class="actions"><button class="ghost-btn edit-benefit-factor" data-write-action data-person-id="${esc(row.personId)}">Sửa hệ số</button></td></tr>`).join(''):`<tr><td colspan="10" class="accounting-empty">Chưa có nhân sự đủ điều kiện thưởng trong năm.</td></tr>`}</tbody><tfoot><tr><td colspan="7"><strong>Tổng quỹ thưởng</strong></td><td class="numeric strong">${fmtMoney(result.bonus.grossPool)}</td><td class="numeric strong">${fmtMoney(result.bonus.total)}</td><td></td></tr></tfoot></table></div>`;
  }
  function renderAnnualBenefitBudget(){
    if(!Number.isInteger(Number(currentBenefitYear)))currentBenefitYear=new Date().getFullYear();
    const plan=AnnualBenefits.findPlan(db,currentBenefitYear),result=AnnualBenefits.calculateAnnualBudget(db,currentBenefitYear,plan),locked=AnnualBenefits.isLockedStatus(plan?.status),status=plan?.status||'Chưa tạo';
    const travel=result.travel;
    return `<section class="annual-benefit-section section"><div class="card annual-benefit-hero"><div><span class="eyebrow">ANNUAL REWARD & WELFARE BUDGET</span><h2>Ngân sách thưởng tháng lương 13 và quỹ du lịch</h2><p>Tính theo dữ liệu nhân sự, bảng lương, thời gian làm việc, hệ số kết quả và hạn mức phúc lợi quản trị. Kết quả là ngân sách nội bộ; kế toán phải rà soát quy chế, thuế và chứng từ trước khi chi.</p></div><div class="hero-metric"><span>Tổng ngân sách năm ${result.year}</span><strong>${compactMoney(result.total)}</strong></div></div>
    <div class="grid kpi-grid annual-benefit-kpis">${kpi('Quỹ tháng lương 13',compactMoney(result.bonus.total),`Trích ${compactMoney(result.bonus.monthlyAccrual)}/tháng`,true,{icon:'★',color:'blue',unit:'VND'})}${kpi('Quỹ du lịch',compactMoney(travel.total),`${travel.expectedParticipants}/${travel.eligibleCount} người dự kiến`,true,{icon:'◇',color:'teal',unit:'VND'})}${kpi('Hạn mức phúc lợi ước tính',compactMoney(travel.welfareCeiling),'Quỹ lương thực hiện / 12',travel.potentialExcess===0,{icon:'▦',color:'purple',unit:'VND'})}${kpi('Hạn mức còn lại trước du lịch',compactMoney(travel.remainingBeforeTravel),`Đã dùng ${compactMoney(travel.otherWelfareSpent)}`,travel.remainingBeforeTravel>=travel.total,{icon:'◷',color:'orange',unit:'VND'})}${kpi('Trích lập bình quân',compactMoney(result.monthlyAccrual),'Tổng thưởng + du lịch / 12',true,{icon:'₫',color:'green',unit:'VND'})}</div>
    <div class="card table-card annual-benefit-card"><div class="section-header card-pad annual-benefit-heading"><div><h2>Kế hoạch thưởng tháng lương 13</h2><p>Lương bình quân × tỷ lệ thời gian × hệ số cá nhân × hệ số kết quả công ty.</p></div><div class="payroll-period-status">${annualBenefitState(plan)}<span>${result.warnings.length?`${result.warnings.length} lưu ý`:'Công thức hợp lệ'}</span></div></div>
    <div class="annual-benefit-toolbar"><label>Năm ngân sách<select id="annualBenefitYearSelect">${benefitYearOptions(currentBenefitYear)}</select></label><button class="secondary-btn workflow-action" id="generateAnnualBenefitBudget" data-write-action ${workflowGateAttrs(!locked,locked?'Ngân sách đã khóa, không thể tính lại.':'Tạo hoặc cập nhật tính toán ngân sách.')}>${plan?'Cập nhật tính toán':'Tạo ngân sách'}</button><button class="secondary-btn workflow-action" id="editAnnualBenefitBudget" data-write-action ${workflowGateAttrs(!locked,locked?'Ngân sách đã khóa, không thể sửa tham số.':'Mở biểu mẫu thiết lập tham số.')}>Thiết lập tham số</button><button class="secondary-btn workflow-action" id="reviewAnnualBenefitBudget" data-write-action ${workflowGateAttrs(Boolean(plan)&&Calc.statusIs(status,'Draft'),!plan?'Cần tạo ngân sách trước.':`Chỉ có thể soát xét khi trạng thái là Draft; hiện tại: ${status}.`)}>Soát xét</button><button class="primary-btn workflow-action" id="approveAnnualBenefitBudget" data-write-action ${workflowGateAttrs(Boolean(plan)&&Calc.statusIs(status,'Reviewed'),!plan?'Cần tạo và soát xét ngân sách trước.':`Chỉ có thể phê duyệt khi trạng thái là Reviewed; hiện tại: ${status}.`)}>Phê duyệt</button><button class="secondary-btn workflow-action" id="lockAnnualBenefitBudget" data-write-action ${workflowGateAttrs(Boolean(plan)&&Calc.statusIs(status,'Approved'),!plan?'Cần tạo, soát xét và phê duyệt ngân sách trước.':`Chỉ có thể khóa năm khi trạng thái là Approved; hiện tại: ${status}.`)}>Khóa năm</button><button type="button" class="toolbar-button" id="exportAnnualBenefitCsv">Xuất CSV</button></div><div class="workflow-helper" role="status">${esc(annualBenefitWorkflowHint(plan))}</div>${annualBonusBudgetTable(result)}</div>
    <div class="grid two-col annual-benefit-breakdown"><div class="card card-pad"><div class="section-header"><div><h2>Cấu thành quỹ du lịch</h2><p>Ước tính theo số người tham gia và chi phí tổ chức.</p></div></div><div class="benefit-bridge"><div><span>Nhân sự đủ điều kiện</span><strong>${fmtNum(travel.eligibleCount,0)} người</strong></div><div><span>Tỷ lệ tham gia</span><strong>${fmtNum(travel.participationRate,1)}%</strong></div><div><span>Số người dự kiến</span><strong>${fmtNum(travel.expectedParticipants,0)} người</strong></div><div><span>Chi phí bình quân/người</span><strong>${fmtMoney(travel.costPerPerson)}</strong></div><div><span>Chi phí theo đầu người</span><strong>${fmtMoney(travel.perPersonTotal)}</strong></div><div><span>Chi phí tổ chức chung</span><strong>${fmtMoney(travel.commonCost)}</strong></div><div><span>Dự phòng</span><strong>${fmtMoney(travel.contingency)}</strong></div><div><span>Tổng quỹ du lịch</span><strong>${fmtMoney(travel.total)}</strong></div></div></div>
    <div class="card card-pad"><div class="section-header"><div><h2>Kiểm soát hạn mức phúc lợi</h2><p>Hạn mức quản trị ước tính từ quỹ lương thực tế; không thay thế kết luận thuế.</p></div></div><div class="benefit-bridge"><div><span>Quỹ lương thực hiện năm</span><strong>${fmtMoney(travel.payrollFund)}</strong></div><div><span>Một tháng lương bình quân</span><strong>${fmtMoney(travel.welfareCeiling)}</strong></div><div><span>Phúc lợi khác đã dùng</span><strong>${fmtMoney(travel.otherWelfareSpent)}</strong></div><div><span>Còn lại trước du lịch</span><strong>${fmtMoney(travel.remainingBeforeTravel)}</strong></div><div><span>Du lịch trong hạn mức ước tính</span><strong>${fmtMoney(travel.deductibleEstimate)}</strong></div><div class="${travel.potentialExcess>0?'benefit-limit-warning':''}"><span>Phần có khả năng vượt hạn mức</span><strong>${fmtMoney(travel.potentialExcess)}</strong></div></div></div></div>
    ${result.warnings.length?`<div class="note warning-note">${result.warnings.map(message=>`<div><strong>Lưu ý:</strong> ${esc(message)}</div>`).join('')}</div>`:''}</section>`;
  }
  function renderPayroll(){
    const r=currentRange(),a=aData(),fixed=a.payrollFixed.reduce((sum,x)=>sum+x,0)*1e6,ctv=a.payrollCtv.reduce((sum,x)=>sum+x,0)*1e6,total=fixed+ctv,recovered=a.recovered.reduce((sum,x)=>sum+x,0)*1e6,ratio=total?recovered/total*100:0;
    const billableHoursTotal=a.billable.reduce((sum,x)=>sum+Number(x||0),0),nonBillableHoursTotal=a.nonBillable.reduce((sum,x)=>sum+Number(x||0),0),approvedHoursTotal=billableHoursTotal+nonBillableHoursTotal,utilizationRate=approvedHoursTotal?billableHoursTotal/approvedHoursTotal*100:0;
    const dept=Calc.payrollByDepartment(db,r),months=elapsedMonthCount(r),active=Math.max(db.people.filter(x=>x.status==='Active').length,1);
    if(!/^\d{4}-\d{2}$/.test(currentPayrollMonth))currentPayrollMonth=monthKey(new Date());
    let period=Payroll.findPeriod(db,currentPayrollMonth);if(!period&&(ENVIRONMENT==='demo'||window.AlphaProductionGuard?.canWrite?.())){Payroll.ensurePeriod(db,currentPayrollMonth,uid);saveDB();period=Payroll.findPeriod(db,currentPayrollMonth);}const allRows=Payroll.calculatePeriod(db,currentPayrollMonth),totals=Payroll.summary(allRows);
    const saved=readTableFilterState(tableFilterKey('payroll','payrollDetailTable')),search=String(saved.search||'').toLowerCase(),typeFilter=String(saved.selects?.[0]||'');
    const payrollRows=allRows.filter(row=>(!search||`${row.employeeCode} ${row.employeeName} ${row.department} ${row.role}`.toLowerCase().includes(search))&&(!typeFilter||row.type===typeFilter));
    const periodStatus=period?.status||'Chưa tạo';
    const locked=Payroll.isLockedStatus(periodStatus);
    const issues=totals.errors.length+totals.warnings.length;
    const rows=filterRowsForView(db.people.filter(person=>person.status==='Active'),'payroll').map(person=>{const timesheets=Calc.approvedTimesheets(db,{...r,personId:person.id}),cost=person.type==='CTV'?timesheets.reduce((sum,row)=>sum+Number(row.hours||0)*costPerHour(person),0):Number(person.monthlySalary||0)*(1+Number(db.settings.employerBurdenRate||0)/100)*months;const recover=timesheets.filter(row=>row.billable).reduce((sum,row)=>sum+Number(row.hours||0)*Number(person.billingRate||0),0);return {...person,cost,recover,util:0,recovery:cost?recover/cost*100:0};}).sort((x,y)=>y.cost-x.cost);
    return `<div class="grid kpi-grid">${kpi('Tổng thu nhập kỳ',compactMoney(totals.grossIncome),`Bảng lương ${currentPayrollMonth}`,true,{icon:'₫',color:'blue',unit:'VND'})}${kpi('Thực nhận',compactMoney(totals.netPay),'Sau bảo hiểm, thuế và khấu trừ',totals.netPay>=0,{icon:'✓',color:'teal',unit:'VND'})}${kpi('Tổng chi phí doanh nghiệp',compactMoney(totals.totalEmployerCost),'Thu nhập + phần doanh nghiệp',true,{icon:'▥',color:'purple',unit:'VND'})}${kpi('Phân bổ dự án',compactMoney(totals.projectAllocatedCost),'Theo giờ đã duyệt',true,{icon:'◎',color:'orange',unit:'VND'})}${kpi('Cost Recovery',`${fmtNum(totals.recoveryRatio,1)}%`,'Doanh thu thu hồi / tổng chi phí',totals.recoveryRatio>=100,{icon:'%',color:'green'})}</div>
    <div class="card table-card section payroll-detail-card"><div class="section-header card-pad payroll-detail-heading"><div><h2>Bảng lương chi tiết theo nhân viên</h2><p>Tự động liên kết hồ sơ nhân sự, ngày công theo lịch làm việc, timesheet đã duyệt, phụ cấp định kỳ, làm thêm, bảo hiểm, thuế TNCN và chi phí dự án. Khoản điều chỉnh đặc biệt vẫn được kiểm soát riêng.</p></div><div class="payroll-period-status">${payrollPeriodState(period)}<span>${issues?`${issues} lưu ý kiểm soát`:'Đã kiểm tra công thức'}</span></div></div>
    <div class="payroll-period-toolbar"><label>Kỳ lương<select id="payrollMonthSelect">${payrollMonthOptions(currentPayrollMonth)}</select></label><button class="secondary-btn workflow-action" id="generatePayrollPeriod" data-write-action ${workflowGateAttrs(!locked,locked?'Kỳ lương đã khóa, không thể tính lại.':'Tạo hoặc cập nhật bảng lương.')}>${period?'Tính lại tự động':'Tạo bảng lương tự động'}</button><button class="secondary-btn workflow-action" id="reviewPayrollPeriod" data-write-action ${workflowGateAttrs(Boolean(period)&&Calc.statusIs(periodStatus,'Draft'),!period?'Cần tạo bảng lương trước.':`Chỉ có thể soát xét khi trạng thái là Draft; hiện tại: ${periodStatus}.`)}>Soát xét</button><button class="primary-btn workflow-action" id="approvePayrollPeriod" data-write-action ${workflowGateAttrs(Boolean(period)&&Calc.statusIs(periodStatus,'Reviewed'),!period?'Cần tạo và soát xét bảng lương trước.':`Chỉ có thể phê duyệt khi trạng thái là Reviewed; hiện tại: ${periodStatus}.`)}>Phê duyệt</button><button class="secondary-btn workflow-action" id="lockPayrollPeriod" data-write-action ${workflowGateAttrs(Boolean(period)&&Calc.statusIs(periodStatus,'Approved'),!period?'Cần tạo, soát xét và phê duyệt bảng lương trước.':`Chỉ có thể khóa kỳ khi trạng thái là Approved; hiện tại: ${periodStatus}.`)}>Khóa kỳ</button><button type="button" class="toolbar-button" id="exportPayrollCsv">Xuất CSV</button></div><div class="workflow-helper" role="status">${esc(payrollWorkflowHint(period))}</div>
    <div class="table-tools payroll-filter-tools"><input class="search-input" id="payrollDetailSearch" aria-label="Tìm trong bảng lương" placeholder="Tìm mã, tên, vai trò, bộ môn..." value="${esc(saved.search||'')}"><select class="filter-select" id="payrollTypeFilter" aria-label="Lọc loại nhân sự"><option value="">Tất cả loại</option><option value="Fixed" ${typeFilter==='Fixed'?'selected':''}>Nhân viên cố định</option><option value="CTV" ${typeFilter==='CTV'?'selected':''}>CTV</option></select><span class="table-count-badge">${payrollRows.length} nhân sự</span></div><div id="payrollDetailTable">${payrollDetailTable(payrollRows,period)}</div>
    <div class="payroll-summary-strip"><span><small>Tổng thu nhập</small><strong>${fmtMoney(totals.grossIncome)}</strong></span><span><small>Tổng khấu trừ</small><strong>${fmtMoney(totals.deductions)}</strong></span><span><small>Thực nhận</small><strong>${fmtMoney(totals.netPay)}</strong></span><span><small>Chi phí doanh nghiệp</small><strong>${fmtMoney(totals.totalEmployerCost)}</strong></span><span><small>Doanh thu thu hồi</small><strong>${fmtMoney(totals.recoverableRevenue)}</strong></span></div></div>
    <div class="note"><strong>Nguyên tắc tự động:</strong> lương cố định = lương tháng × ngày hưởng lương / ngày công chuẩn; phụ cấp lấy từ hồ sơ nhân sự; làm thêm lấy từ giờ vượt chuẩn theo ngày; bảo hiểm lấy từ mức lương đóng BH và tỷ lệ cấu hình; TNCN nhân viên dùng biểu lũy tiến, CTV dùng khấu trừ tỷ lệ. Kỳ Approved/Locked không được sửa trực tiếp.</div>
    ${renderAnnualBenefitBudget()}
    <div class="grid two-col section payroll-plan-charts"><div class="card chart-card"><div class="section-header"><div><h2>Quỹ nhân sự kế hoạch và doanh thu thu hồi theo tháng</h2><p>Đơn vị tiền tự động chuyển triệu/tỷ VND</p></div></div>${comboChart(a.months,[{name:'Lương kế hoạch',values:a.payrollFixed,color:'#0b73f6'},{name:'CTV',values:a.payrollCtv,color:'#14b8a6'}],[{name:'Doanh thu thu hồi',values:a.recovered,color:'#f59e0b'}])}</div><div class="card chart-card"><div class="section-header"><div><h2>Cơ cấu quỹ nhân sự kế hoạch theo bộ môn</h2></div></div>${donutChart(dept.length?dept:[{name:'Chưa phát sinh',value:1,color:'#e5e7eb'}],'Tổng kế hoạch',compactMoney(total))}</div></div>
    <div class="payroll-detail-stack section"><div class="card chart-card compact payroll-horizontal-card chart-explained-card"><div class="section-header"><div><h2>Cơ cấu giờ làm việc đã duyệt theo tháng</h2><p>So sánh giờ tính phí cho dự án với giờ nội bộ/không tính phí. Chỉ lấy timesheet đã được phê duyệt.</p></div></div><div class="chart-summary-strip"><span><small>Giờ tính phí dự án</small><strong>${fmtNum(billableHoursTotal,1)} giờ</strong></span><span><small>Giờ nội bộ</small><strong>${fmtNum(nonBillableHoursTotal,1)} giờ</strong></span><span><small>Tỷ lệ giờ tính phí</small><strong>${fmtNum(utilizationRate,1)}%</strong></span></div>${comboChart(a.months,[{name:'Giờ tính phí dự án',values:a.billable,color:'#0b73f6'},{name:'Giờ nội bộ / không tính phí',values:a.nonBillable,color:'#14b8a6'}],[],{integer:true,axisUnit:'giờ'})}<div class="chart-explanation"><strong>Cách đọc:</strong> cột xanh là thời gian có thể phân bổ và thu hồi từ dự án; cột xanh ngọc là họp nội bộ, đào tạo, quản trị hoặc công việc chưa tính phí. Tỷ lệ giờ tính phí = giờ tính phí / tổng giờ đã duyệt.</div></div><div class="card chart-card compact payroll-horizontal-card"><div class="section-header"><div><h2>Quỹ kế hoạch và doanh thu thu hồi</h2><p>So sánh chi phí nhân sự kế hoạch với giá trị có thể thu hồi từ giờ dự án.</p></div></div>${comboChart(a.months,[{name:'Quỹ nhân sự kế hoạch',values:a.payrollFixed.map((x,i)=>x+a.payrollCtv[i]),color:'#0b73f6'}],[{name:'Doanh thu thu hồi',values:a.recovered,color:'#14b8a6'}])}</div><div class="card table-card staff-cost-card payroll-horizontal-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Nhân sự theo chi phí kế hoạch</h2></div></div><div class="table-tools" data-local-table-filter="staffCostTable"><input class="search-input" data-filter-search type="search" aria-label="Tìm nhân sự theo chi phí kế hoạch" placeholder="Tìm tên, vai trò, bộ môn..."><select class="filter-select" data-filter-text aria-label="Lọc theo bộ môn"><option value="">Tất cả bộ môn</option>${[...new Set(rows.map(row=>row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')).map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select><span class="table-count-badge" data-filter-count></span></div><div id="staffCostTable" class="table-wrap staff-cost-table"><table><thead><tr><th>Nhân sự</th><th class="numeric">Chi phí</th><th class="numeric">Tỷ lệ thu hồi</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${esc(row.name)}</strong><div class="muted">${esc(row.role)} • ${esc(row.department)}</div></td><td class="numeric">${fmtMoney(row.cost)}</td><td class="numeric">${fmtNum(row.recovery,1)}%</td></tr>`).join('')}</tbody></table></div></div></div>`;
  }

  function renderFinance(){
    const r=currentRange(),pr=previousRange(r),a=aData(),cash=Calc.cashFlow(db,r),prevCash=Calc.cashFlow(db,pr),incoming=cash.cashIn,outgoing=cash.cashOut,net=cash.net;
    const opening=Calc.accountBalance(db,'1111',r).openingDebit+Calc.accountBalance(db,'1121',r).openingDebit,ending=Calc.accountBalance(db,'1111',{to:r.to}).endingDebit+Calc.accountBalance(db,'1121',{to:r.to}).endingDebit;
    const incomingTrend=trendInfo(incoming,prevCash.cashIn),outgoingTrend=trendInfo(outgoing,prevCash.cashOut,true),netTrend=trendInfo(net,prevCash.net),items=Calc.financeBreakdown(db,r,'Income'),expenseSeries=Calc.monthlyFinanceByCategory(db,r,'Expense');
    const cashSeries=Calc.monthlyAccountBalance(db,'1111',r,'Debit'),bankSeries=Calc.monthlyAccountBalance(db,'1121',r,'Debit');
    return `<div class="grid kpi-grid">${kpi('Số dư đầu kỳ',compactMoney(opening),'Theo sổ cái',opening>=0,{icon:'▣',color:'blue',unit:'VND'})}${kpi('Tiền vào',compactMoney(incoming),incomingTrend.text?'so với kỳ liền trước':'Giao dịch Paid',true,{icon:'↙',color:'teal',trend:incomingTrend.text,trendClass:incomingTrend.className,unit:'VND'})}${kpi('Tiền ra',compactMoney(outgoing),outgoingTrend.text?'so với kỳ liền trước':'Giao dịch Paid',true,{icon:'↗',color:'orange',trend:outgoingTrend.text,trendClass:outgoingTrend.className,unit:'VND'})}${kpi('Số dư cuối kỳ',compactMoney(ending),'Theo TK 111/112',ending>=0,{icon:'◫',color:'purple',unit:'VND'})}${kpi('Dòng tiền thuần',compactMoney(net),netTrend.text?'so với kỳ liền trước':'Thu trừ chi đã thanh toán',net>=0,{icon:'↕',color:'green',trend:netTrend.text,trendClass:netTrend.className,unit:'VND'})}</div>
    <div class="grid two-col section"><div class="card chart-card"><div class="section-header"><div><h2>Tình hình dòng tiền theo tháng</h2><p>Đơn vị tiền tự động chuyển triệu/tỷ VND • nguồn giao dịch Paid</p></div></div>${comboChart(a.months,[{name:'Tiền vào',values:a.cashIn,color:'#0b73f6'},{name:'Tiền ra',values:a.cashOut,color:'#14b8a6'}],[{name:'Dòng tiền thuần',values:a.cashIn.map((x,i)=>x-a.cashOut[i]),color:'#f59e0b'}])}</div><div class="card chart-card"><div class="section-header"><div><h2>Cơ cấu tiền vào</h2><p>Theo nhóm giao dịch thực tế</p></div></div>${donutChart(items.length?items:[{name:'Chưa phát sinh',value:1,color:'#e5e7eb'}],'Tổng tiền vào',compactMoney(incoming))}</div></div>
    <div class="grid two-col section cash-balance-grid"><div class="card chart-card compact chart-explained-card"><div class="section-header"><div><h2>Tiền đã chi theo mục đích và theo tháng</h2><p>Mỗi màu là một nhóm chi; số liệu chỉ gồm giao dịch chi có trạng thái đã thanh toán.</p></div></div>${comboChart(a.months,expenseSeries.length?expenseSeries:[{name:'Chưa phát sinh',values:a.months.map(()=>0),color:'#e5e7eb'}],[],{scrollLabels:a.months.length>12})}<div class="chart-explanation"><strong>Cách đọc:</strong> chiều cao cột cho biết số tiền đã chi trong tháng; các màu giúp nhận biết tiền được dùng cho CTV, văn phòng hay chi phí trực tiếp dự án. Biểu đồ này phản ánh dòng tiền ra, không phải chi phí kế toán dồn tích.</div></div><div class="card chart-card compact chart-explained-card"><div class="section-header"><div><h2>Số dư cuối tháng theo nơi giữ tiền</h2><p>Tiền mặt lấy từ TK 1111; tiền gửi ngân hàng lấy từ TK 1121 trong sổ cái đã ghi sổ.</p></div></div><div class="chart-summary-strip"><span><small>Tiền mặt cuối kỳ</small><strong>${compactMoney((cashSeries.values.at(-1)||0)*1e6)}</strong></span><span><small>Ngân hàng cuối kỳ</small><strong>${compactMoney((bankSeries.values.at(-1)||0)*1e6)}</strong></span></div>${comboChart(a.months,[{name:'Tiền mặt cuối tháng',values:cashSeries.values,color:'#0b73f6'},{name:'Tiền gửi ngân hàng cuối tháng',values:bankSeries.values,color:'#14b8a6'}])}<div class="chart-explanation"><strong>Cách đọc:</strong> đây là số dư lũy kế tại cuối từng tháng, không phải số thu hoặc số chi riêng của tháng. Tổng hai cột là lượng tiền doanh nghiệp đang nắm giữ theo sổ cái.</div></div></div>
    <div class="card table-card section cash-transactions-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Khoản thu / chi trong kỳ</h2><p>Giao dịch quản trị</p></div></div>${financeTable(filterRowsForView(db.finance.filter(x=>inDateRange(x.date)),'finance').slice().sort((x,y)=>y.date.localeCompare(x.date)))}</div>`;
  }
  function financeTable(rows){ return `<div class="table-wrap"><table class="table-fit-wide table-finance-transactions"><thead><tr><th>Ngày</th><th>Loại</th><th>Nhóm</th><th>Dự án</th><th>Nội dung</th><th class="numeric">Số tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${badge(x.type)}</td><td>${esc(x.category)}</td><td>${esc(projectName(x.projectId))}</td><td>${esc(x.description)}</td><td class="numeric strong">${fmtMoney(x.amount)}</td><td>${badge(x.status)}</td><td class="actions"><button class="ghost-btn edit-row" data-write-action data-type="finance" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="finance" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`; }
  function renderCRM(){
    const r=currentRange(),pr=previousRange(r),a=aData(),pnl=Calc.profitAndLoss(db,r),prevPnl=Calc.profitAndLoss(db,pr),total=pnl.revenue,collected=totalCollected(),prevCollected=Calc.cashFlow(db,pr).cashIn;
    const invoice=(db.taxInvoices||[]).filter(x=>Calc.activeInvoice(x)&&Calc.statusIs(x.direction,'Output')&&Calc.inRange(x.date,r.from,r.to)).reduce((s,x)=>s+Calc.vnd(x.taxBase),0),prevInvoice=(db.taxInvoices||[]).filter(x=>Calc.activeInvoice(x)&&Calc.statusIs(x.direction,'Output')&&Calc.inRange(x.date,pr.from,pr.to)).reduce((s,x)=>s+Calc.vnd(x.taxBase),0);
    const lifetimeRevenue=Calc.postedLines(db,{to:r.to}).filter(x=>accountByCode(x.accountCode)?.type==='Revenue').reduce((m,x)=>{m[x.projectId]=(m[x.projectId]||0)+Calc.vnd(x.credit)-Calc.vnd(x.debit);return m;},{}),backlog=db.projects.reduce((s,p)=>s+Math.max(0,Calc.vnd(p.contractValue)-Calc.vnd(lifetimeRevenue[p.id])),0),dso=Calc.dso(db,r);
    const revTrend=trendInfo(total,prevPnl.revenue),invTrend=trendInfo(invoice,prevInvoice),cashTrend=trendInfo(collected,prevCollected),dsoPrev=Calc.dso(db,pr),dsoTrend=trendInfo(dso,dsoPrev,true),customers=Calc.revenueByClient(db,r),stages=Calc.revenueByStage(db,r);
    return `<div class="grid kpi-grid">${kpi('Tổng doanh thu',compactMoney(total),revTrend.text?'so với kỳ liền trước':'Theo chứng từ Posted',true,{icon:'▥',color:'blue',trend:revTrend.text,trendClass:revTrend.className,unit:'VND'})}${kpi('Đã xuất hóa đơn',compactMoney(invoice),invTrend.text?'so với kỳ liền trước':'Giá trị chưa VAT',true,{icon:'▤',color:'teal',trend:invTrend.text,trendClass:invTrend.className,unit:'VND'})}${kpi('Đã thu tiền',compactMoney(collected),cashTrend.text?'so với kỳ liền trước':'Giao dịch Income/Paid',true,{icon:'↙',color:'green',trend:cashTrend.text,trendClass:cashTrend.className,unit:'VND'})}${kpi('Backlog hợp đồng',compactMoney(backlog),'Hợp đồng trừ doanh thu lũy kế',true,{icon:'▣',color:'orange',unit:'VND'})}${kpi('DSO / Số ngày thu tiền',`${fmtNum(dso,1)} ngày`,dsoTrend.text?'so với kỳ liền trước':'Công nợ phải thu / doanh thu × số ngày',dso<=60,{icon:'◷',color:'purple',trend:dsoTrend.text,trendClass:dsoTrend.className})}</div>
    <div class="grid section crm-primary-stack"><div class="card chart-card"><div class="section-header"><div><h2>Doanh thu và tiền thu theo tháng</h2><p>Đơn vị tiền tự động chuyển triệu/tỷ VND</p></div></div>${comboChart(a.months,[{name:'Doanh thu',values:a.revenue,color:'#0b73f6'},{name:'Tiền thu',values:a.cashIn,color:'#14b8a6'}],[])}</div></div>
    <div class="grid section crm-mix-stage-grid"><div class="card chart-card compact"><div class="section-header"><div><h2>Cơ cấu doanh thu theo bộ môn</h2></div></div>${donutChart(a.departments,'Tổng doanh thu',compactMoney(total))}</div><div class="card chart-card compact"><div class="section-header"><div><h2>Doanh thu theo giai đoạn</h2></div></div>${comboChart(stages.map(x=>x.name),[{name:'Doanh thu',values:stages.map(x=>x.value/1e6),color:'#14b8a6'}],[])}</div></div>
    <div class="grid section crm-customer-revenue-grid"><div class="card chart-card compact crm-customer-revenue-card"><div class="section-header"><div><h2>Doanh thu theo khách hàng</h2><p>Tên khách hàng hiển thị đầy đủ; kéo ngang trong biểu đồ khi có nhiều khách hàng.</p></div></div>${comboChart(customers.map(x=>x.name),[{name:'Doanh thu',values:customers.map(x=>x.value/1e6),color:'#0b73f6'}],[],{className:'customer-label-chart',scrollLabels:true,minPlotWidth:1180})}</div></div>
    <div class="card table-card section crm-pipeline-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Pipeline báo giá</h2><p>Cơ hội, xác suất và trạng thái theo cùng một hàng dữ liệu</p></div><button class="section-link" data-secondary-add="clients">+ Khách hàng</button></div>${quotesTable(filterRowsForView(db.quotes,'crm'))}</div>`;
  }
  function quotesTable(rows){ return `<div class="table-wrap"><table class="table-fit-wide table-pipeline"><thead><tr><th>Ngày</th><th>Cơ hội</th><th>Khách hàng</th><th class="numeric">Giá trị</th><th class="numeric">Xác suất</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmtDate(x.date)}</td><td><strong>${esc(x.projectName)}</strong></td><td>${esc(clientName(x.clientId))}</td><td class="numeric">${fmtMoney(x.amount)}</td><td class="numeric">${fmtNum(x.probability,0)}%</td><td>${badge(x.status)}</td><td class="actions"><button class="ghost-btn edit-row" data-write-action data-type="quotes" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="quotes" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`; }
  function clientsTable(rows){ return `<div class="table-wrap"><table style="min-width:560px"><thead><tr><th>Mã / Khách hàng</th><th>Liên hệ</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.code)}</strong><div class="muted">${esc(x.name)}</div></td><td>${esc(x.contact)}<div class="muted">${esc(x.phone)}</div></td><td>${badge(x.status)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="clients" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="clients" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`; }
  function renderApprovals(){
    return `<div class="grid kpi-grid">${kpi('Chờ phê duyệt',fmtNum(db.approvals.filter(x=>x.status==='Pending').length,0),'Cần xử lý')}${kpi('Giá trị chờ duyệt',fmtMoney(db.approvals.filter(x=>x.status==='Pending').reduce((s,x)=>s+Number(x.amount||0),0)),'Tổng các yêu cầu')}${kpi('Đã duyệt',fmtNum(db.approvals.filter(x=>x.status==='Approved').length,0),'Lịch sử phê duyệt')}${kpi('Bị từ chối',fmtNum(db.approvals.filter(x=>x.status==='Rejected').length,0),'Cần điều chỉnh hồ sơ',db.approvals.filter(x=>x.status==='Rejected').length===0)}</div>
      <div class="card table-card section">${approvalsTable(filterRowsForView(db.approvals,'approvals'))}</div>`;
  }
  function approvalsTable(rows){ return `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Loại yêu cầu</th><th>Nội dung</th><th>Người đề nghị</th><th>Dự án</th><th class="numeric">Giá trị</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.map(x=>`<tr data-record-id="${esc(x.id)}"><td>${fmtDate(x.date)}</td><td>${esc(x.type)}</td><td><strong>${esc(x.title)}</strong></td><td>${esc(personName(x.requesterId))}</td><td>${esc(projectName(x.projectId))}</td><td class="numeric">${fmtMoney(x.amount)}</td><td>${badge(x.status)}</td><td>${x.status==='Pending'?`<button class="ghost-btn approval-action" data-write-action data-id="${esc(x.id)}" data-status="Approved">Duyệt</button><button class="ghost-btn approval-action" data-write-action data-id="${esc(x.id)}" data-status="Rejected">Từ chối</button>`:''}<button class="ghost-btn edit-row" data-write-action data-type="approvals" data-id="${esc(x.id)}">Sửa</button></td></tr>`).join('')}</tbody></table></div>`; }
  function renderDocuments(){
    const rows=filteredDocuments();
    const documentFilters=activeFilters.view==='documents'?activeFilters:{status:'',project:''};
    const filterSummary=[documentFilters.status&&`Trạng thái: ${documentFilters.status}`,documentFilters.project&&`Dự án: ${projectName(documentFilters.project)}`].filter(Boolean).join(' • ');
    const documentStatuses=[...new Set(db.documents.map(x=>String(x.status||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    return `${filterSummary?`<div class="active-filter-note section"><strong>Đang lọc hồ sơ:</strong> ${esc(filterSummary)}</div>`:''}<div class="card table-card section"><div class="table-tools" data-local-table-filter="documentsTable"><input class="search-input" data-filter-search type="search" aria-label="Tìm kiếm hồ sơ" placeholder="Tìm hợp đồng, biên bản, báo giá, hồ sơ..."><select class="filter-select" data-filter-text aria-label="Lọc trạng thái hồ sơ"><option value="">Tất cả trạng thái</option>${documentStatuses.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select><span class="table-count-badge" data-filter-count></span></div><div id="documentsTable">${documentsTable(rows)}</div></div>`;
  }
  function documentsTable(rows){ return `<div class="table-wrap documents-table-wrap"><table class="documents-table"><thead><tr><th>Ngày</th><th>Tài liệu</th><th>Loại</th><th>Dự án</th><th>Phiên bản</th><th>Người phụ trách</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmtDate(x.date)}</td><td><strong>${esc(x.title)}</strong></td><td>${esc(x.type)}</td><td>${esc(projectName(x.projectId))}</td><td>${esc(x.version)}</td><td>${esc(personName(x.ownerId))}</td><td>${badge(x.status)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="documents" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="documents" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`; }

  function accountingTabs(){
    const regime=accountingRegimeCode();
    const tabs=[['overview','Tổng quan'],['vouchers','Chứng từ'],['accounts','Hệ tài khoản'],['partners','Công nợ'],['tax','Thuế'],['reports','Báo cáo quản trị'],['statutory',`BCTC ${regime}`],['control','Kiểm soát']];
    return `<div class="accounting-tabs">${tabs.map(([id,label])=>`<button class="accounting-tab ${currentAccountingTab===id?'active':''}" data-accounting-tab="${id}">${label}</button>`).join('')}</div>`;
  }
  function accountingShell(body){
    const profile=accountingRegimeProfile(),regime=db.settings?.accountingRegime||'Chưa cấu hình';
    return `<div class="note accounting-note"><strong>Chế độ kế toán đang vận hành:</strong> ${esc(regime)} • hiệu lực ${fmtDate(db.settings?.accountingRegimeEffectiveDate||'')} • hồ sơ ${esc(profile.policyVersion)}. Khi lưu thay đổi, phân hệ Kế toán, nhãn BCTC, hồ sơ chính sách và thuộc tính hệ tài khoản được chuyển đồng bộ sang ${esc(profile.code)}; chứng từ đã ghi sổ không bị sửa hồi tố.</div>${accountingTabs()}${body}`;
  }
  function journalsTable(rows){
    if(!rows.length) return '<div class="accounting-empty">Chưa có chứng từ kế toán.</div>';
    return `<div class="table-wrap"><table class="table-fit-wide table-journals"><colgroup class="journal-colgroup"><col class="journal-col-date"><col class="journal-col-description"><col class="journal-col-partner"><col class="journal-col-project"><col class="journal-col-debit"><col class="journal-col-credit"><col class="journal-col-status"><col class="journal-col-actions"></colgroup><thead><tr><th>Ngày / Số CT</th><th>Diễn giải</th><th>Đối tượng</th><th>Dự án</th><th class="numeric">Nợ</th><th class="numeric">Có</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.map(x=>{const d=journalTotal(x,'debit'),c=journalTotal(x,'credit'),posted=Calc.statusIs(x.status,'posted');return `<tr><td>${fmtDate(x.date)}<div class="muted account-code">${esc(x.documentNo)}</div></td><td><strong>${esc(x.description)}</strong><div class="muted">${esc(x.sourceType||'')}</div></td><td>${esc(partnerName(x.partnerType,x.partnerId))}</td><td>${esc(projectName(x.projectId))}</td><td class="numeric strong">${fmtMoney(d)}</td><td class="numeric strong">${fmtMoney(c)}</td><td><div class="journal-status-stack"><span><span class="status-dot ${posted?'posted':'draft'}"></span>${badge(x.status)}</span>${entryBalanced(x)?'<small>Cân bằng</small>':'<span class="badge danger">Lệch</span>'}</div></td><td class="actions journal-action-cell">${posted?`<span class="table-lock-state journal-lock-indicator" title="Chứng từ Posted đã khóa nội dung"><span aria-hidden="true">🔒</span><span>Đã khóa</span></span><button class="ghost-btn adjust-journal" data-write-action data-id="${esc(x.id)}" title="Tạo chứng từ điều chỉnh từ chứng từ đã ghi sổ">Điều chỉnh</button><button class="ghost-btn view-journal" data-id="${esc(x.id)}">Xem</button>`:`<button class="ghost-btn journal-post" data-write-action data-id="${esc(x.id)}" data-status="Posted">Ghi sổ</button><button class="ghost-btn edit-row" data-write-action data-type="journalEntries" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="journalEntries" data-id="${esc(x.id)}">Xóa</button>`}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  function accountsTable(rows){
    return `<div class="table-wrap"><table><thead><tr><th>Số hiệu</th><th>Tên tài khoản</th><th>Nhóm</th><th>Tính chất</th><th>Chế độ</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(a=>`<tr><td class="account-code">${esc(a.code)}</td><td><strong>${esc(a.name)}</strong>${a.customDetail?'<div class="muted">Chi tiết nội bộ theo Quy chế hạch toán</div>':''}</td><td>${badge(a.type)}</td><td>${a.normalSide==='Debit'?'Dư Nợ':'Dư Có'}</td><td>${badge(a.regime||accountingRegimeCode())}</td><td>${a.active?badge(a.postable===false?'Tài khoản tổng hợp':'Active'):badge('Inactive')}</td><td><button class="ghost-btn edit-row" data-write-action data-type="accounts" data-id="${esc(a.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="accounts" data-id="${esc(a.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function trialBalanceTable(){
    const tb=Calc.trialBalance(db,currentRange()),rows=tb.rows,t=tb.totals;
    return `<div class="card table-card"><div class="report-title"><h3>Bảng cân đối số phát sinh</h3><p>Có số dư đầu kỳ, phát sinh trong kỳ và số dư cuối kỳ; chỉ lấy chứng từ Posted.</p></div><div class="table-wrap"><table class="table-fit-wide table-trial-balance"><thead><tr><th>Tài khoản</th><th>Tên tài khoản</th><th class="numeric">Đầu kỳ Nợ</th><th class="numeric">Đầu kỳ Có</th><th class="numeric">Phát sinh Nợ</th><th class="numeric">Phát sinh Có</th><th class="numeric">Cuối kỳ Nợ</th><th class="numeric">Cuối kỳ Có</th></tr></thead><tbody>${rows.map(x=>`<tr><td class="account-code">${x.code}</td><td>${esc(x.name)}</td><td class="numeric">${fmtMoney(x.openingDebit)}</td><td class="numeric">${fmtMoney(x.openingCredit)}</td><td class="numeric">${fmtMoney(x.debit)}</td><td class="numeric">${fmtMoney(x.credit)}</td><td class="numeric strong">${fmtMoney(x.endingDebit)}</td><td class="numeric strong">${fmtMoney(x.endingCredit)}</td></tr>`).join('')}<tr><td colspan="2"><strong>TỔNG CỘNG</strong></td><td class="numeric strong">${fmtMoney(t.openingDebit)}</td><td class="numeric strong">${fmtMoney(t.openingCredit)}</td><td class="numeric strong">${fmtMoney(t.debit)}</td><td class="numeric strong">${fmtMoney(t.credit)}</td><td class="numeric strong">${fmtMoney(t.endingDebit)}</td><td class="numeric strong">${fmtMoney(t.endingCredit)}</td></tr></tbody></table></div></div>`;
  }
  function renderAccountingOverview(){
    const r=currentRange(),pr=previousRange(r),pnl=Calc.profitAndLoss(db,r),prevPnl=Calc.profitAndLoss(db,pr),revenue=pnl.revenue,expense=pnl.expenseBeforeTax,ar=debitBalance('131'),ap=creditBalance('331');
    const revTrend=trendInfo(revenue,prevPnl.revenue),expTrend=trendInfo(expense,prevPnl.expenseBeforeTax,true),arPrev=Calc.accountBalance(db,'131',{to:pr.to}).endingDebit,apPrev=Calc.accountBalance(db,'331',{to:pr.to}).endingCredit,arTrend=trendInfo(ar,arPrev,true),apTrend=trendInfo(ap,apPrev,true);
    const arSeries=Calc.monthlyAccountBalance(db,'131',r,'Debit'),apSeries=Calc.monthlyAccountBalance(db,'331',r,'Credit'),groups=Calc.expenseByGroup(db,r),cash=Calc.cashFlow(db,r),openingCash=Calc.accountBalance(db,'1111',r).openingDebit+Calc.accountBalance(db,'1121',r).openingDebit,managementEnding=openingCash+cash.net,ledgerEnding=cashBookBalance(),cashDiff=ledgerEnding-managementEnding;
    return `<div class="grid kpi-grid">${kpi('Tiền mặt',compactMoney(debitBalance('1111')),'Số dư TK 1111',true,{icon:'₫',color:'green',unit:'VND'})}${kpi('Tiền gửi ngân hàng',compactMoney(debitBalance('1121')),'Số dư TK 1121',true,{icon:'▣',color:'teal',unit:'VND'})}${kpi('Phải thu khách hàng',compactMoney(ar),arTrend.text?'so với cuối kỳ trước':'Số dư TK 131',ar===0,{icon:'↙',color:'orange',trend:arTrend.text,trendClass:arTrend.className,unit:'VND'})}${kpi('Phải trả nhà cung cấp',compactMoney(ap),apTrend.text?'so với cuối kỳ trước':'Số dư TK 331',ap===0,{icon:'↗',color:'purple',trend:apTrend.text,trendClass:apTrend.className,unit:'VND'})}${kpi('Doanh thu ghi nhận',compactMoney(revenue),revTrend.text?'so với kỳ liền trước':'Tài khoản doanh thu',true,{icon:'▥',color:'blue',trend:revTrend.text,trendClass:revTrend.className,unit:'VND'})}${kpi('Chi phí ghi nhận',compactMoney(expense),expTrend.text?'so với kỳ liền trước':'Không gồm TK 821',true,{icon:'▤',color:'red',trend:expTrend.text,trendClass:expTrend.className,unit:'VND'})}</div>
    <div class="grid three-col section"><div class="card chart-card compact"><div class="section-header"><div><h2>Số dư công nợ theo tháng</h2><p>Số dư lũy kế cuối tháng</p></div></div>${comboChart(arSeries.keys.map(x=>`T${x.slice(5)}`),[{name:'Phải thu',values:arSeries.values,color:'#0b73f6'},{name:'Phải trả',values:apSeries.values,color:'#14b8a6'}],[])}</div><div class="card chart-card compact"><div class="section-header"><div><h2>Chi phí theo nhóm</h2><p>Từ tài khoản chi phí đã ghi sổ</p></div></div>${donutChart(groups.length?groups:[{name:'Chưa phát sinh',value:1,color:'#e5e7eb'}],'Tổng chi phí',compactMoney(expense))}</div><div class="card card-pad"><div class="section-header"><div><h2>Đối chiếu sổ tiền</h2><p>Sổ quản trị với sổ cái 111/112</p></div></div><div class="tax-bridge"><div><span>Số dư đầu kỳ</span><strong>${fmtMoney(openingCash)}</strong></div><div><span>Thuần theo giao dịch Paid</span><strong>${fmtMoney(cash.net)}</strong></div><div><span>Số dư theo sổ quản trị</span><strong>${fmtMoney(managementEnding)}</strong></div><div><span>Số dư theo sổ cái</span><strong>${fmtMoney(ledgerEnding)}</strong></div><div><span>Chênh lệch cần liên kết</span><strong class="${cashDiff===0?'trend-up':'trend-down'}">${fmtMoney(cashDiff)}</strong></div></div></div></div>
    <div class="accounting-overview-tables section"><div>${trialBalanceTable()}</div><div class="card table-card section content-fit-card"><div class="report-title"><h3>Bút toán kế toán gần đây</h3><p>Chỉ chứng từ đã ghi sổ</p></div><div class="table-tools" data-local-table-filter="recentJournalTable"><input class="search-input" data-filter-search type="search" aria-label="Tìm bút toán kế toán" placeholder="Tìm số chứng từ, diễn giải, đối tượng, dự án..."><select class="filter-select" data-filter-text aria-label="Lọc bút toán theo dự án"><option value="">Tất cả dự án</option>${db.projects.map(p=>`<option value="${esc(p.name)}">${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select><span class="table-count-badge" data-filter-count></span></div><div id="recentJournalTable">${journalsTable(filterRowsForView(postedEntries(),'accounting').slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,80))}</div></div></div>`;
  }
  function renderAccountingVouchers(){
    return `<div class="accounting-toolbar"><div><strong>Nhật ký chứng từ</strong><div class="muted">Mỗi chứng từ phải cân bằng tổng Nợ và tổng Có.</div></div><div class="actions"><button class="primary-btn" data-accounting-add="journalEntries">+ Chứng từ</button></div></div><div class="card table-card">${journalsTable(filteredJournalEntries().slice().sort((a,b)=>b.date.localeCompare(a.date)))}</div>`;
  }
  function renderAccountingAccounts(){
    const profile=accountingRegimeProfile();
    return `<div class="accounting-toolbar"><div><strong>Hệ thống tài khoản ${esc(profile.code)} – ALPHA DESIGN</strong><div class="muted">${esc(profile.description)} Hồ sơ chính sách: ${esc(profile.policyVersion)}.</div></div><div class="actions"><button class="secondary-btn" data-accounting-add="accounts">+ Tài khoản</button></div></div><div class="card table-card">${accountsTable(db.accounts.slice().sort((a,b)=>a.code.localeCompare(b.code)))}</div>`;
  }
  function renderAccountingPartners(){
    const ar=partnerBalanceRows('131','client'), ap=partnerBalanceRows('331','vendor');
    const balanceTable=(rows,label)=>`<div class="card table-card"><div class="report-title"><h3>${label}</h3><p>Chi tiết theo đối tượng từ chứng từ đã ghi sổ.</p></div><div class="table-wrap"><table style="min-width:560px"><thead><tr><th>Đối tượng</th><th class="numeric">Phát sinh Nợ</th><th class="numeric">Phát sinh Có</th><th class="numeric">Còn phải thu/trả</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td class="numeric">${fmtMoney(x.debit)}</td><td class="numeric">${fmtMoney(x.credit)}</td><td class="numeric strong">${fmtMoney(x.balance)}</td></tr>`).join(''):'<tr><td colspan="4" class="accounting-empty">Không có số dư.</td></tr>'}</tbody></table></div></div>`;
    return `<div class="accounting-toolbar"><div><strong>Công nợ phải thu – phải trả</strong><div class="muted">Đối chiếu theo khách hàng và nhà cung cấp.</div></div><div class="actions"><button class="secondary-btn" data-accounting-add="vendors">+ Nhà cung cấp</button></div></div><div class="grid two-col partner-balance-grid">${balanceTable(ar,'Phải thu khách hàng (TK 131)')}${balanceTable(ap,'Phải trả nhà cung cấp (TK 331)')}</div><div class="card table-card section"><div class="report-title"><h3>Danh mục nhà cung cấp / CTV</h3></div><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên đối tượng</th><th>Mã số thuế</th><th>Loại</th><th>Liên hệ</th><th></th></tr></thead><tbody>${db.vendors.map(v=>`<tr><td class="account-code">${esc(v.code)}</td><td><strong>${esc(v.name)}</strong></td><td>${esc(v.taxCode||'—')}</td><td>${badge(v.type)}</td><td>${esc(v.phone||'')}<div class="muted">${esc(v.email||'')}</div></td><td><button class="ghost-btn edit-row" data-write-action data-type="vendors" data-id="${esc(v.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="vendors" data-id="${esc(v.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function taxFilingsTable(rows){
    return `<div class="table-wrap"><table class="table-fit-wide table-tax-filings"><colgroup><col class="tax-filing-type-col"><col class="tax-filing-period-col"><col class="tax-filing-due-col"><col class="tax-filing-status-col"><col class="tax-filing-payable-col"><col class="tax-filing-payment-col"><col class="tax-filing-late-col"><col class="tax-filing-reference-col"><col class="tax-filing-actions-col"></colgroup><thead><tr><th>Loại thuế</th><th>Kỳ</th><th>Hạn</th><th>Trạng thái</th><th class="numeric">Số phải nộp</th><th>Thanh toán</th><th class="numeric">Chậm nộp ước tính</th><th>Tham chiếu</th><th>Thao tác</th></tr></thead><tbody>${rows.map(x=>{const state=filingState(x);return `<tr data-record-id="${esc(x.id)}"><td><strong>${esc(x.taxType)}</strong><div class="muted">${esc(x.frequency)}</div></td><td>${esc(x.period)}</td><td>${fmtDate(x.dueDate)}</td><td>${badge(state)}</td><td class="numeric strong">${fmtMoney(x.payableAmount)}</td><td>${badge(x.paymentStatus)}${x.paymentDate?`<div class="muted">${fmtDate(x.paymentDate)}</div>`:''}</td><td class="numeric">${latePaymentEstimate(x).amount?`<strong>${fmtMoney(latePaymentEstimate(x).amount)}</strong><div class="muted">${latePaymentEstimate(x).days} ngày</div>`:'—'}</td><td>${esc(x.referenceNo||'—')}<div class="muted">${esc(x.notes||'')}</div></td><td class="actions"><button class="ghost-btn edit-row" data-write-action data-type="taxFilings" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="taxFilings" data-id="${esc(x.id)}">Xóa</button></td></tr>`}).join('')}</tbody></table></div>`;
  }
  function taxInvoicesTable(rows){
    return `<div class="table-wrap"><table class="table-fit-wide table-tax-invoices"><colgroup><col class="tax-invoice-date-col"><col class="tax-invoice-type-col"><col class="tax-invoice-partner-col"><col class="tax-invoice-content-col"><col class="tax-invoice-base-col"><col class="tax-invoice-rate-col"><col class="tax-invoice-vat-col"><col class="tax-invoice-control-col"><col class="tax-invoice-actions-col"></colgroup><thead><tr><th>Ngày / Hóa đơn</th><th>Loại</th><th>Đối tượng</th><th>Nội dung</th><th class="numeric">Giá chưa thuế</th><th class="numeric">Thuế suất</th><th class="numeric">Tiền VAT</th><th>Kiểm soát</th><th>Thao tác</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmtDate(x.date)}<div class="account-code">${esc(x.serial||'')} / ${esc(x.invoiceNo||'—')}</div></td><td>${badge(x.direction==='Output'?'Đầu ra':'Đầu vào')}</td><td><strong>${esc(taxPartnerName(x.partnerType,x.partnerId))}</strong><div class="muted">MST: ${esc(x.taxCode||'—')}</div></td><td>${esc(x.description)}<div class="muted">${esc(projectName(x.projectId))}</div></td><td class="numeric">${fmtMoney(x.taxBase)}</td><td class="numeric">${fmtNum(x.vatRate,1)}%</td><td class="numeric strong tax-vat-cell">${fmtMoney(x.vatAmount)}</td><td class="tax-control-cell"><div class="tax-control-stack"><span class="tax-deduction-state">${x.direction==='Input'?badge(x.deductible?'Được khấu trừ':'Chưa khấu trừ'):'<span class="badge neutral">Không áp dụng</span>'}</span><span class="tax-link-state">${x.journalEntryId?badge('Linked'):badge('Unlinked')}<small>${esc(x.status)}</small></span></div></td><td class="actions tax-actions-cell"><button class="ghost-btn edit-row" data-write-action data-type="taxInvoices" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="taxInvoices" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function pitWithholdingsTable(rows){
    return `<div class="table-wrap"><table class="table-fit-wide table-pit-withholdings"><thead><tr><th>Ngày / Người nhận</th><th>Mã số thuế</th><th>Phương pháp</th><th class="numeric">Thu nhập gộp</th><th class="numeric">Thuế TNCN</th><th class="numeric">Thực nhận</th><th>Kỳ / Chứng từ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${fmtDate(x.date)}<div><strong>${esc(taxPartnerName(x.recipientType,x.recipientId))}</strong></div><div class="muted">${esc(x.contractType||'')}</div></td><td>${esc(x.taxCode||'—')}</td><td>${esc(x.withholdingMethod||'—')}<div class="muted">${fmtNum(x.rate||0,1)}%</div></td><td class="numeric">${fmtMoney(x.grossIncome)}</td><td class="numeric strong">${fmtMoney(x.taxWithheld)}</td><td class="numeric">${fmtMoney(x.netPaid)}</td><td>${esc(x.period||'—')}<div class="muted">${esc(x.certificateNo||'Chưa có chứng từ')}</div></td><td>${badge(x.status)}${x.journalEntryId?'<div class="muted">Đã liên kết sổ</div>':'<div class="muted">Chưa liên kết sổ</div>'}</td><td class="actions"><button class="ghost-btn edit-row" data-write-action data-type="pitWithholdings" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="pitWithholdings" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join(''):'<tr><td colspan="9" class="accounting-empty">Chưa có khoản khấu trừ TNCN.</td></tr>'}</tbody></table></div>`;
  }
  function citAdjustmentsTable(rows){
    return `<div class="table-wrap"><table class="table-fit-wide table-cit-adjustments"><thead><tr><th>Ngày / Năm</th><th>Loại điều chỉnh</th><th>Nhóm</th><th>Nội dung</th><th>Dự án</th><th class="numeric">Giá trị</th><th>Hồ sơ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${fmtDate(x.date)}<div class="muted">FY${esc(x.fiscalYear||'—')}</div></td><td>${badge(x.type)}</td><td>${esc(x.category||'—')}</td><td>${esc(x.description||'—')}</td><td>${esc(projectName(x.projectId))}</td><td class="numeric strong">${fmtMoney(x.amount)}</td><td>${badge(x.evidenceStatus)}</td><td>${badge(x.status)}</td><td class="actions"><button class="ghost-btn edit-row" data-write-action data-type="citAdjustments" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="citAdjustments" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join(''):'<tr><td colspan="9" class="accounting-empty">Chưa có điều chỉnh thuế TNDN.</td></tr>'}</tbody></table></div>`;
  }
  function renderAccountingTax(){
    const rec=taxReconciliation(), pit=pitRegisterSummary(), cit=citEstimate();
    const upcoming=db.taxFilings.filter(x=>['Due soon','Overdue'].includes(filingState(x))).length;
    return `<div class="grid kpi-grid">${kpi('VAT tạm phải nộp',fmtMoney(rec.reg.payable),rec.reg.creditCarry?`Còn khấu trừ ${fmtMoney(rec.reg.creditCarry)}`:'Theo sổ hóa đơn')}${kpi('TNCN đã khấu trừ',fmtMoney(pit.tax),`${db.pitWithholdings.length} khoản chi trả`)}${kpi('TNDN ước tính',fmtMoney(cit.tax),cit.exemptionApplied?'Miễn thuế theo cấu hình đã phê duyệt':`Thuế suất nhập thủ công ${fmtNum(cit.rate,1)}%`)}${kpi('Cảnh báo thuế',fmtNum(taxIssueCount(),0),`${upcoming} nghĩa vụ sắp/quá hạn`,taxIssueCount()===0)}</div>
      <div class="note accounting-note section"><strong>Nguyên tắc vận hành:</strong> sổ hóa đơn, chứng từ kế toán và lịch kê khai được quản lý độc lập rồi đối chiếu chéo. Thuế suất và điều kiện khấu trừ phải được người phụ trách thuế xác nhận cho từng nghiệp vụ; hệ thống không tự kết luận tính hợp lệ pháp lý.</div>
      <div class="card table-card section"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Lịch kê khai & nộp thuế</h2><p>Theo dõi VAT, TNCN, TNDN tạm nộp và quyết toán năm</p></div><button class="primary-btn" data-accounting-add="taxFilings">+ Nghĩa vụ thuế</button></div>${taxFilingsTable(db.taxFilings.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)))}</div>
      <div class="grid two-col section"><div class="card card-pad"><h3>Đối chiếu VAT</h3><div class="tax-bridge"><div><span>Đầu ra theo sổ hóa đơn</span><strong>${fmtMoney(rec.reg.output)}</strong></div><div><span>Đầu ra theo TK 33311</span><strong>${fmtMoney(rec.ledger.output)}</strong></div><div class="${Math.abs(rec.outputDiff)>=1?'tax-diff':''}"><span>Chênh lệch đầu ra</span><strong>${fmtMoney(rec.outputDiff)}</strong></div><div><span>Đầu vào được khấu trừ</span><strong>${fmtMoney(rec.reg.inputDeductible)}</strong></div><div><span>Đầu vào theo TK 1331</span><strong>${fmtMoney(rec.ledger.input)}</strong></div><div class="${Math.abs(rec.inputDiff)>=1?'tax-diff':''}"><span>Chênh lệch đầu vào</span><strong>${fmtMoney(rec.inputDiff)}</strong></div></div></div>
      <div class="card card-pad"><h3>Cầu nối thuế TNDN</h3><div class="tax-bridge"><div><span>Lợi nhuận kế toán trước thuế</span><strong>${fmtMoney(cit.accounting)}</strong></div><div><span>Điều chỉnh tăng</span><strong>${fmtMoney(cit.increases)}</strong></div><div><span>Điều chỉnh giảm</span><strong>${fmtMoney(cit.decreases)}</strong></div><div><span>Lỗ được chuyển</span><strong>${fmtMoney(cit.losses)}</strong></div><div><span>Thu nhập tính thuế ước tính</span><strong>${fmtMoney(cit.taxable)}</strong></div><div><span>Thuế TNDN ước tính</span><strong>${fmtMoney(cit.tax)}</strong></div></div></div></div>
      <div class="card table-card section"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Sổ hóa đơn VAT</h2><p>Quản lý hóa đơn đầu ra, đầu vào, điều kiện khấu trừ và liên kết chứng từ</p></div><button class="secondary-btn" data-accounting-add="taxInvoices">+ Hóa đơn thuế</button></div>${taxInvoicesTable(db.taxInvoices.slice().sort((a,b)=>b.date.localeCompare(a.date)))}</div>
      <div class="card table-card section"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Khấu trừ thuế TNCN</h2><p>Theo dõi chi trả nhân viên/CTV, số thuế khấu trừ và chứng từ khấu trừ</p></div><button class="secondary-btn" data-accounting-add="pitWithholdings">+ Khoản khấu trừ</button></div>${pitWithholdingsTable(db.pitWithholdings.slice().sort((a,b)=>b.date.localeCompare(a.date)))}</div>
      <div class="card table-card section"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Điều chỉnh thuế TNDN</h2><p>Phân loại chi phí được trừ, không được trừ, điều chỉnh giảm và chuyển lỗ</p></div><button class="secondary-btn" data-accounting-add="citAdjustments">+ Điều chỉnh TNDN</button></div>${citAdjustmentsTable(db.citAdjustments.slice().sort((a,b)=>b.date.localeCompare(a.date)))}</div>
      <div class="note danger-note section"><strong>Cảnh báo:</strong> các con số là công cụ kiểm soát nội bộ. Trước khi kê khai chính thức cần đối chiếu hóa đơn điện tử, hồ sơ hợp đồng–nghiệm thu–thanh toán, điều kiện thanh toán không dùng tiền mặt, chứng từ khấu trừ TNCN và các điều chỉnh thuế TNDN.</div>`;
  }
  function renderAccountingReports(){
    const pnl=Calc.profitAndLoss(db,currentRange()),revenue=pnl.revenue,expense=pnl.expenseBeforeTax,profit=pnl.profitBeforeTax,rows=projectAccountingRows();
    return `${trialBalanceTable()}<div class="grid accounting-report-grid accounting-report-stack section"><div class="card table-card accounting-management-result-card"><div class="report-title"><h3>Báo cáo kết quả hoạt động quản trị</h3><p>Tổng hợp tài khoản doanh thu và chi phí đã ghi sổ.</p></div><div class="table-wrap accounting-management-result-wrap"><table class="accounting-management-result-table"><colgroup><col class="management-label-col"><col class="management-value-col"></colgroup><tbody><tr><td>Doanh thu</td><td class="numeric strong">${fmtMoney(revenue)}</td></tr><tr><td>Chi phí</td><td class="numeric strong">${fmtMoney(expense)}</td></tr><tr><td><strong>Lợi nhuận trước thuế</strong></td><td class="numeric strong">${fmtMoney(profit)}</td></tr><tr><td>Biên lợi nhuận</td><td class="numeric strong">${revenue?fmtNum(profit/revenue*100):0}%</td></tr></tbody></table></div></div><div class="card table-card accounting-project-profit-card"><div class="report-title"><h3>Lãi lỗ theo dự án</h3><p>Doanh thu/chi phí P&amp;L và phát sinh TK 154 trong kỳ đang chọn.</p></div><div class="table-wrap accounting-project-profit-wrap"><table class="accounting-project-profit-table"><colgroup><col class="project-profit-project-col"><col class="project-profit-revenue-col"><col class="project-profit-cost-col"><col class="project-profit-wip-col"><col class="project-profit-profit-col"></colgroup><thead><tr><th>Dự án</th><th class="numeric">Doanh thu</th><th class="numeric">Chi phí P&amp;L</th><th class="numeric">Phát sinh TK 154</th><th class="numeric">Lợi nhuận</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.project.code)}</strong><div class="muted">${esc(x.project.name)}</div></td><td class="numeric">${fmtMoney(x.revenue)}</td><td class="numeric">${fmtMoney(x.cost)}</td><td class="numeric">${fmtMoney(x.wip)}</td><td class="numeric strong">${fmtMoney(x.profit)}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  }

  function statutoryRowsTable(report, valueKey='value'){
    const isB01=/^B01/i.test(String(report.form||''));
    const header=isB01?'<th>Thuyết minh</th><th class="numeric">Số đầu năm</th><th class="numeric">Số cuối kỳ</th>':'<th>Thuyết minh</th><th class="numeric">Số kỳ này</th><th class="numeric">Số kỳ trước</th>';
    return `<div class="table-wrap"><table class="statutory-table" style="min-width:920px"><thead><tr><th>Mã số</th><th>Chỉ tiêu</th>${header}</tr></thead><tbody>${report.rows.map(x=>`<tr class="${x.bold?'report-total':''}"><td class="account-code">${esc(x.code)}</td><td style="padding-left:${12+(x.level||0)*18}px">${esc(x.label)}</td><td>${esc(x.noteRef||'')}</td>${isB01?`<td class="numeric">${fmtMoney(x.start)}</td><td class="numeric strong">${fmtMoney(x.end)}</td>`:`<td class="numeric strong">${fmtMoney(x[valueKey])}</td><td class="numeric">${fmtMoney(x.previous)}</td>`}</tr>`).join('')}</tbody></table></div>`;
  }
  function statutoryTrialBalanceTable(report){
    const rows=report.rows||[],t=report.totals||{};
    return `<div class="table-wrap"><table class="table-fit-wide table-trial-balance"><thead><tr><th>Tài khoản</th><th>Tên tài khoản</th><th class="numeric">Đầu kỳ Nợ</th><th class="numeric">Đầu kỳ Có</th><th class="numeric">Phát sinh Nợ</th><th class="numeric">Phát sinh Có</th><th class="numeric">Cuối kỳ Nợ</th><th class="numeric">Cuối kỳ Có</th></tr></thead><tbody>${rows.map(x=>`<tr><td class="account-code">${esc(x.code)}</td><td>${esc(x.name)}</td><td class="numeric">${fmtMoney(x.openingDebit)}</td><td class="numeric">${fmtMoney(x.openingCredit)}</td><td class="numeric">${fmtMoney(x.debit)}</td><td class="numeric">${fmtMoney(x.credit)}</td><td class="numeric strong">${fmtMoney(x.endingDebit)}</td><td class="numeric strong">${fmtMoney(x.endingCredit)}</td></tr>`).join('')}<tr class="report-total"><td colspan="2"><strong>TỔNG CỘNG</strong></td><td class="numeric strong">${fmtMoney(t.openingDebit)}</td><td class="numeric strong">${fmtMoney(t.openingCredit)}</td><td class="numeric strong">${fmtMoney(t.debit)}</td><td class="numeric strong">${fmtMoney(t.credit)}</td><td class="numeric strong">${fmtMoney(t.endingDebit)}</td><td class="numeric strong">${fmtMoney(t.endingCredit)}</td></tr></tbody></table></div>`;
  }
  function tt132ObligationTable(report){
    return `<div class="table-wrap"><table class="statutory-table" style="min-width:980px"><thead><tr><th>Mã số</th><th>Chỉ tiêu</th><th class="numeric">Số còn phải nộp đầu năm</th><th class="numeric">Số phải nộp phát sinh trong năm</th><th class="numeric">Số đã nộp trong năm</th><th class="numeric">Số còn phải nộp cuối năm</th></tr></thead><tbody>${(report.rows||[]).map(x=>`<tr class="${x.bold?'report-total':''}"><td class="account-code">${esc(x.code)}</td><td>${esc(x.label)}</td><td class="numeric">${fmtMoney(x.openingPayable)}</td><td class="numeric">${fmtMoney(x.arisingPayable)}</td><td class="numeric">${fmtMoney(x.paid)}</td><td class="numeric strong">${fmtMoney(x.endingPayable)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function statutoryDateText(dateValue){ return ReportingPeriod.statutoryDateText(dateValue); }
  function statutoryCompanyHeader(form,range,title,subtitle=''){
    const s=db.settings||{},unit=s.reportUnit||s.currency||'VND';
    const companyName=String(s.companyName||'ALPHA DESIGN CO., LTD').trim();
    const companyAddress=String(s.companyAddress||'').trim();
    const taxpayerCode=String(s.taxpayerCode||'').replace(/\s+/g,'').trim();
    const activeTemplate=StatutoryTemplates.getActiveTemplate(db,s.accountingRegime),config=StatutoryTemplates.reportConfig(activeTemplate,form)||{};
    const reportTitle=config.title||title,reportSubtitle=config.subtitle??subtitle;
    const regimeCode=accountingRegimeCode();
    const defaultLegal=regimeCode==='TT99'?'Ban hành theo Thông tư số 99/2025/TT-BTC ngày 27/10/2025 của Bộ Tài chính':regimeCode==='TT132'?'Ban hành kèm theo Thông tư số 132/2018/TT-BTC ngày 28/12/2018 của Bộ Tài chính':'Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/8/2016 của Bộ Tài chính';
    const legalReference=config.legalReference||activeTemplate?.legalReference||defaultLegal;
    const periodLine=ReportingPeriod.periodLine(form,range);
    return `<div class="statutory-form-header" data-template-version="${esc(activeTemplate?.version||'integrated-default')}">
      <div class="statutory-form-meta">
        <div class="statutory-entity"><strong>${esc(companyName)}</strong><span>Địa chỉ: ${esc(companyAddress||'Chưa khai báo')}</span><span>Mã số thuế: ${esc(taxpayerCode||'Chưa khai báo')}</span></div>
        <div class="statutory-template"><strong>Mẫu số ${esc(form)}</strong><span>(${esc(legalReference)})</span>${activeTemplate?`<small>Bộ mẫu ${esc(activeTemplate.version)} • hiệu lực ${fmtDate(activeTemplate.effectiveFrom)}</small>`:''}</div>
      </div>
      <div class="statutory-official-title"><h2>${esc(reportTitle)}</h2>${reportSubtitle?`<div>${esc(reportSubtitle)}</div>`:''}<p>${esc(periodLine)}</p></div>
      <div class="statutory-unit">${esc(config.unitLabel||'Đơn vị tính')}: ${esc(unit)}</div>
    </div>`;
  }
  function statutorySignatureFooter(range){
    return `<div class="statutory-signatures"><div><strong>Người lập biểu</strong><span>(Ký, họ tên)</span></div><div><strong>Kế toán trưởng</strong><span>(Ký, họ tên)</span></div><div><span>${statutoryDateText(range.to)}</span><strong>Người đại diện theo pháp luật</strong><span>(Ký, họ tên, đóng dấu)</span></div></div>`;
  }
  function statutoryAuditSummary(){
    if(!statutoryCloudAudit)return '<span class="badge neutral">Chưa đối chiếu Cloud</span>';
    const cert=statutoryCloudAudit.certification;
    if(cert?.status==='active'&&new Date(cert.expires_at||cert.expiresAt||0)>new Date())return '<span class="badge success">Cloud đã chứng nhận</span>';
    return statutoryCloudAudit.pass?'<span class="badge warning">Parity đạt • chưa chứng nhận</span>':`<span class="badge danger">Cloud parity lệch ${statutoryCloudAudit.differenceCount} chỉ tiêu</span>`;
  }
  async function sha256Text(text){
    const bytes=new TextEncoder().encode(String(text||''));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function statutoryReportHash(report){
    const rows=(report?.rows||[]).slice().sort((a,b)=>String(a.code).localeCompare(String(b.code))).map(row=>report.form==='B01a-DNN'?[String(row.code),Calc.vnd(row.start),Calc.vnd(row.end)]:[String(row.code),Calc.vnd(row.value)]);
    return sha256Text(JSON.stringify(rows));
  }
  function statutoryAuditCurrent(range=currentRange()){
    return Boolean(statutoryCloudAudit&&statutoryCloudAudit.range?.from===range.from&&statutoryCloudAudit.range?.to===range.to&&Number(statutoryCloudAudit.dbRevision)===Number(db.meta?.revision||0)&&statutoryCloudAudit.releaseVersion===RELEASE_VERSION&&Number(statutoryCloudAudit.migrationVersion)===DATABASE_MIGRATION_VERSION);
  }
  async function refreshStatutoryCertification(range=currentRange()){
    const client=window.AlphaOnline?.getClient?.();
    if(!client)throw new Error('Không có kết nối Supabase để xác minh chứng nhận BCTC trực tiếp.');
    const context=window.AlphaOnline?.getContext?.()||{};
    const companyId=context.companyId||context.company_id||context.company?.id;
    if(!companyId)throw new Error('Chưa xác định công ty trên Supabase.');
    const query=client.from('statutory_report_certifications').select('*')
      .eq('company_id',companyId).eq('period_from',range.from).eq('period_to',range.to)
      .eq('release_version',RELEASE_VERSION).eq('status','active')
      .gt('expires_at',new Date().toISOString()).order('certified_at',{ascending:false}).limit(1);
    const {data,error}=await query;
    if(error)throw error;
    const certification=Array.isArray(data)?data[0]||null:data||null;
    if(!statutoryCloudAudit)statutoryCloudAudit={pass:false,differenceCount:1,differences:[{error:'Chưa chạy đối chiếu Cloud trong phiên hiện tại'}],range:{...range},dbRevision:Number(db.meta?.revision||0),releaseVersion:RELEASE_VERSION,migrationVersion:DATABASE_MIGRATION_VERSION};
    statutoryCloudAudit={...statutoryCloudAudit,certification,certificationVerifiedAt:new Date().toISOString()};
    return clone(certification);
  }
  function statutoryTemplateFromCloud(row){
    return {id:row.id,templateId:row.template_id,version:row.version,name:row.template_name,accountingRegime:row.accounting_regime,effectiveFrom:row.effective_from,legalReference:row.legal_reference||'',packageSha256:row.package_sha256,status:row.status,importedBy:row.imported_by,importedAt:row.imported_at,activatedBy:row.activated_by,activatedAt:row.activated_at,rowVersion:row.row_version,package:row.package};
  }
  async function loadStatutoryTemplatesCloud({rerender=false}={}){
    const client=window.AlphaOnline?.getClient?.();if(!client)return [];
    const context=window.AlphaOnline?.getContext?.()||{},companyId=context.companyId||context.company_id||context.company?.id;if(!companyId)return [];
    const {data,error}=await client.from('statutory_report_templates').select('*').eq('company_id',companyId).order('effective_from',{ascending:false}).order('imported_at',{ascending:false});
    if(error)throw error;
    const rows=(data||[]).map(statutoryTemplateFromCloud);db.statutoryReportTemplates=rows;
    const active=rows.find(x=>x.status==='active');db.settings.activeStatutoryTemplateId=active?.id||'';
    if(ALLOW_LOCAL_BUSINESS_DATA)localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
    if(rerender)render();return rows;
  }
  async function persistStatutoryTemplateCloud(record){
    const client=window.AlphaOnline?.getClient?.();
    if(!client){if(IS_PRODUCTION)throw new Error('Không có kết nối Supabase để lưu bộ mẫu BCTC.');return null;}
    const context=window.AlphaOnline?.getContext?.()||{},companyId=context.companyId||context.company_id||context.company?.id;
    if(!companyId)throw new Error('Chưa xác định công ty trên Supabase để lưu bộ mẫu BCTC.');
    const payload={company_id:companyId,template_id:record.templateId,template_name:record.name,version:record.version,accounting_regime:record.accountingRegime,effective_from:record.effectiveFrom,legal_reference:record.legalReference||'',package_sha256:record.packageSha256,package:record.package,status:'candidate'};
    const {data,error}=await client.from('statutory_report_templates').insert(payload).select('*').single();if(error)throw error;return statutoryTemplateFromCloud(data);
  }
  async function activateStatutoryTemplateCloud(id){
    const client=window.AlphaOnline?.getClient?.();
    if(!client){if(IS_PRODUCTION)throw new Error('Không có kết nối Supabase để kích hoạt bộ mẫu BCTC.');return null;}
    const {data,error}=await client.rpc('activate_statutory_report_template',{p_template_id:id});if(error)throw error;return statutoryTemplateFromCloud(data);
  }
  function taxPackageFromCloud(row){return {id:row.id,packageId:row.package_id,version:row.version,name:row.package_name,jurisdiction:row.jurisdiction,effectiveFrom:row.effective_from,effectiveTo:row.effective_to||'',authority:row.authority||'',packageSha256:row.package_sha256,status:row.status,importedBy:row.imported_by,importedAt:row.imported_at,activatedBy:row.activated_by,activatedAt:row.activated_at,rowVersion:row.row_version,package:row.package};}
  async function loadTaxPackagesCloud({rerender=false}={}){const client=window.AlphaOnline?.getClient?.();if(!client)return [];const context=window.AlphaOnline?.getContext?.()||{},companyId=context.companyId||context.company_id||context.company?.id;if(!companyId)return [];const {data,error}=await client.from('tax_compliance_packages').select('*').eq('company_id',companyId).order('effective_from',{ascending:false}).order('imported_at',{ascending:false});if(error)throw error;const rows=(data||[]).map(taxPackageFromCloud);db.taxCompliancePackages=rows;const active=rows.find(x=>x.status==='active');db.settings.activeTaxCompliancePackageId=active?.id||'';if(ALLOW_LOCAL_BUSINESS_DATA)localStorage.setItem(STORAGE_KEY,JSON.stringify(db));if(rerender)render();return rows;}
  async function persistTaxPackageCloud(record){const client=window.AlphaOnline?.getClient?.();if(!client){if(IS_PRODUCTION)throw new Error('Không có kết nối Supabase để lưu gói thuế.');return null;}const context=window.AlphaOnline?.getContext?.()||{},companyId=context.companyId||context.company_id||context.company?.id;if(!companyId)throw new Error('Chưa xác định công ty trên Supabase.');const payload={company_id:companyId,package_id:record.packageId,package_name:record.name,version:record.version,jurisdiction:record.jurisdiction,effective_from:record.effectiveFrom,effective_to:record.effectiveTo||null,authority:record.authority||'',package_sha256:record.packageSha256,package:record.package,status:'candidate'};const {data,error}=await client.from('tax_compliance_packages').insert(payload).select('*').single();if(error)throw error;return taxPackageFromCloud(data);}
  async function activateTaxPackageCloud(id){const client=window.AlphaOnline?.getClient?.();if(!client){if(IS_PRODUCTION)throw new Error('Không có kết nối Supabase để kích hoạt gói thuế.');return null;}const {data,error}=await client.rpc('activate_tax_compliance_package',{p_package_id:id});if(error)throw error;return taxPackageFromCloud(data);}
  async function persistReportNoteCloud(note){
    const client=window.AlphaOnline?.getClient?.();
    if(!client)return null;
    const context=window.AlphaOnline?.getContext?.()||{};
    const companyId=context.companyId||context.company_id||context.company?.id;
    if(!companyId)throw new Error('Chưa xác định công ty trên Supabase để lưu thuyết minh B09.');
    let content=note.content;
    if(typeof content==='string')content={text:content};
    if(!content||typeof content!=='object'||Array.isArray(content))content={text:String(content||'')};
    const payload={company_id:companyId,period_from:note.periodFrom,period_to:note.periodTo,section_code:note.sectionCode,section_title:note.sectionTitle,content,status:note.status,updated_at:new Date().toISOString()};
    const {data,error}=await client.from('report_notes_tt133').upsert(payload,{onConflict:'company_id,period_from,period_to,section_code'}).select('id,period_from,period_to,section_code,section_title,content,status,content_sha256,prepared_by,prepared_at,reviewed_by,reviewed_at,approved_by,approved_at,workflow_version,updated_at').single();
    if(error)throw error;
    return data;
  }
  async function runStatutoryCloudAudit(){
    const range=currentRange(),client=window.AlphaOnline?.getClient?.();
    if(!client&&!window.AlphaCloud){alert('Chưa có kết nối Supabase để đối chiếu báo cáo phía máy chủ.');return;}
    const fetchReport=async(code)=>{
      const rpcName={B01:'report_b01a_dnn',B02:'report_b02_dnn',B03:'report_b03_dnn',B09:'report_b09_certification',CHECKS:'validate_tt133_report_set'}[code];
      if(client){const {data,error}=await client.rpc(rpcName,{p_from:range.from,p_to:range.to});if(error)throw error;return data||[];}
      return window.AlphaCloud.report(window.ALPHA_RUNTIME_CONFIG||{},code,range.from,range.to);
    };
    try{
      const [cloudB01,cloudB02,cloudB03,cloudB09,cloudChecks]=await Promise.all(['B01','B02','B03','B09','CHECKS'].map(fetchReport));
      statutoryCloudNotes=(cloudB09||[]).map(x=>({id:x.id||`cloud-${x.section_code}`,periodFrom:range.from,periodTo:range.to,sectionCode:x.section_code,sectionTitle:x.section_title,status:x.status,content:x.content,contentSha256:x.content_sha256,preparedBy:x.prepared_by,preparedAt:x.prepared_at,reviewedBy:x.reviewed_by,reviewedAt:x.reviewed_at,approvedBy:x.approved_by,approvedAt:x.approved_at,workflowVersion:x.workflow_version,workflowComplete:x.workflow_complete}));
      const reportDb={...db,reportNotesTT133:statutoryCloudNotes};
      const parity=[Calc.tt133ReportParity(Calc.tt133B01a(reportDb,range),cloudB01),Calc.tt133ReportParity(Calc.tt133B02(reportDb,range),cloudB02),Calc.tt133ReportParity(Calc.tt133B03Direct(reportDb,range),cloudB03)];
      const differences=parity.flatMap((x,i)=>x.differences.map(d=>({...d,form:['B01','B02','B03'][i]})));
      const failedCloudChecks=(cloudChecks||[]).filter(x=>x.passed!==true);
      failedCloudChecks.forEach(x=>differences.push({form:'CLOUD_VALIDATOR',code:x.check_code,error:x.details||'Cloud validation failed'}));
      const cloudB09Report=Calc.tt133B09(reportDb,range);
      statutoryCloudAudit={pass:differences.length===0,differenceCount:differences.length,differences,checkedAt:new Date().toISOString(),range:{...range},dbRevision:Number(db.meta?.revision||0),releaseVersion:RELEASE_VERSION,migrationVersion:DATABASE_MIGRATION_VERSION,b09ApprovedCount:cloudB09Report.approvedCount,certification:null};
      render();toastMsg(statutoryCloudAudit.pass?'BCTC Cloud và trình duyệt đã khớp; cần chứng nhận AAL2 để phát hành':'Phát hiện chênh lệch BCTC Cloud; đã chặn trạng thái sẵn sàng phát hành');
    }catch(error){statutoryCloudAudit={pass:false,differenceCount:1,differences:[{error:error.message||String(error)}],checkedAt:new Date().toISOString(),range:{...range},dbRevision:Number(db.meta?.revision||0),releaseVersion:RELEASE_VERSION,migrationVersion:DATABASE_MIGRATION_VERSION,certification:null};render();alert(`Không thể đối chiếu Cloud: ${error.message||error}`);}
  }
  async function certifyStatutoryCloud(){
    const range=currentRange(),client=window.AlphaOnline?.getClient?.();
    if(!client){alert('Chứng nhận BCTC chỉ thực hiện được trên Supabase thật.');return;}
    if(!statutoryAuditCurrent(range)||statutoryCloudAudit?.pass!==true){alert('Phải chạy lại đối chiếu Cloud và xử lý hết chênh lệch trước khi chứng nhận.');return;}
    const reportDb={...db,reportNotesTT133:statutoryCloudNotes};
    const b09=Calc.tt133B09(reportDb,range);
    if(!b09.complete){alert(`B09 chưa hoàn tất quy trình độc lập: ${b09.approvedCount}/8 phần.`);return;}
    const security=await requirePrivilegedAction(['financial_reports.certify'],'Chứng nhận BCTC Cloud');
    if(!security)return;
    try{
      const [b01Hash,b02Hash,b03Hash]=await Promise.all([statutoryReportHash(Calc.tt133B01a(reportDb,range)),statutoryReportHash(Calc.tt133B02(reportDb,range)),statutoryReportHash(Calc.tt133B03Direct(reportDb,range))]);
      const {data,error}=await client.rpc('certify_tt133_release',{p_from:range.from,p_to:range.to,p_release_version:RELEASE_VERSION,p_formula_version:'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8',p_migration_version:DATABASE_MIGRATION_VERSION,p_b01_sha256:b01Hash,p_b02_sha256:b02Hash,p_b03_sha256:b03Hash});
      if(error)throw error;
      statutoryCloudAudit={...statutoryCloudAudit,certification:data,certifiedAt:new Date().toISOString(),certificationVerifiedAt:new Date().toISOString()};
      await refreshStatutoryCertification(range);
      render();toastMsg('Đã chứng nhận và xác minh trực tiếp BCTC Cloud bằng bằng chứng do Supabase phát hành');
    }catch(error){alert(`Không thể chứng nhận BCTC: ${error.message||error}`);}
  }
  function renderAccountingStatutory(){
    const profile=accountingRegimeProfile(),r=currentRange(),isTT132=profile.code==='TT132';
    const isTT99=profile.code==='TT99';
    const reportDb=(!isTT99&&!isTT132&&statutoryCloudNotes.length)?{...db,reportNotesTT133:statutoryCloudNotes}:db;
    const activeTemplate=StatutoryTemplates.getActiveTemplate(db,db.settings.accountingRegime);
    if(isTT132){
      const b01Raw=Calc.tt132B01(reportDb,r),b02Raw=Calc.tt132B02(reportDb,r),f01=Calc.tt132F01(reportDb,r),f02Raw=Calc.tt132F02(reportDb,r),checks=Calc.tt132ReportChecks(reportDb,r);
      const b01=StatutoryTemplates.applyReport(b01Raw,activeTemplate,b01Raw.form),b02=StatutoryTemplates.applyReport(b02Raw,activeTemplate,b02Raw.form),f02=StatutoryTemplates.applyReport(f02Raw,activeTemplate,f02Raw.form);
      const localStatus=checks.pass?'<span class="badge success">Kiểm tra nội bộ đạt</span>':'<span class="badge danger">Còn lỗi kiểm soát</span>';
      return `<div class="accounting-toolbar"><div><strong>Bộ báo cáo tài chính theo ${esc(profile.code)}</strong><div class="muted">B01-DNSN, B02-DNSN, F01-DNSN và F02-DNSN • dữ liệu từ chứng từ Posted • có số so sánh theo kỳ.</div></div><div class="actions">${localStatus}<button class="secondary-btn" id="openStatutoryExportCenter">Mở Trung tâm kết xuất</button></div></div>
        <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(b01.form,r,'BÁO CÁO TÌNH HÌNH TÀI CHÍNH')}<div class="statutory-screen-summary">Tổng tài sản ${fmtMoney(b01.totalAssets)} • Tổng nguồn vốn ${fmtMoney(b01.totalSources)}.</div>${statutoryRowsTable(b01)}${statutorySignatureFooter(r)}</div>
        <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(b02.form,r,'BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH')}<div class="statutory-screen-summary">Lợi nhuận kế toán sau thuế TNDN ${fmtMoney(b02.profitAfterTax)}.</div>${statutoryRowsTable(b02)}${statutorySignatureFooter(r)}</div>
        <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(f01.form,r,'BẢNG CÂN ĐỐI TÀI KHOẢN')}<div class="statutory-screen-summary">Phát sinh Nợ ${fmtMoney(f01.totals?.debit)} • Phát sinh Có ${fmtMoney(f01.totals?.credit)}.</div>${statutoryTrialBalanceTable(f01)}${statutorySignatureFooter(r)}</div>
        <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(f02.form,r,'BÁO CÁO TÌNH HÌNH THỰC HIỆN NGHĨA VỤ VỚI NGÂN SÁCH NHÀ NƯỚC')}<div class="statutory-screen-summary">${f02.reconciled?'Nghĩa vụ ngân sách đã đối chiếu theo công thức đầu năm + phát sinh - đã nộp = cuối năm.':'Có số liệu nghĩa vụ ngân sách cần đối chiếu lại.'}</div>${tt132ObligationTable(f02)}${statutorySignatureFooter(r)}</div>
        <div class="note danger-note section"><strong>Kiểm soát phát hành:</strong> bộ TT132 được sinh từ sổ cái và chỉ mở kết xuất khi B01, B02, F01 và F02 vượt kiểm tra nội bộ. Trước khi nộp chính thức vẫn phải đối chiếu hồ sơ kế toán, chữ ký số và cổng tiếp nhận đang áp dụng.</div>`;
    }
    const b01Raw=isTT99?Calc.tt99B01(reportDb,r):Calc.tt133B01a(reportDb,r);
    const b02Raw=isTT99?Calc.tt99B02(reportDb,r):Calc.tt133B02(reportDb,r);
    const b03Raw=isTT99?Calc.tt99B03Direct(reportDb,r):Calc.tt133B03Direct(reportDb,r);
    const b09=isTT99?Calc.tt99B09(reportDb,r):Calc.tt133B09(reportDb,r);
    const checks=isTT99?Calc.tt99ReportChecks(reportDb,r):Calc.tt133ReportChecks(reportDb,r);
    const b01=StatutoryTemplates.applyReport(b01Raw,activeTemplate,b01Raw.form),b02=StatutoryTemplates.applyReport(b02Raw,activeTemplate,b02Raw.form),b03=StatutoryTemplates.applyReport(b03Raw,activeTemplate,b03Raw.form);
    const localStatus=isTT99&&!checks.mappingValidated?'<span class="badge danger">Khóa phát hành • mapping TT99 chưa thẩm định</span>':checks.pass?'<span class="badge success">Kiểm tra nội bộ đạt</span>':'<span class="badge danger">Còn lỗi kiểm soát</span>';
    const cloudActions=isTT99?`${localStatus}<button class="secondary-btn" id="openStatutoryExportCenter">Mở Trung tâm kết xuất</button>`:`${statutoryAuditSummary()}<button class="secondary-btn" id="runStatutoryCloudAudit">Đối chiếu Cloud</button><button class="primary-btn" id="certifyStatutoryCloud">Chứng nhận AAL2</button><button class="secondary-btn" id="openStatutoryExportCenter">Mở Trung tâm kết xuất</button>`;
    const noteCount=b09.approvedCount??0,totalNotes=(b09.sections||[]).length;
    return `<div class="accounting-toolbar"><div><strong>Bộ báo cáo tài chính theo ${esc(profile.code)}</strong><div class="muted">Dữ liệu từ chứng từ Posted • đơn vị ${esc(db.settings?.reportUnit||'VND')} • có số so sánh kỳ trước • mapping thay đổi theo chế độ kế toán.</div></div><div class="actions">${cloudActions}</div></div>
      <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(b01.form,r,'BÁO CÁO TÌNH HÌNH TÀI CHÍNH')}<div class="statutory-screen-summary">Tổng tài sản ${fmtMoney(b01.totalAssets)} • Tổng nguồn vốn ${fmtMoney(b01.totalSources)}.</div>${statutoryRowsTable(b01)}${statutorySignatureFooter(r)}</div>
      <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(b02.form,r,'BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH')}<div class="statutory-screen-summary">Lợi nhuận trước thuế ${fmtMoney(b02.profitBeforeTax)} • Sau thuế ${fmtMoney(b02.profitAfterTax)}.</div>${statutoryRowsTable(b02)}${statutorySignatureFooter(r)}</div>
      <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(b03.form,r,'BÁO CÁO LƯU CHUYỂN TIỀN TỆ','(Theo phương pháp trực tiếp)')}<div class="statutory-screen-summary">${b03.invalidDirections?.length?'Có mã lưu chuyển tiền sai chiều cần xử lý.':'Mã thu/chi đã qua kiểm soát chiều.'}</div>${statutoryRowsTable(b03)}${statutorySignatureFooter(r)}</div>
      <div class="card table-card section statutory-report-card">${statutoryCompanyHeader(isTT99?'BCĐSPS':'F01-DNN',r,'BẢNG CÂN ĐỐI SỐ PHÁT SINH')}<div class="statutory-screen-summary">Bảng kiểm soát chi tiết tài khoản kèm theo bộ báo cáo.</div>${trialBalanceTable()}${statutorySignatureFooter(r)}</div>
      <div class="card card-pad section statutory-report-card">${statutoryCompanyHeader(b09.form,r,'BẢN THUYẾT MINH BÁO CÁO TÀI CHÍNH')}<div class="statutory-screen-summary">Hoàn tất quy trình nội bộ ${noteCount}/${totalNotes} phần.</div><div class="integrity-list">${(b09.sections||[]).map(x=>`<div class="integrity-row ${x.workflowComplete?'pass':'fail'}"><span class="integrity-icon">${esc(x.sectionCode)}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.content||'')}</p><small>Nguồn: ${esc(x.source||'engine')} • trạng thái ${esc(x.status||'draft')}</small></div><button class="ghost-btn edit-report-note" data-note-type="${isTT99?'reportNotesTT99':'reportNotesTT133'}" data-section-code="${esc(x.sectionCode)}" data-note-id="${esc(x.id||'')}">Sửa</button></div>`).join('')}</div>${statutorySignatureFooter(r)}</div>
      <div class="note danger-note section"><strong>Kiểm soát phát hành:</strong> ${isTT99?'Bản TT99 này chỉ là bản xem trước tương thích vì mapping hiện tại được suy ra từ TT133 và chưa đối chiếu đầy đủ Phụ lục IV Thông tư 99/2025/TT-BTC; mọi định dạng xuất TT99 bị khóa.':'Báo cáo được sinh từ sổ cái và chế độ đang chọn. Trước khi nộp chính thức vẫn phải đối chiếu với hồ sơ kế toán, chữ ký số và cổng tiếp nhận đang áp dụng.'}</div>`;
  }
  function renderAccountingControl(){
    const audit=Calc.integrityChecks(db,currentRange()),failed=audit.checks.filter(x=>!x.pass),periods=(db.accountingPeriods||[]).slice().sort((a,b)=>b.from.localeCompare(a.from)),ops=AccountingOps.assess(db,currentRange());
    const opsTable=`<div class="card table-card section accounting-operations-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Ma trận nghiệp vụ kế toán</h2><p>Đối chiếu chu trình hằng ngày, tháng/quý và cuối năm theo mô hình phần mềm kế toán tổng thể.</p></div><span class="badge ${ops.score>=85?'success':'warning'}">${ops.score}/100</span></div><div class="table-wrap"><table><thead><tr><th>Nghiệp vụ</th><th>Chu kỳ</th><th>Trạng thái</th><th>Đánh giá</th></tr></thead><tbody>${ops.rows.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.cycle==='daily'?'Hằng ngày':x.cycle==='monthly'?'Tháng / quý':'Cuối năm')}</td><td>${badge(x.status==='supported'?'Đáp ứng':x.status==='partial'?'Một phần':'Không áp dụng')}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div></div>`;
    return `<div class="grid kpi-grid">${kpi('Điểm tin cậy',`${audit.score}/100`,'bộ kiểm tra tự động',audit.score>=90,{icon:'✓',color:audit.score>=90?'green':'orange',trend:audit.passCritical?'Đạt':'Chưa đạt'})}${kpi('Kiểm tra đạt',fmtNum(audit.checks.filter(x=>x.pass).length,0),`/${audit.checks.length} phép thử`,audit.passCritical,{icon:'▥',color:'blue'})}${kpi('Lỗi trọng yếu',fmtNum(failed.filter(x=>x.severity==='critical').length,0),'phải xử lý trước khóa sổ',!failed.some(x=>x.severity==='critical'),{icon:'!',color:'red'})}${kpi('Cảnh báo',fmtNum(failed.filter(x=>x.severity==='warning').length,0),'cần giải trình',!failed.some(x=>x.severity==='warning'),{icon:'◫',color:'orange'})}</div>${opsTable}
    <div class="card table-card section"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Bộ kiểm tra toàn vẹn dữ liệu</h2><p>Cân đối Nợ/Có, BCTC TT133, trùng chứng từ, VAT, TNCN, timesheet, khóa kỳ và dấu vết ghi sổ.</p></div><button class="secondary-btn" id="exportIntegrity">Xuất báo cáo kiểm tra</button></div><div class="integrity-list">${audit.checks.map(x=>`<div class="integrity-row ${x.pass?'pass':'fail'}"><span class="integrity-icon">${x.pass?'✓':'!'}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p></div><span class="badge ${x.pass?'success':x.severity==='critical'?'danger':'warning'}">${x.pass?'Đạt':x.severity==='critical'?'Lỗi':'Cảnh báo'}</span></div>`).join('')}</div></div>
    <div class="grid two-col section"><div class="card table-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Số dư đầu kỳ</h2><p>Được cộng vào bảng cân đối số phát sinh.</p></div><button class="secondary-btn" data-accounting-add="openingBalances">+ Số dư đầu kỳ</button></div><div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Nội dung</th><th class="numeric">Dư Nợ</th><th class="numeric">Dư Có</th><th></th></tr></thead><tbody>${(db.openingBalances||[]).map(x=>`<tr><td class="account-code">${esc(x.accountCode)}</td><td>${esc(x.description||'Số dư chuyển sang')}</td><td class="numeric">${fmtMoney(x.debit)}</td><td class="numeric">${fmtMoney(x.credit)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="openingBalances" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="openingBalances" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">Chưa nhập số dư đầu kỳ.</td></tr>'}</tbody></table></div></div>
    <div class="card card-pad"><div class="section-header"><div><h2>Khóa kỳ kế toán</h2><p>Ngăn ghi sổ, điều chỉnh sai kỳ hoặc tạo chứng từ mới trong khoảng đã khóa.</p></div></div><div class="control-actions"><button class="primary-btn" id="lockCurrentPeriod" data-write-action>Khóa khoảng đang xem</button><button class="secondary-btn" id="unlockCurrentPeriod" data-write-action>Mở khóa khoảng đang xem</button></div><div class="period-list">${periods.map(x=>`<div class="period-item"><span><strong>${esc(x.label||'Kỳ kế toán')}</strong><small>${fmtDate(x.from)} — ${fmtDate(x.to)}</small></span>${badge(x.locked?'Locked':'Open')}</div>`).join('')||'<p class="muted">Chưa có kỳ nào được khóa.</p>'}</div></div></div>
    <div class="card card-pad section"><div class="section-header"><div><h2>Cổng kiểm soát go-live</h2><p>Chỉ chuyển sang nguồn dữ liệu chính thức khi tất cả điều kiện được xác nhận bằng bằng chứng.</p></div></div><div class="integrity-list">
      ${[['Backend ACID, khóa đồng thời, RLS và audit bất biến','Mã nguồn đã đóng gói','pass'],['Bộ BCTC B01a/B02/B03/B09/F01','Engine và validator đã có','pass'],['Đối chiếu song song 2–3 kỳ','Chưa thể xác nhận bằng dữ liệu mẫu','fail'],['Load test trên staging/production','Cần chạy k6 trên hạ tầng triển khai','fail'],['Diễn tập backup và restore','Cần biên bản phục hồi database thật','fail'],['Kế toán trưởng ký nghiệm thu','Bắt buộc trước go-live','fail']].map(x=>`<div class="integrity-row ${x[2]}"><span class="integrity-icon">${x[2]==='pass'?'✓':'!'}</span><div><strong>${x[0]}</strong><p>${x[1]}</p></div><span class="badge ${x[2]==='pass'?'success':'warning'}">${x[2]==='pass'?'Đã có':'Chờ xác nhận'}</span></div>`).join('')}</div></div>
    <div class="note accounting-note section"><strong>Chuẩn kiểm soát:</strong> frontend chặn chứng từ sai; backend PostgreSQL trong gói triển khai bổ sung giao dịch ACID, khóa đồng thời, RLS và audit log bất biến. Trước go-live phải chạy đối chiếu song song 2–3 kỳ, kiểm thử tải, diễn tập phục hồi và ký biên bản nghiệm thu.</div>`;
  }
  function renderAccounting(){
    const body={overview:renderAccountingOverview,vouchers:renderAccountingVouchers,accounts:renderAccountingAccounts,partners:renderAccountingPartners,tax:renderAccountingTax,reports:renderAccountingReports,statutory:renderAccountingStatutory,control:renderAccountingControl}[currentAccountingTab]?.()||renderAccountingOverview();
    return accountingShell(body);
  }


  function renderTax(){
    const calendarStatus=refreshTaxCalendar({persist:false});
    const r=currentRange(),a=aData(),rec=taxReconciliation(),pit=pitRegisterSummary(),cit=citEstimate(),states=db.taxFilings.map(x=>filingState(x)),upcoming=states.filter(x=>x==='Due soon').length,overdue=states.filter(x=>x==='Overdue').length,issues=taxIssueCount();
    const calendarYear=Number(String(r.from||today()).slice(0,4))||Number(today().slice(0,4)),calendarSource=taxCalendarSourceInfo(calendarYear);
    const calendarRows=(db.taxFilings||[]).filter(x=>String(x.period||'').includes(String(calendarYear))).slice().sort((x,y)=>taxCalendarPriority(x)-taxCalendarPriority(y)||String(x.dueDate||'').localeCompare(String(y.dueDate||''))).slice(0,6);
    const keys=a.keys||[],vatOut=keys.map(k=>(db.taxInvoices||[]).filter(x=>Calc.activeInvoice(x)&&Calc.statusIs(x.direction,'Output')&&x.date.startsWith(k)).reduce((s,x)=>s+Calc.vnd(x.vatAmount),0)/1e6),vatIn=keys.map(k=>Calc.vatRegisterSummary(db,{from:`${k}-01`,to:`${k}-31`}).inputDeductible/1e6),pitM=keys.map(k=>Calc.pitRegisterSummary(db,{from:`${k}-01`,to:`${k}-31`}).tax/1e6),citM=keys.map(k=>Calc.citEstimate(db,{from:`${k}-01`,to:`${k}-31`}).tax/1e6),total=rec.reg.payable+pit.tax+cit.tax;
    const taxItems=[{name:'VAT tạm phải nộp',value:rec.reg.payable,color:'#0b73f6'},{name:'TNCN đã khấu trừ',value:pit.tax,color:'#8b5cf6'},{name:'TNDN ước tính',value:cit.tax,color:'#f59e0b'}].filter(x=>x.value>0);
    return `<div class="grid kpi-grid">${kpi('VAT đầu ra',compactMoney(rec.reg.output),'Sổ hóa đơn đầu ra',true,{icon:'▤',color:'purple',unit:'VND'})}${kpi('VAT đầu vào khấu trừ',compactMoney(rec.reg.inputDeductible),'Theo phần thanh toán có chứng từ hợp lệ',true,{icon:'▥',color:'blue',unit:'VND'})}${kpi('Thuế TNCN đã khấu trừ',compactMoney(pit.tax),'Theo sổ khấu trừ',true,{icon:'♙',color:'teal',unit:'VND'})}${kpi('Thuế TNDN tạm tính',compactMoney(cit.tax),`Thuế suất nhập thủ công ${fmtNum(cit.rate,1)}%`,true,{icon:'₫',color:'orange',unit:'VND'})}${kpi('Tổng nghĩa vụ thuế',compactMoney(total),'Ước tính quản trị',total===0,{icon:'◫',color:'red',unit:'VND'})}${kpi('Hồ sơ cần chú ý',fmtNum(upcoming+overdue,0),`${overdue} quá hạn • ${upcoming} sắp hạn`,overdue===0,{icon:'!',color:'orange'})}</div>
    <div class="note tax-legal-note"><strong>Nguyên tắc pháp lý:</strong> Chế độ kế toán đang chọn điều chỉnh ghi sổ và BCTC, không tự xác định nghĩa vụ thuế. Phân hệ thuế dùng tham số và sổ đối chiếu riêng; thuế suất, ngưỡng, hạn nộp và điều kiện khấu trừ phải được kế toán trưởng cập nhật theo văn bản thuế đang có hiệu lực.</div>
    <div class="grid two-col section tax-compliance-grid"><div class="card card-pad tax-calendar-card"><div class="section-header"><div><h2>Lịch thuế ${calendarYear} & nhắc việc</h2><p>Tự chuyển năm theo kỳ báo cáo; lịch được sinh từ gói quy tắc có ngày hiệu lực, không đọc trực tiếp từ Internet.</p></div><div class="tax-calendar-actions"><span class="badge info">Năm ${calendarYear}</span><button class="section-link" id="syncTaxCalendar">↻ Đồng bộ lịch</button><button class="section-link" data-accounting-add="taxFilings">+ Thêm thủ công</button></div></div><div class="tax-calendar-list">${calendarRows.length?calendarRows.map(x=>{const state=filingState(x),days=daysUntilTaxDue(x);return `<article class="tax-calendar-row is-${esc(state.toLowerCase().replace(/\s+/g,'-'))}" data-record-id="${esc(x.id)}"><span class="tax-calendar-icon">◫</span><div><strong>${esc(x.taxType)} • ${esc(x.period)}</strong><small>Hạn ${fmtDate(x.dueDate)} • ${esc(filingStateLabel(state))}</small></div><span class="tax-calendar-countdown ${days!==null&&days<0?'is-overdue':state==='Due soon'?'is-due-soon':''}">${esc(taxCalendarCountdown(x))}</span><button class="ghost-btn edit-row" data-write-action data-type="taxFilings" data-id="${esc(x.id)}">Xử lý</button></article>`;}).join(''):'<div class="empty-state">Chưa có lịch thuế trong kỳ.</div>'}</div><div class="chart-explanation tax-calendar-explanation"><strong>Nguồn & độ tin cậy:</strong> ${esc(calendarSource.name)} • ${esc(calendarSource.status)}${calendarSource.verifiedOn?` • rà soát ${fmtDate(calendarSource.verifiedOn)}`:''}. Căn cứ: ${esc(calendarSource.references.join(' • ')||'Luật Quản lý thuế và văn bản hướng dẫn đã cấu hình')}. ${esc(calendarSource.sourcePolicy||'Không truy cập Internet khi chạy; chỉ dùng gói đã được nhập và kích hoạt.')} Hệ thống tự sinh lịch theo năm đang xem và tự chuyển sang năm mới; thay đổi pháp luật vẫn phải được cập nhật bằng gói có ngày hiệu lực và kế toán trưởng phê duyệt.</div></div><div class="grid tax-analysis-grid"><div class="card chart-card compact tax-structure-card"><div class="section-header"><div><h2>Cơ cấu nghĩa vụ thuế</h2><p>Tỷ trọng nghĩa vụ quản trị tại kỳ đang chọn.</p></div></div>${donutChart(taxItems.length?taxItems:[{name:'Chưa phát sinh',value:1,color:'#e5e7eb'}],'Tổng nghĩa vụ',compactMoney(total))}</div><div class="card chart-card compact tax-monthly-card"><div class="section-header"><div><h2>Nghĩa vụ thuế theo tháng</h2><p>Trục giá trị tự chuyển đơn vị triệu/tỷ theo quy mô dữ liệu.</p></div></div>${comboChart(a.months,[{name:'VAT đầu ra',values:vatOut,color:'#0b73f6'},{name:'VAT đầu vào',values:vatIn,color:'#14b8a6'},{name:'TNCN',values:pitM,color:'#8b5cf6'}],[{name:'TNDN tạm tính',values:citM,color:'#f59e0b'}])}</div></div></div>
    <div class="card card-pad section tax-compliance-card"><div class="section-header"><div><h2>Tình trạng tuân thủ thuế</h2><p>Tổng hợp nhanh trước khi đối chiếu chi tiết hóa đơn</p></div></div><div class="status-strip"><div class="status-chip"><span>Kiểm soát dữ liệu</span><strong class="${issues===0?'trend-up':'trend-down'}">${issues===0?'Đạt':`${issues} lỗi`}</strong></div><div class="status-chip"><span>Sắp đến hạn</span><strong class="trend-flat">${upcoming}</strong></div><div class="status-chip"><span>Quá hạn</span><strong class="${overdue===0?'trend-up':'trend-down'}">${overdue}</strong></div><div class="status-chip"><span>Đối chiếu VAT</span><strong class="${rec.outputDiff===0&&rec.inputDiff===0?'trend-up':'trend-down'}">${rec.outputDiff===0&&rec.inputDiff===0?'Khớp':'Lệch'}</strong></div></div><div class="tax-bridge tax-bridge-horizontal section"><div><span>TNCN đã khấu trừ</span><strong>${fmtMoney(pit.tax)}</strong></div><div><span>TNDN ước tính</span><strong>${fmtMoney(cit.tax)}</strong></div><div><span>VAT tạm phải nộp</span><strong>${fmtMoney(rec.reg.payable)}</strong></div></div></div>
    <div class="card table-card section tax-invoice-card"><div class="section-header card-pad" style="margin-bottom:0"><div><h2>Hóa đơn VAT cần đối chiếu</h2><p>Liên kết chứng từ và điều kiện khấu trừ</p></div><button class="section-link" data-accounting-add="taxInvoices">+ Hóa đơn</button></div>${taxInvoicesTable(filterRowsForView(db.taxInvoices,'tax').slice(0,80))}</div>`;
  }
  function renderExports(){ return window.AlphaExportCenter?.render(db,currentRange()) || '<div class="note danger-note">Không tải được mô-đun kết xuất.</div>'; }

  function renderSettings(){
    const s=db.settings,citHistory=(s.citManualRateHistory||[]).slice().sort((a,b)=>String(b.effectiveFrom||'').localeCompare(String(a.effectiveFrom||'')));
    const activeTemplate=StatutoryTemplates.getActiveTemplate(db,s.accountingRegime);
    const templateRows=(db.statutoryReportTemplates||[]).slice().sort((a,b)=>String(b.importedAt||'').localeCompare(String(a.importedAt||'')));
    const activeTaxPackage=TaxPackages.getActivePackage(db,currentRange().to||today());
    const taxPackageRows=(db.taxCompliancePackages||[]).slice().sort((a,b)=>String(b.effectiveFrom||'').localeCompare(String(a.effectiveFrom||'')));
    return `<div class="grid two-col"><div class="card settings-card"><h3>Cấu hình quản trị</h3><p>Các tham số ảnh hưởng trực tiếp đến chỉ số tài chính và chi phí.</p><form id="settingsForm" class="form-grid">
      ${field('companyName','Tên doanh nghiệp','text',s.companyName,[],true,'required')}
      ${field('companyAddress','Địa chỉ trụ sở','text',s.companyAddress||'',[],true)}
      ${field('taxpayerCode','Mã số thuế','text',s.taxpayerCode||'',[],false,'inputmode="numeric" autocomplete="off"')}
      <div class="settings-link-note"><strong>Liên kết BCTC tự động:</strong> Tên doanh nghiệp, địa chỉ và mã số thuế được cập nhật ngay vào B01a, B02, B03, F01 và B09 sau khi lưu; dữ liệu Cloud cũng dùng cùng bản ghi Thiết lập.</div>
      ${field('reportUnit','Đơn vị tính BCTC','select',s.reportUnit||'VND',[{value:'VND',label:'VND'},{value:'Nghìn VND',label:'Nghìn VND'},{value:'Triệu VND',label:'Triệu VND'}])}
      ${field('targetMargin','Biên lợi nhuận mục tiêu (%)','number',s.targetMargin,[],false,'min="0" max="100" step="0.1"')}
      ${field('laborBudgetRatio','Tỷ lệ ngân sách nhân sự mục tiêu (%)','number',s.laborBudgetRatio,[],false,'min="0" max="100" step="0.1"')}
      ${field('overheadMonthly','Chi phí chung khác, không gồm lương (VND/tháng)','number',s.overheadMonthly,[],false,'min="0" step="1000000"')}
      ${field('monthlyWorkingHours','Giờ công chuẩn / tháng','number',s.monthlyWorkingHours,[],false,'min="1" step="1"')}${field('dailyWorkingHours','Giờ làm việc chuẩn / ngày','number',s.dailyWorkingHours||8,[],false,'min="1" max="24" step="0.5"')}${field('overtimeMultiplier','Hệ số làm thêm mặc định','number',s.overtimeMultiplier||1.5,[],false,'min="1" max="5" step="0.1"')}${field('employeeInsuranceRate','Tỷ lệ BH người lao động (%)','number',s.employeeInsuranceRate??10.5,[],false,'min="0" max="100" step="0.01"')}${field('employerInsuranceRate','Tỷ lệ BH doanh nghiệp (%)','number',s.employerInsuranceRate??21.5,[],false,'min="0" max="100" step="0.01"')}${field('personalDeduction','Giảm trừ bản thân / tháng','number',s.personalDeduction??15500000,[],false,'min="0" step="100000"')}${field('dependentDeduction','Giảm trừ mỗi người phụ thuộc / tháng','number',s.dependentDeduction??6200000,[],false,'min="0" step="100000"')}${field('fixedPitScheduleEffectiveDate','Ngày hiệu lực biểu thuế lương hiện hành','date',s.fixedPitScheduleEffectiveDate||'2026-01-01')}${field('payrollPolicyVersion','Quy chế bảng lương nội bộ','text',s.payrollPolicyVersion||'ALPHA-PAYROLL-2026.03',[],true,'readonly')}
      ${field('accountingRegime','Chế độ kế toán','select',s.accountingRegime||'TT133/2016/TT-BTC (DNNVV)',accountingRegimeOptions(),true)}
      ${field('accountingRegimeEffectiveDate','Ngày hiệu lực chế độ kế toán','date',s.accountingRegimeEffectiveDate||'2026-01-01')}
      ${field('accountingPolicyVersion','Quy chế hạch toán nội bộ','text',s.accountingPolicyVersion||'ALPHA-TT133-2026.01',[],true,'readonly')}${field('vatMethod','Phương pháp VAT','select',s.vatMethod||'Khấu trừ',[{value:'Khấu trừ',label:'Khấu trừ'},{value:'Trực tiếp',label:'Trực tiếp'}])}
      ${field('defaultVatRate','Thuế suất VAT mặc định (%)','number',s.defaultVatRate||10,[],false,'min="0" max="100" step="0.1"')}
      ${field('reducedVatRate','Thuế suất VAT giảm (%)','number',s.reducedVatRate||8,[],false,'min="0" max="100" step="0.1"')}
      ${field('vatReductionEnd','Kết thúc chính sách VAT giảm','date',s.vatReductionEnd||'2026-12-31')}
      ${field('taxFilingFrequency','Chu kỳ khai VAT/TNCN','select',s.taxFilingFrequency||'Quarterly',[{value:'Monthly',label:'Theo tháng'},{value:'Quarterly',label:'Theo quý'}])}
      ${field('taxReminderWindowDays','Nhắc trước hạn thuế (ngày)','number',s.taxReminderWindowDays??30,[],false,'min="1" max="90" step="1"')}
      ${field('pitWithholdingRate','Tỷ lệ khấu trừ TNCN CTV tham chiếu (%)','number',s.pitWithholdingRate||10,[],false,'min="0" max="100" step="0.1"')}
      ${field('pitWithholdingThreshold','Ngưỡng TNCN hiện hành / lần (VND)','number',s.pitWithholdingThreshold??5000000,[],false,'min="0" step="100000"')}
      ${field('pitWithholdingThresholdPrevious','Ngưỡng TNCN trước ngày hiệu lực (VND)','number',s.pitWithholdingThresholdPrevious??2000000,[],false,'min="0" step="100000"')}
      ${field('pitWithholdingThresholdEffectiveDate','Ngày áp dụng ngưỡng TNCN hiện hành','date',s.pitWithholdingThresholdEffectiveDate||'2026-07-01')}
      ${field('corporateTaxRate','Thuế suất TNDN áp dụng (%) — nhập thủ công','number',s.corporateTaxRate??20,[],false,'min="0" max="100" step="0.1" required')}
      ${field('corporateTaxRateEffectiveDate','Ngày hiệu lực thuế suất TNDN','date',s.corporateTaxRateEffectiveDate||`${new Date().getFullYear()}-01-01`,[],false,'required')}
      ${field('employerBurdenRate','Tỷ lệ chi phí NSDLĐ cộng vào cost/giờ (%)','number',s.employerBurdenRate||0,[],false,'min="0" max="100" step="0.1"')}
      ${field('latePaymentDailyRate','Tiền chậm nộp tham chiếu (%/ngày)','number',s.latePaymentDailyRate||0.03,[],false,'min="0" max="1" step="0.001"')}${field('maxContractValue','Ngưỡng cảnh báo giá trị hợp đồng (VND)','number',s.maxContractValue||1000000000000,[],false,'min="1000000" step="1000000"')}${field('fixedAssetThreshold','Ngưỡng ghi nhận TSCĐ (VND)','number',s.fixedAssetThreshold||30000000,[],false,'min="0" step="1000000"')}${field('toolMaxAllocationMonths','Phân bổ CCDC tối đa (tháng)','number',s.toolMaxAllocationMonths||36,[],false,'min="1" max="120" step="1"')}${field('procurementPolicyVersion','Quy chế mua sắm & tài sản','text',s.procurementPolicyVersion||'ALPHA-PROC-ASSET-2026.01',[],true,'readonly')}${field('forecastHorizonMonths','Kỳ dự báo tài chính (tháng)','number',s.forecastHorizonMonths||12,[],false,'min="3" max="36" step="1"')}${field('minimumCashBuffer','Ngưỡng tiền an toàn tối thiểu (VND)','number',s.minimumCashBuffer||150000000,[],false,'min="0" step="10000000"')}${field('financialAnalyticsPolicyVersion','Quy chế phân tích & dự báo','text',s.financialAnalyticsPolicyVersion||'ALPHA-FINANCE-ANALYTICS-2026.01',[],true,'readonly')}
      ${field('taxAuthority','Cơ quan thuế quản lý','text',s.taxAuthority||'')}
      ${field('taxContactEmail','Email nhận thông báo thuế','email',s.taxContactEmail||'')}
      ${field('taxRuleVersion','Phiên bản quy tắc thuế','text',s.taxRuleVersion||'Pháp luật thuế hiện hành • tham số hóa • kế toán trưởng phê duyệt',[],true,'readonly')}
      <div class="form-actions"><button type="submit" class="primary-btn">Lưu thiết lập</button></div></form></div>
      <div class="grid"><div class="card card-pad"><div class="section-header"><div><h2>Quản trị dữ liệu</h2><p>Sao lưu trước khi thay đổi lớn</p></div></div><div class="inline-stats"><div class="mini-stat"><span>Dự án</span><strong>${db.projects.length}</strong></div><div class="mini-stat"><span>Nhân sự</span><strong>${db.people.length}</strong></div><div class="mini-stat"><span>Giao dịch</span><strong>${db.finance.length}</strong></div></div><div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="secondary-btn" id="settingsExport">Tải bản sao JSON</button><button class="danger-btn" id="resetDemo" data-write-action>Khôi phục dữ liệu mẫu</button></div></div>
      <div class="card card-pad statutory-template-manager-card"><div class="section-header"><div><h2>Quản lý bộ mẫu BCTC</h2><p>Nhập gói ZIP/JSON, kiểm tra cấu trúc, lưu phiên bản và kích hoạt có kiểm soát.</p></div></div>
        <div class="template-current"><span>Bộ mẫu đang dùng</span><strong>${esc(activeTemplate?`${activeTemplate.name} • ${activeTemplate.version}`:`Mẫu ${accountingRegimeCode()} tích hợp mặc định`)}</strong><small>${activeTemplate?`Hiệu lực ${fmtDate(activeTemplate.effectiveFrom)} • SHA-256 ${esc(activeTemplate.packageSha256.slice(0,12))}…`:'Chưa có gói mẫu tùy chỉnh được kích hoạt.'}</small></div>
        <div class="template-import-actions"><label class="secondary-btn file-label">Chọn gói mẫu<input id="statutoryTemplateInput" type="file" accept=".zip,.json,application/zip,application/json" hidden></label><button class="primary-btn" id="importStatutoryTemplate" data-write-action>Kiểm tra & nhập</button><button class="secondary-btn" id="downloadStatutoryTemplateExample">Tải gói mẫu tham chiếu</button></div>
        <p class="template-import-status muted" id="statutoryTemplateStatus">Chưa chọn file. Gói format không được chứa JavaScript hoặc công thức thực thi.</p>
        <div class="template-version-list">${templateRows.map(t=>`<div class="template-version-row"><div><strong>${esc(t.name)}</strong><small>${esc(t.accountingRegime)} • v${esc(t.version)} • hiệu lực ${fmtDate(t.effectiveFrom)}</small><small>${badge(t.status)} • nhập bởi ${esc(t.importedBy||'—')}</small></div><div class="actions">${t.status!=='active'?`<button class="ghost-btn activate-statutory-template" data-template-id="${esc(t.id)}" data-write-action>Kích hoạt</button>`:'<span class="badge success">Đang áp dụng</span>'}</div></div>`).join('')||'<div class="muted">Chưa nhập bộ mẫu tùy chỉnh.</div>'}</div>
        <div class="algorithm-note"><strong>Phạm vi an toàn:</strong> gói mẫu được phép đổi tiêu đề, thứ tự, tên chỉ tiêu, thuyết minh và CSS in. Công thức số học vẫn do Calculation Core đã kiểm thử thực hiện; thay đổi mapping tài khoản phải đi qua migration và kiểm thử riêng.</div>
      </div>
      <div class="card card-pad statutory-template-manager-card tax-package-manager-card"><div class="section-header"><div><h2>Quản lý gói nghiệp vụ thuế</h2><p>Cập nhật biểu mẫu, ràng buộc dữ liệu, căn cứ pháp lý và hồ sơ XML theo ngày hiệu lực.</p></div></div>
        <div class="template-current"><span>Gói thuế đang áp dụng</span><strong>${esc(activeTaxPackage?`${activeTaxPackage.name} • ${activeTaxPackage.version}`:'Chưa kích hoạt gói thuế')}</strong><small>${activeTaxPackage?`Hiệu lực ${fmtDate(activeTaxPackage.effectiveFrom)} • SHA-256 ${esc(activeTaxPackage.packageSha256.slice(0,12))}…`:'Sổ thuế vẫn hoạt động quản trị; chưa được phép coi XML là hồ sơ nộp chính thức.'}</small></div>
        <div class="template-import-actions"><label class="secondary-btn file-label">Chọn gói thuế<input id="taxPackageInput" type="file" accept=".json,application/json" hidden></label><button class="primary-btn" id="importTaxPackage" data-write-action>Kiểm tra & nhập</button><button class="secondary-btn" id="downloadTaxPackageExample">Tải gói tham chiếu</button></div>
        <p class="template-import-status muted" id="taxPackageStatus">Gói cập nhật phải có ngày hiệu lực, danh sách biểu mẫu, căn cứ pháp lý và checksum; không được chứa JavaScript.</p>
        <div class="template-version-list">${taxPackageRows.map(t=>`<div class="template-version-row"><div><strong>${esc(t.name)}</strong><small>v${esc(t.version)} • hiệu lực ${fmtDate(t.effectiveFrom)}${t.effectiveTo?` — ${fmtDate(t.effectiveTo)}`:''}</small><small>${badge(t.status)} • ${esc(t.authority||'Chưa khai báo cơ quan ban hành')}</small></div><div class="actions">${t.status!=='active'?`<button class="ghost-btn activate-tax-package" data-package-id="${esc(t.id)}" data-write-action>Kích hoạt</button>`:'<span class="badge success">Đang áp dụng</span>'}</div></div>`).join('')||'<div class="muted">Chưa nhập gói nghiệp vụ thuế.</div>'}</div>
        <div class="algorithm-note"><strong>Nguyên tắc cập nhật:</strong> biểu mẫu và schema được version hóa theo ngày hiệu lực; gói cũ không bị ghi đè. XML chỉ được gắn trạng thái “có thể nộp” sau khi kiểm thử với HTKK/eTax đang hiệu lực và được người phụ trách thuế phê duyệt.</div>
      </div></div></div>`;
  }


  function renderCommercial(){
    const range=currentRange();
    const aging=Calc.invoiceAging(db,{direction:'Output',to:range.to,asOf:range.to||today()});
    const summary=Calc.contractRegisterSummary(db,range);
    const contractRows=filterRowsForView(summary.allCustomerContracts,'commercial').slice().sort((a,b)=>String(b.signedDate||b.effectiveDate||'').localeCompare(String(a.signedDate||a.effectiveDate||'')));
    const milestoneRows=filterRowsForView(db.billingMilestones,'commercial').slice().sort((a,b)=>String(a.dueDate||'').localeCompare(String(b.dueDate||'')));
    const outlierIds=new Set(summary.outliers.map(x=>String(x.contract.id)));
    return `<div class="modern-hero commercial-hero"><div><span class="eyebrow">COMMERCIAL CONTROL</span><h2>Hợp đồng, xuất hóa đơn và công nợ trên cùng một chuỗi dữ liệu</h2><p>Chỉ hợp đồng khách hàng ở trạng thái cam kết được tính vào Contract Value và Backlog. Draft, hợp đồng nhà cung cấp và dữ liệu bất thường được tách riêng.</p></div><div class="hero-metric"><span>Phải thu hóa đơn</span><strong>${compactMoney(aging.totals.outstanding)}</strong></div></div>
    ${summary.outliers.length?`<div class="note danger-note section"><strong>Cảnh báo dữ liệu:</strong> ${summary.outliers.length} hợp đồng có giá trị vượt ngưỡng kiểm soát. Các hợp đồng này không được phép ghi nhận là dữ liệu tin cậy cho tới khi sửa hoặc xóa an toàn.</div>`:''}
    <div class="grid dashboard-kpi-grid section compact-kpi-row control-kpi-row">
      ${kpi('Hợp đồng đã ký',compactMoney(summary.contractValue),`${summary.includedContracts.length} hợp đồng khách hàng đủ điều kiện`,true,{icon:'▣',color:'blue',unit:'VND'})}
      ${kpi('Đã xuất hóa đơn',compactMoney(summary.invoicedNet),`${fmtNum(summary.contractValue?summary.invoicedNet/summary.contractValue*100:0,1)}% hợp đồng đã ký`,true,{icon:'▤',color:'purple',unit:'VND'})}
      ${kpi('Đã phân bổ thu',compactMoney(aging.totals.allocated),`${fmtNum(aging.totals.original?aging.totals.allocated/aging.totals.original*100:0,1)}% hóa đơn gross`,true,{icon:'↕',color:'green',unit:'VND'})}
      ${kpi('Công nợ hóa đơn',compactMoney(aging.totals.outstanding),'Theo từng hóa đơn và hạn thanh toán',aging.totals.outstanding===0,{icon:'!',color:'orange',unit:'VND'})}
    </div>
    <div class="commercial-contract-stack section"><div class="card table-card commercial-contract-register-card"><div class="section-header card-pad"><div><h2>Danh mục hợp đồng</h2><p>Chỉ Active/Signed/Completed mới được tính vào hợp đồng đã ký</p></div><button class="section-link" data-secondary-add="contracts">+ Hợp đồng</button></div><div class="table-wrap"><table class="table-fit-desktop table-contracts"><thead><tr><th>Số hợp đồng</th><th>Dự án</th><th class="numeric">Giá trị chưa VAT</th><th class="numeric">VAT</th><th>Hiệu lực</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${contractRows.map(x=>`<tr class="${outlierIds.has(String(x.id))?'row-danger':''}"><td><strong>${esc(x.contractNo)}</strong><div class="muted">${fmtDate(x.signedDate)}${outlierIds.has(String(x.id))?' • Giá trị bất thường':''}</div></td><td>${esc(projectName(x.projectId))}</td><td class="numeric ${outlierIds.has(String(x.id))?'cell-danger':''}">${fmtMoney(x.valueExclVat)}</td><td class="numeric">${fmtNum(x.vatRate,1)}%</td><td>${fmtDate(x.effectiveDate)} — ${fmtDate(x.expiryDate)}</td><td>${badge(x.status)}</td><td class="actions"><button class="icon-btn contract-action edit-row" data-write-action data-type="contracts" data-id="${esc(x.id)}" title="Chỉnh sửa hợp đồng" aria-label="Chỉnh sửa hợp đồng"><svg aria-hidden="true"><use href="#i-edit"/></svg></button><button class="icon-btn contract-action danger delete-row" data-write-action data-type="contracts" data-id="${esc(x.id)}" title="Xóa hoặc chấm dứt hợp đồng an toàn" aria-label="Xóa hoặc chấm dứt hợp đồng"><svg aria-hidden="true"><use href="#i-trash"/></svg></button></td></tr>`).join('')||'<tr><td colspan="7" class="empty-state">Chưa có hợp đồng khách hàng.</td></tr>'}</tbody></table></div></div>
    <div class="card card-pad commercial-aging-card"><div class="section-header"><div><h2>Tuổi nợ phải thu</h2><p>Số dư theo hóa đơn, không chỉ theo tổng TK 131</p></div></div><div class="aging-grid">${['Current','1-30','31-60','61-90','90+'].map(k=>`<div><span>${k==='Current'?'Chưa đến hạn':k+' ngày'}</span><strong>${compactMoney(aging.totals.buckets[k]||0)}</strong></div>`).join('')}</div><div class="algorithm-note"><strong>Nguồn:</strong> hóa đơn đầu ra − phân bổ thanh toán. Hóa đơn không có hạn thanh toán được mặc định 30 ngày và được cảnh báo để hoàn thiện dữ liệu.</div></div></div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Hóa đơn & phân bổ thu tiền</h2><p>Công nợ phải thu được tính theo từng hóa đơn và số tiền đã phân bổ, không suy diễn từ tổng TK 131.</p></div><button class="section-link" data-secondary-add="paymentAllocations">+ Phân bổ thu</button></div><div class="table-wrap"><table><thead><tr><th>Hóa đơn</th><th>Dự án / Hợp đồng</th><th>Hạn</th><th class="numeric">Giá trị</th><th class="numeric">Đã thu</th><th class="numeric">Còn phải thu</th><th>Tuổi nợ</th></tr></thead><tbody>${filterRowsForView(aging.rows,'commercial').map(x=>{const contract=db.contracts.find(c=>c.id===x.contractId);return `<tr><td><strong>${esc(x.serial||'')} ${esc(x.invoiceNo||'')}</strong><div class="muted">${fmtDate(x.date)}</div></td><td>${esc(projectName(x.projectId))}<div class="muted">${esc(contract?.contractNo||'Chưa gắn hợp đồng')}</div></td><td>${fmtDate(x.dueDate)}</td><td class="numeric">${fmtMoney(x.original)}</td><td class="numeric">${fmtMoney(x.allocated)}</td><td class="numeric ${x.outstanding>0?'cell-warning':''}">${fmtMoney(x.outstanding)}</td><td>${badge(x.bucket)}</td></tr>`}).join('')}</tbody></table></div></div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Lịch thanh toán hợp đồng</h2><p>Dự án được tự động kế thừa từ hợp đồng để tránh liên kết sai.</p></div><button class="section-link" data-secondary-add="billingMilestones">+ Đợt thanh toán</button></div><div class="table-wrap"><table class="table-fit-wide table-billing-milestones"><thead><tr><th>Hợp đồng / Đợt</th><th>Dự án</th><th class="numeric">Tỷ lệ</th><th class="numeric">Giá trị</th><th>Hạn</th><th>Nghiệm thu</th><th>Hóa đơn</th><th>Thanh toán</th><th>Thao tác</th></tr></thead><tbody>${milestoneRows.map(x=>{const c=db.contracts.find(c=>c.id===x.contractId);return `<tr><td><strong>${esc(c?.contractNo||'—')}</strong><div class="muted">Đợt ${x.milestoneNo||'—'} • ${esc(x.name)}</div></td><td>${esc(projectName(x.projectId))}</td><td class="numeric">${fmtNum(x.percentage,2)}%</td><td class="numeric">${fmtMoney(x.amountExclVat)}</td><td>${fmtDate(x.dueDate)}</td><td>${badge(x.acceptanceStatus)}</td><td>${badge(x.invoiceStatus)}</td><td>${badge(x.paymentStatus)}</td><td class="actions"><button class="icon-btn edit-row" data-write-action data-type="billingMilestones" data-id="${esc(x.id)}" title="Chỉnh sửa đợt thanh toán" aria-label="Chỉnh sửa đợt thanh toán"><span class="legacy-edit-glyph" aria-hidden="true">✎</span></button></td></tr>`}).join('')}</tbody></table></div></div>`;
  }

  function renderPlanning(){
    const portfolio=Calc.portfolioHealth(db,currentRange());
    const committedProjectIds=new Set(portfolio.contractedRows.map(row=>String(row.project.id)));
    const pipelineRows=portfolio.rows.filter(row=>row.lifecycle==='pipeline');
    const pipelineBudget=pipelineRows.reduce((sum,row)=>sum+Number(row.directBudget||0),0);
    const committedPlans=db.resourcePlans.filter(x=>committedProjectIds.has(String(x.projectId)));
    const planCost=committedPlans.reduce((sum,x)=>sum+Number(x.plannedHours||0)*Number(x.costRate||0),0);
    const committed=db.commitments.filter(x=>committedProjectIds.has(String(x.projectId))).reduce((sum,x)=>sum+Math.max(0,Number(x.amount||0)-Number(x.recognizedAmount||0)),0);
    return `<div class="modern-hero planning-hero"><div><span class="eyebrow">PLANNING & COST CONTROL</span><h2>Ngân sách được duyệt, kế hoạch nguồn lực và chi phí cam kết</h2><p>Ngân sách dự án đã ký và ngân sách dự kiến được tách riêng. Chi phí ước tính khi hoàn thành chỉ tổng hợp các dự án đã có hợp đồng hợp lệ.</p></div><div class="hero-metric"><span>Chi phí ước tính khi hoàn thành của dự án đã ký</span><strong>${compactMoney(portfolio.estimateAtCompletion)}</strong></div></div>
    <div class="grid dashboard-kpi-grid section compact-kpi-row planning-kpi-row">
      ${kpi('Ngân sách dự án đã ký',compactMoney(portfolio.directBudget),`${portfolio.activeProjectCount} dự án có hợp đồng hợp lệ`,true,{icon:'◇',color:'blue',unit:'VND'})}
      ${kpi('Ngân sách dự kiến',compactMoney(pipelineBudget),`${pipelineRows.length} dự án chưa ký — không cộng vào chi phí ước tính khi hoàn thành`,true,{icon:'◎',color:'teal',unit:'VND'})}
      ${kpi('Kế hoạch nhân sự đã ký',compactMoney(planCost),`${fmtNum(committedPlans.reduce((sum,x)=>sum+Number(x.plannedHours||0),0),0)} giờ kế hoạch`,true,{icon:'◷',color:'purple',unit:'VND'})}
      ${kpi('Chi phí cam kết còn lại',compactMoney(committed),'Chỉ các dự án đã ký, chưa vào actual cost',committed<=portfolio.directBudget,{icon:'⌁',color:'orange',unit:'VND'})}
      ${kpi('Variance at Completion',compactMoney(portfolio.budgetVariance),portfolio.budgetVariance>=0?'Dư ngân sách dự báo':'Vượt ngân sách dự báo',portfolio.budgetVariance>=0,{icon:'↗',color:portfolio.budgetVariance>=0?'green':'red',unit:'VND'})}
    </div>
    <div class="planning-table-stack section"><div class="card table-card planning-budget-card"><div class="section-header card-pad"><div><h2>Ngân sách cơ sở</h2><p>Phiên bản được duyệt là nguồn ngân sách duy nhất cho chi phí ước tính khi hoàn thành</p></div><button class="section-link" data-secondary-add="projectBudgetVersions">+ Phiên bản</button></div><div class="table-wrap"><table class="table-fit-wide table-planning-budget"><thead><tr><th>Dự án / Phiên bản</th><th>Phạm vi</th><th>Trạng thái</th><th class="numeric">Ngân sách trực tiếp</th><th class="numeric">Dự phòng</th><th class="numeric">Biên lợi nhuận mục tiêu</th><th></th></tr></thead><tbody>${db.projectBudgetVersions.map(x=>{const lifecycle=portfolio.rows.find(row=>String(row.project.id)===String(x.projectId))?.lifecycle||'unlinked';return `<tr><td><strong>${esc(projectName(x.projectId))}</strong><div class="muted">${esc(x.versionName)} • phiên bản ${x.versionNo}</div></td><td>${badge(lifecycle==='contracted'?'Đã ký':lifecycle==='pipeline'?'Dự kiến':'Chưa liên kết')}</td><td>${badge(x.status)}</td><td class="numeric">${fmtMoney(x.directBudget)}</td><td class="numeric">${fmtMoney(x.contingency)}</td><td class="numeric">${fmtNum(x.targetMarginPercent,1)}%</td><td class="actions"><button class="icon-btn edit-row" data-type="projectBudgetVersions" data-id="${esc(x.id)}">✎</button></td></tr>`}).join('')}</tbody></table></div></div>
    <div class="card table-card planning-resource-card"><div class="section-header card-pad"><div><h2>Kế hoạch nguồn lực</h2><p>Remaining hours × approved cost rate</p></div><button class="section-link" data-secondary-add="resourcePlans">+ Kế hoạch</button></div><div class="table-tools" data-local-table-filter="resourcePlansTable"><input class="search-input" data-filter-search type="search" aria-label="Tìm kế hoạch nguồn lực" placeholder="Tìm tháng, dự án, nhân sự..."><select class="filter-select" data-filter-text aria-label="Lọc kế hoạch nguồn lực theo dự án"><option value="">Tất cả dự án</option>${[...new Set(db.resourcePlans.map(x=>projectName(x.projectId)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')).map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select><span class="table-count-badge" data-filter-count></span></div><div id="resourcePlansTable" class="table-wrap"><table class="table-fit-wide table-planning-resource"><thead><tr><th>Tháng</th><th>Dự án</th><th>Nhân sự</th><th class="numeric">Giờ KH</th><th class="numeric">Cost rate</th><th class="numeric">Giá trị KH</th><th></th></tr></thead><tbody>${db.resourcePlans.slice().sort((a,b)=>a.month.localeCompare(b.month)).map(x=>`<tr><td><strong>${esc(x.month)}</strong></td><td>${esc(projectName(x.projectId))}</td><td>${esc(personName(x.personId))}</td><td class="numeric">${fmtNum(x.plannedHours,1)}</td><td class="numeric">${fmtMoney(x.costRate)}</td><td class="numeric">${fmtMoney(Number(x.plannedHours||0)*Number(x.costRate||0))}</td><td class="actions"><button class="icon-btn edit-row" data-type="resourcePlans" data-id="${esc(x.id)}">✎</button></td></tr>`).join('')}</tbody></table></div></div></div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Chi phí cam kết</h2><p>Approved commitment chưa ghi nhận được đưa vào Cost to Complete</p></div><button class="section-link" data-secondary-add="commitments">+ Cam kết</button></div><div class="table-wrap"><table class="table-fit-wide table-planning-commitments"><thead><tr><th>Dự án</th><th>Nội dung</th><th>Loại</th><th class="numeric">Cam kết</th><th class="numeric">Đã ghi nhận</th><th class="numeric">Còn lại</th><th>Hạn</th><th></th></tr></thead><tbody>${db.commitments.map(x=>`<tr><td>${esc(projectName(x.projectId))}</td><td><strong>${esc(x.description)}</strong></td><td>${esc(x.type)}</td><td class="numeric">${fmtMoney(x.amount)}</td><td class="numeric">${fmtMoney(x.recognizedAmount)}</td><td class="numeric">${fmtMoney(Math.max(0,Number(x.amount||0)-Number(x.recognizedAmount||0)))}</td><td>${fmtDate(x.dueDate)}</td><td class="actions"><button class="icon-btn edit-row" data-type="commitments" data-id="${esc(x.id)}">✎</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function renderControlTabs(){
    const tabs=[['actual','Thực tế & dự báo'],['commercial','Thương mại'],['cash','Dòng tiền'],['quality','Chất lượng dữ liệu']];
    return `<div class="metric-switch section" role="tablist" aria-label="Các lớp kiểm soát vận hành">${tabs.map(([id,label])=>`<button type="button" id="control-tab-${id}" class="${currentControlTab===id?'active':''}" data-control-tab="${id}" role="tab" aria-selected="${currentControlTab===id?'true':'false'}" aria-controls="control-panel-${id}">${label}</button>`).join('')}</div>`;
  }

  function controlConfidenceLabel(value){
    return ({High:'Cao',Medium:'Trung bình',Low:'Thấp'})[String(value)]||String(value||'');
  }

  function controlEstimateMethodLabel(value){
    return ({
      'Completion actual + open commitments':'Chi phí thực tế khi hoàn thành + cam kết còn mở',
      'Coverage-qualified approved plan':'Kế hoạch được duyệt đủ độ bao phủ',
      'Hybrid conservative forecast':'Dự báo kết hợp theo nguyên tắc thận trọng'
    })[String(value)]||String(value||'');
  }

  function controlDisplayText(value){
    return String(value||'')
      .replace(/\bCPI\b/g,'chỉ số hiệu quả chi phí')
      .replace(/\bSPI\b/g,'chỉ số hiệu quả tiến độ')
      .replace(/\bEAC\b/g,'chi phí ước tính khi hoàn thành')
      .replace(/\bAR\b/g,'công nợ phải thu')
      .replace(/\bActual Cost\b/g,'chi phí thực tế')
      .replace(/\bContract Value\b/g,'giá trị hợp đồng');
  }

  function renderControlActual(portfolio,target){
    const controlRows=filterRowsForView(portfolio.rows,'controls');
    const ratio=(v)=>v===null||!Number.isFinite(Number(v))?'—':fmtNum(v,2);
    const health=(row)=>!row.valid?'danger':row.warnings.length?'warning':'success';
    const score=(row)=>row.valid&&row.warnings.length===0?'Ổn định':!row.valid?'Lỗi dữ liệu':'Cần xử lý';
    return `<div id="control-panel-actual" data-control-panel="actual" role="tabpanel" aria-labelledby="control-tab-actual">
    <div class="grid dashboard-kpi-grid section compact-kpi-row control-kpi-row">
      ${kpi('Doanh thu ghi nhận',compactMoney(portfolio.recognizedRevenue),`Biên lợi nhuận thực tế ${fmtNum(portfolio.actualMargin,1)}%`,portfolio.actualProfit>=0,{icon:'▤',color:'blue',unit:'VND'})}
      ${kpi('Chi phí thực tế',compactMoney(portfolio.actualCost),'Chi phí đã ghi sổ + nhân công chưa ghi sổ, không cộng trùng',portfolio.actualCost<=portfolio.directBudget,{icon:'₫',color:'orange',unit:'VND'})}
      ${kpi('Chi phí ước tính khi hoàn thành toàn danh mục',compactMoney(portfolio.estimateAtCompletion),'Kết hợp ngân sách cơ sở, độ bao phủ kế hoạch và các chỉ số hiệu quả',portfolio.estimateAtCompletion<=portfolio.directBudget,{icon:'◷',color:'purple',unit:'VND'})}
      ${kpi('Đóng góp dự án dự báo',compactMoney(portfolio.forecastProfit),`${fmtNum(portfolio.forecastMargin,1)}% • Giá trị hợp đồng − chi phí ước tính khi hoàn thành`,portfolio.forecastMargin>=target,{icon:'↗',color:'green',unit:'VND'})}
      ${kpi('Giá trị công việc chưa xuất hóa đơn',compactMoney(portfolio.backlog),'Giá trị hợp đồng − giá trị hóa đơn chưa thuế',portfolio.backlog>=0,{icon:'▣',color:'teal',unit:'VND'})}
      ${kpi('Phải thu hóa đơn',compactMoney(portfolio.receivable),`${fmtNum(portfolio.invoiceCollectionRate,1)}% đã thu trên hóa đơn`,portfolio.receivable===0,{icon:'!',color:'red',unit:'VND'})}
    </div>
    <div class="grid three-col section"><div class="card bridge-card"><span>Giá trị hợp đồng</span><strong>${compactMoney(portfolio.contractValue)}</strong><i>→</i><span>Giá trị hóa đơn chưa thuế</span><strong>${compactMoney(portfolio.invoicedNet)}</strong><i>→</i><span>Khoản thu đã phân bổ theo hóa đơn</span><strong>${compactMoney(portfolio.collected)}</strong></div><div class="card bridge-card"><span>Doanh thu ghi nhận</span><strong>${compactMoney(portfolio.recognizedRevenue)}</strong><i>−</i><span>Chi phí thực tế</span><strong>${compactMoney(portfolio.actualCost)}</strong><i>=</i><span>Lợi nhuận thực tế</span><strong class="${portfolio.actualProfit>=0?'good-text':'bad-text'}">${compactMoney(portfolio.actualProfit)}</strong></div><div class="card bridge-card"><span>Ngân sách trực tiếp</span><strong>${compactMoney(portfolio.directBudget)}</strong><i>−</i><span>Chi phí ước tính khi hoàn thành</span><strong>${compactMoney(portfolio.estimateAtCompletion)}</strong><i>=</i><span>Chênh lệch ngân sách khi hoàn thành</span><strong class="${portfolio.budgetVariance>=0?'good-text':'bad-text'}">${compactMoney(portfolio.budgetVariance)}</strong></div></div>
    <div class="card table-card section control-project-table-card"><div class="section-header card-pad"><div><h2>Bảng kiểm soát dự án</h2><p>Biên lợi nhuận dự án thực tế và dự báo là biên đóng góp trước chi phí chung và thuế; công nợ phải thu và giá trị công việc chưa xuất hóa đơn được trình bày riêng.</p></div><button class="section-link" data-go="planning">Mở ngân sách & nguồn lực →</button></div><div class="table-tools" data-local-table-filter="controlProjectTable"><input class="search-input" data-filter-search type="search" aria-label="Tìm dự án kiểm soát" placeholder="Tìm mã, tên dự án, khách hàng, cảnh báo..."><select class="filter-select" data-filter-text aria-label="Lọc độ tin cậy của chi phí ước tính khi hoàn thành"><option value="">Tất cả độ tin cậy</option><option value="High">Cao</option><option value="Medium">Trung bình</option><option value="Low">Thấp</option></select><span class="table-count-badge" data-filter-count></span></div><div id="controlProjectTable" class="table-wrap"><table class="control-table-v35 table-fit-desktop table-controls"><thead><tr><th>Dự án</th><th>Tiến độ</th><th class="numeric">Giá trị hợp đồng</th><th class="numeric">Đã xuất hóa đơn</th><th class="numeric">Công nợ phải thu</th><th class="numeric">Chi phí thực tế</th><th class="numeric">Chi phí ước tính khi hoàn thành</th><th class="numeric">Chỉ số hiệu quả chi phí / Chỉ số hiệu quả tiến độ</th><th class="numeric">Biên lợi nhuận dự án thực tế</th><th class="numeric">Biên lợi nhuận dự án dự báo</th><th>Độ tin cậy</th><th>Kiểm soát</th></tr></thead><tbody>${controlRows.map(row=>`<tr><td><strong>${esc(row.project.code)} — ${esc(row.project.name)}</strong><div class="muted">${esc(clientName(row.project.clientId))}</div></td><td><div class="progress"><span style="width:${Math.max(0,Math.min(100,Number(row.progress)||0))}%"></span></div><small>${fmtNum(row.progress,1)}% • kế hoạch ${fmtNum(row.scheduleProgress,1)}%</small></td><td class="numeric">${row.lifecycle==='pipeline'?`<span class="muted">Dự kiến ${compactMoney(row.pipelineValue)}</span>`:compactMoney(row.contractValue)}</td><td class="numeric">${compactMoney(row.invoicedNet)}</td><td class="numeric ${row.receivable>0?'cell-warning':''}">${compactMoney(row.receivable)}</td><td class="numeric">${compactMoney(row.actualCost)}</td><td class="numeric ${row.estimateAtCompletion>row.directBudget?'cell-danger':''}">${compactMoney(row.estimateAtCompletion)}<div class="muted">${esc(controlEstimateMethodLabel(row.eacMethod))} • độ bao phủ ${fmtNum((row.planCoverage||0)*100,0)}%</div></td><td class="numeric"><strong>${ratio(row.cpi)} / ${ratio(row.spi)}</strong></td><td class="numeric ${row.actualMargin<0?'cell-danger':''}">${fmtNum(row.actualMargin,1)}%</td><td class="numeric ${row.forecastMargin<target?'cell-danger':''}">${fmtNum(row.forecastMargin,1)}%</td><td><span class="confidence ${esc(String(row.eacConfidence).toLowerCase())}">${esc(controlConfidenceLabel(row.eacConfidence))}</span></td><td><span class="badge ${health(row)}">${score(row)}</span>${row.warnings.slice(0,2).map(x=>`<div class="control-warning">${esc(controlDisplayText(x))}</div>`).join('')}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="grid two-col section"><div class="card card-pad"><div class="section-header"><div><h2>Thuật toán kiểm soát thông minh</h2><p>Công thức có nguồn dữ liệu và phương án dự phòng rõ ràng</p></div></div><div class="formula-list"><div><strong>Giá trị hợp đồng</strong><span>Chỉ hợp đồng Signed/Active/Effective; Draft và Proposal được tách sang danh mục dự kiến.</span></div><div><strong>Chi phí thực tế</strong><span>Chi phí trực tiếp đã ghi sổ + nhân công được duyệt chưa ghi sổ + chi trực tiếp đã thanh toán chưa liên kết sổ cái; có kiểm tra chống cộng trùng.</span></div><div><strong>Chi phí ước tính khi hoàn thành</strong><span>Nếu kế hoạch còn lại bao phủ dưới 90%, chi phí ước tính không được thấp hơn ngân sách cơ sở và được đối chiếu với các chỉ số hiệu quả chi phí, tiến độ.</span></div><div><strong>Độ bao phủ kế hoạch</strong><span>(Kế hoạch nguồn lực còn lại + cam kết còn mở + rủi ro) ÷ phần ngân sách chưa sử dụng.</span></div><div><strong>Biên lợi nhuận dự báo</strong><span>(Giá trị hợp đồng đã cam kết − chi phí ước tính khi hoàn thành) ÷ giá trị hợp đồng đã cam kết.</span></div></div></div><div class="card card-pad"><div class="section-header"><div><h2>Chỉ tiêu thương mại & tiền</h2><p>Không gộp các khái niệm khác nhau</p></div></div><div class="formula-list"><div><strong>Giá trị công việc chưa xuất hóa đơn</strong><span>Giá trị hợp đồng − giá trị hóa đơn chưa thuế.</span></div><div><strong>Công nợ phải thu</strong><span>Tổng giá trị hóa đơn − khoản thu đã phân bổ theo từng hóa đơn.</span></div><div><strong>Tỷ lệ thu hóa đơn</strong><span>Chỉ tiền đã phân bổ hóa đơn ÷ tổng giá trị hóa đơn; tiền chưa phân bổ không làm tăng tỷ lệ thu thương mại.</span></div><div><strong>Dòng tiền dự án thuần</strong><span>Tiền đã thu − tiền đã chi theo dự án.</span></div><div><strong>Doanh thu dồn tích chưa xuất hóa đơn</strong><span>Doanh thu dồn tích theo tiến độ thực tế − giá trị hóa đơn chưa thuế.</span></div></div></div></div></div>`;
  }

  function renderControlCommercial(portfolio,range){
    const aging=Calc.invoiceAging(db,{direction:'Output',to:range.to,asOf:range.to||today()});
    const contracted=portfolio.contractedRows;
    return `<div id="control-panel-commercial" data-control-panel="commercial" role="tabpanel" aria-labelledby="control-tab-commercial">
    <div class="grid dashboard-kpi-grid section compact-kpi-row control-kpi-row">
      ${kpi('Hợp đồng đã ký',compactMoney(portfolio.contractValue),`${portfolio.activeProjectCount} dự án đã ký`,true,{icon:'▣',color:'blue',unit:'VND'})}
      ${kpi('Pipeline',compactMoney(portfolio.pipelineValue),`${portfolio.pipelineCount} cơ hội chưa cam kết`,true,{icon:'◎',color:'purple',unit:'VND'})}
      ${kpi('Đã xuất hóa đơn',compactMoney(portfolio.invoicedNet),`${fmtNum(portfolio.contractValue?portfolio.invoicedNet/portfolio.contractValue*100:0,1)}% hợp đồng`,true,{icon:'▤',color:'teal',unit:'VND'})}
      ${kpi('Backlog',compactMoney(portfolio.backlog),'Hợp đồng − hóa đơn chưa VAT',portfolio.backlog>=0,{icon:'↗',color:'orange',unit:'VND'})}
      ${kpi('Phải thu hóa đơn',compactMoney(portfolio.receivable),`${fmtNum(portfolio.invoiceCollectionRate,1)}% đã phân bổ thu`,portfolio.receivable===0,{icon:'!',color:'red',unit:'VND'})}
      ${kpi('Thu đã phân bổ',compactMoney(portfolio.collected),`${aging.rows.length} hóa đơn đang theo dõi`,true,{icon:'✓',color:'green',unit:'VND'})}
    </div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Chuỗi hợp đồng → hóa đơn → công nợ</h2><p>Pipeline không được cộng vào hợp đồng; phải thu chỉ giảm bằng khoản thu đã phân bổ tới hóa đơn.</p></div><button class="section-link" data-go="commercial">Mở phân hệ Hợp đồng & Công nợ →</button></div><div class="table-wrap"><table class="table-control-commercial table-fit-desktop"><thead><tr><th>Dự án</th><th>Trạng thái nguồn</th><th class="numeric">Giá trị hợp đồng</th><th class="numeric">Đã xuất hóa đơn</th><th class="numeric">Backlog</th><th class="numeric">Phải thu gộp</th><th class="numeric">Tỷ lệ thu</th><th>Cảnh báo</th></tr></thead><tbody>${portfolio.rows.map(row=>`<tr><td><strong>${esc(row.project.code)} — ${esc(row.project.name)}</strong></td><td>${row.lifecycle==='pipeline'?'<span class="badge warning">Pipeline</span>':'<span class="badge success">Committed</span>'}</td><td class="numeric">${fmtMoney(row.lifecycle==='pipeline'?row.pipelineValue:row.contractValue)}</td><td class="numeric">${fmtMoney(row.invoicedNet)}</td><td class="numeric">${fmtMoney(row.backlog)}</td><td class="numeric ${row.receivable>0?'cell-warning':''}">${fmtMoney(row.receivable)}</td><td class="numeric">${fmtNum(row.invoiceCollectionRate,1)}%</td><td>${row.lifecycle==='pipeline'?'Chưa ghi nhận vào hợp đồng đã ký':row.invoicedNet>row.contractValue?'Hóa đơn vượt hợp đồng':row.receivable>0?'Còn công nợ cần thu':'Đã thu đủ hóa đơn'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="grid two-col section"><div class="card card-pad"><div class="section-header"><div><h2>Tuổi nợ phải thu</h2><p>Theo hạn của từng hóa đơn</p></div></div><div class="aging-grid">${['Current','1-30','31-60','61-90','90+'].map(k=>`<div><span>${k==='Current'?'Chưa đến hạn':k+' ngày'}</span><strong>${compactMoney(aging.totals.buckets[k]||0)}</strong></div>`).join('')}</div></div><div class="card card-pad"><div class="section-header"><div><h2>Kiểm soát thương mại</h2><p>Quy tắc bắt buộc</p></div></div><div class="formula-list"><div><strong>Giá trị hợp đồng</strong><span>Chỉ nhận trạng thái cam kết hợp lệ.</span></div><div><strong>Danh mục dự kiến</strong><span>Tách riêng, không làm tăng sai giá trị công việc chưa xuất hóa đơn hoặc dự báo.</span></div><div><strong>Công nợ phải thu</strong><span>Tổng giá trị hóa đơn trừ khoản thu đã phân bổ theo hóa đơn.</span></div><div><strong>Giá trị công việc chưa xuất hóa đơn</strong><span>Không được dùng thay cho khoản phải thu.</span></div></div></div></div></div>`;
  }

  function renderControlCash(portfolio,range){
    const unapplied=portfolio.contractedRows.reduce((sum,row)=>sum+Number(row.unappliedCashGross||0),0);
    const periodCash=Calc.cashFlow(db,range);
    return `<div id="control-panel-cash" data-control-panel="cash" role="tabpanel" aria-labelledby="control-tab-cash">
    <div class="grid dashboard-kpi-grid section compact-kpi-row control-kpi-row">
      ${kpi('Tiền thu theo dự án',compactMoney(portfolio.cashReceivedGross),'Chỉ giao dịch Income đã Paid',true,{icon:'↓',color:'green',unit:'VND'})}
      ${kpi('Tiền chi theo dự án',compactMoney(portfolio.cashPaid),'Chỉ giao dịch Expense đã Paid',portfolio.cashPaid<=portfolio.cashReceivedGross,{icon:'↑',color:'orange',unit:'VND'})}
      ${kpi('Dòng tiền dự án thuần',compactMoney(portfolio.netProjectCash),'Cash received − cash paid',portfolio.netProjectCash>=0,{icon:'↕',color:'teal',unit:'VND'})}
      ${kpi('Tiền chưa phân bổ HĐ',compactMoney(unapplied),'Không tự động làm giảm công nợ',unapplied===0,{icon:'!',color:'red',unit:'VND'})}
      ${kpi('Tổng thu trong kỳ',compactMoney(periodCash.cashIn),'Toàn công ty theo bộ lọc ngày',true,{icon:'▤',color:'blue',unit:'VND'})}
      ${kpi('Dòng tiền thuần kỳ',compactMoney(periodCash.net),'Toàn công ty, không chỉ dự án',periodCash.net>=0,{icon:'◇',color:'purple',unit:'VND'})}
    </div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Dòng tiền theo dự án</h2><p>Tiền thu, tiền chi và khoản thu chưa phân bổ được trình bày độc lập với doanh thu và công nợ.</p></div><button class="section-link" data-go="finance">Mở phân hệ Dòng tiền →</button></div><div class="table-wrap"><table><thead><tr><th>Dự án</th><th class="numeric">Tiền đã thu</th><th class="numeric">Khoản thu đã phân bổ theo hóa đơn</th><th class="numeric">Tiền thu chưa phân bổ</th><th class="numeric">Tiền đã chi</th><th class="numeric">Dòng tiền thuần</th><th>Kiểm soát</th></tr></thead><tbody>${portfolio.contractedRows.map(row=>`<tr><td><strong>${esc(row.project.code)} — ${esc(row.project.name)}</strong></td><td class="numeric">${fmtMoney(row.cashReceivedGross)}</td><td class="numeric">${fmtMoney(row.allocatedGross)}</td><td class="numeric ${row.unappliedCashGross>0?'cell-warning':''}">${fmtMoney(row.unappliedCashGross)}</td><td class="numeric">${fmtMoney(row.cashPaid)}</td><td class="numeric ${row.netProjectCash<0?'cell-danger':''}">${fmtMoney(row.netProjectCash)}</td><td>${row.unappliedCashGross>0?'Cần phân bổ thu tới hóa đơn':row.netProjectCash<0?'Dòng tiền dự án âm':'Dòng tiền đã đối chiếu'}</td></tr>`).join('')||'<tr><td colspan="7" class="empty-state">Chưa có dự án có hợp đồng đã ký.</td></tr>'}</tbody></table></div></div>
    <div class="grid two-col section"><div class="card card-pad"><div class="section-header"><div><h2>Nguyên tắc dòng tiền</h2><p>Không thay thế số liệu kế toán dồn tích</p></div></div><div class="formula-list"><div><strong>Tiền đã thu</strong><span>Giao dịch tiền đã thanh toán theo dự án.</span></div><div><strong>Khoản thu đã phân bổ theo hóa đơn</strong><span>Phần tiền đã đối chiếu tới hóa đơn cụ thể.</span></div><div><strong>Tiền thu chưa phân bổ</strong><span>Tiền đã nhận nhưng chưa đủ căn cứ làm giảm công nợ phải thu.</span></div><div><strong>Dòng tiền dự án thuần</strong><span>Tổng tiền đã thu − tiền đã chi.</span></div></div></div><div class="card card-pad"><div class="section-header"><div><h2>Cảnh báo dòng tiền</h2><p>Ưu tiên xử lý</p></div></div><div class="formula-list"><div><strong>${portfolio.contractedRows.filter(x=>x.netProjectCash<0).length} dự án</strong><span>Đang có dòng tiền thuần âm.</span></div><div><strong>${portfolio.contractedRows.filter(x=>x.unappliedCashGross>0).length} dự án</strong><span>Còn khoản thu chưa phân bổ hóa đơn.</span></div><div><strong>${compactMoney(portfolio.receivable)}</strong><span>Công nợ hóa đơn chưa thu tại ngày chốt.</span></div></div></div></div></div>`;
  }

  function renderControlQuality(portfolio,range){
    const report=Calc.integrityChecks(db,range);
    const failedCritical=report.checks.filter(x=>!x.pass&&x.severity==='critical');
    const failedWarnings=report.checks.filter(x=>!x.pass&&x.severity!=='critical');
    const passed=report.checks.filter(x=>x.pass).length;
    return `<div id="control-panel-quality" data-control-panel="quality" role="tabpanel" aria-labelledby="control-tab-quality">
    <div class="grid dashboard-kpi-grid section compact-kpi-row control-kpi-row">
      ${kpi('Điểm chất lượng dữ liệu',`${report.score}/100`,report.passCritical?'Đạt cổng lỗi nghiêm trọng':'Chưa đạt cổng lỗi nghiêm trọng',report.passCritical,{icon:'✓',color:report.passCritical?'green':'red'})}
      ${kpi('Kiểm tra đạt',fmtNum(passed,0),`Trên tổng ${report.checks.length} phép kiểm tra`,true,{icon:'▤',color:'blue'})}
      ${kpi('Lỗi nghiêm trọng',fmtNum(failedCritical.length,0),'Phải xử lý trước khi khóa số liệu',failedCritical.length===0,{icon:'!',color:'red'})}
      ${kpi('Cảnh báo',fmtNum(failedWarnings.length,0),'Không chặn nhưng làm giảm độ tin cậy',failedWarnings.length===0,{icon:'◇',color:'orange'})}
      ${kpi('Chi phí hoàn thành có độ tin cậy cao',`${portfolio.highConfidence}/${portfolio.activeProjectCount}`,'Có ngân sách cơ sở, tiến độ và kế hoạch đầy đủ',portfolio.highConfidence===portfolio.activeProjectCount,{icon:'◷',color:'purple'})}
      ${kpi('Dự án cần xử lý',fmtNum(portfolio.atRisk,0),'Có lỗi hoặc cảnh báo kiểm soát',portfolio.atRisk===0,{icon:'⌁',color:'teal'})}
    </div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Bộ kiểm tra chất lượng dữ liệu</h2><p>Mỗi phép kiểm tra có trạng thái, mức độ và mô tả nguyên nhân.</p></div><button class="section-link" id="exportIntegrity">Xuất báo cáo kiểm tra →</button></div><div class="table-wrap"><table><thead><tr><th>Mã kiểm tra</th><th>Trạng thái</th><th>Mức độ</th><th>Nội dung</th><th>Chi tiết</th><th class="numeric">Số lỗi</th></tr></thead><tbody>${report.checks.map(x=>`<tr><td><strong>${esc(x.code)}</strong></td><td>${x.pass?'<span class="badge success">Đạt</span>':'<span class="badge danger">Không đạt</span>'}</td><td>${x.severity==='critical'?'<span class="badge danger">Nghiêm trọng</span>':'<span class="badge warning">Cảnh báo</span>'}</td><td><strong>${esc(controlDisplayText(x.title))}</strong></td><td>${esc(controlDisplayText(x.detail))}</td><td class="numeric">${fmtNum(x.count||0,0)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Chất lượng dự báo theo dự án</h2><p>Độ tin cậy của chi phí ước tính khi hoàn thành và các cảnh báo tác động trực tiếp tới quyết định quản trị.</p></div></div><div class="table-wrap"><table><thead><tr><th>Dự án</th><th>Độ tin cậy của chi phí ước tính khi hoàn thành</th><th class="numeric">Độ bao phủ kế hoạch</th><th>Nguồn tiến độ</th><th>Cảnh báo chính</th></tr></thead><tbody>${portfolio.rows.map(row=>`<tr><td><strong>${esc(row.project.code)} — ${esc(row.project.name)}</strong></td><td><span class="confidence ${esc(String(row.eacConfidence).toLowerCase())}">${esc(controlConfidenceLabel(row.eacConfidence))}</span></td><td class="numeric">${fmtNum((row.planCoverage||0)*100,0)}%</td><td>${esc(row.progressSource)}</td><td>${row.warnings.length?row.warnings.slice(0,3).map(x=>`<div class="control-warning">${esc(controlDisplayText(x))}</div>`).join(''):'<span class="good-text">Không có cảnh báo trọng yếu</span>'}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  }

  function renderControls(){
    const range=currentRange(), portfolio=Calc.portfolioHealth(db,range), target=Number(db.settings?.targetMargin||30);
    const highConfidence=portfolio.highConfidence;
    const panel={
      actual:()=>renderControlActual(portfolio,target),
      commercial:()=>renderControlCommercial(portfolio,range),
      cash:()=>renderControlCash(portfolio,range),
      quality:()=>renderControlQuality(portfolio,range)
    }[currentControlTab]||(()=>renderControlActual(portfolio,target));
    return `<div class="modern-hero control-hero-v35"><div><span class="eyebrow">HỆ THỐNG KIỂM SOÁT THÔNG MINH</span><h2>Một dự án, bốn lớp số liệu không trộn lẫn</h2><p><b>Hợp đồng</b> để đo giá trị công việc chưa xuất hóa đơn và dự báo; <b>hóa đơn</b> để đo phải thu; <b>sổ cái đã ghi sổ</b> để đo thực tế; <b>tiền đã thanh toán</b> để đo dòng tiền. Bốn thẻ bên dưới là bốn góc nhìn độc lập trên cùng dữ liệu nguồn.</p></div><div class="hero-metric"><span>Chi phí hoàn thành có độ tin cậy cao</span><strong>${highConfidence}/${portfolio.activeProjectCount}</strong></div></div>${renderControlTabs()}${panel()}`;
  }

  function financialTabs(){
    const tabs=[['overview','Tổng quan tài chính'],['ratios','Hệ số tài chính'],['forecast','Dự báo & Kịch bản'],['links','Liên kết dữ liệu']];
    return `<div class="metric-switch section" role="tablist" aria-label="Phân tích và dự báo tài chính">${tabs.map(([id,label])=>`<button type="button" class="${currentFinancialTab===id?'active':''}" data-financial-tab="${id}" role="tab" aria-selected="${currentFinancialTab===id?'true':'false'}">${label}</button>`).join('')}</div>`;
  }
  function ratioDisplay(metric){
    if(metric.value===null||!Number.isFinite(Number(metric.value)))return 'N/A';
    return `${fmtNum(metric.value,metric.unit==='ngày'?0:2)}${metric.unit==='%'?'%':metric.unit==='ngày'?' ngày':metric.unit==='lần'?' lần':metric.unit==='vòng'?' vòng':''}`;
  }
  function ratioBadge(metric){const map={good:['success','Tốt'],watch:['warning','Cần theo dõi'],risk:['danger','Rủi ro'],na:['neutral','Chưa đủ dữ liệu'],neutral:['info','Tham khảo']};const x=map[metric.assessment]||map.neutral;return `<span class="badge ${x[0]}">${x[1]}</span>`;}
  function renderFinancialOverview(){
    const range=currentRange(),analysis=Calc.financialRatios(db,range),p=analysis.end,pnl=analysis.pnl,cf=Calc.cashFlow(db,range),audit=Calc.financialLinkAudit(db,range);
    const keyRatios=['currentRatio','debtToAssets','netMargin','roa','roe','dso'].map((id)=>analysis.metrics.find((x)=>x.id===id)).filter(Boolean);
    const assets=[{name:'Tiền',value:Math.max(0,p.cash),color:'#0b73f6'},{name:'Phải thu',value:Math.max(0,p.receivables),color:'#14b8a6'},{name:'WIP/CCDC',value:Math.max(0,p.inventoryAndWip+p.prepaid),color:'#f59e0b'},{name:'TSCĐ ròng',value:Math.max(0,p.fixedAssetsNet),color:'#8b5cf6'},{name:'Khác',value:Math.max(0,p.totalAssets-p.cash-p.receivables-p.inventoryAndWip-p.prepaid-p.fixedAssetsNet),color:'#64748b'}].filter((x)=>x.value>0);
    return `<div class="grid dashboard-kpi-grid section compact-kpi-row financial-kpi-row">
      ${kpi('Doanh thu thuần',compactMoney(pnl.revenue),`Kỳ ${fmtDate(analysis.from)} – ${fmtDate(analysis.to)}`,pnl.revenue>=0,{icon:'₫',color:'blue',unit:'VND'})}
      ${kpi('Lợi nhuận sau thuế',compactMoney(pnl.profitAfterTax),`Biên ${fmtNum(pnl.revenue?pnl.profitAfterTax/pnl.revenue*100:0,1)}%`,pnl.profitAfterTax>=0,{icon:'↗',color:pnl.profitAfterTax>=0?'green':'red',unit:'VND'})}
      ${kpi('Tiền cuối kỳ',compactMoney(p.cash),`Dòng tiền thuần ${compactMoney(cf.net)}`,p.cash>=Number(db.settings.minimumCashBuffer||0),{icon:'◇',color:'teal',unit:'VND'})}
      ${kpi('Vốn lưu động',compactMoney(p.workingCapital),`TSNH ${compactMoney(p.currentAssets)} • Nợ NH ${compactMoney(p.currentLiabilities)}`,p.workingCapital>=0,{icon:'◈',color:p.workingCapital>=0?'purple':'red',unit:'VND'})}
      ${kpi('Điểm liên kết',`${audit.score}/100`,`${audit.criticalIssues} lỗi nghiêm trọng`,audit.passCritical,{icon:'⌘',color:audit.passCritical?'green':'red'})}
      ${kpi('Độ tin cậy dữ liệu',`${analysis.quality.score}/100`,analysis.quality.confidence==='High'?'Đủ cơ sở phân tích':'Cần hoàn thiện dữ liệu',analysis.quality.confidence==='High',{icon:'✓',color:analysis.quality.confidence==='High'?'green':'orange'})}
    </div>
    <div class="grid two-col section financial-equal-grid"><div class="card card-pad"><div class="section-header"><div><h2>Cơ cấu tài sản</h2><p>Từ số dư sổ cái tại ${fmtDate(p.asOf)}</p></div></div>${assets.length?donutChart(assets,'Tổng tài sản',compactMoney(p.totalAssets)):'<div class="empty-state">Chưa có số dư tài sản.</div>'}</div><div class="card card-pad"><div class="section-header"><div><h2>Nguồn vốn & cân đối</h2><p>Đối chiếu tài sản, nợ và vốn chủ sở hữu</p></div></div><div class="balance-summary"><div><span>Tổng tài sản</span><strong>${fmtMoney(p.totalAssets)}</strong></div><div><span>Nợ phải trả</span><strong>${fmtMoney(p.totalLiabilities)}</strong></div><div><span>Vốn chủ sở hữu</span><strong>${fmtMoney(p.totalEquity)}</strong></div><div><span>Chênh lệch cân đối</span><strong class="${p.balanced?'good-text':'danger-text'}">${fmtMoney(p.balanceGap)} <small>• ${p.balanced?'Đã cân':'Cần kiểm tra số dư đầu kỳ/kết chuyển'}</small></strong></div></div></div></div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Các hệ số điều hành trọng yếu</h2><p>Chỉ sử dụng chứng từ Posted; ngưỡng màu là tham chiếu quản trị, không thay thế đánh giá của kế toán/CFO.</p></div><button class="section-link" data-financial-jump="ratios">Xem toàn bộ hệ số →</button></div><div class="table-wrap"><table class="table-fit-wide table-financial-key-ratios"><thead><tr><th>Chỉ số</th><th class="numeric">Giá trị</th><th>Đánh giá</th><th>Công thức</th></tr></thead><tbody>${keyRatios.map((m)=>`<tr><td><strong>${esc(m.label)}</strong></td><td class="numeric strong">${ratioDisplay(m)}</td><td>${ratioBadge(m)}</td><td>${esc(m.formula)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Tăng trưởng và cơ cấu tài chính</h2><p>So sánh cùng kỳ năm trước; nếu kỳ trước không có dữ liệu, chỉ số hiển thị N/A thay vì suy đoán.</p></div></div><div class="table-wrap"><table class="table-fit-wide table-financial-growth"><thead><tr><th>Chỉ tiêu</th><th class="numeric">Kỳ hiện tại</th><th class="numeric">Cùng kỳ trước</th><th class="numeric">Tăng trưởng</th></tr></thead><tbody><tr><td><strong>Doanh thu thuần</strong></td><td class="numeric">${fmtMoney(pnl.revenue)}</td><td class="numeric">${fmtMoney(analysis.comparison.priorRevenue)}</td><td class="numeric">${analysis.comparison.revenueGrowth===null?'N/A':`${fmtNum(analysis.comparison.revenueGrowth,1)}%`}</td></tr><tr><td><strong>Lợi nhuận sau thuế</strong></td><td class="numeric">${fmtMoney(pnl.profitAfterTax)}</td><td class="numeric">${fmtMoney(analysis.comparison.priorProfit)}</td><td class="numeric">${analysis.comparison.profitGrowth===null?'N/A':`${fmtNum(analysis.comparison.profitGrowth,1)}%`}</td></tr><tr><td><strong>Cơ cấu tài sản ngắn hạn</strong></td><td class="numeric">${analysis.comparison.currentAssetShare===null?'N/A':`${fmtNum(analysis.comparison.currentAssetShare,1)}%`}</td><td class="numeric" colspan="2">Tài sản dài hạn ${analysis.comparison.longTermAssetShare===null?'N/A':`${fmtNum(analysis.comparison.longTermAssetShare,1)}%`}</td></tr><tr><td><strong>Cơ cấu nguồn vốn</strong></td><td class="numeric">Nợ ${analysis.comparison.liabilityShare===null?'N/A':`${fmtNum(analysis.comparison.liabilityShare,1)}%`}</td><td class="numeric" colspan="2">VCSH ${analysis.comparison.equityShare===null?'N/A':`${fmtNum(analysis.comparison.equityShare,1)}%`}</td></tr></tbody></table></div></div>
    <div class="grid two-col section financial-equal-grid"><div class="card card-pad"><div class="section-header"><div><h2>Kết quả kinh doanh</h2><p>Nguồn: tài khoản doanh thu và chi phí Posted</p></div></div><div class="formula-list"><div><strong>Doanh thu</strong><span>${fmtMoney(pnl.revenue)}</span></div><div><strong>Chi phí trước thuế</strong><span>${fmtMoney(pnl.expenseBeforeTax)}</span></div><div><strong>Lợi nhuận trước thuế</strong><span>${fmtMoney(pnl.profitBeforeTax)}</span></div><div><strong>Lợi nhuận sau thuế</strong><span>${fmtMoney(pnl.profitAfterTax)}</span></div></div></div><div class="card card-pad"><div class="section-header"><div><h2>Chất lượng phân tích</h2><p>Kiểm tra trước khi ra quyết định</p></div></div><div class="formula-list">${analysis.quality.checks.map((x)=>`<div><strong>${x.pass?'✓':'!'} ${esc(x.label)}</strong><span>${esc(x.detail)}</span></div>`).join('')}</div></div></div>`;
  }
  function renderFinancialRatios(){
    const analysis=Calc.financialRatios(db,currentRange()),groups=[...new Set(analysis.metrics.map((x)=>x.group))];
    return `<div class="note"><strong>Nguyên tắc:</strong> hệ số lấy từ sổ cái Posted và số dư bình quân đầu–cuối kỳ. Chỉ số không có mẫu số hoặc thiếu dữ liệu được hiển thị N/A, không ép về 0 để tránh kết luận sai.</div>${groups.map((group)=>`<div class="card table-card section"><div class="section-header card-pad"><div><h2>${esc(group)}</h2><p>Đối chiếu công thức, giá trị và mức cảnh báo quản trị.</p></div></div><div class="table-wrap"><table class="table-fit-wide table-financial-ratios"><thead><tr><th>Chỉ số</th><th class="numeric">Giá trị</th><th>Đánh giá</th><th>Công thức</th><th>Nguồn dữ liệu</th></tr></thead><tbody>${analysis.metrics.filter((x)=>x.group===group).map((m)=>`<tr><td><strong>${esc(m.label)}</strong></td><td class="numeric strong">${ratioDisplay(m)}</td><td>${ratioBadge(m)}</td><td>${esc(m.formula)}</td><td><span class="muted">Sổ cái Posted • số dư ${fmtDate(analysis.to)}</span></td></tr>`).join('')}</tbody></table></div></div>`).join('')}<div class="note"><strong>Lưu ý với doanh nghiệp tư vấn thiết kế:</strong> WIP tại TK 154, thời điểm kết chuyển TK 632 và việc ghi nhận doanh thu theo hồ sơ nghiệm thu có ảnh hưởng lớn đến biên gộp, vòng quay WIP, ROA và ROE. Cần khóa quy trình ghi nhận nhất quán trước khi so sánh qua các kỳ.</div>`;
  }
  function selectedForecastScenario(){return getById(db.financialForecastScenarios,currentForecastScenarioId)||db.financialForecastScenarios[0]||{};}
  function forecastScenarioOptions(){return (db.financialForecastScenarios||[]).map((x)=>`<option value="${esc(x.id)}" ${x.id===currentForecastScenarioId?'selected':''}>${esc(x.name)}</option>`).join('');}
  function renderFinancialForecast(){
    const scenario=selectedForecastScenario(),forecast=Calc.financialForecast(db,{asOf:currentRange().to,months:Number(db.settings.forecastHorizonMonths||12),scenario});
    const rows=forecast.keys.map((key,i)=>({key,i}));
    return `<div class="card card-pad section"><div class="section-header"><div><h2>Giả định kịch bản</h2><p>Mỗi kịch bản được lưu riêng; dự báo không ghi vào sổ kế toán.</p></div><span class="confidence ${forecast.quality.confidence.toLowerCase()}">${forecast.quality.confidence}</span></div><form id="forecastAssumptionsForm" class="form-grid forecast-form"><label>Kịch bản<select id="forecastScenarioSelect" name="scenarioId">${forecastScenarioOptions()}</select></label><label>Tăng trưởng doanh thu/tháng (%)<input name="monthlyRevenueGrowthPercent" type="number" step="0.1" value="${Number(scenario.monthlyRevenueGrowthPercent||0)}"></label><label>Tỷ lệ thu tiền (%)<input name="collectionRatePercent" type="number" min="0" max="100" step="1" value="${Number(scenario.collectionRatePercent||0)}"></label><label>Chi phí trực tiếp ngoài lương/Doanh thu (%)<input name="directCostRatioPercent" type="number" min="0" max="100" step="1" value="${Number(scenario.directCostRatioPercent||0)}"></label><label>Hệ số Pipeline (%)<input name="pipelineFactorPercent" type="number" min="0" max="150" step="5" value="${Number(scenario.pipelineFactorPercent||0)}"></label><label>Độ trễ Pipeline (tháng)<input name="pipelineLagMonths" type="number" min="0" max="12" step="1" value="${Number(scenario.pipelineLagMonths||0)}"></label><label>Thời gian thực hiện Pipeline (tháng)<input name="pipelineDeliveryMonths" type="number" min="1" max="24" step="1" value="${Number(scenario.pipelineDeliveryMonths||4)}"></label><label>Tăng quỹ lương/năm (%)<input name="payrollGrowthPercent" type="number" min="-20" max="100" step="1" value="${Number(scenario.payrollGrowthPercent||0)}"></label><label>Tăng chi phí chung/năm (%)<input name="overheadGrowthPercent" type="number" min="-20" max="100" step="1" value="${Number(scenario.overheadGrowthPercent||0)}"></label><label>Thuế suất dự báo (%)<input name="taxRatePercent" type="number" min="0" max="50" step="1" value="${Number(scenario.taxRatePercent||0)}"></label><label>Độ trễ nộp thuế (tháng)<input name="taxPaymentLagMonths" type="number" min="0" max="6" step="1" value="${Number(scenario.taxPaymentLagMonths??1)}"></label><label>Ngưỡng tiền tối thiểu<input name="minimumCashBuffer" type="number" min="0" step="10000000" value="${Number(scenario.minimumCashBuffer||0)}"></label><div class="full form-actions"><button type="submit" class="primary-btn">Lưu và tính lại</button></div></form></div>
    <div class="grid dashboard-kpi-grid section">${kpi('Doanh thu dự báo',compactMoney(forecast.totalRevenue),`${forecast.keys.length} tháng`,forecast.totalRevenue>0,{icon:'↗',color:'blue',unit:'VND'})}${kpi('LNST dự báo',compactMoney(forecast.totalProfit),`Biên ${fmtNum(forecast.totalRevenue?forecast.totalProfit/forecast.totalRevenue*100:0,1)}%`,forecast.totalProfit>=0,{icon:'₫',color:forecast.totalProfit>=0?'green':'red',unit:'VND'})}${kpi('Tiền cuối kỳ',compactMoney(forecast.endingCash),`Mở đầu ${compactMoney(forecast.openingCash)}`,forecast.endingCash>=forecast.minimumCashBuffer,{icon:'◇',color:'teal',unit:'VND'})}${kpi('Tiền thấp nhất',compactMoney(forecast.minCash),forecast.minCashMonth||'—',forecast.minCash>=forecast.minimumCashBuffer,{icon:'!',color:forecast.minCash>=forecast.minimumCashBuffer?'green':'orange',unit:'VND'})}${kpi('Tháng thiếu tiền',forecast.negativeCashMonth||'Không',forecast.negativeCashMonth?'Cần phương án tài trợ':'Không âm trong kỳ',!forecast.negativeCashMonth,{icon:'⌁',color:forecast.negativeCashMonth?'red':'green'})}</div>
    <div class="card chart-card section"><div class="section-header"><div><h2>Doanh thu và chi phí dự báo</h2><p>Backlog cam kết + pipeline có trọng số + phần doanh thu nền; chi phí ngoài lương, quỹ lương và overhead được tách riêng</p></div></div>${comboChart(forecast.labels,[{name:'Doanh thu',values:forecast.revenue.map((x)=>x/1e6),color:'#0b73f6'},{name:'Chi phí',values:forecast.operatingCost.map((x)=>x/1e6),color:'#f59e0b'}])}</div>
    <div class="card table-card section financial-forecast-table-card"><div class="section-header card-pad"><div><h2>Dự báo P&L và dòng tiền ${forecast.keys.length} tháng</h2><p>Cash và doanh thu được dự báo độc lập; thu tiền có độ trễ và dựa trên hạn thanh toán.</p></div></div><div class="table-tools" data-local-table-filter="financialForecastTable"><input class="search-input" data-filter-search type="search" aria-label="Tìm trong dự báo P&L và dòng tiền" placeholder="Tìm tháng hoặc giá trị..."><select class="filter-select" data-filter-text aria-label="Lọc dự báo theo cảnh báo"><option value="">Tất cả cảnh báo</option><option value="An toàn">An toàn</option><option value="Dưới buffer">Dưới buffer</option><option value="Thiếu tiền">Thiếu tiền</option></select><span class="table-count-badge" data-filter-count></span></div><div id="financialForecastTable" class="table-wrap"><table><thead><tr><th>Tháng</th><th class="numeric">Doanh thu</th><th class="numeric">Chi phí</th><th class="numeric">LNST</th><th class="numeric">Tiền vào</th><th class="numeric">Tiền ra</th><th class="numeric">Tiền cuối kỳ</th><th>Cảnh báo</th></tr></thead><tbody>${rows.map(({key,i})=>`<tr><td><strong>${esc(key)}</strong></td><td class="numeric">${fmtMoney(forecast.revenue[i])}</td><td class="numeric">${fmtMoney(forecast.operatingCost[i])}</td><td class="numeric ${forecast.profitAfterTax[i]<0?'cell-danger':''}">${fmtMoney(forecast.profitAfterTax[i])}</td><td class="numeric">${fmtMoney(forecast.cashIn[i])}</td><td class="numeric">${fmtMoney(forecast.cashOut[i])}</td><td class="numeric ${forecast.closingCash[i]<forecast.minimumCashBuffer?'cell-warning':''}">${fmtMoney(forecast.closingCash[i])}</td><td>${forecast.closingCash[i]<0?'<span class="badge danger">Thiếu tiền</span>':forecast.closingCash[i]<forecast.minimumCashBuffer?'<span class="badge warning">Dưới buffer</span>':'<span class="badge success">An toàn</span>'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="note"><strong>Lineage:</strong> ${esc(forecast.lineage.revenue)}. Dự báo là công cụ quản trị, không phải báo cáo tài chính pháp định và không tự sinh bút toán.</div>`;
  }
  function renderFinancialLinks(){
    const audit=Calc.financialLinkAudit(db,currentRange());
    return `<div class="grid dashboard-kpi-grid section">${kpi('Điểm liên kết',`${audit.score}/100`,audit.passCritical?'Đạt kiểm soát trọng yếu':'Còn lỗi liên kết',audit.passCritical,{icon:'⌘',color:audit.passCritical?'green':'red'})}${kpi('Lỗi nghiêm trọng',fmtNum(audit.criticalIssues,0),'Phải xử lý trước khi khóa số liệu',audit.criticalIssues===0,{icon:'!',color:'red'})}${kpi('Cảnh báo',fmtNum(audit.warningIssues,0),'Ảnh hưởng độ tin cậy dự báo',audit.warningIssues===0,{icon:'◇',color:'orange'})}</div><div class="card table-card section"><div class="section-header card-pad"><div><h2>Ma trận liên kết giữa các phân hệ</h2><p>Kiểm tra nguồn–đích, mức bao phủ và các giao dịch chưa nối.</p></div><button class="section-link" id="repairFinancialLinks">Sửa liên kết chắc chắn →</button></div><div class="table-wrap"><table><thead><tr><th>Luồng dữ liệu</th><th class="numeric">Đã liên kết</th><th class="numeric">Tổng</th><th class="numeric">Bao phủ</th><th>Trạng thái</th><th>Kiểm soát</th></tr></thead><tbody>${audit.rows.map((x)=>`<tr><td><strong>${esc(x.label)}</strong><div class="muted">${esc(x.id)}</div></td><td class="numeric">${x.linked}</td><td class="numeric">${x.total}</td><td class="numeric strong">${fmtNum(x.percent,0)}%</td><td>${x.pass?'<span class="badge success">Đạt</span>':x.severity==='critical'?'<span class="badge danger">Lỗi</span>':'<span class="badge warning">Cảnh báo</span>'}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div></div><div class="note"><strong>Nguyên tắc tự sửa:</strong> chỉ nối tự động khi có đúng một chứng từ khớp tuyệt đối theo ngày, dự án/đối tác, chiều tiền và số tiền. Trường hợp mơ hồ được giữ lại để kế toán xử lý, không đoán liên kết.</div>`;
  }
  function renderFinancialAnalytics(){
    const position=Calc.financialPosition(db,currentRange().to),audit=Calc.financialLinkAudit(db,currentRange());
    const body={overview:renderFinancialOverview,ratios:renderFinancialRatios,forecast:renderFinancialForecast,links:renderFinancialLinks}[currentFinancialTab]?.()||renderFinancialOverview();
    return `<div class="modern-hero"><div><span class="eyebrow">FINANCIAL INTELLIGENCE ENGINE</span><h2>Phân tích đúng từ sổ cái, dự báo có giả định và truy vết nguồn</h2><p>Phân tích tăng trưởng, cơ cấu tài sản–nguồn vốn, thanh khoản, đòn bẩy, hiệu suất, sinh lời và dòng tiền. Forecast tách khỏi Actual; mọi số liệu đều có lineage và kiểm tra liên kết giữa phân hệ.</p></div><div class="hero-metric"><span>Sức khỏe liên kết</span><strong>${audit.score}/100</strong><small>${position.balanced?'Sổ cân đối':'Cần kiểm tra cân đối'}</small></div></div>${financialTabs()}${body}`;
  }

  function procurementTabs(){
    const tabs=[['requests','Đề nghị mua'],['orders','Đơn mua hàng'],['tools','Công cụ dụng cụ'],['assets','Tài sản cố định']];
    return `<div class="metric-switch section" role="tablist" aria-label="Mua sắm và tài sản">${tabs.map(([id,label])=>`<button type="button" class="${currentProcurementTab===id?'active':''}" data-procurement-tab="${id}" role="tab" aria-selected="${currentProcurementTab===id?'true':'false'}">${label}</button>`).join('')}</div>`;
  }
  function poTotal(po){return Calc.vnd(Number(po.quantity||0)*Number(po.unitPrice||0));}
  function poClassLabel(value){return value==='fixed_asset'?'Tài sản cố định':value==='tool'?'Công cụ dụng cụ':'Chi phí kỳ';}
  function scheduleRowStatus(row){const je=row.journalEntryId?getById(db.journalEntries,row.journalEntryId):null;return Calc.statusIs(je?.status,'posted')?'Posted':row.status||'Draft';}
  function scheduleSummary(rows){const total=rows.reduce((s,x)=>s+Number(x.amount||0),0),posted=rows.filter(x=>scheduleRowStatus(x)==='Posted').reduce((s,x)=>s+Number(x.amount||0),0);return {total,posted,remaining:Math.max(0,total-posted)};}
  function renderPurchaseRequests(){
    const rows=db.purchaseRequests.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    return `<div class="card table-card section"><div class="section-header card-pad"><div><h2>Đề nghị mua hàng</h2><p>Ghi rõ mục đích, dự án sử dụng và phê duyệt trước khi lập đơn mua.</p></div><button class="section-link" data-secondary-add="purchaseRequests">+ Đề nghị mua</button></div><div class="table-wrap"><table><thead><tr><th>Số đề nghị</th><th>Ngày</th><th>Hàng hóa / tài sản</th><th>Người đề nghị</th><th>Dự án</th><th class="numeric">Giá trị</th><th>Gợi ý phân loại</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.requestNo)}</strong></td><td>${fmtDate(x.date)}</td><td><strong>${esc(x.itemName)}</strong><div class="muted">${esc(x.purpose||x.category)}</div></td><td>${esc(personName(x.requesterId))}</td><td>${esc(projectName(x.projectId))}</td><td class="numeric">${fmtMoney(Number(x.quantity||0)*Number(x.unitPrice||0))}</td><td>${badge(poClassLabel(x.suggestedClass))}</td><td>${badge(x.status)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="purchaseRequests" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn delete-row" data-write-action data-type="purchaseRequests" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderPurchaseOrders(){
    const rows=db.purchaseOrders.slice().sort((a,b)=>String(b.orderDate).localeCompare(String(a.orderDate)));
    return `<div class="note"><strong>Tự động kế toán:</strong> khi đơn mua ở trạng thái <b>Received/Completed</b>, hệ thống phân loại theo bản chất và ngưỡng chính sách, tạo chứng từ mua hàng Draft, đồng thời tạo thẻ CCDC/TSCĐ và lịch phân bổ/khấu hao. Kế toán vẫn phải kiểm tra hóa đơn trước khi ghi sổ.</div><div class="card table-card section"><div class="section-header card-pad"><div><h2>Đơn mua hàng và ghi nhận</h2><p>Giá trị chưa VAT; phân loại không chỉ dựa vào giá trị mà còn theo tính chất sử dụng.</p></div><button class="section-link" data-secondary-add="purchaseOrders">+ Đơn mua hàng</button></div><div class="table-wrap purchase-order-table-wrap"><table class="table-purchase-orders table-fit-wide"><thead><tr><th>Số PO</th><th>Nhà cung cấp</th><th>Hàng hóa / tài sản</th><th class="numeric">Giá trị chưa VAT</th><th>Phân loại</th><th>Thanh toán</th><th>Trạng thái</th><th>Chứng từ</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.poNo)}</strong><div class="muted">${fmtDate(x.orderDate)}</div></td><td>${esc(vendorName(x.vendorId))}</td><td><strong>${esc(x.itemName)}</strong><div class="muted">${esc(x.category)} • ${Number(x.quantity||0)} × ${fmtMoney(x.unitPrice)}</div></td><td class="numeric">${fmtMoney(poTotal(x))}</td><td>${badge(poClassLabel(x.classification||Calc.classifyPurchase(x,db.settings).classification))}</td><td>${esc(x.paymentMethod)}</td><td>${badge(x.status)}</td><td>${x.journalEntryId?'<span class="badge info">Đã sinh Draft</span>':'<span class="badge neutral">Chưa sinh</span>'}</td><td><button class="ghost-btn edit-row" data-write-action data-type="purchaseOrders" data-id="${esc(x.id)}">Sửa</button>${/received|completed/i.test(x.status)&&!x.journalEntryId?`<button class="ghost-btn recognize-purchase" data-id="${esc(x.id)}">Ghi nhận</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderTools(){
    const rows=db.tools.slice(); const sched=scheduleSummary(db.toolAllocationSchedules);
    return `<div class="grid kpi-grid">${kpi('Nguyên giá CCDC',compactMoney(rows.reduce((s,x)=>s+Number(x.originalCost||0),0)),'Đang theo dõi',true,{icon:'▦',color:'blue',unit:'VND'})}${kpi('Đã phân bổ',compactMoney(sched.posted),'Theo kỳ đã Posted',true,{icon:'✓',color:'green',unit:'VND'})}${kpi('Còn phân bổ',compactMoney(sched.remaining),'Giá trị chưa ghi chi phí',true,{icon:'◷',color:'orange',unit:'VND'})}</div><div class="card table-card section"><div class="section-header card-pad"><div><h2>Công cụ dụng cụ</h2><p>CCDC được theo dõi người sử dụng, bộ phận và phân bổ tối đa theo chính sách nội bộ.</p></div><button class="section-link" data-secondary-add="tools">+ CCDC</button></div><div class="table-tools" data-local-table-filter="toolsTable"><input class="search-input" data-filter-search type="search" aria-label="Tìm công cụ dụng cụ" placeholder="Tìm mã, tên, người sử dụng, bộ phận..."><select class="filter-select" data-filter-text aria-label="Lọc công cụ dụng cụ theo trạng thái"><option value="">Tất cả trạng thái</option>${[...new Set(rows.map(x=>String(x.status||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')).map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select><span class="table-count-badge" data-filter-count></span></div><div id="toolsTable" class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên CCDC</th><th>Người sử dụng</th><th>Bộ phận / Dự án</th><th class="numeric">Nguyên giá</th><th class="numeric">Phân bổ tháng</th><th>Ngày bắt đầu</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.toolCode)}</strong></td><td>${esc(x.name)}</td><td>${esc(personName(x.custodianId))}</td><td>${esc(x.department||projectName(x.projectId))}</td><td class="numeric">${fmtMoney(x.originalCost)}</td><td class="numeric">${fmtNum(x.allocationMonths,0)}</td><td>${fmtDate(x.startDate)}</td><td>${badge(x.status)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="tools" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn rebuild-tool-schedule" data-id="${esc(x.id)}">Tạo lại lịch</button></td></tr>`).join('')}</tbody></table></div></div>${renderScheduleTable(db.toolAllocationSchedules,'Lịch phân bổ CCDC','toolAllocationScheduleTable')}`;
  }
  function renderAssets(){
    const rows=db.fixedAssets.slice(); const sched=scheduleSummary(db.depreciationSchedules); const gross=rows.reduce((s,x)=>s+Number(x.originalCost||0),0);
    return `<div class="grid kpi-grid">${kpi('Nguyên giá TSCĐ',compactMoney(gross),'Máy móc, phương tiện và tài sản khác',true,{icon:'▣',color:'blue',unit:'VND'})}${kpi('Khấu hao đã ghi',compactMoney(sched.posted),'Theo kỳ đã Posted',true,{icon:'✓',color:'green',unit:'VND'})}${kpi('Giá trị còn lại',compactMoney(Math.max(0,gross-sched.posted)),'Theo lịch khấu hao',true,{icon:'◇',color:'purple',unit:'VND'})}</div><div class="card table-card section"><div class="section-header card-pad"><div><h2>Tài sản cố định</h2><p>Áp dụng phương pháp đường thẳng; ngưỡng mặc định ${fmtMoney(db.settings.fixedAssetThreshold)} và thời gian sử dụng trên 12 tháng.</p></div><button class="section-link" data-secondary-add="fixedAssets">+ TSCĐ</button></div><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên tài sản</th><th>Nhóm</th><th>Người / bộ phận sử dụng</th><th class="numeric">Nguyên giá</th><th class="numeric">Thời gian KH</th><th>Ngày sử dụng</th><th>Tài khoản</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.assetCode)}</strong></td><td>${esc(x.name)}</td><td>${esc(x.category)}</td><td>${esc(personName(x.custodianId))}<div class="muted">${esc(x.department||projectName(x.projectId))}</div></td><td class="numeric">${fmtMoney(x.originalCost)}</td><td class="numeric">${fmtNum(x.usefulLifeMonths,0)} tháng</td><td>${fmtDate(x.inServiceDate)}</td><td>${esc(x.assetAccountCode)} / ${esc(x.depreciationAccountCode)}</td><td>${badge(x.status)}</td><td><button class="ghost-btn edit-row" data-write-action data-type="fixedAssets" data-id="${esc(x.id)}">Sửa</button><button class="ghost-btn rebuild-asset-schedule" data-id="${esc(x.id)}">Tạo lại lịch</button></td></tr>`).join('')}</tbody></table></div></div>${renderScheduleTable(db.depreciationSchedules,'Lịch khấu hao TSCĐ')}`;
  }
  function renderScheduleTable(rows,title,filterId=''){
    const visible=rows.slice().sort((a,b)=>String(a.period).localeCompare(String(b.period))).slice(0,120);
    const statuses=[...new Set(visible.map(scheduleRowStatus).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    const tools=filterId?`<div class="table-tools" data-local-table-filter="${esc(filterId)}"><input class="search-input" data-filter-search type="search" aria-label="Tìm ${esc(title)}" placeholder="Tìm kỳ, nguồn, chứng từ..."><select class="filter-select" data-filter-text aria-label="Lọc ${esc(title)} theo trạng thái"><option value="">Tất cả trạng thái</option>${statuses.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select><span class="table-count-badge" data-filter-count></span></div>`:'';
    return `<div class="card table-card section"><div class="section-header card-pad"><div><h2>${esc(title)}</h2><p>Chứng từ định kỳ được tạo ở trạng thái Draft; chỉ kỳ được kế toán kiểm tra và Posted mới đi vào actual.</p></div></div>${tools}<div ${filterId?`id="${esc(filterId)}" `:''}class="table-wrap"><table><thead><tr><th>Kỳ</th><th>Nguồn</th><th class="numeric">Số tiền</th><th>Chứng từ</th><th>Trạng thái</th></tr></thead><tbody>${visible.map(x=>`<tr><td><strong>${esc(x.period)}</strong></td><td>${esc(x.kind==='asset'?'TSCĐ':'CCDC')} • ${esc(x.sourceId)}</td><td class="numeric">${fmtMoney(x.amount)}</td><td>${x.journalEntryId?esc(getById(db.journalEntries,x.journalEntryId)?.documentNo||'Đã tạo'):'—'}</td><td>${badge(scheduleRowStatus(x))}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderProcurement(){
    const totalOrders=db.purchaseOrders.reduce((s,x)=>s+poTotal(x),0), pending=db.purchaseRequests.filter(x=>x.status==='Pending').length, tools=db.tools.reduce((s,x)=>s+Number(x.originalCost||0),0), assets=db.fixedAssets.reduce((s,x)=>s+Number(x.originalCost||0),0);
    const body={requests:renderPurchaseRequests,orders:renderPurchaseOrders,tools:renderTools,assets:renderAssets}[currentProcurementTab]?.()||renderPurchaseRequests();
    return `<div class="modern-hero"><div><span class="eyebrow">PROCUREMENT & ASSET CONTROL</span><h2>Mua đúng quy trình, ghi nhận đúng bản chất, phân bổ đúng kỳ</h2><p>Đề nghị mua và đơn mua hàng được nối với chứng từ kế toán, thẻ CCDC/TSCĐ và lịch phân bổ/khấu hao. Không ghi máy in, giấy và ô tô vào cùng một loại chi phí.</p></div><div class="hero-metric"><span>Giá trị mua hàng</span><strong>${compactMoney(totalOrders)}</strong></div></div><div class="grid kpi-grid">${kpi('Đề nghị chờ duyệt',fmtNum(pending,0),'Cần phê duyệt trước PO',pending===0,{icon:'⌁',color:'orange'})}${kpi('Giá trị CCDC',compactMoney(tools),'Đang phân bổ',true,{icon:'▦',color:'teal',unit:'VND'})}${kpi('Nguyên giá TSCĐ',compactMoney(assets),'Đang quản lý',true,{icon:'▣',color:'purple',unit:'VND'})}</div>${procurementTabs()}${body}`;
  }

  function csvSafeCell(value){
    let text=String(value??'');
    if(/^[=+\-@]/.test(text))text=`'${text}`;
    return `"${text.replace(/"/g,'""')}"`;
  }
  function exportPayrollCsv(){
    const validation=Payroll.validatePeriod(db,currentPayrollMonth);
    const rows=validation.rows||[];
    if(!rows.length){alert('Chưa có dữ liệu bảng lương để xuất.');return;}
    const headers=['Kỳ','Mã nhân viên','Họ tên','Bộ môn','Loại','Ngày công chuẩn','Ngày hưởng lương','Ngày có chấm công','Giờ duyệt','Giờ làm thêm','Giờ billable','Lương/tiền công','Phụ cấp','Nguồn phụ cấp','Làm thêm','Nguồn làm thêm','Thưởng','Thu nhập khác','Tổng thu nhập','Mức lương đóng BH','BH người lao động','Nguồn bảo hiểm','Thu nhập tính thuế','Thuế TNCN','Nguồn TNCN','Tạm ứng','Khấu trừ khác','Thực nhận','BH doanh nghiệp','Tổng chi phí doanh nghiệp','Chi phí phân bổ dự án','Doanh thu thu hồi','Utilization (%)','Chargeability (%)','Cost Recovery (%)','Phiên bản công thức','Trạng thái','Ghi chú'];
    const lines=[headers, ...rows.map(row=>[row.month,row.employeeCode,row.employeeName,row.department,row.type,row.standardWorkdays,row.payableWorkdays,row.attendanceDays,row.approvedHours,row.overtimeHours,row.billableHours,row.baseSalary,row.allowances,row.allowanceMode,row.overtimePay,row.overtimeMode,row.bonus,row.otherIncome,row.grossIncome,row.insuranceBase,row.employeeInsurance,row.insuranceMode,row.taxableIncome,row.personalIncomeTax,row.pitMode,row.advanceDeduction,row.otherDeductions,row.netPay,row.employerInsurance,row.totalEmployerCost,row.projectAllocatedCost,row.recoverableRevenue,row.utilization,row.chargeability,row.recoveryRatio,row.calculationVersion,row.status,row.notes])].map(row=>row.map(csvSafeCell).join(','));
    const blob=new Blob([`\ufeff${lines.join('\r\n')}`],{type:'text/csv;charset=utf-8'}),anchor=document.createElement('a');anchor.href=URL.createObjectURL(blob);anchor.download=`ALPHA_DESIGN_Bang_luong_chi_tiet_${currentPayrollMonth}.csv`;anchor.click();URL.revokeObjectURL(anchor.href);toastMsg('Đã xuất bảng lương chi tiết CSV');
  }
  async function setPayrollPeriodStatus(nextStatus){
    const period=Payroll.findPeriod(db,currentPayrollMonth);if(!period){alert('Cần tạo bảng lương trước.');return;}
    const transitions={Draft:['Reviewed'],Reviewed:['Approved'],Approved:['Locked']};
    if(!(transitions[period.status]||[]).includes(nextStatus)){const required=nextStatus==='Reviewed'?'Draft':nextStatus==='Approved'?'Reviewed':'Approved';alert(`Chưa thể thực hiện bước này. Bảng lương phải ở trạng thái ${required}; hiện tại là ${period.status}.`);return;}
    const validation=Payroll.validatePeriod(db,currentPayrollMonth);
    if(!validation.valid){alert(validation.errors.map(x=>x.message).join('\n'));return;}
    const permission=nextStatus==='Reviewed'?'payroll.review':nextStatus==='Approved'?'payroll.approve':'payroll.lock';
    const security=await requirePrivilegedAction([permission],nextStatus==='Reviewed'?'Soát xét bảng lương':nextStatus==='Approved'?'Phê duyệt bảng lương':'Khóa kỳ bảng lương');if(!security)return;
    const actorId=security.user_id||auditActor(security),actor=auditActor(security),timestamp=new Date().toISOString();
    if(ENVIRONMENT!=='demo'&&nextStatus==='Approved'&&String(period.reviewedBy||'')===String(actorId)){alert('Người phê duyệt bảng lương phải khác người soát xét.');return;}
    if(nextStatus==='Reviewed'){period.reviewedBy=actorId;period.reviewedName=actor;period.reviewedAt=timestamp;}
    if(nextStatus==='Approved'){period.approvedBy=actorId;period.approvedName=actor;period.approvedAt=timestamp;}
    if(nextStatus==='Locked'){period.lockedBy=actorId;period.lockedName=actor;period.lockedAt=timestamp;}
    period.status=nextStatus;period.history=[...(period.history||[]),{action:nextStatus,at:timestamp,by:actor}];
    if(!saveDB()){alert('Không thể lưu trạng thái bảng lương.');return;}render();toastMsg(`Đã chuyển bảng lương sang ${nextStatus}`);
  }

  function exportAnnualBenefitCsv(){
    const result=AnnualBenefits.calculateAnnualBudget(db,currentBenefitYear,AnnualBenefits.findPlan(db,currentBenefitYear));
    const headers=['Năm','Mã nhân viên','Họ tên','Bộ môn','Lương bình quân','Ngày đủ điều kiện','Tỷ lệ thời gian (%)','Hệ số cá nhân','Hệ số công ty','Thưởng dự kiến','Dự phòng thuế/gross-up','Ngân sách tiền mặt'];
    const rows=result.bonus.rows.map(row=>[result.year,row.employeeCode,row.employeeName,row.department,row.averageSalary,row.serviceDays,row.serviceRatio*100,row.employeeFactor,row.companyFactor,row.grossBonus,row.pitProvision,row.cashBudget]);
    rows.push([],[result.year,'QUỸ DU LỊCH','','',result.travel.costPerPerson,result.travel.expectedParticipants,result.travel.participationRate,'','','',result.travel.contingency,result.travel.total]);
    rows.push([result.year,'TỔNG NGÂN SÁCH NĂM','','','','','','','','','',result.total]);
    const lines=[headers,...rows].map(row=>row.map(csvSafeCell).join(','));
    const blob=new Blob([`\ufeff${lines.join('\r\n')}`],{type:'text/csv;charset=utf-8'}),anchor=document.createElement('a');anchor.href=URL.createObjectURL(blob);anchor.download=`ALPHA_DESIGN_Ngan_sach_thuong_phuc_loi_${currentBenefitYear}.csv`;anchor.click();URL.revokeObjectURL(anchor.href);toastMsg('Đã xuất ngân sách thưởng và phúc lợi CSV');
  }
  async function setAnnualBenefitStatus(nextStatus){
    const plan=AnnualBenefits.findPlan(db,currentBenefitYear);if(!plan){alert('Cần tạo ngân sách năm trước.');return;}
    const transitions={Draft:['Reviewed'],Reviewed:['Approved'],Approved:['Locked']};
    if(!(transitions[plan.status]||[]).includes(nextStatus)){const required=nextStatus==='Reviewed'?'Draft':nextStatus==='Approved'?'Reviewed':'Approved';alert(`Chưa thể thực hiện bước này. Ngân sách phải ở trạng thái ${required}; hiện tại là ${plan.status}.`);return;}
    const result=AnnualBenefits.calculateAnnualBudget(db,currentBenefitYear,plan);
    if(result.errors.length){alert(result.errors.join('\n'));return;}
    const permission=nextStatus==='Reviewed'?'payroll.review':nextStatus==='Approved'?'payroll.approve':'payroll.lock';
    const security=await requirePrivilegedAction([permission],nextStatus==='Reviewed'?'Soát xét ngân sách thưởng và phúc lợi':nextStatus==='Approved'?'Phê duyệt ngân sách thưởng và phúc lợi':'Khóa ngân sách năm');if(!security)return;
    const actorId=security.user_id||auditActor(security),actor=auditActor(security),timestamp=new Date().toISOString();
    if(ENVIRONMENT!=='demo'&&nextStatus==='Approved'&&String(plan.reviewedBy||'')===String(actorId)){alert('Người phê duyệt ngân sách phải khác người soát xét.');return;}
    if(nextStatus==='Reviewed'){plan.reviewedBy=actorId;plan.reviewedName=actor;plan.reviewedAt=timestamp;}
    if(nextStatus==='Approved'){plan.approvedBy=actorId;plan.approvedName=actor;plan.approvedAt=timestamp;}
    if(nextStatus==='Locked'){plan.lockedBy=actorId;plan.lockedName=actor;plan.lockedAt=timestamp;}
    plan.status=nextStatus;plan.history=[...(plan.history||[]),{action:nextStatus,at:timestamp,by:actor}];plan.calculationSnapshot={bonusTotal:result.bonus.total,travelTotal:result.travel.total,total:result.total,calculatedAt:timestamp,calculationVersion:'ALPHA-BENEFITS-4.5.46'};
    if(!saveDB()){alert('Không thể lưu trạng thái ngân sách năm.');return;}render();toastMsg(`Đã chuyển ngân sách năm ${currentBenefitYear} sang ${nextStatus}`);
  }

  const TRASH_ENTITY_META=Object.freeze({
    people:['Nhân sự','people'],clients:['Khách hàng','crm'],vendors:['Nhà cung cấp','accounting'],accounts:['Tài khoản kế toán','accounting'],projects:['Dự án','projects'],tasks:['Công việc','tasks'],timesheets:['Chấm công','timesheets'],payrollPeriods:['Kỳ lương','payroll'],payrollItems:['Chi tiết lương','payroll'],annualBenefitBudgets:['Ngân sách thưởng và phúc lợi','payroll'],contracts:['Hợp đồng','commercial'],journalEntries:['Chứng từ kế toán','accounting'],finance:['Dòng tiền','finance'],quotes:['Cơ hội kinh doanh','crm'],approvals:['Yêu cầu phê duyệt','approvals'],documents:['Hồ sơ dự án','documents'],taxInvoices:['Hóa đơn thuế','tax'],pitWithholdings:['Khấu trừ thuế TNCN','tax'],citAdjustments:['Điều chỉnh thuế TNDN','tax'],taxFilings:['Nghĩa vụ thuế','tax'],billingMilestones:['Đợt thanh toán','commercial'],paymentAllocations:['Phân bổ thanh toán','commercial'],openingBalances:['Số dư đầu kỳ','accounting'],accountingPeriods:['Kỳ kế toán','accounting'],projectBudgetVersions:['Phiên bản ngân sách','planning'],projectBudgetLines:['Dòng ngân sách','planning'],resourcePlans:['Kế hoạch nguồn lực','planning'],commitments:['Chi phí cam kết','planning'],projectStages:['Giai đoạn dự án','projects'],purchaseRequests:['Đề nghị mua','procurement'],purchaseOrders:['Đơn mua hàng','procurement'],tools:['Công cụ dụng cụ','procurement'],fixedAssets:['Tài sản cố định','procurement'],toolAllocationSchedules:['Lịch phân bổ công cụ dụng cụ','procurement'],depreciationSchedules:['Lịch khấu hao tài sản','procurement'],financialForecastScenarios:['Kịch bản dự báo','financialAnalytics'],financialAnalysisSnapshots:['Ảnh chụp phân tích tài chính','financialAnalytics'],financialLinkAuditRuns:['Lần kiểm toán liên kết','financialAnalytics']
  });
  function trashMeta(type){return TRASH_ENTITY_META[type]||[String(type||'Dữ liệu'),String(type||'dashboard')];}
  function trashDisplayName(type,record={}){
    const primary=record.name||record.title||record.code||record.contractNo||record.documentNo||record.entryNo||record.invoiceNo||record.requestNo||record.orderNo||record.period||record.description||record.id;
    return String(primary||`${trashMeta(type)[0]} ${record.id||''}`).trim();
  }
  function trashSourceContext(){return {accountingTab:currentAccountingTab,controlTab:currentControlTab,procurementTab:currentProcurementTab,financialTab:currentFinancialTab,payrollMonth:currentPayrollMonth,benefitYear:currentBenefitYear};}
  function fmtTrashDateTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(date);}
  function renderTrash(){
    const entries=[...(db.trashEntries||[])].sort((a,b)=>String(b.deletedAt||'').localeCompare(String(a.deletedAt||'')));
    const expired=RecycleBin.expiredEntries(db),expiring=entries.filter(entry=>RecycleBin.daysRemaining(entry)<=7&&!expired.some(row=>String(row.id)===String(entry.id))).length;
    const modules=new Set(entries.map(entry=>entry.entityType)).size;
    const typeOptions=[...new Set(entries.map(entry=>entry.entityType))].sort((a,b)=>trashMeta(a)[0].localeCompare(trashMeta(b)[0],'vi')).map(type=>`<option value="${esc(type)}">${esc(trashMeta(type)[0])}</option>`).join('');
    const rows=entries.map(entry=>{const remaining=RecycleBin.daysRemaining(entry),isExpired=remaining===0;return `<tr data-trash-row data-search="${esc(`${entry.displayName||''} ${entry.recordId||''} ${entry.sourceLabel||trashMeta(entry.entityType)[0]} ${entry.deletedBy||''}`.toLowerCase())}" data-trash-type="${esc(entry.entityType)}"><td><strong>${esc(entry.displayName||trashDisplayName(entry.entityType,entry.record))}</strong><div class="muted">${esc(entry.recordId||entry.record?.id||'—')}</div></td><td><span class="trash-source-badge">${esc(entry.sourceLabel||trashMeta(entry.entityType)[0])}</span><div class="muted">${esc(entry.sourceView||trashMeta(entry.entityType)[1])}</div></td><td>${esc(entry.deletedBy||'Người dùng')}<div class="muted">${fmtTrashDateTime(entry.deletedAt)}</div></td><td><strong class="${isExpired?'trash-expired':''}">${isExpired?'Đã đến hạn':`Còn ${remaining} ngày`}</strong><div class="muted">${fmtTrashDateTime(entry.expiresAt)}</div></td><td class="actions trash-actions"><button class="secondary-btn trash-restore" data-write-action data-trash-id="${esc(entry.id)}">Khôi phục</button><button class="ghost-btn danger trash-purge" data-write-action data-trash-id="${esc(entry.id)}">Xóa vĩnh viễn</button></td></tr>`;}).join('');
    return `<div class="grid kpi-grid trash-kpis">${kpi('Đang lưu trong Thùng rác',entries.length,'Bản ghi có thể khôi phục',true,{icon:'♲',color:'blue'})}${kpi('Sắp tự xóa',expiring,expired.length?`${expired.length} mục đã đến hạn dọn`:'Trong 7 ngày tới',expired.length===0,{icon:'◷',color:'orange'})}${kpi('Phân hệ có dữ liệu xóa',modules,'Khôi phục về đúng phân hệ gốc',true,{icon:'▦',color:'purple'})}${kpi('Thời gian lưu',`${RecycleBin.RETENTION_DAYS} ngày`,'Tính từ thời điểm xóa',true,{icon:'⌛',color:'green'})}</div><div class="card table-card section trash-card"><div class="section-header card-pad trash-header"><div><h2>Nội dung đã xóa</h2><p>Dữ liệu chưa bị mất ngay. Khôi phục sẽ trả lại đúng danh mục và vị trí đã xóa.</p></div><div class="actions"><button class="secondary-btn" id="purgeExpiredTrash" data-write-action ${expired.length?'':'disabled'}>Dọn ${expired.length} mục quá hạn</button><button class="ghost-btn danger" id="purgeAllTrash" data-write-action ${entries.length?'':'disabled'}>Xóa vĩnh viễn tất cả</button></div></div><div class="table-tools trash-tools"><label class="table-search"><span aria-hidden="true">⌕</span><input id="trashSearch" placeholder="Tìm nội dung, mã, phân hệ, người xóa..." autocomplete="off"></label><select id="trashTypeFilter" aria-label="Lọc theo phân hệ"><option value="">Tất cả phân hệ</option>${typeOptions}</select><span class="record-count" id="trashVisibleCount">${entries.length} bản ghi</span></div><div class="table-wrap"><table class="table-fit-wide table-trash"><thead><tr><th>Nội dung</th><th>Phân hệ gốc</th><th>Người xóa / Thời điểm</th><th>Tự động xóa</th><th>Thao tác</th></tr></thead><tbody id="trashTableBody">${rows||'<tr class="table-empty-row"><td colspan="5"><div class="empty-state"><strong>Thùng rác đang trống</strong><p>Nội dung được xóa hợp lệ sẽ xuất hiện tại đây trong 30 ngày.</p></div></td></tr>'}</tbody></table></div><div id="trashFilterEmpty" class="empty-state hidden">Không có nội dung phù hợp bộ lọc.</div></div>`;
  }

  const renderers={dashboard:renderDashboard,controls:renderControls,commercial:renderCommercial,planning:renderPlanning,procurement:renderProcurement,projects:renderProjects,tasks:renderTasks,timesheets:renderTimesheets,people:renderPeople,payroll:renderPayroll,finance:renderFinance,financialAnalytics:renderFinancialAnalytics,accounting:renderAccounting,tax:renderTax,crm:renderCRM,approvals:renderApprovals,documents:renderDocuments,exports:renderExports,trash:renderTrash,settings:renderSettings};

  async function approveTimesheetRecord(id){
    if(!ensureWritable())return;
    const security=await requirePrivilegedAction(['timesheet.approve'],'Duyệt timesheet');if(!security)return;
    const record=getById(db.timesheets,id);if(!record)return;
    if(record.approved){toastMsg('Timesheet đã được duyệt trước đó');return;}
    record.approved=true;record.approvedAt=new Date().toISOString();record.approvedBy=security.user_id||auditActor(security);
    Payroll.refreshDraftPeriods(db,uid);
    if(!saveDB()){record.approved=false;delete record.approvedAt;delete record.approvedBy;alert('Không thể lưu trạng thái duyệt timesheet.');return;}
    render();toastMsg('Đã duyệt timesheet và cập nhật các kỳ lương Draft');
  }
  function bindTimesheetApprovalActions(scope=document){
    scope.querySelectorAll?.('.approve-timesheet').forEach(button=>button.onclick=()=>approveTimesheetRecord(button.dataset.id));
  }

  function bindViewEvents(){
    document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
    const payrollMonthSelect=document.getElementById('payrollMonthSelect');
    if(payrollMonthSelect)payrollMonthSelect.onchange=()=>{currentPayrollMonth=payrollMonthSelect.value;render();};
    document.getElementById('generatePayrollPeriod')?.addEventListener('click',()=>{if(!ensureWritable())return;const result=Payroll.ensurePeriod(db,currentPayrollMonth,uid);if(result.locked){alert('Kỳ bảng lương đã khóa, không thể tính lại.');return;}const period=result.period;period.preparedBy=period.preparedBy||auditActor(currentSecurityContext()||{display_name:'Giám đốc Demo'});period.preparedAt=period.preparedAt||new Date().toISOString();if(!saveDB()){alert('Không thể lưu bảng lương.');return;}render();toastMsg(`Đã đồng bộ tự động bảng lương cho ${result.rows.length} nhân sự`);});
    document.getElementById('reviewPayrollPeriod')?.addEventListener('click',()=>setPayrollPeriodStatus('Reviewed'));
    document.getElementById('approvePayrollPeriod')?.addEventListener('click',()=>setPayrollPeriodStatus('Approved'));
    document.getElementById('lockPayrollPeriod')?.addEventListener('click',()=>setPayrollPeriodStatus('Locked'));
    document.getElementById('exportPayrollCsv')?.addEventListener('click',exportPayrollCsv);
    const annualBenefitYearSelect=document.getElementById('annualBenefitYearSelect');
    if(annualBenefitYearSelect)annualBenefitYearSelect.onchange=()=>{currentBenefitYear=Number(annualBenefitYearSelect.value);render();};
    document.getElementById('generateAnnualBenefitBudget')?.addEventListener('click',()=>{if(!ensureWritable())return;const result=AnnualBenefits.ensurePlan(db,currentBenefitYear,uid);if(AnnualBenefits.isLockedStatus(result.plan.status)){alert('Ngân sách năm đã khóa, không thể tính lại.');return;}result.plan.preparedBy=result.plan.preparedBy||auditActor(currentSecurityContext()||{display_name:'Giám đốc Demo'});result.plan.preparedAt=result.plan.preparedAt||new Date().toISOString();result.plan.calculationVersion='ALPHA-BENEFITS-4.5.46';if(!saveDB()){alert('Không thể lưu ngân sách năm.');return;}render();toastMsg(`Đã tính ngân sách thưởng và phúc lợi năm ${currentBenefitYear}`);});
    document.getElementById('editAnnualBenefitBudget')?.addEventListener('click',()=>{if(!ensureWritable())return;const plan=AnnualBenefits.findPlan(db,currentBenefitYear);if(plan&&AnnualBenefits.isLockedStatus(plan.status)){alert('Ngân sách năm đã khóa, không thể sửa tham số.');return;}openForm('annualBenefitBudgets',plan?.id||'',plan||{...AnnualBenefits.defaultPlan(currentBenefitYear),year:currentBenefitYear});});
    document.getElementById('reviewAnnualBenefitBudget')?.addEventListener('click',()=>setAnnualBenefitStatus('Reviewed'));
    document.getElementById('approveAnnualBenefitBudget')?.addEventListener('click',()=>setAnnualBenefitStatus('Approved'));
    document.getElementById('lockAnnualBenefitBudget')?.addEventListener('click',()=>setAnnualBenefitStatus('Locked'));
    document.getElementById('exportAnnualBenefitCsv')?.addEventListener('click',exportAnnualBenefitCsv);
    document.querySelectorAll('.edit-benefit-factor').forEach(button=>button.onclick=()=>{const plan=AnnualBenefits.findPlan(db,currentBenefitYear);if(!plan||AnnualBenefits.isLockedStatus(plan.status)){alert('Ngân sách chưa được tạo hoặc đã khóa.');return;}const person=getById(db.people,button.dataset.personId),current=Number(plan.employeePerformanceFactors?.[person.id]??plan.defaultEmployeePerformanceFactor??1),raw=prompt(`Hệ số hiệu suất của ${person?.name||'nhân viên'} (0–2):`,String(current));if(raw===null)return;const value=Number(raw);if(!Number.isFinite(value)||value<0||value>2){alert('Hệ số phải nằm trong khoảng 0–2.');return;}plan.employeePerformanceFactors={...(plan.employeePerformanceFactors||{}),[person.id]:value};saveDB();render();toastMsg('Đã cập nhật hệ số hiệu suất cá nhân');});
    document.querySelectorAll('.edit-payroll-item').forEach(button=>button.onclick=()=>openForm('payrollItems',button.dataset.id));
    const payrollSearch=document.getElementById('payrollDetailSearch'),payrollType=document.getElementById('payrollTypeFilter');
    if(payrollSearch){const apply=()=>{writeTableFilterState(tableFilterKey('payroll','payrollDetailTable'),{search:payrollSearch.value,selects:[payrollType?.value||'']});const period=Payroll.findPeriod(db,currentPayrollMonth),term=payrollSearch.value.trim().toLowerCase(),type=payrollType?.value||'',rows=Payroll.calculatePeriod(db,currentPayrollMonth).filter(row=>(!term||`${row.employeeCode} ${row.employeeName} ${row.department} ${row.role}`.toLowerCase().includes(term))&&(!type||row.type===type));const host=document.getElementById('payrollDetailTable');if(host)host.innerHTML=payrollDetailTable(rows,period);host?.querySelectorAll('.edit-payroll-item').forEach(button=>button.onclick=()=>openForm('payrollItems',button.dataset.id));};payrollSearch.oninput=apply;if(payrollType)payrollType.onchange=apply;}

    document.querySelectorAll('.delete-row').forEach(b=>b.onclick=()=>deleteRow(b.dataset.type,b.dataset.id));
    document.querySelectorAll('.edit-row').forEach(b=>b.onclick=()=>openForm(b.dataset.type,b.dataset.id));
    document.querySelectorAll('.trash-restore').forEach(button=>button.onclick=async()=>{button.disabled=true;await restoreTrashEntry(button.dataset.trashId);button.disabled=false;});
    document.querySelectorAll('.trash-purge').forEach(button=>button.onclick=async()=>{const entry=RecycleBin.findEntry(db,button.dataset.trashId);if(!entry)return;if(!confirm(`Xóa vĩnh viễn “${entry.displayName||trashMeta(entry.entityType)[0]}”? Thao tác này không thể hoàn tác.`))return;button.disabled=true;const done=await purgeTrashEntry(entry.id);if(done){render();toastMsg('Đã xóa vĩnh viễn nội dung khỏi Thùng rác');}else button.disabled=false;});
    const filterTrashRows=()=>{const query=String(document.getElementById('trashSearch')?.value||'').trim().toLowerCase(),type=document.getElementById('trashTypeFilter')?.value||'';let visible=0;document.querySelectorAll('[data-trash-row]').forEach(row=>{const show=(!query||String(row.dataset.search||'').includes(query))&&(!type||row.dataset.trashType===type);row.hidden=!show;if(show)visible+=1;});const count=document.getElementById('trashVisibleCount');if(count)count.textContent=`${visible} bản ghi`;document.getElementById('trashFilterEmpty')?.classList.toggle('hidden',visible>0||!(db.trashEntries||[]).length);};
    const trashSearch=document.getElementById('trashSearch'),trashTypeFilter=document.getElementById('trashTypeFilter');if(trashSearch)trashSearch.oninput=filterTrashRows;if(trashTypeFilter)trashTypeFilter.onchange=filterTrashRows;
    document.getElementById('purgeExpiredTrash')?.addEventListener('click',async()=>{const expired=RecycleBin.expiredEntries(db);if(!expired.length)return;const security=await requirePrivilegedAction(['security.manage'],'Dọn nội dung quá hạn trong Thùng rác');if(!security)return;if(!confirm(`Xóa vĩnh viễn ${expired.length} mục đã quá thời hạn 30 ngày?`))return;const count=await purgeExpiredTrash({notify:false,securityVerified:true});render();toastMsg(`Đã xóa vĩnh viễn ${count} mục quá hạn`);});
    document.getElementById('purgeAllTrash')?.addEventListener('click',async()=>{const entries=[...(db.trashEntries||[])];if(!entries.length)return;const security=await requirePrivilegedAction(['security.manage'],'Xóa toàn bộ Thùng rác');if(!security)return;if(!confirm(`Xóa vĩnh viễn toàn bộ ${entries.length} mục trong Thùng rác? Không thể hoàn tác.`))return;let count=0;for(const entry of entries){if(await purgeTrashEntry(entry.id,{securityVerified:true,automatic:true}))count+=1;}render();toastMsg(`Đã xóa vĩnh viễn ${count}/${entries.length} mục`);});
    bindTimesheetApprovalActions(document);
    document.querySelectorAll('.adjust-journal').forEach(b=>b.onclick=()=>openJournalAdjustment(b.dataset.id));
    document.querySelectorAll('.view-journal').forEach(b=>b.onclick=()=>openReadOnlyRecord('journalEntries',b.dataset.id,'Chi tiết bút toán đã ghi sổ'));
    document.querySelectorAll('[data-secondary-add]').forEach(b=>b.onclick=()=>openForm(b.dataset.secondaryAdd));
    document.querySelectorAll('[data-accounting-tab]').forEach(b=>b.onclick=()=>{currentAccountingTab=b.dataset.accountingTab;render();});
    document.getElementById('runStatutoryCloudAudit')?.addEventListener('click',runStatutoryCloudAudit);
    document.getElementById('certifyStatutoryCloud')?.addEventListener('click',certifyStatutoryCloud);
    document.getElementById('openStatutoryExportCenter')?.addEventListener('click',()=>navigate('exports'));
    document.querySelectorAll('.edit-report-note').forEach(b=>b.onclick=()=>{const r=currentRange(),code=b.dataset.sectionCode,id=b.dataset.noteId||'',noteType=b.dataset.noteType==='reportNotesTT99'?'reportNotesTT99':'reportNotesTT133';const generated=(noteType==='reportNotesTT99'?Calc.tt99B09(db,r):Calc.tt133B09(db,r)).sections.find(x=>x.sectionCode===code);const notes=db[noteType]||[];const existing=notes.find(x=>String(x.id)===String(id))||notes.find(x=>x.sectionCode===code&&x.periodFrom===r.from&&x.periodTo===r.to);openForm(noteType,existing?.id||'',existing||{periodFrom:r.from,periodTo:r.to,sectionCode:code,sectionTitle:generated?.title||'',content:generated?.content||'',status:'draft'});});
    document.querySelectorAll('[data-procurement-tab]').forEach(b=>b.onclick=()=>{currentProcurementTab=b.dataset.procurementTab;render();});
    document.querySelectorAll('[data-financial-tab]').forEach(b=>b.onclick=()=>{currentFinancialTab=b.dataset.financialTab;render();});
    document.querySelectorAll('[data-financial-jump]').forEach(b=>b.onclick=()=>{currentFinancialTab=b.dataset.financialJump;render();});
    document.querySelectorAll('.recognize-purchase').forEach(b=>b.onclick=()=>recognizePurchaseOrder(b.dataset.id));
    document.querySelectorAll('.rebuild-tool-schedule').forEach(b=>b.onclick=()=>{try{rebuildToolSchedule(b.dataset.id);}catch(error){alert(error.message||'Không thể tạo lại lịch phân bổ.');}});
    document.querySelectorAll('.rebuild-asset-schedule').forEach(b=>b.onclick=()=>{try{rebuildAssetSchedule(b.dataset.id);}catch(error){alert(error.message||'Không thể tạo lại lịch khấu hao.');}});
    const controlTabs=[...document.querySelectorAll('[data-control-tab]')];
    const activateControlTab=(next)=>{if(!['actual','commercial','cash','quality'].includes(next))return;if(next!==currentControlTab){currentControlTab=next;render();}requestAnimationFrame(()=>document.getElementById(`control-tab-${next}`)?.focus());};
    controlTabs.forEach((b,index)=>{b.onclick=()=>activateControlTab(b.dataset.controlTab);b.onkeydown=(e)=>{let nextIndex=index;if(e.key==='ArrowRight')nextIndex=(index+1)%controlTabs.length;else if(e.key==='ArrowLeft')nextIndex=(index-1+controlTabs.length)%controlTabs.length;else if(e.key==='Home')nextIndex=0;else if(e.key==='End')nextIndex=controlTabs.length-1;else return;e.preventDefault();activateControlTab(controlTabs[nextIndex].dataset.controlTab);};});
    document.querySelectorAll('[data-accounting-add]').forEach(b=>b.onclick=()=>openForm(b.dataset.accountingAdd));
    document.querySelectorAll('.journal-post').forEach(b=>b.onclick=async()=>{if(b.disabled)return;const security=await requirePrivilegedAction(['accounting.post'],'Ghi sổ chứng từ');if(!security)return;const e=getById(db.journalEntries,b.dataset.id);if(!e)return;if(Calc.statusIs(e.status,'posted')){alert('Chứng từ đã ghi sổ là bất biến. Hãy lập chứng từ điều chỉnh hoặc chứng từ đảo.');return;}if(Calc.isPeriodLocked(db,e.date)){alert('Kỳ kế toán đã khóa, không thể ghi sổ chứng từ.');return;}const candidate={...e,status:'Posted'};const check=Calc.entryValidation(db,candidate,e.id);if(!check.valid){alert(check.errors.join('\n'));return;}e.status='Posted';e.postedAt=new Date().toISOString();e.postedBy=security.user_id||auditActor(security);e.postingHash=Calc.postingHash(e);saveDB();render();toastMsg('Đã ghi sổ và khóa nội dung chứng từ');});
    document.querySelectorAll('.approval-action').forEach(b=>b.onclick=async()=>{const security=await requirePrivilegedAction(['procurement.approve'],'Phê duyệt yêu cầu');if(!security)return;const a=getById(db.approvals,b.dataset.id);if(a){a.status=b.dataset.status;a.approvedAt=new Date().toISOString();a.approvedBy=security.user_id||auditActor(security);saveDB();render();toastMsg(`Đã cập nhật: ${b.dataset.status}`);} });
    const searchers={
      project:['[data-table-search="project"]','[data-project-status]',()=>filteredProjects('projects'),'projectTable',projectsTable,(x,q)=>`${x.code} ${x.name} ${clientName(x.clientId)}`.toLowerCase().includes(q)],
      task:['[data-table-search="task"]','[data-task-status]',()=>filterRowsForView(db.tasks,'tasks'),'taskTable',tasksTable,(x,q)=>`${x.title} ${projectName(x.projectId)} ${personName(x.assigneeId)}`.toLowerCase().includes(q)],
      timesheet:['[data-table-search="timesheet"]','[data-ts-approved]',()=>filterRowsForView(db.timesheets.filter(x=>Calc.inRange(x.date,currentRange().from,currentRange().to)),'timesheets'),'timesheetTable',timesheetsTable,(x,q)=>`${projectName(x.projectId)} ${personName(x.personId)} ${x.description}`.toLowerCase().includes(q)],
      people:['[data-table-search="people"]','[data-people-type]',()=>filterRowsForView(db.people,'people'),'peopleTable',peopleTable,(x,q)=>`${x.code} ${x.name} ${x.role} ${x.department}`.toLowerCase().includes(q)],
      finance:['[data-table-search="finance"]','[data-finance-type]',()=>filterRowsForView(db.finance.filter(x=>inDateRange(x.date)),'finance'),'financeTable',financeTable,(x,q)=>`${x.category} ${x.description} ${projectName(x.projectId)}`.toLowerCase().includes(q)],
      documents:['[data-table-search="documents"]',null,()=>filteredDocuments(),'documentsTable',documentsTable,(x,q)=>`${x.title} ${x.type} ${projectName(x.projectId)} ${x.status}`.toLowerCase().includes(q)]
    };
    Object.values(searchers).forEach(([sSel,fSel,dataFn,target,tableFn,match])=>{
      const search=document.querySelector(sSel); if(!search) return; const select=fSel?document.querySelector(fSel):null;
      const stateKey=tableFilterKey(currentView,target),saved=readTableFilterState(stateKey);
      search.value=saved.search||'';if(select&&saved.selects?.length)select.value=saved.selects[0]||'';
      const apply=()=>{ const q=search.value.trim().toLowerCase(); const fv=select?.value||'';writeTableFilterState(stateKey,{search:search.value,selects:[fv]});let rows=dataFn().filter(x=>match(x,q)); if(fv){ if(target==='projectTable') rows=rows.filter(x=>x.status===fv); if(target==='taskTable') rows=rows.filter(x=>x.status===fv); if(target==='timesheetTable') rows=rows.filter(x=>String(x.approved)===fv); if(target==='peopleTable') rows=rows.filter(x=>x.type===fv); if(target==='financeTable') rows=rows.filter(x=>x.type===fv); } const host=document.getElementById(target);if(host){host.innerHTML=tableFn(rows);host.querySelectorAll('.delete-row').forEach(b=>b.onclick=()=>deleteRow(b.dataset.type,b.dataset.id));host.querySelectorAll('.edit-row').forEach(b=>b.onclick=()=>openForm(b.dataset.type,b.dataset.id));bindTimesheetApprovalActions(host);}requestAnimationFrame(enhanceResponsiveTables); };
      search.oninput=apply; if(select)select.onchange=apply;apply();
    });
    const scenarioSelect=document.getElementById('forecastScenarioSelect');if(scenarioSelect)scenarioSelect.onchange=()=>{currentForecastScenarioId=scenarioSelect.value;render();};
    const forecastForm=document.getElementById('forecastAssumptionsForm');if(forecastForm)forecastForm.onsubmit=(e)=>{e.preventDefault();if(!ensureWritable())return;const fd=new FormData(forecastForm),scenario=getById(db.financialForecastScenarios,fd.get('scenarioId'));if(!scenario)return;['monthlyRevenueGrowthPercent','collectionRatePercent','directCostRatioPercent','pipelineFactorPercent','pipelineLagMonths','pipelineDeliveryMonths','payrollGrowthPercent','overheadGrowthPercent','taxRatePercent','taxPaymentLagMonths','minimumCashBuffer'].forEach((key)=>scenario[key]=Number(fd.get(key)||0));saveDB();render();toastMsg('Đã lưu giả định và tính lại dự báo');};
    document.getElementById('repairFinancialLinks')?.addEventListener('click',()=>{if(!ensureWritable())return;const result=Calc.repairExactLinks(db);if(result.count){db.financialLinkAuditRuns.unshift({id:uid('fla'),date:new Date().toISOString(),repairCount:result.count,repairs:result.repairs});saveDB();render();toastMsg(`Đã sửa ${result.count} liên kết chắc chắn`);}else toastMsg('Không có liên kết chắc chắn nào cần sửa');});
    document.getElementById('syncTaxCalendar')?.addEventListener('click',()=>{if(!ensureWritable())return;const result=refreshTaxCalendar({persist:false});if(result.changed&&!saveDB()){alert('Không thể lưu lịch thuế tự động.');return;}buildNotifications();render();toastMsg(`Đã đồng bộ ${result.count} nghĩa vụ thuế cho ${result.years.join(', ')}`);});
    const taxPackageInput=document.getElementById('taxPackageInput'),taxPackageStatus=document.getElementById('taxPackageStatus');
    document.getElementById('importTaxPackage')?.addEventListener('click',async()=>{const security=await requirePrivilegedAction(['tax.write'],'Nhập gói nghiệp vụ thuế');if(!security)return;const file=taxPackageInput?.files?.[0];if(!file){if(taxPackageStatus)taxPackageStatus.textContent='Hãy chọn file JSON của gói thuế.';return;}try{if(taxPackageStatus)taxPackageStatus.textContent='Đang kiểm tra cấu trúc, ngày hiệu lực và checksum…';const parsed=await TaxPackages.parseFile(file),validation=await TaxPackages.validatePackage(parsed);if(!validation.valid)throw new Error(validation.errors.join('\n'));if(!confirm(`Gói thuế hợp lệ. SHA-256: ${validation.packageSha256}\nBiểu mẫu: ${(validation.normalized.forms||[]).map(x=>x.code).join(', ')}\nNhập ở trạng thái Candidate?`))return;const before=clone(db.taxCompliancePackages||[]),record=TaxPackages.install(db,validation,auditActor(security));try{const cloud=await persistTaxPackageCloud(record);if(cloud){const i=db.taxCompliancePackages.findIndex(x=>x.id===record.id);if(i>=0)db.taxCompliancePackages[i]=cloud;}}catch(error){db.taxCompliancePackages=before;throw error;}db.importLogs.unshift({id:uid('tax-package'),createdAt:new Date().toISOString(),type:'Tax compliance package import',packageId:record.packageId,version:record.version,sha256:record.packageSha256,status:'Candidate'});if(!saveDB())throw new Error('Không thể lưu gói thuế.');toastMsg('Đã nhập gói thuế ở trạng thái Candidate');render();}catch(error){if(taxPackageStatus)taxPackageStatus.textContent=`Không thể nhập: ${error.message||error}`;else alert(error.message||error);}});
    document.querySelectorAll('.activate-tax-package').forEach(button=>button.addEventListener('click',async()=>{const security=await requirePrivilegedAction(['tax.write'],'Kích hoạt gói nghiệp vụ thuế');if(!security)return;const target=(db.taxCompliancePackages||[]).find(x=>String(x.id)===String(button.dataset.packageId));if(!target)return;if(!confirm(`Kích hoạt ${target.name} phiên bản ${target.version} từ ${target.effectiveFrom}?`))return;try{const cloud=await activateTaxPackageCloud(target.id);if(cloud)await loadTaxPackagesCloud();else TaxPackages.activate(db,target.id,auditActor(security));}catch(error){alert(`Không thể kích hoạt gói thuế: ${error.message||error}`);return;}db.importLogs.unshift({id:uid('tax-package-activate'),createdAt:new Date().toISOString(),type:'Tax compliance package activation',packageId:target.packageId,version:target.version,sha256:target.packageSha256,status:'Active'});refreshTaxCalendar({persist:false});if(!saveDB()){alert('Không thể lưu trạng thái gói thuế.');return;}buildNotifications();toastMsg('Đã kích hoạt gói nghiệp vụ thuế và cập nhật lịch thuế');render();}));
    document.getElementById('downloadTaxPackageExample')?.addEventListener('click',async()=>{try{let blob;if(window.AlphaTaxComplianceReference)blob=new Blob([JSON.stringify(window.AlphaTaxComplianceReference,null,2)+'\n'],{type:'application/json;charset=utf-8'});else{const response=await fetch(new URL('templates/tax/VN_TAX_2026_BASELINE_PACKAGE.json',document.baseURI),{cache:'no-store'});if(!response.ok)throw new Error('Không tìm thấy gói thuế tham chiếu.');blob=await response.blob();}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ALPHA_VN_TAX_COMPLIANCE_PACKAGE_REFERENCE.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toastMsg('Đã tải gói thuế tham chiếu');}catch(error){alert(`Không thể tải gói thuế tham chiếu: ${error.message||error}`);}});
    const sf=document.getElementById('settingsForm');
    const templateInput=document.getElementById('statutoryTemplateInput');
    const templateStatus=document.getElementById('statutoryTemplateStatus');
    document.getElementById('importStatutoryTemplate')?.addEventListener('click',async()=>{
      const security=await requirePrivilegedAction(['reports.import'],'Nhập bộ mẫu BCTC');if(!security)return;
      const file=templateInput?.files?.[0];if(!file){if(templateStatus)templateStatus.textContent='Hãy chọn file ZIP hoặc JSON của bộ mẫu.';return;}
      try{
        if(templateStatus)templateStatus.textContent='Đang đọc và kiểm tra checksum bộ mẫu…';
        const parsed=await StatutoryTemplates.parseFile(file),validation=await StatutoryTemplates.validatePackage(parsed);
        if(!validation.valid)throw new Error(validation.errors.join('\n'));
        const active=StatutoryTemplates.getActiveTemplate(db,db.settings.accountingRegime),changes=StatutoryTemplates.diffPackages(active,validation.normalized);
        const summary=changes.length?changes.slice(0,12).join('\n'):'Không phát hiện thay đổi trình bày so với bộ mẫu tùy chỉnh đang hoạt động.';
        if(!confirm(`Bộ mẫu hợp lệ. SHA-256: ${validation.packageSha256}

Thay đổi chính:
${summary}

Nhập vào danh sách phiên bản?`))return;
        const beforeTemplates=clone(db.statutoryReportTemplates||[]),record=StatutoryTemplates.install(db,validation,auditActor(security));
        try{const cloudRecord=await persistStatutoryTemplateCloud(record);if(cloudRecord){const index=db.statutoryReportTemplates.findIndex(x=>x.id===record.id);if(index>=0)db.statutoryReportTemplates[index]=cloudRecord;}}
        catch(error){db.statutoryReportTemplates=beforeTemplates;throw error;}
        db.importLogs.unshift({id:uid('template'),createdAt:new Date().toISOString(),type:'Statutory report template import',templateId:record.templateId,version:record.version,sha256:record.packageSha256,status:'Candidate'});
        if(!saveDB())throw new Error('Không thể lưu bộ mẫu.');
        toastMsg('Đã nhập bộ mẫu ở trạng thái Candidate');render();
      }catch(error){if(templateStatus)templateStatus.textContent=`Không thể nhập: ${error.message||error}`;else alert(error.message||error);}
    });
    document.querySelectorAll('.activate-statutory-template').forEach(button=>button.addEventListener('click',async()=>{
      const security=await requirePrivilegedAction(['reports.import'],'Kích hoạt bộ mẫu BCTC');if(!security)return;
      const target=(db.statutoryReportTemplates||[]).find(x=>String(x.id)===String(button.dataset.templateId));
      if(!target)return;
      if(!confirm(`Kích hoạt ${target.name} phiên bản ${target.version} từ ${target.effectiveFrom}? Báo cáo các năm cũ vẫn giữ lịch sử bộ mẫu trong nhật ký.`))return;
      try{const cloudTarget=await activateStatutoryTemplateCloud(target.id);if(cloudTarget){await loadStatutoryTemplatesCloud();}else StatutoryTemplates.activate(db,target.id,auditActor(security));}
      catch(error){alert(`Không thể kích hoạt bộ mẫu trên Supabase: ${error.message||error}`);return;}
      db.importLogs.unshift({id:uid('template-activate'),createdAt:new Date().toISOString(),type:'Statutory report template activation',templateId:target.templateId,version:target.version,sha256:target.packageSha256,status:'Active'});
      statutoryCloudAudit=null;if(!saveDB()){alert('Không thể kích hoạt bộ mẫu.');return;}toastMsg('Đã kích hoạt bộ mẫu BCTC');render();
    }));
    document.getElementById('downloadStatutoryTemplateExample')?.addEventListener('click',async()=>{
      try{
        const regime=accountingRegimeCode(),fileName=regime==='TT99'?'TT99_2026_BASELINE_TEMPLATE.json':regime==='TT132'?'TT132_2026_BASELINE_TEMPLATE.json':'TT133_2026_BASELINE_TEMPLATE.json';
        let blob=null;
        if(regime==='TT133'&&window.AlphaStatutoryTemplateReference)blob=new Blob([JSON.stringify(window.AlphaStatutoryTemplateReference,null,2)+'\n'],{type:'application/json;charset=utf-8'});
        else{
          const url=new URL(`templates/statutory/${fileName}`,document.baseURI);
          const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Không tìm thấy gói mẫu tham chiếu ${regime}.`);blob=await response.blob();
        }
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ALPHA_${regime}_BCTC_TEMPLATE_REFERENCE.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toastMsg(`Đã tải gói mẫu ${regime} tham chiếu`);
      }catch(error){alert(`Không thể tải gói mẫu tham chiếu: ${error.message||error}`);}
    });
    if(sf)sf.onsubmit=(event)=>{
      event.preventDefault();
      if(!ensureWritable())return;
      const fd=new FormData(sf),previousRegime=db.settings.accountingRegime||'',previousCitRate=Number(db.settings.corporateTaxRate||0),previousCitEffectiveDate=String(db.settings.corporateTaxRateEffectiveDate||'');
      const companyName=String(fd.get('companyName')||'').trim();
      const companyAddress=String(fd.get('companyAddress')||'').trim();
      let taxpayerCode=String(fd.get('taxpayerCode')||'').replace(/[.\s]/g,'').trim();
      if(/^\d{13}$/.test(taxpayerCode))taxpayerCode=`${taxpayerCode.slice(0,10)}-${taxpayerCode.slice(10)}`;
      if(!companyName){alert('Cần khai báo tên doanh nghiệp.');return;}
      if(taxpayerCode&&!/^\d{10}(?:-\d{3})?$/.test(taxpayerCode)){
        alert('Mã số thuế cần gồm 10 chữ số hoặc 10 chữ số kèm mã đơn vị phụ thuộc 3 chữ số.');return;
      }
      db.settings.companyName=companyName;
      db.settings.companyAddress=companyAddress;
      db.settings.taxpayerCode=taxpayerCode;
      ['targetMargin','laborBudgetRatio','overheadMonthly','monthlyWorkingHours','dailyWorkingHours','overtimeMultiplier','employeeInsuranceRate','employerInsuranceRate','personalDeduction','dependentDeduction','defaultVatRate','reducedVatRate','pitWithholdingRate','pitWithholdingThreshold','pitWithholdingThresholdPrevious','taxReminderWindowDays','employerBurdenRate','corporateTaxRate','latePaymentDailyRate','maxContractValue','fixedAssetThreshold','toolMaxAllocationMonths','forecastHorizonMonths','minimumCashBuffer'].forEach(key=>{if(fd.has(key))db.settings[key]=Number(fd.get(key)||0);});
      ['reportUnit','accountingRegime','accountingRegimeEffectiveDate','accountingPolicyVersion','vatMethod','vatReductionEnd','taxFilingFrequency','pitWithholdingThresholdEffectiveDate','corporateTaxRateEffectiveDate','taxAuthority','taxContactEmail','taxRuleVersion','procurementPolicyVersion','financialAnalyticsPolicyVersion','payrollPolicyVersion','annualBenefitsPolicyVersion','fixedPitScheduleEffectiveDate'].forEach(key=>{if(fd.has(key))db.settings[key]=String(fd.get(key)??db.settings[key]??'').trim();});
      db.settings.citRateMode='Manual';
      const citEffective=db.settings.corporateTaxRateEffectiveDate||`${new Date().getFullYear()}-01-01`,citRate=Math.max(0,Math.min(100,Number(db.settings.corporateTaxRate)||0));
      db.settings.citManualRateHistory=Array.isArray(db.settings.citManualRateHistory)?db.settings.citManualRateHistory:[];
      const citEntry={effectiveFrom:citEffective,rate:citRate,note:'Thuế suất TNDN nhập thủ công trong Thiết lập',updatedAt:new Date().toISOString(),updatedBy:auditActor(currentSecurityContext()||{})};
      const citIndex=db.settings.citManualRateHistory.findIndex(row=>String(row.effectiveFrom||row.effective_from)===citEffective);
      if(citIndex>=0)db.settings.citManualRateHistory[citIndex]={...db.settings.citManualRateHistory[citIndex],...citEntry};else db.settings.citManualRateHistory.push(citEntry);
      db.settings.citManualRateHistory.sort((a,b)=>String(a.effectiveFrom||'').localeCompare(String(b.effectiveFrom||'')));
      if(previousCitRate!==citRate||previousCitEffectiveDate!==citEffective){db.importLogs=Array.isArray(db.importLogs)?db.importLogs:[];db.importLogs.unshift({id:uid('cit-rate'),createdAt:new Date().toISOString(),type:'Manual CIT rate change',fromRate:previousCitRate,toRate:citRate,effectiveFrom:citEffective,status:'Applied'});}
      if(previousRegime!==db.settings.accountingRegime){
        const appliedProfile=applyAccountingRegimeProfile(previousRegime);
        db.importLogs=Array.isArray(db.importLogs)?db.importLogs:[];
        db.importLogs.unshift({id:uid('regime'),createdAt:new Date().toISOString(),type:'Accounting regime change',from:previousRegime,to:db.settings.accountingRegime,effectiveDate:db.settings.accountingRegimeEffectiveDate,status:`Applied ${appliedProfile.code} profile`});
        statutoryCloudAudit=null;
      }
      Payroll.refreshDraftPeriods(db,uid);
      refreshTaxCalendar({persist:false});
      if(!saveDB()){alert('Không thể lưu thiết lập. Vui lòng kiểm tra quyền hoặc kết nối Cloud.');return;}
      buildNotifications();
      toastMsg('Đã lưu thiết lập, cập nhật BCTC và đồng bộ lịch thuế');
      render();
    };
    document.getElementById('settingsExport')?.addEventListener('click',exportData);
    document.getElementById('exportIntegrity')?.addEventListener('click',exportIntegrityReport);
    document.getElementById('lockCurrentPeriod')?.addEventListener('click',async()=>{
      const security=await requirePrivilegedAction(['accounting.close','accounting.period.lock'],'Khóa kỳ kế toán');if(!security)return;
      const r=currentRange();if(!r.from||!r.to){alert('Cần chọn đủ ngày bắt đầu và kết thúc.');return;}
      const timestamp=new Date().toISOString(),actor=auditActor(security);
      let existing=(db.accountingPeriods||[]).find(x=>x.from===r.from&&x.to===r.to);
      if(existing){existing.locked=true;existing.lockedAt=timestamp;existing.lockedBy=security.user_id||actor;existing.history=[...(existing.history||[]),{action:'LOCK',at:timestamp,by:actor}];}
      else db.accountingPeriods.unshift({id:uid('period'),label:`Kỳ ${r.from} — ${r.to}`,from:r.from,to:r.to,locked:true,lockedAt:timestamp,lockedBy:security.user_id||actor,history:[{action:'LOCK',at:timestamp,by:actor}]});
      saveDB();render();toastMsg('Đã khóa kỳ kế toán');
    });
    document.getElementById('unlockCurrentPeriod')?.addEventListener('click',async()=>{
      const security=await requirePrivilegedAction(['accounting.close','accounting.period.lock'],'Mở khóa kỳ kế toán');if(!security)return;
      const r=currentRange(),targets=(db.accountingPeriods||[]).filter(x=>x.from===r.from&&x.to===r.to&&x.locked);
      if(!targets.length){alert('Khoảng đang xem chưa có kỳ kế toán bị khóa.');return;}
      const reason=String(prompt('Nhập lý do mở khóa kỳ kế toán (bắt buộc):','')||'').trim();
      if(reason.length<8){alert('Lý do mở khóa phải có ít nhất 8 ký tự để lưu dấu vết kiểm toán.');return;}
      if(!confirm('Mở khóa kỳ sẽ cho phép tạo và ghi sổ chứng từ trong khoảng này. Tiếp tục?'))return;
      const timestamp=new Date().toISOString(),actor=auditActor(security);
      targets.forEach(x=>{x.locked=false;x.unlockedAt=timestamp;x.unlockedBy=security.user_id||actor;x.unlockReason=reason;x.history=[...(x.history||[]),{action:'UNLOCK',at:timestamp,by:actor,reason}];});
      saveDB();render();toastMsg('Đã mở khóa kỳ kế toán và lưu lý do kiểm toán');
    });
    document.getElementById('resetDemo')?.addEventListener('click',()=>{ if(!ensureWritable())return; if(confirm('Khôi phục toàn bộ dữ liệu mẫu? Dữ liệu hiện tại sẽ bị thay thế.')){db=migrateDB(clone(demoData));bootstrapProcurementAutomation(false);saveDB();render();toastMsg('Đã khôi phục dữ liệu mẫu');} });
    if(currentView==='exports' && window.AlphaExportCenter){ window.AlphaExportCenter.bind({getDB:()=>clone(db),commit:(next,opts={})=>{if(!ensureWritable())return false;db=migrateDB(next);const saved=saveDB();if(saved&&!opts.silent)render();return saved;},range:()=>currentRange(),toast:toastMsg,user:()=>document.getElementById('headerUserName')?.textContent||'Người dùng',rerender:()=>render()}); }
  }

  function attachQuickTableFilters(){
    document.querySelectorAll('.table-card').forEach((card,cardIndex)=>{
      if(card.querySelector(':scope > .table-tools'))return;
      const table=card.querySelector('table');
      if(!table||table.dataset.quickFilterBound==='true')return;
      const body=table.tBodies?.[0];
      if(!body)return;
      const anchor=[...card.children].find(child=>child===table||child.contains(table));
      if(!anchor)return;
      const statusValues=[...new Set([...body.rows].flatMap(row=>[...row.querySelectorAll('.badge')].map(node=>node.textContent.trim())).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
      const tools=document.createElement('div');
      tools.className='table-tools auto-table-tools';
      tools.innerHTML=`<input class="search-input" type="search" aria-label="Tìm nhanh trong bảng ${cardIndex+1}" placeholder="Tìm nhanh trong bảng...">${statusValues.length>1?`<select class="filter-select" aria-label="Lọc trạng thái trong bảng"><option value="">Tất cả trạng thái</option>${statusValues.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select>`:''}<span class="table-count-badge"></span>`;
      card.insertBefore(tools,anchor);
      const search=tools.querySelector('input');
      const status=tools.querySelector('select');
      const heading=card.querySelector('h2,h3')?.textContent?.trim()||table.className||`card-${cardIndex}`;
      const stateKey=tableFilterKey(currentView,`quick:${heading}`),saved=readTableFilterState(stateKey);
      search.value=saved.search||'';if(status&&saved.selects?.length)status.value=saved.selects[0]||'';
      const count=tools.querySelector('.table-count-badge');
      const rows=[...body.rows].filter(row=>!row.classList.contains('table-empty-row'));
      const apply=()=>{
        const term=String(search.value||'').trim().toLocaleLowerCase('vi');
        const statusValue=String(status?.value||'').trim();
        writeTableFilterState(stateKey,{search:search.value,selects:[statusValue]});
        let visible=0;
        rows.forEach(row=>{
          const text=String(row.textContent||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('vi');
          const rowStatuses=[...row.querySelectorAll('.badge')].map(node=>node.textContent.trim());
          const show=(!term||text.includes(term))&&(!statusValue||rowStatuses.includes(statusValue));
          row.hidden=!show;
          if(show)visible+=1;
        });
        count.textContent=`${fmtNum(visible,0)} / ${fmtNum(rows.length,0)} bản ghi`;
        let empty=body.querySelector('.quick-filter-empty-row');
        if(visible===0){
          if(!empty){empty=document.createElement('tr');empty.className='quick-filter-empty-row';empty.innerHTML=`<td colspan="${Math.max(table.rows[0]?.cells.length||1,1)}"><div class="table-empty-state"><span>⌕</span><strong>Không tìm thấy dữ liệu</strong><small>Thử đổi từ khóa hoặc trạng thái lọc.</small></div></td>`;body.appendChild(empty);}
          empty.hidden=false;
        }else if(empty)empty.hidden=true;
      };
      search.addEventListener('input',apply);
      status?.addEventListener('change',apply);
      table.dataset.quickFilterBound='true';
      apply();
    });
  }

  function bindLocalTableFilters(){
    document.querySelectorAll('[data-local-table-filter]').forEach(tools=>{
      const target=document.getElementById(tools.dataset.localTableFilter);
      const table=target?.querySelector('table');
      const body=table?.tBodies?.[0];
      if(!table||!body||tools.dataset.localFilterBound==='true')return;
      const search=tools.querySelector('[data-filter-search]');
      const selects=[...tools.querySelectorAll('[data-filter-text]')];
      const stateKey=tableFilterKey(currentView,`local:${tools.dataset.localTableFilter}`),saved=readTableFilterState(stateKey);
      if(search)search.value=saved.search||'';selects.forEach((select,index)=>{if(saved.selects?.[index]!==undefined)select.value=saved.selects[index]||'';});
      const count=tools.querySelector('[data-filter-count]');
      const rows=[...body.rows].filter(row=>!row.classList.contains('table-empty-row')&&!row.classList.contains('quick-filter-empty-row'));
      const apply=()=>{
        const term=String(search?.value||'').trim().toLocaleLowerCase('vi');
        const rawSelections=selects.map(select=>String(select.value||'').trim());
        writeTableFilterState(stateKey,{search:search?.value||'',selects:rawSelections});
        const selections=rawSelections.map(value=>value.toLocaleLowerCase('vi')).filter(Boolean);
        let visible=0;
        rows.forEach(row=>{
          const rowText=String(row.textContent||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('vi');
          const show=(!term||rowText.includes(term))&&selections.every(value=>rowText.includes(value));
          row.hidden=!show;if(show)visible+=1;
        });
        if(count)count.textContent=`${fmtNum(visible,0)} / ${fmtNum(rows.length,0)} bản ghi`;
        let empty=body.querySelector('.local-filter-empty-row');
        if(visible===0){
          if(!empty){empty=document.createElement('tr');empty.className='local-filter-empty-row';empty.innerHTML=`<td colspan="${Math.max(table.rows[0]?.cells.length||1,1)}"><div class="table-empty-state"><span>⌕</span><strong>Không tìm thấy dữ liệu</strong><small>Thử đổi từ khóa hoặc điều kiện lọc.</small></div></td>`;body.appendChild(empty);}
          empty.hidden=false;
        }else if(empty)empty.hidden=true;
      };
      search?.addEventListener('input',apply);
      selects.forEach(select=>select.addEventListener('change',apply));
      tools.dataset.localFilterBound='true';apply();
    });
  }

  const RESPONSIVE_TABLE_HINT='Vuốt ngang để xem thêm cột';
  let tableRelayoutFrame=0,tableRelayoutTimer=0;
  function scheduleTableRelayout(){
    cancelAnimationFrame(tableRelayoutFrame);clearTimeout(tableRelayoutTimer);
    tableRelayoutFrame=requestAnimationFrame(()=>{
      enhanceResponsiveTables();
      tableRelayoutTimer=setTimeout(enhanceResponsiveTables,260);
    });
  }
  function syncSidebarGridState(){
    const sidebar=document.getElementById('sidebar');
    const shell=document.querySelector('.app-shell');
    const collapsed=Boolean(sidebar?.classList.contains('collapsed'))&&!window.matchMedia('(max-width: 820px)').matches;
    shell?.classList.toggle('sidebar-is-collapsed',collapsed);
    scheduleTableRelayout();
  }
  function configureFilterDrawer(){
    const statusSelect=document.querySelector('#filterForm select[name="status"]');
    const projectSelect=document.getElementById('filterProject');
    const departmentSelect=document.querySelector('#filterForm select[name="department"]');
    if(!statusSelect||!projectSelect)return;
    const controlFilterRows=currentView==='controls'?Calc.portfolioHealth(db,currentRange()).rows:[];
    const sources={dashboard:db.projects,controls:controlFilterRows,projects:db.projects,tasks:db.tasks,documents:db.documents,crm:db.quotes,commercial:db.contracts,people:db.people,payroll:db.people,timesheets:db.timesheets,finance:db.finance,accounting:db.journalEntries,tax:db.taxInvoices,approvals:db.approvals,planning:db.resourcePlans,financialAnalytics:db.projects};
    const data=sources[currentView]||[];
    const statuses=[...new Set(data.map(x=>filterRecordStatus(x,currentView).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    statusSelect.innerHTML='<option value="">Tất cả trạng thái</option>'+statuses.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
    const filters=activeFilters.view===currentView?activeFilters:{status:'',project:'',department:''};
    statusSelect.value=statuses.includes(filters.status)?filters.status:'';
    projectSelect.value=filters.project||'';
    if(departmentSelect){
      const departments=[...new Set(db.people.map(x=>String(x.department||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
      departmentSelect.innerHTML='<option value="">Tất cả bộ môn</option>'+departments.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
      departmentSelect.value=departments.includes(filters.department)?filters.department:'';
      departmentSelect.closest('label')?.classList.toggle('filter-field-muted',!['people','timesheets','planning','payroll','tasks'].includes(currentView));
    }
    const projectLabel=projectSelect.closest('label');
    projectLabel?.classList.toggle('filter-field-muted',['people','payroll'].includes(currentView));
  }
  function setSidebarOpen(open){
    const sidebar=document.getElementById('sidebar');
    const menuButton=document.getElementById('menuBtn');
    if(!sidebar)return;
    sidebar.classList.toggle('open',Boolean(open));
    document.body.classList.toggle('sidebar-open',Boolean(open));
    if(!open){document.body.classList.remove('mobile-more-open');syncActiveNavGroup();}
    menuButton?.setAttribute('aria-expanded',String(Boolean(open)));
    syncSidebarGridState();
  }
  const ACTION_ICONS={
    'Sửa':'✎','Xóa':'⌫','Duyệt':'✓','Từ chối':'×','Ghi sổ':'⇥','Đã khóa':'🔒',
    'Tạo lại lịch':'↻','Ghi nhận':'✓','Xem':'↗','Tải':'⇩','Hủy':'×'
  };
  function logicalRowCells(row,columnCount){
    const logical=new Array(Math.max(1,columnCount)).fill(null);let cursor=0;
    [...(row?.cells||[])].forEach(cell=>{
      while(cursor<logical.length&&logical[cursor])cursor+=1;
      const span=Math.max(1,Number(cell.colSpan)||1);
      for(let offset=0;offset<span&&cursor+offset<logical.length;offset+=1)logical[cursor+offset]=cell;
      cursor+=span;
    });
    return logical;
  }
  function clearGeneratedTableGrid(table,headers,columnCount){
    table.querySelector('colgroup[data-auto-columns]')?.remove();
    table.classList.remove('table-auto-columns','table-generated-grid');
    table.style.removeProperty('--table-fitted-width');
    table.style.removeProperty('--table-grid-width');
    headers.forEach((header,index)=>{
      header.style.removeProperty('width');
      [...table.rows].slice(1).forEach(row=>logicalRowCells(row,columnCount)[index]?.style.removeProperty('width'));
    });
  }
  function tableColumnTextMetrics(table,columnIndex,columnCount=Number(table.dataset.columnCount)||1){
    const values=[...table.rows].slice(0,32).map(row=>String(logicalRowCells(row,columnCount)[columnIndex]?.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
    const longest=values.reduce((max,value)=>Math.max(max,value.length),0);
    const words=values.reduce((max,value)=>Math.max(max,value.split(/\s+/).length),0);
    const longestToken=values.reduce((max,value)=>Math.max(max,...value.split(/[\s/—•-]+/).map(token=>token.length)),0);
    return {longest,words,longestToken};
  }
  function estimatedActionColumnWidth(table,columnIndex,columnCount=Number(table.dataset.columnCount)||1){
    let required=72;
    [...table.tBodies||[]].forEach(body=>[...body.rows].forEach(row=>{
      const cell=logicalRowCells(row,columnCount)[columnIndex];if(!cell||Number(cell.colSpan||1)>1)return;
      const controls=[...cell.querySelectorAll('button,[role="button"],.table-lock-state')];
      if(!controls.length)return;
      const controlWidth=controls.reduce((sum,control)=>{
        const label=String(control.getAttribute('aria-label')||control.title||control.textContent||'').replace(/\s+/g,' ').trim();
        const iconOnly=control.classList.contains('icon-btn')||(!control.classList.contains('table-lock-state')&&String(control.textContent||'').trim().length<=2);
        return sum+(iconOnly?36:Math.min(126,28+Math.max(2,label.length)*6));
      },0);
      required=Math.max(required,controlWidth+Math.max(0,controls.length-1)*6+18);
    }));
    return Math.max(76,Math.min(286,Math.ceil(required+8)));
  }
  function applyDesktopTableColumnLayout(table,wrap,headers,columnCount){
    const authored=[...table.querySelectorAll(':scope > colgroup')].find(group=>!group.matches('[data-auto-columns]'));
    const preserveAuthoredGeometry=Boolean(authored&&(table.classList.contains('payroll-detail-table')||table.classList.contains('annual-benefit-table')));
    table.classList.add('table-column-grid','table-grid-exact');
    table.dataset.gridVersion=RELEASE_VERSION;
    if(preserveAuthoredGeometry){
      clearGeneratedTableGrid(table,headers,columnCount);
      table.classList.add('table-authored-grid');
      table.classList.remove('table-generated-grid');
      table.dataset.gridContract='authored';
      return;
    }
    table.classList.remove('table-authored-grid');
    if(!headers.length||columnCount>30){
      clearGeneratedTableGrid(table,headers,columnCount);
      table.dataset.gridContract='native';
      return;
    }
    const wrapWidth=Math.max(0,Math.floor(wrap.clientWidth||table.parentElement?.clientWidth||0)-2);
    if(wrapWidth<280)return;
    const semantics=headers.map(header=>[...header.classList].find(name=>name.startsWith('table-col-'))||'table-col-text');
    const minimumWidths=new Array(columnCount).fill(0);
    const weights=new Array(columnCount).fill(1);
    const fixedWidths=new Array(columnCount).fill(0);
    semantics.forEach((semantic,index)=>{
      const label=String(headers[index]?.textContent||'').trim().toLowerCase();
      const metrics=tableColumnTextMetrics(table,index,columnCount);
      if(semantic==='table-col-actions'){
        fixedWidths[index]=estimatedActionColumnWidth(table,index,columnCount);
        return;
      }
      let base=semantic==='table-col-primary'?1.38:semantic==='table-col-numeric'?.92:semantic==='table-col-date'?.82:semantic==='table-col-status'?1.02:semantic==='table-col-progress'?1.04:1.1;
      if(/ngày|hạn|kỳ|vat|tỷ lệ|thuế suất/.test(label))base*=.82;
      if(/nội dung|diễn giải|dự án|hợp đồng|đối tượng|khách hàng|nhà cung cấp|người nhận|họ tên/.test(label))base*=1.18;
      const contentFactor=Math.max(.86,Math.min(1.65,.78+Math.sqrt(Math.max(4,metrics.longest))/5.8));
      weights[index]=base*contentFactor;
      minimumWidths[index]=(semantic==='table-col-numeric'||semantic==='table-col-date')?Math.max(columnCount<=8?104:88,Math.min(columnCount<=8?150:132,40+metrics.longestToken*5.8)):
        semantic==='table-col-status'?Math.max(columnCount<=8?100:88,Math.min(columnCount<=8?150:138,34+Math.min(20,metrics.longest)*5.7)):
        semantic==='table-col-primary'?(columnCount<=8?132:108):semantic==='table-col-progress'?96:(columnCount<=8?90:76);
    });
    const fitDesktop=window.innerWidth>=1280&&columnCount<=12;
    if(fitDesktop&&table.classList.contains('table-dashboard-projects')&&columnCount===6){
      const ratios=[.20,.11,.17,.18,.18,.16];let used=0;
      ratios.forEach((ratio,index)=>{const width=index===ratios.length-1?Math.max(64,wrapWidth-used):Math.max(64,Math.round(wrapWidth*ratio));fixedWidths[index]=width;used+=width;});
      if(used!==wrapWidth)fixedWidths[5]=Math.max(64,fixedWidths[5]+wrapWidth-used);
    }
    if(fitDesktop&&table.classList.contains('table-journals')&&columnCount===8){
      fixedWidths[6]=Math.max(112,Math.min(132,Math.round(wrapWidth*.085)));
      fixedWidths[7]=Math.max(232,Math.min(258,estimatedActionColumnWidth(table,7,columnCount)));
      weights[1]*=1.08;weights[3]*=1.04;
    }
    if(fitDesktop&&table.classList.contains('table-control-commercial')&&columnCount===8){
      const ratios=[.20,.11,.12,.12,.12,.11,.08,.14];let used=0;
      ratios.forEach((ratio,index)=>{const width=index===ratios.length-1?Math.max(104,wrapWidth-used):Math.max(index===0?176:index===7?118:82,Math.round(wrapWidth*ratio));fixedWidths[index]=width;used+=width;});
      if(used!==wrapWidth)fixedWidths[7]=Math.max(104,fixedWidths[7]+wrapWidth-used);
    }
    if(fitDesktop&&table.classList.contains('table-tax-filings')&&columnCount===9){
      const ratios=[.18,.07,.10,.11,.12,.10,.12,.12,.08],minimums=[150,72,88,96,104,92,108,112,124];let used=0;
      ratios.forEach((ratio,index)=>{fixedWidths[index]=Math.max(minimums[index],Math.round(wrapWidth*ratio));used+=fixedWidths[index];});
      let delta=wrapWidth-used;
      for(const index of [7,0,4,6,3]){if(delta===0)break;const room=delta>0?delta:Math.max(delta,minimums[index]-fixedWidths[index]);fixedWidths[index]+=room;delta-=room;}
    }
    if(fitDesktop&&table.classList.contains('table-tax-invoices')&&columnCount===9){
      const minimums=[84,78,94,102,86,58,90,132,132];minimums.forEach((width,index)=>{fixedWidths[index]=width;});
      let delta=wrapWidth-minimums.reduce((total,width)=>total+width,0);
      const growIndexes=[0,2,3,4,5,6],growWeights=[1,1.35,1.75,.95,.65,1],growTotal=growWeights.reduce((total,weight)=>total+weight,0);
      if(delta>0){growIndexes.forEach((index,position)=>{const growth=Math.floor(delta*growWeights[position]/growTotal);fixedWidths[index]+=growth;});let remainder=wrapWidth-fixedWidths.reduce((total,width)=>total+width,0);for(const index of [3,2,0,6,4,5]){if(remainder<=0)break;fixedWidths[index]+=1;remainder-=1;}}
      else if(delta<0){const floors=[70,74,84,94,68,54,72,126,126];for(const index of [3,2,0,6,4,5]){if(delta>=0)break;const reducible=Math.max(0,fixedWidths[index]-floors[index]);const reduction=Math.min(reducible,-delta);fixedWidths[index]-=reduction;delta+=reduction;}}
    }
    if(fitDesktop&&table.classList.contains('table-purchase-orders')&&columnCount===9){
      const minimums=[122,150,160,128,118,112,112,132,92];
      const growWeights=[.15,1.2,1.55,.65,.6,.45,.45,.65,.25];
      minimums.forEach((width,index)=>{fixedWidths[index]=width;});
      let delta=wrapWidth-fixedWidths.reduce((total,width)=>total+width,0);
      if(delta>0){
        const growIndexes=[1,2,3,4,5,6,7],total=growIndexes.reduce((sum,index)=>sum+growWeights[index],0);
        growIndexes.forEach(index=>{const growth=Math.floor(delta*growWeights[index]/total);fixedWidths[index]+=growth;});
        let remainder=wrapWidth-fixedWidths.reduce((total,width)=>total+width,0);
        for(const index of [2,1,7,3,4,5,6]){if(remainder<=0)break;fixedWidths[index]+=1;remainder-=1;}
      }else if(delta<0){
        const floors=[112,132,142,116,108,104,104,124,84];
        for(const index of [2,1,3,4,7,5,6,0,8]){
          if(delta>=0)break;
          const reducible=Math.max(0,fixedWidths[index]-floors[index]);
          const reduction=Math.min(reducible,-delta);
          fixedWidths[index]-=reduction;delta+=reduction;
        }
      }
    }
    let widths=new Array(columnCount).fill(0);
    if(fitDesktop){
      const fixedTotal=fixedWidths.reduce((a,b)=>a+b,0);
      const flexibleIndexes=weights.map((_,index)=>index).filter(index=>!fixedWidths[index]);
      const absoluteFloor=columnCount>=10?52:columnCount>=8?58:64;
      let minimumTotal=flexibleIndexes.reduce((sum,index)=>sum+Math.max(absoluteFloor,minimumWidths[index]),0);
      const roomForFlexible=Math.max(0,wrapWidth-fixedTotal);
      if(minimumTotal>roomForFlexible&&minimumTotal>0){const scale=roomForFlexible/minimumTotal;flexibleIndexes.forEach(index=>minimumWidths[index]=Math.max(absoluteFloor,Math.floor(minimumWidths[index]*scale)));minimumTotal=flexibleIndexes.reduce((sum,index)=>sum+minimumWidths[index],0);}
      const extraAvailable=Math.max(0,roomForFlexible-minimumTotal),weightTotal=flexibleIndexes.reduce((sum,index)=>sum+weights[index],0)||1;
      fixedWidths.forEach((value,index)=>{if(value)widths[index]=value;});
      flexibleIndexes.forEach(index=>widths[index]=minimumWidths[index]+Math.floor(extraAvailable*weights[index]/weightTotal));
      let delta=wrapWidth-widths.reduce((a,b)=>a+b,0);const distribution=[...flexibleIndexes].sort((a,b)=>weights[b]-weights[a]);let guard=0;
      while(delta!==0&&distribution.length&&guard<wrapWidth*2){const index=distribution[guard%distribution.length];if(delta>0){widths[index]+=1;delta-=1;}else if(widths[index]>Math.max(absoluteFloor,minimumWidths[index])){widths[index]-=1;delta+=1;}else if(distribution.every(i=>widths[i]<=Math.max(absoluteFloor,minimumWidths[i])))break;guard+=1;}
    }else{
      widths=semantics.map((semantic,index)=>{
        if(fixedWidths[index])return fixedWidths[index];
        const metrics=tableColumnTextMetrics(table,index,columnCount);
        if(semantic==='table-col-primary')return Math.max(150,Math.min(240,92+metrics.longestToken*5.8));
        if(semantic==='table-col-numeric'||semantic==='table-col-date')return Math.max(112,Math.min(150,52+metrics.longestToken*5.8));
        if(semantic==='table-col-status')return Math.max(112,Math.min(150,58+metrics.longestToken*5.4));
        if(semantic==='table-col-progress')return 148;
        return Math.max(112,Math.min(220,66+metrics.longestToken*5.8));
      });
      const total=widths.reduce((sum,width)=>sum+width,0);
      if(total<wrapWidth&&columnCount<=7){let delta=wrapWidth-total;const order=weights.map((weight,index)=>({weight,index})).sort((a,b)=>b.weight-a.weight);let cursor=0;while(delta>0){widths[order[cursor%order.length].index]+=1;delta-=1;cursor+=1;}}
    }
    table.querySelector('colgroup[data-auto-columns]')?.remove();
    const colgroup=authored||document.createElement('colgroup');
    if(!authored){colgroup.dataset.autoColumns='true';table.insertBefore(colgroup,table.firstChild);}
    const existingCols=[...colgroup.children].filter(node=>node.tagName==='COL');
    if(existingCols.length!==columnCount)colgroup.replaceChildren(...widths.map((_,index)=>{const col=document.createElement('col');col.dataset.columnIndex=String(index);return col;}));
    [...colgroup.children].forEach((col,index)=>{col.dataset.columnIndex=String(index);col.style.setProperty('width',`${widths[index]}px`,'important');});
    const gridWidth=fitDesktop?wrapWidth:Math.max(wrapWidth,widths.reduce((sum,width)=>sum+width,0));
    table.classList.add('table-auto-columns','table-generated-grid');
    table.style.setProperty('--table-fitted-width',`${gridWidth}px`);
    table.style.setProperty('--table-grid-width',`${gridWidth}px`);
    table.dataset.gridContract=fitDesktop?'fitted':'scroll';
    headers.forEach((header,index)=>{
      header.style.removeProperty('width');
      [...table.rows].slice(1).forEach(row=>logicalRowCells(row,columnCount)[index]?.style.removeProperty('width'));
    });
  }
  function configureTableScrollExperience(wrap,table,index,dataRows,scrollable){
    const longTable=dataRows>=10||table.classList.contains('payroll-detail-table')||table.classList.contains('annual-benefit-table');
    wrap.classList.toggle('table-scroll-frame',longTable);
    // v4.5.50: keep one native horizontal scrollbar at the bottom of the table only.
    // Remove legacy duplicated top scrollers/hints from prior releases on every render.
    const topScroller=wrap.previousElementSibling?.classList.contains('table-scroll-top')?wrap.previousElementSibling:null;
    const hint=(topScroller?.previousElementSibling?.classList.contains('table-scroll-hint')?topScroller.previousElementSibling:wrap.previousElementSibling?.classList.contains('table-scroll-hint')?wrap.previousElementSibling:null);
    topScroller?.remove();hint?.remove();
    wrap.dataset.horizontalScrollbar=scrollable?'native-bottom-only':'none';
    wrap.onscroll=scrollable?()=>{wrap.classList.toggle('at-scroll-end',wrap.scrollLeft+wrap.clientWidth>=wrap.scrollWidth-4);}:null;
  }
  function enhanceResponsiveTables(){
    const classifyColumn=(label,index,total)=>{
      const value=String(label||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(index===0)return 'table-col-primary';
      if(index===total-1 && (!value||/thao tác|hành động|action/.test(value)))return 'table-col-actions';
      if(/trạng thái|phê duyệt|billable|ưu tiên|loại|độ tin cậy|kiểm soát trạng thái|đánh giá|nhóm|tính chất|vai trò|bộ phận|hành động|phân hệ|thanh toán|chứng từ/.test(value))return 'table-col-status';
      if(/ngày|hạn|deadline|due date|date|kỳ báo cáo|kỳ lương|tháng|năm hiệu lực/.test(value))return 'table-col-date';
      if(/tiến độ|sử dụng|hoàn thành|tỷ lệ|utilization|progress|cpi\s*\/\s*spi|margin/.test(value))return 'table-col-progress';
      if(/giá trị|doanh thu|chi phí|lương|cost|amount|tiền|thuế|công nợ|ngân sách|khấu hao|phân bổ|số dư|nợ|có|giờ|tổng|contract|invoiced|actual|forecast|eac|^ar$|kh giờ|thực tế|đơn giá|số lượng|quantity|rate/.test(value))return 'table-col-numeric';
      return 'table-col-text';
    };
    const columnLooksNumeric=(cells)=>{
      const values=cells.map(cell=>String(cell.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,24);
      if(values.length<2)return false;
      const numeric=values.filter(value=>/^(?:[-+]?\d[\d.,]*(?:\s*(?:₫|đ|%|tr|tỷ|giờ|h))?|[-+]?\d+(?:[.,]\d+)?\s*\/\s*[-+]?\d+(?:[.,]\d+)?)$/i.test(value)).length;
      return numeric/values.length>=.7;
    };
    document.querySelectorAll('.table-wrap').forEach((wrap,index)=>{
      const table=wrap.querySelector('table');
      if(table){
        const headerRow=table.tHead?.rows?.[table.tHead.rows.length-1]||null;
        const headers=headerRow?[...headerRow.cells]:[...table.querySelectorAll('thead th')];
        const columnCount=headers.reduce((sum,cell)=>sum+Math.max(1,Number(cell.colSpan)||1),0)||Math.max(1,...[...table.rows].map(row=>[...row.cells].reduce((sum,cell)=>sum+Math.max(1,Number(cell.colSpan)||1),0)));
        [...table.classList].filter(name=>/^table-columns-\d+$/.test(name)).forEach(name=>table.classList.remove(name));
        table.classList.add(`table-columns-${columnCount}`);
        table.dataset.columnCount=String(columnCount);
        const forceFit=table.classList.contains('table-fit-wide');
        const lastColumnHasActions=[...table.tBodies||[]].some(body=>[...body.rows].some(row=>logicalRowCells(row,columnCount)[columnCount-1]?.querySelector('button,[role="button"]')));
        if(headers[columnCount-1] && !headers[columnCount-1].textContent.trim() && lastColumnHasActions){
          headers[columnCount-1].textContent='Thao tác';
          headers[columnCount-1].setAttribute('scope','col');
        }
        const authoredScrollable=table.classList.contains('payroll-detail-table')||table.classList.contains('annual-benefit-table');
        const desktopFit=window.innerWidth>=1280 && columnCount<=12 && !authoredScrollable;
        table.classList.add('balanced-table');
        table.classList.toggle('table-fit',columnCount<=6||forceFit);
        table.classList.toggle('table-wide',columnCount>=8&&!forceFit&&!desktopFit);
        table.classList.toggle('desktop-fit-table',desktopFit);
        table.style.setProperty('--table-mobile-min',`${Math.max(700,columnCount*112)}px`);
        headers.forEach((header,columnIndex)=>{
          header.setAttribute('scope','col');
          const columnCells=[...new Set([...table.rows].slice(1).map(row=>logicalRowCells(row,columnCount)[columnIndex]).filter(cell=>cell&&Number(cell.colSpan||1)===1))];
          let columnClass=columnCells.some(cell=>cell.querySelector('.progress,[role="progressbar"]'))?'table-col-progress':classifyColumn(header.textContent,columnIndex,columnCount);
          if(columnClass==='table-col-text'&&columnLooksNumeric(columnCells))columnClass='table-col-numeric';
          header.classList.add(columnClass);
          columnCells.forEach(cell=>cell.classList.add(columnClass));
        });
        applyDesktopTableColumnLayout(table,wrap,headers,columnCount);
        const body=table.tBodies?.[0];
        if(body && body.rows.length===0){
          const row=body.insertRow();row.className='table-empty-row';
          const cell=row.insertCell();cell.colSpan=columnCount;cell.innerHTML='<div class="table-empty-state"><span>⌕</span><strong>Chưa có dữ liệu phù hợp</strong><small>Thử thay đổi bộ lọc hoặc tạo bản ghi mới.</small></div>';
        }
        const dataRows=[...(body?.rows||[])].filter(row=>!row.classList.contains('table-empty-row')).length;
        const card=wrap.closest('.table-card');
        const tools=card?.querySelector(':scope > .table-tools');
        if(tools){
          let count=tools.querySelector('.table-count-badge');
          if(!count){count=document.createElement('span');count.className='table-count-badge';tools.appendChild(count);}
          count.textContent=`${fmtNum(dataRows,0)} bản ghi`;
        }
        table.classList.add('table-grid-exact');
        table.querySelectorAll('.table-col-actions').forEach(cell=>{
          if(cell.tagName==='TH')return;
          cell.classList.add('table-actions');
          let group=cell.querySelector(':scope > .table-action-group');
          if(!group){
            group=document.createElement('div');group.className='table-action-group';
            [...cell.childNodes].forEach(node=>group.appendChild(node));cell.appendChild(group);
          }
          group.querySelectorAll('button').forEach(button=>{
            const label=button.textContent.trim();
            button.classList.add('table-action-button');
            button.dataset.actionKind=/xóa|từ chối|hủy/i.test(label)?'danger':/duyệt|ghi nhận|ghi sổ/i.test(label)?'confirm':'neutral';
            button.title=button.title||label;
            button.setAttribute('aria-label',button.getAttribute('aria-label')||label);
            if(ACTION_ICONS[label]&&!button.querySelector('.action-glyph'))button.insertAdjacentHTML('afterbegin',`<span class="action-glyph" aria-hidden="true">${ACTION_ICONS[label]}</span>`);
          });
        });
      }
      const forceDesktopFit=window.innerWidth>=1280&&Boolean(table&&(table.classList.contains('table-fit-wide')||table.classList.contains('desktop-fit-table')||table.classList.contains('table-fit-desktop')));
      wrap.classList.toggle('desktop-no-scroll',forceDesktopFit);
      const scrollable=!forceDesktopFit&&wrap.scrollWidth>wrap.clientWidth+2;
      wrap.classList.toggle('is-scrollable',scrollable);
      wrap.classList.toggle('at-scroll-end',!scrollable||wrap.scrollLeft+wrap.clientWidth>=wrap.scrollWidth-4);
      const tableRows=table?[...table.tBodies||[]].reduce((sum,body)=>sum+[...body.rows].filter(row=>!row.classList.contains('table-empty-row')).length,0):0;
      configureTableScrollExperience(wrap,table,index,tableRows,scrollable);
      if(scrollable){
        wrap.tabIndex=0;
        wrap.setAttribute('role','region');
        wrap.setAttribute('aria-label',`${RESPONSIVE_TABLE_HINT} ${index+1}`);
      }else{
        wrap.removeAttribute('tabindex');
        wrap.removeAttribute('role');
        wrap.removeAttribute('aria-label');
      }
    });
  }
  function syncResponsiveLayout(){
    const compact=window.matchMedia('(max-width: 1024px)').matches;
    const sidebar=document.getElementById('sidebar');
    const collapse=document.getElementById('collapseBtn');
    document.documentElement.dataset.viewport=window.innerWidth<=430?'phone':window.innerWidth<=820?'tablet-compact':window.innerWidth<=1024?'tablet':'desktop';
    if(compact){
      sidebar?.classList.remove('collapsed');
      collapse?.setAttribute('aria-expanded','true');
      syncSidebarGridState();
    }else setSidebarOpen(false);
    requestAnimationFrame(enhanceResponsiveTables);
  }
  window.AlphaResponsive={setSidebarOpen,enhanceResponsiveTables,syncResponsiveLayout,syncActiveNavGroup};
  function navigate(view,focusId=''){ pendingFocus=focusId?{view,id:focusId}:null; currentView=view; setSidebarOpen(false); closeDrawers(); render({preserveTableViewport:false}); history.replaceState(null,'',`#${view}`); if(!focusId)window.scrollTo({top:0,behavior:'smooth'}); }
  function trashEntryOptions(type,record,options={}){
    const [sourceLabel,defaultView]=trashMeta(type),context=currentSecurityContext();
    return {...options,sourceView:options.sourceView||currentView||defaultView,sourceLabel:options.sourceLabel||sourceLabel,sourceContext:options.sourceContext||trashSourceContext(),displayName:options.displayName||trashDisplayName(type,record),deletedBy:options.deletedBy||auditActor(context||{display_name:'Giám đốc Demo'}),deletedByUserId:options.deletedByUserId||context?.user_id||(ENVIRONMENT==='demo'?'demo':'')};
  }
  function moveRecordToTrash(type,id,options={}){
    if(!ensureWritable())return null;
    const target=getById(db[type]||[],id);if(!target)throw new Error('Không tìm thấy bản ghi cần xóa.');
    const before=clone(db);
    try{
      const entry=RecycleBin.move(db,type,id,trashEntryOptions(type,target,options));
      if(['timesheets','people'].includes(type))Payroll.refreshDraftPeriods(db,uid);
      if(!saveDB())throw new Error('Không thể lưu dữ liệu Thùng rác.');
      window.dispatchEvent(new CustomEvent('alpha:trash-action',{detail:{action:'move',entry:clone(entry)}}));
      return entry;
    }catch(error){db=before;throw error;}
  }
  function moveExternalToTrash(options={}){
    if(!ensureWritable())return null;
    const before=clone(db),type=options.entityType,record=options.record;
    try{
      const entry=RecycleBin.addExternal(db,trashEntryOptions(type,record,options));
      if(!saveDB())throw new Error('Không thể lưu nội dung vào Thùng rác.');
      window.dispatchEvent(new CustomEvent('alpha:trash-action',{detail:{action:'move',entry:clone(entry)}}));
      return entry;
    }catch(error){db=before;throw error;}
  }
  function registerTrashHandler(source,handler){
    const key=String(source||'').trim();if(!key||!handler||typeof handler!=='object')return false;
    trashHandlers.set(key,handler);return true;
  }
  function applyTrashSourceContext(entry){
    const source=entry?.sourceContext||{};
    if(source.accountingTab)currentAccountingTab=source.accountingTab;
    if(source.controlTab)currentControlTab=source.controlTab;
    if(source.procurementTab)currentProcurementTab=source.procurementTab;
    if(source.financialTab)currentFinancialTab=source.financialTab;
    if(source.payrollMonth)currentPayrollMonth=source.payrollMonth;
    if(source.benefitYear)currentBenefitYear=Number(source.benefitYear)||currentBenefitYear;
  }
  async function restoreTrashEntry(entryId){
    const security=await requirePrivilegedAction(['security.manage'],'Khôi phục dữ liệu từ Thùng rác');if(!security)return false;
    const entry=RecycleBin.findEntry(db,entryId);if(!entry){alert('Nội dung không còn trong Thùng rác.');return false;}
    const before=clone(db),handler=entry.externalSource?trashHandlers.get(entry.externalSource):null;
    try{
      if(entry.external){if(!handler?.restore)throw new Error('Không tìm thấy mô-đun gốc để khôi phục nội dung này.');await handler.restore(clone(entry));RecycleBin.removeEntry(db,entry.id);}
      else RecycleBin.restore(db,entry.id);
      if(['timesheets','people'].includes(entry.entityType))Payroll.refreshDraftPeriods(db,uid);
      if(!saveDB())throw new Error('Không thể lưu dữ liệu đã khôi phục.');
      window.dispatchEvent(new CustomEvent('alpha:trash-action',{detail:{action:'restore',entry:clone(entry),actor:auditActor(security)}}));
      applyTrashSourceContext(entry);
      const targetView=viewMeta[entry.sourceView]?entry.sourceView:(viewMeta[trashMeta(entry.entityType)[1]]?trashMeta(entry.entityType)[1]:'dashboard');
      navigate(targetView,entry.recordId||entry.record?.id||'');
      toastMsg(`Đã khôi phục ${entry.displayName||trashMeta(entry.entityType)[0]} về đúng phân hệ`);return true;
    }catch(error){db=before;alert(`Không thể khôi phục: ${String(error.message||error).replace(/^RESTORE_CONFLICT:/,'Đã có bản ghi trùng tại ')}`);return false;}
  }
  async function cleanupTrashPayload(entry){
    const records=[entry.record,...(entry.relatedRecords||[]).map(item=>item.record)].filter(Boolean);
    for(const record of records){if(record.storagePath&&window.AlphaOnline?.isConfigured?.())await window.AlphaOnline.deleteFile(record.storagePath);}
    if(entry.external){const handler=trashHandlers.get(entry.externalSource);if(!handler?.purge)throw new Error('Không tìm thấy mô-đun gốc để xóa vĩnh viễn nội dung này.');await handler.purge(clone(entry));}
  }
  async function purgeTrashEntry(entryId,{securityVerified=false,automatic=false}={}){
    if(!securityVerified){const security=await requirePrivilegedAction(['security.manage'],'Xóa vĩnh viễn dữ liệu');if(!security)return false;}
    const entry=RecycleBin.findEntry(db,entryId);if(!entry)return false;
    const before=clone(db);
    try{await cleanupTrashPayload(entry);RecycleBin.removeEntry(db,entry.id);if(!saveDB())throw new Error('Không thể cập nhật Thùng rác.');window.dispatchEvent(new CustomEvent('alpha:trash-action',{detail:{action:automatic?'auto-purge':'purge',entry:clone(entry)}}));return true;}
    catch(error){db=before;if(!automatic)alert(`Không thể xóa vĩnh viễn: ${error.message||error}`);return false;}
  }
  function canManageTrashSilently(){if(ENVIRONMENT==='demo')return true;const context=currentSecurityContext(),permissions=context?.permissions||[];return context?.aal==='aal2'&&(permissions.includes('*')||permissions.includes('admin')||permissions.includes('security.manage'));}
  async function purgeExpiredTrash({notify=false,securityVerified=false}={}){
    if(trashCleanupRunning||(!securityVerified&&!canManageTrashSilently()))return 0;
    const expired=RecycleBin.expiredEntries(db);if(!expired.length)return 0;
    trashCleanupRunning=true;let count=0;
    try{for(const entry of expired){if(await purgeTrashEntry(entry.id,{securityVerified:true,automatic:true}))count+=1;}if(currentView==='trash')render();if(notify&&count)toastMsg(`Đã tự động xóa vĩnh viễn ${count} mục quá 30 ngày`);return count;}
    finally{trashCleanupRunning=false;}
  }
  function deleteRow(type,id){
    if(!ensureWritable())return;
    const target=getById(db[type]||[],id);
    if(type==='contracts'){
      const plan=Calc.contractDeletionPlan(db,id);
      if(plan.mode==='missing'){alert(plan.reason);return;}
      if(plan.allowed){
        const count=plan.linked.milestones?.length||0;
        if(!confirm(`Chuyển hợp đồng ${target?.contractNo||''}${count?` và ${count} đợt thanh toán nháp`:''} vào Thùng rác? Dữ liệu có thể khôi phục và sẽ tự xóa sau 30 ngày.`))return;
        const relatedRecords=(plan.linked.milestones||[]).map(record=>({entityType:'billingMilestones',record}));
        try{moveRecordToTrash(type,id,{relatedRecords});render();toastMsg('Đã chuyển hợp đồng vào Thùng rác');}catch(error){alert(`Không thể chuyển vào Thùng rác: ${error.message||error}`);}return;
      }
      if(plan.mode==='cancel'){
        if(!confirm(`${plan.reason}\n\nKhông thể xóa. Chuyển hợp đồng sang trạng thái Terminated để giữ lịch sử và không đưa vào KPI?`))return;
        target.status='Terminated';target.terminatedAt=today();
        saveDB();render();toastMsg('Đã chấm dứt hợp đồng và giữ nguyên lịch sử');return;
      }
    }
    const deletionPlan=Calc.entityDeletionPlan(db,type,id);
    if(type==='projects'&&!deletionPlan.allowed){
      if(!target){alert(deletionPlan.reason);return;}
      if(!confirm(`${deletionPlan.reason}\n\nDự án đã có nghiệp vụ nên không được xóa vật lý. Chuyển dự án sang trạng thái Archived để ẩn khỏi vận hành nhưng vẫn giữ dấu vết?`))return;
      target.status='Archived';target.archivedAt=new Date().toISOString();target.archivedBy=auditActor(currentSecurityContext());target.isArchived=true;
      if(!saveDB()){alert('Không thể lưu trạng thái lưu trữ dự án.');return;}render();toastMsg('Đã lưu trữ dự án và bảo toàn toàn bộ nghiệp vụ liên quan');return;
    }
    if(!deletionPlan.allowed){alert(deletionPlan.reason);return;}
    if(type==='purchaseRequests'&&db.purchaseOrders.some(x=>x.purchaseRequestId===id)){alert('Đề nghị mua đã phát sinh đơn mua, không thể xóa. Hãy chuyển trạng thái Cancelled.');return;}
    if(type==='purchaseOrders'&&(target?.journalEntryId||target?.toolId||target?.fixedAssetId)){alert('Đơn mua đã được ghi nhận kế toán/tài sản, không thể xóa. Hãy lập chứng từ đảo hoặc thanh lý theo quy trình.');return;}
    if(type==='tools'&&(db.toolAllocationSchedules||[]).some(x=>x.sourceId===id&&scheduleRowStatus(x)==='Posted')){alert('CCDC đã có kỳ phân bổ Posted, không thể xóa.');return;}
    if(type==='fixedAssets'&&(db.depreciationSchedules||[]).some(x=>x.sourceId===id&&scheduleRowStatus(x)==='Posted')){alert('TSCĐ đã có kỳ khấu hao Posted, không thể xóa.');return;}
    if(type==='journalEntries'&&Calc.statusIs(target?.status,'posted')){alert('Không được xóa chứng từ đã ghi sổ. Hãy lập chứng từ điều chỉnh hoặc chứng từ đảo để bảo toàn dấu vết kế toán.');return;}
    if(type==='accounts'){const a=getById(db.accounts,id);if(a&&db.journalEntries.some(e=>(e.lines||[]).some(l=>l.accountCode===a.code))){alert('Tài khoản đã phát sinh chứng từ, không thể xóa. Hãy chuyển trạng thái sang Inactive.');return;}}
    if(!confirm('Chuyển bản ghi này vào Thùng rác? Bạn có thể khôi phục trước khi hệ thống tự xóa sau 30 ngày.'))return;
    try{moveRecordToTrash(type,id);render();toastMsg('Đã chuyển bản ghi vào Thùng rác');}catch(error){alert(`Không thể chuyển vào Thùng rác: ${error.message||error}`);}
  }

  function accountForExpense(po){return po.directProject&&po.projectId?'154':'6422';}
  function nextDocumentNo(prefix,date=today()){return Calc.nextDocumentNumber(db.journalEntries,prefix,date);}
  function createDraftJournalFromBlueprint(blueprint,sourceType,sourceId){
    const existing=db.journalEntries.find(x=>x.sourceType===sourceType&&x.sourceId===sourceId);
    const makeLines=()=>blueprint.lines.map((l)=>({id:uid('jl'),accountCode:l.accountCode,debit:Calc.vnd(l.debit),credit:Calc.vnd(l.credit),projectId:l.projectId||'',partnerType:l.partnerType||'',partnerId:l.partnerId||'',description:l.description||blueprint.description}));
    if(existing){
      const expected={...existing,date:blueprint.date||today(),description:blueprint.description,status:'Draft',sourceType,sourceId,lines:makeLines()};
      if(!Calc.statusIs(existing.status,'draft')){
        const same=existing.date===expected.date&&Calc.journalTotal(existing,'debit')===Calc.journalTotal(expected,'debit')&&Calc.journalTotal(existing,'credit')===Calc.journalTotal(expected,'credit')
          &&(existing.lines||[]).length===expected.lines.length&&(existing.lines||[]).every((line,index)=>line.accountCode===expected.lines[index].accountCode&&Calc.vnd(line.debit)===Calc.vnd(expected.lines[index].debit)&&Calc.vnd(line.credit)===Calc.vnd(expected.lines[index].credit)&&String(line.projectId||'')===String(expected.lines[index].projectId||''));
        if(!same)throw new Error('Chứng từ tự động đã được bảo vệ và không khớp lịch mới; phải lập điều chỉnh/đảo chứng từ.');
        return existing;
      }
      const check=Calc.entryValidation(db,expected,existing.id);if(!check.valid)throw new Error(check.errors.join('\n'));
      Object.assign(existing,expected);return existing;
    }
    const entry={id:uid('je'),date:blueprint.date||today(),documentNo:nextDocumentNo(blueprint.documentPrefix||'AUTO',blueprint.date||today()),description:blueprint.description,status:'Draft',sourceType,sourceId,lines:makeLines()};
    const check=Calc.entryValidation(db,entry,''); if(!check.valid)throw new Error(check.errors.join('\n')); db.journalEntries.unshift(entry); return entry;
  }
  function ensureScheduleJournals(rows,source,expenseAccountCode,projectId,creditAccountCode){
    rows.forEach(row=>{if(row.journalEntryId)return;const bp=Calc.periodicJournalBlueprint({date:`${row.period}-28`,amount:row.amount,expenseAccountCode,creditAccountCode,projectId,description:`${source==='asset'?'Khấu hao TSCĐ':'Phân bổ CCDC'} kỳ ${row.period}`});const je=createDraftJournalFromBlueprint(bp,source==='asset'?'asset_depreciation':'tool_allocation',`${row.sourceId}:${row.period}`);row.journalEntryId=je.id;row.status='Draft';});
  }
  function rebuildToolSchedule(id){if(!ensureWritable())return;const tool=getById(db.tools,id);if(!tool)return;const plan=Calc.scheduleRebuildPlan(db,{kind:'tool',sourceId:id});if(!plan.allowed)throw new Error(plan.reason);const removable=new Set(plan.draftJournalIds);db.journalEntries=db.journalEntries.filter(entry=>!removable.has(String(entry.id)));db.toolAllocationSchedules=db.toolAllocationSchedules.filter(x=>x.sourceId!==id);const rows=Calc.straightLineSchedule({sourceId:id,startDate:tool.startDate,cost:tool.originalCost,residualValue:0,months:tool.allocationMonths,kind:'tool'});ensureScheduleJournals(rows,'tool',tool.expenseAccountCode||'6422',tool.projectId||'','242');db.toolAllocationSchedules.push(...rows);saveDB();render();toastMsg('Đã tạo lại lịch phân bổ và thay thế chứng từ Draft cũ');}
  function rebuildAssetSchedule(id){if(!ensureWritable())return;const asset=getById(db.fixedAssets,id);if(!asset)return;const plan=Calc.scheduleRebuildPlan(db,{kind:'asset',sourceId:id});if(!plan.allowed)throw new Error(plan.reason);const removable=new Set(plan.draftJournalIds);db.journalEntries=db.journalEntries.filter(entry=>!removable.has(String(entry.id)));db.depreciationSchedules=db.depreciationSchedules.filter(x=>x.sourceId!==id);const rows=Calc.straightLineSchedule({sourceId:id,startDate:asset.inServiceDate||asset.acquisitionDate,cost:asset.originalCost,residualValue:asset.residualValue||0,months:asset.usefulLifeMonths,kind:'asset'});ensureScheduleJournals(rows,'asset',asset.expenseAccountCode||'6422',asset.projectId||'',asset.depreciationAccountCode||'2141');db.depreciationSchedules.push(...rows);saveDB();render();toastMsg('Đã tạo lại lịch khấu hao và thay thế chứng từ Draft cũ');}
  function recognizePurchaseOrder(id){
    if(!ensureWritable())return;const po=getById(db.purchaseOrders,id);if(!po)return;const before=clone(db);
    try{
      const result=Calc.classifyPurchase(po,db.settings);po.classification=result.classification;
      const bp=Calc.purchaseJournalBlueprint({...po,totalExclVat:poTotal(po),expenseAccountCode:accountForExpense(po)},db.settings);const je=createDraftJournalFromBlueprint(bp,'purchase_order',po.id);po.journalEntryId=je.id;
      if(result.classification==='tool'&&!po.toolId){const tool={id:uid('tool'),toolCode:`CCDC-${new Date().getFullYear()}-${String(db.tools.length+1).padStart(3,'0')}`,name:po.itemName,purchaseOrderId:po.id,startDate:po.invoiceDate||po.orderDate,originalCost:poTotal(po),allocatedAmount:0,allocationMonths:Math.min(Number(po.allocationMonths||24),Number(db.settings.toolMaxAllocationMonths||36)),expenseAccountCode:accountForExpense(po),projectId:po.projectId||'',department:po.department||'Văn phòng',custodianId:po.custodianId||'',status:'In Use'};db.tools.unshift(tool);po.toolId=tool.id;const rows=Calc.straightLineSchedule({sourceId:tool.id,startDate:tool.startDate,cost:tool.originalCost,residualValue:0,months:tool.allocationMonths,kind:'tool'});ensureScheduleJournals(rows,'tool',tool.expenseAccountCode,tool.projectId,'242');db.toolAllocationSchedules.push(...rows);}
      if(result.classification==='fixed_asset'&&!po.fixedAssetId){const asset={id:uid('fa'),assetCode:`TSCĐ-${new Date().getFullYear()}-${String(db.fixedAssets.length+1).padStart(3,'0')}`,name:po.itemName,category:po.category,purchaseOrderId:po.id,acquisitionDate:po.invoiceDate||po.orderDate,inServiceDate:po.invoiceDate||po.orderDate,originalCost:poTotal(po),residualValue:Number(po.residualValue||0),usefulLifeMonths:Math.max(13,Number(po.usefulLifeMonths||60)),assetAccountCode:po.category==='Vehicle'?'2113':'2112',depreciationAccountCode:'2141',expenseAccountCode:accountForExpense(po),projectId:po.projectId||'',department:po.department||'Văn phòng',custodianId:po.custodianId||'',status:'In Use'};db.fixedAssets.unshift(asset);po.fixedAssetId=asset.id;const rows=Calc.straightLineSchedule({sourceId:asset.id,startDate:asset.inServiceDate,cost:asset.originalCost,residualValue:asset.residualValue,months:asset.usefulLifeMonths,kind:'asset'});ensureScheduleJournals(rows,'asset',asset.expenseAccountCode,asset.projectId,asset.depreciationAccountCode);db.depreciationSchedules.push(...rows);}
      if(!saveDB())throw new Error('Không thể lưu dữ liệu.');render();toastMsg(`Đã ghi nhận ${poClassLabel(result.classification)} và sinh chứng từ/lịch tự động`);
    }catch(e){db=before;alert(e.message||'Không thể ghi nhận đơn mua hàng.');}
  }

  function bootstrapProcurementAutomation(persist=true){
    let changed=false;
    (db.purchaseOrders||[]).filter(po=>/received|completed/i.test(po.status||'')).forEach(po=>{
      if(!po.journalEntryId){const bp=Calc.purchaseJournalBlueprint({...po,totalExclVat:poTotal(po),expenseAccountCode:accountForExpense(po)},db.settings);const je=createDraftJournalFromBlueprint(bp,'purchase_order',po.id);po.journalEntryId=je.id;changed=true;}
    });
    (db.tools||[]).forEach(tool=>{let rows=(db.toolAllocationSchedules||[]).filter(x=>x.sourceId===tool.id);if(!rows.length){rows=Calc.straightLineSchedule({sourceId:tool.id,startDate:tool.startDate,cost:tool.originalCost,residualValue:0,months:tool.allocationMonths,kind:'tool'});db.toolAllocationSchedules.push(...rows);changed=true;}const before=rows.filter(x=>!x.journalEntryId).length;ensureScheduleJournals(rows,'tool',tool.expenseAccountCode||'6422',tool.projectId||'','242');if(before)changed=true;});
    (db.fixedAssets||[]).forEach(asset=>{let rows=(db.depreciationSchedules||[]).filter(x=>x.sourceId===asset.id);if(!rows.length){rows=Calc.straightLineSchedule({sourceId:asset.id,startDate:asset.inServiceDate||asset.acquisitionDate,cost:asset.originalCost,residualValue:asset.residualValue||0,months:asset.usefulLifeMonths,kind:'asset'});db.depreciationSchedules.push(...rows);changed=true;}const before=rows.filter(x=>!x.journalEntryId).length;ensureScheduleJournals(rows,'asset',asset.expenseAccountCode||'6422',asset.projectId||'',asset.depreciationAccountCode||'2141');if(before)changed=true;});
    if(changed&&persist)saveDB();
    return changed;
  }

  const forms = {
    projects: {
      title:'Dự án', help:ENVIRONMENT==='demo'?'Nhập nhanh dự án; bản Demo tự đồng bộ giá trị hợp đồng, budget baseline và nguồn tiến độ để KPI thay đổi ngay.':'Tạo hồ sơ dự án và chọn rõ nguồn tiến độ kiểm soát.', prefix:'pr',
      html:x=>`${field('code','Mã dự án','text',x.code||'',[],false,'required')}${field('name','Tên dự án','text',x.name||'',[],false,'required')}${field('clientId','Khách hàng','select',x.clientId||'',options(db.clients),false,'required')}${field('pmId','Project Manager','select',x.pmId||'',options(db.people),false,'required')}${field('type','Loại công trình','select',x.type||'Hotel',['Hotel','Villa','Landscape','Planning','Interior','Factory','School','Other'].map(v=>({value:v,label:v})),false)}${field('stage','Giai đoạn','select',x.stage||'Concept',['Concept','TKCS','TKKT','TKTC','Tender','Construction Support'].map(v=>({value:v,label:v})),false)}${field('status','Trạng thái','select',x.status||'Proposal',['Proposal','In Progress','Review','Completed','On Hold'].map(v=>({value:v,label:v})),false)}${field('risk','Rủi ro','select',x.risk||'Low',['Low','Medium','High'].map(v=>({value:v,label:v})),false)}${field('startDate','Ngày bắt đầu','date',x.startDate||today())}${field('endDate','Ngày kết thúc','date',x.endDate||'')}${field('contractValue','Giá trị hợp đồng chưa VAT','number',x.contractValue||0,[],false,'min="0" step="1000000"')}${field('directBudget','Ngân sách trực tiếp','number',x.directBudget||0,[],false,'min="0" step="1000000"')}${field('progress','Tiến độ (%)','number',x.progress||0,[],false,'min="0" max="100" step="1"')}${field('progressMode','Nguồn tiến độ','select',x.progressMode||'manual',[{value:'manual',label:'Nhập nhanh tại hồ sơ dự án'},{value:'weighted',label:'Tính theo các giai đoạn chi tiết'}])}<div class="project-input-note"><strong>Luồng tính:</strong> Contract Value chỉ được tính là cam kết khi hợp đồng ở trạng thái Signed/Active. Dự án Proposal/Draft được giữ ở Pipeline. Direct Budget lấy từ baseline Approved; Actual chỉ tăng từ chứng từ Posted, timesheet Approved hoặc chi trực tiếp Paid chưa ghi sổ.</div>`,
      parse:fd=>({code:fd.get('code'),name:fd.get('name'),clientId:fd.get('clientId'),pmId:fd.get('pmId'),type:fd.get('type'),stage:fd.get('stage'),status:fd.get('status'),risk:fd.get('risk'),startDate:fd.get('startDate'),endDate:fd.get('endDate'),contractValue:Number(fd.get('contractValue')||0),directBudget:Number(fd.get('directBudget')||0),progress:Number(fd.get('progress')||0),progressMode:fd.get('progressMode')||'manual'}),
      validate:data=>{const check=Calc.validateProject(data);return check.valid?'':check.errors.join('\n');}
    },
    contracts:{title:'Hợp đồng',help:'Hợp đồng khách hàng là nguồn chuẩn cho contract value, backlog và forecast profit.',prefix:'ct',html:x=>`${field('projectId','Dự án','select',x.projectId||'',options(db.projects),false,'required')}${field('clientId','Khách hàng','select',x.clientId||'',options(db.clients),false,'required')}${field('contractNo','Số hợp đồng','text',x.contractNo||'',[],false,'required')}${field('contractType','Loại hợp đồng','select',x.contractType||'customer',[{value:'customer',label:'Hợp đồng khách hàng'},{value:'vendor',label:'Nhà cung cấp'},{value:'collaborator',label:'Cộng tác viên'},{value:'other',label:'Khác'}])}${field('signedDate','Ngày ký','date',x.signedDate||'')}${field('effectiveDate','Ngày hiệu lực','date',x.effectiveDate||today())}${field('expiryDate','Ngày hết hạn','date',x.expiryDate||'')}${field('valueExclVat','Giá trị chưa VAT','number',x.valueExclVat||0,[],false,`min="0" max="${Number(db.settings.maxContractValue||1000000000000)}" step="1" required`)}${field('vatRate','VAT (%)','number',x.vatRate??10,[],false,'min="0" max="100" step="0.1"')}${field('status','Trạng thái','select',x.status||'Draft',['Draft','Active','Completed','Suspended','Terminated'].map(v=>({value:v,label:v})))}`,parse:fd=>({projectId:fd.get('projectId'),clientId:fd.get('clientId'),contractNo:fd.get('contractNo'),contractType:fd.get('contractType'),signedDate:fd.get('signedDate'),effectiveDate:fd.get('effectiveDate'),expiryDate:fd.get('expiryDate'),valueExclVat:Number(fd.get('valueExclVat')||0),vatRate:Number(fd.get('vatRate')||0),status:fd.get('status')}),validate:(d,id)=>{const max=Number(db.settings.maxContractValue||1000000000000);if(d.valueExclVat<=0)return 'Giá trị hợp đồng phải lớn hơn 0.';if(d.valueExclVat>max)return `Giá trị hợp đồng vượt ngưỡng kiểm soát ${fmtMoney(max)}. Hãy kiểm tra lại đơn vị và số chữ số.`;if(d.expiryDate&&d.effectiveDate&&d.expiryDate<d.effectiveDate)return 'Ngày hết hạn không được trước ngày hiệu lực.';if(['Active','Completed'].includes(d.status)&&!d.signedDate)return 'Hợp đồng Active/Completed phải có ngày ký.';if(db.contracts.some(x=>x.id!==id&&String(x.contractNo).toLowerCase()===String(d.contractNo).toLowerCase()))return 'Số hợp đồng đã tồn tại.';return '';}},
    billingMilestones:{title:'Đợt thanh toán',help:'Dự án được tự động kế thừa từ hợp đồng; tổng tỷ lệ và giá trị không được vượt hợp đồng.',prefix:'bm',html:x=>{const linked=db.contracts.find(c=>c.id===(x.contractId||''));return `${field('contractId','Hợp đồng','select',x.contractId||'',options(db.contracts.filter(c=>String(c.contractType||'customer')==='customer'),c=>`${c.contractNo} — ${projectName(c.projectId)}`),false,'required')}${field('linkedProject','Dự án liên kết','text',projectName(linked?.projectId||x.projectId),[],true,'readonly')}${field('milestoneNo','Số đợt','number',x.milestoneNo||1,[],false,'min="1" step="1"')}${field('name','Tên đợt / Điều kiện','text',x.name||'',[],true,'required')}${field('percentage','Tỷ lệ (%)','number',x.percentage||0,[],false,'min="0" max="100" step="0.0001"')}${field('amountExclVat','Giá trị chưa VAT','number',x.amountExclVat||0,[],false,'min="0" step="1"')}${field('dueDate','Hạn dự kiến','date',x.dueDate||'')}${field('acceptanceStatus','Nghiệm thu','select',x.acceptanceStatus||'Not started',['Not started','Pending','Approved','Rejected'].map(v=>({value:v,label:v})))}${field('invoiceStatus','Hóa đơn','select',x.invoiceStatus||'Not invoiced',['Not invoiced','Partially invoiced','Invoiced','Cancelled'].map(v=>({value:v,label:v})))}${field('paymentStatus','Thanh toán','select',x.paymentStatus||'Unpaid',['Unpaid','Partial','Paid','Overdue','Cancelled'].map(v=>({value:v,label:v})))}`},parse:fd=>{const contract=db.contracts.find(x=>x.id===fd.get('contractId'));return {contractId:fd.get('contractId'),projectId:contract?.projectId||'',milestoneNo:Number(fd.get('milestoneNo')||1),name:fd.get('name'),percentage:Number(fd.get('percentage')||0),amountExclVat:Number(fd.get('amountExclVat')||0),dueDate:fd.get('dueDate'),acceptanceStatus:fd.get('acceptanceStatus'),invoiceStatus:fd.get('invoiceStatus'),paymentStatus:fd.get('paymentStatus')}},validate:(d,id)=>{const c=db.contracts.find(x=>x.id===d.contractId);if(!c)return 'Hợp đồng không tồn tại.';if(d.projectId!==c.projectId)return 'Dự án của đợt thanh toán phải khớp dự án trên hợp đồng.';const others=db.billingMilestones.filter(x=>x.id!==id&&x.contractId===d.contractId&&x.paymentStatus!=='Cancelled');const pct=others.reduce((s,x)=>s+Number(x.percentage||0),0)+d.percentage;const amt=others.reduce((s,x)=>s+Number(x.amountExclVat||0),0)+d.amountExclVat;if(pct>100.01)return 'Tổng tỷ lệ các đợt vượt 100%.';if(amt>Number(c.valueExclVat||0)+1)return 'Tổng giá trị các đợt vượt giá trị hợp đồng.';return '';}},
        paymentAllocations:{title:'Phân bổ thu tiền',help:'Nối khoản thu Paid với hóa đơn; chỉ phân bổ Đã ghi nhận có nguồn tiền hợp lệ mới giảm công nợ.',prefix:'pa',html:x=>`${field('invoiceId','Hóa đơn đầu ra','select',x.invoiceId||'',options(db.taxInvoices.filter(i=>Calc.statusIs(i.direction,'output')&&Calc.activeInvoice(i)),i=>`${i.invoiceNo} — ${projectName(i.projectId)} — ${fmtMoney(i.totalAmount)}`),false,'required')}${field('paymentId','Khoản thu đã thanh toán','select',x.paymentId||'',options(db.finance.filter(f=>Calc.financePaid(f)&&Calc.statusIs(f.type,'income')),f=>`${fmtDate(f.date)} — ${projectName(f.projectId)} — ${fmtMoney(f.amount)}`),true,'required')}${field('date','Ngày phân bổ','date',x.date||today(),[],false,'required')}${field('amount','Số tiền gồm VAT','number',x.amount||0,[],false,'min="1" step="1" required')}${field('status','Trạng thái','select',x.status||'Posted',[{value:'Draft',label:'Nháp — chưa giảm công nợ'},{value:'Posted',label:'Đã ghi nhận — giảm công nợ'},{value:'Cancelled',label:'Đã hủy'}])}${field('referenceNo','Số tham chiếu','text',x.referenceNo||'')}`,parse:fd=>({invoiceId:fd.get('invoiceId'),paymentId:fd.get('paymentId'),date:fd.get('date'),amount:Number(fd.get('amount')||0),status:fd.get('status'),referenceNo:fd.get('referenceNo')}),validate:(d,id)=>{const invoice=db.taxInvoices.find(x=>x.id===d.invoiceId);if(!invoice)return 'Hóa đơn không tồn tại.';if(d.amount<=0)return 'Số tiền phân bổ phải lớn hơn 0.';if(!Calc.allocationIsPosted(d))return '';if(!d.paymentId)return 'Phân bổ đã ghi nhận bắt buộc liên kết một khoản thu Paid.';const payment=db.finance.find(x=>x.id===d.paymentId);if(!payment||!Calc.financePaid(payment)||!Calc.statusIs(payment.type,'income'))return 'Khoản thu liên kết phải là giao dịch Income ở trạng thái Paid.';if(!Calc.isISODate(d.date)||!Calc.isISODate(payment.date)||payment.date>d.date)return 'Ngày phân bổ không được trước ngày nhận tiền.';if(invoice.projectId&&payment.projectId&&invoice.projectId!==payment.projectId)return 'Khoản thu và hóa đơn phải thuộc cùng dự án.';const allocated=db.paymentAllocations.filter(x=>x.id!==id&&x.invoiceId===d.invoiceId&&Calc.allocationIsRecognized(db,x,invoice)).reduce((sum,x)=>sum+Number(x.amount||0),0);if(allocated+d.amount>Number(invoice.totalAmount||0)+1)return 'Tổng phân bổ đã ghi nhận vượt giá trị hóa đơn.';const paymentAllocated=db.paymentAllocations.filter(x=>x.id!==id&&x.paymentId===d.paymentId&&Calc.allocationIsRecognized(db,x)).reduce((sum,x)=>sum+Number(x.amount||0),0);if(paymentAllocated+d.amount>Number(payment.amount||0)+1)return 'Tổng phân bổ đã ghi nhận vượt số tiền của khoản thu.';return '';}},
    projectBudgetVersions:{title:'Phiên bản ngân sách',help:'Chỉ một phiên bản Approved nên được dùng làm baseline cho mỗi dự án.',prefix:'pbv',html:x=>`${field('projectId','Dự án','select',x.projectId||'',options(db.projects),false,'required')}${field('versionNo','Số phiên bản','number',x.versionNo||1,[],false,'min="1" step="1"')}${field('versionName','Tên phiên bản','text',x.versionName||'Budget Baseline',[],true,'required')}${field('status','Trạng thái','select',x.status||'Draft',['Draft','Submitted','Approved','Superseded','Cancelled'].map(v=>({value:v,label:v})))}${field('directBudget','Direct Budget','number',x.directBudget||0,[],false,'min="0" step="1"')}${field('contingency','Dự phòng','number',x.contingency||0,[],false,'min="0" step="1"')}${field('expectedRiskCost','Chi phí rủi ro dự kiến','number',x.expectedRiskCost||0,[],false,'min="0" step="1"')}${field('targetMarginPercent','Biên mục tiêu (%)','number',x.targetMarginPercent??30,[],false,'min="-100" max="100" step="0.1"')}${field('effectiveFrom','Hiệu lực từ','date',x.effectiveFrom||today())}`,parse:fd=>({projectId:fd.get('projectId'),versionNo:Number(fd.get('versionNo')||1),versionName:fd.get('versionName'),status:fd.get('status'),directBudget:Number(fd.get('directBudget')||0),contingency:Number(fd.get('contingency')||0),expectedRiskCost:Number(fd.get('expectedRiskCost')||0),targetMarginPercent:Number(fd.get('targetMarginPercent')||0),effectiveFrom:fd.get('effectiveFrom')}),validate:(d,id)=>{if(d.status==='Approved'&&db.projectBudgetVersions.some(x=>x.id!==id&&x.projectId===d.projectId&&x.status==='Approved'))return 'Dự án đã có một budget baseline Approved. Hãy supersede phiên bản cũ trước.';return '';}},
    resourcePlans:{title:'Kế hoạch nguồn lực',help:'Kế hoạch đã duyệt được dùng để tính chi phí nhân công còn lại trong chi phí ước tính khi hoàn thành.',prefix:'rp',html:x=>`${field('projectId','Dự án','select',x.projectId||'',options(db.projects),false,'required')}${field('personId','Nhân sự','select',x.personId||'',options(db.people),false,'required')}${field('month','Tháng kế hoạch','month',x.month||monthKey())}${field('plannedHours','Giờ kế hoạch','number',x.plannedHours||0,[],false,'min="0" step="0.5"')}${field('costRate','Đơn giá chi phí / giờ','number',x.costRate||0,[],false,'min="0" step="1000"')}${field('status','Trạng thái','select',x.status||'Approved',['Draft','Submitted','Approved','Cancelled'].map(v=>({value:v,label:v})))}`,parse:fd=>({projectId:fd.get('projectId'),personId:fd.get('personId'),month:fd.get('month'),plannedHours:Number(fd.get('plannedHours')||0),costRate:Number(fd.get('costRate')||0),status:fd.get('status')}),validate:d=>d.plannedHours<=0?'Giờ kế hoạch phải lớn hơn 0.':''},
    commitments:{title:'Chi phí cam kết',help:'Giá trị Approved chưa ghi nhận được đưa vào Cost to Complete.',prefix:'cm',html:x=>`${field('projectId','Dự án','select',x.projectId||'',options(db.projects),false,'required')}${field('type','Loại chi phí','select',x.type||'Other',['Consultant','Collaborator','Printing','Travel','Survey','Software','Other'].map(v=>({value:v,label:v})))}${field('description','Nội dung cam kết','text',x.description||'',[],true,'required')}${field('amount','Giá trị cam kết','number',x.amount||0,[],false,'min="0" step="1"')}${field('recognizedAmount','Đã ghi nhận vào actual','number',x.recognizedAmount||0,[],false,'min="0" step="1"')}${field('dueDate','Hạn thực hiện','date',x.dueDate||'')}${field('status','Trạng thái','select',x.status||'Approved',['Draft','Submitted','Approved','Rejected','Cancelled'].map(v=>({value:v,label:v})))}`,parse:fd=>({projectId:fd.get('projectId'),type:fd.get('type'),description:fd.get('description'),amount:Number(fd.get('amount')||0),recognizedAmount:Number(fd.get('recognizedAmount')||0),dueDate:fd.get('dueDate'),status:fd.get('status')}),validate:d=>d.recognizedAmount>d.amount?'Giá trị đã ghi nhận không được vượt giá trị cam kết.':''},
    tasks:{title:'Công việc',help:'Giao việc theo dự án, người phụ trách và hạn hoàn thành.',prefix:'t',html:x=>`${field('title','Tên công việc','text',x.title||'',[],true,'required')}${field('projectId','Dự án','select',x.projectId||'',options(db.projects),false,'required')}${field('assigneeId','Người phụ trách','select',x.assigneeId||'',options(db.people),false,'required')}${field('status','Trạng thái','select',x.status||'Not Started',['Not Started','In Progress','Review','Done','On Hold'].map(v=>({value:v,label:v})))}${field('priority','Ưu tiên','select',x.priority||'Medium',['Low','Medium','High'].map(v=>({value:v,label:v})))}${field('startDate','Ngày bắt đầu','date',x.startDate||today())}${field('dueDate','Hạn hoàn thành','date',x.dueDate||'')}${field('estimatedHours','Giờ kế hoạch','number',x.estimatedHours||0,[],false,'min="0" step="0.5"')}${field('actualHours','Giờ thực tế','number',x.actualHours||0,[],false,'min="0" step="0.5"')}`,parse:fd=>({title:fd.get('title'),projectId:fd.get('projectId'),assigneeId:fd.get('assigneeId'),status:fd.get('status'),priority:fd.get('priority'),startDate:fd.get('startDate'),dueDate:fd.get('dueDate'),estimatedHours:Number(fd.get('estimatedHours')||0),actualHours:Number(fd.get('actualHours')||0)})},
    timesheets:{title:'Timesheet',help:'Chỉ timesheet đã duyệt mới được tính vào chi phí dự án.',prefix:'ts',html:x=>`${field('date','Ngày làm việc','date',x.date||today(),[],false,'required')}${field('personId','Nhân sự','select',x.personId||'',options(db.people),false,'required')}${field('projectId','Dự án','select',x.projectId||'',options(db.projects),false,'required')}${field('hours','Số giờ','number',x.hours||0,[],false,'min="0.5" max="24" step="0.5" required')}${field('billable','Loại giờ','select',String(x.billable??true),[{value:'true',label:'Billable'},{value:'false',label:'Non-billable'}])}${field('approved','Phê duyệt','select',String(x.approved??false),[{value:'false',label:'Chờ duyệt'},{value:'true',label:'Đã duyệt'}])}${field('description','Nội dung công việc','textarea',x.description||'',[],true,'required')}`,parse:fd=>({date:fd.get('date'),personId:fd.get('personId'),projectId:fd.get('projectId'),hours:Number(fd.get('hours')||0),billable:fd.get('billable')==='true',approved:fd.get('approved')==='true',description:fd.get('description')}),validate:(data,id)=>{const check=Calc.validateTimesheet(db,data,id);return check.valid?'':check.errors.join('\n');},afterSave:()=>{Payroll.refreshDraftPeriods(db,uid);saveDB();}},
    people:{title:'Nhân sự',help:'Hồ sơ nhân sự là nguồn tự động của lương, phụ cấp, bảo hiểm, TNCN và cost/giờ.',prefix:'p',html:x=>`${field('code','Mã nhân sự','text',x.code||'',[],false,'required')}${field('name','Họ và tên','text',x.name||'',[],false,'required')}${field('role','Vai trò','text',x.role||'')}${field('department','Bộ môn / Phòng ban','text',x.department||'')}${field('type','Loại nhân sự','select',x.type||'Fixed',[{value:'Fixed',label:'Nhân viên cố định'},{value:'CTV',label:'Cộng tác viên'}])}${field('status','Trạng thái','select',x.status||'Active',[{value:'Active',label:'Active'},{value:'Inactive',label:'Inactive'}])}${field('startDate','Ngày bắt đầu làm việc','date',x.startDate||'')}${field('endDate','Ngày kết thúc làm việc','date',x.endDate||'')}${field('monthlySalary','Lương tháng theo hợp đồng','number',x.monthlySalary||0,[],false,'min="0" step="100000"')}${field('monthlyAllowance','Phụ cấp cố định / tháng','number',x.monthlyAllowance||0,[],false,'min="0" step="100000"')}${field('insuranceSalary','Mức lương làm căn cứ BH','number',x.insuranceSalary||0,[],false,'min="0" step="100000" placeholder="0 = dùng lương tháng"')}${field('insuranceEnabled','Tham gia bảo hiểm','select',String(x.insuranceEnabled??(x.type!=='CTV')),[{value:'true',label:'Có — tự tính theo tham số'},{value:'false',label:'Không'}])}${field('dependentCount','Số người phụ thuộc','number',x.dependentCount||0,[],false,'min="0" max="20" step="1"')}${field('pitResidence','Tình trạng cư trú TNCN','select',x.pitResidence||'Resident',[{value:'Resident',label:'Cá nhân cư trú'},{value:'Non-resident',label:'Cá nhân không cư trú'}])}${field('overtimeMultiplier','Hệ số làm thêm riêng','number',x.overtimeMultiplier||db.settings.overtimeMultiplier||1.5,[],false,'min="1" max="5" step="0.1"')}${field('hourlyRate','Đơn giá CTV / giờ','number',x.hourlyRate||0,[],false,'min="0" step="10000"')}${field('billingRate','Billing rate / giờ','number',x.billingRate||0,[],false,'min="0" step="10000"')}`,parse:fd=>({code:fd.get('code'),name:fd.get('name'),role:fd.get('role'),department:fd.get('department'),type:fd.get('type'),status:fd.get('status'),startDate:fd.get('startDate'),endDate:fd.get('endDate'),monthlySalary:Number(fd.get('monthlySalary')||0),monthlyAllowance:Number(fd.get('monthlyAllowance')||0),insuranceSalary:Number(fd.get('insuranceSalary')||0),insuranceEnabled:fd.get('insuranceEnabled')==='true',dependentCount:Number(fd.get('dependentCount')||0),pitResidence:fd.get('pitResidence'),overtimeMultiplier:Number(fd.get('overtimeMultiplier')||1.5),hourlyRate:Number(fd.get('hourlyRate')||0),billingRate:Number(fd.get('billingRate')||0)}),afterSave:()=>{Payroll.refreshDraftPeriods(db,uid);saveDB();}},
    annualBenefitBudgets:{title:'Ngân sách thưởng & phúc lợi năm',help:'Thiết lập tham số quản trị cho thưởng tháng lương 13 và quỹ du lịch. Các hệ số không thay thế quy chế thưởng, kết luận thuế hoặc phê duyệt của người có thẩm quyền.',prefix:'benefit',html:x=>`${field('year','Năm ngân sách','number',x.year||currentBenefitYear,[],false,'min="2000" max="2200" step="1" required')}${field('minimumServiceDays','Số ngày làm việc tối thiểu để đủ điều kiện','number',x.minimumServiceDays??30,[],false,'min="0" max="366" step="1"')}${field('includeCTVBonus','Tính CTV vào quỹ thưởng tháng 13','select',String(x.includeCTVBonus??false),[{value:'false',label:'Không'},{value:'true',label:'Có — theo dữ liệu tiền công'}])}${field('companyPerformanceFactor','Hệ số kết quả công ty','number',x.companyPerformanceFactor??1,[],false,'min="0" max="2" step="0.05"')}${field('defaultEmployeePerformanceFactor','Hệ số hiệu suất cá nhân mặc định','number',x.defaultEmployeePerformanceFactor??1,[],false,'min="0" max="2" step="0.05"')}${field('bonusPaymentMode','Cách lập ngân sách thưởng','select',x.bonusPaymentMode||'Gross',[{value:'Gross',label:'Gross — thuế khấu trừ trong tiền thưởng'},{value:'Net',label:'Net — dự phòng gross-up theo tỷ lệ'}])}${field('bonusTaxProvisionRate','Tỷ lệ dự phòng thuế khi cam kết Net (%)','number',x.bonusTaxProvisionRate??10,[],false,'min="0" max="99" step="0.1"')}${field('bonusContingencyRate','Dự phòng quỹ thưởng (%)','number',x.bonusContingencyRate??5,[],false,'min="0" max="100" step="0.1"')}${field('travelParticipationRate','Tỷ lệ tham gia du lịch dự kiến (%)','number',x.travelParticipationRate??90,[],false,'min="0" max="100" step="0.1"')}${field('travelCostPerPerson','Chi phí du lịch bình quân/người','number',x.travelCostPerPerson??5000000,[],false,'min="0" step="1"')}${field('travelCommonCost','Chi phí tổ chức chung','number',x.travelCommonCost??20000000,[],false,'min="0" step="1"')}${field('travelContingencyRate','Dự phòng quỹ du lịch (%)','number',x.travelContingencyRate??7,[],false,'min="0" max="100" step="0.1"')}${field('otherWelfareSpent','Các khoản phúc lợi khác đã/ước chi','number',x.otherWelfareSpent??0,[],false,'min="0" step="1"')}${field('notes','Ghi chú chính sách','textarea',x.notes||'',[],true)}<input type="hidden" name="status" value="${esc(x.status||'Draft')}">`,parse:fd=>({year:Number(fd.get('year')),minimumServiceDays:Number(fd.get('minimumServiceDays')||0),includeCTVBonus:fd.get('includeCTVBonus')==='true',companyPerformanceFactor:Number(fd.get('companyPerformanceFactor')||0),defaultEmployeePerformanceFactor:Number(fd.get('defaultEmployeePerformanceFactor')||0),bonusPaymentMode:fd.get('bonusPaymentMode')||'Gross',bonusTaxProvisionRate:Number(fd.get('bonusTaxProvisionRate')||0),bonusContingencyRate:Number(fd.get('bonusContingencyRate')||0),travelParticipationRate:Number(fd.get('travelParticipationRate')||0),travelCostPerPerson:Number(fd.get('travelCostPerPerson')||0),travelCommonCost:Number(fd.get('travelCommonCost')||0),travelContingencyRate:Number(fd.get('travelContingencyRate')||0),otherWelfareSpent:Number(fd.get('otherWelfareSpent')||0),notes:fd.get('notes')||'',status:fd.get('status')||'Draft',calculationVersion:'ALPHA-BENEFITS-4.5.46'}),validate:(data,id)=>{const old=id&&getById(db.annualBenefitBudgets,id);if(old&&AnnualBenefits.isLockedStatus(old.status))return 'Ngân sách đã phê duyệt hoặc khóa, không thể sửa trực tiếp.';if(db.annualBenefitBudgets.some(item=>item.id!==id&&Number(item.year)===Number(data.year)))return 'Năm ngân sách đã tồn tại.';if(data.year<2000||data.year>2200)return 'Năm ngân sách không hợp lệ.';for(const key of ['companyPerformanceFactor','defaultEmployeePerformanceFactor'])if(data[key]<0||data[key]>2)return 'Hệ số thưởng phải nằm trong khoảng 0–2.';for(const key of ['bonusTaxProvisionRate','bonusContingencyRate','travelParticipationRate','travelContingencyRate'])if(data[key]<0||data[key]>100)return 'Tỷ lệ phần trăm phải nằm trong khoảng 0–100.';return '';},afterSave:(item,previous)=>{item.employeePerformanceFactors={...(previous?.employeePerformanceFactors||item.employeePerformanceFactors||{})};currentBenefitYear=Number(item.year);}},
    payrollItems:{title:'Chi tiết bảng lương',help:'Các nguồn tự động được lấy từ hồ sơ nhân sự, timesheet đã duyệt và tham số lương. Chỉ chọn thủ công khi có điều chỉnh đặc biệt.',prefix:'payi',html:x=>{const person=getById(db.people,x.personId),period=getById(db.payrollPeriods,x.payrollPeriodId),preview=person&&period?Payroll.calculateItem(db,person,period.month||String(period.periodCode||'').replace('PAY-',''),x,period):{};return `${field('employeeDisplay','Nhân viên','text',`${person?.code||''} — ${person?.name||''}`,[],true,'readonly')}${field('periodDisplay','Kỳ lương','text',period?.month||String(period?.periodCode||'').replace('PAY-',''),[],false,'readonly')}${field('unpaidLeaveDays','Ngày nghỉ không lương','number',x.unpaidLeaveDays||0,[],false,'min="0" step="0.5"')}${field('allowanceMode','Nguồn phụ cấp','select',x.allowanceMode||preview.allowanceMode||'Auto profile',[{value:'Auto profile',label:'Tự động từ hồ sơ nhân sự'},{value:'Manual',label:'Điều chỉnh thủ công'}])}${field('allowances','Phụ cấp thủ công','number',x.allowances||0,[],false,'min="0" step="1"')}${field('overtimeMode','Nguồn tiền làm thêm','select',x.overtimeMode||preview.overtimeMode||'Auto timesheet',[{value:'Auto timesheet',label:'Tự động từ timesheet đã duyệt'},{value:'Manual',label:'Điều chỉnh thủ công'}])}${field('overtimePay','Tiền làm thêm thủ công','number',x.overtimePay||0,[],false,'min="0" step="1"')}${field('bonus','Thưởng / điều chỉnh tăng','number',x.bonus||0,[],false,'min="0" step="1"')}${field('otherIncome','Thu nhập khác','number',x.otherIncome||0,[],false,'min="0" step="1"')}${field('insuranceMode','Nguồn bảo hiểm','select',x.insuranceMode||preview.insuranceMode||'Auto policy',[{value:'Auto policy',label:'Tự động theo hồ sơ và tham số'},{value:'Manual',label:'Điều chỉnh thủ công'}])}${field('employeeInsurance','BH người lao động thủ công','number',x.employeeInsurance??'',[],false,'min="0" step="1"')}${field('employerInsurance','BH doanh nghiệp thủ công','number',x.employerInsurance??'',[],false,'min="0" step="1"')}${field('pitMode','Cách xác định thuế TNCN','select',x.pitMode||preview.pitMode||(person?.type==='CTV'?'Auto CTV':'Auto progressive'),[{value:'Auto progressive',label:'Tự động biểu thuế lũy tiến — nhân viên'},{value:'Auto CTV',label:'Tự động khấu trừ tỷ lệ — CTV'},{value:'Manual review',label:'Kế toán nhập thủ công'}])}${field('personalIncomeTax','Thuế TNCN thủ công','number',x.personalIncomeTax||0,[],false,'min="0" step="1"')}${field('advanceDeduction','Khấu trừ tạm ứng','number',x.advanceDeduction||0,[],false,'min="0" step="1"')}${field('otherDeductions','Khấu trừ khác','number',x.otherDeductions||0,[],false,'min="0" step="1"')}${field('autoGrossPreview','Tổng thu nhập tự động','text',fmtMoney(preview.grossIncome||0),[],false,'readonly')}${field('autoTaxPreview','Thuế TNCN tự động','text',fmtMoney(preview.personalIncomeTax||0),[],false,'readonly')}${field('autoNetPreview','Thực nhận tự động','text',fmtMoney(preview.netPay||0),[],false,'readonly')}${field('notes','Ghi chú','textarea',x.notes||'',[],true)}<input type="hidden" name="personId" value="${esc(x.personId||'')}"><input type="hidden" name="payrollPeriodId" value="${esc(x.payrollPeriodId||'')}">`},parse:fd=>({personId:fd.get('personId'),payrollPeriodId:fd.get('payrollPeriodId'),unpaidLeaveDays:Number(fd.get('unpaidLeaveDays')||0),allowanceMode:fd.get('allowanceMode'),allowances:Number(fd.get('allowances')||0),overtimeMode:fd.get('overtimeMode'),overtimePay:Number(fd.get('overtimePay')||0),bonus:Number(fd.get('bonus')||0),otherIncome:Number(fd.get('otherIncome')||0),insuranceMode:fd.get('insuranceMode'),employeeInsurance:fd.get('employeeInsurance')===''?null:Number(fd.get('employeeInsurance')),employerInsurance:fd.get('employerInsurance')===''?null:Number(fd.get('employerInsurance')),pitMode:fd.get('pitMode'),personalIncomeTax:Number(fd.get('personalIncomeTax')||0),advanceDeduction:Number(fd.get('advanceDeduction')||0),otherDeductions:Number(fd.get('otherDeductions')||0),notes:fd.get('notes')}),validate:(data,id)=>{const period=getById(db.payrollPeriods,data.payrollPeriodId);if(!period)return 'Kỳ bảng lương không tồn tại.';if(Payroll.isLockedStatus(period.status))return 'Kỳ bảng lương đã phê duyệt hoặc khóa, không thể sửa.';const person=getById(db.people,data.personId);if(!person)return 'Nhân viên không tồn tại.';const check=Payroll.calculateItem(db,person,period.month||String(period.periodCode||'').replace('PAY-',''),{...(id?getById(db.payrollItems,id):{}),...data},period);return check.errors.join('\n');},afterSave:()=>{Payroll.ensurePeriod(db,currentPayrollMonth,uid);saveDB();}},
    finance:{title:'Giao dịch tài chính',help:'Khoản Paid phải nối đúng chứng từ Posted. Khoản chi làm bằng chứng VAT phải liên kết hóa đơn đầu vào và nhà cung cấp.',prefix:'f',html:x=>{const posted=db.journalEntries.filter(entry=>Calc.statusIs(entry.status,'posted'));return `${field('date','Ngày','date',x.date||today(),[],false,'required')}${field('type','Loại','select',x.type||'Expense',[{value:'Income',label:'Khoản thu'},{value:'Expense',label:'Khoản chi'}])}${field('category','Nhóm thu/chi','text',x.category||'',[],false,'required')}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('vendorId','Nhà cung cấp (nếu là khoản chi)','select',x.vendorId||'',options(db.vendors))}${field('invoiceId','Hóa đơn đầu vào được thanh toán','select',x.invoiceId||'',options(db.taxInvoices.filter(invoice=>Calc.activeInvoice(invoice)&&Calc.statusIs(invoice.direction,'input')),invoice=>`${invoice.invoiceNo} — ${fmtMoney(invoice.totalAmount)} — ${db.vendors.find(v=>v.id===invoice.partnerId)?.name||'Nhà cung cấp'}`))}${field('amount','Số tiền','number',x.amount||0,[],false,'min="0" step="1" required')}${field('status','Trạng thái','select',x.status||'Pending',[{value:'Pending',label:'Dự kiến / chờ — chưa vào actual'},{value:'Paid',label:'Đã thanh toán — vào actual'}])}${field('journalEntryId','Chứng từ tiền Posted','select',x.journalEntryId||'',options(posted,entry=>`${entry.documentNo} — ${fmtDate(entry.date)} — ${entry.description}`))}<div class="project-input-note"><strong>Kiểm soát VAT:</strong> trạng thái Paid nhập tay không đủ làm bằng chứng. Hệ thống chỉ tính phần VAT tương ứng với khoản chi liên kết đúng hóa đơn, nhà cung cấp và bút toán ngân hàng TK 112.</div>${field('description','Nội dung','textarea',x.description||'',[],true,'required')}`;},parse:fd=>({date:fd.get('date'),type:fd.get('type'),category:fd.get('category'),projectId:fd.get('projectId'),vendorId:fd.get('vendorId'),invoiceId:fd.get('invoiceId'),amount:Number(fd.get('amount')||0),status:fd.get('status'),journalEntryId:fd.get('journalEntryId'),description:fd.get('description')}),validate:(data,id)=>{if(data.amount<=0)return 'Số tiền phải lớn hơn 0.';const allocation=Calc.paymentAllocationConstraint(db,data,id);if(!allocation.valid)return allocation.errors.join('\n');const inputPayment=Calc.inputInvoicePaymentConstraint(db,data,id);if(!inputPayment.valid)return inputPayment.errors.join('\n');if(Calc.statusIs(data.status,'paid')){if(!data.journalEntryId)return 'Khoản Paid bắt buộc liên kết chứng từ tiền đã Posted.';if(db.finance.some(row=>row.id!==id&&Calc.financePaid(row)&&String(row.journalEntryId||'')===String(data.journalEntryId)))return 'Chứng từ này đã được liên kết với một khoản Paid khác.';const entry=db.journalEntries.find(row=>row.id===data.journalEntryId);if(!Calc.financeJournalMatch(db,data,entry))return 'Chứng từ không khớp ngày, dự án, số tiền hoặc chiều tăng/giảm TK 111/112.';}else if(data.journalEntryId)return 'Chỉ khoản Paid mới được liên kết chứng từ tiền Posted.';return '';}},
    journalEntries:{title:'Chứng từ kế toán',help:'Chứng từ chỉ được ghi sổ khi tổng Nợ bằng tổng Có.',prefix:'je',html:x=>{const lines=[...(x.lines||[])];while(lines.length<6)lines.push({accountCode:'',debit:0,credit:0,description:''});const partner=x.partnerType&&x.partnerId?`${x.partnerType}:${x.partnerId}`:'';return `${field('date','Ngày chứng từ','date',x.date||today(),[],false,'required')}${field('documentNo','Số chứng từ','text',x.documentNo||`PKT-${String(db.journalEntries.length+1).padStart(4,'0')}`,[],false,'required')}${field('sourceType','Loại chứng từ','select',x.sourceType||'Phiếu kế toán',['Phiếu kế toán','Phiếu điều chỉnh','Chứng từ đảo','Phiếu thu','Phiếu chi','Báo Có','Báo Nợ','Ủy nhiệm chi','Hóa đơn đầu ra','Hóa đơn đầu vào'].map(v=>({value:v,label:v})))}${field('cashFlowCode','Mã lưu chuyển tiền tệ B03-DNN','select',x.cashFlowCode||'', [{value:'',label:'— Không áp dụng —'},{value:'01',label:'01 • Thu từ khách hàng'},{value:'02',label:'02 • Chi nhà cung cấp'},{value:'03',label:'03 • Chi người lao động'},{value:'04',label:'04 • Lãi vay đã trả'},{value:'05',label:'05 • Thuế TNDN đã nộp'},{value:'06',label:'06 • Thu khác HĐKD'},{value:'07',label:'07 • Chi khác HĐKD'},{value:'21',label:'21 • Mua TSCĐ / tài sản dài hạn'},{value:'22',label:'22 • Thanh lý TSCĐ'},{value:'23',label:'23 • Cho vay / mua công cụ nợ'},{value:'24',label:'24 • Thu hồi cho vay'},{value:'25',label:'25 • Đầu tư góp vốn'},{value:'26',label:'26 • Thu hồi đầu tư'},{value:'27',label:'27 • Thu lãi / cổ tức'},{value:'31',label:'31 • Nhận vốn góp'},{value:'32',label:'32 • Trả vốn / mua cổ phiếu quỹ'},{value:'33',label:'33 • Thu từ đi vay'},{value:'34',label:'34 • Trả nợ gốc vay'},{value:'35',label:'35 • Trả nợ thuê tài chính'},{value:'36',label:'36 • Cổ tức / lợi nhuận trả chủ'}])}${field('status','Trạng thái','select',x.status||'Draft',[{value:'Draft',label:'Bản nháp'},{value:'Posted',label:'Đã ghi sổ'}])}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('partner','Khách hàng / Nhà cung cấp','select',partner,partnerOptions())}${field('description','Diễn giải chung','textarea',x.description||'',[],true,'required')}<div class="journal-lines full"><div class="journal-lines-title"><div><strong>Chi tiết định khoản Nợ / Có</strong><small>Mỗi dòng chọn một tài khoản và chỉ nhập một bên Nợ hoặc Có. Chứng từ chỉ được ghi sổ khi hai tổng bằng nhau.</small></div><span class="badge neutral">Tối đa 6 dòng</span></div><div class="journal-lines-header"><span>Tài khoản</span><span>Phát sinh Nợ</span><span>Phát sinh Có</span><span>Diễn giải dòng</span></div>${lines.map((l,i)=>`<div class="journal-line"><select name="accountCode${i}" aria-label="Tài khoản dòng ${i+1}"><option value="">— Chọn tài khoản —</option>${accountOptions().map(o=>`<option value="${esc(o.value)}" ${o.value===l.accountCode?'selected':''}>${esc(o.label)}</option>`).join('')}</select><input name="debit${i}" aria-label="Phát sinh Nợ dòng ${i+1}" type="number" min="0" step="1" value="${Number(l.debit||0)}" placeholder="0"><input name="credit${i}" aria-label="Phát sinh Có dòng ${i+1}" type="number" min="0" step="1" value="${Number(l.credit||0)}" placeholder="0"><input name="lineDescription${i}" aria-label="Diễn giải dòng ${i+1}" type="text" value="${esc(l.description||'')}" placeholder="Diễn giải"></div>`).join('')}<div class="journal-total" aria-live="polite"><span class="journal-total-item">Tổng Nợ <strong class="journal-total-debit">${fmtMoney(lines.reduce((s,l)=>s+Number(l.debit||0),0))}</strong></span><span class="journal-total-item">Tổng Có <strong class="journal-total-credit">${fmtMoney(lines.reduce((s,l)=>s+Number(l.credit||0),0))}</strong></span><span class="journal-total-item journal-total-balance">Chênh lệch <strong class="journal-total-difference">${fmtMoney(Math.abs(lines.reduce((s,l)=>s+Number(l.debit||0)-Number(l.credit||0),0)))}</strong></span></div></div>`;},parse:fd=>{const partner=String(fd.get('partner')||'').split(':');const lines=[];for(let i=0;i<6;i++){const accountCode=fd.get(`accountCode${i}`),debit=Number(fd.get(`debit${i}`)||0),credit=Number(fd.get(`credit${i}`)||0),description=fd.get(`lineDescription${i}`)||'';if(accountCode||debit||credit||description)lines.push({accountCode,debit,credit,description});}return {date:fd.get('date'),documentNo:fd.get('documentNo'),sourceType:fd.get('sourceType'),cashFlowCode:fd.get('cashFlowCode')||'',status:fd.get('status'),projectId:fd.get('projectId'),partnerType:partner.length===2?partner[0]:'',partnerId:partner.length===2?partner[1]:'',description:fd.get('description'),lines};},validate:(data,id)=>{const check=Calc.entryValidation(db,data,id);return check.valid?'':check.errors.join('\n'); }},
    openingBalances:{title:'Số dư đầu kỳ',help:'Nhập một bên Nợ hoặc Có cho từng tài khoản. Tổng số dư đầu kỳ toàn hệ thống phải cân bằng.',prefix:'ob',html:x=>`${field('accountCode','Tài khoản','select',x.accountCode||'',accountOptions(),false,'required')}${field('asOfDate','Ngày đầu kỳ','date',x.asOfDate||document.getElementById('dateFrom')?.value||today())}${field('debit','Dư Nợ','number',x.debit||0,[],false,'min="0" step="1"')}${field('credit','Dư Có','number',x.credit||0,[],false,'min="0" step="1"')}${field('description','Diễn giải','text',x.description||'Số dư chuyển sang',[],true)}`,parse:fd=>({accountCode:fd.get('accountCode'),asOfDate:fd.get('asOfDate'),debit:Calc.vnd(fd.get('debit')),credit:Calc.vnd(fd.get('credit')),description:fd.get('description')}),validate:(data,id)=>{if(!data.accountCode)return 'Cần chọn tài khoản.';if(data.debit<0||data.credit<0)return 'Số dư không được âm.';if((data.debit>0&&data.credit>0)||(data.debit===0&&data.credit===0))return 'Chỉ nhập một bên Nợ hoặc Có và phải lớn hơn 0.';if(db.openingBalances.some(x=>x.id!==id&&x.accountCode===data.accountCode))return 'Tài khoản đã có số dư đầu kỳ.';return '';}},
    accounts:{title:'Tài khoản kế toán',help:'Tạo tài khoản chi tiết phục vụ quản trị; tài khoản 242/244 có thể cấu hình phân loại ngắn hạn hoặc dài hạn.',prefix:'acc',html:x=>`${field('code','Số hiệu tài khoản','text',x.code||'',[],false,'required')}${field('name','Tên tài khoản','text',x.name||'',[],true,'required')}${field('type','Nhóm tài khoản','select',x.type||'Asset',['Asset','Liability','Equity','Revenue','Expense'].map(v=>({value:v,label:v})))}${field('normalSide','Tính chất số dư','select',x.normalSide||'Debit',[{value:'Debit',label:'Dư Nợ'},{value:'Credit',label:'Dư Có'}])}${field('reportClass','Phân loại B01a','select',x.reportClass||'',[{value:'',label:'Mặc định theo số hiệu tài khoản'},{value:'current_other_asset',label:'Tài sản ngắn hạn khác'},{value:'noncurrent_other_asset',label:'Tài sản dài hạn khác'}])}${field('active','Trạng thái','select',String(x.active??true),[{value:'true',label:'Active'},{value:'false',label:'Inactive'}])}`,parse:fd=>({code:String(fd.get('code')||'').trim(),name:fd.get('name'),type:fd.get('type'),normalSide:fd.get('normalSide'),reportClass:fd.get('reportClass')||'',active:fd.get('active')==='true'}),validate:(data,id)=>{const dup=db.accounts.find(a=>a.code===data.code&&a.id!==id);return dup?'Số hiệu tài khoản đã tồn tại.':'';}},
    reportNotesTT133:{title:'Thuyết minh B09-DNN',help:'Nội dung phải được chuẩn bị, soát xét và phê duyệt trước khi phát hành BCTC.',prefix:'note',html:x=>`${field('periodFrom','Từ ngày','date',x.periodFrom||currentRange().from,[],false,'required')}${field('periodTo','Đến ngày','date',x.periodTo||currentRange().to,[],false,'required')}${field('sectionCode','Mục','text',x.sectionCode||'',[],false,'readonly required')}${field('sectionTitle','Tiêu đề','text',x.sectionTitle||'',[],true,'required')}${field('content','Nội dung thuyết minh','textarea',typeof x.content==='string'?x.content:JSON.stringify(x.content||{},null,2),[],true,'required')}${field('status','Trạng thái','select',x.status||'draft',[{value:'draft',label:'Draft'},{value:'prepared',label:'Prepared'},{value:'reviewed',label:'Reviewed'},{value:'approved',label:'Approved'}])}`,parse:fd=>({periodFrom:fd.get('periodFrom'),periodTo:fd.get('periodTo'),sectionCode:fd.get('sectionCode'),sectionTitle:fd.get('sectionTitle'),content:fd.get('content'),status:fd.get('status')}),validate:data=>data.periodFrom>data.periodTo?'Khoảng kỳ thuyết minh không hợp lệ.':''},
    reportNotesTT99:{title:'Thuyết minh B09-DN',help:'Nội dung TT99 được quản lý riêng, phải hoàn tất luồng lập, soát xét và phê duyệt trước khi phát hành.',prefix:'note99',html:x=>`${field('periodFrom','Từ ngày','date',x.periodFrom||currentRange().from,[],false,'required')}${field('periodTo','Đến ngày','date',x.periodTo||currentRange().to,[],false,'required')}${field('sectionCode','Mục','text',x.sectionCode||'',[],false,'readonly required')}${field('sectionTitle','Tiêu đề','text',x.sectionTitle||'',[],true,'required')}${field('content','Nội dung thuyết minh','textarea',typeof x.content==='string'?x.content:JSON.stringify(x.content||{},null,2),[],true,'required')}${field('status','Trạng thái','select',x.status||'draft',[{value:'draft',label:'Draft'},{value:'prepared',label:'Prepared'},{value:'reviewed',label:'Reviewed'},{value:'approved',label:'Approved'}])}`,parse:fd=>({periodFrom:fd.get('periodFrom'),periodTo:fd.get('periodTo'),sectionCode:fd.get('sectionCode'),sectionTitle:fd.get('sectionTitle'),content:fd.get('content'),status:fd.get('status')}),validate:data=>data.periodFrom>data.periodTo?'Khoảng kỳ thuyết minh không hợp lệ.':''},
    vendors:{title:'Nhà cung cấp / CTV',help:'Danh mục đối tượng dùng để theo dõi công nợ phải trả.',prefix:'v',html:x=>`${field('code','Mã đối tượng','text',x.code||'',[],false,'required')}${field('name','Tên nhà cung cấp / CTV','text',x.name||'',[],true,'required')}${field('taxCode','Mã số thuế / CCCD','text',x.taxCode||'')}${field('type','Loại đối tượng','select',x.type||'Company',[{value:'Company',label:'Doanh nghiệp'},{value:'Individual',label:'Cá nhân / CTV'}])}${field('resident','Tình trạng cư trú','select',String(x.resident??true),[{value:'true',label:'Cá nhân cư trú / trong nước'},{value:'false',label:'Không cư trú / nước ngoài'}])}${field('contractType','Loại hợp đồng / quan hệ','text',x.contractType||'')}${field('phone','Điện thoại','text',x.phone||'')}${field('email','Email','email',x.email||'')}${field('status','Trạng thái','select',x.status||'Active',[{value:'Active',label:'Active'},{value:'Inactive',label:'Inactive'}])}`,parse:fd=>({code:fd.get('code'),name:fd.get('name'),taxCode:fd.get('taxCode'),type:fd.get('type'),resident:fd.get('resident')==='true',contractType:fd.get('contractType'),phone:fd.get('phone'),email:fd.get('email'),status:fd.get('status')})},
    taxInvoices:{title:'Hóa đơn thuế',help:'VAT đầu vào được tính theo phần thanh toán có khoản chi Paid và bút toán ngân hàng hợp lệ; trạng thái thanh toán nhập tay không phải bằng chứng.',prefix:'txi',html:x=>{const partner=x.partnerType&&x.partnerId?`${x.partnerType}:${x.partnerId}`:'';return `${field('direction','Loại hóa đơn','select',x.direction||'Input',[{value:'Input',label:'Hóa đơn đầu vào'},{value:'Output',label:'Hóa đơn đầu ra'}])}${field('date','Ngày hóa đơn','date',x.date||today(),[],false,'required')}${field('dueDate','Hạn thanh toán','date',x.dueDate||'')}${field('serial','Ký hiệu','text',x.serial||'')}${field('invoiceNo','Số hóa đơn','text',x.invoiceNo||'',[],false,'required')}${field('partner','Đối tượng','select',partner,taxPartnerOptions(),true,'required')}${field('taxCode','Mã số thuế đối tượng','text',x.taxCode||'')}${field('description','Nội dung hàng hóa / dịch vụ','textarea',x.description||'',[],true,'required')}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('contractId','Hợp đồng','select',x.contractId||'',options(db.contracts,c=>`${c.contractNo} — ${projectName(c.projectId)}`))}${field('taxBase','Giá trị chưa VAT','number',x.taxBase||0,[],false,'min="0" step="1" required')}${field('vatRate','Thuế suất VAT (%)','number',x.vatRate??db.settings.defaultVatRate,[],false,'min="0" max="100" step="0.1"')}${field('vatAmount','Tiền VAT (để 0 sẽ tự tính)','number',x.vatAmount||0,[],false,'min="0" step="1"')}${field('deductible','Yêu cầu engine xét khấu trừ','select',String(x.deductible??true),[{value:'true',label:'Có — chỉ tính phần đủ chứng từ'},{value:'false',label:'Không/chưa khấu trừ'}])}${field('paymentMethod','Phương thức thanh toán','select',x.paymentMethod||'Bank',[{value:'Bank',label:'Chuyển khoản'},{value:'Cash',label:'Tiền mặt'},{value:'Offset',label:'Bù trừ công nợ'},{value:'Other',label:'Khác'}])}${field('paymentStatus','Tình trạng tham khảo','select',x.paymentStatus||'Pending',[{value:'Pending',label:'Chưa thanh toán'},{value:'Part-paid',label:'Thanh toán một phần'},{value:'Paid',label:'Đã thanh toán'}])}${field('status','Trạng thái hóa đơn','select',x.status||'Valid',[{value:'Valid',label:'Hợp lệ / đang dùng'},{value:'Adjusted',label:'Đã điều chỉnh'},{value:'Replaced',label:'Đã thay thế'},{value:'Cancelled',label:'Đã hủy'}])}${field('journalEntryId','Liên kết chứng từ kế toán','select',x.journalEntryId||'',options(db.journalEntries,e=>`${e.documentNo} — ${e.description}`))}${field('notes','Ghi chú kiểm soát','textarea',x.notes||'',[],true)}`;},parse:fd=>{const partner=String(fd.get('partner')||'').split(':');const taxBase=Number(fd.get('taxBase')||0),vatRate=Number(fd.get('vatRate')||0),enteredVat=Number(fd.get('vatAmount')||0);const vatAmount=enteredVat>0?Calc.vnd(enteredVat):Calc.vnd(taxBase*vatRate/100);return {direction:fd.get('direction'),date:fd.get('date'),dueDate:fd.get('dueDate'),serial:fd.get('serial'),invoiceNo:fd.get('invoiceNo'),partnerType:partner[0]||'',partnerId:partner[1]||'',taxCode:fd.get('taxCode')||taxPartnerCode(partner[0],partner[1]),description:fd.get('description'),projectId:fd.get('projectId'),contractId:fd.get('contractId'),taxBase,vatRate,vatAmount,totalAmount:taxBase+vatAmount,deductible:fd.get('deductible')==='true',paymentMethod:fd.get('paymentMethod'),paymentStatus:fd.get('paymentStatus'),status:fd.get('status'),journalEntryId:fd.get('journalEntryId'),notes:fd.get('notes')};},validate:(data,id)=>{if(!data.partnerId)return 'Cần chọn khách hàng hoặc nhà cung cấp.';if(data.taxBase<=0)return 'Giá trị chưa thuế phải lớn hơn 0.';const contract=data.contractId&&db.contracts.find(x=>x.id===data.contractId);if(contract&&data.projectId&&contract.projectId!==data.projectId)return 'Hợp đồng không thuộc dự án đã chọn.';const allocation=Calc.invoiceAllocationConstraint(db,data,id);if(!allocation.valid)return allocation.errors.join('\n');if(db.taxInvoices.some(x=>x.id!==id&&Calc.activeInvoice(x)&&Calc.statusIs(x.direction,data.direction)&&x.serial===data.serial&&x.invoiceNo===data.invoiceNo&&x.taxCode===data.taxCode))return 'Hóa đơn đã tồn tại (trùng loại, ký hiệu, số và MST).';if(Calc.statusIs(data.direction,'Input')&&data.deductible){const candidateId=id||'__vat_candidate__',assessmentDb={...db,taxInvoices:[...db.taxInvoices.filter(x=>x.id!==id),{...data,id:candidateId}]},assessment=Calc.vatInputDeductionAssessment(assessmentDb,{from:data.date,to:data.date,asOf:data.date}),candidate=assessment.rows.find(row=>row.id===candidateId);if(candidate&&!candidate.provisional&&candidate.deductibleVat<=0)return `Chưa có phần VAT đủ điều kiện: ${candidate.reason} Hãy đổi sang “Không/chưa khấu trừ” hoặc liên kết khoản chi và chứng từ ngân hàng hợp lệ.`;}return ''; }},
    pitWithholdings:{title:'Khoản khấu trừ TNCN',help:'Theo dõi thu nhập, thuế đã khấu trừ và số tiền thực trả; bản Pending không đi vào tổng đã khấu trừ.',prefix:'pit',html:x=>{const recipient=x.recipientType&&x.recipientId?`${x.recipientType}:${x.recipientId}`:'';return `${field('date','Ngày chi trả','date',x.date||today(),[],false,'required')}${field('recipient','Người nhận thu nhập','select',recipient,taxPartnerOptions(),true,'required')}${field('taxCode','Mã số thuế / CCCD','text',x.taxCode||'')}${field('contractType','Loại hợp đồng','text',x.contractType||'CTV dưới 3 tháng')}${field('grossIncome','Thu nhập gộp','number',x.grossIncome||0,[],false,'min="0" step="1" required')}${field('taxableIncome','Thu nhập tính khấu trừ','number',x.taxableIncome||x.grossIncome||0,[],false,'min="0" step="1"')}${field('withholdingMethod','Phương pháp khấu trừ','select',x.withholdingMethod||'Khấu trừ tỷ lệ',[{value:'Khấu trừ tỷ lệ',label:'Khấu trừ theo tỷ lệ'},{value:'Biểu lũy tiến',label:'Biểu thuế lũy tiến'},{value:'Không khấu trừ',label:'Không khấu trừ'},{value:'Khác',label:'Khác'}])}${field('rate','Thuế suất (%)','number',x.rate??db.settings.pitWithholdingRate,[],false,'min="0" max="100" step="0.1"')}${field('taxWithheld','Thuế khấu trừ (để 0 sẽ tự tính)','number',x.taxWithheld||0,[],false,'min="0" step="1"')}${field('period','Kỳ kê khai','text',x.period||'Q3/2026')}${field('certificateNo','Số chứng từ khấu trừ','text',x.certificateNo||'')}${field('status','Trạng thái','select',x.status||'Pending',[{value:'Pending',label:'Chờ khấu trừ'},{value:'Withheld',label:'Đã khấu trừ'},{value:'Declared',label:'Đã kê khai'},{value:'Paid',label:'Đã nộp thuế'}])}${field('journalEntryId','Liên kết chứng từ kế toán','select',x.journalEntryId||'',options(db.journalEntries,e=>`${e.documentNo} — ${e.description}`))}${field('notes','Nội dung chi trả','textarea',x.notes||'',[],true)}`;},parse:fd=>{const recipient=String(fd.get('recipient')||'').split(':');const gross=Number(fd.get('grossIncome')||0),taxable=Number(fd.get('taxableIncome')||gross),rate=Number(fd.get('rate')||0),method=fd.get('withholdingMethod'),date=fd.get('date');const entered=Number(fd.get('taxWithheld')||0),calc=Calc.pitWithholding({date,grossIncome:gross,taxableIncome:taxable,rate,withholdingMethod:method,taxWithheld:entered},db.settings);return {date,recipientType:recipient[0]||'',recipientId:recipient[1]||'',taxCode:fd.get('taxCode')||taxPartnerCode(recipient[0],recipient[1]),contractType:fd.get('contractType'),grossIncome:calc.gross,taxableIncome:calc.taxable,withholdingMethod:method,rate:calc.rate,taxWithheld:calc.tax,netPaid:calc.net,period:fd.get('period'),certificateNo:fd.get('certificateNo'),status:fd.get('status'),journalEntryId:fd.get('journalEntryId'),notes:fd.get('notes'),requiresManualReview:calc.requiresManualReview};},validate:data=>{if(!data.recipientId)return 'Cần chọn người nhận thu nhập.';if(data.grossIncome<=0)return 'Thu nhập gộp phải lớn hơn 0.';if(data.taxableIncome<0||data.taxableIncome>data.grossIncome)return 'Thu nhập tính khấu trừ phải nằm trong khoảng 0 đến thu nhập gộp.';if(data.rate<0||data.rate>100)return 'Thuế suất TNCN phải nằm trong khoảng 0–100%.';if(Calc.pitWithholdingIsRecognized(data)){const journal=db.journalEntries.find(x=>x.id===data.journalEntryId);if(!journal||!Calc.statusIs(journal.status,'posted'))return 'Khoản TNCN đã ghi nhận phải liên kết chứng từ kế toán Posted.';}return ''; }},
    citAdjustments:{title:'Điều chỉnh thuế TNDN',help:'Theo dõi điều chỉnh tăng/giảm thu nhập chịu thuế và chuyển lỗ.',prefix:'cit',html:x=>`${field('date','Ngày ghi nhận','date',x.date||today())}${field('fiscalYear','Năm tài chính','number',x.fiscalYear||new Date().getFullYear(),[],false,'min="2000" max="2100" step="1"')}${field('type','Loại điều chỉnh','select',x.type||'Increase',[{value:'Increase',label:'Điều chỉnh tăng'},{value:'Decrease',label:'Điều chỉnh giảm'},{value:'Loss carryforward',label:'Chuyển lỗ'}])}${field('category','Nhóm điều chỉnh','text',x.category||'',[],false,'required')}${field('amount','Giá trị','number',x.amount||0,[],false,'min="0" step="1" required')}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('evidenceStatus','Tình trạng hồ sơ','select',x.evidenceStatus||'Review',[{value:'Complete',label:'Đầy đủ'},{value:'Review',label:'Cần rà soát'},{value:'Missing',label:'Thiếu hồ sơ'}])}${field('status','Trạng thái','select',x.status||'Draft',[{value:'Draft',label:'Nháp'},{value:'Reviewed',label:'Đã rà soát'}])}${field('description','Diễn giải','textarea',x.description||'',[],true,'required')}`,parse:fd=>({date:fd.get('date'),fiscalYear:Number(fd.get('fiscalYear')||0),type:fd.get('type'),category:fd.get('category'),amount:Number(fd.get('amount')||0),projectId:fd.get('projectId'),evidenceStatus:fd.get('evidenceStatus'),status:fd.get('status'),description:fd.get('description')})},
    taxFilings:{title:'Nghĩa vụ thuế',help:'Lập lịch kê khai, nộp thuế và lưu số tham chiếu hồ sơ.',prefix:'tf',html:x=>`${field('taxType','Loại thuế','select',x.taxType||'VAT',[{value:'VAT',label:'Thuế GTGT'},{value:'PIT',label:'Thuế TNCN'},{value:'CIT provisional',label:'Thuế TNDN tạm nộp'},{value:'Annual finalization',label:'Quyết toán năm'},{value:'License fee',label:'Lệ phí môn bài'},{value:'Other',label:'Khác'}])}${field('period','Kỳ thuế','text',x.period||'',[],false,'required')}${field('frequency','Tần suất','select',x.frequency||'Quarterly',[{value:'Monthly',label:'Theo tháng'},{value:'Quarterly',label:'Theo quý'},{value:'Annual',label:'Theo năm'},{value:'Event',label:'Theo lần phát sinh'}])}${field('dueDate','Hạn kê khai/nộp','date',x.dueDate||today(),[],false,'required')}${field('filingStatus','Trạng thái hồ sơ','select',x.filingStatus||'Not prepared',[{value:'Not prepared',label:'Chưa chuẩn bị'},{value:'Preparing',label:'Đang chuẩn bị'},{value:'Filed',label:'Đã nộp hồ sơ'},{value:'Not required',label:'Không phải nộp hồ sơ'}])}${field('filedDate','Ngày nộp hồ sơ','date',x.filedDate||'')}${field('payableAmount','Số thuế phải nộp','number',x.payableAmount||0,[],false,'min="0" step="1"')}${field('paymentStatus','Trạng thái nộp tiền','select',x.paymentStatus||'Unpaid',[{value:'Unpaid',label:'Chưa nộp'},{value:'Part-paid',label:'Nộp một phần'},{value:'Paid',label:'Đã nộp'},{value:'No payment',label:'Không phát sinh tiền nộp'}])}${field('paymentDate','Ngày nộp tiền','date',x.paymentDate||'')}${field('referenceNo','Mã giao dịch / tiếp nhận','text',x.referenceNo||'')}${field('notes','Ghi chú','textarea',x.notes||'',[],true)}`,parse:fd=>({taxType:fd.get('taxType'),period:fd.get('period'),frequency:fd.get('frequency'),dueDate:fd.get('dueDate'),filingStatus:fd.get('filingStatus'),filedDate:fd.get('filedDate'),payableAmount:Number(fd.get('payableAmount')||0),paymentStatus:fd.get('paymentStatus'),paymentDate:fd.get('paymentDate'),referenceNo:fd.get('referenceNo'),notes:fd.get('notes')})},
    quotes:{title:'Cơ hội / Báo giá',help:'Theo dõi pipeline và doanh thu theo xác suất.',prefix:'q',html:x=>`${field('date','Ngày báo giá','date',x.date||today())}${field('clientId','Khách hàng','select',x.clientId||'',options(db.clients),false,'required')}${field('projectName','Tên cơ hội / dự án','text',x.projectName||'',[],true,'required')}${field('amount','Giá trị dự kiến','number',x.amount||0,[],false,'min="0" step="1000000"')}${field('probability','Xác suất (%)','number',x.probability||0,[],false,'min="0" max="100" step="5"')}${field('status','Trạng thái','select',x.status||'Lead',['Lead','Proposal','Negotiation','Won','Lost'].map(v=>({value:v,label:v})))}`,parse:fd=>({date:fd.get('date'),clientId:fd.get('clientId'),projectName:fd.get('projectName'),amount:Number(fd.get('amount')||0),probability:Number(fd.get('probability')||0),status:fd.get('status')})},
    clients:{title:'Khách hàng',help:'Danh mục khách hàng và đầu mối liên hệ.',prefix:'c',html:x=>`${field('code','Mã khách hàng','text',x.code||'',[],false,'required')}${field('name','Tên khách hàng','text',x.name||'',[],false,'required')}${field('taxCode','Mã số thuế','text',x.taxCode||'')}${field('contact','Người liên hệ','text',x.contact||'')}${field('phone','Điện thoại','text',x.phone||'')}${field('email','Email','email',x.email||'')}${field('status','Trạng thái','select',x.status||'Lead',['Lead','Active','Inactive'].map(v=>({value:v,label:v})))}`,parse:fd=>({code:fd.get('code'),name:fd.get('name'),taxCode:fd.get('taxCode'),contact:fd.get('contact'),phone:fd.get('phone'),email:fd.get('email'),status:fd.get('status')})},
    purchaseRequests:{title:'Đề nghị mua',help:'Đề nghị mua phải nêu rõ mục đích, dự án và người sử dụng dự kiến.',prefix:'prq',html:x=>`${field('requestNo','Số đề nghị','text',x.requestNo||`PR-${new Date().getFullYear()}-${String(db.purchaseRequests.length+1).padStart(3,'0')}`,[],false,'required')}${field('date','Ngày đề nghị','date',x.date||today())}${field('itemName','Hàng hóa / tài sản','text',x.itemName||'',[],true,'required')}${field('category','Nhóm mua sắm','select',x.category||'Office supplies',['Office supplies','Printer','IT equipment','Furniture','Vehicle','Other equipment','Service'].map(v=>({value:v,label:v})))}${field('quantity','Số lượng','number',x.quantity||1,[],false,'min="0.01" step="0.01"')}${field('unitPrice','Đơn giá chưa VAT','number',x.unitPrice||0,[],false,'min="0" step="1"')}${field('vatRate','VAT (%)','number',x.vatRate??10,[],false,'min="0" max="100" step="0.1"')}${field('requesterId','Người đề nghị','select',x.requesterId||'',options(db.people),false,'required')}${field('projectId','Dự án sử dụng','select',x.projectId||'',options(db.projects))}${field('purpose','Mục đích sử dụng','text',x.purpose||'',[],true,'required')}${field('status','Trạng thái','select',x.status||'Pending',['Pending','Approved','Rejected','Cancelled'].map(v=>({value:v,label:v})))}`,parse:fd=>{const d={requestNo:fd.get('requestNo'),date:fd.get('date'),itemName:fd.get('itemName'),category:fd.get('category'),quantity:Number(fd.get('quantity')||0),unitPrice:Number(fd.get('unitPrice')||0),vatRate:Number(fd.get('vatRate')||0),requesterId:fd.get('requesterId'),projectId:fd.get('projectId'),purpose:fd.get('purpose'),status:fd.get('status')};d.suggestedClass=Calc.classifyPurchase({...d,usefulLifeMonths:d.category==='Office supplies'?1:36},db.settings).classification;return d;},validate:(d,id)=>db.purchaseRequests.some(x=>x.id!==id&&x.requestNo===d.requestNo)?'Số đề nghị đã tồn tại.':d.quantity<=0||d.unitPrice<=0?'Số lượng và đơn giá phải lớn hơn 0.':''},
    purchaseOrders:{title:'Đơn mua hàng',help:'Khi nhận hàng, hệ thống tự phân loại và sinh chứng từ Draft; kế toán kiểm tra trước khi Posted.',prefix:'po',html:x=>`${field('poNo','Số đơn mua','text',x.poNo||`PO-${new Date().getFullYear()}-${String(db.purchaseOrders.length+1).padStart(3,'0')}`,[],false,'required')}${field('purchaseRequestId','Đề nghị mua','select',x.purchaseRequestId||'',options(db.purchaseRequests,r=>`${r.requestNo} — ${r.itemName}`))}${field('vendorId','Nhà cung cấp','select',x.vendorId||'',options(db.vendors),false,'required')}${field('orderDate','Ngày đặt hàng','date',x.orderDate||today())}${field('invoiceDate','Ngày hóa đơn / nhận hàng','date',x.invoiceDate||today())}${field('itemName','Hàng hóa / tài sản','text',x.itemName||'',[],true,'required')}${field('category','Nhóm mua sắm','select',x.category||'Office supplies',['Office supplies','Printer','IT equipment','Furniture','Vehicle','Other equipment','Service'].map(v=>({value:v,label:v})))}${field('quantity','Số lượng','number',x.quantity||1,[],false,'min="0.01" step="0.01"')}${field('unitPrice','Đơn giá chưa VAT','number',x.unitPrice||0,[],false,'min="0" step="1"')}${field('vatRate','VAT (%)','number',x.vatRate??10,[],false,'min="0" max="100" step="0.1"')}${field('paymentMethod','Phương thức thanh toán','select',x.paymentMethod||'Payable',[{value:'Payable',label:'Công nợ nhà cung cấp (331)'},{value:'Bank',label:'Chuyển khoản (1121)'},{value:'Cash',label:'Tiền mặt (1111)'}])}${field('projectId','Dự án sử dụng','select',x.projectId||'',options(db.projects))}${field('directProject','Chi phí trực tiếp dự án','select',String(x.directProject??false),[{value:'false',label:'Không — chi phí quản lý'},{value:'true',label:'Có — tập hợp TK 154'}])}${field('usefulLifeMonths','Thời gian sử dụng dự kiến (tháng)','number',x.usefulLifeMonths||36,[],false,'min="1" step="1"')}${field('allocationMonths','Số tháng phân bổ CCDC','number',x.allocationMonths||24,[],false,`min="1" max="${Number(db.settings.toolMaxAllocationMonths||36)}" step="1"`)}${field('residualValue','Giá trị thu hồi ước tính','number',x.residualValue||0,[],false,'min="0" step="1"')}${field('department','Bộ phận sử dụng','text',x.department||'Văn phòng')}${field('custodianId','Người sử dụng / quản lý','select',x.custodianId||'',options(db.people))}${field('status','Trạng thái','select',x.status||'Draft',['Draft','Approved','Ordered','Received','Completed','Cancelled'].map(v=>({value:v,label:v})))}<div class="project-input-note"><strong>Phân loại tự động:</strong> văn phòng phẩm/dịch vụ → chi phí kỳ; tài sản dùng trên 12 tháng nhưng dưới ngưỡng TSCĐ → CCDC/TK 242; đủ ngưỡng TSCĐ và trên 12 tháng → TK 2112 hoặc 2113.</div>`,parse:fd=>{const d={poNo:fd.get('poNo'),purchaseRequestId:fd.get('purchaseRequestId'),vendorId:fd.get('vendorId'),orderDate:fd.get('orderDate'),invoiceDate:fd.get('invoiceDate'),itemName:fd.get('itemName'),category:fd.get('category'),quantity:Number(fd.get('quantity')||0),unitPrice:Number(fd.get('unitPrice')||0),vatRate:Number(fd.get('vatRate')||0),paymentMethod:fd.get('paymentMethod'),projectId:fd.get('projectId'),directProject:fd.get('directProject')==='true',usefulLifeMonths:Number(fd.get('usefulLifeMonths')||0),allocationMonths:Number(fd.get('allocationMonths')||0),residualValue:Number(fd.get('residualValue')||0),department:fd.get('department'),custodianId:fd.get('custodianId'),status:fd.get('status')};d.classification=Calc.classifyPurchase(d,db.settings).classification;return d;},validate:(d,id)=>{if(db.purchaseOrders.some(x=>x.id!==id&&x.poNo===d.poNo))return 'Số đơn mua đã tồn tại.';if(d.quantity<=0||d.unitPrice<=0)return 'Số lượng và đơn giá phải lớn hơn 0.';if(d.allocationMonths>Number(db.settings.toolMaxAllocationMonths||36))return 'Số tháng phân bổ vượt chính sách.';return '';},afterSave:(x)=>{/received|completed/i.test(x.status)&&recognizePurchaseOrder(x.id);}},
    tools:{title:'Công cụ dụng cụ',help:'Theo dõi CCDC, người sử dụng và lịch phân bổ.',prefix:'tool',html:x=>`${field('toolCode','Mã CCDC','text',x.toolCode||`CCDC-${new Date().getFullYear()}-${String(db.tools.length+1).padStart(3,'0')}`,[],false,'required')}${field('name','Tên CCDC','text',x.name||'',[],true,'required')}${field('purchaseOrderId','Đơn mua hàng','select',x.purchaseOrderId||'',options(db.purchaseOrders,p=>`${p.poNo} — ${p.itemName}`))}${field('startDate','Ngày bắt đầu sử dụng','date',x.startDate||today())}${field('originalCost','Nguyên giá','number',x.originalCost||0,[],false,'min="0" step="1"')}${field('allocationMonths','Số tháng phân bổ','number',x.allocationMonths||24,[],false,`min="1" max="${Number(db.settings.toolMaxAllocationMonths||36)}" step="1"`)}${field('expenseAccountCode','Tài khoản chi phí','select',x.expenseAccountCode||'6422',[{value:'6422',label:'6422 — Chi phí quản lý'},{value:'154',label:'154 — Chi phí trực tiếp dự án'}])}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('department','Bộ phận','text',x.department||'Văn phòng')}${field('custodianId','Người sử dụng','select',x.custodianId||'',options(db.people))}${field('status','Trạng thái','select',x.status||'In Use',['In Use','Stored','Transferred','Disposed'].map(v=>({value:v,label:v})))}`,parse:fd=>({toolCode:fd.get('toolCode'),name:fd.get('name'),purchaseOrderId:fd.get('purchaseOrderId'),startDate:fd.get('startDate'),originalCost:Number(fd.get('originalCost')||0),allocatedAmount:0,allocationMonths:Number(fd.get('allocationMonths')||0),expenseAccountCode:fd.get('expenseAccountCode'),projectId:fd.get('projectId'),department:fd.get('department'),custodianId:fd.get('custodianId'),status:fd.get('status')}),validate:(d,id)=>{if(db.tools.some(x=>x.id!==id&&x.toolCode===d.toolCode))return 'Mã CCDC đã tồn tại.';if(d.originalCost<=0||d.allocationMonths<=0)return 'Nguyên giá và số tháng phân bổ phải lớn hơn 0.';const old=id&&db.tools.find(x=>x.id===id);const drivers=['startDate','originalCost','allocationMonths','expenseAccountCode','projectId'];if(old&&drivers.some(key=>String(old[key]??'')!==String(d[key]??''))){const plan=Calc.scheduleRebuildPlan(db,{kind:'tool',sourceId:id});if(!plan.allowed)return plan.reason;}return '';},afterSave:(x,previous)=>{const drivers=['startDate','originalCost','allocationMonths','expenseAccountCode','projectId'];if(!previous||drivers.some(key=>String(previous[key]??'')!==String(x[key]??'')))rebuildToolSchedule(x.id);}},
    fixedAssets:{title:'Tài sản cố định',help:'TSCĐ áp dụng khấu hao đường thẳng; kiểm tra nguyên giá, thời gian sử dụng và hồ sơ bàn giao.',prefix:'fa',html:x=>`${field('assetCode','Mã TSCĐ','text',x.assetCode||`TSCĐ-${new Date().getFullYear()}-${String(db.fixedAssets.length+1).padStart(3,'0')}`,[],false,'required')}${field('name','Tên tài sản','text',x.name||'',[],true,'required')}${field('category','Nhóm tài sản','select',x.category||'Machinery',['Machinery','Vehicle','IT equipment','Furniture','Other'].map(v=>({value:v,label:v})))}${field('purchaseOrderId','Đơn mua hàng','select',x.purchaseOrderId||'',options(db.purchaseOrders,p=>`${p.poNo} — ${p.itemName}`))}${field('acquisitionDate','Ngày mua','date',x.acquisitionDate||today())}${field('inServiceDate','Ngày đưa vào sử dụng','date',x.inServiceDate||today())}${field('originalCost','Nguyên giá','number',x.originalCost||0,[],false,'min="0" step="1"')}${field('residualValue','Giá trị thu hồi','number',x.residualValue||0,[],false,'min="0" step="1"')}${field('usefulLifeMonths','Thời gian khấu hao (tháng)','number',x.usefulLifeMonths||60,[],false,'min="13" step="1"')}${field('assetAccountCode','Tài khoản tài sản','select',x.assetAccountCode||'2112',[{value:'2112',label:'2112 — Máy móc, thiết bị'},{value:'2113',label:'2113 — Phương tiện vận tải'}])}${field('depreciationAccountCode','TK hao mòn','select',x.depreciationAccountCode||'2141',[{value:'2141',label:'2141 — Hao mòn TSCĐ hữu hình'}])}${field('expenseAccountCode','TK chi phí khấu hao','select',x.expenseAccountCode||'6422',[{value:'6422',label:'6422 — Chi phí quản lý'},{value:'154',label:'154 — Chi phí trực tiếp dự án'}])}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('department','Bộ phận','text',x.department||'Văn phòng')}${field('custodianId','Người quản lý','select',x.custodianId||'',options(db.people))}${field('status','Trạng thái','select',x.status||'In Use',['In Use','Idle','Transferred','Disposed'].map(v=>({value:v,label:v})))}`,parse:fd=>({assetCode:fd.get('assetCode'),name:fd.get('name'),category:fd.get('category'),purchaseOrderId:fd.get('purchaseOrderId'),acquisitionDate:fd.get('acquisitionDate'),inServiceDate:fd.get('inServiceDate'),originalCost:Number(fd.get('originalCost')||0),residualValue:Number(fd.get('residualValue')||0),usefulLifeMonths:Number(fd.get('usefulLifeMonths')||0),assetAccountCode:fd.get('assetAccountCode'),depreciationAccountCode:fd.get('depreciationAccountCode'),expenseAccountCode:fd.get('expenseAccountCode'),projectId:fd.get('projectId'),department:fd.get('department'),custodianId:fd.get('custodianId'),status:fd.get('status')}),validate:(d,id)=>{if(db.fixedAssets.some(x=>x.id!==id&&x.assetCode===d.assetCode))return 'Mã TSCĐ đã tồn tại.';if(d.originalCost<Number(db.settings.fixedAssetThreshold||30000000))return 'Nguyên giá dưới ngưỡng TSCĐ của chính sách hiện tại.';if(d.usefulLifeMonths<=12)return 'TSCĐ phải có thời gian sử dụng trên 12 tháng.';if(d.residualValue>=d.originalCost)return 'Giá trị thu hồi phải nhỏ hơn nguyên giá.';const old=id&&db.fixedAssets.find(x=>x.id===id);const drivers=['acquisitionDate','inServiceDate','originalCost','residualValue','usefulLifeMonths','depreciationAccountCode','expenseAccountCode','projectId'];if(old&&drivers.some(key=>String(old[key]??'')!==String(d[key]??''))){const plan=Calc.scheduleRebuildPlan(db,{kind:'asset',sourceId:id});if(!plan.allowed)return plan.reason;}return '';},afterSave:(x,previous)=>{const drivers=['acquisitionDate','inServiceDate','originalCost','residualValue','usefulLifeMonths','depreciationAccountCode','expenseAccountCode','projectId'];if(!previous||drivers.some(key=>String(previous[key]??'')!==String(x[key]??'')))rebuildAssetSchedule(x.id);}},
    approvals:{title:'Yêu cầu phê duyệt',help:'Tạo đề nghị nội bộ và kiểm soát trạng thái duyệt.',prefix:'a',html:x=>`${field('date','Ngày đề nghị','date',x.date||today())}${field('type','Loại yêu cầu','select',x.type||'Đề nghị thanh toán',['Đề nghị thanh toán','Đề nghị mua hàng','Tạm ứng','Nghỉ phép','Phê duyệt hồ sơ'].map(v=>({value:v,label:v})))}${field('title','Nội dung đề nghị','text',x.title||'',[],true,'required')}${field('requesterId','Người đề nghị','select',x.requesterId||'',options(db.people),false,'required')}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('amount','Giá trị','number',x.amount||0,[],false,'min="0" step="100000"')}${field('status','Trạng thái','select',x.status||'Pending',['Pending','Approved','Rejected'].map(v=>({value:v,label:v})))}`,parse:fd=>({date:fd.get('date'),type:fd.get('type'),title:fd.get('title'),requesterId:fd.get('requesterId'),projectId:fd.get('projectId'),amount:Number(fd.get('amount')||0),status:fd.get('status')})},
    documents:{title:'Hồ sơ / Tài liệu',help:'Quản lý danh mục, phiên bản và trạng thái phát hành.',prefix:'d',html:x=>`${field('date','Ngày cập nhật','date',x.date||today())}${field('type','Loại tài liệu','select',x.type||'Contract',['Contract','Quotation','Acceptance','Payment Request','Drawing Set','Report','Other'].map(v=>({value:v,label:v})))}${field('title','Tên tài liệu','text',x.title||'',[],true,'required')}${field('projectId','Dự án','select',x.projectId||'',options(db.projects))}${field('version','Phiên bản','text',x.version||'01')}${field('ownerId','Người phụ trách','select',x.ownerId||'',options(db.people))}${field('status','Trạng thái','select',x.status||'Draft',['Draft','Review','Issued','Signed','Superseded'].map(v=>({value:v,label:v})))}`,parse:fd=>({date:fd.get('date'),type:fd.get('type'),title:fd.get('title'),projectId:fd.get('projectId'),version:fd.get('version'),ownerId:fd.get('ownerId'),status:fd.get('status')})}
  };

  const FORM_SECTIONS={
    projects:[['code','Thông tin dự án'],['type','Phạm vi & điều hành'],['startDate','Thời gian thực hiện'],['contractValue','Tài chính & tiến độ']],
    contracts:[['projectId','Liên kết hợp đồng'],['signedDate','Thời hạn hợp đồng'],['valueExclVat','Giá trị & trạng thái']],
    billingMilestones:[['contractId','Liên kết hợp đồng'],['milestoneNo','Điều kiện thanh toán'],['dueDate','Theo dõi thực hiện']],
    taxInvoices:[['direction','Thông tin hóa đơn'],['partner','Đối tượng & liên kết'],['taxBase','Giá trị và thuế'],['deductible','Kiểm soát chứng từ']],
    purchaseOrders:[['poNo','Thông tin đơn mua'],['itemName','Hàng hóa & giá trị'],['paymentMethod','Phân loại kế toán'],['department','Bàn giao & trạng thái']],
    journalEntries:[['date','Thông tin chứng từ'],['projectId','Liên kết quản trị'],['description','Nội dung hạch toán']],
    fixedAssets:[['assetCode','Thông tin tài sản'],['acquisitionDate','Giá trị & thời gian'],['assetAccountCode','Hạch toán & quản lý']],
    tools:[['toolCode','Thông tin công cụ'],['startDate','Phân bổ & quản lý']],
    timesheets:[['date','Thông tin chấm công'],['hours','Giờ làm việc & phê duyệt']],
    people:[['code','Thông tin nhân sự'],['startDate','Thời gian làm việc'],['monthlySalary','Lương & phụ cấp'],['insuranceSalary','Bảo hiểm & TNCN'],['hourlyRate','Đơn giá & doanh thu']],
    annualBenefitBudgets:[['year','Điều kiện & hệ số thưởng'],['bonusPaymentMode','Ngân sách thưởng'],['travelParticipationRate','Quỹ du lịch'],['notes','Ghi chú']],
    payrollItems:[['employeeDisplay','Nhân viên & kỳ lương'],['unpaidLeaveDays','Ngày công'],['allowanceMode','Thu nhập tự động & điều chỉnh'],['insuranceMode','Bảo hiểm & thuế'],['advanceDeduction','Khấu trừ'],['autoGrossPreview','Kết quả tính tự động'],['notes','Ghi chú']]
  };
  function formNumber(name){return Number(modalForm.elements.namedItem(name)?.value||0);}
  function formValue(name){return String(modalForm.elements.namedItem(name)?.value||'');}
  function setFormValue(name,value,{onlyBlank=false}={}){
    const control=modalForm.elements.namedItem(name);if(!control)return;
    if(onlyBlank&&String(control.value||'').trim())return;
    control.value=value??'';control.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function showFormFeedback(message,type='error'){
    let box=modalForm.querySelector('.form-feedback');
    if(!box){box=document.createElement('div');box.className='form-feedback full';modalForm.querySelector('.form-grid')?.prepend(box);}
    box.className=`form-feedback full ${type}`;box.innerHTML=`<span aria-hidden="true">${type==='error'?'!':'✓'}</span><div><strong>${type==='error'?'Kiểm tra dữ liệu nhập':'Dữ liệu hợp lệ'}</strong><p>${esc(String(message||'').replace(/\n+/g,' • '))}</p></div>`;box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function clearFormFeedback(){modalForm.querySelector('.form-feedback')?.remove();modalForm.querySelectorAll('.field.has-error').forEach(x=>x.classList.remove('has-error'));}
  function previewItem(label,value,caption=''){return `<div><span>${esc(label)}</span><strong>${esc(value)}</strong>${caption?`<small>${esc(caption)}</small>`:''}</div>`;}
  function updateFormPreview(type){
    const box=modalForm.querySelector('.form-live-summary');if(!box)return;
    let html='';
    if(type==='projects'){
      const contract=formNumber('contractValue'),budget=formNumber('directBudget'),contribution=contract-budget,ratio=contract?budget/contract*100:0;
      html=previewItem('Giá trị kiểm soát',fmtMoney(contract),'Chưa VAT')+previewItem('Ngân sách trực tiếp',fmtMoney(budget),`${fmtNum(ratio,1)}% hợp đồng`)+previewItem('Đóng góp mục tiêu',fmtMoney(contribution),contract?`${fmtNum(contribution/contract*100,1)}%`:'Chưa có giá trị');
    }else if(type==='contracts'){
      const net=formNumber('valueExclVat'),rate=formNumber('vatRate'),vat=Calc.vnd(net*rate/100);
      html=previewItem('Chưa VAT',fmtMoney(net))+previewItem('VAT dự kiến',fmtMoney(vat),`${fmtNum(rate,1)}%`)+previewItem('Tổng thanh toán',fmtMoney(net+vat));
    }else if(type==='billingMilestones'){
      const contract=getById(db.contracts,formValue('contractId')),pct=formNumber('percentage'),entered=formNumber('amountExclVat'),suggested=Calc.vnd(Number(contract?.valueExclVat||0)*pct/100);
      html=previewItem('Giá trị hợp đồng',fmtMoney(contract?.valueExclVat||0))+previewItem('Theo tỷ lệ',fmtMoney(suggested),`${fmtNum(pct,2)}%`)+previewItem('Giá trị đang nhập',fmtMoney(entered),Math.abs(entered-suggested)<=1?'Khớp tỷ lệ':'Cần đối chiếu');
    }else if(type==='timesheets'){
      const person=getById(db.people,formValue('personId')),hours=formNumber('hours'),costRate=person?costPerHour(person):0,billingRate=Number(person?.billingRate||0),billable=formValue('billable')==='true';
      html=previewItem('Giờ nhập',`${fmtNum(hours,2)} giờ`)+previewItem('Chi phí nhân sự',fmtMoney(hours*costRate),`Cost rate ${fmtMoney(costRate)}/giờ`)+previewItem('Doanh thu thu hồi',fmtMoney(billable?hours*billingRate:0),billable?'Theo billing rate':'Non-billable');
    }else if(type==='taxInvoices'){
      const base=formNumber('taxBase'),rate=formNumber('vatRate'),manual=formNumber('vatAmount'),vat=manual>0?manual:Calc.vnd(base*rate/100);
      html=previewItem('Giá trị chưa VAT',fmtMoney(base))+previewItem('Tiền VAT',fmtMoney(vat),manual>0?'Nhập thủ công':'Tự tính')+previewItem('Tổng hóa đơn',fmtMoney(base+vat));
    }else if(['purchaseRequests','purchaseOrders'].includes(type)){
      const qty=formNumber('quantity'),unit=formNumber('unitPrice'),rate=formNumber('vatRate'),net=Calc.vnd(qty*unit),vat=Calc.vnd(net*rate/100);
      html=previewItem('Giá trị chưa VAT',fmtMoney(net),`${fmtNum(qty,2)} × ${fmtMoney(unit)}`)+previewItem('VAT',fmtMoney(vat),`${fmtNum(rate,1)}%`)+previewItem('Tổng mua',fmtMoney(net+vat));
    }else if(type==='tools'){
      const cost=formNumber('originalCost'),months=formNumber('allocationMonths');html=previewItem('Nguyên giá',fmtMoney(cost))+previewItem('Kỳ phân bổ',`${fmtNum(months,0)} tháng`)+previewItem('Phân bổ/tháng',fmtMoney(months?Calc.vnd(cost/months):0));
    }else if(type==='fixedAssets'){
      const cost=formNumber('originalCost'),residual=formNumber('residualValue'),months=formNumber('usefulLifeMonths');html=previewItem('Giá trị khấu hao',fmtMoney(Math.max(0,cost-residual)))+previewItem('Thời gian',`${fmtNum(months,0)} tháng`)+previewItem('Khấu hao/tháng',fmtMoney(months?Calc.vnd((cost-residual)/months):0));
    }else if(type==='journalEntries'){
      let debit=0,credit=0;for(let i=0;i<6;i++){debit+=formNumber(`debit${i}`);credit+=formNumber(`credit${i}`);}const difference=Math.abs(debit-credit),balanced=debit>0&&credit>0&&difference<1;
      html=previewItem('Tổng phát sinh Nợ',fmtMoney(debit))+previewItem('Tổng phát sinh Có',fmtMoney(credit))+previewItem('Kiểm tra cân bằng',balanced?'Cân bằng':fmtMoney(difference),balanced?'Có thể lưu/ghi sổ':'Cần điều chỉnh');
      const totalDebit=modalForm.querySelector('.journal-total-debit'),totalCredit=modalForm.querySelector('.journal-total-credit'),totalDifference=modalForm.querySelector('.journal-total-difference'),balanceBox=modalForm.querySelector('.journal-total-balance');
      if(totalDebit)totalDebit.textContent=fmtMoney(debit);if(totalCredit)totalCredit.textContent=fmtMoney(credit);if(totalDifference)totalDifference.textContent=fmtMoney(difference);balanceBox?.classList.toggle('is-balanced',balanced);balanceBox?.classList.toggle('is-unbalanced',!balanced&&debit+credit>0);
    }else if(type==='finance'){
      html=previewItem('Số tiền giao dịch',fmtMoney(formNumber('amount')))+previewItem('Ảnh hưởng dòng tiền',formValue('status')==='Paid'?'Được ghi nhận':'Chưa ghi nhận',formValue('type')||'');
    }else if(type==='people'){
      const salary=formNumber('monthlySalary'),allowance=formNumber('monthlyAllowance'),insuranceBase=formNumber('insuranceSalary')||salary,hourly=formNumber('hourlyRate'),billing=formNumber('billingRate');html=previewItem('Lương + phụ cấp tháng',fmtMoney(salary+allowance))+previewItem('BH người lao động dự kiến',fmtMoney(insuranceBase*Number(db.settings.employeeInsuranceRate||0)/100),`${fmtNum(Number(db.settings.employeeInsuranceRate||0),2)}%`)+previewItem('Billing rate',fmtMoney(billing));
    }else{
      box.hidden=true;return;
    }
    box.hidden=false;box.innerHTML=html;
  }
  function configureFormExperience(type,item={}){
    modalForm.dataset.formType=type;
    const modal=modalForm.closest('.modal');modal?.classList.toggle('modal-wide',['journalEntries','payrollItems','annualBenefitBudgets'].includes(type));
    const grid=modalForm.querySelector('.form-grid');if(!grid)return;
    const summary=document.createElement('div');summary.className='form-live-summary full';summary.setAttribute('aria-live','polite');grid.prepend(summary);
    (FORM_SECTIONS[type]||[]).forEach(([name,label])=>{
      const field=modalForm.elements.namedItem(name)?.closest('.field');if(!field)return;
      const section=document.createElement('div');section.className='form-section-label full';section.innerHTML=`<span></span><strong>${esc(label)}</strong>`;field.before(section);
    });
    modalForm.querySelectorAll('[required]').forEach(control=>{
      const field=control.closest('.field');const label=field?.querySelector('label');if(label&&!label.querySelector('.required-mark'))label.insertAdjacentHTML('beforeend','<span class="required-mark" aria-label="bắt buộc">*</span>');
    });
    modalForm.addEventListener('invalid',event=>{event.preventDefault();const field=event.target.closest('.field');field?.classList.add('has-error');showFormFeedback(`Trường “${field?.querySelector('label')?.textContent?.replace('*','').trim()||event.target.name}” chưa hợp lệ.`);event.target.focus();},{capture:true,once:true});
    if(type==='contracts')modalForm.elements.namedItem('projectId')?.addEventListener('change',()=>{const project=getById(db.projects,formValue('projectId'));if(project)setFormValue('clientId',project.clientId);});
    if(type==='billingMilestones'){
      const sync=()=>{const contract=getById(db.contracts,formValue('contractId'));setFormValue('linkedProject',projectName(contract?.projectId||''));if(contract&&formNumber('amountExclVat')===0&&formNumber('percentage')>0)setFormValue('amountExclVat',Calc.vnd(Number(contract.valueExclVat||0)*formNumber('percentage')/100));};
      modalForm.elements.namedItem('contractId')?.addEventListener('change',sync);modalForm.elements.namedItem('percentage')?.addEventListener('change',sync);
    }
    if(type==='taxInvoices')modalForm.elements.namedItem('contractId')?.addEventListener('change',()=>{const contract=getById(db.contracts,formValue('contractId'));if(contract)setFormValue('projectId',contract.projectId);});
    if(type==='purchaseOrders')modalForm.elements.namedItem('purchaseRequestId')?.addEventListener('change',()=>{const request=getById(db.purchaseRequests,formValue('purchaseRequestId'));if(!request)return;['itemName','category','quantity','unitPrice','vatRate','projectId'].forEach(name=>setFormValue(name,request[name],{onlyBlank:name==='itemName'}));});
    grid.addEventListener('input',()=>{clearFormFeedback();updateFormPreview(type);});
    grid.addEventListener('change',()=>updateFormPreview(type));
    updateFormPreview(type);
    requestAnimationFrame(()=>modalForm.querySelector('input:not([readonly]),select,textarea')?.focus());
  }

  function openJournalAdjustment(id){
    if(!ensureWritable())return;
    const original=getById(db.journalEntries,id);if(!original)return;
    if(!Calc.statusIs(original.status,'posted')){openForm('journalEntries',id);return;}
    const existing=(db.journalEntries||[]).find(x=>String(x.adjustmentOf||'')===String(id)&&!Calc.statusIs(x.status,'posted'));
    if(existing){
      if(confirm(`Đã có chứng từ điều chỉnh nháp ${existing.documentNo||''}. Mở bản nháp này để tiếp tục sửa?`))openForm('journalEntries',existing.id);
      return;
    }
    const seed={
      date:today(),documentNo:nextDocumentNo('DC'),sourceType:'Phiếu điều chỉnh',cashFlowCode:original.cashFlowCode||'',status:'Draft',
      projectId:original.projectId||'',partnerType:original.partnerType||'',partnerId:original.partnerId||'',
      description:`Điều chỉnh ${original.documentNo}: ${original.description||''}`,
      lines:(original.lines||[]).map(line=>({...clone(line),id:undefined})),adjustmentOf:id
    };
    openForm('journalEntries','',seed);
  }

  function openReadOnlyRecord(type,id,title='Chi tiết bản ghi'){
    const cfg=forms[type],item=getById(db[type],id);if(!cfg||!item)return;
    editing=null;modalTitle.textContent=title;modalHelp.textContent='Chế độ chỉ xem. Chứng từ đã ghi sổ được khóa để bảo toàn tính toàn vẹn kế toán.';
    modalForm.innerHTML=`<div class="form-grid readonly-form-grid">${cfg.html(item)}<div class="form-actions full"><div class="form-action-note"><span aria-hidden="true">🔒</span><small>Dữ liệu chỉ đọc; muốn điều chỉnh cần thực hiện nghiệp vụ đảo hoặc lập chứng từ thay thế.</small></div><button type="button" class="primary-btn" id="closeReadOnly">Đóng</button></div></div>`;
    modalForm.querySelectorAll('input,select,textarea').forEach(control=>{control.disabled=true;control.setAttribute('aria-readonly','true');});
    modalForm.querySelectorAll('.journal-lines').forEach(box=>box.classList.add('readonly-journal-lines'));
    modalForm.onsubmit=null;modalBackdrop.classList.remove('hidden');document.getElementById('closeReadOnly').onclick=closeModal;
  }

  function openForm(type,id='',seed=null){
    if(window.AlphaProductionGuard&&!window.AlphaProductionGuard.canWrite()){toastMsg(window.AlphaProductionGuard.reason()||'Hệ thống đang ở chế độ chỉ đọc.');return;}
    const cfg=forms[type]; if(!cfg) return; const item=id?getById(db[type],id):(seed?clone(seed):{});if(type==='payrollItems'){const period=getById(db.payrollPeriods,item?.payrollPeriodId);if(Payroll.isLockedStatus(period?.status)){alert('Kỳ bảng lương đã phê duyệt hoặc khóa, không thể sửa trực tiếp.');return;}}if(type==='annualBenefitBudgets'&&AnnualBenefits.isLockedStatus(item?.status)){alert('Ngân sách thưởng và phúc lợi đã phê duyệt hoặc khóa, không thể sửa trực tiếp.');return;}if(type==='purchaseOrders'&&item?.journalEntryId){alert('Đơn mua đã sinh chứng từ. Không sửa trực tiếp các trường tài chính; hãy hủy/đảo nghiệp vụ và lập đơn thay thế.');return;}if(type==='journalEntries'&&Calc.statusIs(item?.status,'posted')){alert('Chứng từ đã ghi sổ không được sửa trực tiếp. Hãy lập chứng từ điều chỉnh hoặc chứng từ đảo.');return;} editing={type,id}; modalTitle.textContent=`${id?'Cập nhật':'Thêm'} ${cfg.title}`; modalHelp.textContent=cfg.help;
    modalForm.innerHTML=`<div class="form-grid">${cfg.html(item)}<div class="form-actions full"><div class="form-action-note"><span aria-hidden="true">✓</span><small>Kiểm tra các trường bắt buộc và phần xem trước trước khi lưu.</small></div><button type="button" class="secondary-btn" id="cancelForm">Hủy</button><button type="submit" class="primary-btn">${id?'Lưu thay đổi':'Tạo mới'}</button></div></div>`;
    modalBackdrop.classList.remove('hidden'); document.getElementById('cancelForm').onclick=closeModal; configureFormExperience(type,item);
    modalForm.onsubmit=async(e)=>{ e.preventDefault();clearFormFeedback();if(window.AlphaProductionGuard&&!window.AlphaProductionGuard.canWrite()){showFormFeedback(window.AlphaProductionGuard.reason()||'Không thể ghi dữ liệu lúc này.');return;} if(!modalForm.reportValidity())return; const data=cfg.parse(new FormData(modalForm)); if(type==='accounts'){const profile=accountingRegimeProfile();data.regime=profile.code;data.policyVersion=profile.policyVersion;data.regimeEffectiveDate=db.settings.accountingRegimeEffectiveDate||'';} if(type==='taxFilings'){data.source=item?.source||'manual';data.calendarKey=item?.calendarKey||TaxCalendar.stableKey(data.taxType,data.period);if(item&&String(data.dueDate)!==String(item.dueDate))data.dueDateMode='Manual';else if(item?.dueDateMode)data.dueDateMode=item.dueDateMode;} let privilegedContext=null; const oldStatus=String(item?.status||'').toLowerCase(); if(type==='journalEntries'&&Calc.statusIs(data.status,'posted')&&oldStatus!=='posted'){privilegedContext=await requirePrivilegedAction(['accounting.post'],'Ghi sổ chứng từ');if(!privilegedContext)return;} if(type==='timesheets'&&data.approved&&!Boolean(item?.approved)){privilegedContext=await requirePrivilegedAction(['timesheet.approve'],'Duyệt timesheet');if(!privilegedContext)return;data.approvedAt=new Date().toISOString();data.approvedBy=privilegedContext.user_id||auditActor(privilegedContext);} if(type==='approvals'&&['approved','rejected'].includes(String(data.status||'').toLowerCase())&&String(data.status||'').toLowerCase()!==oldStatus){privilegedContext=await requirePrivilegedAction(['procurement.approve'],'Phê duyệt yêu cầu');if(!privilegedContext)return;data.approvedAt=new Date().toISOString();data.approvedBy=privilegedContext.user_id||auditActor(privilegedContext);} if(['reportNotesTT133','reportNotesTT99'].includes(type)){const nextStatus=String(data.status||'draft').toLowerCase(),actorNow=()=>privilegedContext?.user_id||auditActor(privilegedContext),now=new Date().toISOString();if(oldStatus==='approved'&&nextStatus==='approved'&&(String(data.content||'')!==String(typeof item?.content==='string'?item.content:item?.content?.text||''))){showFormFeedback('B09 đã phê duyệt là bất biến. Hãy mở lại Draft trước khi sửa nội dung.');return;}if(nextStatus!==oldStatus){let permission='',label='';if(nextStatus==='prepared'){if(!['','draft'].includes(oldStatus)){showFormFeedback('Luồng B09 bắt buộc Draft → Prepared.');return;}permission='b09.prepare';label='Xác nhận lập B09';}else if(nextStatus==='reviewed'){if(oldStatus!=='prepared'){showFormFeedback('Luồng B09 bắt buộc Prepared → Reviewed.');return;}permission='b09.review';label='Soát xét B09';}else if(nextStatus==='approved'){if(oldStatus!=='reviewed'){showFormFeedback('Luồng B09 bắt buộc Reviewed → Approved.');return;}permission='b09.approve';label='Phê duyệt B09';}else if(nextStatus==='draft'&&oldStatus){permission=oldStatus==='approved'?'b09.approve':oldStatus==='reviewed'?'b09.review':'b09.prepare';label='Mở lại B09 về Draft';}if(permission){privilegedContext=await requirePrivilegedAction([permission],label);if(!privilegedContext)return;}const actor=actorNow();if(nextStatus!=='draft'&&String(data.content||'').trim().length<20){showFormFeedback('Nội dung B09 phải có ít nhất 20 ký tự trước khi chuyển trạng thái.');return;}if(nextStatus==='prepared'){data.preparedBy=actor;data.preparedAt=now;data.reviewedBy='';data.reviewedAt='';data.approvedBy='';data.approvedAt='';}else if(nextStatus==='reviewed'){if(!item?.preparedBy||String(item.preparedBy)===String(actor)){showFormFeedback('Người soát xét phải khác người lập B09.');return;}data.preparedBy=item.preparedBy;data.preparedAt=item.preparedAt;data.reviewedBy=actor;data.reviewedAt=now;data.approvedBy='';data.approvedAt='';}else if(nextStatus==='approved'){if(!item?.preparedBy||!item?.reviewedBy||[item.preparedBy,item.reviewedBy].map(String).includes(String(actor))){showFormFeedback('Người phê duyệt phải khác cả người lập và người soát xét.');return;}data.preparedBy=item.preparedBy;data.preparedAt=item.preparedAt;data.reviewedBy=item.reviewedBy;data.reviewedAt=item.reviewedAt;data.approvedBy=actor;data.approvedAt=now;}else if(nextStatus==='draft'){data.preparedBy='';data.preparedAt='';data.reviewedBy='';data.reviewedAt='';data.approvedBy='';data.approvedAt='';}}} if(type==='reportNotesTT99'){data.contentSha256=await sha256Text(String(data.content||''));data.workflowVersion=Math.max(1,Number(item?.workflowVersion||1));const actors=[data.preparedBy,data.reviewedBy,data.approvedBy].map(String).filter(Boolean);data.workflowComplete=String(data.status||'').toLowerCase()==='approved'&&actors.length===3&&new Set(actors).size===3&&Boolean(data.preparedAt&&data.reviewedAt&&data.approvedAt)&&String(data.content||'').trim().length>=20;} const error=cfg.validate?.(data,id)||''; if(error){showFormFeedback(error);return;} const parity=Calc.validateEntityPayload?.(type,data,db,id); if(parity&&!parity.ok){showFormFeedback('Dữ liệu chưa hợp lệ:\n'+parity.errors.join('\n'));return;} const previousItem=id?clone(item):null;const before=clone(db);if(type==='journalEntries'&&Calc.statusIs(data.status,'posted')){data.postedAt=new Date().toISOString();data.postedBy=privilegedContext?.user_id||auditActor(privilegedContext);data.postingHash=Calc.postingHash(data);}let savedItem;if(id){Object.assign(item,data);savedItem=item;}else{savedItem={id:uid(cfg.prefix),...data};if(type==='journalEntries'&&seed?.adjustmentOf)savedItem.adjustmentOf=seed.adjustmentOf;db[type].unshift(savedItem);}let projectSync=null;if(type==='projects'&&ENVIRONMENT==='demo'){projectSync=Calc.syncProjectQuickInputs(db,savedItem.id,{progressMode:savedItem.progressMode,defaultVatRate:db.settings.defaultVatRate,idFactory:uid});if(!projectSync.ok){db=before;alert(projectSync.errors.join('\n')||'Không thể đồng bộ dữ liệu kiểm soát dự án.');return;}}if(!saveDB()){db=before;alert('Không thể lưu dữ liệu. Vui lòng kiểm tra bộ nhớ trình duyệt hoặc quyền ghi.');return;}if(type==='reportNotesTT133'){try{const cloudNote=await persistReportNoteCloud(savedItem);if(cloudNote){Object.assign(savedItem,{id:cloudNote.id||savedItem.id,periodFrom:cloudNote.period_from,periodTo:cloudNote.period_to,sectionCode:cloudNote.section_code,sectionTitle:cloudNote.section_title,content:cloudNote.content,status:cloudNote.status,contentSha256:cloudNote.content_sha256,preparedBy:cloudNote.prepared_by,preparedAt:cloudNote.prepared_at,reviewedBy:cloudNote.reviewed_by,reviewedAt:cloudNote.reviewed_at,approvedBy:cloudNote.approved_by,approvedAt:cloudNote.approved_at,workflowVersion:cloudNote.workflow_version,updatedAt:cloudNote.updated_at});statutoryCloudNotes=[];statutoryCloudAudit=null;saveDB();}}catch(error){db=before;saveDB();showFormFeedback(`Không thể lưu B09 lên Supabase: ${error.message||error}`);return;}}closeModal();if(cfg.afterSave){try{cfg.afterSave(savedItem,previousItem);}catch(error){db=before;saveDB();alert(error.message||'Không thể hoàn tất nghiệp vụ tự động.');return;}}render();const baseMessage=id?'Đã cập nhật bản ghi':'Đã thêm bản ghi mới';toastMsg(projectSync?`${baseMessage} • KPI dự án đã đồng bộ`:baseMessage); };
  }
  function restoreModalFocus(){
    const restore=lastModalFocus;
    lastModalFocus=null;
    if(restore&&document.contains(restore)&&!restore.disabled)restore.focus?.({preventScroll:true});
  }
  function closeModal(){
    const wasOpen=!modalBackdrop.classList.contains('hidden');
    modalBackdrop.classList.add('hidden');editing=null;modalForm.closest('.modal')?.classList.remove('modal-wide');delete modalForm.dataset.formType;
    if(wasOpen)restoreModalFocus();
  }
  function exportIntegrityReport(){
    const report={generatedAt:new Date().toISOString(),company:db.settings.companyName,range:currentRange(),legalFramework:db.settings.taxRuleVersion,accountingRegime:db.settings.accountingRegime,result:Calc.integrityChecks(db,currentRange())};
    const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ALPHA_DESIGN_Integrity_${today()}.json`;a.click();URL.revokeObjectURL(a.href);toastMsg('Đã xuất báo cáo kiểm tra');
  }
  function exportData(){
    const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`ALPHA_DESIGN_ERP_Backup_${today()}.json`; a.click(); URL.revokeObjectURL(a.href); toastMsg('Đã xuất bản sao dữ liệu');
  }
  function importData(file){
    if(ENVIRONMENT!=='demo'||IS_PRODUCTION){alert('Production không cho phép nhập trực tiếp vào bộ nhớ trình duyệt. Hãy dùng quy trình import có phê duyệt trên máy chủ.');return;}
    if(!file||file.size>10*1024*1024){alert('Tệp dữ liệu vượt giới hạn 10 MB.');return;}
    const reader=new FileReader(); reader.onload=()=>{ try{ const parsed=JSON.parse(reader.result); if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Array.isArray(parsed.projects)||!Array.isArray(parsed.people)) throw new Error('Sai cấu trúc'); const count=Object.values(parsed).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0); if(count>100000)throw new Error('Quá nhiều bản ghi'); db=migrateDB(parsed); if(!saveDB())throw new Error('Không thể lưu'); render(); toastMsg('Đã nhập dữ liệu thành công'); }catch(e){alert('Tệp dữ liệu không hợp lệ hoặc vượt giới hạn an toàn.');} }; reader.readAsText(file);
  }

  document.getElementById('nav').addEventListener('click',e=>{
    const groupToggle=e.target.closest('.nav-group-toggle');
    if(groupToggle){
      const group=groupToggle.closest('.nav-group');
      const next=!group.classList.contains('is-open');
      document.querySelectorAll('#nav .nav-group').forEach(item=>setNavGroupState(item,item===group&&next));
      return;
    }
    const b=e.target.closest('.nav-item');
    if(b)navigate(b.dataset.view);
  });
  primaryAction.onclick=()=>openForm(currentView==='crm'?'quotes':currentView==='accounting'?'journalEntries':currentView==='tax'?'taxFilings':currentView==='commercial'?'contracts':currentView==='planning'?'resourcePlans':currentView==='procurement'?'purchaseRequests':currentView);
  document.getElementById('closeModal').onclick=closeModal;
  const visibleFocusables=(root)=>[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;});
  const syncModalOpenState=()=>{
    const isOpen=!modalBackdrop.classList.contains('hidden');
    document.body.classList.toggle('modal-open',isOpen);
    if(isOpen){
      if(!lastModalFocus||!document.contains(lastModalFocus))lastModalFocus=document.activeElement;
      requestAnimationFrame(()=>{modalForm.scrollTop=0;const first=visibleFocusables(modalBackdrop)[0];first?.focus({preventScroll:true});});
    }else if(lastModalFocus&&document.contains(lastModalFocus)){
      requestAnimationFrame(restoreModalFocus);
    }
  };
  new MutationObserver(syncModalOpenState).observe(modalBackdrop,{attributes:true,attributeFilter:['class']});
  syncModalOpenState();
  modalBackdrop.addEventListener('wheel',e=>{
    if(modalBackdrop.classList.contains('hidden')||!e.target.closest('.modal')||e.target.closest('.modal-form'))return;
    if(modalForm.scrollHeight<=modalForm.clientHeight+1)return;
    modalForm.scrollTop+=e.deltaY;e.preventDefault();
  },{passive:false});
  modalBackdrop.addEventListener('click',e=>{if(e.target===modalBackdrop)closeModal();});
  document.getElementById('exportBtn').onclick=exportData;
  document.getElementById('importInput').onchange=e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value='';};
  document.getElementById('menuBtn').onclick=()=>setSidebarOpen(!document.getElementById('sidebar').classList.contains('open'));
  document.getElementById('collapseBtn').onclick=()=>{
    const sidebar=document.getElementById('sidebar');
    const button=document.getElementById('collapseBtn');
    const collapsed=sidebar.classList.toggle('collapsed');
    syncSidebarGridState();
    button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',collapsed?'Mở rộng menu':'Thu gọn menu');
    button.title=collapsed?'Mở rộng menu':'Thu gọn menu';
  };
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeModal();closeDrawers();setSidebarOpen(false);return;}
    if(e.key!=='Tab')return;
    const openRoot=!modalBackdrop.classList.contains('hidden')?modalBackdrop:(activeDrawerId?document.getElementById(activeDrawerId):null);
    if(!openRoot)return;
    const focusables=visibleFocusables(openRoot);if(!focusables.length)return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });


  function closeDrawers(restoreFocus=true){
    document.querySelectorAll('.right-drawer').forEach(x=>x.classList.add('hidden'));
    document.getElementById('drawerBackdrop')?.classList.add('hidden');activeDrawerId='';
    if(restoreFocus&&lastDrawerFocus&&document.contains(lastDrawerFocus)){const restore=lastDrawerFocus;lastDrawerFocus=null;requestAnimationFrame(()=>restore.focus?.({preventScroll:true}));}
  }
  function openDrawer(id){
    closeDrawers(false);lastDrawerFocus=document.activeElement;activeDrawerId=id;
    const drawer=document.getElementById(id);drawer?.classList.remove('hidden');document.getElementById('drawerBackdrop')?.classList.remove('hidden');
    requestAnimationFrame(()=>visibleFocusables(drawer||document)[0]?.focus({preventScroll:true}));
  }
  function notificationItems(){
    const alerts=[];
    db.tasks.filter(overdueTask).forEach(x=>alerts.push({id:`task:${x.id}`,icon:'◷',title:`Công việc quá hạn: ${x.title}`,detail:projectName(x.projectId),view:'tasks',recordId:x.id}));
    db.approvals.filter(x=>x.status==='Pending').forEach(x=>alerts.push({id:`approval:${x.id}`,icon:'⌁',title:`Chờ phê duyệt: ${x.title}`,detail:fmtMoney(x.amount),view:'approvals',recordId:x.id}));
    db.taxFilings.filter(x=>['Due soon','Overdue'].includes(filingState(x))).forEach(x=>{const state=filingState(x);alerts.push({id:`tax:${x.id}`,icon:'◫',title:`${state==='Overdue'?'Quá hạn':'Sắp đến hạn'}: ${x.taxType} ${x.period}`,detail:`Hạn ${fmtDate(x.dueDate)} • ${taxCalendarCountdown(x)}`,view:'tax',recordId:x.id});});
    const read=new Set((db.notificationReads||[]).map(String));
    return alerts.map(item=>({...item,read:read.has(item.id)}));
  }
  function markNotificationRead(id){
    if(!id)return;
    if(!Array.isArray(db.notificationReads))db.notificationReads=[];
    if(!db.notificationReads.includes(id)){db.notificationReads.push(id);saveDB();}
  }
  function buildNotifications(){
    const alerts=notificationItems();
    const list=document.getElementById('notificationList');
    if(list){
      list.innerHTML=alerts.length?alerts.map(item=>`<article class="alert-item notification-item ${item.read?'is-read':''}" data-notification-id="${esc(item.id)}" data-notification-view="${esc(item.view)}" data-notification-record="${esc(item.recordId)}"><i class="alert-icon">${item.icon}</i><button class="notification-main" type="button" aria-label="Mở ${esc(item.title)}"><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><b aria-hidden="true">→</b></button><button class="notification-read-btn" type="button" data-mark-notification-read="${esc(item.id)}" ${item.read?'disabled':''}>${item.read?'Đã xem':'Đánh dấu đã xem'}</button></article>`).join(''):'<div class="notification-empty"><svg aria-hidden="true"><use href="#i-eye"/></svg><strong>Không có cảnh báo trọng yếu</strong><span>Hệ thống đang hoạt động tốt.</span></div>';
      list.querySelectorAll('.notification-main').forEach(button=>button.addEventListener('click',()=>{const item=button.closest('[data-notification-id]');markNotificationRead(item.dataset.notificationId);buildNotifications();navigate(item.dataset.notificationView,item.dataset.notificationRecord);}));
      list.querySelectorAll('[data-mark-notification-read]').forEach(button=>button.addEventListener('click',(event)=>{event.stopPropagation();markNotificationRead(button.dataset.markNotificationRead);buildNotifications();}));
    }
    const unread=alerts.filter(x=>!x.read).length;
    const count=document.getElementById('notificationCount'); if(count){count.textContent=unread;count.dataset.count=String(unread);count.hidden=unread===0;}
    const markAll=document.getElementById('markAllNotificationsRead');if(markAll){markAll.hidden=!alerts.some(x=>!x.read);markAll.disabled=!alerts.some(x=>!x.read);}
  }
  function globalSearch(q){
    const term=q.trim().toLowerCase(); if(!term) return [];
    return [
      {view:'financialAnalytics',title:'Phân tích tài chính',sub:'Hệ số tài chính • Forecast • Kiểm toán liên kết'},
      ...db.projects.map(x=>({view:'projects',title:x.name,sub:`Dự án • ${x.code}`})),
      ...db.clients.map(x=>({view:'crm',title:x.name,sub:`Khách hàng • ${x.code}`})),
      ...db.people.map(x=>({view:'people',title:x.name,sub:`Nhân sự • ${x.role}`})),
      ...db.journalEntries.map(x=>({view:'accounting',title:x.documentNo,sub:`Chứng từ • ${x.description}`})),
      ...db.documents.map(x=>({view:'documents',title:x.title,sub:`Hồ sơ • ${x.type}`})),
      ...db.purchaseOrders.map(x=>({view:'procurement',title:x.itemName,sub:`Đơn mua • ${x.poNo}`})),
      ...db.tools.map(x=>({view:'procurement',title:x.name,sub:`CCDC • ${x.toolCode}`})),
      ...db.fixedAssets.map(x=>({view:'procurement',title:x.name,sub:`TSCĐ • ${x.assetCode}`}))
    ].filter(x=>(x.title+' '+x.sub).toLowerCase().includes(term)).slice(0,10);
  }
  function readReportPeriodPreference(){
    try{return JSON.parse(localStorage.getItem(REPORT_PERIOD_STORAGE_KEY)||'null');}catch{return null;}
  }
  function writeReportPeriodPreference(state){
    try{localStorage.setItem(REPORT_PERIOD_STORAGE_KEY,JSON.stringify(state));}catch{}
  }
  function applyReportPeriodState(state,{renderView=false,notify=false}={}){
    const from=document.getElementById('dateFrom'),to=document.getElementById('dateTo'),preset=document.getElementById('periodPreset');
    if(!from||!to||!preset)return false;
    const changed=from.value!==state.from||to.value!==state.to||preset.value!==state.preset;
    from.value=state.from;to.value=state.to;preset.value=state.preset;
    writeReportPeriodPreference(state);
    if(renderView&&changed)render();
    if(notify&&changed)toastMsg('Đã cập nhật kỳ báo cáo');
    return changed;
  }
  function initializeReportPeriod(){
    const state=ReportingPeriod.normalizeState(readReportPeriodPreference(),new Date());
    applyReportPeriodState(state);
    return state;
  }
  function setPreset(value){
    const from=document.getElementById('dateFrom'),to=document.getElementById('dateTo');
    if(!from||!to)return;
    if(value==='custom'){
      applyReportPeriodState({preset:'custom',from:from.value,to:to.value,anchorDate:ReportingPeriod.localISODate()},{});
      return;
    }
    applyReportPeriodState(ReportingPeriod.periodForPreset(value,new Date()),{renderView:true,notify:true});
  }
  function setCustomReportPeriod(event){
    const from=document.getElementById('dateFrom'),to=document.getElementById('dateTo'),preset=document.getElementById('periodPreset');
    if(!from||!to||!preset)return;
    if(!ReportingPeriod.isISODate(from.value)||!ReportingPeriod.isISODate(to.value))return;
    if(from.value>to.value){
      if(event?.target?.id==='dateFrom')to.value=from.value;else from.value=to.value;
    }
    preset.value='custom';
    writeReportPeriodPreference({preset:'custom',from:from.value,to:to.value,anchorDate:ReportingPeriod.localISODate()});
    render();
  }
  function syncDynamicReportPeriod({renderView=true,notify=false}={}){
    const stored=readReportPeriodPreference();
    if(stored?.preset==='custom')return false;
    const preset=['year','quarter','month'].includes(stored?.preset)?stored.preset:(document.getElementById('periodPreset')?.value||'year');
    if(preset==='custom')return false;
    return applyReportPeriodState(ReportingPeriod.periodForPreset(preset,new Date()),{renderView,notify});
  }
  document.getElementById('notificationBtn').onclick=()=>{buildNotifications();openDrawer('notificationDrawer')};
  document.getElementById('markAllNotificationsRead').onclick=()=>{const ids=notificationItems().map(x=>x.id);db.notificationReads=[...new Set([...(db.notificationReads||[]),...ids])];saveDB();buildNotifications();toastMsg('Đã đánh dấu tất cả thông báo là đã xem');};
  document.getElementById('filterBtn').onclick=()=>{configureFilterDrawer();openDrawer('filterDrawer');};
  document.getElementById('profileBtn').onclick=()=>openDrawer('profileDrawer');
  document.querySelectorAll('[data-open-export-center]').forEach(b=>b.onclick=()=>{closeDrawers();navigate('exports');});
  document.getElementById('drawerBackdrop').onclick=closeDrawers;
  document.querySelectorAll('[data-close-drawer]').forEach(x=>x.onclick=closeDrawers);
  document.getElementById('helpBtn').onclick=()=>toastMsg('Chọn phân hệ ở thanh bên; dùng + để thêm dữ liệu, Bộ lọc để thu hẹp và hồ sơ tài khoản để sao lưu.');
  document.getElementById('refreshBtn').onclick=()=>{syncDynamicReportPeriod({renderView:false});syncDynamicCompliance({persist:false});render();toastMsg('Dữ liệu và lịch thuế đã được làm mới')};
  document.getElementById('periodPreset').onchange=event=>setPreset(event.target.value);
  document.getElementById('dateFrom').onchange=setCustomReportPeriod; document.getElementById('dateTo').onchange=setCustomReportPeriod;
  document.getElementById('filterProject').innerHTML='<option value="">Tất cả dự án</option>'+db.projects.map(x=>`<option value="${esc(x.id)}">${esc(x.code)} — ${esc(x.name)}</option>`).join('');
  document.getElementById('filterForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);activeFilters={view:currentView,status:String(fd.get('status')||''),project:String(fd.get('project')||''),department:String(fd.get('department')||'')};closeDrawers();render();toastMsg('Đã áp dụng bộ lọc')};
  document.getElementById('clearFilter').onclick=()=>{activeFilters={view:currentView,status:'',project:'',department:''};document.getElementById('filterForm').reset();configureFilterDrawer();closeDrawers();render();toastMsg('Đã xóa bộ lọc')};
  document.querySelectorAll('[data-mobile-view]').forEach(x=>x.onclick=()=>navigate(x.dataset.mobileView));
  document.getElementById('mobileMore').onclick=()=>{
    setSidebarOpen(true);
    document.body.classList.add('mobile-more-open');
    document.querySelectorAll('#nav .nav-group').forEach(group=>setNavGroupState(group,true));
    const nav=document.getElementById('nav');if(nav){nav.scrollTop=0;requestAnimationFrame(()=>nav.focus?.({preventScroll:true}));}
  };
  document.getElementById('resetLayout').onclick=()=>{document.getElementById('sidebar').classList.remove('collapsed');syncSidebarGridState();syncActiveNavGroup();closeDrawers();toastMsg('Đã khôi phục bố cục')};
  const gs=document.getElementById('globalSearch'), sr=document.getElementById('searchResults');
  gs.oninput=()=>{const rows=globalSearch(gs.value);sr.innerHTML=rows.map((x,i)=>`<button class="search-result" data-search-index="${i}"><span><strong>${esc(x.title)}</strong><small>${esc(x.sub)}</small></span><span>→</span></button>`).join('')||'<div class="empty-state">Không tìm thấy kết quả.</div>';sr.classList.toggle('hidden',!gs.value.trim());sr.querySelectorAll('[data-search-index]').forEach((b,i)=>b.onclick=()=>{navigate(rows[i].view);gs.value='';sr.classList.add('hidden')})};
  document.addEventListener('click',e=>{if(!e.target.closest('.global-search-wrap'))sr.classList.add('hidden')});
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();gs.focus()} });
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('installBtn');b.hidden=false;b.onclick=async()=>{deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;b.hidden=true;deferredInstallPrompt=null;}});
  let responsiveTimer=0;
  window.addEventListener('resize',()=>{clearTimeout(responsiveTimer);responsiveTimer=setTimeout(syncResponsiveLayout,90)},{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(syncResponsiveLayout,180),{passive:true});
  const tableLayoutHost=document.querySelector('.main');
  let tableLayoutHostWidth=Math.round(tableLayoutHost?.getBoundingClientRect().width||0);
  const tableLayoutResizeObserver=window.ResizeObserver&&tableLayoutHost?new ResizeObserver(entries=>{
    const next=Math.round(entries[0]?.contentRect?.width||0);
    if(next>0&&Math.abs(next-tableLayoutHostWidth)>1){tableLayoutHostWidth=next;scheduleTableRelayout();}
  }):null;
  tableLayoutResizeObserver?.observe(tableLayoutHost);
  document.addEventListener('pointerdown',event=>{
    if(!window.matchMedia('(max-width: 1024px)').matches)return;
    const sidebar=document.getElementById('sidebar');
    if(sidebar?.classList.contains('open')&&!event.target.closest('#sidebar')&&!event.target.closest('#menuBtn')&&!event.target.closest('#mobileMore'))setSidebarOpen(false);
  });
  syncResponsiveLayout();
  syncSidebarGridState();
  const initial=location.hash.slice(1); if(viewMeta[initial]) currentView=initial;
  initializeReportPeriod();
  if(ENVIRONMENT==='demo')bootstrapProcurementAutomation();
  refreshTaxCalendar({persist:ENVIRONMENT==='demo'});
  buildNotifications();
  window.addEventListener('focus',()=>{syncDynamicReportPeriod({notify:true});syncDynamicCompliance({persist:false,renderView:true,notify:true});purgeExpiredTrash({notify:true}).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){syncDynamicReportPeriod({notify:true});syncDynamicCompliance({persist:false,renderView:true,notify:true});purgeExpiredTrash({notify:true}).catch(()=>{});}});
  setInterval(()=>{syncDynamicReportPeriod({notify:true});syncDynamicCompliance({persist:false,renderView:true,notify:true});purgeExpiredTrash({notify:true}).catch(()=>{});},60*60*1000);


  window.addEventListener('alpha:remote-db',e=>{
    if(!e.detail?.db)return;
    suppressSyncCapture=true;
    try{
      db=migrateDB(e.detail.db);
      refreshTaxCalendar({persist:false});
      statutoryCloudAudit=null;statutoryCloudNotes=[];
      if(ALLOW_LOCAL_BUSINESS_DATA)localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
      const projectFilter=document.getElementById('filterProject');
      if(projectFilter)projectFilter.innerHTML='<option value="">Tất cả dự án</option>'+db.projects.map(x=>`<option value="${esc(x.id)}">${esc(x.code)} — ${esc(x.name)}</option>`).join('');
      render();
      buildNotifications();
      loadStatutoryTemplatesCloud({rerender:true}).catch(()=>{});
    }finally{suppressSyncCapture=false;}
  });
  window.addEventListener('beforeunload',(event)=>{
    if(!IS_PRODUCTION)return;
    const state=window.AlphaOnline?.status?.();
    const pending=Array.isArray(state?.outbox)?state.outbox.length:Number(state?.outbox||0);
    if(pending>0){event.preventDefault();event.returnValue='';}
  });

  window.AlphaERP={
    getDB:()=>clone(db),
    getStatutoryCloudNotes:()=>clone(statutoryCloudNotes),
    getStatutoryCloudAudit:()=>clone(statutoryCloudAudit),
    refreshStatutoryCertification:(range)=>refreshStatutoryCertification(range||currentRange()),
    applyRemote:(next)=>window.dispatchEvent(new CustomEvent('alpha:remote-db',{detail:{db:next}})),
    commit:(next)=>{if(!ensureWritable())return false;db=migrateDB(next);const saved=saveDB();if(saved)render();return saved;},
    moveToTrash:(type,id,options={})=>moveRecordToTrash(type,id,options),
    moveExternalToTrash:(options={})=>moveExternalToTrash(options),
    registerTrashHandler:(source,handler)=>registerTrashHandler(source,handler),
    restoreTrash:(entryId)=>restoreTrashEntry(entryId),
    purgeTrash:(entryId)=>purgeTrashEntry(entryId),
    render:()=>render(),
    storageKey:STORAGE_KEY,
    version:RELEASE_VERSION
  };

  render();
  setTimeout(()=>purgeExpiredTrash({notify:true}).catch(()=>{}),2500);
  setTimeout(()=>loadStatutoryTemplatesCloud({rerender:true}).catch(()=>{}),1800);
})();
