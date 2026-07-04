// Edge Function: Internet Archive API 代理
// 路由: /api/proxy/ia/*
// 转发到 https://archive.org，附加 UA，解决部分网络环境 CORS 与访问问题
// 边缘缓存 1 小时（公有领域资源元数据稳定）

const UPSTREAM = 'https://archive.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/proxy\/ia/, '') || '/';
  const targetUrl = `${UPSTREAM}${subPath}${url.search}`;

  const cacheKey = new Request(targetUrl, { method: 'GET' });
  const cache = caches.default;
  if (request.method === 'GET') {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
  };

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    const body = await upstream.arrayBuffer();
    const resp = new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=3600',
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
