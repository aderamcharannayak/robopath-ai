import { runAllAlgorithms, type Grid, type PathResult } from "@/lib/pathfinding";
import { distancePointToSegmentMeters } from "@/utils/geo";
import { fetchOsrmRouteAvoidingObstacles, type RoutingObstacle } from "@/services/osrm";

const GRID_SIZE = 80;
const CORRIDOR_BUFFER_M = 48;

const SEARCH_DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function boundsFromPolyline(
  polyline: [number, number][],
  a: [number, number],
  b: [number, number]
): { north: number; south: number; east: number; west: number } {
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const [lat, lng] of [...polyline, a, b]) {
    north = Math.max(north, lat);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    west = Math.min(west, lng);
  }
  const pad = 0.007;
  return { north: north + pad, south: south - pad, east: east + pad, west: west - pad };
}

function createRoadCorridorGrid(
  gridSize: number,
  bounds: { north: number; south: number; east: number; west: number },
  polyline: [number, number][],
  obstacles: RoutingObstacle[],
  bufferMeters: number
): {
  grid: Grid;
  toLatLng: (x: number, y: number) => [number, number];
  toGrid: (lat: number, lng: number) => [number, number];
} {
  const latStep = (bounds.north - bounds.south) / gridSize;
  const lngStep = (bounds.east - bounds.west) / gridSize;
  const toLatLng = (x: number, y: number): [number, number] => [
    bounds.south + x * latStep + latStep / 2,
    bounds.west + y * lngStep + lngStep / 2,
  ];
  const toGrid = (lat: number, lng: number): [number, number] => [
    Math.min(gridSize - 1, Math.max(0, Math.floor((lat - bounds.south) / latStep))),
    Math.min(gridSize - 1, Math.max(0, Math.floor((lng - bounds.west) / lngStep))),
  ];

  const grid: Grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const [lat, lng] = toLatLng(x, y);
      let nearRoad = false;
      for (let i = 0; i < polyline.length - 1; i++) {
        const d = distancePointToSegmentMeters([lat, lng], polyline[i], polyline[i + 1]);
        if (d < bufferMeters) {
          nearRoad = true;
          break;
        }
      }
      if (nearRoad) grid[x][y] = true;
    }
  }
  for (const obs of obstacles) {
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const [lat, lng] = toLatLng(x, y);
        const dlat = lat - obs.lat;
        const dlng = lng - obs.lng;
        if (Math.sqrt(dlat * dlat + dlng * dlng) < obs.radius) {
          grid[x][y] = false;
        }
      }
    }
  }
  return { grid, toLatLng, toGrid };
}

function findNearestWalkable(grid: Grid, x: number, y: number): [number, number] | null {
  const n = grid.length;
  if (x >= 0 && y >= 0 && x < n && y < n && grid[x][y]) return [x, y];
  const visited = new Set<string>();
  const q: [number, number][] = [[x, y]];
  let qi = 0;
  while (qi < q.length && qi < 8000) {
    const [cx, cy] = q[qi++];
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) continue;
    const k = `${cx},${cy}`;
    if (visited.has(k)) continue;
    visited.add(k);
    if (grid[cx][cy]) return [cx, cy];
    for (const [dx, dy] of SEARCH_DIRS) {
      q.push([cx + dx, cy + dy]);
    }
  }
  return null;
}

/**
 * 1) OSRM (driving) builds a reference road polyline (with obstacle detours).
 * 2) A grid is walkable only near that polyline (road corridor).
 * 3) Dijkstra, A*, and BFS run on that grid — true algorithm comparison on a road-like search space.
 */
export async function fetchAlgorithmComparisonRoutes(
  start: [number, number],
  end: [number, number],
  obstacles: RoutingObstacle[] = [],
  baseUrl?: string
): Promise<{ results: PathResult[]; errors: string[] }> {
  let refPath: [number, number][];
  try {
    const osrm = await fetchOsrmRouteAvoidingObstacles(start, end, obstacles, "driving", baseUrl);
    refPath = osrm.path;
  } catch (e) {
    return { results: [], errors: [e instanceof Error ? e.message : String(e)] };
  }

  const bounds = boundsFromPolyline(refPath, start, end);
  const { grid, toLatLng, toGrid } = createRoadCorridorGrid(GRID_SIZE, bounds, refPath, obstacles, CORRIDOR_BUFFER_M);

  const sg = toGrid(start[0], start[1]);
  const eg = toGrid(end[0], end[1]);
  const sW = findNearestWalkable(grid, sg[0], sg[1]);
  const eW = findNearestWalkable(grid, eg[0], eg[1]);

  if (!sW || !eW) {
    return {
      results: [],
      errors: ["Could not place start/end on the road corridor. Pick points closer to roads."],
    };
  }

  const results = runAllAlgorithms(grid, sW, eW, toLatLng);
  const anyPath = results.some((r) => r.path.length > 0);
  if (!anyPath) {
    return {
      results: [],
      errors: ["No path in the corridor graph. Widen search or reduce obstacles."],
    };
  }

  return { results, errors: [] };
}
