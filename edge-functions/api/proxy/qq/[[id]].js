// Edge Function: QQ 音乐 API 代理
// 路由: /api/proxy/qq/*
// 转发到 https://u.y.qq.com/cgi-bin/musicu.fcg，附加 Referer + UA + CORS
// QQ 接口需要伪造 Referer: https://y.qq.com/ 才会返回数据
// 仅支持 POST（musicu.fcg 协议要求），10 分钟边缘缓存

const UPSTREAM = 'https://u.y.qq.com';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/proxy\/qq/, '') || '/cgi-bin/musicu.fcg';
  const targetUrl = `${UPSTREAM}${subPath}${url.search}`;

  // 仅允许 POST（musicu.fcg 协议要求）；GET 直接返回 405
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 处理 CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  // 简易缓存：以请求 body 哈希作为 cache key
  const bodyText = await request.text();
  const cacheKey = new Request(targetUrl + '#' + bodyText, { method: 'POST' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://y.qq.com/',
        'Origin': 'https://y.qq.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      body: bodyText,
    });

    const respBody = await upstream.arrayBuffer();
    const resp = new Response(respBody, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });

    if (upstream.ok) {
      context.waitUntil(cache.put(cacheKey, resp.clone()));
    }
    return resp;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'proxy error', message: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
