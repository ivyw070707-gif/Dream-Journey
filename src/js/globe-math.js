export const CHINA_VIEW = Object.freeze({minLat: 18, maxLat: 53, minLng: 73, maxLng: 135, minDistance: 1.65, maxDistance: 3.4});
export const DEFAULT_VIEW = Object.freeze({lat: 35, lng: 104, distance: 3.05});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The camera's focus stays within China's geographic extent at every zoom level.
export function clampView(view) {
  return {
    lat: clamp(view.lat, CHINA_VIEW.minLat, CHINA_VIEW.maxLat),
    lng: clamp(view.lng, CHINA_VIEW.minLng, CHINA_VIEW.maxLng),
    distance: clamp(view.distance, CHINA_VIEW.minDistance, CHINA_VIEW.maxDistance)
  };
}

export function latLngPosition({lat, lng}, radius = 1) {
  const phi = lat * Math.PI / 180, theta = lng * Math.PI / 180;
  return [radius * Math.cos(phi) * Math.cos(theta), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(theta)];
}
