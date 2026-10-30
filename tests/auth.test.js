import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createJourneyServer} from '../server/index.js';

async function fixture(t, env = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'journey-auth-test-'));
  const server = createJourneyServer({env: {JOURNEY_DATA_DIR: directory, ...env}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()), 'Cleanup must stay inside the temporary directory'); await rm(directory, {recursive: true, force: true}); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body = {}, session = {}, headers = {}) => fetch(`${base}${route}`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Journey-Request': '1', ...(session.cookie ? {Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken} : {}), ...headers}, body: JSON.stringify(body)});
  const register = async (role, email = `${randomUUID()}@example.test`) => {
    const response = await post('/api/auth/register', {name: 'Test account', email, role, password: 'test-password-123'});
    const result = await response.json();
    return {...result, status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], fullCookie: response.headers.get('set-cookie')};
  };
  return {base, directory, server, post, register};
}
test('anonymous users are visitors; donor and visitor cannot upload, analyze, or publish', async t => {
  const f = await fixture(t, {JOURNEY_ADMIN_TOKEN: 'old-admin-token', DEEPSEEK_API_KEY: 'test-key'});
  assert.deepEqual(await (await fetch(`${f.base}/api/auth/me`)).json(), {user: null, role: 'visitor', csrfToken: null});
  const donor = await f.register('donor'); assert.equal(donor.user.role, 'donor');
  for (const route of ['/api/files/expand', '/api/agent/analyze', '/api/projects']) {
    assert.equal((await f.post(route)).status, 401);
    assert.equal((await f.post(route, {}, donor)).status, 403);
    assert.equal((await f.post(route, {}, {}, {Authorization: 'Bearer old-admin-token'})).status, 401);
    assert.equal((await f.post(route, {role: 'teacher'}, donor)).status, 403);
  }
  assert.equal((await fetch(`${f.base}/api/projects`)).status, 200);
});
test('registration hashes passwords, uses HttpOnly sessions and rejects duplicate or visitor accounts', async t => {
  const f = await fixture(t), email = 'teacher@example.test';
  const teacher = await f.register('teacher', email); assert.equal(teacher.status, 201);
  assert.ok(teacher.fullCookie.includes('HttpOnly') && teacher.fullCookie.includes('SameSite=Lax'));
  assert.ok(!('passwordHash' in teacher.user) && !('salt' in teacher.user));
  const files = await readdir(path.join(f.directory, 'accounts'));
  const account = JSON.parse(await readFile(path.join(f.directory, 'accounts', files[0]), 'utf8'));
  assert.equal(account.passwordHash.length, 128); assert.notEqual(account.passwordHash, 'test-password-123');
  assert.equal((await f.register('teacher', email)).status, 409);
  assert.equal((await f.register('visitor')).status, 400);
  const me = await (await fetch(`${f.base}/api/auth/me`, {headers: {Cookie: teacher.cookie}})).json();
  assert.equal(me.role, 'teacher'); assert.equal(me.user.id, teacher.user.id);
  const denied = await f.post('/api/projects', {}, teacher, {'X-CSRF-Token': 'wrong'}); assert.equal(denied.status, 403);
});
test('login retains stored role, logout revokes the session, and old session cookies cannot be replayed', async t => {
  const f = await fixture(t); const donor = await f.register('donor', 'donor@example.test');
  const wrong = await f.post('/api/auth/login', {email: 'donor@example.test', password: 'wrong-password'}); assert.equal(wrong.status, 401);
  const response = await f.post('/api/auth/login', {email: 'donor@example.test', password: 'test-password-123', role: 'teacher'}, donor);
  assert.equal(response.status, 200); const logged = await response.json(); assert.equal(logged.user.role, 'donor');
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.notEqual(cookie, donor.cookie);
  assert.equal((await (await fetch(`${f.base}/api/auth/me`, {headers: {Cookie: donor.cookie}})).json()).role, 'visitor');
  assert.equal((await f.post('/api/auth/logout', {}, {cookie, csrfToken: logged.csrfToken})).status, 200);
  assert.equal((await (await fetch(`${f.base}/api/auth/me`, {headers: {Cookie: cookie}})).json()).role, 'visitor');
});
test('production cookies are secure and state-changing account requests need the application header', async t => {
  const f = await fixture(t, {NODE_ENV: 'production'}), teacher = await f.register('teacher');
  assert.ok(teacher.fullCookie.startsWith('__Host-journey-session=') && teacher.fullCookie.includes('; Secure'));
  const rejected = await fetch(`${f.base}/api/auth/register`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({})});
  assert.equal(rejected.status, 403);
});

test('accounts and sessions survive a new server instance and can sign in again', async t => {
  const f = await fixture(t), email='persistent-teacher@example.test';
  const teacher=await f.register('teacher',email);
  const restarted=createJourneyServer({env:{JOURNEY_DATA_DIR:f.directory}});
  await new Promise(resolve=>restarted.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>restarted.close(resolve)));
  const base=`http://127.0.0.1:${restarted.address().port}`;
  const saved=await (await fetch(`${base}/api/auth/me`,{headers:{Cookie:teacher.cookie}})).json();
  assert.equal(saved.user.id,teacher.user.id);assert.equal(saved.role,'teacher');
  const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json','X-Journey-Request':'1'},body:JSON.stringify({email,password:'test-password-123'})});
  assert.equal(login.status,200);assert.equal((await login.json()).user.id,teacher.user.id);
});
