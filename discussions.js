// discussions.js - ConnectorHUB 交流讨论区
// 依赖：auth.js（SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, apiFetch, currentUser, accessToken 等）

var currentFilter = 'all';
var currentPage_num = 0;
var postsPerPage = 20;
var allPostsLoaded = false;

// ============================================================
// 初始化
document.addEventListener('DOMContentLoaded', function() {
  // 等待 auth.js 初始化完成
  setTimeout(function() {
    updateComposeArea();
    loadPosts();
  }, 300);

  // 监听 auth 状态变化
  var origUpdateUI = window.updateUserUI;
  window.updateUserUI = function() {
    if (origUpdateUI) origUpdateUI();
    updateComposeArea();
  };

  // 标题输入字数统计
  var titleInput = document.getElementById('postTitle');
  if (titleInput) {
    titleInput.addEventListener('input', function() {
      // 标题无需字数统计，内容区才有
    });
  }

  var contentInput = document.getElementById('postContent');
  if (contentInput) {
    contentInput.addEventListener('input', function() {
      var count = this.value.length;
      var counter = document.getElementById('charCount');
      if (counter) {
        counter.textContent = count + ' / 1000';
        if (count > 1000) {
          counter.style.color = 'var(--red)';
        } else {
          counter.style.color = '';
        }
      }
    });
  }
});

// ============================================================
// 发帖区域显示控制
function updateComposeArea() {
  var prompt = document.getElementById('loginPrompt');
  var form = document.getElementById('composeForm');
  if (!prompt || !form) return;

  if (currentUser && accessToken) {
    prompt.style.display = 'none';
    form.style.display = 'block';
  } else {
    prompt.style.display = 'block';
    form.style.display = 'none';
  }
}

// ============================================================
// 加载帖子列表
function loadPosts() {
  currentPage_num = 0;
  allPostsLoaded = false;
  var list = document.getElementById('discussionList');
  if (list) list.innerHTML = '<div class="discussion-loading">加载中...</div>';
  loadMorePosts();
}

function loadMorePosts() {
  if (allPostsLoaded) return;

  var sort = document.getElementById('sortSelect').value;
  var sortField = sort.split('.')[0];
  var sortDir = sort.split('.')[1] === 'desc' ? 'desc' : 'asc';
  var sortStr = sortDir === 'desc' ? sortField + '.desc' : sortField + '.asc';

  var url = '/rest/v1/discussions?select=*&order=' + sortStr + '&limit=' + postsPerPage + '&offset=' + (currentPage_num * postsPerPage);

  if (currentFilter !== 'all') {
    url += '&type=eq.' + currentFilter;
  }

  apiFetch(url)
    .then(function(data) {
      var list = document.getElementById('discussionList');

      if (currentPage_num === 0) {
        list.innerHTML = '';
      }

      if (!data || data.length === 0) {
        if (currentPage_num === 0) {
          list.innerHTML = '<div class="discussion-empty"><div class="discussion-empty-icon">💬</div><p>还没有讨论，来发第一条吧！</p></div>';
        }
        allPostsLoaded = true;
        var loadMore = document.getElementById('loadMore');
        if (loadMore) loadMore.style.display = 'none';
        return;
      }

      data.forEach(function(post) {
        list.appendChild(createPostElement(post));
      });

      currentPage_num++;
      var loadMore = document.getElementById('loadMore');
      if (loadMore) loadMore.style.display = data.length < postsPerPage ? 'none' : 'block';
    })
    .catch(function(e) {
      var list = document.getElementById('discussionList');
      if (list && currentPage_num === 0) {
        list.innerHTML = '<div class="discussion-empty"><p>加载失败：' + (e.message || '网络错误') + '</p><p style="margin-top:8px;font-size:12px;color:var(--text-dim);">请确认 Supabase 中已创建 discussions 表</p></div>';
      }
    });
}

