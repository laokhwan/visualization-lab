// Local preview server only. The published application has no backend.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
export function createPreviewServer() {
  return createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      // A project prefix lets tests detect root-absolute asset URLs before Pages deployment.
      if (pathname.startsWith('/visualization-lab/')) pathname = pathname.slice('/visualization-lab'.length);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(root, '.' + pathname);
      if (!file.startsWith(root + sep) || pathname.split('/').some(part => part.startsWith('.') || part === 'node_modules')) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createPreviewServer().listen(port, '127.0.0.1', () => console.log(`Visualization Lab: http://127.0.0.1:${port}/visualization-lab/`));
}
