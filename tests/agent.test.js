import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createJourneyServer} from '../server/index.js';
import {validateFiles, extractSources} from '../server/files.js';
import {emptyDraft} from '../src/js/project-schema.js';
import {getProjects} from '../src/js/data.js';

const admin = 'test-only-admin-password';
const textFile = (name = 'journey.txt') => ({id: randomUUID(), name, role: 'reference', data: Buffer.from('项目名称：敦煌石窟研学\n目的地：敦煌\n研究问题：壁画为何褪色？\n年份：2026').toString('base64')});
const project = () => ({...emptyDraft(), title: {zh: '敦煌石窟研学', en: 'Dunhuang study'}, destination: {zh: '敦煌', en: 'Dunhuang'}});
async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dream-journey-test-'));
  const env = {JOURNEY_DATA_DIR: directory, JOURNEY_ADMIN_TOKEN: admin, DEEPSEEK_API_KEY: 'test-key', ...options.env};
  const server = createJourneyServer({...options, env});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, {recursive: true, force: true}); });
  const registration = await fetch(`${base}/api/auth/register`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Journey-Request': '1'}, body: JSON.stringify({name: 'Test teacher', email: `${randomUUID()}@example.test`, password: 'test-account-password', role: 'teacher'})});
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0], session = await registration.json();
  return {server, directory, base, env, cookie, csrfToken: session.csrfToken, user: session.user, async post(route, body, token = admin) {
    return fetch(`${base}${route}`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Journey-Request': '1', ...(token === admin ? {Cookie: cookie, 'X-CSRF-Token': session.csrfToken} : {Authorization: `Bearer ${token}`})}, body: JSON.stringify(body)});
  }};
}

test('public reads do not need a password, all writes and analysis do', async t => {
  let calls = 0;
  const f = await fixture(t, {fetchImpl: async () => { calls++; throw new Error(); }});
  assert.deepEqual(await (await fetch(`${f.base}/api/projects`)).json(), {projects: []});
  for (const route of ['/api/projects', '/api/agent/analyze']) {
    const response = await f.post(route, {project: project(), files: [textFile()]}, 'wrong');
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {error: 'loginRequired'});
  }
  assert.equal(calls, 0);
  for (const route of ['/.env', '/server/agent.js', '/storage/projects', '/package.json', '/src/..%2fserver/agent.js', '/src/%2e%2e%2f.env', '/src/%2e%2e%2f.git/config']) assert.equal((await fetch(`${f.base}${route}`)).status, 404, route);
  const html = await (await fetch(f.base)).text();
  assert.ok(html.includes('id="new-project"'));
  assert.ok(!html.includes('test-key') && !html.includes(admin));
});

test('missing configuration disables analysis honestly and never returns credentials', async t => {
  const f = await fixture(t, {env: {JOURNEY_ADMIN_TOKEN: '', DEEPSEEK_API_KEY: ''}});
  const response = await (await fetch(`${f.base}/api/agent/status`)).json();
  assert.deepEqual(response, {publishing: false, analysis: false, role: 'visitor', provider: 'DeepSeek', model: 'deepseek-flash'});
  assert.equal((await f.post('/api/projects', {})).status, 400);
  f.env.JOURNEY_ADMIN_TOKEN = admin;
  assert.equal((await f.post('/api/agent/analyze', {files: [textFile()]})).status, 503);
});

test('DeepSeek receives actual document text and images, valid JSON fills the existing schema', async t => {
  let request;
  const file = textFile();
  const cover = {id: randomUUID(), name: 'cover.png', role: 'cover', data: (await readFile(new URL('../assets/images/journeys/dunhuang.png', import.meta.url))).toString('base64')};
  const f = await fixture(t, {fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    request = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    return Response.json({choices: [{finish_reason: 'stop', message: {content: JSON.stringify({project: {...project(), researchQuestion: {zh: '壁画为何褪色？', en: 'Why do murals fade?'}}, fileRoles: [{id: cover.id, role: 'cover'}], evidence: [{field: 'researchQuestion', source: file.id, quote: '壁画为何褪色？'}, {field: 'title', source: 'fake-file', quote: 'Fake'}], warnings: []})}}]});
  }});
  const response = await f.post('/api/agent/analyze', {files: [file, cover]});
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(request.model, 'deepseek-flash');
  assert.deepEqual(request.response_format, {type: 'json_object'});
  assert.ok(request.messages[1].content.some(part => part.type === 'text' && part.text.includes('壁画为何褪色')));
  assert.ok(request.messages[1].content.some(part => part.type === 'image_url' && part.image_url.url.startsWith('data:image/png;base64,')));
  assert.equal(result.project.researchQuestion.zh, '壁画为何褪色？');
  assert.equal(result.project.studentName.zh, '');
  assert.equal(result.project.destinationCoords, null);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.project.researchNotes.length, 13);
});

test('a failed, empty, or truncated DeepSeek reply cannot create a project', async t => {
  for (const choice of [{finish_reason: 'length', message: {content: '{}'}}, {finish_reason: 'stop', message: {content: ''}}, {finish_reason: 'stop', message: {content: '{invalid'}}]) {
    const f = await fixture(t, {fetchImpl: async () => Response.json({choices: [choice]})});
    const response = await f.post('/api/agent/analyze', {files: [textFile()]});
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {error: 'invalidAgentResponse'});
    assert.deepEqual(await (await fetch(`${f.base}/api/projects`)).json(), {projects: []});
  }
});

