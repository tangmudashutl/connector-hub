// ConnectorHUB - Supabase Auth Module
// ============================================================
// 使用前请替换下方的 SUPABASE_URL 和 SUPABASE_ANON_KEY
// 获取方式：https://supabase.com/dashboard → 你的项目 → Settings → API

const SUPABASE_URL = 'YOUR_SUPABASE_URL';     // 例如: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';     // 例如: eyJhbGci...

// ============================================================
// Supabase 客户端
let supabase = null;

function initSupabase() {
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }
  console.warn('[Auth] Supabase SDK 未加载');
  return false;
}

// ============================================================
// 用户状态
let currentUser = null;
let userProfile = null; // { email, username, avatar_url, created_at }

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

  // Close handlers
  overlay.querySelector('.auth-close').addEventListener('click', closeAuthModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAuthModal();
  });
  document.addEventListener('keydown', closeAuthOnEscape);

  // Tab switches
  setupAuthTabs(overlay);

  // Form submissions
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
  return `
    <div class="auth-modal">
      <div class="auth-header">
        <h2>${tab === 'login' ? '登录 ConnectorHUB' : '注册 ConnectorHUB'}</h2>
        <button class="auth-close">✕</button>
      </div>
      <div class="auth-body">${renderAuthBody(tab)}</div>
    </div>
  `;
}

function renderAuthBody(tab) {
  const isLogin = tab === 'login';
  const isReset = tab === 'reset';

  if (isReset) {
    return `
      <form class="auth-form" id="authResetForm" onsubmit="return false">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">输入注册邮箱，我们将发送重置链接</p>
        <input type="email" id="authResetEmail" placeholder="邮箱地址" required autocomplete="email">
        <div class="auth-error" id="authResetError"></div>
        <div class="auth-success" id="authResetSuccess"></div>
        <button type="submit" class="auth-submit">发送重置链接</button>
        <p class="auth-alt-hint"><a onclick="switchAuthTab('login')">← 返回登录</a></p>
      </form>
    `;
  }

  return `
    <div class="auth-tabs">
      <button class="auth-tab ${isLogin ? 'active' : ''}" data-tab="login">登录</button>
      <button class="auth-tab ${!isLogin ? 'active' : ''}" data-tab="signup">注册</button>
    </div>
    ${isLogin ? `
      <form class="auth-form" id="authLoginForm" onsubmit="return false">
        <input type="email" id="authLoginEmail" placeholder="邮箱地址" required autocomplete="email">
        <input type="password" id="authLoginPassword" placeholder="密码" required autocomplete="current-password">
        <div class="auth-error" id="authLoginError"></div>
        <button type="submit" class="auth-submit">登录</button>
        <p class="auth-alt-hint"><a onclick="switchAuthTab('reset')">忘记密码？</a></p>
      </form>
    ` : `
      <form class="auth-form" id="authSignupForm" onsubmit="return false">
        <input type="text" id="authSignupUsername" placeholder="用户名" required autocomplete="username">
        <input type="email" id="authSignupEmail" placeholder="邮箱地址" required autocomplete="email">
        <input type="password" id="authSignupPassword" placeholder="密码（至少6位）" required autocomplete="new-password" minlength="6">
        <div class="auth-error" id="authSignupError"></div>
        <button type="submit" class="auth-submit">注册</button>
      </form>
    `}
  `;
}

function switchAuthTab(tab) {
  const overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.querySelector('.auth-body').innerHTML = renderAuthBody(tab);
  setupAuthTabs(overlay);
  setupAuthForms(overlay);
}

function setupAuthTabs(overlay) {
  overlay.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchAuthTab(tab);
    });
  });
}

function setupAuthForms(overlay) {
  // Login form
  const loginForm = overlay.querySelector('#authLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', () => handleLogin());
  }

  // Signup form
  const signupForm = overlay.querySelector('#authSignupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', () => handleSignup());
  }

  // Reset password form
  const resetForm = overlay.querySelector('#authResetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', () => handleResetPassword());
  }
}

// ============================================================
// Auth Handlers
async function handleLogin() {
  if (!supabase) { showAuthError('authLoginError', '鉴权服务未就绪，请刷新页面后重试'); return; }

  const email = document.getElementById('authLoginEmail').value.trim();
  const password = document.getElementById('authLoginPassword').value;
  const btn = document.querySelector('#authLoginForm .auth-submit');

  if (!email || !password) {
    showAuthError('authLoginError', '请填写邮箱和密码');
    return;
  }

  btn.disabled = true;
  btn.textContent = '登录中...';
  clearAuthError('authLoginError');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showAuthError('authLoginError', translateAuthError(error.message));
    btn.disabled = false;
    btn.textContent = '登录';
    return;
  }

  if (data.user) {
    closeAuthModal();
    showSyncBanner();
  }
}

