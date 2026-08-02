(() => {
  'use strict';
  const key='alpha_design_erp_theme_preference';
  try{
    const saved=localStorage.getItem(key);
    const preference=['light','dark','system'].includes(saved)?saved:'system';
    const dark=preference==='dark'||(preference==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme=dark?'dark':'light';
    document.documentElement.dataset.themePreference=preference;
    document.documentElement.style.colorScheme=dark?'dark':'light';
  }catch{
    document.documentElement.dataset.theme='light';
    document.documentElement.dataset.themePreference='system';
    document.documentElement.style.colorScheme='light';
  }
})();
