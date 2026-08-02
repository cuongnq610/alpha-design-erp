(() => {
  'use strict';

  const Calc=window.AlphaCalc;
  const Payroll=window.AlphaPayrollDetail;
  if(!Calc)throw new Error('Thiếu Calculation Core cho ngân sách thưởng và phúc lợi.');
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const vnd=value=>Calc.vnd?Calc.vnd(value):Math.round(n(value));
  const statusIs=(value,...targets)=>targets.some(target=>String(value||'').trim().toLowerCase()===String(target).trim().toLowerCase());
  const yearKey=value=>{
    const parsed=Number(value instanceof Date?value.getFullYear():value);
    return Number.isInteger(parsed)&&parsed>=2000&&parsed<=2200?parsed:new Date().getFullYear();
  };
  const yearBounds=year=>({from:`${year}-01-01`,to:`${year}-12-31`});
  const daysInYear=year=>(new Date(year,11,31)-new Date(year,0,1))/86400000+1;
  const iso=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
  const overlapDays=(person,year)=>{
    const start=iso(person.startDate??person.start_date??person.hireDate??person.hire_date)?new Date(`${person.startDate??person.start_date??person.hireDate??person.hire_date}T00:00:00`):new Date(year,0,1);
    const end=iso(person.endDate??person.end_date??person.terminationDate??person.termination_date)?new Date(`${person.endDate??person.end_date??person.terminationDate??person.termination_date}T00:00:00`):new Date(year,11,31);
    const from=new Date(year,0,1),to=new Date(year,11,31);
    const actualFrom=start>from?start:from,actualTo=end<to?end:to;
    if(actualTo<actualFrom)return 0;
    return Math.floor((actualTo-actualFrom)/86400000)+1;
  };
  const eligiblePeople=(db,year,plan={})=>(db.people||[]).filter(person=>{
    if(statusIs(person.status,'Deleted'))return false;
    if(overlapDays(person,year)<Math.max(0,n(plan.minimumServiceDays)||30))return false;
    if(statusIs(person.type,'CTV'))return Boolean(plan.includeCTVBonus);
    return true;
  });
  const payrollMonth=(period)=>String(period?.month||period?.monthKey||period?.month_key||String(period?.periodCode||period?.period_code||'').replace('PAY-',''));
  const employeeAnnualPayroll=(db,personId,year)=>{
    if(!Payroll)return 0;
    return (db.payrollPeriods||[]).filter(period=>payrollMonth(period).startsWith(`${year}-`)&&!statusIs(period.status,'Cancelled','Deleted')).reduce((sum,period)=>{
      const row=Payroll.calculatePeriod(db,payrollMonth(period)).find(item=>String(item.personId)===String(personId));
      return sum+n(row?.baseSalary);
    },0);
  };
  const averageSalary=(db,person,year)=>{
    if(statusIs(person.type,'CTV')){
      const annual=employeeAnnualPayroll(db,person.id,year);
      const months=(db.payrollPeriods||[]).filter(period=>payrollMonth(period).startsWith(`${year}-`)&&!statusIs(period.status,'Cancelled','Deleted')).length;
      return months?vnd(annual/months):0;
    }
    const monthly=[];
    for(const period of db.payrollPeriods||[]){
      const month=payrollMonth(period);
      if(!month.startsWith(`${year}-`)||statusIs(period.status,'Cancelled','Deleted'))continue;
      const row=Payroll?.calculatePeriod(db,month).find(item=>String(item.personId)===String(person.id));
      if(row&&row.baseSalary>0)monthly.push(row.baseSalary);
    }
    return monthly.length?vnd(monthly.reduce((sum,value)=>sum+n(value),0)/monthly.length):vnd(person.monthlySalary??person.monthly_salary);
  };
  const findPlan=(db,year)=>(db.annualBenefitBudgets||[]).find(item=>Number(item.year)===Number(year));
  const defaultPlan=(year)=>({
    id:'',year:yearKey(year),status:'Draft',minimumServiceDays:30,includeCTVBonus:false,
    companyPerformanceFactor:1,defaultEmployeePerformanceFactor:1,employeePerformanceFactors:{},
    bonusPaymentMode:'Gross',bonusTaxProvisionRate:10,bonusContingencyRate:5,
    travelParticipationRate:90,travelCostPerPerson:5000000,travelCommonCost:20000000,travelContingencyRate:7,
    otherWelfareSpent:0,notes:'',calculationVersion:'ALPHA-BENEFITS-4.5.46'
  });
  const normalizedPlan=(plan,year)=>({...defaultPlan(year),...(plan||{}),year:yearKey(plan?.year||year),employeePerformanceFactors:{...(plan?.employeePerformanceFactors||{})}});
  function calculateBonusBudget(db,yearValue,sourcePlan){
    const year=yearKey(yearValue),plan=normalizedPlan(sourcePlan||findPlan(db,year),year),yearDays=daysInYear(year);
    const rows=eligiblePeople(db,year,plan).map(person=>{
      const serviceDays=overlapDays(person,year),serviceRatio=Math.max(0,Math.min(1,serviceDays/yearDays));
      const avgSalary=averageSalary(db,person,year);
      const employeeFactor=Math.max(0,n(plan.employeePerformanceFactors?.[person.id]??plan.defaultEmployeePerformanceFactor)||0);
      const companyFactor=Math.max(0,n(plan.companyPerformanceFactor));
      const grossBase=vnd(avgSalary*serviceRatio*employeeFactor*companyFactor);
      const taxRate=Math.max(0,Math.min(100,n(plan.bonusTaxProvisionRate)));
      const cashGross=statusIs(plan.bonusPaymentMode,'Net')&&taxRate<100?vnd(grossBase/(1-taxRate/100)):grossBase;
      const pitProvision=Math.max(0,vnd(cashGross-grossBase));
      return {personId:person.id,employeeCode:person.code||'',employeeName:person.name||'',department:person.department||'',type:person.type||'',averageSalary:avgSalary,serviceDays,serviceRatio,employeeFactor,companyFactor,grossBonus:grossBase,pitProvision,cashBudget:cashGross};
    });
    const grossPool=vnd(rows.reduce((sum,row)=>sum+row.grossBonus,0));
    const pitProvision=vnd(rows.reduce((sum,row)=>sum+row.pitProvision,0));
    const contingency=vnd((grossPool+pitProvision)*Math.max(0,n(plan.bonusContingencyRate))/100);
    const total=vnd(grossPool+pitProvision+contingency);
    return {year,plan,rows,grossPool,pitProvision,contingency,total,monthlyAccrual:vnd(total/12)};
  }
  function actualPayrollFund(db,year){
    const periods=(db.payrollPeriods||[]).filter(period=>payrollMonth(period).startsWith(`${year}-`)&&!statusIs(period.status,'Cancelled','Deleted'));
    if(periods.length&&Payroll)return vnd(periods.reduce((sum,period)=>sum+Payroll.summary(Payroll.calculatePeriod(db,payrollMonth(period))).grossIncome,0));
    return vnd((db.people||[]).reduce((sum,person)=>sum+n(person.monthlySalary??person.monthly_salary)*Math.max(0,Math.min(12,overlapDays(person,year)/Math.max(1,daysInYear(year))*12)),0));
  }
  function calculateTravelBudget(db,yearValue,sourcePlan){
    const year=yearKey(yearValue),plan=normalizedPlan(sourcePlan||findPlan(db,year),year);
    const people=(db.people||[]).filter(person=>overlapDays(person,year)>0&&!statusIs(person.status,'Deleted'));
    const eligibleCount=people.length,participationRate=Math.max(0,Math.min(100,n(plan.travelParticipationRate)));
    const expectedParticipants=Math.ceil(eligibleCount*participationRate/100);
    const perPersonTotal=vnd(expectedParticipants*Math.max(0,n(plan.travelCostPerPerson)));
    const commonCost=Math.max(0,vnd(plan.travelCommonCost));
    const subtotal=vnd(perPersonTotal+commonCost);
    const contingency=vnd(subtotal*Math.max(0,n(plan.travelContingencyRate))/100);
    const total=vnd(subtotal+contingency);
    const payrollFund=actualPayrollFund(db,year),welfareCeiling=vnd(payrollFund/12),otherWelfareSpent=Math.max(0,vnd(plan.otherWelfareSpent));
    const remainingBeforeTravel=Math.max(0,vnd(welfareCeiling-otherWelfareSpent));
    const deductibleEstimate=Math.min(total,remainingBeforeTravel),potentialExcess=Math.max(0,vnd(total-deductibleEstimate));
    return {year,plan,eligibleCount,expectedParticipants,participationRate,costPerPerson:vnd(plan.travelCostPerPerson),perPersonTotal,commonCost,subtotal,contingency,total,monthlyAccrual:vnd(total/12),payrollFund,welfareCeiling,otherWelfareSpent,remainingBeforeTravel,deductibleEstimate,potentialExcess};
  }
  function calculateAnnualBudget(db,yearValue,sourcePlan){
    const year=yearKey(yearValue),plan=normalizedPlan(sourcePlan||findPlan(db,year),year),bonus=calculateBonusBudget(db,year,plan),travel=calculateTravelBudget(db,year,plan);
    return {year,plan,bonus,travel,total:vnd(bonus.total+travel.total),monthlyAccrual:vnd((bonus.total+travel.total)/12),errors:[],warnings:[...(travel.potentialExcess>0?[`Quỹ du lịch dự kiến vượt hạn mức phúc lợi quản trị ước tính ${travel.potentialExcess} VND.`]:[]),...(bonus.rows.length===0?['Không có nhân sự đủ điều kiện thưởng tháng lương 13.']:[])]};
  }
  function ensurePlan(db,yearValue,idFactory=(prefix)=>`${prefix}-${Date.now()}`){
    db.annualBenefitBudgets=Array.isArray(db.annualBenefitBudgets)?db.annualBenefitBudgets:[];
    const year=yearKey(yearValue);let plan=findPlan(db,year),created=false;
    if(!plan){plan={...defaultPlan(year),id:idFactory('benefit')};db.annualBenefitBudgets.unshift(plan);created=true;}
    return {plan,created,result:calculateAnnualBudget(db,year,plan)};
  }
  const isLockedStatus=status=>statusIs(status,'Approved','Locked','Posted');
  window.AlphaAnnualBenefits={yearKey,yearBounds,findPlan,defaultPlan,normalizedPlan,eligiblePeople,averageSalary,calculateBonusBudget,calculateTravelBudget,calculateAnnualBudget,ensurePlan,isLockedStatus,actualPayrollFund};
})();
