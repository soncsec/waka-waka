import { MAZE } from '../../config/tuning';
import { isWalkable, TILE, type Maze } from './types';

/**
 * Checks a maze tile by tile, independently of how it was made (WW-03).
 * Used on every generated maze before it is played, and on the fallback maze in tests.
 */

export interface MazeStats {
  dots: number;
  pellets: number;
  /** Walkable tiles with 3 or more ways out. */
  junctions: number;
  /** Longest run of tiles with no turn-off, following corners and the tunnel. */
  longestStretch: number;
}

export interface MazeCheck {
  ok: boolean;
  problems: string[];
  stats: MazeStats;
}

const ALLOWED = new Set<string>(Object.values(TILE));
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function validateMaze(maze: Maze): MazeCheck {
  const problems: string[] = [];
  const { width: W, height: H, grid, tunnelY } = maze;
  const stats: MazeStats = { dots: 0, pellets: 0, junctions: 0, longestStretch: 0 };

  if (grid.length !== H || grid.some((row) => row.length !== W)) {
    return { ok: false, problems: [`grid is not ${W}x${H}`], stats };
  }
  const at = (x: number, y: number): string | undefined => grid[y]?.[x];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = at(x, y) as string;
      if (!ALLOWED.has(c)) problems.push(`unknown tile '${c}' at ${x},${y}`);
      if (c !== at(W - 1 - x, y)) problems.push(`not mirror-symmetric at ${x},${y}`);
      if (c === TILE.dot) stats.dots++;
      if (c === TILE.pellet) stats.pellets++;
    }
  }

  /** Walkable neighbours, wrapping left-right on the tunnel row only. */
  const exits = (x: number, y: number): [number, number][] =>
    DIRS.map(([dx, dy]): [number, number] => {
      const ny = y + dy;
      const nx = ny === tunnelY ? (x + dx + W) % W : x + dx;
      return [nx, ny];
    }).filter(([nx, ny]) => isWalkable(at(nx, ny)));

  const walkable: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (isWalkable(at(x, y))) walkable.push([x, y]);
  }

  // Borders are walls except the tunnel's two ends.
  for (const [x, y] of walkable) {
    const onBorder = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    if (onBorder && !(y === tunnelY && (x === 0 || x === W - 1))) {
      problems.push(`open border at ${x},${y}`);
    }
  }

  // Corridors are one tile wide: no 2x2 block of walkable tiles.
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      if ([at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)].every(isWalkable)) {
        problems.push(`corridor wider than one tile at ${x},${y}`);
      }
    }
  }

  // No dead ends.
  for (const [x, y] of walkable) {
    const n = exits(x, y).length;
    if (n < 2) problems.push(`dead end at ${x},${y}`);
    if (n >= 3) stats.junctions++;
  }

  // Everything walkable, so every dot and pellet, is reachable from the hero's start.
  const sx = Math.floor(maze.start.x);
  const startTiles: [number, number][] = [
    [sx, maze.start.y],
    [Math.ceil(maze.start.x), maze.start.y],
  ];
  if (!startTiles.every(([x, y]) => isWalkable(at(x, y)))) {
    problems.push('hero start is not on a corridor');
  } else {
    const seen = new Set<string>([`${sx},${maze.start.y}`]);
    const stack: [number, number][] = [[sx, maze.start.y]];
    while (stack.length > 0) {
      const [x, y] = stack.pop() as [number, number];
      for (const [nx, ny] of exits(x, y)) {
        const k = `${nx},${ny}`;
        if (!seen.has(k)) {
          seen.add(k);
          stack.push([nx, ny]);
        }
      }
    }
    if (seen.size !== walkable.length) {
      problems.push(
        `${walkable.length - seen.size} walkable tiles cannot be reached from the start`,
      );
    }
  }

  // Owner's rule: no stretch longer than maxStretchTiles without a turn-off, counted around corners.
  const visited = new Set<string>();
  for (const [x, y] of walkable) {
    if (exits(x, y).length !== 2 || visited.has(`${x},${y}`)) continue;
    let length = 0;
    const stack: [number, number][] = [[x, y]];
    visited.add(`${x},${y}`);
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as [number, number];
      length++;
      for (const [nx, ny] of exits(cx, cy)) {
        const k = `${nx},${ny}`;
        if (!visited.has(k) && exits(nx, ny).length === 2) {
          visited.add(k);
          stack.push([nx, ny]);
        }
      }
    }
    stats.longestStretch = Math.max(stats.longestStretch, length);
  }
  if (stats.longestStretch > MAZE.maxStretchTiles) {
    problems.push(
      `stretch of ${stats.longestStretch} tiles with no turn-off (max ${MAZE.maxStretchTiles})`,
    );
  }

  if (stats.pellets !== MAZE.pellets) {
    problems.push(`${stats.pellets} power pellets (want ${MAZE.pellets})`);
  }
  if (stats.dots === 0) problems.push('no dots');

  // Ghost house: walls all round, a floor, and a door that opens onto a corridor.
  const { x0, x1, y0, y1 } = maze.house;
  let doors = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = at(x, y);
      const edge = y === y0 || y === y1 || x === x0 || x === x1;
      if (c === TILE.door) {
        doors++;
        if (y !== y0 || !isWalkable(at(x, y - 1))) problems.push(`door at ${x},${y} is not on top`);
      } else if (edge ? c !== TILE.houseWall : c !== TILE.houseFloor) {
        problems.push(`house tile '${c}' at ${x},${y}`);
      }
    }
  }
  if (doors === 0) problems.push('ghost house has no door');

  return { ok: problems.length === 0, problems, stats };
}
