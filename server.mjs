import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
export function createAppServer() {
  return http.createServer(async (request, response) => {
    try {
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
  const server = createAppServer();
  const port = Number(process.env.PORT) || 4173;
  server.listen(port, '127.0.0.1', () => {
    console.log(`OneKOS MVP running at http://127.0.0.1:${port}`);
  });
}
