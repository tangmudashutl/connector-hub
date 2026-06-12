// ConnectorHUB - Supabase Auth Module (vanilla JS, no SDK, no CDN)
// ============================================================
// 通过 Cloudflare Worker 代理访问 Supabase，解决国内 TLS 握手失败问题
// 代理 Worker 部署后生效，URL: https://connector-hub-api-proxy.ttttad819.workers.dev
var SUPABASE_PROXY_URL = 'https://connector-hub-api-proxy.ttttad819.workers.dev';
var SUPABASE_DIRECT_URL = 'https://clwqwidwjgharpefrufv.supabase.co';
var SUPABASE_URL = SUPABASE_PROXY_URL; // 默认使用代理；如需切换直连改为 SUPABASE_DIRECT_URL
var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wZDOWH6TwiEyPUNzgcWLhQ_HAZiPYZw';

// ============================================================
// 用户状态
var currentUser = null;
var accessToken = null;
var isAdminFlag = false;

// ============================================================
// REST API helpers
function authHeaders() {
  var h = { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  if (accessToken) h['Authorization'] = 'Bearer ' + accessToken;
  return h;
}

function apiFetch(path, opts) {
  opts = opts || {};
  var url = SUPABASE_URL + path;
  var headers = Object.assign(authHeaders(), opts.headers || {});
  return doFetch(url, headers, opts)
    .catch(function(e) {
      // 如果代理不可用（TLS/network 错误），自动回退到直连
      if (SUPABASE_URL !== SUPABASE_DIRECT_URL && isNetworkError(e)) {
        console.warn('[Auth] 代理不可用，回退直连:', e.message);
        return doFetch(SUPABASE_DIRECT_URL + path, headers, opts);
      }
      throw e;
    });
}

function isNetworkError(e) {
  var m = (e.message || '').toLowerCase();
  return m.indexOf('failed to fetch') !== -1
      || m.indexOf('networkerror') !== -1
      || m.indexOf('network error') !== -1;
}

function doFetch(url, headers, opts) {
  return fetch(url, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body || undefined
  }).then(function(res) {
    return res.text().then(function(text) {
      var data;
      try { data = JSON.parse(text); } catch(e) { data = { message: text }; }
      if (!res.ok) {
        var err = new Error(data.message || data.msg || ('HTTP ' + res.status));
        err.code = data.error || data.error_code || '';
        throw err;
      }
      return data;
    });
  });
}

// ============================================================
// Session persistence
function saveSession(user, token) {
  accessToken = token;
  currentUser = user;
  try {
    localStorage.setItem('connectorhub_user', JSON.stringify(user));
    localStorage.setItem('connectorhub_token', token);
  } catch(e) {}
}

function clearSession() {
  accessToken = null;
  currentUser = null;
  try {
    localStorage.removeItem('connectorhub_user');
    localStorage.removeItem('connectorhub_token');
  } catch(e) {}
}

function loadLocalSession() {
  try {
    var u = localStorage.getItem('connectorhub_user');
    var t = localStorage.getItem('connectorhub_token');
    if (u && t) {
      currentUser = JSON.parse(u);
      accessToken = t;
      return true;
    }
  } catch(e) {}
  return false;
}

