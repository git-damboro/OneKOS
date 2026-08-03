import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApiHandler, createOneKosRuntime } from './src/api-router.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = path.join(ROOT, 'public');
const SOURCE_ROOT = path.join(ROOT, 'src');

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  if (pathname.includes('..') || pathname.includes('\\')) return { forbidden: true };
  if (pathname === '/') return { filePath: path.join(PUBLIC_ROOT, 'index.html') };
  if (pathname.startsWith('/src/')) {
    return { filePath: path.join(SOURCE_ROOT, pathname.slice('/src/'.length)) };
  }
  return { filePath: path.join(PUBLIC_ROOT, pathname.slice(1)) };
}
export function createAppServer(options = {}) {
  const runtime = options.service
    ? { service: options.service, runtimeStatus: options.runtimeStatus || { mode: 'simulation', simulation: true, warnings: [] } }
    : createOneKosRuntime({ env: options.env, fetchImpl: options.fetchImpl });
  const handleApiRequest = createApiHandler(runtime);
  return http.createServer(async (request, response) => {
    try {
      if (await handleApiRequest(request, response)) return;
      const resolved = resolveRequestPath(request.url ?? '/');
      if (resolved.forbidden) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }

      const info = await stat(resolved.filePath);
      if (!info.isFile()) throw new Error('Not a file');
      const body = await readFile(resolved.filePath);
      const contentType = MIME_TYPES.get(path.extname(resolved.filePath).toLowerCase()) ?? 'application/octet-stream';
      response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
    }
  });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryPath === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
  const runtime = createOneKosRuntime();
  const server = createAppServer({ service: runtime.service, runtimeStatus: runtime.runtimeStatus });
  const port = runtime.config.port;
  server.listen(port, '127.0.0.1', () => {
    console.log(`OneKOS MVP running at http://127.0.0.1:${port}`);
    console.log(`Runtime mode: ${runtime.runtimeStatus.mode}`);
    for (const warning of runtime.runtimeStatus.warnings) console.log(`Warning: ${warning}`);
  });
}
