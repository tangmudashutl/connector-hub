// ConnectorHUB - Article Directory App (Phase 5 - Advanced Features)

const PER_PAGE = 24;
let currentCat = 'all';
let currentPage = 1;
let searchQuery = '';
let selectedWeek = 'all';
let subFilter = 'all'; // content type sub-filter
let showFavOnly = false; // favorites filter
let activeTag = ''; // active tag from tag cloud
let ARTICLES = [];
let WEEK_MAP = {}; // week_key -> { label, mondayDate, articles }
let FAVORITES = new Set(); // favorite article IDs

// ====== THEME MANAGEMENT ======
function initTheme() {
  const saved = localStorage.getItem('connectorhub_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('connectorhub_theme', next);
}

// ====== FAVORITES MANAGEMENT ======
function loadFavorites() {
  try {
    const saved = localStorage.getItem('connectorhub_favorites');
    if (saved) FAVORITES = new Set(JSON.parse(saved));
  } catch (e) { FAVORITES = new Set(); }
}

function saveFavorites() {
  localStorage.setItem('connectorhub_favorites', JSON.stringify([...FAVORITES]));
}

function toggleFavorite(articleId) {
  let wasRemoved = false;
  if (FAVORITES.has(articleId)) {
    FAVORITES.delete(articleId);
    wasRemoved = true;
  } else {
    FAVORITES.add(articleId);
  }
  saveFavorites();
  updateFavCount();

  // 同步到云端
  if (typeof currentUser !== 'undefined' && currentUser) {
    if (wasRemoved) {
      if (typeof removeCloudFavorite === 'function') removeCloudFavorite(articleId);
    } else {
      const article = ARTICLES.find(a => a.id === articleId);
      if (typeof saveCloudFavorite === 'function') saveCloudFavorite(articleId, article ? article.title : '');
    }
  }
}

function isFavorite(articleId) {
  return FAVORITES.has(articleId);
}

function updateFavCount() {
  const favNav = document.getElementById('navFav');
  if (favNav) {
    favNav.innerHTML = `⭐ 收藏 <span class="nav-count">(${FAVORITES.size})</span>`;
  }
}

// ====== READING TIME ======
function estimateReadingTime(article) {
  const text = (article.content || '') + (article.summary || '');
  if (!text) return null;
  // Chinese: ~300 chars/min, English: ~200 words/min
  const charCount = text.replace(/\s/g, '').length;
  const minutes = Math.ceil(charCount / 300);
  return minutes < 1 ? 1 : minutes;
}

function formatReadingTime(minutes) {
  if (!minutes) return '';
  if (minutes <= 1) return '1 分钟';
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

// ====== TAG CLOUD ======
function buildTagCloud() {
  const tagMap = {};
  ARTICLES.forEach(a => {
    const keywords = (a.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    keywords.forEach(k => {
      tagMap[k] = (tagMap[k] || 0) + 1;
    });
  });

  // Sort by frequency, take top 40
  const tags = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  return tags;
}

function renderTagCloud() {
  const panel = document.getElementById('sidebarTags');
  const tags = buildTagCloud();

  if (tags.length === 0) {
    panel.innerHTML = '<h3 class="sidebar-title">🏷️ 标签云</h3><div class="sidebar-loading">暂无标签</div>';
    return;
  }

  const html = tags.map(([tag, count]) => {
    const active = activeTag === tag ? ' active' : '';
    // Size variation based on count
    const maxCount = tags[0][1];
    const ratio = count / maxCount;
    const fontSize = ratio > 0.7 ? '14px' : ratio > 0.4 ? '12px' : '11px';
    return `<span class="tag-cloud-item${active}" data-tag="${escapeHTML(tag)}" style="font-size:${fontSize}">
      ${escapeHTML(tag)}<span class="tag-cloud-count">${count}</span>
    </span>`;
  }).join('');

  panel.innerHTML = `<h3 class="sidebar-title">🏷️ 标签云</h3><div class="tag-cloud">${html}</div>`;

  // Click handlers
  panel.querySelectorAll('.tag-cloud-item').forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag;
      if (activeTag === tag) {
        // Deselect
        activeTag = '';
        el.classList.remove('active');
      } else {
        // Select new tag
        activeTag = tag;
        panel.querySelectorAll('.tag-cloud-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
      }
      currentPage = 1;
      render();
    });
  });
}

// Merge all data sources
function loadData() {
  const parts = [];
  ['行业新闻','技术文章','厂家档案'].forEach(cat => {
    const key = '_data_' + cat.replace(' ','_');
    if (window[key]) parts.push(...window[key]);
  });
  return parts;
}

// ====== WEEK / DATE HELPERS ======

