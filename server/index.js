import {createServer} from 'node:http';
import {createHash, timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {analyzeProject} from './agent.js';
import {HttpError, mimeType, validateFiles} from './files.js';
import {projectStore} from './store.js';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest();
export function createJourneyServer({env = process.env, fetchImpl = fetch, extract} = {}) {
  const store = projectStore(env.JOURNEY_DATA_DIR || path.join(sourceRoot, 'storage'));
  const allowedOrigins = new Set((env.JOURNEY_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  let analyzing = 0;
  const json = (res, status, value) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(value)); };
  function authenticate(req) {
    if (!env.JOURNEY_ADMIN_TOKEN) throw new HttpError(503, 'adminNotConfigured');
    if (!timingSafeEqual(hash(req.headers.authorization || ''), hash(`Bearer ${env.JOURNEY_ADMIN_TOKEN}`))) throw new HttpError(401, 'unauthorized');
  }
  async function readJSON(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'invalidRequest');
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 29 * 1024 * 1024) throw new HttpError(413, 'fileSize');
      chunks.push(chunk);
    }
    try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
    catch { throw new HttpError(400, 'invalidRequest'); }
  }
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = decodeURIComponent(url.pathname);
      if (route.includes('\\') || route.split('/').some(part => part.startsWith('.'))) throw new HttpError(404, 'notFound');
      const origin = req.headers.origin;
      if (origin) {
        let sameHost = false;
        try { sameHost = new URL(origin).host === req.headers.host; } catch { /* Invalid origins are rejected. */ }
        if (!sameHost && !allowedOrigins.has(origin)) throw new HttpError(403, 'originNotAllowed');
        res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (route === '/api/agent/status' && req.method === 'GET') {
        json(res, 200, {publishing: Boolean(env.JOURNEY_ADMIN_TOKEN), analysis: Boolean(env.JOURNEY_ADMIN_TOKEN && env.DEEPSEEK_API_KEY), provider: 'DeepSeek', model: env.DEEPSEEK_MODEL || 'deepseek-flash'}); return;
      }
      if (route === '/api/projects' && req.method === 'GET') { json(res, 200, {projects: await store.list()}); return; }
      if (route === '/api/agent/analyze' && req.method === 'POST') {
        authenticate(req);
        if (!env.DEEPSEEK_API_KEY) throw new HttpError(503, 'agentNotConfigured');
        if (analyzing >= 2) throw new HttpError(429, 'agentBusy');
        analyzing++;
        try {
          const body = await readJSON(req), files = validateFiles(body.files);
          if (!files.length) throw new HttpError(400, 'emptyFiles');
          const result = await analyzeProject({files, notes: body.notes, apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || 'deepseek-flash', fetchImpl, extract});
          json(res, 200, result);
        } finally { analyzing--; }
        return;
      }
      if (route === '/api/projects' && req.method === 'POST') {
        authenticate(req);
        const body = await readJSON(req), files = validateFiles(body.files || []);
        json(res, 201, {project: await store.publish(body, files)}); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'methodNotAllowed');
      if (route.startsWith('/api/')) throw new HttpError(404, 'notFound');
      if (route.startsWith('/uploads/')) {
        const parts = route.split('/');
        if (parts.length !== 4) throw new HttpError(404, 'notFound');
        const data = await store.media(parts[2], parts[3]);
        const ext = parts[3].split('.').pop();
        res.setHeader('Content-Type', mimeType(ext));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) res.setHeader('Content-Disposition', 'attachment');
        res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : data); return;
      }
      if (!(route === '/' || route === '/index.html' || /^\/(src|assets|vendor)\//.test(route) || (env.NODE_ENV !== 'production' && route.startsWith('/tests/')))) throw new HttpError(404, 'notFound');
      const filename = path.resolve(sourceRoot, `.${route === '/' ? '/index.html' : route}`);
      if (!filename.startsWith(sourceRoot) || route.includes('\\')) throw new HttpError(404, 'notFound');
      let data;
      try { data = await readFile(filename); } catch { throw new HttpError(404, 'notFound'); }
      const ext = path.extname(filename);
      res.setHeader('Content-Type', {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml'}[ext] || mimeType(ext.slice(1)));
      res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      json(res, error.status || 500, {error: error.code && error.status ? error.code : 'serverError'});
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = createJourneyServer();
  server.requestTimeout = 180000;
  server.listen(Number(process.env.PORT) || 8000, process.env.HOST || '127.0.0.1', () => console.log(`Dream Journey: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`));
}
