import { BONUS, HERO, OPPONENTS, ROUND, SCORE, type LevelRow } from '../config/tuning';
import { levelRow } from './difficulty';
import {
  createSpecials,
  dashCanStart,
  dashStops,
  endDash,
  endLunge,
  lungeCanStart,
  lungeTarget,
  phaseCanStart,
  specialSpeed,
  tickSpecials,
  type SpecialState,
} from './specials';
import { createRng, mixSeed } from './rng';
import { createModeClock, currentMode, tickMode, type Mode, type ModeClock } from './scheduler';
import { isWalkable, TILE, type Maze } from './maze';
import {
  chooseRandom,
  chooseShortest,
  DIR_VEC,
  chooseToward,
  type Dir,
  gap,
  move,
  type Mover,
  OPPOSITE,
  type Point,
  steer,
  tileOf,
} from './movement';
import {
  chaseTarget,
  createOpponents,
  eyesTarget,
  inTunnel,
  mayLeave,
  moveInHouse,
  type Opponent,
  reverseAll,
} from './opponents';

/**
 * - ready: "GET SET!" pause; input is buffered.
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
  /** Whether the extra life for reaching `ROUND.extraLifeAt` has been given. */
  extraLifeGiven: boolean;
  dotsLeft: number;
  phase: Phase;
  /** Seconds spent in the current phase. */
  phaseTime: number;
  /** Dots and pellets eaten since this life began, for the house release. */
  dotsThisLife: number;
  /** Seconds of scare left after a power pellet; 0 when nobody is scared. */
  scaredTime: number;
  /** Scared opponents eaten on the current pellet (sets their points). */
  eatChain: number;
  /** Seeded choices made by scared opponents so far; each one draws from the maze seed (ADR-006). */
  wanderCount: number;
  /** Scatter/chase position (WW-02); restarts with each life. */
  modeClock: ModeClock;
  /** Each opponent's special move, in cast order (WW-10). */
  specials: SpecialState[];
  /** Seconds since the hero last ate, for the house release. */
  sinceDot: number;
  /** Dots and pellets the maze started with. */
  dotsTotal: number;
  /** Bonus batteries shown on this maze so far (M3.3). */
  bonusShown: number;
  /** Seconds the battery on show has left; 0 when none is showing. */
  bonusTime: number;
  /** Paused by the player (P or Esc) or because the tab lost focus (M4.4): nothing moves. */
  paused: boolean;
}

export interface Eaten extends Point {
  kind: 'dot' | 'pellet' | 'bonus';
}

/** RNG stream for scared opponents, kept apart from the maze generator's. */
const SCARED_RNG_STREAM = 0x5ca7ed;

/** What a player keeps from one maze to the next. */
export interface Carry {
  score: number;
  lives: number;
  /** Whether this game's extra life has been given already. */
  extraLifeGiven: boolean;
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
    extraLifeGiven: carry?.extraLifeGiven ?? false,
    dotsLeft,
    phase: 'ready',
    phaseTime: 0,
    dotsThisLife: 0,
    scaredTime: 0,
    eatChain: 0,
    wanderCount: 0,
    modeClock: createModeClock(),
    specials: createSpecials(),
    sinceDot: 0,
    dotsTotal: dotsLeft,
    bonusShown: 0,
    bonusTime: 0,
    paused: false,
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
  state.modeClock = createModeClock();
  state.specials = createSpecials();
  state.scaredTime = 0;
  state.eatChain = 0;
  // A battery on show goes when a life is lost; it doesn't come back.
  state.bonusTime = 0;
}

/**
 * A power pellet (M2.3): every opponent out in the maze turns around and, for the
 * row's `scaredSeconds`, is scared. Also used by the e2e test hook.
 */
export function powerUp(state: GameState): void {
  state.scaredTime = state.row.scaredSeconds;
  state.eatChain = 0;
  for (const o of state.opponents) {
    if (o.state !== 'out') continue;
    o.dir = OPPOSITE[o.dir];
    o.scared = state.scaredTime > 0;
  }
}

/** Adds points; the first time the score reaches `ROUND.extraLifeAt`, gives a life (M2.5). */
export function addScore(state: GameState, points: number): void {
  state.score += points;
  if (!state.extraLifeGiven && state.score >= ROUND.extraLifeAt) {
    state.extraLifeGiven = true;
    state.lives = Math.min(state.lives + 1, ROUND.maxLives);
  }
}

