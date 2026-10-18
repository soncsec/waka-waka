import { MAZE } from '../../config/tuning';
import { createRng, type Rng } from '../rng';
import { TILE, type Maze } from './types';

/**
 * Seeded, mirror-symmetric maze generator (WW-03).
 *
 * Works on a lattice of nodes `pitch` tiles apart. It starts with every
 * corridor segment open and closes random mirrored pairs, keeping a closure
 * only when every node keeps 0 or at least 2 corridors (no dead ends), the
 * maze stays connected, and no chain of corner nodes gets too long.
 * The result is checked again, tile by tile, by `validateMaze`.
 */

const { cols: NX, rows: NY, pitch: P, house: HOUSE, tunnelRow: TUNNEL, startRow: START } = MAZE;

export const MAZE_WIDTH = P * (NX - 1) + 3;
export const MAZE_HEIGHT = P * (NY - 1) + 3;

/** Tile coordinate of a lattice column / row. */
const tx = (i: number): number => 1 + P * i;
const ty = (j: number): number => 1 + P * j;

/** A segment joins node (i, j) to its right neighbour ('h') or the one below ('v'). */
interface Segment {
  key: string;
  a: readonly [number, number];
  b: readonly [number, number];
}

const segKey = (t: 'h' | 'v', i: number, j: number): string => `${t},${i},${j}`;

function allSegments(): Segment[] {
  const out: Segment[] = [];
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX - 1; i++) out.push({ key: segKey('h', i, j), a: [i, j], b: [i + 1, j] });
  }
  for (let j = 0; j < NY - 1; j++) {
    for (let i = 0; i < NX; i++) out.push({ key: segKey('v', i, j), a: [i, j], b: [i, j + 1] });
  }
  return out;
}

const SEGMENTS = allSegments();
const BY_KEY = new Map(SEGMENTS.map((s) => [s.key, s]));

/** The segment's mirror image across the vertical centre line. */
function mirrorKey(s: Segment): string {
  const [i, j] = s.a;
  return s.key.startsWith('h') ? segKey('h', NX - 2 - i, j) : segKey('v', NX - 1 - i, j);
}

const inHouseRect = ([i, j]: readonly [number, number]): boolean =>
  i >= HOUSE.col0 && i <= HOUSE.col1 && j >= HOUSE.row0 && j <= HOUSE.row1;

const onHouseEdge = ([i, j]: readonly [number, number]): boolean =>
  inHouseRect([i, j]) &&
  (i === HOUSE.col0 || i === HOUSE.col1 || j === HOUSE.row0 || j === HOUSE.row1);

/** Segment runs along the corridor ring around the house. */
function onRing(s: Segment): boolean {
  if (!onHouseEdge(s.a) || !onHouseEdge(s.b)) return false;
  return s.a[0] === s.b[0]
    ? s.a[0] === HOUSE.col0 || s.a[0] === HOUSE.col1
    : s.a[1] === HOUSE.row0 || s.a[1] === HOUSE.row1;
}

const isTunnelEnd = (i: number, j: number): boolean => j === TUNNEL && (i === 0 || i === NX - 1);

export interface GenerateOptions {
  /** Share of segments to close; picked at random from the tuning range when left out. */
  closeRatio?: number;
}

export function generateMaze(seed: number, opts: GenerateOptions = {}): Maze {
  const rng = createRng(seed);
  const open = new Set<string>();
  const fixed = new Set<string>();

  for (const s of SEGMENTS) {
    const insideHouse = inHouseRect(s.a) && inHouseRect(s.b);
    if (insideHouse) fixed.add(s.key); // house interior stays closed, the ring around it open
    if (insideHouse && !onRing(s)) continue;
    open.add(s.key);
  }
  // The tunnel's two ends and the hero's start corridor stay open.
  for (const k of [segKey('h', 0, TUNNEL), segKey('h', NX - 2, TUNNEL), segKey('h', 3, START)]) {
    fixed.add(k);
  }

  const degree = (i: number, j: number): number => neighbours(open, i, j).length;

  const target = opts.closeRatio ?? rng.range(MAZE.closeRatioMin, MAZE.closeRatioMax);
  const total = open.size;
  let closed = 0;

  for (const s of shuffledCandidates(fixed, rng)) {
    if (closed / total >= target) break;
    const pair = [s.key, mirrorKey(s)].filter((k, n, arr) => arr.indexOf(k) === n);
    for (const k of pair) open.delete(k);
    const touched = pair.flatMap((k) => {
      const seg = BY_KEY.get(k) as Segment;
      return [seg.a, seg.b];
    });
    const ok =
      touched.every(([i, j]) => {
        const d = degree(i, j);
        return d >= 2 || (d === 0 && rng.next() < MAZE.solidChance);
      }) &&
      isConnected(open) &&
      longestChain(open) <= MAZE.maxChainSegments;
    if (ok) closed += pair.length;
    else for (const k of pair) open.add(k);
  }

  return toTiles(open, seed);
}

/** Candidate segments in random order: one of each mirrored pair, never a fixed one. */
function shuffledCandidates(fixed: Set<string>, rng: Rng): Segment[] {
  const out = SEGMENTS.filter(
    (s) => !fixed.has(s.key) && !fixed.has(mirrorKey(s)) && s.a[0] <= NX - 1 - s.b[0],
  );
  for (let n = out.length - 1; n > 0; n--) {
    const m = rng.int(0, n);
    [out[n], out[m]] = [out[m] as Segment, out[n] as Segment];
  }
  return out;
}

