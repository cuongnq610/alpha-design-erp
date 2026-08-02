(() => {
  'use strict';

  const STORAGE_KEY = 'alpha_design_erp_theme_preference';
  const OPTIONS = new Set(['light', 'dark', 'system']);
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function getPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return OPTIONS.has(saved) ? saved : 'system';
    } catch (_) {
      return 'system';
    }
  }

  function resolveTheme(preference) {
    return preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  }

  function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#071827' : '#062f55');
  }

  function updateControls(preference, resolved) {
    const button = document.getElementById('themeBtn');
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    const names = {light: 'Ngày', dark: 'Đêm', system: 'Theo hệ thống'};
    const icons = {light: '☼', dark: '☾', system: '◐'};
    if (button) {
      button.dataset.themePreference = preference;
      button.title = `Giao diện: ${names[preference]}`;
      button.setAttribute('aria-label', `Giao diện hiện tại: ${names[preference]}. Nhấn để chọn.`);
    }
    if (icon) icon.textContent = preference === 'system' ? icons.system : icons[resolved];
    if (label) label.textContent = `Giao diện ${names[preference]}`;
    document.querySelectorAll('[data-theme-option]').forEach((option) => {
      const selected = option.dataset.themeOption === preference;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-checked', String(selected));
    });
  }

  function applyTheme(preference, {persist = true, announce = false} = {}) {
    const safePreference = OPTIONS.has(preference) ? preference : 'system';
    const resolved = resolveTheme(safePreference);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = safePreference;
    document.documentElement.style.colorScheme = resolved;
    document.body?.classList.toggle('dark-theme', resolved === 'dark');
    updateThemeColor(resolved);
    updateControls(safePreference, resolved);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, safePreference); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('alpha:theme-change', {
      detail: {preference: safePreference, theme: resolved}
    }));
    if (announce && typeof window.AlphaERP?.render === 'function') {
      window.AlphaERP.render();
    }
    return resolved;
  }

  function closeMenu() {
    const menu = document.getElementById('themeMenu');
    const button = document.getElementById('themeBtn');
    menu?.classList.add('hidden');
    button?.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    const menu = document.getElementById('themeMenu');
    const button = document.getElementById('themeBtn');
    menu?.classList.remove('hidden');
    button?.setAttribute('aria-expanded', 'true');
    const active = menu?.querySelector('[data-theme-option].active');
    active?.focus({preventScroll: true});
  }

  function initialiseControls() {
    const switcher = document.getElementById('themeSwitcher');
    const button = document.getElementById('themeBtn');
    const menu = document.getElementById('themeMenu');
    if (!switcher || !button || !menu) return;

    updateControls(getPreference(), resolveTheme(getPreference()));
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      menu.classList.contains('hidden') ? openMenu() : closeMenu();
    });
    menu.addEventListener('click', (event) => {
      const option = event.target.closest('[data-theme-option]');
      if (!option) return;
      applyTheme(option.dataset.themeOption, {persist: true, announce: true});
      closeMenu();
      button.focus({preventScroll: true});
    });
    menu.addEventListener('keydown', (event) => {
      const items = [...menu.querySelectorAll('[data-theme-option]')];
      const index = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault(); closeMenu(); button.focus({preventScroll: true}); return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else if (event.key === 'ArrowDown') next = (index + 1 + items.length) % items.length;
      else next = (index - 1 + items.length) % items.length;
      items[next]?.focus();
    });
    document.addEventListener('click', (event) => {
      if (!switcher.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  media.addEventListener?.('change', () => {
    if (getPreference() === 'system') applyTheme('system', {persist: false, announce: true});
  });

  const initialPreference = getPreference();
  applyTheme(initialPreference, {persist: false});
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialiseControls, {once: true});
  } else {
    initialiseControls();
  }

  window.AlphaTheme = Object.freeze({
    getPreference,
    getTheme: () => document.documentElement.dataset.theme || resolveTheme(getPreference()),
    set: (preference) => applyTheme(preference, {persist: true, announce: true})
  });
})();
