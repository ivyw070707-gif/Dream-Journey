// Explicit live check: uses .env and an optional supplied archive; uses only temporary storage.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createJourneyServer} from '../server/index.js';
import {extension, isImage} from '../src/js/project-schema.js';

if (!process.env.DEEPSEEK_API_KEY) throw new Error('Configure DEEPSEEK_API_KEY in .env first.');
const directory = await mkdtemp(path.join(tmpdir(), 'dream-journey-live-test-'));
const providerStatuses = [];
const server = createJourneyServer({env: {...process.env, NODE_ENV: 'test', JOURNEY_COOKIE_SECURE: 'false', JOURNEY_DATA_DIR: directory}, fetchImpl: async (...args) => {
  const response = await fetch(...args); providerStatuses.push(response.status); return response;
}});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie, csrfToken;
  const post = (route, body) => fetch(`${base}${route}`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Journey-Request': '1', ...(cookie ? {Cookie: cookie, 'X-CSRF-Token': csrfToken} : {})}, body: JSON.stringify(body), signal: AbortSignal.timeout(180000)});
  assert.equal((await (await fetch(`${base}/api/auth/me`)).json()).role, 'visitor');
  assert.equal((await post('/api/projects', {})).status, 401);
  const signup = await post('/api/auth/register', {name: 'Temporary test teacher', email: `${randomUUID()}@example.test`, role: 'teacher', password: `Test-${randomUUID()}`});
  assert.equal(signup.status, 201); cookie = signup.headers.get('set-cookie').split(';')[0]; csrfToken = (await signup.json()).csrfToken;
  console.log('PASS visitor default and teacher account registration/session.');
  const file = async (filename, role = 'reference') => ({id: randomUUID(), name: filename instanceof URL ? path.basename(filename.pathname) : path.basename(filename), role, data: (await readFile(filename)).toString('base64')});
  let sources;
  if (process.argv[2]) {
    const uploaded = await file(path.resolve(process.argv[2]));
    if (extension(uploaded.name) === 'zip') {
      const expanded = await post('/api/files/expand', {files: [uploaded]});
      const result = await expanded.json(); assert.equal(expanded.status, 200, result.error);
      let cover = false;
      sources = result.files.map(item => ({...item, role: isImage(item) ? cover ? 'field' : (cover = true, 'cover') : 'reference'}));
      console.log(`PASS supplied ZIP expanded into ${sources.length} reviewable files.`);
    } else sources = [uploaded];
  } else sources = [
    {id: randomUUID(), name: 'project-facts.txt', role: 'reference', data: Buffer.from('项目名称：敦煌石窟研学\n目的地：敦煌\n年份：2026\n研究问题：壁画为何褪色？\n没有提供团队姓名或出发地。').toString('base64')},
    await file(new URL('../tests/fixtures/research-notes.docx', import.meta.url)), await file(new URL('../tests/fixtures/model.glb', import.meta.url), 'model')
  ];
  console.log('Running live DeepSeek analysis…');
  const analysis = await post('/api/agent/analyze', {files: sources});
  const draft = await analysis.json();
  if (!analysis.ok) throw new Error(`Analysis failed: ${draft.error}; provider HTTP status: ${providerStatuses.join(',') || 'not reached'}`);
  assert.ok(draft.project.title.zh && draft.project.title.en && draft.project.destination.zh);
  assert.ok(draft.evidence.length > 0);
  if (!process.argv[2]) { assert.ok(draft.project.title.zh.includes('敦煌')); assert.equal(draft.project.year, 2026); assert.equal(draft.project.studentName.zh, ''); }
  console.log(`PASS live ${draft.model} response: bilingual project fields and ${draft.evidence.length} source references.`);
  for (const suggested of draft.fileRoles || []) {
    const source = sources.find(item => item.id === suggested.id);
    if (source) { source.role = suggested.role; source.caption = suggested.caption; }
  }
  const result = await post('/api/projects', {idempotencyKey: randomUUID(), project: draft.project, files: sources});
  const published = await result.json(); assert.equal(result.status, 201, published.error);
  const mediaPath = published.project.model?.src || published.project.cover || published.project.fieldPhotos[0]?.src;
  assert.ok(mediaPath); assert.equal((await fetch(`${base}/${mediaPath}`)).status, 200);
  assert.equal((await (await fetch(`${base}/api/projects`)).json()).projects.length, 1);
  assert.equal((await post('/api/auth/logout', {})).status, 200);
  assert.equal((await post('/api/projects', {})).status, 401);
  console.log('PASS teacher publication, public media download, session logout and upload revocation in a temporary store.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(directory, {recursive: true, force: true});
}
