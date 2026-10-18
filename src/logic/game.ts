import { HERO, MURK, ROUND, SCORE } from '../config/tuning';
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
  /** Mutable copy of the maze grid: eaten dots become empty corridor. */
  tiles: string[][];
  hero: Mover;
  /** Murk, the first opponent; the rest of the cast arrives in M2.1. */
  murk: Mover;
  /** Direction the player asked for, kept until it can be taken. */
  wanted: Dir | null;
  score: number;
  lives: number;
  dotsLeft: number;
  phase: Phase;
  /** Seconds spent in the current phase. */
  phaseTime: number;
}

export interface Eaten extends Point {
  kind: 'dot' | 'pellet';
}

/** Murk starts on the corridor just above the ghost-house door. */
export function murkStart(maze: Maze): Point {
  return { x: maze.start.x, y: maze.house.y0 - 1 };
}

/** What a player keeps from one maze to the next. */
export interface Carry {
  score: number;
  lives: number;
}

export function createGame(maze: Maze, carry?: Carry): GameState {
  const tiles = maze.grid.map((row) => row.split(''));
  const dotsLeft = tiles.flat().filter((c) => c === TILE.dot || c === TILE.pellet).length;
  const state: GameState = {
    maze,
    tiles,
    hero: { x: 0, y: 0, dir: HERO.startDir, moving: true },
    murk: { x: 0, y: 0, dir: MURK.startDir, moving: true },
    wanted: null,
    score: carry?.score ?? 0,
    lives: carry?.lives ?? ROUND.lives,
    dotsLeft,
    phase: 'ready',
    phaseTime: 0,
  };
  resetActors(state);
  return state;
}

/** Puts the hero and Murk back on their starting tiles (the dots stay eaten). */
function resetActors(state: GameState): void {
  state.hero = { ...state.maze.start, dir: HERO.startDir, moving: true };
  state.murk = { ...murkStart(state.maze), dir: MURK.startDir, moving: true };
  state.wanted = null;
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

  // Murk heads for the hero's tile (WW-02); scatter and the other targets come in M2.
  const target = tileOf(state.hero, maze.width);
  steer(state.murk, MURK.speed * dt, (m) => chooseToward(m, target, open), open, maze.width);

  if (gap(state.hero, state.murk, maze.width) < ROUND.catchDistance) enter(state, 'dying');
  return eaten;
}
