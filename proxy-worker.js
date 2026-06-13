export default {
  async fetch(request) {
    var SUPABASE_HOST = 'clwqwidwjgharpefrufv.supabase.co';
    var url = new URL(request.url);
    var targetUrl = 'https://' + SUPABASE_HOST + url.pathname + url.search;

    // CORS headers
    var cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'apikey,authorization,content-type,prefer,x-client-info',
      'Access-Control-Max-Age': '86400'
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Build forwarding headers
    var fwd = new Headers();
    request.headers.forEach(function(v, k) {
      var lk = k.toLowerCase();
      if (lk !== 'origin' && lk !== 'referer' && lk !== 'host') {
        fwd.append(k, v);
      }
    });
    if (!fwd.has('apikey')) {
      fwd.set('apikey', 'sb_publishable_wZDOWH6TwiEyPUNzgcWLhQ_HAZiPYZw');
    }

    // Forward body
    var body = null;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      body = await request.arrayBuffer();
    }

    try {
      var res = await fetch(targetUrl, {
        method: request.method,
        headers: fwd,
        body: body,
        redirect: 'follow'
      });

      // Copy response with CORS headers
      var out = new Headers();
      out.set('Access-Control-Allow-Origin', '*');
      res.headers.forEach(function(v, k) { out.set(k, v); });

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: out
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'proxy_error', message: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