// ============================================================
// Auth UI - 弹窗 HTML（用 onclick 直接调用全局函数，不依赖 addEventListener）
function openAuthModal(tab) {
  tab = tab || 'login';
  var existing = document.getElementById('authOverlay');
  if (existing) {
    document.body.removeChild(existing);
  }

  var overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.className = 'auth-overlay active';
  overlay.innerHTML = buildModalHTML(tab);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function buildModalHTML(tab) {
  return '<div class="auth-modal" onclick="event.stopPropagation()">'
    + '<div class="auth-header">'
    + '<h2>ConnectorHUB 账号</h2>'
    + '<button class="auth-close" onclick="closeAuthModal()">✕</button>'
    + '</div>'
    + '<div id="authBodyInner">' + buildBodyHTML(tab) + '</div>'
    + '</div>';
}

function buildBodyHTML(tab) {
  var tabs = '<div class="auth-tabs">'
    + '<button class="auth-tab' + (tab === 'login' ? ' active' : '') + '" onclick="switchTab(\'login\')">登录</button>'
    + '<button class="auth-tab' + (tab === 'signup' ? ' active' : '') + '" onclick="switchTab(\'signup\')">注册</button>'
    + '</div>';

  if (tab === 'reset') {
    return '<form class="auth-form" onsubmit="doReset(); return false;">'
      + '<p style="font-size:13px;color:#888;margin-bottom:12px;">输入注册邮箱，发送重置密码链接</p>'
      + '<input type="email" id="resetEmail" placeholder="邮箱地址" required autocomplete="email">'
      + '<div class="auth-error" id="resetErr"></div>'
      + '<div class="auth-success" id="resetOk"></div>'
      + '<button type="submit" id="resetBtn" class="auth-submit">发送重置链接</button>'
      + '<p class="auth-alt-hint" style="margin-top:12px;"><a style="cursor:pointer;color:var(--accent);" onclick="switchTab(\'login\')">← 返回登录</a></p>'
      + '</form>';
  }

  if (tab === 'login') {
    return tabs
      + '<form class="auth-form" onsubmit="doLogin(); return false;">'
      + '<input type="email" id="loginEmail" placeholder="邮箱地址" required autocomplete="email">'
      + '<input type="password" id="loginPassword" placeholder="密码" required autocomplete="current-password">'
      + '<div class="auth-error" id="loginErr"></div>'
      + '<button type="submit" id="loginBtn" class="auth-submit">登录</button>'
      + '<p class="auth-alt-hint" style="margin-top:12px;"><a style="cursor:pointer;color:var(--accent);" onclick="switchTab(\'reset\')">忘记密码？</a></p>'
      + '</form>';
  }

  // signup
  return tabs
    + '<form class="auth-form" onsubmit="doSignup(); return false;">'
    + '<input type="text" id="signupUsername" placeholder="用户名" required autocomplete="username">'
    + '<input type="email" id="signupEmail" placeholder="邮箱地址" required autocomplete="email">'
    + '<input type="password" id="signupPassword" placeholder="密码（至少6位）" required autocomplete="new-password" minlength="6">'
    + '<div class="auth-error" id="signupErr"></div>'
    + '<button type="submit" id="signupBtn" class="auth-submit">注册</button>'
    + '</form>';
}

function switchTab(tab) {
  var inner = document.getElementById('authBodyInner');
  if (inner) inner.innerHTML = buildBodyHTML(tab);
}

function closeAuthModal() {
  var overlay = document.getElementById('authOverlay');
  if (overlay) {
    document.body.removeChild(overlay);
    document.body.style.overflow = '';
  }
}

// 点击遮罩关闭
document.addEventListener('click', function(e) {
  var overlay = document.getElementById('authOverlay');
  if (overlay && e.target === overlay) closeAuthModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAuthModal();
});

// ============================================================
// Auth Handlers - 全局函数，直接被 HTML onclick 调用
function doLogin() {
  var email = (document.getElementById('loginEmail') || {}).value || '';
  var password = (document.getElementById('loginPassword') || {}).value || '';
  var btn = document.getElementById('loginBtn');
  var errEl = document.getElementById('loginErr');

  email = email.trim();
  if (!email || !password) {
    if (errEl) errEl.textContent = '请填写邮箱和密码';
    return;
  }
  if (errEl) errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = '登录中...'; }

  apiFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: password })
  }).then(function(data) {
    saveSession(data.user, data.access_token);
    closeAuthModal();
    updateUserUI();
    loadCloudFavorites();
  }).catch(function(e) {
    if (errEl) errEl.textContent = translateAuthError(e.message);
    if (btn) { btn.disabled = false; btn.textContent = '登录'; }
  });
}

