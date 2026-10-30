import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
// Keep these addons on the same Three.js r180 version as the existing globe.
for (const file of ['loaders/GLTFLoader.js', 'controls/OrbitControls.js', 'utils/BufferGeometryUtils.js']) {
  const source = await readFile(new URL(`../node_modules/three/examples/jsm/${file}`, import.meta.url), 'utf8');
  const target = new URL(`../vendor/three/addons/${file}`, import.meta.url);
  await mkdir(path.dirname(target.pathname), {recursive: true});
  await writeFile(target, source.replaceAll("from 'three'", "from '../../three.module.min.js'"));
}
