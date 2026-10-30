import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {latLngPosition} from '../src/js/globe-math.js';
import {getProjects} from '../src/js/data.js';
import {journeyContent, extraGalleryPhotos} from '../src/js/journey-content.js';
import {impactData} from '../src/js/impact-data.js';
import {projectModels} from '../src/js/project-models.js';
import {messages, initialLocale, translate} from '../src/js/i18n.js';

test('confirmed journey locations use valid geographic coordinates', () => {
  for (const project of getProjects('zh')) {
    const {lat, lng} = project.destinationCoords;
    assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, project.id);
    assert.ok(Number.isFinite(lng) && lng >= -180 && lng <= 180, project.id);
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

test('the four confirmed destinations have supplied covers and source-attributed content', () => {
  const expected = [['tulou','漳州'],['suzhou','苏州'],['dunhuang','敦煌'],['miao-interview','贵阳']];
  assert.deepEqual(getProjects('zh').map(p => [p.id,p.destination]), expected);
  for (const language of ['zh','en']) {
    for (const project of getProjects(language)) {
      assert.equal('originCoords' in project, false, 'No departure coordinates should be plotted');
      assert.ok(existsSync(new URL(`../${project.cover}`, import.meta.url)));
      const bytes=readFileSync(new URL(`../${project.cover}`, import.meta.url));
      assert.ok(bytes.subarray(1,4).equals(Buffer.from('PNG')) || (bytes[0]===255 && bytes[1]===216 && bytes[2]===255), `${project.id}: cover must be a PNG or JPEG`);
    }
  }
  assert.deepEqual(Object.keys(journeyContent).sort(), expected.map(([id]) => id).sort());
  for (const [id, content] of Object.entries(journeyContent)) {
    for (const field of ['theme','question','summary','sourceNote']) assert.ok(content[field]?.trim(), `${id}: missing ${field}`);
    assert.ok(content.steps.length > 0, `${id}: no research narrative`);
    content.steps.forEach(step => { assert.ok(step.title?.trim()); assert.ok(step.text?.trim()); });
    assert.ok(content.photos.length > 0, `${id}: no supplied photo`);
  }
});

test('every displayed project photo is a local image with a descriptive caption', () => {
  const photos = [...Object.values(journeyContent).flatMap(c => c.photos), ...extraGalleryPhotos];
  for (const photo of photos) {
    assert.ok(photo.caption?.trim(), photo.src);
    assert.ok(photo.alt?.trim(), photo.src);
    assert.match(photo.src, /^assets\/photos\/[\w.-]+$/);
    const bytes = readFileSync(new URL(`../${photo.src}`, import.meta.url));
    const isPng = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    assert.ok(isPng || isJpeg, `${photo.src}: invalid image signature`);
  }
});

test('both languages cover interface messages and all four cover labels', () => {
  for (const [key, pair] of Object.entries(messages)) {
    assert.equal(pair.length, 2, key);
    pair.forEach(value => assert.ok(typeof value === 'string' && value.length > 0, key));
    assert.equal(translate(key, 'zh'), pair[0]); assert.equal(translate(key, 'en'), pair[1]);
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
  for (const path of ['src/js/globe.js','src/js/project-models.js','src/js/model-viewer.js','src/js/journey-content.js','src/js/impact-data.js','vendor/three/three.module.min.js','vendor/three/three.core.min.js','vendor/three/addons/loaders/GLTFLoader.js','vendor/three/addons/controls/OrbitControls.js','assets/maps/land.geojson']) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
  const land = JSON.parse(readFileSync(new URL('../assets/maps/land.geojson', import.meta.url)));
  assert.ok(land.features.some(feature => feature.properties.code === 'CHN'));
  assert.ok(land.features.length > 150);
});

test('simple globe land outlines contain valid, closed geographic polygons', () => {
  const data = JSON.parse(readFileSync(new URL('../assets/maps/land.geojson', import.meta.url)));
  assert.equal(data.type, 'FeatureCollection');
  assert.ok(data.features.length > 150);
  for (const feature of data.features) {
    assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1), 'Boundary rings must close');
      for (const [lng, lat] of ring) {
        assert.ok(Number.isFinite(lng) && lng >= -180 && lng <= 180);
        assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90);
      }
    }
  }
});

