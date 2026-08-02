(() => {
  'use strict';
  const cfg = window.ALPHA_RUNTIME_CONFIG || {};
  const requested = String(cfg.environment || 'demo').toLowerCase();
  const environment = ['demo','staging','production'].includes(requested) ? requested : 'demo';
  const hasCloud = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const header = document.querySelector('.header-actions');
  let pill = document.getElementById('environmentPill');
  if (header && !pill) {
    pill = document.createElement('span');
    pill.id = 'environmentPill';
    pill.className = 'environment-pill';
    header.prepend(pill);
  }
  if (pill) {
    pill.dataset.env = environment;
    pill.textContent = environment === 'production' ? 'PRODUCTION' : environment === 'staging' ? 'STAGING' : 'DEMO';
    pill.title = environment === 'demo' ? 'Dữ liệu mô phỏng lưu trên trình duyệt.' : 'Dữ liệu tập trung qua Supabase/PostgreSQL.';
  }
  document.documentElement.dataset.environment = environment;
  document.body.classList.add('alpha-ui-current');
  document.querySelectorAll('[data-demo-login]').forEach((button) => { button.hidden = environment !== 'demo' || cfg.allowDemoLogin !== true; });
  document.querySelectorAll('.demo-only-control').forEach((node) => { node.hidden = environment !== 'demo'; });
  const email = document.getElementById('loginEmail');
  const password = document.getElementById('loginPassword');
  if (email && environment !== 'demo') email.value = '';
  if (password) { password.value = ''; password.autocomplete = 'current-password'; }
  const versionNodes = document.querySelectorAll('.brand-copy span');
  versionNodes.forEach((node) => {
    if (/VERSION|ERP CLOUD/i.test(node.textContent)) node.textContent = node.classList.contains('eyebrow') ? 'ERP CLOUD v4.5.54' : 'VERSION 4.5.54';
  });
  if (environment === 'production' && cfg.requireServerForProduction !== false && (!hasCloud || cfg.dataMode !== 'server-authoritative')) {
    document.body.classList.add('production-config-error');
  }
  window.addEventListener('load', () => document.body.classList.add('ui-ready'), {once:true});
  window.AlphaEnterprise = Object.freeze({
    version:'4.5.54', formulaVersion:'ALPHA-FINANCIAL-INTELLIGENCE-4.3.8', environment,
    serverConfigured:hasCloud, dataMode:cfg.dataMode || 'demo', unifiedAssets:true
  });
})();
