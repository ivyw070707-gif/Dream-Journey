// Explicit live check: uses .env and contacts DeepSeek; never part of npm test.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createJourneyServer} from '../server/index.js';

if (!process.env.DEEPSEEK_API_KEY || !process.env.JOURNEY_ADMIN_TOKEN) throw new Error('Configure DEEPSEEK_API_KEY and JOURNEY_ADMIN_TOKEN in .env first.');
const directory = await mkdtemp(path.join(tmpdir(), 'dream-journey-live-test-'));
const providerStatuses = [];
const server = createJourneyServer({env: {...process.env, JOURNEY_DATA_DIR: directory}, fetchImpl: async (...args) => {
  const response = await fetch(...args); providerStatuses.push(response.status); return response;
}});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body) => fetch(`${base}${route}`, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JOURNEY_ADMIN_TOKEN}`}, body: JSON.stringify(body), signal: AbortSignal.timeout(180000)});
  const file = async (name, role) => ({id: randomUUID(), name, role, data: (await readFile(new URL(`../tests/fixtures/${name}`, import.meta.url))).toString('base64')});
  const sources = [
    {id: randomUUID(), name: 'project-facts.txt', role: 'reference', data: Buffer.from('项目名称：敦煌石窟研学\n目的地：敦煌\n年份：2026\n研究问题：壁画为何褪色？\n研究过程：阅读与查找——查阅了壁画保护的相关资料。\n没有提供团队姓名、出发地、交通或现场照片。').toString('base64')},
    await file('research-notes.docx', 'reference'), await file('model.glb', 'model')
  ];
  console.log('Running live DeepSeek analysis with generated test materials…');
  const analysis = await post('/api/agent/analyze', {files: sources});
  const draft = await analysis.json();
  if (!analysis.ok) throw new Error(`Analysis failed: ${draft.error}; provider HTTP status: ${providerStatuses.join(',') || 'not reached'}`);
  assert.ok(draft.project.title.zh.includes('敦煌'));
  assert.ok(draft.project.title.en && draft.project.destination.zh.includes('敦煌'));
  assert.equal(draft.project.year, 2026);
  assert.equal(draft.project.studentName.zh, '');
  assert.equal(draft.project.origin.zh, '');
  assert.ok(draft.evidence.length > 0);
  console.log(`PASS live DeepSeek response (${draft.model}); bilingual fields and source evidence validated.`);
  const result = await post('/api/projects', {idempotencyKey: randomUUID(), project: draft.project, files: sources});
  const published = await result.json();
  assert.equal(result.status, 201);
  assert.ok(published.project.model.src.endsWith('.glb'));
  const media = await fetch(`${base}/${published.project.model.src}`);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'model/gltf-binary');
  const listed = await (await fetch(`${base}/api/projects`)).json();
  assert.equal(listed.projects.length, 1);
  console.log('PASS shared publication, public GLB download and unauthenticated project reads in a temporary store.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(directory, {recursive: true, force: true});
}
