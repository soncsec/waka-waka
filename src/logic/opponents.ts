import { OPPONENTS, type LevelRow } from '../config/tuning';
import type { Maze } from './maze';
import { DIR_VEC, type Dir, type Mover, type Point } from './movement';

/** The cast, in order (WW-02). Index 0 is Murk. */
export const OPPONENT_NAMES = ['murk', 'gnash', 'bolt', 'wisp'] as const;
export type OpponentName = (typeof OPPONENT_NAMES)[number];

/**
 * - waiting: bobbing inside the ghost house.
 * - leaving: heading out through the door.
 * - out: hunting in the maze.
 */
export type OpponentState = 'waiting' | 'leaving' | 'out';

export interface Opponent extends Mover {
  name: OpponentName;
  state: OpponentState;
}

/** The corridor tile just above the ghost-house door, where opponents come out. */
export function houseExit(maze: Maze): Point {
  return { x: maze.start.x, y: maze.house.y0 - 1 };
}

/** Where each opponent starts: Murk outside the door, the others inside the house. */
export function opponentStart(maze: Maze, name: OpponentName): Point {
  const { house } = maze;
  const middle = (house.y0 + house.y1) / 2;
  const centreX = maze.start.x;
  switch (name) {
    case 'murk':
      return houseExit(maze);
    case 'gnash':
      return { x: centreX, y: middle };
    case 'bolt':
      return { x: centreX - OPPONENTS.houseSpacing, y: middle };
    case 'wisp':
      return { x: centreX + OPPONENTS.houseSpacing, y: middle };
  }
}

export function createOpponents(maze: Maze): Opponent[] {
  return OPPONENT_NAMES.map((name) => ({
    name,
    ...opponentStart(maze, name),
    dir: name === 'murk' ? OPPONENTS.startDir : 'up',
    moving: true,
    state: name === 'murk' ? 'out' : 'waiting',
  }));
}

/** Corner each opponent heads for when it holds back (Wisp) or scatters (M2.2). */
export function homeCorner(maze: Maze, name: OpponentName): Point {
  const right = maze.width + 1;
  const bottom = maze.height + 1;
  switch (name) {
    case 'murk':
      return { x: right, y: -2 };
    case 'gnash':
      return { x: -2, y: -2 };
    case 'bolt':
      return { x: right, y: bottom };
    case 'wisp':
      return { x: -2, y: bottom };
  }
}

export interface TargetContext {
  maze: Maze;
  /** The hero's tile and facing. */
  hero: Point & { dir: Dir };
  /** Murk's tile, for Bolt's flanking move. */
  murk: Point;
}

/**
 * Each opponent's chase target (WW-02):
 * - Murk: the hero's tile.
 * - Gnash: 4 tiles ahead of the hero, to cut it off.
 * - Bolt: the point 2 tiles ahead of the hero, doubled away from Murk, so the
 *   two close in from opposite sides.
 * - Wisp: the hero while more than 8 tiles away; closer than that it drifts
 *   back to its corner.
 */
export function chaseTarget(name: OpponentName, self: Point, ctx: TargetContext): Point {
  const { hero } = ctx;
  const [dx, dy] = DIR_VEC[hero.dir];
  switch (name) {
    case 'murk':
      return { x: hero.x, y: hero.y };
    case 'gnash':
      return { x: hero.x + dx * OPPONENTS.gnashAhead, y: hero.y + dy * OPPONENTS.gnashAhead };
    case 'bolt': {
      const pivot = { x: hero.x + dx * OPPONENTS.boltAhead, y: hero.y + dy * OPPONENTS.boltAhead };
      return { x: 2 * pivot.x - ctx.murk.x, y: 2 * pivot.y - ctx.murk.y };
    }
    case 'wisp': {
      const far = Math.hypot(self.x - hero.x, self.y - hero.y) > OPPONENTS.wispShyDistance;
      return far ? { x: hero.x, y: hero.y } : homeCorner(ctx.maze, 'wisp');
    }
  }
}

/**
 * Whether a waiting opponent may leave the house: once enough dots have been
 * eaten this life, or when the hero has gone too long without eating (WW-07).
 */
export function mayLeave(
  index: number,
  dotsThisLife: number,
  secondsSinceDot: number,
  row: LevelRow,
): boolean {
  const dots = row.releaseDots[index] ?? 0;
  return dotsThisLife >= dots || secondsSinceDot >= row.releaseIdleSeconds;
}

/**
 * Moves an opponent inside the house: waiting ones bob up and down; leaving
 * ones line up with the door, then rise through it. Returns true once out.
 */
export function moveInHouse(o: Opponent, maze: Maze, distance: number): boolean {
  const exit = houseExit(maze);
  const middle = (maze.house.y0 + maze.house.y1) / 2;
  if (o.state === 'waiting') {
    const top = middle - OPPONENTS.bob;
    const bottom = middle + OPPONENTS.bob;
    o.y += o.dir === 'up' ? -distance : distance;
    if (o.y <= top) {
      o.y = top;
      o.dir = 'down';
    } else if (o.y >= bottom) {
      o.y = bottom;
      o.dir = 'up';
    }
    return false;
  }
  let left = distance;
  if (o.x !== exit.x) {
    const step = Math.min(left, Math.abs(exit.x - o.x));
    o.dir = exit.x > o.x ? 'right' : 'left';
    o.x += Math.sign(exit.x - o.x) * step;
    left -= step;
  }
  if (o.x === exit.x && left > 0) {
    o.dir = 'up';
    o.y = Math.max(exit.y, o.y - left);
  }
  if (o.x === exit.x && o.y === exit.y) {
    o.state = 'out';
    o.dir = OPPONENTS.startDir;
    return true;
  }
  return false;
}
