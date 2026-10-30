import * as THREE from '../../vendor/three/three.module.min.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from '../../vendor/three/addons/controls/OrbitControls.js';
import {inspectGLB} from './glb.js';

function releaseModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    object.skeleton?.dispose();
  });
  for (const texture of textures) { texture.source?.data?.close?.(); texture.dispose(); }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
export function showModelFailure(host, t) {
  host.dataset.ready = 'error';
  host.querySelector('canvas').hidden = true;
  host.querySelector('.model-status').hidden = false;
  host.querySelector('.model-status').textContent = t('modelFailed');
  host.querySelector('.model-controls').hidden = true;
  host.querySelector('[data-model-retry]').hidden = false;
}
export function createModelViewer(host, {src, t}) {
  const canvas = host.querySelector('canvas'), status = host.querySelector('.model-status');
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.zoomSpeed = .7;
  controls.minDistance = 1.6; controls.maxDistance = 10;
  controls.target.set(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xfff7e5, 0x9b9e8a, 3));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(3, 5, 4); scene.add(keyLight);
  const fill = new THREE.DirectionalLight(0xe1eafa, 1.5);
  fill.position.set(-4, 1, -3); scene.add(fill);
  const events = new AbortController(), request = new AbortController();
  let disposed = false, root, mixer, playing = false, animationFrame = 0, visible = true, lastTime = 0;
  function render() {
    if (disposed || !visible) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    host.dataset.distance = camera.position.distanceTo(controls.target).toFixed(3);
  }
  function frame(time) {
    animationFrame = 0;
    if (disposed || !playing || !visible || document.hidden) return;
    if (lastTime) mixer?.update(Math.min((time - lastTime) / 1000, .1));
    lastTime = time; render(); animationFrame = requestAnimationFrame(frame);
  }
  function resumeAnimation() {
    lastTime = 0;
    if (!disposed && playing && visible && !document.hidden && !animationFrame) animationFrame = requestAnimationFrame(frame);
  }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset); controls.update(); render();
  }
  function reset() { controls.reset(); render(); }
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(render); resize.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { render(); resumeAnimation(); }
    else { cancelAnimationFrame(animationFrame); animationFrame = 0; lastTime = 0; }
  }); intersection.observe(host);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
    else resumeAnimation();
  }, {signal: events.signal});
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); dispose(); showModelFailure(host, t); }, {signal: events.signal});
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') reset();
    else if (['+', '=', '-'].includes(event.key)) zoom(event.key === '-' ? 1.15 : 1 / 1.15);
    else {
      const position = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      position.theta += event.key === 'ArrowLeft' ? .12 : event.key === 'ArrowRight' ? -.12 : 0;
      position.phi = THREE.MathUtils.clamp(position.phi + (event.key === 'ArrowUp' ? -.12 : event.key === 'ArrowDown' ? .12 : 0), .05, Math.PI - .05);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(position)); controls.update(); render();
    }
  }, {signal: events.signal});
  host.querySelector('[data-model-zoom="in"]').onclick = () => zoom(1 / 1.15);
  host.querySelector('[data-model-zoom="out"]').onclick = () => zoom(1.15);
  host.querySelector('[data-model-reset]').onclick = reset;
  const play = host.querySelector('[data-model-play]');
  play.onclick = () => { playing = !playing; play.textContent = t(playing ? 'modelPause' : 'modelPlay'); play.setAttribute('aria-pressed', String(playing)); resumeAnimation(); };
  function dispose() {
    if (disposed) return;
    disposed = true; request.abort(); events.abort(); resize.disconnect(); intersection.disconnect(); controls.dispose();
    cancelAnimationFrame(animationFrame); mixer?.stopAllAction(); if (root) mixer?.uncacheRoot(root);
    releaseModel(root); renderer.dispose();
    for (const button of host.querySelectorAll('.model-controls button')) button.onclick = null;
  }
  camera.position.set(3.2, 2, 3.2); controls.update();
  canvas.hidden = false; status.hidden = false; status.textContent = t('modelLoading');
  host.querySelector('.model-controls').hidden = true;
  host.querySelector('[data-model-retry]').hidden = true;
  host.dataset.ready = 'loading';
  (async () => {
    const response = await fetch(src, {signal: request.signal});
    if (!response.ok) throw new Error('Model unavailable');
    const data = await response.arrayBuffer(); inspectGLB(data);
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => { if (!/^(data:|blob:)/.test(url)) throw new Error('External model resource'); return url; });
    const gltf = await new GLTFLoader(manager).parseAsync(data, '');
    if (disposed) { releaseModel(gltf.scene); return; }
    root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root), center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()), diameter = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(diameter) || diameter <= 0) throw new Error('Empty model');
    const pivot = new THREE.Group();
    pivot.scale.setScalar(2 / diameter); pivot.position.copy(center).multiplyScalar(-2 / diameter);
    pivot.add(root); scene.add(pivot);
    // Include the bounding sphere even on narrow phone screens.
    const radius = size.length() / diameter;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    const distance = radius / Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * aspect))) * 1.15;
    controls.maxDistance = Math.max(10, distance * 3);
    camera.position.set(1, .65, 1).normalize().multiplyScalar(distance);
    controls.update(); controls.saveState();
    if (gltf.animations.length) { mixer = new THREE.AnimationMixer(root); for (const animation of gltf.animations) mixer.clipAction(animation).play(); play.hidden = false; }
    status.hidden = true; host.querySelector('.model-controls').hidden = false; host.dataset.ready = 'true'; render();
  })().catch(() => { if (!disposed) { dispose(); showModelFailure(host, t); } });
  return {dispose};
}
