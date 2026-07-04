// Edge Function: 网易云 API 代理
// 路由: /api/proxy/netease/*
// 转发到 https://music.163.com，附加正确的 UA/Referer，解决 CORS 与 Origin 校验问题
// 边缘缓存 10 分钟（歌词/搜索结果基本不变）

const UPSTREAM = 'https://music.163.com';
const REFERER = 'https://music.163.com/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequest(context) {
  const { request } = context;
  // 提取 /api/proxy/netease 之后的路径与 query
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/proxy\/netease/, '') || '/';
  const targetUrl = `${UPSTREAM}${subPath}${url.search}`;

  // 边缘缓存键：路径 + query（GET 请求才缓存）
  const cacheKey = new Request(targetUrl, { method: 'GET' });
  const cache = caches.default;
  if (request.method === 'GET') {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Referer': REFERER,
  };
  // 透传 cookie（如有）
  const cookie = request.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;

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
