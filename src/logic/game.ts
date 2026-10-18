import { HERO, OPPONENTS, ROUND, SCORE } from '../config/tuning';
import { isWalkable, TILE, type Maze } from './maze';
import {
  chooseToward,
  gap,
  move,
  steer,
  tileOf,
  type Dir,
  type Mover,
  type Point,
} from './movement';
import { chaseTarget, createOpponents, mayLeave, moveInHouse, type Opponent } from './opponents';

/**
 * - ready: "READY!" pause; input is buffered.
 * - playing: everyone moves.
 * - dying: the hero was caught; a pause before the next life.
 * - gameover: no lives left.
 * - cleared: every dot and pellet eaten (the next maze arrives in M2.5).
 */
export type Phase = 'ready' | 'playing' | 'dying' | 'gameover' | 'cleared';

/** The state of one maze being played. Engine-free (ADR-006). */
export interface GameState {
  maze: Maze;
  /** Mutable copy of the maze grid: eaten dots become empty corridor. */
  tiles: string[][];
  hero: Mover;
  /** Murk, Gnash, Bolt and Wisp, in that order (WW-02). */
  opponents: Opponent[];
  /** Direction the player asked for, kept until it can be taken. */
  wanted: Dir | null;
  score: number;
  lives: number;
  dotsLeft: number;
  phase: Phase;
  /** Seconds spent in the current phase. */
  phaseTime: number;
  /** Dots and pellets eaten since this life began, for the house release. */
  dotsThisLife: number;
  /** Seconds since the hero last ate, for the house release. */
  sinceDot: number;
}

export interface Eaten extends Point {
  kind: 'dot' | 'pellet';
}

export function createGame(maze: Maze): GameState {
  const tiles = maze.grid.map((row) => row.split(''));
  const dotsLeft = tiles.flat().filter((c) => c === TILE.dot || c === TILE.pellet).length;
  const state: GameState = {
    maze,
    tiles,
    hero: { x: 0, y: 0, dir: HERO.startDir, moving: true },
    opponents: [],
    wanted: null,
    score: 0,
    lives: ROUND.lives,
    dotsLeft,
    phase: 'ready',
    phaseTime: 0,
    dotsThisLife: 0,
    sinceDot: 0,
  };
  resetActors(state);
  return state;
}

/** Puts everyone back on their starting tiles (the dots stay eaten). */
function resetActors(state: GameState): void {
  state.hero = { ...state.maze.start, dir: HERO.startDir, moving: true };
  state.opponents = createOpponents(state.maze);
  state.wanted = null;
  state.dotsThisLife = 0;
  state.sinceDot = 0;
}

function enter(state: GameState, phase: Phase): void {
  state.phase = phase;
  state.phaseTime = 0;
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
  state.phaseTime += dt;
  switch (state.phase) {
    case 'ready':
      if (state.phaseTime >= ROUND.readySeconds) enter(state, 'playing');
      return [];
    case 'dying':
      if (state.phaseTime >= ROUND.deathSeconds) {
        state.lives--;
        if (state.lives > 0) {
          resetActors(state);
          enter(state, 'ready');
        } else {
          enter(state, 'gameover');
        }
      }
      return [];
    case 'gameover':
    case 'cleared':
      return [];
    case 'playing':
      return play(state, dt);
  }
}

function play(state: GameState, dt: number): Eaten[] {
  const { maze } = state;
  const open = (x: number, y: number): boolean => isWalkable(tileAt(state, x, y));
  state.wanted = move(state.hero, state.wanted, HERO.speed * dt, open, maze.width);

  const eaten: Eaten[] = [];
  const t = tileOf(state.hero, maze.width);
  const c = state.tiles[t.y]?.[t.x];
  if (c === TILE.dot || c === TILE.pellet) {
    (state.tiles[t.y] as string[])[t.x] = TILE.empty;
    const kind = c === TILE.dot ? 'dot' : 'pellet';
    state.score += SCORE[kind];
    state.dotsLeft--;
    eaten.push({ ...t, kind });
    if (state.dotsLeft === 0) {
      enter(state, 'cleared');
      return eaten;
    }
  }

  if (eaten.length > 0) {
    state.dotsThisLife++;
    state.sinceDot = 0;
  } else {
    state.sinceDot += dt;
  }

  moveOpponents(state, dt, open);
  const caught = state.opponents.some(
    (o) => o.state === 'out' && gap(state.hero, o, maze.width) < ROUND.catchDistance,
  );
  if (caught) enter(state, 'dying');
  return eaten;
}

function moveOpponents(
  state: GameState,
  dt: number,
  open: (x: number, y: number) => boolean,
): void {
  const { maze } = state;
  const hero = { ...tileOf(state.hero, maze.width), dir: state.hero.dir };
  const murk = state.opponents[0] as Opponent;
  const ctx = { maze, hero, murk: tileOf(murk, maze.width) };

  // Release waiting opponents one at a time, in cast order.
  const next = state.opponents.findIndex((o) => o.state === 'waiting');
  if (next >= 0 && mayLeave(next, state.dotsThisLife, state.sinceDot)) {
    (state.opponents[next] as Opponent).state = 'leaving';
    state.sinceDot = 0;
  }

  for (const o of state.opponents) {
    if (o.state !== 'out') {
      moveInHouse(o, maze, OPPONENTS.houseSpeed * dt);
      continue;
    }
    const choose = (m: Mover): Dir => chooseToward(m, chaseTarget(o.name, m, ctx), open);
    steer(o, OPPONENTS.speed * dt, choose, open, maze.width);
  }
}