// ============================================================
// 创建帖子 DOM 元素
function createPostElement(post) {
  var div = document.createElement('div');
  div.className = 'discussion-post';
  div.onclick = function() { openReplyModal(post); };

  var typeLabels = {
    'question': '❓ 问题求助',
    'request': '📋 需求留言',
    'discussion': '💡 技术交流',
    'suggestion': '✅ 建议反馈'
  };

  var dateStr = formatDate(post.created_at);

  div.innerHTML =
    '<div class="post-top-row">' +
      '<span class="post-type-badge ' + post.type + '">' + (typeLabels[post.type] || post.type) + '</span>' +
    '</div>' +
    '<div class="post-title">' + escapeHtml(post.title) + '</div>' +
    '<div class="post-preview">' + escapeHtml(post.content.substring(0, 120)) + '</div>' +
    '<div class="post-bottom-row">' +
      '<span class="post-author">' + escapeHtml(post.username || '匿名') + '</span>' +
      '<span class="post-date">' + dateStr + '</span>' +
      '<div class="post-stats">' +
        '<span class="post-stat' + (post.user_liked ? ' liked' : '') + '" onclick="event.stopPropagation();likePost(\'' + post.id + '\',this)">👍 ' + (post.like_count || 0) + '</span>' +
        '<span class="post-stat">💬 ' + (post.reply_count || 0) + '</span>' +
      '</div>' +
    '</div>';

  return div;
}

// ============================================================
// 发布新帖
function submitPost() {
  if (!currentUser || !accessToken) {
    openAuthModal('login');
    return;
  }

  var type = document.getElementById('postType').value;
  var title = (document.getElementById('postTitle') || {}).value || '';
  var content = (document.getElementById('postContent') || {}).value || '';
  var errEl = document.getElementById('postError');
  var btn = document.getElementById('submitPostBtn');

  title = title.trim();
  content = content.trim();

  if (!title) {
    if (errEl) errEl.textContent = '请输入标题';
    return;
  }
  if (!content) {
    if (errEl) errEl.textContent = '请输入内容';
    return;
  }
  if (content.length > 1000) {
    if (errEl) errEl.textContent = '内容不能超过1000字';
    return;
  }

  if (errEl) errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = '发布中...'; }

  apiFetch('/rest/v1/discussions', {
    method: 'POST',
    body: JSON.stringify({
      user_id: currentUser.id,
      username: (currentUser.user_metadata && currentUser.user_metadata.username) || currentUser.email.split('@')[0],
      type: type,
      title: title,
      content: content,
      like_count: 0,
      reply_count: 0,
      created_at: new Date().toISOString()
    }),
    headers: { 'Prefer': 'return=representation' }
  }).then(function(data) {
    // 清空表单
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    var counter = document.getElementById('charCount');
    if (counter) counter.textContent = '0 / 1000';

    // 重新加载列表
    loadPosts();

    if (btn) { btn.disabled = false; btn.textContent = '发布讨论'; }
  }).catch(function(e) {
    if (errEl) errEl.textContent = '发布失败：' + (e.message || '网络错误');
    if (btn) { btn.disabled = false; btn.textContent = '发布讨论'; }
  });
}

// ============================================================
// 点赞
function likePost(postId, el) {
  if (!currentUser || !accessToken) {
    openAuthModal('login');
    return;
  }

  // 先检查是否已点赞
  apiFetch('/rest/v1/discussion_likes?select=id&user_id=eq.' + currentUser.id + '&discussion_id=eq.' + postId)
    .then(function(existing) {
      if (existing && existing.length > 0) {
        // 已点赞，取消点赞（触发器会自动 -1 like_count）
        return apiFetch('/rest/v1/discussion_likes?id=eq.' + existing[0].id, {
          method: 'DELETE'
        });
      } else {
        // 未点赞，添加点赞记录（触发器会自动 +1 like_count）
        return apiFetch('/rest/v1/discussion_likes', {
          method: 'POST',
          body: JSON.stringify({
            user_id: currentUser.id,
            discussion_id: postId
          }),
          headers: { 'Prefer': 'return=minimal' }
        });
      }
    })
    .then(function() {
      // 重新加载列表以更新点赞数
      loadPosts();
    })
    .catch(function(e) {
      console.warn('[Discussions] 点赞失败:', e.message);
    });
}

