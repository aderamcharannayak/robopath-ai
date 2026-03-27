/**
 * Grid pathfinding (Dijkstra, A*, BFS) for algorithm comparison.
 * Grid cells are boolean: true = walkable (e.g. on road corridor).
 */

import { pathLengthMeters } from "@/utils/geo";

export interface PathResult {
  path: [number, number][];
  nodesExplored: number;
  /** Algorithm runtime (ms). */
  executionTime: number;
  /** Geodesic path length (meters). */
  distance: number;
  algorithm: string;
  /** Optional, e.g. OSRM route duration — not used for grid algorithms. */
  durationSeconds?: number;
}

export type Grid = boolean[][];

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function isValid(x: number, y: number, grid: Grid): boolean {
  return x >= 0 && y >= 0 && x < grid.length && y < grid[0].length && grid[x][y];
}

function reconstructPath(cameFrom: Map<string, string>, current: string): [number, number][] {
  const path: [number, number][] = [];
  let c = current;
  while (cameFrom.has(c)) {
    const [x, y] = c.split(",").map(Number);
    path.unshift([x, y]);
    c = cameFrom.get(c)!;
  }
  const [x, y] = c.split(",").map(Number);
  path.unshift([x, y]);
  return path;
}

function heuristic(a: [number, number], b: [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

export function dijkstra(grid: Grid, start: [number, number], end: [number, number], toLatLng: (x: number, y: number) => [number, number]): PathResult {
  const t0 = performance.now();
  const key = (x: number, y: number) => `${x},${y}`;
  const dist = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const visited = new Set<string>();
  let nodesExplored = 0;

  const pq: { x: number; y: number; d: number }[] = [{ x: start[0], y: start[1], d: 0 }];
  dist.set(key(start[0], start[1]), 0);

  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const { x, y, d } = pq.shift()!;
    const k = key(x, y);

    if (visited.has(k)) continue;
    visited.add(k);
    nodesExplored++;

    if (x === end[0] && y === end[1]) {
      const path = reconstructPath(cameFrom, k);
      const latLngPath = path.map(([gx, gy]) => toLatLng(gx, gy));
      return {
        path: latLngPath,
        nodesExplored,
        executionTime: performance.now() - t0,
        distance: pathLengthMeters(latLngPath),
        algorithm: "Dijkstra",
      };
    }

    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isValid(nx, ny, grid)) continue;
      const nk = key(nx, ny);
      const cost = Math.sqrt(dx * dx + dy * dy);
      const nd = d + cost;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        cameFrom.set(nk, k);
        pq.push({ x: nx, y: ny, d: nd });
      }
    }
  }

  return {
    path: [],
    nodesExplored,
    executionTime: performance.now() - t0,
    distance: 0,
    algorithm: "Dijkstra",
  };
}

export function aStar(grid: Grid, start: [number, number], end: [number, number], toLatLng: (x: number, y: number) => [number, number]): PathResult {
  const t0 = performance.now();
  const key = (x: number, y: number) => `${x},${y}`;
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const closed = new Set<string>();
  let nodesExplored = 0;

  const sk = key(start[0], start[1]);
  gScore.set(sk, 0);
  fScore.set(sk, heuristic(start, end));
  const open: { x: number; y: number; f: number }[] = [{ x: start[0], y: start[1], f: fScore.get(sk)! }];

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const { x, y } = open.shift()!;
    const k = key(x, y);

    if (closed.has(k)) continue;
    closed.add(k);
    nodesExplored++;

    if (x === end[0] && y === end[1]) {
      const path = reconstructPath(cameFrom, k);
      const latLngPath = path.map(([gx, gy]) => toLatLng(gx, gy));
      return {
        path: latLngPath,
        nodesExplored,
        executionTime: performance.now() - t0,
        distance: pathLengthMeters(latLngPath),
        algorithm: "A*",
      };
    }

    const g = gScore.get(k)!;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isValid(nx, ny, grid)) continue;
      const nk = key(nx, ny);
      const cost = Math.sqrt(dx * dx + dy * dy);
      const ng = g + cost;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        fScore.set(nk, ng + heuristic([nx, ny], end));
        cameFrom.set(nk, k);
        open.push({ x: nx, y: ny, f: fScore.get(nk)! });
      }
    }
  }

  return {
    path: [],
    nodesExplored,
    executionTime: performance.now() - t0,
    distance: 0,
    algorithm: "A*",
  };
}

export function bfs(grid: Grid, start: [number, number], end: [number, number], toLatLng: (x: number, y: number) => [number, number]): PathResult {
  const t0 = performance.now();
  const key = (x: number, y: number) => `${x},${y}`;
  const visited = new Set<string>();
  const cameFrom = new Map<string, string>();
  const queue: [number, number][] = [start];
  visited.add(key(start[0], start[1]));
  let nodesExplored = 0;

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const k = key(x, y);
    nodesExplored++;

    if (x === end[0] && y === end[1]) {
      const path = reconstructPath(cameFrom, k);
      const latLngPath = path.map(([gx, gy]) => toLatLng(gx, gy));
      return {
        path: latLngPath,
        nodesExplored,
        executionTime: performance.now() - t0,
        distance: pathLengthMeters(latLngPath),
        algorithm: "BFS",
      };
    }

    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isValid(nx, ny, grid)) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      visited.add(nk);
      cameFrom.set(nk, k);
      queue.push([nx, ny]);
    }
  }

  return {
    path: [],
    nodesExplored,
    executionTime: performance.now() - t0,
    distance: 0,
    algorithm: "BFS",
  };
}

export function runAllAlgorithms(
  grid: Grid,
  start: [number, number],
  end: [number, number],
  toLatLng: (x: number, y: number) => [number, number]
): PathResult[] {
  return [dijkstra(grid, start, end, toLatLng), aStar(grid, start, end, toLatLng), bfs(grid, start, end, toLatLng)];
}
