import * as THREE from '../../vendor/three/three.module.min.js';
import {clampView, DEFAULT_VIEW, latLngPosition} from './globe-math.js';

let landData;
function loadLand() {
  return landData ??= fetch(new URL('../../assets/maps/land.geojson', import.meta.url))
    .then(response => { if (!response.ok) throw new Error('Map data unavailable'); return response.json(); })
    .catch(error => { landData = null; throw error; });
}

function earthTexture(land) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const context = canvas.getContext('2d');
  context.fillStyle = '#e2e7df'; context.fillRect(0, 0, 2048, 1024);
  context.strokeStyle = '#c1ccbf'; context.lineWidth = 0.6;
  for (let x = 0; x <= 2048; x += 2048 / 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 1024); context.stroke(); }
  for (let y = 0; y <= 1024; y += 1024 / 12) { context.beginPath(); context.moveTo(0, y); context.lineTo(2048, y); context.stroke(); }
  for (const feature of land.features) {
    context.fillStyle = ['CHN', 'TWN'].includes(feature.properties.code) ? '#a5b291' : '#c9ceba';
    context.strokeStyle = '#a2ad96'; context.lineWidth = 0.75;
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      context.beginPath();
      for (const ring of polygon) ring.forEach(([lng, lat], i) => {
        const x = (lng + 180) / 360 * 2048, y = (90 - lat) / 180 * 1024;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.closePath(); context.fill('evenodd'); context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGlobe(host, {projects, active, view: savedView, onSelect, onError}) {
  const canvas = host.querySelector('canvas'), status = host.querySelector('.globe-status');
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20);
  const sphereGeometry = new THREE.SphereGeometry(1, 80, 48);
  const material = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1, metalness: 0});
  const earth = new THREE.Mesh(sphereGeometry, material);
  scene.add(earth, new THREE.AmbientLight(0xffffff, 2.1));
  const sunlight = new THREE.DirectionalLight(0xfff5dc, 2.3);
  scene.add(sunlight);
  const vector = point => new THREE.Vector3(...latLngPosition(point));
  const buttons = [...host.querySelectorAll('.globe-marker')];
  const locations = projects.map(p => vector(p.destinationCoords).multiplyScalar(1.012));
  const offsets = [[14,12],[14,-8],[-12,-14],[-12,12]];
  let view = clampView(savedView || DEFAULT_VIEW), disposed = false, frame = 0;
  const events = new AbortController(), pointers = new Map();
  let previous;

  function render() {
    frame = 0;
    if (disposed) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    camera.position.copy(vector(view).multiplyScalar(view.distance));
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    sunlight.position.copy(camera.position).add(new THREE.Vector3(-1, 2, 1));
    renderer.render(scene, camera);
    locations.forEach((location, i) => {
      const projected = location.clone().project(camera);
      const visible = location.dot(camera.position.clone().sub(location)) > 0 && Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.94;
      const button = buttons[i];
      button.hidden = !visible;
      button.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
      button.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
      button.style.setProperty('--label-x', `${offsets[i][0]}px`);
      button.style.setProperty('--label-y', `${offsets[i][1]}px`);
    });
    host.dataset.latitude = view.lat.toFixed(2);
    host.dataset.longitude = view.lng.toFixed(2);
    host.dataset.distance = view.distance.toFixed(2);
    host.querySelector('[data-globe="in"]').disabled = view.distance <= 1.65;
    host.querySelector('[data-globe="out"]').disabled = view.distance >= 3.4;
  }
  function requestRender() { if (!disposed && !frame) frame = requestAnimationFrame(render); }
  function change(next) { view = clampView({...view, ...next}); requestRender(); }
  function zoom(factor) { change({distance: view.distance * factor}); }
  function select(index) {
    active = index;
    buttons.forEach((button, i) => {
      button.classList.toggle('active', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
    const project = projects[index];
    // Keep the newly selected journey in view, even after a close zoom elsewhere.
    change({lat: project.destinationCoords.lat, lng: project.destinationCoords.lng});
  }

  const input = {signal: events.signal};
  canvas.addEventListener('pointerdown', event => {
    canvas.focus({preventScroll: true}); canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    previous = null; host.classList.add('dragging');
  }, input);
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const old = pointers.get(event.pointerId);
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (previous && distance > 0) zoom(previous / distance);
      previous = distance;
    } else if (pointers.size === 1) {
      const dx = event.clientX - old.x, dy = event.clientY - old.y;
      const sensitivity = 0.13 * view.distance / DEFAULT_VIEW.distance;
      change({lng: view.lng - dx * sensitivity, lat: view.lat + dy * sensitivity});
    }
  }, input);
  function release(event) {
    pointers.delete(event.pointerId); previous = null;
    if (!pointers.size) host.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', release, input);
  canvas.addEventListener('pointercancel', release, input);
  canvas.addEventListener('lostpointercapture', release, input);
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); zoom(Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.0015));
  }, {...input, passive: false});
  canvas.addEventListener('keydown', event => {
    const moves = {ArrowLeft: {lng: view.lng - 3}, ArrowRight: {lng: view.lng + 3}, ArrowUp: {lat: view.lat + 3}, ArrowDown: {lat: view.lat - 3}};
    if (moves[event.key]) { event.preventDefault(); change(moves[event.key]); }
    else if (['+', '=', '-', '_', 'Home'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Home') change(DEFAULT_VIEW); else zoom(['+', '='].includes(event.key) ? 0.85 : 1.15);
    }
  }, input);
  host.querySelectorAll('[data-globe]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.globe === 'reset') change(DEFAULT_VIEW);
    else zoom(button.dataset.globe === 'in' ? 0.85 : 1.15);
  }, input));
  buttons.forEach((button, i) => button.addEventListener('click', () => onSelect(i), input));
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); onError(); }, input);
  const observer = new ResizeObserver(requestRender); observer.observe(host);
  select(active);
  // Respect restored orientation instead of re-centering when switching language.
  view = clampView(savedView || DEFAULT_VIEW);
  loadLand().then(land => {
    if (disposed) return;
    material.map = earthTexture(land); material.needsUpdate = true;
    status.hidden = true; host.dataset.ready = 'true'; requestRender();
  }).catch(() => { if (!disposed) onError(); });
  requestRender();

  return {
    select,
    getView: () => ({...view}),
    dispose() {
      disposed = true; cancelAnimationFrame(frame); events.abort(); observer.disconnect();
      sphereGeometry.dispose(); material.map?.dispose(); material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    }
  };
}
