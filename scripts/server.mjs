import { createServer } from 'node:http';
import { stat, readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const withinRoot = target => { const rel = relative(root, target); return !rel.startsWith('..') && !isAbsolute(rel); };

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  const segments = pathname.split(/[\\/]/);
  if (segments.some(segment => segment.startsWith('.') || segment === 'node_modules' || segment === 'docs' || segment === 'agents' || segment === 'scripts')) {
    response.writeHead(404); response.end('Not found'); return;
  }
  let target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!withinRoot(target)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    target = await realpath(target);
    if (!withinRoot(target) || !(await stat(target)).isFile()) throw new Error('Not a public file');
    const data = await readFile(target);
    response.writeHead(200, { 'Content-Type': mime[extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Страница не найдена'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Золотая Лоза: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(`Не удалось запустить сервер: ${error.message}`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
