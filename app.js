// ConnectorHUB - Article Directory App

const PER_PAGE = 24;
let currentCat = 'all';
let currentPage = 1;
let searchQuery = '';
let selectedWeek = 'all';
let ARTICLES = [];
let WEEK_MAP = {}; // week_key -> { label, mondayDate, articles }

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
  // Try to extract a usable date from various fields
  const candidates = [];

  // 1. From date field: YYYY-MM-DD
  const dm1 = (article.date || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dm1) candidates.push(new Date(+dm1[1], +dm1[2] - 1, +dm1[3]));

  // 2. From date field: YYYY年M月D日
  const dm2 = (article.date || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!candidates.length && dm2) candidates.push(new Date(+dm2[1], +dm2[2] - 1, +dm2[3]));

  // 3. From week_range: extract start date
  const wr = (article.week_range || '');
  const wm1 = wr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!candidates.length && wm1) candidates.push(new Date(+wm1[1], +wm1[2] - 1, +wm1[3]));
  const wm2 = wr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!candidates.length && wm2) candidates.push(new Date(+wm2[1], +wm2[2] - 1, +wm2[3]));

  // 4. From id field: news_2026-04-27_N
  const im = (article.id || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!candidates.length && im) candidates.push(new Date(+im[1], +im[2] - 1, +im[3]));

  return candidates.length ? candidates[0] : null;
}

function getISOWeek(d) {
  // Returns { key: '2026-W23', label: '06/02 ~ 06/08 (第23周)', monday: Date }
  const day = d.getDay() || 7; // Sunday = 7
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // ISO week number
  const jan1 = new Date(monday.getFullYear(), 0, 1);
  const jan1Day = jan1.getDay() || 7;
  const daysDiff = (monday - jan1) / 86400000;
  const weekNum = Math.ceil((daysDiff + jan1Day) / 7);

  const key = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  const label = `${fmtShort(monday)} ~ ${fmtShort(sunday)}（第${weekNum}周）`;
  return { key, label, monday };
}

function fmtShort(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

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
    // Store week_key on article for filtering
    article._weekKey = d ? getISOWeek(d).key : '';
  });

  // Build dropdown
  const select = document.getElementById('weekSelect');
  // Sort weeks newest first
  const sortedWeeks = Object.values(WEEK_MAP).sort((a, b) => b.monday - a.monday);

  // Keep "全部时间" option, add week options
  select.innerHTML = '<option value="all">全部时间</option>';
  sortedWeeks.forEach((wk, i) => {
    const opt = document.createElement('option');
    opt.value = wk.label.split('~')[0].trim(); // use monday string as value
    // Store the week key for lookup
    const weekKey = Object.keys(WEEK_MAP).find(k => WEEK_MAP[k].monday.getTime() === wk.monday.getTime());
    opt.value = weekKey;
    opt.textContent = wk.label;
    select.appendChild(opt);
  });

  // Default to "全部时间"
  select.value = 'all';
}

// ====== INIT ======
function init() {
  ARTICLES = loadData();
  if (ARTICLES.length === 0) {
    document.getElementById('articleGrid').innerHTML = '<div class="loading">数据加载失败，请刷新页面</div>';
    return;
  }
  buildWeekDropdown();
  setupNav();
  setupSearch();
  setupWeekFilter();
  setupQuickFilters();
  render();
}

// ====== NAVIGATION ======
function setupNav() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      currentPage = 1;
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

// ====== WEEK FILTER (DROPDOWN) ======
function setupWeekFilter() {
  const select = document.getElementById('weekSelect');
  select.addEventListener('change', () => {
    selectedWeek = select.value;
    // Clear quick filter active states when manually selecting a week
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
      // Fall through to custom month logic in getFiltered
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
  if (currentCat !== 'all') {
    articles = articles.filter(a => a.category === currentCat);
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

// ====== RENDER ======
function render() {
  const filtered = getFiltered();
  const total = filtered.length;
  const totalPages = Math.ceil(total / PER_PAGE);
  const start = (currentPage - 1) * PER_PAGE;
  const pageArticles = filtered.slice(start, start + PER_PAGE);

  // Stats - show week label if a week is selected
  const statCount = document.getElementById('statCount');
  if (selectedWeek !== 'all' && WEEK_MAP[selectedWeek]) {
    statCount.innerHTML = `共 ${total} 篇文章 · <span style="color:var(--primary)">${WEEK_MAP[selectedWeek].label}</span>`;
  } else {
    statCount.textContent = `共 ${total} 篇文章`;
  }

  const statRange = document.getElementById('statRange');
  const dates = filtered.map(a => parseArticleDate(a)).filter(d => d && !isNaN(d.getTime())).sort((a, b) => b - a);
  if (dates.length >= 2) {
    statRange.textContent = `${fmtDate(dates[dates.length - 1])} ~ ${fmtDate(dates[0])}`;
  } else if (dates.length === 1) {
    statRange.textContent = fmtDate(dates[0]);
  } else {
    statRange.textContent = '';
  }

  // Grid
  const grid = document.getElementById('articleGrid');
  const noRes = document.getElementById('noResults');

  if (total === 0) {
    grid.innerHTML = '';
    noRes.style.display = 'block';
  } else {
    noRes.style.display = 'none';
    grid.innerHTML = pageArticles.map(a => cardHTML(a)).join('');
  }

  // Pagination
  renderPagination(totalPages, total);

  // Card click handlers
  grid.querySelectorAll('.article-card').forEach((card, i) => {
    card.addEventListener('click', () => showDetail(pageArticles[i]));
  });
}

function cardHTML(a) {
  const badgeClass = a.category === '行业新闻' ? 'badge-news' : a.category === '技术文章' ? 'badge-tech' : 'badge-mfr';
  const impClass = (a.importance || '').includes('高') ? 'imp-high' : (a.importance || '').includes('中') ? 'imp-mid' : '';
  const keywords = (a.keywords || '').split(',').filter(Boolean).slice(0, 4);

  return `
    <div class="article-card">
      <div class="card-header">
        <span class="article-badge ${badgeClass}">${a.category}</span>
        <span class="article-date-card">${a.date || ''}</span>
      </div>
      <h3 class="card-title">${escapeHTML(a.title)}</h3>
      ${a.source ? `<div class="card-source">📰 ${escapeHTML(a.source)}</div>` : ''}
      <p class="card-summary">${escapeHTML(a.summary || a.content || '').substring(0, 200)}</p>
      <div class="card-footer">
        ${a.importance ? `<span class="card-importance ${impClass}">${escapeHTML(a.importance)}</span>` : '<span></span>'}
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
function showDetail(article) {
  const badgeClass = article.category === '行业新闻' ? 'badge-news' : article.category === '技术文章' ? 'badge-tech' : 'badge-mfr';

  document.getElementById('detailBadge').textContent = article.category;
  document.getElementById('detailBadge').className = `article-badge ${badgeClass}`;
  document.getElementById('detailDate').textContent = article.date || '';
  document.getElementById('detailTitle').textContent = article.title;
  document.getElementById('detailSummary').textContent = article.summary || article.content || '暂无摘要';
  document.getElementById('detailContent').textContent = article.content || '';

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

  document.getElementById('detailModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideDetail() {
  document.getElementById('detailModal').classList.remove('active');
  document.body.style.overflow = '';
}

document.getElementById('detailClose').addEventListener('click', hideDetail);
document.getElementById('detailModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) hideDetail();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideDetail();
});

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
