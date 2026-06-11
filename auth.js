// ConnectorHUB - Supabase Auth Module (vanilla JS, no SDK)
// ============================================================
const SUPABASE_URL = 'https://clwqwidwjgharpefrufv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wZDOWH6TwiEyPUNzgcWLhQ_HAZiPYZw';

// ============================================================
// 用户状态
let currentUser = null;
let accessToken = null;

// ============================================================
// REST API helpers
function authHeaders() {
  const h = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  if (accessToken) h['Authorization'] = 'Bearer ' + accessToken;
  return h;
}

async function apiFetch(path, opts = {}) {
  const url = SUPABASE_URL + path;
  const res = await fetch(url, {
    headers: authHeaders(),
    ...opts
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
  if (!res.ok) {
    const err = new Error(data.message || data.msg || ('HTTP ' + res.status));
    err.code = data.error || data.error_code || '';
    throw err;
  }
  return data;
}

// ============================================================
// Session persistence
function saveSession(user, token) {
  accessToken = token;
  currentUser = user;
  localStorage.setItem('connectorhub_user', JSON.stringify(user));
  localStorage.setItem('connectorhub_token', token);
}

function clearSession() {
  accessToken = null;
  currentUser = null;
  localStorage.removeItem('connectorhub_user');
  localStorage.removeItem('connectorhub_token');
}

function loadLocalSession() {
  try {
    const u = localStorage.getItem('connectorhub_user');
    const t = localStorage.getItem('connectorhub_token');
    if (u && t) {
      currentUser = JSON.parse(u);
      accessToken = t;
      return true;
    }
  } catch (e) { /* invalid */ }
  return false;
}

// ============================================================
// Auth UI
function openAuthModal(tab) {
  tab = tab || 'login';
  let overlay = document.getElementById('authOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.className = 'auth-overlay';
    overlay.innerHTML = renderAuthModal(tab);
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('.auth-body').innerHTML = renderAuthBody(tab);
  }

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  overlay.querySelector('.auth-close').addEventListener('click', closeAuthModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAuthModal();
  });
  document.addEventListener('keydown', closeAuthOnEscape);

  setupAuthTabs(overlay);
  setupAuthForms(overlay);
}

function closeAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  document.removeEventListener('keydown', closeAuthOnEscape);
}

function closeAuthOnEscape(e) {
  if (e.key === 'Escape') closeAuthModal();
}

function renderAuthModal(tab) {
  return '<div class="auth-modal"><div class="auth-header"><h2>' + (tab === 'login' ? '登录 ConnectorHUB' : '注册 ConnectorHUB') + '</h2><button class="auth-close">✕</button></div><div class="auth-body">' + renderAuthBody(tab) + '</div></div>';
}

function renderAuthBody(tab) {
  if (tab === 'reset') {
    return '<form class="auth-form" id="authResetForm" onsubmit="return false"><p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">输入注册邮箱，我们将发送重置链接</p><input type="email" id="authResetEmail" placeholder="邮箱地址" required autocomplete="email"><div class="auth-error" id="authResetError"></div><div class="auth-success" id="authResetSuccess"></div><button type="submit" class="auth-submit">发送重置链接</button><p class="auth-alt-hint"><a onclick="switchAuthTab(\'login\')">← 返回登录</a></p></form>';
  }
  var isLogin = tab === 'login';
  return '<div class="auth-tabs"><button class="auth-tab ' + (isLogin ? 'active' : '') + '" data-tab="login">登录</button><button class="auth-tab ' + (!isLogin ? 'active' : '') + '" data-tab="signup">注册</button></div>' + (isLogin ?
    '<form class="auth-form" id="authLoginForm" onsubmit="return false"><input type="email" id="authLoginEmail" placeholder="邮箱地址" required autocomplete="email"><input type="password" id="authLoginPassword" placeholder="密码" required autocomplete="current-password"><div class="auth-error" id="authLoginError"></div><button type="submit" class="auth-submit">登录</button><p class="auth-alt-hint"><a onclick="switchAuthTab(\'reset\')">忘记密码？</a></p></form>' :
    '<form class="auth-form" id="authSignupForm" onsubmit="return false"><input type="text" id="authSignupUsername" placeholder="用户名" required autocomplete="username"><input type="email" id="authSignupEmail" placeholder="邮箱地址" required autocomplete="email"><input type="password" id="authSignupPassword" placeholder="密码（至少6位）" required autocomplete="new-password" minlength="6"><div class="auth-error" id="authSignupError"></div><button type="submit" class="auth-submit">注册</button></form>');
}

