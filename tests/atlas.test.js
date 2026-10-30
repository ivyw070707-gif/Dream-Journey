import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {clampView, CHINA_VIEW, DEFAULT_VIEW, latLngPosition, routePositions} from '../src/js/globe-math.js';
import {getProjects, getStages, getStageNotes} from '../src/js/data.js';
import {messages, initialLocale, translate} from '../src/js/i18n.js';

test('camera cannot escape China or zoom through the globe', () => {
  assert.deepEqual(clampView({lat: -1000, lng: 1000, distance: -50}), {lat: 18, lng: 135, distance: 1.65});
  assert.deepEqual(clampView({lat: 1000, lng: -1000, distance: 100}), {lat: 53, lng: 73, distance: 3.4});
  assert.deepEqual(clampView(DEFAULT_VIEW), DEFAULT_VIEW);
  for (const project of getProjects('en')) {
    const focused = clampView({...project.destinationCoords, distance: 2});
    assert.equal(focused.lat, project.destinationCoords.lat);
    assert.equal(focused.lng, project.destinationCoords.lng);
    assert.ok(focused.lat >= CHINA_VIEW.minLat && focused.lng <= CHINA_VIEW.maxLng);
  }
});

test('geographic coordinates and routes lie on the correct side of the sphere', () => {
  assert.deepEqual(latLngPosition({lat: 0, lng: 0}), [1, 0, -0]);
  assert.ok(Math.abs(latLngPosition({lat: 90, lng: 0})[1] - 1) < 1e-10);
  for (const project of getProjects('en')) {
    const path = routePositions(project.originCoords, project.destinationCoords);
    assert.equal(path.length, 81);
    const origin = latLngPosition(project.originCoords, 1.009), destination = latLngPosition(project.destinationCoords, 1.009);
    path[0].forEach((value, i) => assert.ok(Math.abs(value - origin[i]) < 1e-9));
    path.at(-1).forEach((value, i) => assert.ok(Math.abs(value - destination[i]) < 1e-9));
    path.forEach(point => assert.ok(Math.hypot(...point) >= 1.0089, 'Route cannot disappear inside the earth'));
  }
  routePositions({lat: 30, lng: 110}, {lat: 30, lng: 110}).flat().forEach(value => assert.ok(Number.isFinite(value)));
});

test('both languages cover every journey, research node, and interface message', () => {
  for (const [key, pair] of Object.entries(messages)) {
    assert.equal(pair.length, 2, key);
    pair.forEach(value => assert.ok(typeof value === 'string' && value.length > 0, key));
    assert.equal(translate(key, 'zh'), pair[0]);
    assert.equal(translate(key, 'en'), pair[1]);
  }
  const chinese = getProjects('zh'), english = getProjects('en');
  assert.equal(chinese.length, 7);
  for (let i = 0; i < 7; i++) {
    assert.equal(chinese[i].id, english[i].id);
    for (const field of ['title','researchQuestion','studentName','origin','destination','theme','note']) {
      assert.notEqual(chinese[i][field], english[i][field], `${chinese[i].id}.${field}`);
    }
    assert.equal(chinese[i].unansweredQuestions.length, 3);
    assert.equal(english[i].unansweredQuestions.length, 3);
    for (const language of ['zh','en']) assert.equal(getStageNotes(language, getProjects(language)[i]).length, getStages(language).length);
  }
  assert.equal(new Set(english.map(p => p.id)).size, 7);
});

test('language preference survives reload and blocked storage is optional', () => {
  assert.equal(initialLocale({getItem: () => 'en'}, 'zh-CN'), 'en');
  assert.equal(initialLocale({getItem: () => 'zh'}, 'en-US'), 'zh');
  assert.equal(initialLocale({getItem: () => 'invalid'}, 'zh-TW'), 'zh');
  assert.equal(initialLocale({getItem: () => { throw new Error('Blocked'); }}, 'en-US'), 'en');
  assert.equal(initialLocale(undefined, 'zh-CN'), 'zh');
});

test('all modules and deployed assets resolve from the static entry point', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
  for (const path of ['../src/js/globe.js','../vendor/three/three.module.min.js','../vendor/three/three.core.min.js','../assets/maps/land.geojson','../assets/images/field.jpg']) assert.ok(existsSync(new URL(path, import.meta.url)), path);
  const land = JSON.parse(readFileSync(new URL('../assets/maps/land.geojson', import.meta.url)));
  assert.ok(land.features.some(feature => feature.properties.code === 'CHN'));
  assert.ok(land.features.length > 150);
});