/**
 * Puts a bonus battery on the hero's start spot (M3.3). Used when its share of
 * the dots is eaten, and by the e2e test hook.
 */
export function showBonus(state: GameState): void {
  state.bonusShown++;
  state.bonusTime = BONUS.seconds;
}

/** Shows the next battery once its share of the dots is eaten, and runs down the one on show. */
function tickBonus(state: GameState, dt: number): void {
  if (state.bonusTime > 0) {
    state.bonusTime = Math.max(0, state.bonusTime - dt);
    return;
  }
  const share = BONUS.appearAt[state.bonusShown];
  const eaten = state.dotsTotal - state.dotsLeft;
  if (share !== undefined && eaten >= share * state.dotsTotal) showBonus(state);
}

/** Whether the opponents are scattering to their corners or chasing. */
export function modeOf(state: GameState): Mode {
  return currentMode(state.row, state.modeClock);
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
  state.bonusTime = 0;
  enter(state, 'cleared');
}

/** Ends the run at once, as if the last life was lost (used by the e2e hook). */
export function endRun(state: GameState): void {
  state.lives = 0;
  state.paused = false;
  state.bonusTime = 0;
  enter(state, 'gameover');
}

/** True once the "MAZE CLEARED!" pause is over and the next maze should start. */
export function nextMazeDue(state: GameState): boolean {
  return state.phase === 'cleared' && state.phaseTime >= ROUND.clearedSeconds;
}

/** Whether the game can be paused now: not once the run has ended or the maze is cleared. */
export function canPause(state: GameState): boolean {
  return state.phase === 'ready' || state.phase === 'playing' || state.phase === 'dying';
}

/** Pauses or resumes (M4.4). Pausing is ignored when `canPause` is false. */
export function setPaused(state: GameState, paused: boolean): void {
  state.paused = paused && canPause(state);
}