/** Nodes reachable in one step, including the tunnel wrap. */
function neighbours(open: Set<string>, i: number, j: number): [number, number][] {
  const out: [number, number][] = [];
  if (open.has(segKey('h', i, j))) out.push([i + 1, j]);
  if (open.has(segKey('h', i - 1, j))) out.push([i - 1, j]);
  if (open.has(segKey('v', i, j))) out.push([i, j + 1]);
  if (open.has(segKey('v', i, j - 1))) out.push([i, j - 1]);
  if (isTunnelEnd(i, j)) out.push([NX - 1 - i, j]);
  return out;
}

function isConnected(open: Set<string>): boolean {
  const nodes: string[] = [];
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) if (neighbours(open, i, j).length > 0) nodes.push(`${i},${j}`);
  }
  const first = nodes[0];
  if (first === undefined) return false;
  const seen = new Set([first]);
  const stack: [number, number][] = [first.split(',').map(Number) as [number, number]];
  while (stack.length > 0) {
    const [i, j] = stack.pop() as [number, number];
    for (const [a, b] of neighbours(open, i, j)) {
      const k = `${a},${b}`;
      if (!seen.has(k)) {
        seen.add(k);
        stack.push([a, b]);
      }
    }
  }
  return seen.size === nodes.length;
}

/** Longest chain of nodes with exactly 2 corridors, in segments (nodes + 1). */
function longestChain(open: Set<string>): number {
  const seen = new Set<string>();
  const deg = (i: number, j: number): number => neighbours(open, i, j).length;
  let best = 0;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      if (deg(i, j) !== 2 || seen.has(`${i},${j}`)) continue;
      let count = 0;
      const stack: [number, number][] = [[i, j]];
      seen.add(`${i},${j}`);
      while (stack.length > 0) {
        const [a, b] = stack.pop() as [number, number];
        count++;
        for (const [c, d] of neighbours(open, a, b)) {
          const k = `${c},${d}`;
          if (!seen.has(k) && deg(c, d) === 2) {
            seen.add(k);
            stack.push([c, d]);
          }
        }
      }
      best = Math.max(best, count + 1);
    }
  }
  return best;
}

function toTiles(open: Set<string>, seed: number): Maze {
  const W = MAZE_WIDTH;
  const H = MAZE_HEIGHT;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill(TILE.wall));
  const set = (x: number, y: number, c: string): void => {
    (g[y] as string[])[x] = c;
  };
  const get = (x: number, y: number): string => (g[y] as string[])[x] as string;

  for (const k of open) {
    const s = BY_KEY.get(k) as Segment;
    for (let y = ty(s.a[1]); y <= ty(s.b[1]); y++) {
      for (let x = tx(s.a[0]); x <= tx(s.b[0]); x++) set(x, y, TILE.dot);
    }
  }
  const tunnelY = ty(TUNNEL);
  set(0, tunnelY, TILE.empty);
  set(W - 1, tunnelY, TILE.empty);

  // Ghost house, with a two-tile door in the top centre.
  const house = {
    x0: tx(HOUSE.col0) + 1,
    x1: tx(HOUSE.col1) - 1,
    y0: ty(HOUSE.row0) + 1,
    y1: ty(HOUSE.row1) - 1,
  };
  for (let y = house.y0; y <= house.y1; y++) {
    for (let x = house.x0; x <= house.x1; x++) {
      const edge = y === house.y0 || y === house.y1 || x === house.x0 || x === house.x1;
      set(x, y, edge ? TILE.houseWall : TILE.houseFloor);
    }
  }
  const mid = W / 2;
  set(mid - 1, house.y0, TILE.door);
  set(mid, house.y0, TILE.door);

  // No dots on the ring around the house or in the tunnel's outer ends.
  for (let y = ty(HOUSE.row0); y <= ty(HOUSE.row1); y++) {
    for (let x = tx(HOUSE.col0); x <= tx(HOUSE.col1); x++) {
      if (get(x, y) === TILE.dot) set(x, y, TILE.empty);
    }
  }
  for (let x = 0; x < W; x++) {
    if (get(x, tunnelY) === TILE.dot && (x < tx(1) || x > tx(NX - 2))) set(x, tunnelY, TILE.empty);
  }

  const start = { x: mid - 0.5, y: ty(START) };
  set(mid - 1, start.y, TILE.empty);
  set(mid, start.y, TILE.empty);

  // Power pellets: the dot nearest each corner (mirrored corners give a symmetric result).
  const corners: [number, number][] = [
    [1, 2],
    [W - 2, 2],
    [1, H - 4],
    [W - 2, H - 4],
  ];
  for (const [cx, cy] of corners.slice(0, MAZE.pellets)) {
    // Nearest by distance, then the higher row, then the tile nearer the corner's side,
    // so mirrored corners pick mirrored tiles.
    const rank = (x: number, y: number): [number, number, number] => [
      Math.abs(x - cx) + Math.abs(y - cy),
      y,
      cx < W / 2 ? x : W - 1 - x,
    ];
    let best: [number, number] | undefined;
    let bestRank: [number, number, number] = [Infinity, 0, 0];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (get(x, y) !== TILE.dot) continue;
        const r = rank(x, y);
        if (
          r[0] < bestRank[0] ||
          (r[0] === bestRank[0] &&
            (r[1] < bestRank[1] || (r[1] === bestRank[1] && r[2] < bestRank[2])))
        ) {
          bestRank = r;
          best = [x, y];
        }
      }
    }
    if (best) set(best[0], best[1], TILE.pellet);
  }

  return { seed, width: W, height: H, grid: g.map((row) => row.join('')), start, house, tunnelY };
}
