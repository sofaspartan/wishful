import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Serves `/api/*` from the same handler the Netlify Function uses, so
 * `npm run dev` runs the whole stack in one process (with a local file store).
 */
function apiDevServer(): Plugin {
  let devServer: ViteDevServer | null = null;
  return {
    name: 'wishful-api-dev',
    // Mirrors netlify/edge-functions/share-meta.ts so link-preview tags can be checked locally.
    async transformIndexHtml(html, ctx) {
      if (!devServer || !ctx.originalUrl) return html;
      const server = devServer;
      const { brand } = (await server.ssrLoadModule('/src/config/brand.ts')) as typeof import('./src/config/brand');
      const { injectMeta, pageMeta } = (await server.ssrLoadModule('/shared/shareMeta.ts')) as typeof import('./shared/shareMeta');
      const { handleRequest } = (await server.ssrLoadModule('/server/app.ts')) as typeof import('./server/app');
      const origin = `http://localhost:${server.config.server.port ?? 5174}`;
      const getJson = async (apiPath: string) => {
        const res = await handleRequest(new Request(origin + apiPath));
        return res.ok ? res.json() : null;
      };
      const meta = await pageMeta(new URL(ctx.originalUrl, origin).pathname, origin, brand, getJson);
      return injectMeta(html, meta, brand.name);
    },
    configureServer(server: ViteDevServer) {
      devServer = server;
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const og = req.url?.startsWith('/og/');
        if (!req.url?.startsWith('/api/') && !og) return next();
        try {
          const handleRequest = og
            ? ((await server.ssrLoadModule('/server/og/index.tsx')) as typeof import('./server/og')).handleOgRequest
            : ((await server.ssrLoadModule('/server/app.ts')) as typeof import('./server/app')).handleRequest;
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
            else if (v !== undefined) headers.set(k, v);
          }
          const url = `http://${req.headers.host ?? 'localhost'}${req.url}`;
          const request = new Request(url, {
            method: req.method,
            headers,
            body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
          });
          const response = await handleRequest(request, { ip: req.socket.remoteAddress ?? '127.0.0.1' });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            if (key === 'set-cookie') return;
            res.setHeader(key, value);
          });
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { message: 'Dev server error', code: 'internal' } }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env values available to the API handler during development.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
  return {
    plugins: [react(), apiDevServer()],
    // 5174 — 5173 is often taken by other local Vite apps on this machine.
    server: { port: 5174, strictPort: false },
    build: { sourcemap: true, chunkSizeWarningLimit: 800 },
  };
});