function parseArticleDate(article) {
  const candidates = [];

  const dm1 = (article.date || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dm1) candidates.push(new Date(+dm1[1], +dm1[2] - 1, +dm1[3]));

  const dm2 = (article.date || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!candidates.length && dm2) candidates.push(new Date(+dm2[1], +dm2[2] - 1, +dm2[3]));

  const wr = (article.week_range || '');
  const wm1 = wr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!candidates.length && wm1) candidates.push(new Date(+wm1[1], +wm1[2] - 1, +wm1[3]));
  const wm2 = wr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!candidates.length && wm2) candidates.push(new Date(+wm2[1], +wm2[2] - 1, +wm2[3]));

  const im = (article.id || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!candidates.length && im) candidates.push(new Date(+im[1], +im[2] - 1, +im[3]));

  return candidates.length ? candidates[0] : null;
}

function getISOWeek(d) {
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const jan1 = new Date(monday.getFullYear(), 0, 1);
  const jan1Day = jan1.getDay() || 7;
  const daysDiff = (monday - jan1) / 86400000;
  const weekNum = Math.ceil((daysDiff + jan1Day) / 7);

  const key = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  const label = `${fmtShort(monday)} ~ ${fmtShort(sunday)}（第${weekNum}周）`;
  return { key, label, monday };
}

function fmtShort(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ====== BUILD WEEK DROPDOWN ======

function buildWeekDropdown() {
  WEEK_MAP = {};

  ARTICLES.forEach((article, idx) => {
    const d = parseArticleDate(article);
    if (d && !isNaN(d.getTime())) {
      const wk = getISOWeek(d);
      if (!WEEK_MAP[wk.key]) {
        WEEK_MAP[wk.key] = { label: wk.label, monday: wk.monday, articles: [] };
      }
      WEEK_MAP[wk.key].articles.push(idx);
    }
    article._weekKey = d ? getISOWeek(d).key : '';
  });

  const select = document.getElementById('weekSelect');
  const sortedWeeks = Object.values(WEEK_MAP).sort((a, b) => b.monday - a.monday);

  select.innerHTML = '<option value="all">全部时间</option>';
  sortedWeeks.forEach((wk, i) => {
    const opt = document.createElement('option');
    const weekKey = Object.keys(WEEK_MAP).find(k => WEEK_MAP[k].monday.getTime() === wk.monday.getTime());
    opt.value = weekKey;
    opt.textContent = wk.label;
    select.appendChild(opt);
  });

  select.value = 'all';
}

// ====== INIT ======
function init() {
  initTheme();
  loadFavorites();
  showSkeleton();
  ARTICLES = loadData();
  if (ARTICLES.length === 0) {
    document.getElementById('articleGrid').innerHTML = '<div class="skeleton-grid" style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">数据加载失败，请刷新页面</div>';
    return;
  }
  buildWeekDropdown();
  updateNavCounts();
  updateHeroStats();
  setupNav();
  setupSearch();
  setupHeroSearch();
  setupWeekFilter();
  setupQuickFilters();
  setupBreadcrumb();
  setupBackToTop();
  setupSubFilters();
  setupFavFilter();
  setupNewsletter();
  setupMfrShowcase();
  setupThemeToggle();
  render();
  updateSidebar();
  renderTagCloud();
  updateFavCount();
}

// ====== THEME TOGGLE ======
function setupThemeToggle() {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

// ====== NAV COUNTS ======
function updateNavCounts() {
  const cats = { all: ARTICLES.length, '行业新闻': 0, '技术文章': 0, '厂家档案': 0 };
  ARTICLES.forEach(a => { if (cats[a.category] !== undefined) cats[a.category]++; });
  document.querySelectorAll('.nav-link').forEach(btn => {
    const cat = btn.dataset.cat;
    const html = btn.textContent.replace(/\(\d+\)/, '').trim();
    btn.innerHTML = `${html} <span class="nav-count">(${cats[cat]})</span>`;
  });
}

// ====== HERO STATS ======
function updateHeroStats() {
  const newsCount = ARTICLES.filter(a => a.category === '行业新闻').length;
  const mfrCount = ARTICLES.filter(a => a.category === '厂家档案').length;
  document.getElementById('heroTotal').textContent = ARTICLES.length;
  document.getElementById('heroNews').textContent = newsCount;
  document.getElementById('heroMfr').textContent = mfrCount;
}

// ====== HERO SEARCH ======
function setupHeroSearch() {
  const heroInput = document.getElementById('heroSearchInput');
  const mainInput = document.getElementById('searchInput');
  let debounceTimer;

  heroInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = heroInput.value.trim();
      searchQuery = q;
      mainInput.value = q;
      document.getElementById('searchClear').style.display = q ? 'block' : 'none';
      currentPage = 1;
      render();
    }, 300);
  });

  mainInput.addEventListener('input', () => {
    heroInput.value = mainInput.value;
  });
}

