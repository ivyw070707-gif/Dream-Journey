import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createJourneyServer} from '../server/index.js';
import {projectStore} from '../server/store.js';
import {expandSources, validateFiles} from '../server/files.js';
import {emptyDraft} from '../src/js/project-schema.js';
import {getProjects, getStages} from '../src/js/data.js';
import {translate} from '../src/js/i18n.js';
import {renderProjectMarkup} from '../src/js/project-view.js';

const draft = () => ({...emptyDraft(), title: {zh: '伞下江南：我的苏州研学规划时间线', en: 'Suzhou umbrella study'}, destination: {zh: '苏州', en: 'Suzhou'}});
const archive = async () => ({id: randomUUID(), name: '苏州.zip', role: 'reference', data: (await readFile(new URL('fixtures/suzhou-import.zip', import.meta.url))).toString('base64')});
const render = project => renderProjectMarkup(project, {t: key => translate(key, 'zh'), stages: getStages('zh'), index: 1, language: 'zh'});

async function temporaryStore(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dream-journey-suzhou-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return {directory, store: projectStore(directory)};
}

test('Suzhou ZIP creates the second poster with its umbrella model; the original journey remains model-free', async t => {
  const initial = getProjects('zh').filter(project => project.destination === '苏州');
  assert.equal(initial.length, 1);
  assert.equal(initial[0].title, '苏州研学之旅');
  assert.equal(initial[0].model, null);
  assert.doesNotMatch(render(initial[0]), /model-viewer/);

  const {directory} = await temporaryStore(t);
  let uploaded;
  const server = createJourneyServer({
    env: {JOURNEY_DATA_DIR: directory, DEEPSEEK_API_KEY: 'test-key'},
    fetchImpl: async () => {
      const umbrella = uploaded.find(file => file.name.endsWith('/制作伞.jpeg'));
      const poster = uploaded.find(file => file.name.endsWith('/苏州 手抄报.jpeg'));
      return Response.json({choices: [{finish_reason: 'stop', message: {content: JSON.stringify({
        project: {...draft(), destination: {zh: '江苏苏州', en: 'Suzhou, Jiangsu'}},
        // Simulate the AI selecting the other image: the supplied craft photo is the demo cover.
        fileRoles: [
          {id: umbrella.id, role: 'field', caption: {zh: '绘制油纸伞', en: 'Painting the umbrella'}},
          {id: poster.id, role: 'cover', caption: {zh: '苏州手抄报', en: 'Suzhou poster'}}
        ], evidence: [], warnings: []
      })}}]});
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {'Content-Type': 'application/json', 'X-Journey-Request': '1'};
  const registration = await fetch(`${base}/api/auth/register`, {method: 'POST', headers, body: JSON.stringify({name: 'Demo teacher', email: `${randomUUID()}@example.test`, password: 'test-account-password', role: 'teacher'})});
  assert.equal(registration.status, 201);
  headers.Cookie = registration.headers.get('set-cookie').split(';')[0];
  headers['X-CSRF-Token'] = (await registration.json()).csrfToken;
  const post = async (route, body) => {
    const response = await fetch(`${base}${route}`, {method: 'POST', headers, body: JSON.stringify(body)});
    assert.ok(response.ok, `${route}: ${response.status}`);
    return response.json();
  };

  uploaded = (await post('/api/files/expand', {files: [await archive()]})).files;
  assert.equal(uploaded.length, 3);
  assert.ok(uploaded.some(file => file.name.endsWith('.docx')));
  const analysis = await post('/api/agent/analyze', {files: uploaded});
  const umbrella = uploaded.find(file => file.name.endsWith('/制作伞.jpeg'));
  const poster = uploaded.find(file => file.name.endsWith('/苏州 手抄报.jpeg'));
  assert.deepEqual(analysis.fileRoles.filter(file => file.role === 'cover').map(file => file.id), [umbrella.id]);
  assert.equal(analysis.fileRoles.find(file => file.id === poster.id).role, 'field');
  assert.equal(analysis.fileRoles.find(file => file.id === poster.id).caption.zh, '苏州手抄报');
  const files = uploaded.map(file => ({...file, ...(analysis.fileRoles.find(role => role.id === file.id) || {role: 'reference'})}));
  const published = (await post('/api/projects', {idempotencyKey: randomUUID(), project: analysis.project, files})).project;
  assert.ok(published.cover.endsWith(`${umbrella.id}.jpeg`));
  assert.equal(published.model.src, 'assets/models/suzhou-umbrella.glb');
  assert.deepEqual(published.destinationCoords, initial[0].destinationCoords);
  assert.equal(published.destination.zh, '江苏苏州');
  assert.equal((await fetch(`${base}/${published.model.src}`)).status, 200);
  assert.equal((await projectStore(directory).list())[0].model.src, published.model.src);

  const suzhou = getProjects('zh', [published]).filter(project => project.id === 'suzhou' || project.id === published.id);
  assert.deepEqual(suzhou.map(project => project.id), ['suzhou', published.id]);
  assert.doesNotMatch(render(suzhou[0]), /model-viewer/);
  assert.match(render(suzhou[1]), /data-model-src="assets\/models\/suzhou-umbrella\.glb"/);
});

test('Suzhou titles, filenames, and reference-only umbrella images do not attach a model', async t => {
  const {store} = await temporaryStore(t);
  const files = (await expandSources(validateFiles([await archive()]))).files;
  const umbrella = files.find(file => file.name.endsWith('/制作伞.jpeg'));
  const poster = files.find(file => file.name.endsWith('/苏州 手抄报.jpeg'));
  const unrelated = {...poster, name: '制作伞.jpeg', role: 'cover'};
  const first = await store.publish({idempotencyKey: randomUUID(), project: draft(), ownerId: 'test'}, [unrelated]);
  assert.equal(first.model, null);
  const second = await store.publish({idempotencyKey: randomUUID(), project: draft(), ownerId: 'test'}, [unrelated, {...umbrella, role: 'reference'}]);
  assert.equal(second.model, null);
});

test('an explicitly uploaded GLB takes precedence over the imported umbrella association', async t => {
  const {store} = await temporaryStore(t);
  const files = (await expandSources(validateFiles([await archive()]))).files;
  const umbrella = {...files.find(file => file.name.endsWith('/制作伞.jpeg')), role: 'cover'};
  const model = validateFiles([{id: randomUUID(), name: 'own-model.glb', role: 'model', data: (await readFile(new URL('fixtures/model.glb', import.meta.url))).toString('base64')}])[0];
  const id = randomUUID();
  const published = await store.publish({idempotencyKey: id, project: draft(), ownerId: 'test'}, [umbrella, model]);
  assert.equal(published.model.src, `uploads/${id}/${model.id}.glb`);
  assert.equal(published.model.name, 'own-model.glb');
});
