import { HERO, SCORE } from '../config/tuning';
import { isWalkable, TILE, type Maze } from './maze';
import { move, tileOf, type Dir, type Mover, type Point } from './movement';

/** The state of one maze being played. Engine-free (ADR-006). */
export interface GameState {
  maze: Maze;
  /** Mutable copy of the maze grid: eaten dots become empty corridor. */
  tiles: string[][];
  hero: Mover;
  /** Direction the player asked for, kept until it can be taken. */
  wanted: Dir | null;
  score: number;
  dotsLeft: number;
  /** True once every dot and pellet is eaten. */
  cleared: boolean;
}

export interface Eaten extends Point {
  kind: 'dot' | 'pellet';
}

export function createGame(maze: Maze): GameState {
  const tiles = maze.grid.map((row) => row.split(''));
  const dotsLeft = tiles.flat().filter((c) => c === TILE.dot || c === TILE.pellet).length;
  return {
    maze,
    tiles,
    hero: { x: maze.start.x, y: maze.start.y, dir: HERO.startDir, moving: true },
    wanted: null,
    score: 0,
    dotsLeft,
    cleared: dotsLeft === 0,
  };
}

/** The tile at (x, y), wrapping left-right on the tunnel row. */
export function tileAt(state: GameState, x: number, y: number): string | undefined {
  const w = state.maze.width;
  const tx = y === state.maze.tunnelY ? ((x % w) + w) % w : x;
  return state.tiles[y]?.[tx];
}

export function setWanted(state: GameState, dir: Dir | null): void {
  state.wanted = dir;
}

/** Advances the game by `dt` seconds. Returns the dots and pellets eaten. */
export function stepGame(state: GameState, dt: number): Eaten[] {
  if (state.cleared) return [];
  const open = (x: number, y: number): boolean => isWalkable(tileAt(state, x, y));
  state.wanted = move(state.hero, state.wanted, HERO.speed * dt, open, state.maze.width);

  const eaten: Eaten[] = [];
  const t = tileOf(state.hero, state.maze.width);
  const c = state.tiles[t.y]?.[t.x];
  if (c === TILE.dot || c === TILE.pellet) {
    (state.tiles[t.y] as string[])[t.x] = TILE.empty;
    const kind = c === TILE.dot ? 'dot' : 'pellet';
    state.score += SCORE[kind];
    state.dotsLeft--;
    state.cleared = state.dotsLeft === 0;
    eaten.push({ ...t, kind });
  }
  return eaten;
}
