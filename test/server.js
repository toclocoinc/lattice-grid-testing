// Static file server for the contract-test fixture pages. Serves the package
// root, so a fixture page imports the published grid from
// /node_modules/@toclocoinc/lattice-grid/ and the built helpers from /dist/.
// Bound to 127.0.0.1: the grid shows no trial watermark on loopback hosts.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Starts the fixture server.
 * @param {number} [port] Port to listen on; 0 picks a free one.
 * @returns {Promise<{ url: string, close: () => Promise<void> }>} The base URL and a stop function.
 */
export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(ROOT, path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => {
      done({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((closed) => server.close(() => closed())),
      });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startServer(Number(process.env.PORT || 4791));
  console.log(`fixtures on ${url}/test/fixtures/`);
}
