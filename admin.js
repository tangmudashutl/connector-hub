// admin.js - ConnectorHUB 管理后台
// 依赖：auth.js（SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, apiFetch, currentUser, accessToken 等）

var adminUsers = [];
var adminDiscussions = [];
var adminReplies = [];
var currentAdminTab = 'users';
var isAdminUser = false;

// ============================================================
// 初始化
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    checkAdminAccess();
  }, 500);
});

// ============================================================
// 权限检查
function checkAdminAccess() {
  if (!currentUser || !accessToken) {
    showNoAccess();
    return;
  }

  // 调用 is_admin() RPC 函数
  apiFetch('/rest/v1/rpc/is_admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then(function(data) {
    if (data === true) {
      isAdminUser = true;
      var badge = document.getElementById('adminBadge');
      if (badge) badge.style.display = 'inline-block';
      showAdminPanel();
      loadAllData();
    } else {
      showNoAccess();
    }
  }).catch(function() {
    showNoAccess();
  });
}

function showNoAccess() {
  document.getElementById('noAccess').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('noAccess').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
}

// ============================================================
// 加载所有数据
function loadAllData() {
  var promises = [];

  // 加载用户列表
  promises.push(
    apiFetch('/rest/v1/rpc/admin_get_users', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(function(data) {
        adminUsers = data || [];
        document.getElementById('statUsers').textContent = adminUsers.length;
      }).catch(function() { adminUsers = []; })
  );

  // 加载讨论列表
  promises.push(
    apiFetch('/rest/v1/rpc/admin_get_discussions', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(function(data) {
        adminDiscussions = data || [];
        document.getElementById('statDiscussions').textContent = adminDiscussions.length;
      }).catch(function() { adminDiscussions = []; })
  );

  // 加载回复列表
  promises.push(
    apiFetch('/rest/v1/rpc/admin_get_replies', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(function(data) {
        adminReplies = data || [];
        document.getElementById('statReplies').textContent = adminReplies.length;
      }).catch(function() { adminReplies = []; })
  );

  // 加载点赞总数
  promises.push(
    apiFetch('/rest/v1/discussion_likes?select=id')
      .then(function(data) {
        document.getElementById('statLikes').textContent = (data || []).length;
      }).catch(function() {})
  );

  // 所有数据加载完成后渲染表格
  Promise.all(promises).then(function() {
    renderTable();
  });
}

// ============================================================
// Tab 切换
function switchAdminTab(tab) {
  currentAdminTab = tab;
  var tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(function(t) {
    t.classList.toggle('active', t.textContent.indexOf(tab) !== -1);
  });
  document.getElementById('tableSearch').value = '';
  renderTable();
}

// ============================================================
// 渲染表格
function renderTable(searchTerm) {
  searchTerm = (searchTerm || '').toLowerCase();
  var head = document.getElementById('tableHead');
  var body = document.getElementById('tableBody');
  var info = document.getElementById('tableInfo');

  if (currentAdminTab === 'users') {
    head.innerHTML =
      '<tr><th>序号</th><th>邮箱</th><th>用户名</th><th>注册时间</th><th>最后登录</th><th>User ID</th></tr>';

    var filtered = searchTerm ? adminUsers.filter(function(u) {
      return (u.email || '').toLowerCase().indexOf(searchTerm) !== -1 ||
             (u.username || '').toLowerCase().indexOf(searchTerm) !== -1;
    }) : adminUsers;

    body.innerHTML = filtered.map(function(u, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(u.email || '-') + '</td>' +
        '<td>' + escapeHtml(u.username || '-') + '</td>' +
        '<td>' + formatDateTime(u.created_at) + '</td>' +
        '<td>' + formatDateTime(u.last_sign_in_at) + '</td>' +
        '<td style="font-size:11px;color:var(--text-dim);">' + escapeHtml((u.id || '').substring(0, 8) + '...') + '</td>' +
        '</tr>';
    }).join('');

    info.textContent = '共 ' + filtered.length + ' 条记录';
  }
  else if (currentAdminTab === 'discussions') {
    head.innerHTML =
      '<tr><th>序号</th><th>类型</th><th>标题</th><th>内容</th><th>作者</th><th>邮箱</th><th>👍</th><th>💬</th><th>发布时间</th></tr>';

    var filtered = searchTerm ? adminDiscussions.filter(function(d) {
      return (d.title || '').toLowerCase().indexOf(searchTerm) !== -1 ||
             (d.content || '').toLowerCase().indexOf(searchTerm) !== -1 ||
             (d.username || '').toLowerCase().indexOf(searchTerm) !== -1 ||
             (d.email || '').toLowerCase().indexOf(searchTerm) !== -1;
    }) : adminDiscussions;

    body.innerHTML = filtered.map(function(d, i) {
      var typeLabel = {question:'❓问题', request:'📋需求', discussion:'💡交流', suggestion:'✅建议'}[d.type] || d.type;
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span class="badge-type ' + d.type + '">' + typeLabel + '</span></td>' +
        '<td class="col-content" title="' + escapeHtml(d.title) + '">' + escapeHtml(d.title) + '</td>' +
        '<td class="col-content" title="' + escapeHtml(d.content || '') + '">' + escapeHtml((d.content || '').substring(0, 50)) + '</td>' +
        '<td>' + escapeHtml(d.username || '-') + '</td>' +
        '<td>' + escapeHtml(d.email || '-') + '</td>' +
        '<td>' + (d.like_count || 0) + '</td>' +
        '<td>' + (d.reply_count || 0) + '</td>' +
        '<td>' + formatDateTime(d.created_at) + '</td>' +
        '</tr>';
    }).join('');

    info.textContent = '共 ' + filtered.length + ' 条记录';
  }
  else if (currentAdminTab === 'replies') {
    head.innerHTML =
      '<tr><th>序号</th><th>所属帖子</th><th>回复内容</th><th>作者</th><th>邮箱</th><th>回复时间</th></tr>';

    var filtered = searchTerm ? adminReplies.filter(function(r) {
      return (r.content || '').toLowerCase().indexOf(searchTerm) !== -1 ||
             (r.discussion_title || '').toLowerCase().indexOf(searchTerm) !== -1 ||
             (r.username || '').toLowerCase().indexOf(searchTerm) !== -1 ||
             (r.email || '').toLowerCase().indexOf(searchTerm) !== -1;
    }) : adminReplies;

    body.innerHTML = filtered.map(function(r, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="col-content" title="' + escapeHtml(r.discussion_title || '') + '">' + escapeHtml(r.discussion_title || '-') + '</td>' +
        '<td class="col-content" title="' + escapeHtml(r.content || '') + '">' + escapeHtml((r.content || '').substring(0, 60)) + '</td>' +
        '<td>' + escapeHtml(r.username || '-') + '</td>' +
        '<td>' + escapeHtml(r.email || '-') + '</td>' +
        '<td>' + formatDateTime(r.created_at) + '</td>' +
        '</tr>';
    }).join('');

    info.textContent = '共 ' + filtered.length + ' 条记录';
  }
}

// ============================================================
// 搜索过滤
function filterTable() {
  var term = document.getElementById('tableSearch').value;
  renderTable(term);
}

// ============================================================
// CSV 导出
function exportCSV() {
  var type = document.getElementById('csvSelect').value;
  var rows = [];
  var filename = '';

  if (type === 'users') {
    filename = 'connectorhub_users.csv';
    rows.push(['序号', '邮箱', '用户名', '注册时间', '最后登录', 'User ID']);
    adminUsers.forEach(function(u, i) {
      rows.push([i + 1, u.email || '', u.username || '', u.created_at || '', u.last_sign_in_at || '', u.id || '']);
    });
  }
  else if (type === 'discussions') {
    filename = 'connectorhub_discussions.csv';
    rows.push(['序号', '类型', '标题', '内容', '作者', '邮箱', '点赞数', '回复数', '发布时间']);
    adminDiscussions.forEach(function(d, i) {
      rows.push([i + 1, d.type || '', d.title || '', d.content || '', d.username || '', d.email || '', d.like_count || 0, d.reply_count || 0, d.created_at || '']);
    });
  }
  else {
    filename = 'connectorhub_replies.csv';
    rows.push(['序号', '所属帖子', '回复内容', '作者', '邮箱', '回复时间']);
    adminReplies.forEach(function(r, i) {
      rows.push([i + 1, r.discussion_title || '', r.content || '', r.username || '', r.email || '', r.created_at || '']);
    });
  }

  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      var s = String(cell || '');
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');

  // 添加 BOM 以支持 Excel 正确识别中文
  var bom = '\uFEFF';
  var blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// 监听登录状态变化
var origUpdateUI = window.updateUserUI;
window.updateUserUI = function() {
  if (origUpdateUI) origUpdateUI();
  // 登录状态改变后重新检查权限
  if (currentUser && accessToken) {
    setTimeout(checkAdminAccess, 300);
  }
};

// ============================================================
// 工具函数
function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  var d = new Date(isoStr);
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  var hh = String(d.getHours()).padStart(2, '0');
  var mi = String(d.getMinutes()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd + ' ' + hh + ':' + mi;
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
