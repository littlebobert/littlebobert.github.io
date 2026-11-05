// Runs the Worker on http://localhost:8787 against an in-memory database, for trying the site
// locally (signature-ink.js points localhost pages here). Turnstile always passes and every
// /admin request is treated as signed in, so never expose this port.
//
//   node test/local-server.mjs
//
// Then serve the site on http://localhost:8788 and open /sign, and /admin/live here.
import { createServer } from 'node:http';
import { handleRequest } from '../src/index.js';
import { createTestDatabase } from './sqlite-d1.js';

const PORT = 8787;
// 8788 for `python3 -m http.server 8788`, 8765 for the site's .claude/launch.json.
const SITE_ORIGINS = ['8788', '8765']
  .flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])
  .join(',');
const { d1 } = createTestDatabase();
const env = {
  ALLOWED_ORIGINS: SITE_ORIGINS,
  ALLOWED_ORIGIN_SUFFIXES: '',
  TURNSTILE_HOSTNAMES: 'localhost',
  TURNSTILE_SECRET: 'local',
  VISITOR_HASH_SALT: 'local',
  DB: d1,
};
const deps = {
  fetch: async () => Response.json({ success: true, hostname: 'localhost' }),
  verifyAccess: async () => ({ email: 'local@localhost' }),
};

createServer(async (incoming, outgoing) => {
  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${PORT}${incoming.url}`, {
    method: incoming.method,
    headers: { ...incoming.headers, 'CF-Connecting-IP': '127.0.0.1' },
    body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : body,
  });
  const response = await handleRequest(request, env, deps);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
  console.log(incoming.method, incoming.url, response.status);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`portfolio-backend (local, in-memory) on http://localhost:${PORT}`);
});
