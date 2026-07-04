// Edge Function: 酷狗搜索 API 代理（mobilecdn.kugou.com，/api/v3/search/song）
// 路由: /api/proxy/kugou-search/*
// 转发到 http://mobilecdn.kugou.com，解决 CORS
// 边缘缓存 10 分钟

const UPSTREAM = 'http://mobilecdn.kugou.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/proxy\/kugou-search/, '') || '/';
  const targetUrl = `${UPSTREAM}${subPath}${url.search}`;

  const cacheKey = new Request(targetUrl, { method: 'GET' });
  const cache = caches.default;
  if (request.method === 'GET') {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*' },
    });

    const body = await upstream.arrayBuffer();
    const resp = new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });

    if (request.method === 'GET' && upstream.ok) {
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
