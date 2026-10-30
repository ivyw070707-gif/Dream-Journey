import {createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {HttpError} from './files.js';

const scrypt = promisify(scryptCallback), digest = value => createHash('sha256').update(value).digest('hex');
const lifetime = 7 * 24 * 60 * 60;
const safeUser = ({id, name, email, role}) => ({id, name, email, role});
export function authStore(directory, env = {}) {
  const root = path.resolve(directory, 'accounts'), sessions = path.resolve(directory, 'sessions');
  const secure = env.NODE_ENV === 'production' || env.JOURNEY_COOKIE_SECURE === 'true';
  const sameSite = secure && env.JOURNEY_COOKIE_SAMESITE === 'none' ? 'None' : 'Lax';
  const cookieName = secure ? '__Host-journey-session' : 'journey-session';
  const cookie = (value, age = lifetime) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${age}${secure ? '; Secure' : ''}`;
  async function read(filename) { try { return JSON.parse(await readFile(filename, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
  function token(req) {
    const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  }
  async function current(req) {
    const value = token(req); if (!value) return null;
    const filename = path.join(sessions, `${digest(value)}.json`), session = await read(filename);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) { await rm(filename, {force: true}); return null; }
    if (!/^[a-f0-9]{64}$/.test(session.account)) return null;
    const account = await read(path.join(root, `${session.account}.json`));
    return account ? {user: safeUser(account), csrfToken: session.csrfToken, filename} : null;
  }
  async function issue(account, res, req) {
    const previous = await current(req); if (previous) await rm(previous.filename, {force: true});
    await mkdir(sessions, {recursive: true, mode: 0o700});
    const value = randomBytes(32).toString('base64url'), csrfToken = randomBytes(32).toString('base64url');
    await writeFile(path.join(sessions, `${digest(value)}.json`), JSON.stringify({account: digest(account.email), csrfToken, expiresAt: Date.now() + lifetime * 1000}), {flag: 'wx', mode: 0o600});
    res.setHeader('Set-Cookie', cookie(value));
    return {user: safeUser(account), role: account.role, csrfToken};
  }
  const attempts = new Map(); let hashing = 0;
  function limit(req) {
    const now = Date.now(), key = req.socket.remoteAddress || 'local';
    for (const [address, item] of attempts) if (item.until <= now) attempts.delete(address);
    const item = attempts.get(key) || {count: 0, until: now + 60000};
    item.count++; attempts.set(key, item);
    if (item.count > 20 || hashing >= 4) throw new HttpError(429, 'authRateLimit');
  }
  async function derive(password, salt) {
    hashing++;
    try { return await scrypt(password, salt, 64, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024}); }
    finally { hashing--; }
  }
  function credentials(body, registering = false) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalidEmail');
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) throw new HttpError(400, 'invalidPassword');
    if (registering && (!['donor', 'teacher'].includes(body.role) || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80)) throw new HttpError(400, 'invalidAccount');
    return {email, password: body.password};
  }
  function csrf(req, session) {
    const supplied = req.headers['x-csrf-token'];
    if (!session || typeof supplied !== 'string' || !timingSafeEqual(Buffer.from(digest(supplied)), Buffer.from(digest(session.csrfToken)))) throw new HttpError(403, 'invalidCSRF');
  }
  return {
    current,
    async register(req, res, body) {
      limit(req); const {email, password} = credentials(body, true);
      const salt = randomBytes(16).toString('hex');
      const hash = (await derive(password, salt)).toString('hex');
      const account = {id: randomUUID(), email, name: body.name.trim(), role: body.role, salt, passwordHash: hash, createdAt: new Date().toISOString()};
      await mkdir(root, {recursive: true, mode: 0o700});
      try { await writeFile(path.join(root, `${digest(email)}.json`), JSON.stringify(account), {flag: 'wx', mode: 0o600}); }
      catch (error) { if (error.code === 'EEXIST') throw new HttpError(409, 'emailExists'); throw error; }
      return issue(account, res, req);
    },
    async login(req, res, body) {
      limit(req); const {email, password} = credentials(body);
      const account = await read(path.join(root, `${digest(email)}.json`));
      const computed = await derive(password, account?.salt || '0'.repeat(32));
      if (!account || !timingSafeEqual(computed, Buffer.from(account.passwordHash, 'hex'))) throw new HttpError(401, 'invalidLogin');
      return issue(account, res, req);
    },
    async logout(req, res) {
      const session = await current(req);
      if (session) { csrf(req, session); await rm(session.filename, {force: true}); }
      res.setHeader('Set-Cookie', cookie('', 0)); return {user: null, role: 'visitor', csrfToken: null};
    },
    async requireTeacher(req) {
      const session = await current(req);
      if (!session) throw new HttpError(401, 'loginRequired');
      if (session.user.role !== 'teacher') throw new HttpError(403, 'teacherRequired');
      csrf(req, session); return session.user;
    }
  };
}