function doSignup() {
  var username = (document.getElementById('signupUsername') || {}).value || '';
  var email = (document.getElementById('signupEmail') || {}).value || '';
  var password = (document.getElementById('signupPassword') || {}).value || '';
  var btn = document.getElementById('signupBtn');
  var errEl = document.getElementById('signupErr');

  username = username.trim();
  email = email.trim();

  if (!email || !password) {
    if (errEl) errEl.textContent = '请填写邮箱和密码';
    return;
  }
  if (password.length < 6) {
    if (errEl) errEl.textContent = '密码至少需要6位';
    return;
  }
  if (!username) {
    if (errEl) errEl.textContent = '请输入用户名';
    return;
  }

  if (errEl) errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = '注册中...'; }

  apiFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: email, password: password,
      data: { username: username }
    })
  }).then(function(data) {
    if (data.user && data.session) {
      saveSession(data.user, data.session.access_token);
      closeAuthModal();
      updateUserUI();
      loadCloudFavorites();
    } else {
      // 需要邮箱验证
      closeAuthModal();
      alert('注册成功！请查收验证邮件后再登录。');
    }
  }).catch(function(e) {
    if (errEl) errEl.textContent = translateAuthError(e.message);
    if (btn) { btn.disabled = false; btn.textContent = '注册'; }
  });
}

function doReset() {
  var email = (document.getElementById('resetEmail') || {}).value || '';
  var btn = document.getElementById('resetBtn');
  var errEl = document.getElementById('resetErr');
  var okEl = document.getElementById('resetOk');

  email = email.trim();
  if (!email) {
    if (errEl) errEl.textContent = '请输入邮箱地址';
    return;
  }
  if (errEl) errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = '发送中...'; }

  apiFetch('/auth/v1/recover', {
    method: 'POST',
    body: JSON.stringify({ email: email })
  }).then(function() {
    if (okEl) okEl.textContent = '重置邮件已发送，请检查收件箱';
    if (btn) btn.textContent = '已发送 ✓';
  }).catch(function(e) {
    if (errEl) errEl.textContent = translateAuthError(e.message);
    if (btn) { btn.disabled = false; btn.textContent = '发送重置链接'; }
  });
}

function doLogout() {
  apiFetch('/auth/v1/logout', { method: 'POST' }).catch(function() {});
  clearSession();
  updateUserUI();
  if (typeof render === 'function') render();
}

// ============================================================
// 云端收藏同步
function loadCloudFavorites() {
  if (!accessToken || !currentUser) return;

  apiFetch('/rest/v1/favorites?select=article_id&user_id=eq.' + currentUser.id)
    .then(function(data) {
      if (!data || !data.length) return;
      var cloudIds = data.map(function(r) { return r.article_id; });
      if (typeof FAVORITES !== 'undefined') {
        cloudIds.forEach(function(id) { FAVORITES.add(id); });
        if (typeof saveFavorites === 'function') saveFavorites();
      }
      if (typeof updateFavCount === 'function') updateFavCount();
      if (typeof render === 'function') render();
    })
    .catch(function(e) { console.warn('[Auth] 加载云端收藏失败:', e.message); });
}

function saveCloudFavorite(articleId, articleTitle) {
  if (!accessToken || !currentUser) return;
  apiFetch('/rest/v1/favorites', {
    method: 'POST',
    body: JSON.stringify({
      user_id: currentUser.id,
      article_id: articleId,
      article_title: articleTitle || articleId,
      updated_at: new Date().toISOString()
    }),
    headers: { 'Prefer': 'return=minimal' }
  }).catch(function() {});
}

function removeCloudFavorite(articleId) {
  if (!accessToken || !currentUser) return;
  apiFetch('/rest/v1/favorites?user_id=eq.' + currentUser.id + '&article_id=eq.' + articleId, {
    method: 'DELETE',
    headers: { 'Prefer': 'return=minimal' }
  }).catch(function() {});
}

// ============================================================
// 管理员权限检查
function checkIsAdmin() {
  if (!accessToken) {
    isAdminFlag = false;
    return Promise.resolve(false);
  }
  return apiFetch('/rest/v1/rpc/is_admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then(function(data) {
    isAdminFlag = (data === true);
    return isAdminFlag;
  }).catch(function() {
    isAdminFlag = false;
    return false;
  });
}