// ============================================================
// Auth Handlers (using Supabase REST API directly)
async function handleLogin() {
  var email = document.getElementById('authLoginEmail').value.trim();
  var password = document.getElementById('authLoginPassword').value;
  var btn = document.querySelector('#authLoginForm .auth-submit');

  if (!email || !password) {
    showAuthError('authLoginError', '请填写邮箱和密码');
    return;
  }

  btn.disabled = true;
  btn.textContent = '登录中...';
  clearAuthError('authLoginError');

  try {
    var data = await apiFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password })
    });

    // data = { access_token, refresh_token, expires_in, user: { id, email, ... } }
    saveSession(data.user, data.access_token);
    closeAuthModal();
    updateUserUI();
    loadCloudFavorites().then(() => render());
    showSyncBanner();
  } catch (e) {
    showAuthError('authLoginError', translateAuthError(e.message));
    btn.disabled = false;
    btn.textContent = '登录';
  }
}

async function handleSignup() {
  var username = document.getElementById('authSignupUsername').value.trim();
  var email = document.getElementById('authSignupEmail').value.trim();
  var password = document.getElementById('authSignupPassword').value;
  var btn = document.querySelector('#authSignupForm .auth-submit');

  if (!email || !password) { showAuthError('authSignupError', '请填写邮箱和密码'); return; }
  if (password.length < 6) { showAuthError('authSignupError', '密码至少需要6位'); return; }
  if (!username) { showAuthError('authSignupError', '请输入用户名'); return; }

  btn.disabled = true;
  btn.textContent = '注册中...';
  clearAuthError('authSignupError');

  try {
    var data = await apiFetch('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password, data: { username: username } })
    });

    // Signup may return user directly if email confirmation is disabled
    if (data.user && data.session) {
      saveSession(data.user, data.session.access_token);
      closeAuthModal();
      updateUserUI();
      loadCloudFavorites().then(() => render());
      showSyncBanner();
    } else if (data.user) {
      // Email confirmation required
      closeAuthModal();
      alert('注册成功！请检查邮箱验证链接后登录。');
    }
  } catch (e) {
    showAuthError('authSignupError', translateAuthError(e.message));
    btn.disabled = false;
    btn.textContent = '注册';
  }
}

async function handleResetPassword() {
  var email = document.getElementById('authResetEmail').value.trim();
  var btn = document.querySelector('#authResetForm .auth-submit');

  if (!email) { showAuthError('authResetError', '请输入邮箱地址'); return; }

  btn.disabled = true;
  btn.textContent = '发送中...';
  clearAuthError('authResetError');

  try {
    await apiFetch('/auth/v1/recover', {
      method: 'POST',
      body: JSON.stringify({ email: email })
    });
    document.getElementById('authResetSuccess').textContent = '重置邮件已发送，请检查收件箱';
    btn.textContent = '已发送 ✓';
  } catch (e) {
    showAuthError('authResetError', translateAuthError(e.message));
    btn.disabled = false;
    btn.textContent = '发送重置链接';
  }
}

async function handleLogout() {
  try {
    await apiFetch('/auth/v1/logout', { method: 'POST' });
  } catch (e) { /* ignore */ }
  clearSession();
  loadFavorites();
  updateUserUI();
  // Refresh page content
  if (typeof render === 'function') render();
  if (typeof updateSidebar === 'function') updateSidebar();
}

// ============================================================
// 同步横幅
function showSyncBanner() {
  var existing = document.getElementById('syncBanner');
  if (existing) existing.remove();

  var favCount = typeof FAVORITES !== 'undefined' ? FAVORITES.size : 0;
  if (favCount === 0) return;

  var banner = document.createElement('div');
  banner.id = 'syncBanner';
  banner.className = 'sync-banner';
  banner.innerHTML = '<span class="sync-banner-icon">🔄</span><span>检测到本地 ' + favCount + ' 篇收藏，<a id="syncNow" style="color:var(--accent);cursor:pointer;text-decoration:underline;">点此同步到云端</a></span><button class="sync-banner-close">✕</button>';
  var container = document.querySelector('.container');
  if (!container) return;
  container.prepend(banner);

  banner.querySelector('.sync-banner-close').addEventListener('click', function () { banner.remove(); });
  banner.querySelector('#syncNow').addEventListener('click', function () { syncLocalFavoritesToCloud(); });
}