test('published projects survive a new server instance, public media work, references stay private, and retries do not duplicate', async t => {
  const f = await fixture(t);
  const cover = {id: randomUUID(), name: 'cover.png', role: 'cover', data: (await readFile(new URL('../assets/images/journeys/tulou.png', import.meta.url))).toString('base64')};
  const report = {...textFile('report.md'), role: 'report'};
  const reference = textFile();
  const body = {idempotencyKey: randomUUID(), project: project(), files: [cover, report, reference]};
  const responses = await Promise.all([f.post('/api/projects', body), f.post('/api/projects', body)]);
  assert.ok(responses.every(response => response.status === 201));
  const records = await Promise.all(responses.map(response => response.json()));
  assert.equal(records[0].project.id, records[1].project.id);
  const published = records[0].project;
  assert.equal(published.destinationCoords, null);
  assert.equal((await readdir(path.join(f.directory, 'projects', body.idempotencyKey, 'media'))).length, 2);
  const media = await fetch(`${f.base}/${published.cover}`);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/png');
  assert.ok(Buffer.from(await media.arrayBuffer()).equals(Buffer.from(cover.data, 'base64')));
  const download = await fetch(`${f.base}/${published.finalOutcomes[0].src}`);
  assert.equal(download.headers.get('content-disposition'), 'attachment');
  assert.ok((await download.text()).includes('敦煌'));
  assert.equal((await fetch(`${f.base}/uploads/${body.idempotencyKey}/${reference.id}.txt`)).status, 404);
  const restarted = createJourneyServer({env: f.env});
  await new Promise(resolve => restarted.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => restarted.close(resolve)));
  const publicList = await (await fetch(`http://127.0.0.1:${restarted.address().port}/api/projects`)).json();
  assert.equal(publicList.projects.length, 1);
  assert.equal(publicList.projects[0].id, published.id);
  assert.equal(getProjects('en', publicList.projects).at(-1).title, 'Dunhuang study');
});

test('invalid or unsafe uploads and invalid coordinates are rejected before publication', async t => {
  const f = await fixture(t);
  const badFiles = [{...textFile(), name: 'danger.html'}, {...textFile(), name: 'fake.png'}, {...textFile(), data: 'not base64!'}, {...textFile(), role: 'cover'}];
  for (const file of badFiles) {
    const response = await f.post('/api/projects', {idempotencyKey: randomUUID(), project: project(), files: [file]});
    assert.equal(response.status, 400);
  }
  const response = await f.post('/api/projects', {idempotencyKey: '../../escape', project: project(), files: []});
  assert.equal(response.status, 400);
  const invalid = await f.post('/api/projects', {idempotencyKey: randomUUID(), project: {...project(), destinationCoords: {lat: 0, lng: 0}}, files: []});
  assert.equal(invalid.status, 400);
  assert.deepEqual(await (await fetch(`${f.base}/api/projects`)).json(), {projects: []});
});

test('cross-origin publication is restricted to configured frontend origins', async t => {
  const f = await fixture(t, {env: {JOURNEY_ALLOWED_ORIGINS: 'https://example.github.io'}});
  const denied = await fetch(`${f.base}/api/projects`, {headers: {Origin: 'https://other.example'}});
  assert.equal(denied.status, 403);
  const allowed = await fetch(`${f.base}/api/projects`, {headers: {Origin: 'https://example.github.io'}});
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://example.github.io');
});

test('real PDF and DOCX documents are read, scanned PDF pages are sent as images', async () => {
  const source = async name => ({id: randomUUID(), name, role: 'reference', data: (await readFile(new URL(`fixtures/${name}`, import.meta.url))).toString('base64')});
  const files = validateFiles(await Promise.all(['research-text.pdf', 'research-notes.docx', 'scanned-page.pdf'].map(source)));
  const result = await extractSources(files);
  assert.ok(result.content.some(part => part.type === 'text' && part.text.includes('Why do murals fade?')));
  assert.ok(result.content.some(part => part.type === 'text' && part.text.includes('壁画为何褪色')));
  assert.ok(result.content.some(part => part.type === 'image_url' && part.image_url.url.startsWith('data:image/png;base64,')));
  assert.ok(result.warnings.some(warning => warning.includes('embedded images')));
});

test('optional GLB models persist, are public, and stay out of DeepSeek requests', async t => {
  let request;
  const f = await fixture(t, {fetchImpl: async (url, init) => {
    request = JSON.parse(init.body);
    return Response.json({choices: [{finish_reason: 'stop', message: {content: JSON.stringify({project: project(), fileRoles: [], evidence: [], warnings: []})}}]});
  }});
  const bytes = await readFile(new URL('fixtures/model.glb', import.meta.url));
  const model = {id: randomUUID(), name: 'project.glb', role: 'model', data: bytes.toString('base64'), caption: {zh: '三维作品', en: '3D artifact'}};
  assert.equal((await f.post('/api/agent/analyze', {files: [textFile(), model]})).status, 200);
  assert.ok(!JSON.stringify(request).includes('project.glb') && !JSON.stringify(request).includes(model.data));
  const response = await f.post('/api/projects', {idempotencyKey: randomUUID(), project: project(), files: [model]});
  assert.equal(response.status, 201);
  const saved = (await response.json()).project;
  assert.equal(saved.model.name, 'project.glb');
  assert.equal(saved.model.caption.zh, '三维作品');
  assert.deepEqual(saved.finalOutcomes, [null, null, null]);
  const download = await fetch(`${f.base}/${saved.model.src}`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'model/gltf-binary');
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(bytes));
  const invalid = await f.post('/api/projects', {idempotencyKey: randomUUID(), project: project(), files: [{...model, data: Buffer.from('fake model').toString('base64')}]});
  assert.equal(invalid.status, 400);
  const duplicate = await f.post('/api/projects', {idempotencyKey: randomUUID(), project: project(), files: [model, {...model, id: randomUUID()}]});
  assert.equal(duplicate.status, 400);
  assert.equal((await (await fetch(`${f.base}/api/projects`)).json()).projects.length, 1);
});