test('only Suzhou and Guizhou have their specifically assigned 3D works', () => {
  assert.deepEqual(Object.keys(projectModels).sort(), ['miao-interview','suzhou']);
  assert.equal(projectModels.suzhou.src, 'assets/models/umbrella.glb');
  assert.equal(projectModels['miao-interview'].src, 'assets/models/village.glb');
  assert.equal(projectModels.tulou, undefined);
  assert.equal(projectModels.dunhuang, undefined);
  for (const model of Object.values(projectModels)) {
    assert.ok(model.name && model.en);
    assert.ok(existsSync(new URL(`../${model.src}`, import.meta.url)));
    assert.ok(existsSync(new URL(`../${model.poster}`, import.meta.url)));
  }
});

test('Suzhou uses umbrella materials and marks the added narrative as an example', () => {
  const suzhou=getProjects('zh').find(p=>p.id==='suzhou');
  assert.match(suzhou.title, /油纸伞/);
  assert.match(suzhou.cover, /umbrella/);
  assert.equal(journeyContent.suzhou.isExample, true);
  assert.match(journeyContent.suzhou.question, /伞/);
  assert.match(journeyContent.suzhou.sourceNote, /示例/);
  assert.match(journeyContent.suzhou.photos[0].src, /umbrella/);
});

test('both editable artworks have self-contained, valid GLB 2 exports', () => {
  for (const name of ['umbrella','village']) {
    const bytes = readFileSync(new URL(`../assets/models/${name}.glb`, import.meta.url));
    assert.equal(bytes.toString('ascii',0,4), 'glTF', name);
    assert.equal(bytes.readUInt32LE(4), 2, name);
    assert.equal(bytes.readUInt32LE(8), bytes.length, `${name}: truncated GLB`);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${name}: first chunk is JSON`);
    const jsonEnd = 20 + bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString('utf8',20,jsonEnd));
    assert.equal(gltf.asset.version, '2.0');
    assert.ok(gltf.scenes[gltf.scene || 0].nodes.length > 0);
    assert.ok(gltf.meshes.length > 0);
    assert.ok(gltf.buffers.length > 0);
    assert.ok(gltf.buffers.every(b => !b.uri), `${name}: geometry must be embedded`);
    assert.ok((gltf.images || []).every(i => i.bufferView !== undefined || i.uri?.startsWith('data:')), `${name}: textures must be embedded`);
    assert.equal(bytes.readUInt32LE(jsonEnd+4), 0x004e4942, `${name}: binary chunk missing`);
    assert.equal(jsonEnd + 8 + bytes.readUInt32LE(jsonEnd), bytes.length);
    assert.ok(gltf.buffers[0].byteLength <= bytes.readUInt32LE(jsonEnd));
    const poster = readFileSync(new URL(`../assets/models/${name}-preview.jpg`, import.meta.url));
    assert.ok(poster[0] === 255 && poster[1] === 216, `${name}: preview is a JPEG`);
  }
});

test('impact figures expose their source, reporting period and participant scope', () => {
  const url = new URL(impactData.sourceUrl);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'gongyi.weibo.com');
  assert.ok(url.pathname.length > 1);
  assert.match(impactData.sourceTitle, /真爱梦想/);
  assert.match(impactData.asOf, /2025/);
  assert.match(impactData.note, /孩子.*老师/);
  assert.match(impactData.note, /小队来源/);
  assert.ok(impactData.stats.length > 0);
  for (const stat of impactData.stats) {
    assert.ok(Number(stat.value.replace(/[,+]/g, '')) > 0);
    assert.ok(stat.label && stat.labelEn);
  }
});