async function handleSignup() {
  if (!supabase) { showAuthError('authSignupError', '鉴权服务未就绪，请刷新页面后重试'); return; }

  const username = document.getElementById('authSignupUsername').value.trim();
  const email = document.getElementById('authSignupEmail').value.trim();
  const password = document.getElementById('authSignupPassword').value;
  const btn = document.querySelector('#authSignupForm .auth-submit');

  if (!email || !password) {
    showAuthError('authSignupError', '请填写邮箱和密码');
    return;
  }
  if (password.length < 6) {
    showAuthError('authSignupError', '密码至少需要6位');
    return;
  }
  if (!username) {
    showAuthError('authSignupError', '请输入用户名');
    return;
  }

  btn.disabled = true;
  btn.textContent = '注册中...';
  clearAuthError('authSignupError');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) {
    showAuthError('authSignupError', translateAuthError(error.message));
    btn.disabled = false;
    btn.textContent = '注册';
    return;
  }

  if (data.user) {
    closeAuthModal();
    showSyncBanner();
  }
}

async function handleResetPassword() {
  if (!supabase) { showAuthError('authResetError', '鉴权服务未就绪'); return; }

  const email = document.getElementById('authResetEmail').value.trim();
  const btn = document.querySelector('#authResetForm .auth-submit');

  if (!email) {
    showAuthError('authResetError', '请输入邮箱地址');
    return;
  }

  btn.disabled = true;
  btn.textContent = '发送中...';
  clearAuthError('authResetError');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname + '#/reset-password'
  });

  if (error) {
    showAuthError('authResetError', translateAuthError(error.message));
    btn.disabled = false;
    btn.textContent = '发送重置链接';
    return;
  }

  document.getElementById('authResetSuccess').textContent = '重置邮件已发送，请检查收件箱';
  btn.textContent = '已发送 ✓';
}

async function handleLogout() {
  if (!supabase) return;
  await supabase.auth.signOut();
  // 保留 localStorage 中的收藏数据，下次登录可同步
}

// ============================================================
// 同步横幅
function showSyncBanner() {
  const existing = document.getElementById('syncBanner');
  if (existing) existing.remove();

  const favCount = FAVORITES.size;
  if (favCount === 0) return;

  const banner = document.createElement('div');
  banner.id = 'syncBanner';
  banner.className = 'sync-banner';
  banner.innerHTML = `
    <span class="sync-banner-icon">🔄</span>
    <span>检测到本地 ${favCount} 篇收藏，<a id="syncNow" style="color:var(--accent);cursor:pointer;text-decoration:underline;">点此同步到云端</a></span>
    <button class="sync-banner-close">✕</button>
  `;
  document.querySelector('.container').prepend(banner);

  banner.querySelector('.sync-banner-close').addEventListener('click', () => banner.remove());
  banner.querySelector('#syncNow').addEventListener('click', () => syncLocalFavoritesToCloud());
}

async function syncLocalFavoritesToCloud() {
  if (!supabase || !currentUser) return;

  const articleIds = [...FAVORITES];
  let synced = 0;

  for (const id of articleIds) {
    const article = ARTICLES.find(a => a.id === id);
    const { error } = await supabase.from('favorites').upsert({
      user_id: currentUser.id,
      article_id: id,
      article_title: article ? article.title : '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,article_id' });

    if (!error) synced++;
  }

  const banner = document.getElementById('syncBanner');
  if (banner) {
    banner.innerHTML = `
      <span class="sync-banner-icon">✅</span>
      <span>同步完成！${synced}/${articleIds.length} 篇收藏已保存到云端</span>
      <button class="sync-banner-close">✕</button>
    `;
    banner.querySelector('.sync-banner-close').addEventListener('click', () => banner.remove());
  }
}

