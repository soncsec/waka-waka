import { MAZE, OPPONENTS, type LevelRow } from '../config/tuning';
import type { Maze } from './maze';
import { DIR_VEC, OPPOSITE, type Dir, type Mover, type Point } from './movement';
import type { Mode } from './scheduler';

/** The cast, in order (WW-02). Index 0 is Murk. */
export const OPPONENT_NAMES = ['murk', 'gnash', 'bolt', 'wisp'] as const;
export type OpponentName = (typeof OPPONENT_NAMES)[number];

/**
 * - waiting: bobbing inside the ghost house.
 * - leaving: heading out through the door.
 * - out: hunting in the maze (or fleeing while scared).
 * - eyes: eaten; racing back to the door.
 * - entering: eyes dropping through the door into the house, then leaving again.
 */
export type OpponentState = 'waiting' | 'leaving' | 'out' | 'eyes' | 'entering';

export interface Opponent extends Mover {
  name: OpponentName;
  state: OpponentState;
  /** Scared by a power pellet: slow, wandering and edible (M2.3). */
  scared: boolean;
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
    scared: false,
  }));
}

/** The corridor tile next to the door where eyes turn in (the exit can sit between two tiles). */
export function eyesTarget(maze: Maze): Point {
  const exit = houseExit(maze);
  return { x: Math.floor(exit.x), y: exit.y };
}

/**
 * Whether a point is inside the wrap-around tunnel: the dot-free outer ends of
 * the tunnel row, beyond the first lattice column on each side (WW-03).
 */
export function inTunnel(maze: Maze, p: Point): boolean {
  if (Math.round(p.y) !== maze.tunnelY || !Number.isInteger(p.y)) return false;
  const x = ((p.x % maze.width) + maze.width) % maze.width;
  const edge = 1 + MAZE.pitch;
  return x < edge || x > maze.width - 1 - edge;
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
  /** Scatter sends everyone to its corner; chase uses the personal targets. */
  mode: Mode;
  /** The hero's tile and facing. */
  hero: Point & { dir: Dir };
  /** Murk's tile, for Bolt's flanking move. */
  murk: Point;
}

/**
 * Each opponent's chase target (WW-02; the distances are in OPPONENTS in tuning.ts):
 * - Murk: the hero's tile.
 * - Gnash: `gnashAhead` tiles ahead of the hero, to cut it off.
 * - Bolt: the point `boltAhead` tiles ahead of the hero, doubled away from Murk,
 *   so the two close in from opposite sides.
 * - Wisp: the hero while more than `wispShyDistance` tiles away; closer than that
 *   it drifts back to its corner.
 */
export function chaseTarget(name: OpponentName, self: Point, ctx: TargetContext): Point {
  if (ctx.mode === 'scatter') return homeCorner(ctx.maze, name);
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

/** Turns every opponent out in the maze around (on each scatter/chase switch). */
export function reverseAll(opponents: Opponent[]): void {
  for (const o of opponents) if (o.state === 'out') o.dir = OPPOSITE[o.dir];
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
  if (o.state === 'entering') {
    // Line up with the door, then drop to the middle of the house and leave again.
    if (o.x !== exit.x) {
      const step = Math.min(distance, Math.abs(exit.x - o.x));
      o.dir = exit.x > o.x ? 'right' : 'left';
      o.x += Math.sign(exit.x - o.x) * step;
      return false;
    }
    o.dir = 'down';
    o.y = Math.min(middle, o.y + distance);
    if (o.y === middle) o.state = 'leaving';
    return false;
  }
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