async function syncLocalFavoritesToCloud() {
  if (!accessToken || !currentUser) return;
  var articleIds = typeof FAVORITES !== 'undefined' ? [...FAVORITES] : [];
  var synced = 0;

  for (var i = 0; i < articleIds.length; i++) {
    var id = articleIds[i];
    try {
      await apiFetch('/rest/v1/favorites?user_id=eq.' + currentUser.id + '&article_id=eq.' + id, {
        method: 'GET',
        headers: { ...authHeaders(), 'Prefer': 'count=exact' }
      });
      // TODO: need upsert — for simplicity, insert if not exists
      await apiFetch('/rest/v1/favorites', {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentUser.id,
          article_id: id,
          article_title: id,
          updated_at: new Date().toISOString()
        }),
        headers: { ...authHeaders(), 'Prefer': 'return=minimal' }
      }).catch(function () {
        // May already exist, try PATCH
        return apiFetch('/rest/v1/favorites?user_id=eq.' + currentUser.id + '&article_id=eq.' + id, {
          method: 'PATCH',
          body: JSON.stringify({ updated_at: new Date().toISOString() }),
          headers: { ...authHeaders(), 'Prefer': 'return=minimal' }
        });
      });
      synced++;
    } catch (e) {
      // Ignore duplicates
    }
  }

  var banner = document.getElementById('syncBanner');
  if (banner) {
    banner.innerHTML = '<span class="sync-banner-icon">✅</span><span>同步完成！' + synced + '/' + articleIds.length + ' 篇收藏已保存到云端</span><button class="sync-banner-close">✕</button>';
    banner.querySelector('.sync-banner-close').addEventListener('click', function () { banner.remove(); });
  }
}

// ============================================================
// 云端收藏同步 (via REST API)
async function loadCloudFavorites() {
  if (!accessToken || !currentUser) return;

  try {
    var data = await apiFetch('/rest/v1/favorites?select=article_id&user_id=eq.' + currentUser.id, {
      method: 'GET',
      headers: { ...authHeaders() }
    });

    if (!data || !data.length) return;

    var cloudIds = data.map(function (r) { return r.article_id; });
    var newFavs = new Set(typeof FAVORITES !== 'undefined' ? [...FAVORITES] : []);
    cloudIds.forEach(function (id) { newFavs.add(id); });

    if (typeof FAVORITES !== 'undefined') {
      FAVORITES = newFavs;
      if (typeof saveFavorites === 'function') saveFavorites();
    }

    // Upload local-only favorites to cloud
    var localOnly = [...newFavs].filter(function (id) { return !cloudIds.includes(id); });
    for (var i = 0; i < localOnly.length; i++) {
      var id = localOnly[i];
      try {
        await apiFetch('/rest/v1/favorites', {
          method: 'POST',
          body: JSON.stringify({
            user_id: currentUser.id,
            article_id: id,
            article_title: id,
            updated_at: new Date().toISOString()
          }),
          headers: { ...authHeaders(), 'Prefer': 'return=minimal' }
        });
      } catch (e) { /* duplicate, ignore */ }
    }

    if (typeof updateFavCount === 'function') updateFavCount();
    if (typeof render === 'function') render();
  } catch (e) {
    console.error('[Auth] 加载云端收藏失败:', e.message);
  }
}

async function saveCloudFavorite(articleId, articleTitle) {
  if (!accessToken || !currentUser) return;

  try {
    await apiFetch('/rest/v1/favorites', {
      method: 'POST',
      body: JSON.stringify({
        user_id: currentUser.id,
        article_id: articleId,
        article_title: articleId,
        updated_at: new Date().toISOString()
      }),
      headers: { ...authHeaders(), 'Prefer': 'return=minimal' }
    });
  } catch (e) { /* ignore */ }
}

async function removeCloudFavorite(articleId) {
  if (!accessToken || !currentUser) return;

  try {
    await apiFetch('/rest/v1/favorites?user_id=eq.' + currentUser.id + '&article_id=eq.' + articleId, {
      method: 'DELETE',
      headers: { ...authHeaders(), 'Prefer': 'return=minimal' }
    });
  } catch (e) { /* ignore */ }
}