// ====== SUB-FILTERS ======
function setupSubFilters() {
  document.querySelectorAll('.subfilter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subfilter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      subFilter = btn.dataset.subfilter;
      showFavOnly = false;
      document.getElementById('subfilterFav').classList.remove('active');
      currentPage = 1;
      render();
    });
  });
}

// ====== FAV FILTER ======
function setupFavFilter() {
  // Sidebar fav filter button
  document.getElementById('subfilterFav').addEventListener('click', () => {
    const btn = document.getElementById('subfilterFav');
    if (showFavOnly) {
      showFavOnly = false;
      btn.classList.remove('active');
    } else {
      showFavOnly = true;
      btn.classList.add('active');
      // Clear other subfilters
      document.querySelectorAll('.subfilter').forEach(b => b.classList.remove('active'));
      document.querySelector('.subfilter[data-subfilter="all"]').classList.add('active');
      subFilter = 'all';
    }
    currentPage = 1;
    render();
  });

  // Nav fav tab
  document.getElementById('navFav').addEventListener('click', () => {
    // Deactivate all nav links
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    document.getElementById('navFav').classList.add('active');
    currentCat = 'fav';
    showFavOnly = true;
    currentPage = 1;
    // Reset subfilters
    document.querySelectorAll('.subfilter').forEach(b => b.classList.remove('active'));
    document.querySelector('.subfilter[data-subfilter="all"]').classList.add('active');
    subFilter = 'all';
    document.getElementById('subfilterFav').classList.add('active');
    updateBreadcrumb();
    render();
  });
}

// ====== NAVIGATION ======
function setupNav() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      document.getElementById('navFav').classList.remove('active');
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      currentPage = 1;
      subFilter = 'all';
      showFavOnly = false;
      document.querySelectorAll('.subfilter').forEach(b => b.classList.remove('active'));
      document.querySelector('.subfilter[data-subfilter="all"]').classList.add('active');
      document.getElementById('subfilterFav').classList.remove('active');
      updateBreadcrumb();
      render();
    });
  });
}

// ====== SEARCH ======
function setupSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value.trim();
      clearBtn.style.display = searchQuery ? 'block' : 'none';
      currentPage = 1;
      render();
    }, 300);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    currentPage = 1;
    render();
  });
}

// ====== BREADCRUMB ======
function setupBreadcrumb() {
  document.querySelector('.breadcrumb-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    document.getElementById('navFav').classList.remove('active');
    document.querySelector('.nav-link[data-cat="all"]').classList.add('active');
    currentCat = 'all';
    currentPage = 1;
    subFilter = 'all';
    showFavOnly = false;
    activeTag = '';
    document.querySelectorAll('.subfilter').forEach(b => b.classList.remove('active'));
    document.querySelector('.subfilter[data-subfilter="all"]').classList.add('active');
    document.getElementById('subfilterFav').classList.remove('active');
    updateBreadcrumb();
    renderTagCloud();
    render();
  });
}

function updateBreadcrumb() {
  const current = document.getElementById('breadcrumbCurrent');
  if (currentCat === 'all') {
    current.textContent = showFavOnly ? '收藏文章' : '全部文章';
  } else if (currentCat === 'fav') {
    current.textContent = '收藏文章';
  } else {
    current.textContent = currentCat;
  }
}

// ====== BACK TO TOP ======
function setupBackToTop() {
  const btn = document.getElementById('backToTop');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 400) {
          btn.classList.add('visible');
        } else {
          btn.classList.remove('visible');
        }
        ticking = false;
      });
      ticking = true;
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function setupWeekFilter() {
  const select = document.getElementById('weekSelect');
  select.addEventListener('change', () => {
    selectedWeek = select.value;
    if (selectedWeek !== 'all') {
      document.querySelectorAll('.qfilter').forEach(b => b.classList.remove('active'));
    }
    currentPage = 1;
    render();
  });
}

// ====== QUICK FILTERS ======
function setupQuickFilters() {
  document.querySelectorAll('.qfilter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qfilter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyQuickFilter(btn.dataset.range);
    });
  });
}

function applyQuickFilter(range) {
  const select = document.getElementById('weekSelect');
  const now = new Date();

  switch (range) {
    case 'week': {
      const wk = getISOWeek(now);
      if (WEEK_MAP[wk.key]) {
        select.value = wk.key;
      } else {
        select.value = 'all';
      }
      break;
    }
    case 'month':
      select.value = 'all';
      break;
    case '3month':
      select.value = 'all';
      break;
  }
  selectedWeek = select.value;
  currentPage = 1;
  render();
}