// ============================================================
// 云端收藏同步
async function loadCloudFavorites() {
  if (!supabase || !currentUser) return;

  const { data, error } = await supabase
    .from('favorites')
    .select('article_id')
    .eq('user_id', currentUser.id);

  if (error || !data) return;

  const cloudIds = data.map(r => r.article_id);

  // 合并云端收藏和本地收藏
  const newFavs = new Set([...FAVORITES]);
  cloudIds.forEach(id => newFavs.add(id));
  FAVORITES = newFavs;
  saveFavorites();

  // 上传本地独有收藏到云端
  const localOnly = [...FAVORITES].filter(id => !cloudIds.includes(id));
  for (const id of localOnly) {
    const article = ARTICLES.find(a => a.id === id);
    await supabase.from('favorites').upsert({
      user_id: currentUser.id,
      article_id: id,
      article_title: article ? article.title : '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,article_id' });
  }

  updateFavCount();
}

async function saveCloudFavorite(articleId, articleTitle) {
  if (!supabase || !currentUser) return;

  const article = ARTICLES.find(a => a.id === articleId);
  await supabase.from('favorites').upsert({
    user_id: currentUser.id,
    article_id: articleId,
    article_title: articleId,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,article_id' });
}

async function removeCloudFavorite(articleId) {
  if (!supabase || !currentUser) return;

  await supabase.from('favorites')
    .delete()
    .eq('user_id', currentUser.id)
    .eq('article_id', articleId);
}

// ============================================================
// Auth 状态监听
function setupAuthListener() {
  if (!supabase) return;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      currentUser = session.user;
      updateUserUI();
      loadCloudFavorites().then(() => render());
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      // 回退到 localStorage 收藏
      loadFavorites();
      updateUserUI();
      render();
    }
  });

  // 初始状态
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      currentUser = session.user;
      updateUserUI();
      loadCloudFavorites().then(() => {
        render();
        updateSidebar();
      });
    }
  });
}

function updateUserUI() {
  const btn = document.getElementById('userBtn');
  if (!btn) return;

  const dropdown = document.getElementById('userDropdownMenu');

  if (currentUser) {
    const email = currentUser.email || '';
    const username = currentUser.user_metadata?.username || email.split('@')[0];
    btn.className = 'user-btn logged-in';
    btn.innerHTML = `<span>👤</span> ${username}`;

    if (dropdown) {
      dropdown.innerHTML = `
        <div class="user-dropdown-email">${email}</div>
        <div class="user-dropdown-item" id="menuFavorites">⭐ 我的收藏 (${FAVORITES.size})</div>
        <div class="user-dropdown-item danger" id="menuLogout">🚪 退出登录</div>
      `;
      document.getElementById('menuLogout').addEventListener('click', () => {
        handleLogout().then(() => {
          document.getElementById('userDropdownMenu').classList.remove('show');
        });
      });
      document.getElementById('menuFavorites').addEventListener('click', () => {
        showFavOnly = true;
        currentPage = 1;
        document.getElementById('userDropdownMenu').classList.remove('show');
        render();
      });
    }
  } else {
    btn.className = 'user-btn';
    btn.innerHTML = '👤 登录';

    if (dropdown) {
      dropdown.innerHTML = '';
    }
  }
}

// ============================================================
// 用户按钮点击
function setupUserButton() {
  const btn = document.getElementById('userBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentUser) {
      // 切换下拉菜单
      const menu = document.getElementById('userDropdownMenu');
      menu.classList.toggle('show');
    } else {
      openAuthModal('login');
    }
  });

  // 点击其他地方关闭下拉菜单
  document.addEventListener('click', () => {
    const menu = document.getElementById('userDropdownMenu');
    if (menu) menu.classList.remove('show');
  });
}

// ============================================================
// 工具函数
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearAuthError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; }
}

function translateAuthError(msg) {
  const map = {
    'Invalid login credentials': '邮箱或密码错误',
    'Email not confirmed': '邮箱尚未验证，请检查收件箱',
    'User already registered': '该邮箱已注册，请直接登录',
    'Password should be at least 6 characters': '密码至少需要6位',
    'Unable to validate email address: invalid format': '邮箱格式不正确',
    'Email rate limit exceeded': '请求过于频繁，请稍后再试',
    'For security purposes, you can only request this once every 60 seconds': '请60秒后再试',
  };

  for (const [key, val] of Object.entries(map)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return msg;
}

// ============================================================
// 初始化
function initAuth() {
  if (!initSupabase()) {
    // Supabase SDK 没加载，隐藏登录按钮或降级
    const btn = document.getElementById('userBtn');
    if (btn) btn.style.display = 'none';
    return;
  }
  setupAuthListener();
  setupUserButton();
}

document.addEventListener('DOMContentLoaded', () => {
  // 在主 app init 之后初始化 auth
  setTimeout(initAuth, 100);
});
