// Edge Function: 酷狗歌词 API 代理（lyrics.kugou.com，/search /download）
// 路由: /api/proxy/kugou/*
// 转发到 http://lyrics.kugou.com，解决 CORS
// 边缘缓存 30 分钟（歌词内容稳定）

const UPSTREAM = 'http://lyrics.kugou.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/proxy\/kugou/, '') || '/';
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
        'Cache-Control': 'public, max-age=1800',
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