// ====== FILTERING ======
function getFiltered() {
  let articles = ARTICLES;

  // Category
  if (currentCat !== 'all' && currentCat !== 'fav') {
    articles = articles.filter(a => a.category === currentCat);
  }

  // Sub-filter (content type) - works on top of category
  if (subFilter !== 'all') {
    articles = articles.filter(a => a.category === subFilter);
  }

  // Favorites only
  if (showFavOnly || currentCat === 'fav') {
    articles = articles.filter(a => isFavorite(a.id));
  }

  // Week filter (from dropdown)
  if (selectedWeek !== 'all') {
    articles = articles.filter(a => a._weekKey === selectedWeek);
  }

  // Quick filters: 本月 / 近3月
  const activeQFilter = document.querySelector('.qfilter.active');
  if (activeQFilter) {
    const range = activeQFilter.dataset.range;
    const now = new Date();
    if (range === 'month') {
      const monthStart = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
      articles = articles.filter(a => {
        const d = parseArticleDate(a);
        return d && fmtDate(d) >= monthStart;
      });
    } else if (range === '3month') {
      const d3 = new Date(now);
      d3.setMonth(d3.getMonth() - 3);
      const cutoff = fmtDate(d3);
      articles = articles.filter(a => {
        const d = parseArticleDate(a);
        return d && fmtDate(d) >= cutoff;
      });
    }
  }

  // Tag cloud filter
  if (activeTag) {
    articles = articles.filter(a => {
      const keywords = (a.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
      return keywords.includes(activeTag);
    });
  }

  // Keyword search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    articles = articles.filter(a => {
      const haystack = [
        a.title, a.summary, a.source, a.keywords,
        a.content || '', a.importance || ''
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  return articles;
}

// ====== SKELETON LOADING ======
function showSkeleton() {
  const grid = document.getElementById('articleGrid');
  grid.className = 'skeleton-grid';
  const cards = [];
  for (let i = 0; i < 8; i++) {
    cards.push(`
      <div class="skeleton-card">
        <div class="skeleton-icon-row">
          <div class="skeleton-icon"></div>
          <div class="skeleton-line w40"></div>
        </div>
        <div class="skeleton-line h20 w100"></div>
        <div class="skeleton-line w80"></div>
        <div class="skeleton-line w100"></div>
        <div class="skeleton-line w60"></div>
        <div class="skeleton-footer">
          <div class="skeleton-line w30"></div>
          <div class="skeleton-line w20"></div>
        </div>
      </div>`);
  }
  grid.innerHTML = cards.join('');
}

function hideSkeleton() {
  const grid = document.getElementById('articleGrid');
  grid.className = 'article-grid';
  grid.innerHTML = '';
}

// ====== RENDER ======
function render() {
  hideSkeleton();
  const filtered = getFiltered();
  const total = filtered.length;
  const totalPages = Math.ceil(total / PER_PAGE);
  const start = (currentPage - 1) * PER_PAGE;
  const pageArticles = filtered.slice(start, start + PER_PAGE);

  // Stats
  const statCount = document.getElementById('statCount');
  let statLabel = showFavOnly ? `收藏 ${total} 篇` : `共 ${total} 篇文章`;
  if (activeTag) statLabel += ` · 标签：${activeTag}`;
  if (selectedWeek !== 'all' && WEEK_MAP[selectedWeek]) {
    statLabel += ` · <span style="color:var(--primary)">${WEEK_MAP[selectedWeek].label}</span>`;
  }
  statCount.innerHTML = statLabel;

  const statRange = document.getElementById('statRange');
  const dates = filtered.map(a => parseArticleDate(a)).filter(d => d && !isNaN(d.getTime())).sort((a, b) => b - a);
  if (dates.length >= 2) {
    statRange.textContent = `${fmtDate(dates[dates.length - 1])} ~ ${fmtDate(dates[0])}`;
  } else if (dates.length === 1) {
    statRange.textContent = fmtDate(dates[0]);
  } else {
    statRange.textContent = '';
  }

  // Category distribution dots
  const statDots = document.getElementById('statDots');
  const newsCount = filtered.filter(a => a.category === '行业新闻').length;
  const techCount = filtered.filter(a => a.category === '技术文章').length;
  const mfrCount = filtered.filter(a => a.category === '厂家档案').length;
  statDots.innerHTML = `
    <span class="stat-dot dot-news">新闻 ${newsCount}</span>
    <span class="stat-dot dot-tech">技术 ${techCount}</span>
    <span class="stat-dot dot-mfr">厂商 ${mfrCount}</span>
  `;

  // Grid
  const grid = document.getElementById('articleGrid');
  const noRes = document.getElementById('noResults');

  if (total === 0) {
    grid.innerHTML = '';
    noRes.style.display = 'block';
    if (showFavOnly) {
      noRes.querySelector('p').textContent = '还没有收藏文章';
      noRes.querySelector('.hint').textContent = '点击文章卡片上的 ⭐ 即可收藏';
      noRes.querySelector('.no-results-icon').textContent = '⭐';
    } else {
      noRes.querySelector('p').textContent = '没有找到匹配的文章';
      noRes.querySelector('.hint').textContent = '试试调整筛选条件或搜索关键词';
      noRes.querySelector('.no-results-icon').textContent = '🔍';
    }
  } else {
    noRes.style.display = 'none';
    grid.innerHTML = pageArticles.map(a => cardHTML(a)).join('');
  }

  // Pagination
  renderPagination(totalPages, total);

  // Card click handlers (excluding fav button)
  grid.querySelectorAll('.article-card').forEach((card, i) => {
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking fav button
      if (e.target.closest('.card-fav-btn')) return;
      showDetail(pageArticles[i]);
    });
  });

  // Card fav button handlers
  grid.querySelectorAll('.card-fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      toggleFavorite(id);
      btn.classList.toggle('active');
      btn.textContent = isFavorite(id) ? '★' : '☆';
      // Re-render if in fav-only mode
      if (showFavOnly) {
        render();
      }
    });
  });

  // Update dynamic Schema.org
  updateDynamicSchemas(pageArticles);
}