/** Advances the game by `dt` seconds. Returns the dots and pellets eaten. */
export function stepGame(state: GameState, dt: number): Eaten[] {
  if (state.paused) return [];
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
    addScore(state, SCORE[kind]);
    state.dotsLeft--;
    eaten.push({ ...t, kind });
    if (kind === 'pellet') powerUp(state);
    if (state.dotsLeft === 0) {
      state.bonusTime = 0;
      enter(state, 'cleared');
      return eaten;
    }
  }

  if (state.bonusTime > 0 && gap(state.hero, maze.start, maze.width) < BONUS.reach) {
    addScore(state, state.row.bonusPoints);
    state.bonusTime = 0;
    eaten.push({ ...maze.start, kind: 'bonus' });
  } else {
    tickBonus(state, dt);
  }

  if (eaten.some((e) => e.kind !== 'bonus')) {
    state.dotsThisLife++;
    state.sinceDot = 0;
  } else {
    state.sinceDot += dt;
  }

  moveOpponents(state, dt, open);
  for (const o of state.opponents) {
    if (o.state !== 'out' || gap(state.hero, o, maze.width) >= ROUND.catchDistance) continue;
    if (o.scared) {
      // Eaten: points rise with each opponent on the same pellet; the eyes go home.
      addScore(state, SCORE.eaten[Math.min(state.eatChain, SCORE.eaten.length - 1)] ?? 0);
      state.eatChain++;
      o.scared = false;
      o.state = 'eyes';
    } else {
      enter(state, 'dying');
      break;
    }
  }
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
  if (state.scaredTime > 0) {
    // The scatter/chase clock waits while the opponents are scared.
    state.scaredTime = Math.max(0, state.scaredTime - dt);
    if (state.scaredTime === 0) for (const o of state.opponents) o.scared = false;
  } else if (tickMode(state.row, state.modeClock, dt)) {
    reverseAll(state.opponents);
  }
  const ctx = { maze, mode: modeOf(state), hero, murk: tileOf(murk, maze.width) };
  const tunnel = (o: Opponent): boolean => inTunnel(maze, o);
  const specialCtx = {
    row: state.row,
    mode: ctx.mode,
    opponents: state.opponents,
    inTunnel: tunnel,
    hero,
    open,
    maze,
  };
  tickSpecials(state.specials, specialCtx, dt);

  // Release waiting opponents one at a time, in cast order.
  const next = state.opponents.findIndex((o) => o.state === 'waiting');
  if (next >= 0 && mayLeave(next, state.dotsThisLife, state.sinceDot, state.row)) {
    (state.opponents[next] as Opponent).state = 'leaving';
    state.sinceDot = 0;
  }

  const home = eyesTarget(maze);
  const pick = (dirs: readonly Dir[]): Dir =>
    createRng(mixSeed(maze.seed ^ SCARED_RNG_STREAM, state.wanderCount++)).pick(dirs);
  state.opponents.forEach((o, i) => {
    if (o.state === 'eyes') {
      const atHome = (m: Mover): boolean => m.x === home.x && m.y === home.y;
      const toHome = (m: Mover): Dir => chooseShortest(m, home, open, maze.width, maze.height);
      steer(o, OPPONENTS.eyesSpeed * dt, toHome, open, maze.width, atHome);
      if (atHome(o)) o.state = 'entering';
      return;
    }
    if (o.state !== 'out') {
      const speed = o.state === 'entering' ? OPPONENTS.eyesSpeed : OPPONENTS.houseSpeed;
      moveInHouse(o, maze, speed * dt);
      return;
    }
    // Opponents crawl through the tunnel (M2.4); eyes do not.
    const cap = inTunnel(maze, o) ? state.row.tunnelSpeed : Infinity;
    if (o.scared) {
      const wander = (m: Mover): Dir => chooseRandom(m, open, pick);
      steer(o, Math.min(state.row.scaredSpeed, cap) * dt, wander, open, maze.width);
      return;
    }
    const special = state.specials[i];
    const speed = state.row.opponentSpeed * specialSpeed(state.row, i, special);
    if (i === 3 && special && special.phase !== 'ready' && state.row.phase) return; // Phase moves Wisp
    if (i === 2 && special?.phase === 'active' && state.row.dash) {
      // Dash (WW-10): straight on, to the next junction or wall.
      const from = special.from;
      const moved = (m: Mover): boolean => !from || m.x !== from.x || m.y !== from.y;
      const stop = (m: Mover): boolean => moved(m) && dashStops(m, open);
      steer(o, Math.min(speed, cap) * dt, (m) => m.dir, open, maze.width, stop);
      if (Number.isInteger(o.x) && Number.isInteger(o.y) && stop(o)) {
        endDash(special, state.row.dash.cooldown);
      }
      return;
    }
    if (
      i === 1 &&
      special &&
      special.phase !== 'ready' &&
      special.phase !== 'tell' &&
      state.row.lunge
    ) {
      if (special.phase === 'recover') return; // shaking its head
      // Lunge (WW-10): jump straight on to the landing tile (or the wall before it).
      const land = lungeTarget(special, state.row.lunge.jump);
      const from = special.from;
      const moved = (m: Mover): boolean => !from || m.x !== from.x || m.y !== from.y;
      const [dx, dy] = DIR_VEC[o.dir];
      const stop = (m: Mover): boolean =>
        moved(m) &&
        ((land !== null && m.x === land.x && m.y === land.y) || !open(m.x + dx, m.y + dy));
      steer(o, Math.min(speed, cap) * dt, (m) => m.dir, open, maze.width, stop);
      if (Number.isInteger(o.x) && Number.isInteger(o.y) && stop(o)) endLunge(special);
      return;
    }
    const choose = (m: Mover): Dir => chooseToward(m, chaseTarget(o.name, m, ctx), open);
    // Bolt and Gnash halt on the tile centre where their move could start; the tell begins
    // next step (WW-10).
    const startsHere = (m: Mover): boolean => {
      const here = { ...o, ...m };
      if (i === 2) return dashCanStart(state.specials, specialCtx, here) !== null;
      if (i === 1) return lungeCanStart(state.specials, specialCtx, here) !== null;
      if (i === 3) return phaseCanStart(state.specials, specialCtx, here) !== null;
      return false;
    };
    steer(o, Math.min(speed, cap) * dt, choose, open, maze.width, startsHere);
  });
}
