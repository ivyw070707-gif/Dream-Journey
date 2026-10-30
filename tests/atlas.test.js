import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {clampView, CHINA_VIEW, DEFAULT_VIEW, latLngPosition} from '../src/js/globe-math.js';
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

test('destination coordinates project onto the correct hemisphere', () => {
  assert.deepEqual(latLngPosition({lat: 0, lng: 0}), [1, 0, -0]);
  assert.ok(Math.abs(latLngPosition({lat: 90, lng: 0})[1] - 1) < 1e-10);
  for (const project of getProjects('en')) {
    const [x,y,z] = latLngPosition(project.destinationCoords);
    assert.ok(Math.abs(Math.hypot(x,y,z) - 1) < 1e-9);
    assert.ok(y > 0 && z < 0);
    assert.ok(Math.abs(Math.asin(y) * 180 / Math.PI - project.destinationCoords.lat) < 1e-9);
  }
});

test('only the four supplied covers and confirmed destinations are populated', () => {
  const expected = [['tulou','漳州'],['suzhou','苏州'],['dunhuang','敦煌'],['miao-interview','贵阳']];
  assert.deepEqual(getProjects('zh').map(p => [p.id,p.destination]), expected);
  for (const language of ['zh','en']) {
    for (const project of getProjects(language)) {
      for (const field of ['researchQuestion','studentName','origin','theme','note','transport','fieldNotes']) assert.equal(project[field], '', `${project.id}.${field}`);
      assert.equal(project.year, null);
      assert.deepEqual(project.fieldPhotos, []);
      assert.deepEqual(project.finalOutcomes, [null,null,null]);
      assert.deepEqual(project.unansweredQuestions, []);
      assert.equal(getStageNotes(language, project).length, getStages(language).length);
      assert.ok(getStageNotes(language, project).every(note => note === ''));
      assert.equal('originCoords' in project, false, 'No departure coordinates should be plotted');
      assert.ok(existsSync(new URL(`../${project.cover}`, import.meta.url)));
      assert.ok(readFileSync(new URL(`../${project.cover}`, import.meta.url)).subarray(1,4).equals(Buffer.from('PNG')));
    }
  }
});

test('both languages cover interface messages and all four cover labels', () => {
  for (const [key, pair] of Object.entries(messages)) {
    assert.equal(pair.length, 2, key);
    pair.forEach(value => assert.ok(typeof value === 'string' && value.length > 0, key));
    assert.equal(translate(key, 'zh'), pair[0]); assert.equal(translate(key, 'en'), pair[1]);
  }
  for (const file of ['app.js','route.js']) {
    const source = readFileSync(new URL(`../src/js/${file}`, import.meta.url), 'utf8');
    for (const [,key] of source.matchAll(/\bt\('([^']+)'\)/g)) assert.ok(messages[key], `${file}: ${key}`);
  }
  const chinese = getProjects('zh'), english = getProjects('en');
  assert.equal(chinese.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.equal(chinese[i].id, english[i].id);
    assert.equal(chinese[i].cover, english[i].cover);
    assert.notEqual(chinese[i].title, english[i].title);
    assert.notEqual(chinese[i].destination, english[i].destination);
  }
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
  for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!/^(data:|https?:)/.test(path)) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
  }
  for (const path of ['../src/js/globe.js','../vendor/three/three.module.min.js','../vendor/three/three.core.min.js','../assets/maps/land.geojson']) assert.ok(existsSync(new URL(path, import.meta.url)), path);
  assert.equal(existsSync(new URL('../assets/images/field.jpg', import.meta.url)), false);
  const land = JSON.parse(readFileSync(new URL('../assets/maps/land.geojson', import.meta.url)));
  assert.ok(land.features.some(feature => feature.properties.code === 'CHN'));
  assert.ok(land.features.length > 150);
});