function cardHTML(a) {
  const badgeClass = a.category === '行业新闻' ? 'badge-news' : a.category === '技术文章' ? 'badge-tech' : 'badge-mfr';
  const cardClass = a.category === '行业新闻' ? 'card-news' : a.category === '技术文章' ? 'card-tech' : 'card-mfr';
  const iconClass = a.category === '行业新闻' ? 'icon-news' : a.category === '技术文章' ? 'icon-tech' : 'icon-mfr';
  const iconEmoji = a.category === '行业新闻' ? '📰' : a.category === '技术文章' ? '🔧' : '🏭';
  const impClass = (a.importance || '').includes('高') ? 'imp-high' : (a.importance || '').includes('中') ? 'imp-mid' : '';
  const keywords = (a.keywords || '').split(',').filter(Boolean).slice(0, 4);
  const readMin = estimateReadingTime(a);
  const favActive = isFavorite(a.id) ? ' active' : '';
  const favIcon = isFavorite(a.id) ? '★' : '☆';

  return `
    <div class="article-card ${cardClass}">
      <div class="card-icon-row">
        <span class="card-icon ${iconClass}">${iconEmoji}</span>
        <div>
          <span class="article-badge ${badgeClass}">${a.category}</span>
        </div>
        <span class="article-date-card" style="margin-left:auto">${a.date || ''}</span>
        <button class="card-fav-btn${favActive}" data-id="${escapeHTML(a.id)}" title="${isFavorite(a.id) ? '取消收藏' : '收藏'}">${favIcon}</button>
      </div>
      <h3 class="card-title">${escapeHTML(a.title)}</h3>
      ${a.source ? `<div class="card-source">📰 ${escapeHTML(a.source)}</div>` : ''}
      <p class="card-summary">${escapeHTML(a.summary || a.content || '').substring(0, 200)}</p>
      <div class="card-footer">
        <div style="display:flex;align-items:center;gap:8px;">
          ${a.importance ? `<span class="card-importance ${impClass}">${escapeHTML(a.importance)}</span>` : ''}
          ${readMin ? `<span class="reading-time"><span class="reading-time-icon">⏱</span>${formatReadingTime(readMin)}</span>` : ''}
        </div>
        ${keywords.length ? `<div class="card-keywords">${keywords.map(k => `<span>${escapeHTML(k.trim())}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `;
}

function renderPagination(totalPages, total) {
  const pg = document.getElementById('pagination');
  if (totalPages <= 1) {
    pg.innerHTML = '';
    return;
  }

  let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">上一页</button>`;

  const maxShow = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxShow / 2));
  let endPage = Math.min(totalPages, startPage + maxShow - 1);
  if (endPage - startPage < maxShow - 1) {
    startPage = Math.max(1, endPage - maxShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页</button>`;
  html += `<span class="page-info">共 ${totalPages} 页 / ${total} 篇</span>`;

  pg.innerHTML = html;

  pg.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (p >= 1 && p <= totalPages) {
        currentPage = p;
        render();
        document.getElementById('articleGrid').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ====== DETAIL MODAL ======
let currentDetailArticle = null;

function showDetail(article) {
  currentDetailArticle = article;
  const badgeClass = article.category === '行业新闻' ? 'badge-news' : article.category === '技术文章' ? 'badge-tech' : 'badge-mfr';

  document.getElementById('detailBadge').textContent = article.category;
  document.getElementById('detailBadge').className = `article-badge ${badgeClass}`;
  document.getElementById('detailDate').textContent = article.date || '';
  document.getElementById('detailTitle').textContent = article.title;
  document.getElementById('detailSummary').textContent = article.summary || article.content || '暂无摘要';
  document.getElementById('detailContent').textContent = article.content || '';

  // Reading time
  const readMin = estimateReadingTime(article);
  const readingTimeEl = document.getElementById('detailReadingTime');
  if (readMin) {
    readingTimeEl.innerHTML = `<span class="reading-time-icon">⏱</span> ${formatReadingTime(readMin)}阅读`;
    readingTimeEl.style.display = '';
  } else {
    readingTimeEl.style.display = 'none';
  }

  let meta = '';
  if (article.source) meta += `来源：${article.source}`;
  if (article.importance) meta += `　｜　${article.importance}`;
  if (article.week_range) meta += `　｜　${article.week_range}`;
  document.getElementById('detailMeta').textContent = meta;

  const linkDiv = document.getElementById('detailLink');
  if (article.link) {
    linkDiv.innerHTML = `<a href="${article.link}" target="_blank" rel="noopener">📎 查看原文 →</a>`;
  } else {
    linkDiv.innerHTML = '';
  }

  // Favorite button state
  updateDetailFavBtn(article);

  document.getElementById('detailModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  renderRelated(article);
}

function updateDetailFavBtn(article) {
  const favBtn = document.getElementById('detailFavBtn');
  const fav = isFavorite(article.id);
  favBtn.className = `detail-fav-btn${fav ? ' active' : ''}`;
  favBtn.innerHTML = fav ? '★ 已收藏' : '⭐ 收藏';
}

function hideDetail() {
  document.getElementById('detailModal').classList.remove('active');
  document.body.style.overflow = '';
  currentDetailArticle = null;
}

document.getElementById('detailClose').addEventListener('click', hideDetail);
document.getElementById('detailModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) hideDetail();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideDetail();
});

// Detail favorite button
document.getElementById('detailFavBtn').addEventListener('click', () => {
  if (!currentDetailArticle) return;
  toggleFavorite(currentDetailArticle.id);
  updateDetailFavBtn(currentDetailArticle);
  // Re-render cards to update star state
  render();
});

// ====== DYNAMIC SCHEMA ======
function updateDynamicSchemas(articles) {
  const catLabel = currentCat === 'all' ? (showFavOnly ? '收藏文章' : '全部文章') : currentCat;
  const breadcrumbJSON = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': '首页', 'item': 'https://tangmudashutl.github.io/connector-hub/' },
      { '@type': 'ListItem', 'position': 2, 'name': catLabel }
    ]
  };
  upsertSchema('schema-breadcrumb', breadcrumbJSON);

  const itemListJSON = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'numberOfItems': articles.length,
    'itemListElement': articles.slice(0, 10).map((a, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'item': {
        '@type': 'Article',
        'name': a.title,
        'description': (a.summary || '').substring(0, 200),
        'datePublished': (a.date || '').replace(/年|月|日/g, '-').replace(/--$/,''),
        'about': a.category
      }
    }))
  };
  upsertSchema('schema-itemlist', itemListJSON);
}

function upsertSchema(id, json) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(json, null, 2);
  document.head.appendChild(script);
}

// ====== SIDEBAR ======
function updateSidebar() {
  const now = new Date();
  const thisWeek = getISOWeek(now);
  const weekArticles = ARTICLES.filter(a => a._weekKey === thisWeek.key);

  const hotPanel = document.getElementById('sidebarHot');
  if (weekArticles.length === 0) {
    const recent6 = ARTICLES
      .filter(a => parseArticleDate(a))
      .sort((a, b) => (parseArticleDate(b) || 0) - (parseArticleDate(a) || 0))
      .slice(0, 6);
    hotPanel.innerHTML = '<h3 class="sidebar-title">🔥 本周热门</h3>' + renderSidebarList(recent6, '本周暂无新文章，以下是最近更新');
  } else {
    hotPanel.innerHTML = '<h3 class="sidebar-title">🔥 本周热门</h3>' + renderSidebarList(weekArticles.slice(0, 6));
  }

  const catPanel = document.getElementById('sidebarCats');
  const cats = [
    { name: '行业新闻', dot: 'var(--primary)', icon: '📰' },
    { name: '技术文章', dot: 'var(--accent)', icon: '🔧' },
    { name: '厂家档案', dot: 'var(--orange)', icon: '🏭' }
  ];
  catPanel.innerHTML = `
    <h3 class="sidebar-title">📊 分类统计</h3>
    ${cats.map(c => {
      const count = ARTICLES.filter(a => a.category === c.name).length;
      const pct = ARTICLES.length ? Math.round(count / ARTICLES.length * 100) : 0;
      return `<div class="sidebar-cat-stat" data-cat="${c.name}">
        <span class="sidebar-cat-name">
          <span class="sidebar-cat-dot" style="background:${c.dot}"></span>${c.icon} ${c.name}
        </span>
        <span class="sidebar-cat-num">${count} 篇 (${pct}%)</span>
      </div>`;
    }).join('')}
  `;
  catPanel.querySelectorAll('.sidebar-cat-stat').forEach(el => {
    el.addEventListener('click', () => {
      const cat = el.dataset.cat;
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      document.getElementById('navFav').classList.remove('active');
      const targetNav = document.querySelector(`.nav-link[data-cat="${cat}"]`);
      if (targetNav) targetNav.classList.add('active');
      currentCat = cat;
      currentPage = 1;
      subFilter = 'all';
      showFavOnly = false;
      document.querySelectorAll('.subfilter').forEach(b => b.classList.remove('active'));
      const allSub = document.querySelector('.subfilter[data-subfilter="all"]');
      if (allSub) allSub.classList.add('active');
      document.getElementById('subfilterFav').classList.remove('active');
      updateBreadcrumb();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  const recentPanel = document.getElementById('sidebarRecent');
  const recent5 = ARTICLES
    .filter(a => parseArticleDate(a))
    .sort((a, b) => (parseArticleDate(b) || 0) - (parseArticleDate(a) || 0))
    .slice(0, 5);
  recentPanel.innerHTML = '<h3 class="sidebar-title">🕐 最近更新</h3>' + renderSidebarList(recent5, '暂无更新');
}

function renderSidebarList(articles, emptyMsg) {
  if (!articles || articles.length === 0) {
    return `<div class="sidebar-empty">${emptyMsg || '暂无数据'}</div>`;
  }
  const listHtml = articles.map((a, i) => {
    const badgeClass = a.category === '行业新闻' ? 'badge-news' : a.category === '技术文章' ? 'badge-tech' : 'badge-mfr';
    const readMin = estimateReadingTime(a);
    return `<div class="sidebar-item" data-idx="${i}" data-global="${ARTICLES.indexOf(a)}">
      <div class="sidebar-item-title">${escapeHTML(a.title)}</div>
      <div class="sidebar-item-meta">
        <span class="article-badge ${badgeClass} sidebar-item-badge">${a.category}</span>
        <span>${a.date || ''}</span>
        ${readMin ? `<span class="reading-time">⏱${formatReadingTime(readMin)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  return listHtml;
}

// Sidebar click handlers delegation
document.addEventListener('click', (e) => {
  const item = e.target.closest('.sidebar-item');
  if (!item) return;
  const globalIdx = parseInt(item.dataset.global);
  if (!isNaN(globalIdx) && ARTICLES[globalIdx]) {
    showDetail(ARTICLES[globalIdx]);
  }
});

// ====== MANUFACTURER SHOWCASE ======
function setupMfrShowcase() {
  const mfrArticles = ARTICLES.filter(a => a.category === '厂家档案');
  const grid = document.getElementById('mfrShowcaseGrid');
  const moreBtn = document.getElementById('mfrShowcaseMore');

  const showcase = mfrArticles
    .sort((a, b) => (b.content || '').length - (a.content || '').length)
    .slice(0, 6);

  grid.innerHTML = showcase.map(a => {
    const summary = (a.summary || a.content || '').substring(0, 80);
    const keywords = (a.keywords || '').split(',').filter(Boolean).slice(0, 3);
    return `<div class="mfr-card" data-global="${ARTICLES.indexOf(a)}">
      <div class="mfr-card-header">
        <div class="mfr-card-icon">🏭</div>
        <span class="mfr-card-name">${escapeHTML(a.title)}</span>
      </div>
      <div class="mfr-card-info">${escapeHTML(summary)}</div>
      ${keywords.length ? `<div class="mfr-card-tags">${keywords.map(k => `<span class="mfr-card-tag">${escapeHTML(k.trim())}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');

  grid.querySelectorAll('.mfr-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.global);
      if (!isNaN(idx) && ARTICLES[idx]) {
        showDetail(ARTICLES[idx]);
      }
    });
  });

  moreBtn.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    document.getElementById('navFav').classList.remove('active');
    const targetNav = document.querySelector('.nav-link[data-cat="厂家档案"]');
    if (targetNav) targetNav.classList.add('active');
    currentCat = '厂家档案';
    currentPage = 1;
    subFilter = 'all';
    showFavOnly = false;
    document.querySelectorAll('.subfilter').forEach(b => b.classList.remove('active'));
    const allSub = document.querySelector('.subfilter[data-subfilter="all"]');
    if (allSub) allSub.classList.add('active');
    document.getElementById('subfilterFav').classList.remove('active');
    updateBreadcrumb();
    render();
    window.scrollTo({ top: document.querySelector('.container').offsetTop - 80, behavior: 'smooth' });
  });
}

