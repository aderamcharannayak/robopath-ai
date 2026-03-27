import type { PathResult } from "@/lib/pathfinding";
import {
  distancePointToSegmentMeters,
  haversineMeters,
  obstacleRadiusMeters,
  polylineCrossesObstacle,
} from "@/utils/geo";

/** Public OSRM demo server — for production use your own OSRM instance. Override with `VITE_OSRM_BASE`. */
const DEFAULT_OSRM_BASE = "https://router.project-osrm.org";

function getOsrmBase(): string {
  const env = import.meta.env.VITE_OSRM_BASE;
  return typeof env === "string" && env.trim() ? env.trim().replace(/\/$/, "") : DEFAULT_OSRM_BASE;
}

export type OsrmProfile = "driving" | "walking" | "cycling";

export const OSRM_PROFILE_LABELS: Record<OsrmProfile, string> = {
  driving: "Driving (OSRM)",
  walking: "Walking (OSRM)",
  cycling: "Cycling (OSRM)",
};

export interface RoutingObstacle {
  lat: number;
  lng: number;
  radius: number;
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: string;
      coordinates: [number, number][];
    };
  }>;
}

interface OsrmNearestResponse {
  code: string;
  waypoints?: Array<{ location: [number, number] }>;
}

function lineStringToLatLngPath(coords: [number, number][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
}

function buildCoordPath(points: [number, number][]): string {
  return points.map(([lat, lng]) => `${lng},${lat}`).join(";");
}

async function snapToRoad(
  lat: number,
  lng: number,
  profile: OsrmProfile,
  root: string
): Promise<[number, number] | null> {
  const url = `${root}/nearest/v1/${profile}/${lng},${lat}?number=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as OsrmNearestResponse;
  if (data.code !== "Ok" || !data.waypoints?.[0]?.location) return null;
  const [lon, latSnap] = data.waypoints[0].location;
  return [latSnap, lon];
}

/**
 * Fetches a single road-following route through optional via points (all lat,lng).
 */
export async function fetchOsrmRouteThrough(
  points: [number, number][],
  profile: OsrmProfile,
  baseUrl?: string
): Promise<PathResult> {
  const root = baseUrl ?? getOsrmBase();
  if (points.length < 2) {
    throw new Error("Need at least start and end");
  }
  const t0 = performance.now();
  const coordPath = buildCoordPath(points);
  const url = `${root}/route/v1/${profile}/${coordPath}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM HTTP ${res.status}`);
  }

  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.code === "NoRoute" ? "No road route found between these points." : `OSRM: ${data.code}`);
  }

  const route = data.routes[0];
  const coords = route.geometry?.coordinates;
  if (!coords?.length) {
    throw new Error("Empty route geometry");
  }

  const path = lineStringToLatLngPath(coords as [number, number][]);
  return {
    path,
    nodesExplored: path.length,
    executionTime: performance.now() - t0,
    distance: route.distance,
    algorithm: OSRM_PROFILE_LABELS[profile],
    durationSeconds: route.duration,
  };
}

/**
 * When the road polyline enters an obstacle disk, propose a detour point off the segment,
 * snap it to the road network, and return [lat,lng] or null.
 */
async function detourWaypointForObstacle(
  obs: RoutingObstacle,
  path: [number, number][],
  profile: OsrmProfile,
  root: string
): Promise<[number, number] | null> {
  const center: [number, number] = [obs.lat, obs.lng];
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distancePointToSegmentMeters(center, path[i], path[i + 1]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const a = path[bestI];
  const b = path[bestI + 1];
  const refLat = (a[0] + b[0]) / 2;
  const mLng = 111_320 * Math.cos((refLat * Math.PI) / 180);
  const ax = a[1] * mLng;
  const ay = a[0] * 111_320;
  const bx = b[1] * mLng;
  const by = b[0] * 111_320;
  const ux = bx - ax;
  const uy = by - ay;
  const len = Math.sqrt(ux * ux + uy * uy) || 1;
  const px = -uy / len;
  const py = ux / len;
  const R = obstacleRadiusMeters(obs);
  const pushM = Math.max(R * 2.8, 95);
  const ox = obs.lng * mLng;
  const oy = obs.lat * 111_320;

  const candidates: [number, number][] = [
    metersToLatLng(ox + px * pushM, oy + py * pushM, refLat),
    metersToLatLng(ox - px * pushM, oy - py * pushM, refLat),
  ];

  let best: [number, number] | null = null;
  let bestScore = -1;
  for (const [clat, clng] of candidates) {
    const snapped = await snapToRoad(clat, clng, profile, root);
    if (!snapped) continue;
    const dist = haversineMeters(center, snapped);
    if (dist > bestScore) {
      bestScore = dist;
      best = snapped;
    }
  }
  return best;
}

function metersToLatLng(xM: number, yM: number, refLat: number): [number, number] {
  const lat = yM / 111_320;
  const mLng = 111_320 * Math.cos((refLat * Math.PI) / 180);
  const lng = xM / mLng;
  return [lat, lng];
}

/** Distance along polyline from start to closest projection of query (meters). */
function projectProgressAlongPath(path: [number, number][], query: [number, number]): number {
  if (path.length < 2) return 0;
  let bestDist = Infinity;
  let bestProgress = 0;
  let cum = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segLen = haversineMeters(a, b);
    const refLat = (a[0] + b[0]) / 2;
    const mLng = 111_320 * Math.cos((refLat * Math.PI) / 180);
    const ax = a[1] * mLng;
    const ay = a[0] * 111_320;
    const bx = b[1] * mLng;
    const by = b[0] * 111_320;
    const px = query[1] * mLng;
    const py = query[0] * 111_320;
    const abx = bx - ax;
    const aby = by - ay;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 < 1e-6 ? 0 : ((px - ax) * abx + (py - ay) * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * abx;
    const cy = ay + t * aby;
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const progress = cum + t * segLen;
    if (d < bestDist) {
      bestDist = d;
      bestProgress = progress;
    }
    cum += segLen;
  }
  return bestProgress;
}

function sortWaypointsAlongPath(path: [number, number][], waypoints: [number, number][]): [number, number][] {
  if (waypoints.length <= 1) return [...waypoints];
  const withKey = waypoints.map((w) => ({
    w,
    k: projectProgressAlongPath(path, w),
  }));
  withKey.sort((a, b) => a.k - b.k);
  return withKey.map((x) => x.w);
}

function dedupeWaypoints(waypoints: [number, number][], minMeters: number): [number, number][] {
  const out: [number, number][] = [];
  for (const w of waypoints) {
    if (out.some((o) => haversineMeters(o, w) < minMeters)) continue;
    out.push(w);
  }
  return out;
}

const MAX_OBSTACLE_ITERS = 8;
const MAX_VIA_POINTS = 14;

/**
 * Road route that tries to avoid user obstacles by inserting snapped detour waypoints.
 * Uses iterative OSRM calls; not a guarantee if the graph has no alternative.
 */
export async function fetchOsrmRouteAvoidingObstacles(
  start: [number, number],
  end: [number, number],
  obstacles: RoutingObstacle[],
  profile: OsrmProfile,
  baseUrl?: string
): Promise<PathResult> {
  const root = baseUrl ?? getOsrmBase();
  if (!obstacles.length) {
    return fetchOsrmRouteThrough([start, end], profile, root);
  }

  let via: [number, number][] = [];
  let last: PathResult | null = null;

  for (let iter = 0; iter < MAX_OBSTACLE_ITERS; iter++) {
    const pathForSort = last?.path ?? [start, end];
    const orderedVia = sortWaypointsAlongPath(pathForSort, via);
    const points: [number, number][] = [start, ...orderedVia, end];
    const deduped: [number, number][] = [];
    for (const p of points) {
      if (deduped.length && haversineMeters(deduped[deduped.length - 1], p) < 12) continue;
      deduped.push(p);
    }
    last = await fetchOsrmRouteThrough(deduped, profile, root);
    const conflicts = obstacles.filter((o) => polylineCrossesObstacle(last.path, o));
    if (!conflicts.length) {
      return last;
    }
    for (const o of conflicts) {
      if (via.length >= MAX_VIA_POINTS) break;
      const wp = await detourWaypointForObstacle(o, last.path, profile, root);
      if (wp) via.push(wp);
    }
    via = dedupeWaypoints(via, 35);
  }
  if (!last) {
    return fetchOsrmRouteThrough([start, end], profile, root);
  }
  return last;
}

/**
 * Fetches a single road-following route between two WGS84 points (lat, lng).
 * OSRM uses lon,lat in the URL; geometry is returned as GeoJSON LineString with [lon,lat] vertices.
 */
export async function fetchOsrmRoute(
  start: [number, number],
  end: [number, number],
  profile: OsrmProfile,
  baseUrl?: string
): Promise<PathResult> {
  return fetchOsrmRouteThrough([start, end], profile, baseUrl);
}

/** Format OSRM route distance (meters) for UI. */
export function formatRouteDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function formatTravelDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
