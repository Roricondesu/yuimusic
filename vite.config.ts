import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

/**
 * 自定义网易云 API 代理插件
 *
 * Vite 内置的 http-proxy 在当前沙箱环境下连接 music.163.com 会出现 ETIMEDOUT，
 * 而 Node 原生 fetch 可以正常访问。因此开发环境用原生 fetch 做代理转发。
 */
const neteaseProxyPlugin = (): Plugin => ({
  name: 'netease-proxy',
  configureServer(server) {
    const proxyApi = (prefix: string, baseUrl: string, referer?: string) => {
      server.middlewares.use(prefix, async (req, res) => {
        try {
          const targetPath = req.url?.replace(new RegExp(`^${prefix}`), '') || '';
          const targetUrl = `${baseUrl}${targetPath}`;

          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
          };
          if (referer) headers['Referer'] = referer;

          // 透传部分浏览器请求头
          const forwardHeaders = ['content-type', 'cookie'];
          for (const h of forwardHeaders) {
            const value = req.headers[h];
            if (value) headers[h] = Array.isArray(value) ? value[0] : value;
          }

          // 读取请求 body（POST/PUT 场景）。Node 18+ fetch 不接受 IncomingMessage，
          // 必须先 buffer 成 Buffer/String 再传
          let reqBody: Buffer | undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            if (chunks.length) reqBody = Buffer.concat(chunks);
          }

          const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: reqBody,
          });

          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            // 不要转发 content-encoding，避免双重压缩
            if (['content-encoding', 'content-length'].includes(key.toLowerCase())) return;
            res.setHeader(key, value);
          });

          const body = await response.arrayBuffer();
          res.end(Buffer.from(body));
        } catch (err) {
          console.error(`[${prefix}] proxy error:`, err);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'proxy error', message: String(err) }));
        }
      });
    };

    proxyApi('/netease-api', 'https://music.163.com', 'https://music.163.com/');
    proxyApi('/kugou-api', 'http://lyrics.kugou.com');
    proxyApi('/kugou-search', 'http://mobilecdn.kugou.com');
    // QQ 音乐 musicu.fcg 接口（POST，需要伪造 Referer）
    proxyApi('/api/proxy/qq', 'https://u.y.qq.com', 'https://y.qq.com/');
  },
});

// https://vite.dev/config/
export default defineConfig({
  base: '/yuimusic/',
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }),
    tsconfigPaths(),
    neteaseProxyPlugin(),
  ],
})