// ============================================================
// 回复弹窗
var currentReplyPostId = null;

function openReplyModal(post) {
  currentReplyPostId = post.id;
  var overlay = document.getElementById('replyOverlay');
  if (overlay) overlay.classList.add('active');

  var titleEl = document.getElementById('replyPostTitle');
  if (titleEl) titleEl.textContent = escapeHtml(post.title);

  var contentEl = document.getElementById('replyPostContent');
  if (contentEl) contentEl.innerHTML = '<p>' + escapeHtml(post.content).replace(/\n/g, '<br>') + '</p>';

  // 加载回复
  loadReplies(post.id);

  // 更新回复计数
  document.getElementById('replyComposeArea').style.display = (currentUser && accessToken) ? 'flex' : 'none';
}

function closeReplyModal(e) {
  if (e && e.target !== e.currentTarget) return;
  var overlay = document.getElementById('replyOverlay');
  if (overlay) overlay.classList.remove('active');
  currentReplyPostId = null;
}

// ============================================================
// 加载回复
function loadReplies(discussionId) {
  var list = document.getElementById('replyList');
  if (list) list.innerHTML = '<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:20px;">加载中...</div>';

  apiFetch('/rest/v1/discussion_replies?select=*&discussion_id=eq.' + discussionId + '&order=created_at.asc')
    .then(function(data) {
      if (!data || data.length === 0) {
        if (list) list.innerHTML = '<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:20px;">暂无回复，来说两句吧</div>';
        return;
      }
      if (list) {
        list.innerHTML = '';
        data.forEach(function(reply) {
          list.appendChild(createReplyElement(reply));
        });
      }
    })
    .catch(function() {
      if (list) list.innerHTML = '<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:20px;">加载回复失败</div>';
    });
}

function createReplyElement(reply) {
  var div = document.createElement('div');
  div.className = 'reply-item';
  div.innerHTML =
    '<div class="reply-item-header">' +
      '<span class="reply-item-author">' + escapeHtml(reply.username || '匿名') + '</span>' +
      '<span>' + formatDate(reply.created_at) + '</span>' +
    '</div>' +
    '<div class="reply-item-content">' + escapeHtml(reply.content).replace(/\n/g, '<br>') + '</div>';
  return div;
}

// ============================================================
// 提交回复
function submitReply() {
  if (!currentUser || !accessToken) {
    openAuthModal('login');
    return;
  }
  if (!currentReplyPostId) return;

  var input = document.getElementById('replyInput');
  var content = (input || {}).value || '';
  content = content.trim();
  if (!content) return;

  apiFetch('/rest/v1/discussion_replies', {
    method: 'POST',
    body: JSON.stringify({
      discussion_id: currentReplyPostId,
      user_id: currentUser.id,
      username: (currentUser.user_metadata && currentUser.user_metadata.username) || currentUser.email.split('@')[0],
      content: content,
      created_at: new Date().toISOString()
    }),
    headers: { 'Prefer': 'return=representation' }
  }).then(function() {
    input.value = '';
    loadReplies(currentReplyPostId);
    // 更新主列表的回复计数
    loadPosts();
  }).catch(function(e) {
    alert('回复失败：' + (e.message || '网络错误'));
  });
}

// ============================================================
// 过滤
function filterPosts(type) {
  currentFilter = type;
  var tabs = document.querySelectorAll('#filterTabs .filter-tab');
  tabs.forEach(function(tab) {
    tab.classList.toggle('active', tab.getAttribute('data-filter') === type);
  });
  loadPosts();
}

// ============================================================
// 工具函数
function formatDate(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  var now = new Date();
  var diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
