// ConnectorHUB - Article Directory App

const PER_PAGE = 24;
let currentCat = 'all';
let currentPage = 1;
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let ARTICLES = [];

// Merge all data sources
function loadData() {
  const parts = [];
  ['行业新闻','技术文章','厂家档案'].forEach(cat => {
    const key = '_data_' + cat.replace(' ','_');
    if (window[key]) parts.push(...window[key]);
  });
  return parts;
}

// ====== INIT ======
function init() {
  ARTICLES = loadData();
  if (ARTICLES.length === 0) {
    document.getElementById('articleGrid').innerHTML = '<div class="loading">数据加载失败，请刷新页面</div>';
    return;
  }
  setupNav();
  setupSearch();
  setupDateFilters();
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

// ====== DATE FILTERS ======
function setupDateFilters() {
  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');

  fromEl.addEventListener('change', () => {
    dateFrom = fromEl.value;
    document.querySelectorAll('.qfilter').forEach(b => b.classList.remove('active'));
    currentPage = 1;
    render();
  });

  toEl.addEventListener('change', () => {
    dateTo = toEl.value;
    document.querySelectorAll('.qfilter').forEach(b => b.classList.remove('active'));
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
      const range = btn.dataset.range;
      applyQuickFilter(range);
    });
  });
}

function applyQuickFilter(range) {
  const now = new Date();
  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');

  switch (range) {
    case 'week': {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      fromEl.value = fmtDate(monday);
      toEl.value = fmtDate(now);
      break;
    }
    case 'month':
      fromEl.value = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
      toEl.value = fmtDate(now);
      break;
    case '3month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      fromEl.value = fmtDate(d);
      toEl.value = fmtDate(now);
      break;
    }
    default:
      fromEl.value = '';
      toEl.value = '';
  }
  dateFrom = fromEl.value;
  dateTo = toEl.value;
  currentPage = 1;
  render();
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ====== FILTERING ======
function getFiltered() {
  let articles = ARTICLES;

  // Category
  if (currentCat !== 'all') {
    articles = articles.filter(a => a.category === currentCat);
  }

  // Date range
  if (dateFrom) {
    articles = articles.filter(a => a.date >= dateFrom);
  }
  if (dateTo) {
    articles = articles.filter(a => a.date <= dateTo);
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

  // Stats
  document.getElementById('statCount').textContent = `共 ${total} 篇文章`;
  const dates = filtered.map(a => a.date).filter(Boolean).sort();
  if (dates.length) {
    document.getElementById('statRange').textContent = `${dates[dates.length-1]} ~ ${dates[0]}`;
  } else {
    document.getElementById('statRange').textContent = '';
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

  // Show page numbers
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

  // Click handlers
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
