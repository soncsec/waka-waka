import { describe, expect, it } from 'vitest';
import { HERO, SCORE, STEP_HZ } from '../../src/config/tuning';
import { createGame, setWanted, stepGame, tileAt, type GameState } from '../../src/logic/game';
import { fallbackMaze, TILE, validateMaze, type Maze } from '../../src/logic/maze';

const DT = 1 / STEP_HZ;

/** Steps until `done` is true, failing after `maxSeconds` of game time. */
function runUntil(state: GameState, done: () => boolean, maxSeconds = 10): void {
  for (let t = 0; t < maxSeconds * STEP_HZ; t++) {
    if (done()) return;
    stepGame(state, DT);
  }
  throw new Error('condition not reached');
}

/** A one-corridor maze: a dot on the left, a pellet on the right. */
function corridor(): Maze {
  return {
    seed: 0,
    width: 6,
    height: 3,
    grid: ['######', '#.  o#', '######'],
    start: { x: 2.5, y: 1 },
    house: { x0: 0, x1: 0, y0: 0, y1: 0 },
    tunnelY: -1,
  };
}

describe('createGame', () => {
  it('puts the hero on the start, facing the start direction, with every dot left', () => {
    const maze = fallbackMaze(1);
    const state = createGame(maze);
    expect(state.hero).toMatchObject({ ...maze.start, dir: HERO.startDir });
    const { dots, pellets } = validateMaze(maze).stats;
    expect(state.dotsLeft).toBe(dots + pellets);
    expect(state.score).toBe(0);
    expect(state.cleared).toBe(false);
  });
});

describe('stepGame', () => {
  it('moves the hero at its tuned speed', () => {
    const state = createGame(corridor());
    stepGame(state, DT);
    expect(state.hero.x).toBeCloseTo(2.5 - HERO.speed * DT);
  });

  it('eats dots and pellets for points until the maze is cleared', () => {
    const state = createGame(corridor());
    runUntil(state, () => state.score > 0);
    expect(state.score).toBe(SCORE.dot);
    expect(tileAt(state, 1, 1)).toBe(TILE.empty);

    setWanted(state, 'right');
    runUntil(state, () => state.cleared);
    expect(state.score).toBe(SCORE.dot + SCORE.pellet);
    expect(state.dotsLeft).toBe(0);

    const before = { ...state.hero };
    expect(stepGame(state, DT)).toEqual([]);
    expect(state.hero).toEqual(before);
  });

  it('reports what was eaten and where', () => {
    const state = createGame(corridor());
    const eaten = [];
    for (let i = 0; i < STEP_HZ && eaten.length === 0; i++) eaten.push(...stepGame(state, DT));
    expect(eaten).toEqual([{ x: 1, y: 1, kind: 'dot' }]);
  });

  it('keeps the hero on corridors in a real maze while turning at random', () => {
    const state = createGame(fallbackMaze(1));
    const dirs = ['up', 'down', 'left', 'right'] as const;
    for (let t = 0; t < 60 * STEP_HZ; t++) {
      if (t % 20 === 0) setWanted(state, dirs[(t / 20) % 4] ?? 'left');
      stepGame(state, DT);
      const { x, y } = state.hero;
      const near = [
        tileAt(state, Math.floor(x), Math.floor(y)),
        tileAt(state, Math.ceil(x), Math.ceil(y)),
      ];
      expect(near.every((c) => c === TILE.dot || c === TILE.pellet || c === TILE.empty)).toBe(true);
    }
    expect(state.score).toBeGreaterThan(0);
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
