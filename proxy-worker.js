// Cloudflare Worker — Supabase API Proxy
// 部署后，浏览器请求此 Worker → Worker 转发到 Supabase
// 浏览器不需要直连 Supabase，由 Worker（Cloudflare 全球网络）来转发

var SUPABASE_HOST = 'clwqwidwjgharpefrufv.supabase.co';

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, x-client-info',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request) {
    var url = new URL(request.url);
    var targetUrl = 'https://' + SUPABASE_HOST + url.pathname + url.search;

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // 构建转发请求的 headers
    var forwardHeaders = new Headers(request.headers);
    // 删除浏览器特有的 header，避免冲突
    forwardHeaders.delete('origin');
    forwardHeaders.delete('referer');
    forwardHeaders.delete('host');
    // 确保有 apikey（如果没有则使用 publishable key）
    if (!forwardHeaders.has('apikey')) {
      forwardHeaders.set('apikey', 'sb_publishable_wZDOWH6TwiEyPUNzgcWLhQ_HAZiPYZw');
    }

    var body = null;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      body = await request.clone().arrayBuffer();
    }

    try {
      var res = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: body,
        redirect: 'follow'
      });

      // 构造响应，添加 CORS headers
      var responseHeaders = new Headers(res.headers);
      Object.keys(CORS_HEADERS).forEach(function(k) {
        responseHeaders.set(k, CORS_HEADERS[k]);
      });

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders
      });
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'proxy_error',
        message: '代理请求失败: ' + e.message
      }), {
        status: 502,
        headers: Object.assign({
          'Content-Type': 'application/json'
        }, CORS_HEADERS)
      });
    }
  }
};