// ============================================================
// Session restore on page load
async function restoreSession() {
  if (!loadLocalSession()) return false;

  try {
    var data = await apiFetch('/auth/v1/user', { method: 'GET' });
    if (data && data.id) {
      currentUser = data;
      localStorage.setItem('connectorhub_user', JSON.stringify(data));
      console.log('[Auth] 会话恢复成功');
      return true;
    }
  } catch (e) {
    console.warn('[Auth] 会话已过期，需要重新登录');
  }
  clearSession();
  return false;
}

// ============================================================
// UI
function updateUserUI() {
  var btn = document.getElementById('userBtn');
  if (!btn) return;
  var dropdown = document.getElementById('userDropdownMenu');

  if (currentUser) {
    var email = currentUser.email || '';
    var username = (currentUser.user_metadata && currentUser.user_metadata.username) || email.split('@')[0];
    btn.className = 'user-btn logged-in';
    btn.innerHTML = '<span>👤</span> ' + username;

    if (dropdown) {
      var favCount = typeof FAVORITES !== 'undefined' ? FAVORITES.size : 0;
      dropdown.innerHTML = '<div class="user-dropdown-email">' + email + '</div><div class="user-dropdown-item" id="menuFavorites">⭐ 我的收藏 (' + favCount + ')</div><div class="user-dropdown-item danger" id="menuLogout">🚪 退出登录</div>';
      document.getElementById('menuLogout').addEventListener('click', function () {
        handleLogout().then(function () { document.getElementById('userDropdownMenu').classList.remove('show'); });
      });
      document.getElementById('menuFavorites').addEventListener('click', function () {
        if (typeof showFavOnly !== 'undefined') {
          showFavOnly = true;
          currentPage = 1;
        }
        document.getElementById('userDropdownMenu').classList.remove('show');
        if (typeof render === 'function') render();
      });
    }
  } else {
    btn.className = 'user-btn';
    btn.innerHTML = '👤 登录';
    if (dropdown) dropdown.innerHTML = '';
  }
}

function setupUserButton() {
  var btn = document.getElementById('userBtn');
  if (!btn) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (currentUser) {
      var menu = document.getElementById('userDropdownMenu');
      if (menu) menu.classList.toggle('show');
    } else {
      openAuthModal('login');
    }
  });

  document.addEventListener('click', function () {
    var menu = document.getElementById('userDropdownMenu');
    if (menu) menu.classList.remove('show');
  });
}

// ============================================================
// 工具函数
function showAuthError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearAuthError(id) {
  var el = document.getElementById(id);
  if (el) el.textContent = '';
}

function translateAuthError(msg) {
  var map = {
    'invalid login credentials': '邮箱或密码错误',
    'email not confirmed': '邮箱尚未验证，请检查收件箱',
    'user already registered': '该邮箱已注册，请直接登录',
    'password should be at least 6 characters': '密码至少需要6位',
    'unable to validate email address': '邮箱格式不正确',
    'email rate limit exceeded': '请求过于频繁，请稍后再试',
    'for security purposes': '请60秒后再试',
    'user not found': '用户不存在'
  };
  msg = (msg || '').toLowerCase();
  for (var key in map) {
    if (msg.indexOf(key) !== -1) return map[key];
  }
  return msg;
}

// ============================================================
// 初始化
async function initAuth() {
  setupUserButton();

  try {
    var restored = await restoreSession();
    if (restored) {
      updateUserUI();
      await loadCloudFavorites();
    }
    console.log('[Auth] 初始化完成' + (restored ? '（已登录）' : '（未登录）'));
  } catch (e) {
    console.log('[Auth] 初始化完成（未登录）');
  }
}

document.addEventListener('DOMContentLoaded', initAuth);

// ============================================================
// Tab 切换 + 表单绑定（之前遗漏了！）
function setupAuthTabs(overlay) {
  var tabs = overlay.querySelectorAll('.auth-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      var tab = this.getAttribute('data-tab');
      if (tab === 'login' || tab === 'signup') {
        overlay.querySelector('.auth-body').innerHTML = renderAuthBody(tab);
        setupAuthForms(overlay);
      }
    });
  }
}

function setupAuthForms(overlay) {
  var loginForm = overlay.querySelector('#authLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleLogin();
    });
  }

  var signupForm = overlay.querySelector('#authSignupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleSignup();
    });
  }

  var resetForm = overlay.querySelector('#authResetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleResetPassword();
    });
  }
}

function switchAuthTab(tab) {
  var overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.querySelector('.auth-body').innerHTML = renderAuthBody(tab);
    setupAuthForms(overlay);
  }
}
