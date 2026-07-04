// Edge Functions 根入口
// 未匹配到具体路由的请求返回 404
export function onRequest() {
  return new Response('Not Found', { status: 404 });
}