// ====== NEWSLETTER ======
function setupNewsletter() {
  const form = document.getElementById('newsletterForm');
  const emailInput = document.getElementById('newsletterEmail');
  const btn = document.getElementById('newsletterBtn');
  const status = document.getElementById('newsletterStatus');

  const saved = localStorage.getItem('connectorhub_newsletter');
  if (saved) {
    emailInput.value = saved;
    emailInput.disabled = true;
    btn.disabled = true;
    btn.textContent = '已订阅 ✓';
    status.textContent = '感谢订阅！每周一早10点准时推送';
    status.className = 'newsletter-status success';
    return;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!email) {
      status.textContent = '请输入邮箱地址';
      status.className = 'newsletter-status error';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = '请输入有效的邮箱地址';
      status.className = 'newsletter-status error';
      return;
    }

    localStorage.setItem('connectorhub_newsletter', email);
    emailInput.disabled = true;
    btn.disabled = true;
    btn.textContent = '已订阅 ✓';
    status.textContent = '订阅成功！每周一早10点准时推送';
    status.className = 'newsletter-status success';
  });
}

// ====== RELATED ARTICLES ======
function findRelatedArticles(article, count = 3) {
  const articleKeywords = (article.keywords || '').split(',').map(k => k.trim()).filter(Boolean);

  const scored = ARTICLES
    .filter(a => a !== article && a.title !== article.title)
    .map(a => {
      let score = 0;
      if (a.category === article.category) score += 3;
      const aKeywords = (a.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
      const commonKeywords = articleKeywords.filter(k => aKeywords.includes(k));
      score += commonKeywords.length * 5;
      const titleWords = (article.title || '').split(/[\s，,、]+/).filter(w => w.length > 1);
      const aTitleWords = (a.title || '').split(/[\s，,、]+/).filter(w => w.length > 1);
      const commonTitle = titleWords.filter(w => aTitleWords.includes(w));
      score += commonTitle.length * 2;
      const d = parseArticleDate(a);
      if (d) {
        const daysAgo = (new Date() - d) / 86400000;
        if (daysAgo < 30) score += 1;
      }
      return { article: a, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);

  if (scored.length < count) {
    const sameCat = ARTICLES
      .filter(a => a !== article && a.title !== article.title && a.category === article.category)
      .filter(a => !scored.find(s => s.article === a));
    scored.push(...sameCat.slice(0, count - scored.length).map(a => ({ article: a, score: 1 })));
  }

  return scored.map(s => s.article);
}

function renderRelated(article) {
  const related = findRelatedArticles(article);
  const list = document.getElementById('relatedList');
  if (related.length === 0) {
    document.getElementById('detailRelated').style.display = 'none';
    return;
  }
  document.getElementById('detailRelated').style.display = 'block';
  list.innerHTML = related.map(a => {
    const badgeClass = a.category === '行业新闻' ? 'badge-news' : a.category === '技术文章' ? 'badge-tech' : 'badge-mfr';
    const iconEmoji = a.category === '行业新闻' ? '📰' : a.category === '技术文章' ? '🔧' : '🏭';
    const readMin = estimateReadingTime(a);
    return `<div class="related-item" data-global="${ARTICLES.indexOf(a)}">
      <div class="related-item-left">
        <span class="related-item-icon">${iconEmoji}</span>
        <span class="related-item-text">${escapeHTML(a.title)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${readMin ? `<span class="reading-time" style="flex-shrink:0">⏱${formatReadingTime(readMin)}</span>` : ''}
        <span class="article-badge ${badgeClass} related-item-badge">${a.category}</span>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.related-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.global);
      if (!isNaN(idx) && ARTICLES[idx]) {
        hideDetail();
        setTimeout(() => showDetail(ARTICLES[idx]), 200);
      }
    });
  });
}

// ====== UTILS ======
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
