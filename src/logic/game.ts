import { HERO, OPPONENTS, ROUND, SCORE, type LevelRow } from '../config/tuning';
import { levelRow } from './difficulty';
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
 * - cleared: every dot and pellet eaten; after a pause the scene loads the next maze.
 */
export type Phase = 'ready' | 'playing' | 'dying' | 'gameover' | 'cleared';

/** The state of one maze being played. Engine-free (ADR-006). */
export interface GameState {
  maze: Maze;
  /** Maze number, from 1. */
  level: number;
  /** This maze's difficulty row (WW-07). */
  row: LevelRow;
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

/** What a player keeps from one maze to the next. */
export interface Carry {
  score: number;
  lives: number;
}

export interface GameOptions {
  /** Maze number, 1 for the first; picks the difficulty row (WW-07). */
  level?: number;
  carry?: Carry | undefined;
}

export function createGame(maze: Maze, { level = 1, carry }: GameOptions = {}): GameState {
  const tiles = maze.grid.map((row) => row.split(''));
  const dotsLeft = tiles.flat().filter((c) => c === TILE.dot || c === TILE.pellet).length;
  const state: GameState = {
    maze,
    tiles,
    level,
    row: levelRow(level),
    hero: { x: 0, y: 0, dir: HERO.startDir, moving: true },
    opponents: [],
    wanted: null,
    score: carry?.score ?? 0,
    lives: carry?.lives ?? ROUND.lives,
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

/** Eats every dot and pellet left, so the maze counts as cleared (used by the e2e hook). */
export function clearMaze(state: GameState): void {
  for (const row of state.tiles) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === TILE.dot || row[x] === TILE.pellet) row[x] = TILE.empty;
    }
  }
  state.dotsLeft = 0;
  enter(state, 'cleared');
}

/** True once the "MAZE CLEARED!" pause is over and the next maze should start. */
export function nextMazeDue(state: GameState): boolean {
  return state.phase === 'cleared' && state.phaseTime >= ROUND.clearedSeconds;
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
  state.wanted = move(state.hero, state.wanted, state.row.heroSpeed * dt, open, maze.width);

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
  if (next >= 0 && mayLeave(next, state.dotsThisLife, state.sinceDot, state.row)) {
    (state.opponents[next] as Opponent).state = 'leaving';
    state.sinceDot = 0;
  }

  for (const o of state.opponents) {
    if (o.state !== 'out') {
      moveInHouse(o, maze, OPPONENTS.houseSpeed * dt);
      continue;
    }
    const choose = (m: Mover): Dir => chooseToward(m, chaseTarget(o.name, m, ctx), open);
    steer(o, state.row.opponentSpeed * dt, choose, open, maze.width);
  }
}
