(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AlphaPermissionMap=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const aliases=Object.freeze({
    dashboard:['dashboard.read'],
    tasks:['projects.read'],
    projects:['projects.read'],
    controls:['projects.control','projects.read'],
    commercial:['commercial.read','crm.read','accounting.read'],
    planning:['projects.control','projects.read'],
    crm:['crm.read'],
    approvals:['procurement.read','crm.read'],
    procurement:['procurement.read','accounting.read'],
    people:['hr.read'],
    timesheets:['timesheet.read'],
    payroll:['payroll.read'],
    documents:['documents.read'],
    storage:['documents.read'],
    finance:['accounting.read'],
    financialAnalytics:['financial_analytics.read','reports.read','accounting.read'],
    accounting:['accounting.read'],
    tax:['tax.read'],
    reports:['reports.read','reports.export'],
    trash:['security.manage'],
    settings:['integrations.manage'],
    admin:['security.manage','users.manage','roles.manage'],
    'cloud-admin':['security.manage'],
    'users.manage':['users.manage'],
    'audit.read':['audit.read','security.manage'],
    'integrations.manage':['integrations.manage']
  });
  function normalize(granted){return Array.isArray(granted)?granted.filter(x=>typeof x==='string'):[];}
  function accepted(requested){const key=String(requested||'').trim();return key?[key,...(aliases[key]||[])]:[];}
  function hasPermission(granted,requested){
    const permissions=normalize(granted);
    if(permissions.includes('*')||permissions.includes('admin'))return true;
    return accepted(requested).some(code=>permissions.includes(code));
  }
  return {aliases,accepted,hasPermission};
});
