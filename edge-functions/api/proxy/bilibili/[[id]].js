// Edge Function: Bilibili 音频区 API 代理
// 路由: /api/proxy/bilibili/*
// 转发到 https://api.bilibili.com 与 https://www.bilibili.com，附加正确的 UA/Referer，
// 解决浏览器 CORS 与 B 站防盗链/Origin 校验问题。
// 边缘缓存 5 分钟（搜索/流地址结果短期不变）

const UPSTREAM_API = 'https://api.bilibili.com';
const UPSTREAM_WWW = 'https://www.bilibili.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  // 提取 /api/proxy/bilibili 之后的路径与 query
  const subPath = url.pathname.replace(/^\/api\/proxy\/bilibili/, '') || '/';
  // /audio/* 走 www.bilibili.com，其它走 api.bilibili.com
  const upstream = subPath.startsWith('/audio') ? UPSTREAM_WWW : UPSTREAM_API;
  const targetUrl = `${upstream}${subPath}${url.search}`;

  // 边缘缓存键
  const cacheKey = new Request(targetUrl, { method: 'GET' });
  const cache = caches.default;
  if (request.method === 'GET') {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.bilibili.com/',
    'Origin': 'https://www.bilibili.com',
  };
  const cookie = request.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;

  try {
    const upstreamResp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    const body = await upstreamResp.arrayBuffer();
    const resp = new Response(body, {
      status: upstreamResp.status,
      headers: {
        'Content-Type': upstreamResp.headers.get('content-type') || 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });

    if (request.method === 'GET' && upstreamResp.ok) {
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
