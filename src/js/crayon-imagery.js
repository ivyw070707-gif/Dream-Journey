// Geographic vector tiles with deterministic pencil / wax texture.
// Geometry is never synthesized by an image model or randomized.
const palettes = {
  crayon: ['#efc78f', '#b9cfa0', '#e5a7a0', '#c0b7d8', '#f0db9b', '#a6c9bc', '#d7b1a0', '#b3c7de'],
  pencil: ['#efd9b0', '#d1debb', '#edc7bd', '#d8cfe3', '#f1e7ba', '#c3dcd1', '#e3d0bc', '#ccdae7'],
};
let geographyPromise;
function polygonParts(collection, type) {
  const parts = [];
  for (const [index, feature] of (collection.features || []).entries()) {
    const g = feature.geometry;
    if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const code = feature.properties?.adcode || feature.properties?.ADM0_A3 || feature.properties?.name || index;
    let hash = 13;
    for (const c of String(code)) hash = ((hash * 31) + c.charCodeAt(0)) >>> 0;
    for (const rings of polys) {
      const bbox = [Infinity, Infinity, -Infinity, -Infinity];
      for (const ring of rings) for (const [lng, lat] of ring) {
        bbox[0] = Math.min(bbox[0], lng); bbox[1] = Math.min(bbox[1], lat);
        bbox[2] = Math.max(bbox[2], lng); bbox[3] = Math.max(bbox[3], lat);
      }
      parts.push({ rings, bbox, color: hash % 8, type });
    }
  }
  return parts;
}
async function loadGeography() {
  if (!geographyPromise) geographyPromise = Promise.all([
    fetch(new URL('../../assets/maps/atlas/world-countries.json', import.meta.url)).then(r => { if (!r.ok) throw Error('全球地图数据未加载'); return r.json(); }),
    fetch(new URL('../../assets/maps/atlas/china-provinces-wgs84.json', import.meta.url)).then(r => { if (!r.ok) throw Error('中国省界数据未加载'); return r.json(); }),
    fetch(new URL('../../assets/maps/atlas/china-prefectures-wgs84.json', import.meta.url)).then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] })),
    fetch(new URL('../../assets/maps/atlas/china-districts-wgs84.json', import.meta.url)).then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] })),
  ]).then(([world, provinces, prefectures, districts]) => ({
    countries: polygonParts(world, 'country'), provinces: polygonParts(provinces, 'province'), prefectures: polygonParts(prefectures, 'prefecture'),
    districts: polygonParts(districts, 'district'),
  })).catch(error => { geographyPromise = null; throw error; });
  return geographyPromise;
}
function makeGrain(style) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'); const image = ctx.createImageData(128, 128);
  let seed = 73;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < image.data.length; i += 4) {
    const light = rand() > .23;
    image.data[i] = light ? 255 : 104; image.data[i + 1] = light ? 251 : 92; image.data[i + 2] = light ? 234 : 73;
    image.data[i + 3] = Math.floor(rand() * (style === 'crayon' ? 43 : 29));
  }
  ctx.putImageData(image, 0, 0);
  ctx.lineWidth = .65; ctx.strokeStyle = style === 'crayon' ? '#fff7de2c' : '#7e71571d';
  for (let x = -128; x < 256; x += style === 'crayon' ? 6 : 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 70, 128); ctx.stroke(); }
  return canvas;
}
export async function createCrayonProvider({ style = 'crayon', boundaries = true } = {}) {
  const C = window.Cesium; const data = await loadGeography();
  const tilingScheme = new C.GeographicTilingScheme();
  const grain = makeGrain(style); const colors = palettes[style] || palettes.crayon;
  const cache = new Map();
  const provider = {
    tileWidth: 512, tileHeight: 512, minimumLevel: 0, maximumLevel: 12,
    tilingScheme, rectangle: tilingScheme.rectangle,
    tileDiscardPolicy: undefined, errorEvent: new C.Event(),
    credit: new C.Credit('地理数据 © Natural Earth · 阿里云 DataV | 手绘渲染：小小地球', true),
    hasAlphaChannel: false, ready: true, readyPromise: Promise.resolve(true),
    getTileCredits: () => undefined,
    pickFeatures: () => undefined,
    requestImage(x, y, level) {
      const key = `${level}/${x}/${y}`;
      if (cache.has(key)) return Promise.resolve(cache.get(key));
      const rect = tilingScheme.tileXYToRectangle(x, y, level);
      const west = C.Math.toDegrees(rect.west), east = C.Math.toDegrees(rect.east);
      const south = C.Math.toDegrees(rect.south), north = C.Math.toDegrees(rect.north);
      const width = east - west, height = north - south;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = style === 'crayon' ? '#b8d8df' : '#d1e4e8'; ctx.fillRect(0, 0, 512, 512);
      const toX = lng => (lng - west) / width * 512;
      const toY = lat => (north - lat) / height * 512;
      const intersects = p => !(p.bbox[0] > east || p.bbox[2] < west || p.bbox[1] > north || p.bbox[3] < south);
      function trace(p) {
        ctx.beginPath();
        for (const ring of p.rings) {
          if (!ring.length) continue;
          ctx.moveTo(toX(ring[0][0]), toY(ring[0][1]));
          for (let i = 1; i < ring.length; i++) ctx.lineTo(toX(ring[i][0]), toY(ring[i][1]));
          ctx.closePath();
        }
      }
      // Globe geometry at low zoom, more finely sampled China polygons at high zoom.
      for (const p of data.countries) {
        if (!intersects(p)) continue;
        trace(p); ctx.fillStyle = colors[p.color]; ctx.fill('evenodd');
        ctx.strokeStyle = '#786d577b'; ctx.lineWidth = style === 'crayon' ? 1.25 : .85; ctx.lineJoin = 'round'; ctx.stroke();
      }
      for (const p of data.provinces) {
        if (!intersects(p)) continue;
        trace(p); ctx.fillStyle = colors[p.color]; ctx.fill('evenodd');
        if (boundaries) { ctx.strokeStyle = '#7c654895'; ctx.lineWidth = 1.1; ctx.stroke(); }
      }
      // City-region boundaries only enter when useful; no fictional roads are drawn.
      if (boundaries && level >= 4) for (const p of data.prefectures) {
        if (!intersects(p)) continue;
        trace(p); ctx.strokeStyle = style === 'crayon' ? '#8b796657' : '#82745965';
        ctx.lineWidth = .8; ctx.setLineDash([4, 2.5]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (boundaries && level >= 7) for (const p of data.districts) {
        if (!intersects(p)) continue;
        trace(p); ctx.strokeStyle = '#806b567d'; ctx.lineWidth = .9; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.save(); ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, 512, 512); ctx.restore();
      // Subtle pencil longitude / latitude guides, always geographically aligned.
      if (level <= 2) {
        ctx.strokeStyle = '#59889626'; ctx.lineWidth = .65; ctx.setLineDash([3, 5]); ctx.beginPath();
        for (let lng = Math.ceil(west / 30) * 30; lng < east; lng += 30) { ctx.moveTo(toX(lng), 0); ctx.lineTo(toX(lng), 512); }
        for (let lat = Math.ceil(south / 30) * 30; lat < north; lat += 30) { ctx.moveTo(0, toY(lat)); ctx.lineTo(512, toY(lat)); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      cache.set(key, canvas);
      if (cache.size > 96) cache.delete(cache.keys().next().value);
      return Promise.resolve(canvas);
    },
  };
  return provider;
}