// ============================================================
// UI 更新
function updateUserUI() {
  var btn = document.getElementById('userBtn');
  if (!btn) return;

  if (currentUser) {
    var email = currentUser.email || '';
    var username = (currentUser.user_metadata && currentUser.user_metadata.username) || email.split('@')[0];
    btn.className = 'user-btn logged-in';
    btn.innerHTML = '<span>👤</span> ' + (username || email);
  } else {
    btn.className = 'user-btn';
    btn.innerHTML = '👤 登录';
  }

  // 下拉菜单（异步更新，因为需要检查管理员权限）
  updateDropdownMenu();
}

function updateDropdownMenu() {
  var menu = document.getElementById('userDropdownMenu');
  if (!menu) return;

  if (!currentUser) {
    menu.innerHTML = '';
    return;
  }

  var email2 = currentUser.email || '';
  var favCount = typeof FAVORITES !== 'undefined' ? FAVORITES.size : 0;

  menu.innerHTML = '<div class="user-dropdown-email">' + email2 + '</div>'
    + '<div class="user-dropdown-item" onclick="window.location.href=\'discussions.html\'">💬 交流区</div>'
    + '<div class="user-dropdown-item" onclick="showMyFavorites()">⭐ 我的收藏 (' + favCount + ')</div>'
    + '<div class="user-dropdown-item" id="adminLink" style="display:none" onclick="window.location.href=\'admin.html\'">🛡️ 管理后台</div>'
    + '<div class="user-dropdown-item danger" onclick="doLogout()">🚪 退出登录</div>';

  // 异步检查管理员权限
  checkIsAdmin().then(function(isAdmin) {
    var adminLink = document.getElementById('adminLink');
    if (adminLink && isAdmin) adminLink.style.display = 'flex';
    var badge = document.getElementById('adminBadge');
    if (badge) badge.style.display = isAdmin ? 'inline-block' : 'none';
  });
}

function showMyFavorites() {
  var menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.remove('show');
  if (typeof showFavOnly !== 'undefined') { showFavOnly = true; }
  if (typeof currentPage !== 'undefined') { currentPage = 1; }
  if (typeof render === 'function') render();
}

// ============================================================
// 登录按钮点击
function setupUserButton() {
  var btn = document.getElementById('userBtn');
  if (!btn) return;

  btn.onclick = function(e) {
    e.stopPropagation();
    if (currentUser) {
      var menu = document.getElementById('userDropdownMenu');
      if (menu) menu.classList.toggle('show');
    } else {
      openAuthModal('login');
    }
  };

  document.addEventListener('click', function() {
    var menu = document.getElementById('userDropdownMenu');
    if (menu) menu.classList.remove('show');
  });
}

// ============================================================
// 工具函数
function translateAuthError(msg) {
  msg = (msg || '').toLowerCase();
  if (msg.indexOf('invalid login credentials') !== -1) return '邮箱或密码错误';
  if (msg.indexOf('email not confirmed') !== -1) return '邮箱尚未验证，请检查收件箱';
  if (msg.indexOf('user already registered') !== -1) return '该邮箱已注册，请直接登录';
  if (msg.indexOf('password should be at least') !== -1) return '密码至少需要6位';
  if (msg.indexOf('unable to validate email') !== -1) return '邮箱格式不正确';
  if (msg.indexOf('email rate limit') !== -1) return '请求过于频繁，请稍后再试';
  if (msg.indexOf('for security purposes') !== -1) return '请60秒后再试';
  if (msg.indexOf('user not found') !== -1) return '用户不存在';
  return msg || '操作失败，请重试';
}

// ============================================================
// 初始化
function initAuth() {
  setupUserButton();

  // 尝试恢复本地会话
  if (loadLocalSession()) {
    // 验证 token 是否还有效
    apiFetch('/auth/v1/user')
      .then(function(data) {
        if (data && data.id) {
          currentUser = data;
          try { localStorage.setItem('connectorhub_user', JSON.stringify(data)); } catch(e) {}
          updateUserUI();
          loadCloudFavorites();
          checkIsAdmin();
          console.log('[Auth] 会话恢复成功');
        } else {
          clearSession();
        }
      })
      .catch(function() {
        clearSession();
        updateUserUI();
      });
  }
}

document.addEventListener('DOMContentLoaded', initAuth);
