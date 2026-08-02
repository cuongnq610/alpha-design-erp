(() => {
  'use strict';

  const Calc = window.AlphaCalc;
  if(!Calc) throw new Error('Thiếu Calculation Core cho bảng lương chi tiết.');

  const FORMULA_VERSION = 'ALPHA-PAYROLL-4.5.61';
  const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const vnd = (value) => Calc.vnd ? Calc.vnd(value) : Math.round(n(value));
  const iso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const statusIs = (value, ...targets) => targets.some(target => String(value || '').trim().toLowerCase() === String(target).trim().toLowerCase());
  const bool = (value, fallback = false) => value === undefined || value === null || value === '' ? fallback : value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
  const monthKey = (value = new Date()) => {
    if(typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const bounds = (key) => {
    if(!/^\d{4}-\d{2}$/.test(String(key || ''))) return {from:'',to:''};
    const [year, month] = key.split('-').map(Number);
    const last = new Date(year, month, 0).getDate();
    return {from:`${key}-01`,to:`${key}-${String(last).padStart(2, '0')}`};
  };
  const itemKey = (periodId, personId) => `${String(periodId || '')}:${String(personId || '')}`;
  const periodCode = (key) => `PAY-${key}`;
  const isLockedStatus = (status) => statusIs(status, 'Approved', 'Locked', 'Posted');
  const employedDuring = (person, range) => {
    const start = person.startDate ?? person.start_date ?? person.hireDate ?? person.hire_date ?? '';
    const end = person.endDate ?? person.end_date ?? person.terminationDate ?? person.termination_date ?? '';
    if(iso(start) && start > range.to) return false;
    if(iso(end) && end < range.from) return false;
    if(!iso(start) && !iso(end) && statusIs(person.status, 'Inactive', 'Terminated', 'Resigned', 'Deleted')) return false;
    return true;
  };
  const activePeople = (db, key) => {
    const range = bounds(key);
    return (db.people || []).filter(person => employedDuring(person, range));
  };
  const findPeriod = (db, key) => (db.payrollPeriods || []).find(period => String(period.periodCode ?? period.period_code ?? '') === periodCode(key) || String(period.month || period.monthKey || period.month_key || '') === key);
  const findItem = (db, periodId, personId) => (db.payrollItems || []).find(item => String(item.payrollPeriodId ?? item.payroll_period_id ?? '') === String(periodId) && String(item.personId ?? item.person_id ?? item.employeeId ?? item.employee_id ?? '') === String(personId));
  const approvedHours = (db, personId, range) => Calc.approvedTimesheets(db,{...range,personId});
  const cap = (value, min, max) => Math.min(max, Math.max(min, n(value)));

  function progressiveTax(taxableIncome, brackets){
    let remaining = Math.max(0, n(taxableIncome));
    let previous = 0;
    let tax = 0;
    for(const bracket of brackets){
      const upper = bracket.upTo === null || bracket.upTo === undefined ? Infinity : Math.max(previous, n(bracket.upTo));
      const slice = Math.max(0, Math.min(remaining, upper - previous));
      tax += slice * Math.max(0, n(bracket.rate)) / 100;
      remaining -= slice;
      previous = upper;
      if(remaining <= 0) break;
    }
    return vnd(tax);
  }

  function fixedPitPolicy(date, settings = {}){
    const effectiveDate = iso(settings.fixedPitScheduleEffectiveDate ?? settings.fixed_pit_schedule_effective_date)
      ? String(settings.fixedPitScheduleEffectiveDate ?? settings.fixed_pit_schedule_effective_date)
      : '2026-01-01';
    const current = date >= effectiveDate;
    const configured = current ? settings.fixedPitBrackets : settings.fixedPitBracketsPrevious;
    const defaultCurrent = [
      {upTo:10_000_000,rate:5},
      {upTo:30_000_000,rate:10},
      {upTo:60_000_000,rate:20},
      {upTo:100_000_000,rate:30},
      {upTo:null,rate:35}
    ];
    const defaultPrevious = [
      {upTo:5_000_000,rate:5},
      {upTo:10_000_000,rate:10},
      {upTo:18_000_000,rate:15},
      {upTo:32_000_000,rate:20},
      {upTo:52_000_000,rate:25},
      {upTo:80_000_000,rate:30},
      {upTo:null,rate:35}
    ];
    return {
      effectiveDate,
      brackets:Array.isArray(configured) && configured.length ? configured : (current ? defaultCurrent : defaultPrevious),
      personalDeduction:Math.max(0,n(current ? (settings.personalDeduction ?? settings.personal_deduction ?? 15_500_000) : (settings.personalDeductionPrevious ?? settings.personal_deduction_previous ?? 11_000_000))),
      dependentDeduction:Math.max(0,n(current ? (settings.dependentDeduction ?? settings.dependent_deduction ?? 6_200_000) : (settings.dependentDeductionPrevious ?? settings.dependent_deduction_previous ?? 4_400_000)))
    };
  }

  function automaticModes(person = {}, storedItem = {}){
    const type = statusIs(person.type, 'CTV') ? 'CTV' : 'Fixed';
    const recurringAllowance = n(person.monthlyAllowance ?? person.monthly_allowance);
    const currentAllowance = n(storedItem.allowances);
    const currentOvertime = n(storedItem.overtimePay ?? storedItem.overtime_pay ?? storedItem.overtime);
    const employeeInsurance = n(storedItem.employeeInsurance ?? storedItem.employee_insurance);
    const employerInsurance = n(storedItem.employerInsurance ?? storedItem.employer_insurance);
    const manualPit = n(storedItem.personalIncomeTax ?? storedItem.personal_income_tax);
    const legacyPitMode = String(storedItem.pitMode ?? storedItem.pit_mode ?? '').trim();
    return {
      allowanceMode:String(storedItem.allowanceMode ?? storedItem.allowance_mode ?? (currentAllowance !== 0 && recurringAllowance === 0 ? 'Manual' : 'Auto profile')),
      overtimeMode:String(storedItem.overtimeMode ?? storedItem.overtime_mode ?? (currentOvertime !== 0 ? 'Manual' : 'Auto timesheet')),
      insuranceMode:String(storedItem.insuranceMode ?? storedItem.insurance_mode ?? ((employeeInsurance > 0 || employerInsurance > 0) ? 'Manual' : 'Auto policy')),
      pitMode:legacyPitMode || (type === 'CTV' ? 'Auto CTV' : (manualPit > 0 ? 'Manual review' : 'Auto progressive'))
    };
  }

  function calculateItem(db, person, key, storedItem = {}, period = null){
    const settings = db.settings || {};
    const range = bounds(key);
    const standardWorkdays = Math.max(0, n(storedItem.standardWorkdays ?? storedItem.standard_workdays) || Calc.workingDaysInRange(range, settings));
    const employmentWorkdays = Math.max(0, Calc.workingDaysInRange(range, settings, person));
    const unpaidLeaveDays = Math.max(0, n(storedItem.unpaidLeaveDays ?? storedItem.unpaid_leave_days));
    const payableWorkdays = Math.max(0, Math.min(standardWorkdays, employmentWorkdays) - Math.min(unpaidLeaveDays, employmentWorkdays));
    const dailyHours = Math.max(1, n(settings.dailyWorkingHours ?? settings.daily_working_hours) || (n(settings.monthlyWorkingHours ?? settings.monthly_working_hours) || 176) / 22);
    const capacityHours = Math.round(payableWorkdays * dailyHours * 100) / 100;
    const timesheets = approvedHours(db, person.id, range);
    const dailyApproved = new Map();
    timesheets.forEach(row => {
      const date = String(row.date || '');
      dailyApproved.set(date,(dailyApproved.get(date)||0)+Math.max(0,n(row.hours)));
    });
    const hours = [...dailyApproved.values()].reduce((sum,value)=>sum+value,0);
    const regularHours = [...dailyApproved.values()].reduce((sum,value)=>sum+Math.min(dailyHours,value),0);
    const overtimeHours = [...dailyApproved.values()].reduce((sum,value)=>sum+Math.max(0,value-dailyHours),0);
    const attendanceDays = [...dailyApproved.values()].filter(value=>value>0).length;
    const billableHours = timesheets.filter(row=>row.billable === true || statusIs(row.billingStatus, 'Billable')).reduce((sum,row)=>sum+n(row.hours),0);
    const type = statusIs(person.type, 'CTV') ? 'CTV' : 'Fixed';
    const monthlySalary = Math.max(0,n(person.monthlySalary ?? person.monthly_salary));
    const hourlyRate = Math.max(0,n(person.hourlyRate ?? person.hourly_rate));
    const baseSalary = type === 'CTV'
      ? vnd(hours * hourlyRate)
      : vnd(monthlySalary * (standardWorkdays ? payableWorkdays / standardWorkdays : 0));

    const modes = automaticModes(person,storedItem);
    const recurringAllowance = Math.max(0,n(person.monthlyAllowance ?? person.monthly_allowance));
    const autoAllowance = type === 'Fixed' ? vnd(recurringAllowance * (standardWorkdays ? payableWorkdays / standardWorkdays : 0)) : 0;
    const allowances = Math.max(0,vnd(statusIs(modes.allowanceMode,'Manual') ? storedItem.allowances : autoAllowance));

    const hourlyBase = standardWorkdays > 0 ? monthlySalary / (standardWorkdays * dailyHours) : 0;
    const overtimeMultiplier = Math.max(1,n(person.overtimeMultiplier ?? person.overtime_multiplier ?? settings.overtimeMultiplier ?? settings.overtime_multiplier) || 1.5);
    const autoOvertimePay = type === 'Fixed' ? vnd(overtimeHours * hourlyBase * overtimeMultiplier) : 0;
    const overtimePay = Math.max(0,vnd(statusIs(modes.overtimeMode,'Manual') ? (storedItem.overtimePay ?? storedItem.overtime_pay ?? storedItem.overtime) : autoOvertimePay));

    const bonus = Math.max(0,vnd(storedItem.bonus));
    const otherIncome = Math.max(0,vnd(storedItem.otherIncome ?? storedItem.other_income));
    const grossIncome = vnd(baseSalary + allowances + overtimePay + bonus + otherIncome);

    const insuranceEnabled = type === 'Fixed' && bool(person.insuranceEnabled ?? person.insurance_enabled,true);
    const employeeInsuranceRate = Math.max(0,n(settings.employeeInsuranceRate ?? settings.employee_insurance_rate));
    const employerInsuranceRate = Math.max(0,n(settings.employerInsuranceRate ?? settings.employer_insurance_rate));
    const insuranceBaseMonthly = Math.max(0,n(person.insuranceSalary ?? person.insurance_salary) || monthlySalary);
    const insuranceProrate = bool(settings.insuranceProrateByWorkdays ?? settings.insurance_prorate_by_workdays,false);
    const insuranceSalaryCap = Math.max(0,n(settings.insuranceSalaryCap ?? settings.insurance_salary_cap));
    let insuranceBase = insuranceEnabled ? insuranceBaseMonthly * (insuranceProrate && standardWorkdays ? payableWorkdays / standardWorkdays : 1) : 0;
    if(insuranceSalaryCap > 0) insuranceBase = Math.min(insuranceBase,insuranceSalaryCap);
    insuranceBase = vnd(insuranceBase);
    const explicitEmployeeInsurance = storedItem.employeeInsurance ?? storedItem.employee_insurance;
    const explicitEmployerInsurance = storedItem.employerInsurance ?? storedItem.employer_insurance;
    const employeeInsurance = Math.max(0,vnd(statusIs(modes.insuranceMode,'Manual') ? explicitEmployeeInsurance : insuranceBase * employeeInsuranceRate / 100));
    const employerInsurance = Math.max(0,vnd(statusIs(modes.insuranceMode,'Manual') ? explicitEmployerInsurance : insuranceBase * employerInsuranceRate / 100));

    const manualPit = Math.max(0,vnd(storedItem.personalIncomeTax ?? storedItem.personal_income_tax));
    let personalIncomeTax = manualPit;
    let taxableIncome = 0;
    let personalDeduction = 0;
    let dependentDeduction = 0;
    let dependentCount = Math.max(0,Math.floor(n(person.dependentCount ?? person.dependent_count)));
    let pitRequiresManualReview = false;
    let pitThreshold = 0;
    if(type === 'CTV' && statusIs(modes.pitMode, 'Auto CTV')){
      const result = Calc.pitWithholding({date:range.to,grossIncome,taxableIncome:grossIncome,withholdingMethod:'Khấu trừ tỷ lệ'},settings);
      personalIncomeTax = result.tax;
      taxableIncome = grossIncome;
      pitRequiresManualReview = Boolean(result.requiresManualReview);
      pitThreshold = Calc.pitWithholdingThresholdForDate ? Calc.pitWithholdingThresholdForDate({date:range.to},settings) : 0;
    }else if(type === 'Fixed' && statusIs(modes.pitMode,'Auto progressive')){
      const policy = fixedPitPolicy(range.to,settings);
      personalDeduction = policy.personalDeduction;
      dependentDeduction = policy.dependentDeduction;
      const taxExemptIncome = Math.max(0,vnd(person.taxExemptIncome ?? person.tax_exempt_income ?? storedItem.taxExemptIncome ?? storedItem.tax_exempt_income));
      const deductibleContributions = Math.max(0,vnd(storedItem.otherTaxDeductions ?? storedItem.other_tax_deductions));
      taxableIncome = Math.max(0,vnd(grossIncome - taxExemptIncome - employeeInsurance - personalDeduction - dependentCount * dependentDeduction - deductibleContributions));
      const residence = String(person.pitResidence ?? person.pit_residence ?? 'Resident');
      personalIncomeTax = statusIs(residence,'Non-resident') ? vnd(Math.max(0,grossIncome-taxExemptIncome)*20/100) : progressiveTax(taxableIncome,policy.brackets);
    }else if(type === 'Fixed'){
      pitRequiresManualReview = manualPit === 0 && grossIncome > 0;
    }

    const advanceDeduction = Math.max(0,vnd(storedItem.advanceDeduction ?? storedItem.advance_deduction));
    const otherDeductions = Math.max(0,vnd(storedItem.otherDeductions ?? storedItem.other_deductions));
    const totalDeductions = vnd(employeeInsurance + personalIncomeTax + advanceDeduction + otherDeductions);
    const netPay = vnd(grossIncome - totalDeductions);
    const totalEmployerCost = vnd(grossIncome + employerInsurance);
    const utilization = capacityHours > 0 ? hours / capacityHours * 100 : 0;
    const chargeability = hours > 0 ? billableHours / hours * 100 : 0;
    const projectAllocatedCost = type === 'CTV'
      ? baseSalary
      : vnd(totalEmployerCost * Math.min(1.5, capacityHours > 0 ? hours / capacityHours : 0));
    const recoverableRevenue = vnd(billableHours * Math.max(0,n(person.billingRate ?? person.billing_rate)));
    const recoveryRatio = totalEmployerCost > 0 ? recoverableRevenue / totalEmployerCost * 100 : 0;

    const errors = [];
    const warnings = [];
    if(netPay < 0) errors.push('Thực nhận âm; tổng khấu trừ vượt tổng thu nhập.');
    if(unpaidLeaveDays > employmentWorkdays) errors.push('Ngày nghỉ không lương vượt số ngày làm việc trong kỳ.');
    if(type === 'CTV' && hours === 0 && grossIncome > 0) warnings.push('CTV có thu nhập nhưng không có timesheet đã duyệt trong kỳ.');
    if(type === 'CTV' && hourlyRate === 0) warnings.push('CTV chưa có đơn giá giờ; tiền công tự động bằng 0.');
    if(type === 'Fixed' && monthlySalary === 0) warnings.push('Nhân viên cố định chưa có lương tháng; lương tự động bằng 0.');
    if(type === 'Fixed' && pitRequiresManualReview) warnings.push('Thuế TNCN đang ở chế độ thủ công nhưng chưa nhập số thuế.');
    if(insuranceEnabled && statusIs(modes.insuranceMode,'Auto policy') && (employeeInsuranceRate === 0 || employerInsuranceRate === 0)) warnings.push('Tỷ lệ bảo hiểm tự động chưa được cấu hình đầy đủ.');
    if(type === 'Fixed' && statusIs(modes.overtimeMode,'Auto timesheet') && overtimeHours > 0 && monthlySalary === 0) warnings.push('Có giờ làm thêm nhưng chưa có lương tháng để xác định đơn giá làm thêm.');

    const sourceSignature = JSON.stringify({
      person:{monthlySalary,hourlyRate,billingRate:n(person.billingRate ?? person.billing_rate),monthlyAllowance:recurringAllowance,insuranceBaseMonthly,dependentCount,startDate:person.startDate||'',endDate:person.endDate||''},
      settings:{standardWorkdays,dailyHours,employeeInsuranceRate,employerInsuranceRate,overtimeMultiplier,personalDeduction,dependentDeduction},
      timesheets:timesheets.map(row=>[row.id,row.date,n(row.hours),Boolean(row.billable),Boolean(row.approved)]),
      adjustments:{unpaidLeaveDays,bonus,otherIncome,advanceDeduction,otherDeductions,modes}
    });

    return {
      id: storedItem.id || '',
      payrollPeriodId: period?.id || storedItem.payrollPeriodId || storedItem.payroll_period_id || '',
      personId: person.id,
      periodCode: period?.periodCode || period?.period_code || periodCode(key),
      month:key,
      employeeCode:person.code || '', employeeName:person.name || '', department:person.department || '', role:person.role || '', type,
      standardWorkdays,employmentWorkdays,payableWorkdays,unpaidLeaveDays,capacityHours,attendanceDays,approvedHours:Math.round(hours*100)/100,regularHours:Math.round(regularHours*100)/100,overtimeHours:Math.round(overtimeHours*100)/100,billableHours:Math.round(billableHours*100)/100,
      baseSalary,allowances,overtimePay,bonus,otherIncome,grossIncome,insuranceBase,employeeInsurance,personalIncomeTax,taxableIncome,personalDeduction,dependentDeduction,dependentCount,advanceDeduction,otherDeductions,totalDeductions,netPay,employerInsurance,totalEmployerCost,projectAllocatedCost,recoverableRevenue,
      utilization,chargeability,recoveryRatio,allowanceMode:modes.allowanceMode,overtimeMode:modes.overtimeMode,insuranceMode:modes.insuranceMode,pitMode:modes.pitMode,pitThreshold,pitRequiresManualReview,notes:String(storedItem.notes || ''),status:period?.status || 'Draft',calculationVersion:FORMULA_VERSION,sourceSignature,errors,warnings
    };
  }

  function calculatePeriod(db,key){
    const month = monthKey(key);
    const period = findPeriod(db,month) || {id:'',periodCode:periodCode(month),dateFrom:bounds(month).from,dateTo:bounds(month).to,status:'Draft'};
    return activePeople(db,month).map(person => calculateItem(db,person,month,findItem(db,period.id,person.id) || {},period));
  }

  function summary(rows=[]){
    const sum = key => vnd(rows.reduce((total,row)=>total+n(row[key]),0));
    return {
      employees:rows.length,grossIncome:sum('grossIncome'),deductions:sum('totalDeductions'),netPay:sum('netPay'),employerInsurance:sum('employerInsurance'),totalEmployerCost:sum('totalEmployerCost'),projectAllocatedCost:sum('projectAllocatedCost'),recoverableRevenue:sum('recoverableRevenue'),overtimeHours:rows.reduce((s,row)=>s+n(row.overtimeHours),0),taxableIncome:sum('taxableIncome'),
      utilization:rows.reduce((s,row)=>s+n(row.approvedHours),0) / Math.max(1,rows.reduce((s,row)=>s+n(row.capacityHours),0)) * 100,
      recoveryRatio:sum('totalEmployerCost') ? sum('recoverableRevenue')/sum('totalEmployerCost')*100 : 0,
      errors:rows.flatMap(row=>row.errors.map(message=>({personId:row.personId,message}))),warnings:rows.flatMap(row=>row.warnings.map(message=>({personId:row.personId,message})))
    };
  }

  function ensurePeriod(db,key,idFactory=(prefix)=>`${prefix}-${Date.now()}`){
    const month=monthKey(key), range=bounds(month);
    db.payrollPeriods=Array.isArray(db.payrollPeriods)?db.payrollPeriods:[];
    db.payrollItems=Array.isArray(db.payrollItems)?db.payrollItems:[];
    let period=findPeriod(db,month);
    if(!period){
      period={id:idFactory('payp'),periodCode:periodCode(month),month,dateFrom:range.from,dateTo:range.to,status:'Draft',createdAt:new Date().toISOString(),calculationVersion:FORMULA_VERSION,autoCalculation:true};
      db.payrollPeriods.unshift(period);
    }
    if(isLockedStatus(period.status)) return {period,rows:calculatePeriod(db,month),created:0,updated:0,locked:true};
    let created=0,updated=0;
    activePeople(db,month).forEach(person=>{
      let item=findItem(db,period.id,person.id);
      if(!item){
        item={id:idFactory('payi'),payrollPeriodId:period.id,personId:person.id,unpaidLeaveDays:0,allowanceMode:'Auto profile',allowances:0,overtimeMode:'Auto timesheet',overtimePay:0,bonus:0,otherIncome:0,insuranceMode:'Auto policy',employeeInsurance:null,employerInsurance:null,pitMode:statusIs(person.type,'CTV')?'Auto CTV':'Auto progressive',personalIncomeTax:0,advanceDeduction:0,otherDeductions:0,notes:'',createdAt:new Date().toISOString()};
        db.payrollItems.unshift(item);created++;
      }
      const modes=automaticModes(person,item);
      Object.assign(item,modes);
      const calculated=calculateItem(db,person,month,item,period);
      Object.assign(item,{
        standardWorkdays:calculated.standardWorkdays,employmentWorkdays:calculated.employmentWorkdays,payableWorkdays:calculated.payableWorkdays,attendanceDays:calculated.attendanceDays,approvedHours:calculated.approvedHours,regularHours:calculated.regularHours,overtimeHours:calculated.overtimeHours,billableHours:calculated.billableHours,
        baseSalary:calculated.baseSalary,allowances:calculated.allowances,overtimePay:calculated.overtimePay,grossSalary:calculated.grossIncome,grossIncome:calculated.grossIncome,insuranceBase:calculated.insuranceBase,employeeInsurance:calculated.employeeInsurance,employerInsurance:calculated.employerInsurance,taxableIncome:calculated.taxableIncome,personalIncomeTax:calculated.personalIncomeTax,totalDeductions:calculated.totalDeductions,
        projectAllocatedCost:calculated.projectAllocatedCost,recoverableRevenue:calculated.recoverableRevenue,utilizationPercent:calculated.utilization,chargeabilityPercent:calculated.chargeability,recoveryRatioPercent:calculated.recoveryRatio,netSalary:calculated.netPay,netPay:calculated.netPay,totalEmployerCost:calculated.totalEmployerCost,sourceSignature:calculated.sourceSignature,calculationVersion:FORMULA_VERSION,updatedAt:new Date().toISOString()
      });
      updated++;
    });
    period.updatedAt=new Date().toISOString();period.calculationVersion=FORMULA_VERSION;period.autoCalculation=true;
    return {period,rows:calculatePeriod(db,month),created,updated,locked:false};
  }

  function refreshDraftPeriods(db,idFactory=(prefix)=>`${prefix}-${Date.now()}`,months=[]){
    const monthSet=new Set((months||[]).filter(key=>/^\d{4}-\d{2}$/.test(String(key||''))));
    const targets=(db.payrollPeriods||[]).filter(period=>statusIs(period.status,'Draft') && (!monthSet.size || monthSet.has(String(period.month||period.monthKey||period.month_key||String(period.periodCode||period.period_code||'').replace('PAY-','')))));
    return targets.map(period=>ensurePeriod(db,period.month||period.monthKey||period.month_key||String(period.periodCode||period.period_code||'').replace('PAY-',''),idFactory));
  }

  function validatePeriod(db,key){
    const rows=calculatePeriod(db,key),totals=summary(rows),period=findPeriod(db,monthKey(key));
    const errors=[...totals.errors];
    if(!period) errors.push({personId:'',message:'Chưa tạo kỳ bảng lương.'});
    if(!rows.length) errors.push({personId:'',message:'Kỳ bảng lương không có nhân sự.'});
    return {valid:errors.length===0,period,rows,summary:totals,errors,warnings:totals.warnings};
  }

  window.AlphaPayrollDetail={FORMULA_VERSION,monthKey,bounds,periodCode,itemKey,isLockedStatus,findPeriod,findItem,fixedPitPolicy,progressiveTax,automaticModes,calculateItem,calculatePeriod,summary,ensurePeriod,refreshDraftPeriods,validatePeriod};
})();
