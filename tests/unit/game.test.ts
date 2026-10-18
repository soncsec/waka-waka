import { describe, expect, it } from 'vitest';
import { HERO, MURK, ROUND, SCORE, STEP_HZ } from '../../src/config/tuning';
import {
  clearMaze,
  createGame,
  murkStart,
  nextMazeDue,
  setWanted,
  stepGame,
  tileAt,
  type GameState,
} from '../../src/logic/game';
import { fallbackMaze, TILE, validateMaze, type Maze } from '../../src/logic/maze';

const DT = 1 / STEP_HZ;

/** Steps until `done` is true, failing after `maxSeconds` of game time. */
function runUntil(state: GameState, done: () => boolean, maxSeconds = 30): void {
  for (let t = 0; t < maxSeconds * STEP_HZ; t++) {
    if (done()) return;
    stepGame(state, DT);
  }
  throw new Error('condition not reached');
}

const play = (state: GameState): void => runUntil(state, () => state.phase === 'playing');

/**
 * Two separate corridors: the hero's (a dot on the left, a pellet on the right)
 * and, two rows down, Murk's, so Murk can never reach the hero.
 */
function corridors(): Maze {
  return {
    seed: 0,
    width: 6,
    height: 5,
    grid: ['######', '#.  o#', '######', '#    #', '######'],
    start: { x: 2.5, y: 1 },
    house: { x0: 0, x1: 0, y0: 4, y1: 4 },
    tunnelY: -1,
  };
}

describe('createGame', () => {
  it('starts in the READY pause with full lives, every dot, and everyone on their start', () => {
    const maze = fallbackMaze(1);
    const state = createGame(maze);
    expect(state.phase).toBe('ready');
    expect(state.lives).toBe(ROUND.lives);
    expect(state.hero).toMatchObject({ ...maze.start, dir: HERO.startDir });
    expect(state.murk).toMatchObject({ ...murkStart(maze), dir: MURK.startDir });
    expect(tileAt(state, Math.floor(state.murk.x), state.murk.y)).toBe(TILE.empty);
    const { dots, pellets } = validateMaze(maze).stats;
    expect(state.dotsLeft).toBe(dots + pellets);
    expect(state.score).toBe(0);
  });
});

describe('stepGame', () => {
  it('holds everyone still during READY but keeps a buffered direction', () => {
    const state = createGame(corridors());
    setWanted(state, 'right');
    stepGame(state, DT);
    expect(state.hero.x).toBe(2.5);
    expect(state.wanted).toBe('right');
    play(state);
    expect(state.phaseTime).toBeLessThan(DT * 2);
  });

  it('moves the hero at its tuned speed once playing', () => {
    const state = createGame(corridors());
    play(state);
    stepGame(state, DT);
    expect(state.hero.x).toBeCloseTo(2.5 - HERO.speed * DT);
  });

  it('eats dots and pellets for points until the maze is cleared', () => {
    const state = createGame(corridors());
    play(state);
    runUntil(state, () => state.score > 0);
    expect(state.score).toBe(SCORE.dot);
    expect(tileAt(state, 1, 1)).toBe(TILE.empty);

    setWanted(state, 'right');
    runUntil(state, () => state.phase === 'cleared');
    expect(state.score).toBe(SCORE.dot + SCORE.pellet);
    expect(state.dotsLeft).toBe(0);

    const before = { ...state.hero };
    expect(stepGame(state, DT)).toEqual([]);
    expect(state.hero).toEqual(before);
  });

  it('reports what was eaten and where', () => {
    const state = createGame(corridors());
    play(state);
    const eaten = [];
    for (let i = 0; i < STEP_HZ && eaten.length === 0; i++) eaten.push(...stepGame(state, DT));
    expect(eaten).toEqual([{ x: 1, y: 1, kind: 'dot' }]);
  });

  it('keeps the hero and Murk on corridors in a real maze', () => {
    const state = createGame(fallbackMaze(1));
    const dirs = ['up', 'down', 'left', 'right'] as const;
    const onCorridor = ({ x, y }: { x: number; y: number }): boolean =>
      [
        tileAt(state, Math.floor(x), Math.floor(y)),
        tileAt(state, Math.ceil(x), Math.ceil(y)),
      ].every((c) => c === TILE.dot || c === TILE.pellet || c === TILE.empty);
    for (let t = 0; t < 60 * STEP_HZ; t++) {
      if (t % 20 === 0) setWanted(state, dirs[(t / 20) % 4] ?? 'left');
      stepGame(state, DT);
      expect(onCorridor(state.hero)).toBe(true);
      expect(onCorridor(state.murk)).toBe(true);
    }
  });

  it('has Murk hunt down a hero that stands still', () => {
    const state = createGame(fallbackMaze(1));
    play(state);
    runUntil(state, () => state.phase === 'dying');
    expect(
      Math.abs(state.hero.x - state.murk.x) + Math.abs(state.hero.y - state.murk.y),
    ).toBeLessThan(ROUND.catchDistance);
  });

  it('takes a life when caught, then resets everyone but keeps eaten dots', () => {
    const state = createGame(fallbackMaze(1));
    play(state);
    runUntil(state, () => state.phase === 'dying');
    const { score, dotsLeft } = state;
    runUntil(state, () => state.phase === 'ready');
    expect(state.lives).toBe(ROUND.lives - 1);
    expect(state.hero).toMatchObject(state.maze.start);
    expect(state.murk).toMatchObject(murkStart(state.maze));
    expect([state.score, state.dotsLeft]).toEqual([score, dotsLeft]);
  });

  it('ends the game when the last life is lost, and then stays still', () => {
    const state = createGame(fallbackMaze(1));
    runUntil(state, () => state.phase === 'gameover', 120);
    expect(state.lives).toBe(0);
    const before = structuredClone(state);
    for (let i = 0; i < STEP_HZ; i++) stepGame(state, DT);
    expect({ ...state, phaseTime: 0 }).toEqual({ ...before, phaseTime: 0 });
  });
});

describe('the next maze', () => {
  it('keeps the score and lives carried over from the last maze', () => {
    const state = createGame(corridors(), { score: 1230, lives: 2 });
    expect(state).toMatchObject({ score: 1230, lives: 2, phase: 'ready' });
    expect(state.dotsLeft).toBe(2);
  });

  it('clearMaze eats everything left and ends the maze', () => {
    const state = createGame(corridors());
    clearMaze(state);
    expect(state.phase).toBe('cleared');
    expect(state.dotsLeft).toBe(0);
    expect(state.tiles.flat()).not.toContain(TILE.dot);
    expect(state.tiles.flat()).not.toContain(TILE.pellet);
  });

  it('is due once the MAZE CLEARED pause is over', () => {
    const state = createGame(corridors());
    expect(nextMazeDue(state)).toBe(false);
    clearMaze(state);
    expect(nextMazeDue(state)).toBe(false);
    runUntil(state, () => state.phaseTime >= ROUND.clearedSeconds);
    expect(state.phase).toBe('cleared');
    expect(nextMazeDue(state)).toBe(true);
  });
});

describe('tileAt', () => {
  it('wraps left-right on the tunnel row only', () => {
    const state = createGame(fallbackMaze(1));
    const { tunnelY, width } = state.maze;
    expect(tileAt(state, -1, tunnelY)).toBe(tileAt(state, width - 1, tunnelY));
    expect(tileAt(state, -1, 1)).toBeUndefined();
  });
});
