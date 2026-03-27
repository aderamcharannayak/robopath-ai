/** Approximate meters per degree latitude. */
const M_PER_DEG_LAT = 111_320;

export function metersPerDegreeLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Obstacle `radius` is in degrees (same convention as Leaflet circle). */
export function obstacleRadiusMeters(obs: { lat: number; lng: number; radius: number }): number {
  return obs.radius * M_PER_DEG_LAT;
}

/** Haversine distance in meters between two [lat, lng] points. */
export function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Local equirectangular projection (meters) around refLat for short segments.
 */
function toLocalMeters(p: [number, number], refLat: number): [number, number] {
  const x = p[1] * metersPerDegreeLng(refLat);
  const y = p[0] * M_PER_DEG_LAT;
  return [x, y];
}

function fromLocalMeters(xy: [number, number], refLat: number): [number, number] {
  const lat = xy[1] / M_PER_DEG_LAT;
  const lng = xy[0] / metersPerDegreeLng(refLat);
  return [lat, lng];
}

/** Minimum distance (meters) from point P to segment AB. */
export function distancePointToSegmentMeters(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const refLat = (p[0] + a[0] + b[0]) / 3;
  const px = toLocalMeters(p, refLat);
  const ax = toLocalMeters(a, refLat);
  const bx = toLocalMeters(b, refLat);
  const abx = bx[0] - ax[0];
  const aby = bx[1] - ax[1];
  const apx = px[0] - ax[0];
  const apy = px[1] - ax[1];
  const ab2 = abx * abx + aby * aby;
  let t = ab2 < 1e-6 ? 0 : (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax[0] + t * abx;
  const cy = ax[1] + t * aby;
  const dx = px[0] - cx;
  const dy = px[1] - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function polylineCrossesObstacle(
  path: [number, number][],
  obs: { lat: number; lng: number; radius: number }
): boolean {
  if (path.length < 2) return false;
  const R = obstacleRadiusMeters(obs);
  const center: [number, number] = [obs.lat, obs.lng];
  const margin = 0.92;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distancePointToSegmentMeters(center, path[i], path[i + 1]);
    if (d < R * margin) return true;
  }
  return false;
}

/** Offset [lat,lng] by meters (east, north). */
export function offsetByMeters(lat: number, lng: number, eastM: number, northM: number): [number, number] {
  const dLat = northM / M_PER_DEG_LAT;
  const dLng = eastM / metersPerDegreeLng(lat);
  return [lat + dLat, lng + dLng];
}

/** Sum of geodesic segment lengths along a [lat,lng] polyline. */
export function pathLengthMeters(path: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) {
    d += haversineMeters(path[i - 1], path[i]);
  }
  return d;
}
