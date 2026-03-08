// ============================================
//  imnotbad-scripts — Main JS
// ============================================

(function () {
  'use strict';

  // ---- Theme ----
  const THEME_KEY = 'inbs-theme';
  const LANG_KEY  = 'inbs-lang';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn   = document.getElementById('theme-toggle');
    const icon  = btn && btn.querySelector('.theme-icon');
    const label = btn && btn.querySelector('.theme-label');
    const lang  = document.documentElement.getAttribute('data-lang') || 'en';
    if (theme === 'dark') {
      if (icon)  icon.textContent  = '☀';
      if (label) label.textContent = lang === 'ua' ? '' : '';
    } else {
      if (icon)  icon.textContent  = '🌙';
      if (label) label.textContent = lang === 'ua' ? '' : '';
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }

  // ---- Language ----
  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'en';
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('data-lang', lang);
    const strings = window.INBS_I18N && window.INBS_I18N[lang];
    if (!strings) return;

    // Translate all [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (strings[key] !== undefined) {
        el.innerHTML = strings[key];
        // Re-attach nav clicks for any newly injected links
        el.querySelectorAll('[data-nav]').forEach(attachNavClick);
      }
    });

    // Update lang button label
    const btn   = document.getElementById('lang-toggle');
    const label = btn && btn.querySelector('.lang-label');
    if (label) label.textContent = lang === 'ua' ? 'EN' : 'UA';

    // Update theme button labels for the new language
    applyTheme(getTheme());

    // Update search placeholder
    const si = document.getElementById('search-input');
    if (si) si.placeholder = lang === 'ua' ? 'Пошук…  /' : 'Search…  /';

    localStorage.setItem(LANG_KEY, lang);
  }

  function toggleLang() {
    applyLang(getLang() === 'en' ? 'ua' : 'en');
  }

  // ---- Navigation ----
  let currentPage = null;

  function navigate(pageId, pushState) {
    if (!pageId) pageId = 'home';

    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    const target = document.getElementById('page-' + pageId);
    if (target) {
      target.style.display = 'block';
      currentPage = pageId;
    } else {
      const fb = document.getElementById('page-home');
      if (fb) fb.style.display = 'block';
      currentPage = 'home';
    }

    // Sidebar active state
    document.querySelectorAll('.sidebar-nav li a[data-nav]').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-nav') === currentPage);
    });

    // Auto-expand parent sub-nav
    const activeLink = document.querySelector(`.sidebar-nav li a[data-nav="${currentPage}"]`);
    if (activeLink) {
      const parentLi = activeLink.closest('.has-sub');
      if (parentLi) parentLi.classList.add('open');
    }

    if (pushState !== false) {
      const url = currentPage === 'home' ? '#' : '#' + currentPage;
      history.pushState({ page: currentPage }, '', url);
    }

    window.scrollTo(0, 0);
    document.getElementById('content') && (document.getElementById('content').scrollTop = 0);
    closeSidebar();
  }

  function attachNavClick(el) {
    if (el._navBound) return;
    el._navBound = true;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      navigate(this.getAttribute('data-nav'));
    });
  }

  function initNavLinks() {
    document.querySelectorAll('[data-nav]').forEach(attachNavClick);
  }

  // ---- Sidebar (mobile) ----
  function openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
    document.body.style.overflow = '';
  }

  // ---- Collapsible sidebar sections ----
  function initCollapsibles() {
    document.querySelectorAll('.sidebar-section-title.collapsible').forEach(title => {
      const id  = title.getAttribute('data-section');
      const nav = document.getElementById('nav-' + id);
      if (!nav) return;
      const saved = localStorage.getItem('inbs-collapsed-' + id);
      if (saved === '1') { title.classList.add('collapsed'); nav.classList.add('hidden'); }
      if (!title._collapseBound) {
        title._collapseBound = true;
        title.addEventListener('click', () => {
          const c = title.classList.toggle('collapsed');
          nav.classList.toggle('hidden', c);
          localStorage.setItem('inbs-collapsed-' + id, c ? '1' : '0');
        });
      }
    });
  }

  // ---- Sub-nav toggles ----
  function initSubNavs() {
    document.querySelectorAll('.sidebar-nav li.has-sub > a').forEach(a => {
      if (a._subNavBound) return;
      a._subNavBound = true;
      a.addEventListener('click', e => {
        const page = a.getAttribute('data-nav');
        if (!page || page === '') { e.preventDefault(); }
        a.closest('li').classList.toggle('open');
      });
    });
  }

  // ---- Search ----
  function buildSearchIndex() {
    const index = [];
    document.querySelectorAll('.page').forEach(page => {
      const id = page.id.replace('page-', '');
      page.querySelectorAll('h1, h2, h3').forEach((h, i) => {
        index.push({
          page: id,
          title: h.textContent.trim(),
          section: i === 0 ? '' : (page.querySelector('h1')?.textContent.trim() || id),
          weight: h.tagName === 'H1' ? 10 : h.tagName === 'H2' ? 5 : 1
        });
      });
    });
    return index;
  }

  let searchIndex = null;

  function doSearch(q) {
    if (!searchIndex) searchIndex = buildSearchIndex();
    const lq = q.toLowerCase().trim();
    if (!lq) return [];
    return searchIndex
      .filter(i => i.title.toLowerCase().includes(lq))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }

  function renderSearchResults(results, container) {
    container.innerHTML = '';
    const lang = getLang();
    const empty = lang === 'ua' ? 'Нічого не знайдено' : 'No results found';
    if (!results.length) {
      container.innerHTML = `<div class="search-result-item"><span class="search-result-title muted">${empty}</span></div>`;
    } else {
      results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `<div class="search-result-title">${r.title}</div>${r.section ? `<div class="search-result-section">${r.section}</div>` : ''}`;
        div.addEventListener('click', () => {
          navigate(r.page);
          container.classList.remove('visible');
          document.getElementById('search-input').value = '';
        });
        container.appendChild(div);
      });
    }
    container.classList.add('visible');
  }

  // ---- Copy buttons ----
  function initCopyButtons() {
    document.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'copy';
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code');
        navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(() => {
          btn.textContent = '✓ copied';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1800);
        });
      });
      pre.appendChild(btn);
    });
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    // Hide all pages first, then show the right one
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    // Apply saved preferences
    applyTheme(getTheme());
    applyLang(getLang());

    // Buttons
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('lang-toggle')?.addEventListener('click', toggleLang);
    document.getElementById('menu-toggle')?.addEventListener('click', openSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

    // Nav links
    initNavLinks();
    initCollapsibles();
    initSubNavs();
    initCopyButtons();

    // Search
    const searchInput   = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    if (searchInput && searchResults) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        if (q.length < 2) { searchResults.classList.remove('visible'); return; }
        renderSearchResults(doSearch(q), searchResults);
      });
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') { searchResults.classList.remove('visible'); searchInput.blur(); }
      });
      document.addEventListener('click', e => {
        if (!e.target.closest('.search-wrap')) searchResults.classList.remove('visible');
      });
    }

    // Press "/" to focus search
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault(); searchInput?.focus();
      }
    });

    // Initial route
    const hash = location.hash.replace('#', '').trim() || 'home';
    navigate(hash, false);

    // Back/forward
    window.addEventListener('popstate', e => {
      navigate((e.state && e.state.page) || 'home', false);
    });
  });

  // Public API
  window.INBS = { navigate, toggleTheme, toggleLang, applyTheme, applyLang };

})();
