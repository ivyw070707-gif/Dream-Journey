import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getProjects, getStages} from '../src/js/data.js';
import {localizeProject, emptyDraft, escapeHTML} from '../src/js/project-schema.js';
import {translate} from '../src/js/i18n.js';
import {renderProjectMarkup} from '../src/js/project-view.js';
import {inspectGLB} from '../src/js/glb.js';

const render = (project, language = 'zh') => renderProjectMarkup(project, {t: key => translate(key, language), stages: getStages(language), index: 0, language});
const fixture = () => localizeProject({...emptyDraft(), title: {zh: '有内容的项目', en: 'A project'}, destination: {zh: '敦煌', en: 'Dunhuang'}, cover: '', fieldPhotos: [], finalOutcomes: [null, null, null]}, 'zh');

test('cover-only projects hide empty sections while the complete Tulou journey shows its materials', () => {
  for (const language of ['zh', 'en']) for (const project of getProjects(language)) {
    const html = render(project, language);
    assert.ok(html.includes(escapeHTML(project.title)) && html.includes(project.destination) && html.includes(project.cover));
    if (project.id === 'tulou') {
      assert.ok(html.includes('class="research"') && html.includes('class="fieldwork"') && html.includes('data-outcome="0"'));
      assert.ok(html.includes(project.fieldPhotos[0].src) && html.includes('route-sketch'));
      continue;
    }
    assert.doesNotMatch(html, /class="(?:research|outcomes|ending)"|class="content-slot|placeholder|media-slot|待补充|待上传|To be added|Details to be added|model-viewer/);
    assert.equal(html.includes('route-sketch'), Boolean(project.origin));
    for (const field of ['explorers', 'year', 'theme', 'researchQuestion', 'journeyNote']) assert.ok(!html.includes(translate(field, language)));
  }
});

test('partially populated projects render only their actual research stages, media and fields', () => {
  const p = fixture(); p.researchNotes[2] = '最初的猜想'; p.researchNotes[8] = '准备出发'; p.transport = '火车';
  p.finalOutcomes[1] = {src: 'uploads/notebook.pdf', mime: 'application/pdf', name: '观察记录.pdf'};
  p.unansweredQuestions = ['', '还想了解什么？', '   '];
  const html = render(p);
  assert.equal([...html.matchAll(/class="star-node"/g)].length, 2);
  assert.ok(html.includes('data-stage="2"') && html.includes('data-stage="8"'));
  assert.ok(html.includes('火车') && html.includes('data-outcome="1"'));
  assert.doesNotMatch(html, /data-outcome="0"|data-outcome="2"|route-sketch|model-viewer|placeholder/);
  assert.equal([...html.matchAll(/<p>↗/g)].length, 1);
  p.origin = '上海';
  const route = render(p);
  assert.ok(route.includes('route-sketch') && route.includes('火车'));
  p.transport = '';
  assert.ok(!render(p).includes('route-transport'));
});

test('model-only outcomes render a viewer and download without creating empty report slots or cover', () => {
  const p = fixture(); p.model = {src: 'uploads/model.glb', name: '作品.glb', caption: {zh: '土楼模型', en: 'Tulou model'}};
  const html = render(p);
  assert.ok(html.includes('data-model-src="uploads/model.glb"') && html.includes('土楼模型'));
  assert.doesNotMatch(html, /data-outcome=|cover-placeholder|class="proposal|class="research"|class="fieldwork"|class="ending"/);
  assert.ok(!render({...p, model: null}).includes('class="outcomes"'));
});

test('project text and file labels remain escaped when content is present', () => {
  const p = fixture(); p.fieldNotes = '<img src=x onerror=alert(1)>'; p.studentName = '<script>bad()</script>';
  const html = render(p);
  assert.ok(html.includes('&lt;img') && html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x'));
});

test('portable GLB inspection rejects malformed headers, invalid chunks and external resources', () => {
  const bytes = readFileSync(new URL('fixtures/model.glb', import.meta.url));
  assert.equal(inspectGLB(bytes).asset.version, '2.0');
  const bad = Buffer.from(bytes); bad.writeUInt32LE(1, 4);
  assert.throws(() => inspectGLB(bad), /invalidModel/);
  assert.throws(() => inspectGLB(bytes.subarray(0, bytes.length - 1)), /invalidModel/);
  const manifest = inspectGLB(bytes); manifest.buffers[0].uri = 'https://example.com/private.bin';
  const text = Buffer.from(JSON.stringify(manifest)), padded = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  assert.throws(() => inspectGLB(Buffer.concat([header, padded])), /modelResources/);
});
