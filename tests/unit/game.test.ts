import { describe, expect, it } from 'vitest';
import { HERO, OPPONENTS, ROUND, SCORE, STEP_HZ } from '../../src/config/tuning';
import {
  addScore,
  clearMaze,
  createGame,
  modeOf,
  nextMazeDue,
  setWanted,
  stepGame,
  tileAt,
  type GameState,
} from '../../src/logic/game';
import { levelRow } from '../../src/logic/difficulty';
import { fallbackMaze, TILE, validateMaze, type Maze } from '../../src/logic/maze';
import { houseExit, OPPONENT_NAMES } from '../../src/logic/opponents';

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
    const murk = state.opponents[0];
    expect(state.opponents.map((o) => o.name)).toEqual([...OPPONENT_NAMES]);
    expect(murk).toMatchObject({ ...houseExit(maze), dir: OPPONENTS.startDir, state: 'out' });
    expect(tileAt(state, Math.floor(murk?.x ?? 0), murk?.y ?? 0)).toBe(TILE.empty);
    expect(state.opponents.slice(1).map((o) => o.state)).toEqual(['waiting', 'waiting', 'waiting']);
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
    expect(state.hero.x).toBeCloseTo(2.5 - levelRow(1).heroSpeed * DT);
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

  it('keeps the hero and the opponents out hunting on corridors in a real maze', () => {
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
      for (const o of state.opponents) if (o.state === 'out') expect(onCorridor(o)).toBe(true);
    }
  });

  it('has an opponent hunt down a hero that stands still', () => {
    const state = createGame(fallbackMaze(1));
    play(state);
    runUntil(state, () => state.phase === 'dying');
    const nearest = Math.min(
      ...state.opponents
        .filter((o) => o.state === 'out')
        .map((o) => Math.abs(state.hero.x - o.x) + Math.abs(state.hero.y - o.y)),
    );
    expect(nearest).toBeLessThan(ROUND.catchDistance);
  });

  it('takes a life when caught, then resets everyone but keeps eaten dots', () => {
    const state = createGame(fallbackMaze(1));
    play(state);
    runUntil(state, () => state.phase === 'dying');
    const { score, dotsLeft } = state;
    runUntil(state, () => state.phase === 'ready');
    expect(state.lives).toBe(ROUND.lives - 1);
    expect(state.hero).toMatchObject(state.maze.start);
    expect(state.opponents[0]).toMatchObject({ ...houseExit(state.maze), state: 'out' });
    expect(state.opponents.slice(1).every((o) => o.state === 'waiting')).toBe(true);
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

describe('scatter and chase in a game', () => {
  it('starts in scatter, reverses Murk on the switch to chase, and restarts the clock each life', () => {
    const state = createGame(fallbackMaze(1));
    play(state);
    expect(modeOf(state)).toBe('scatter');
    const first = levelRow(1).modes[0]?.seconds ?? 0;
    // Step until just before the switch, note Murk's direction, then cross it.
    runUntil(state, () => state.modeClock.time >= first - DT * 1.5 || state.phase !== 'playing');
    expect(state.phase).toBe('playing');
    const murk = state.opponents[0];
    const before = murk?.dir;
    stepGame(state, DT);
    stepGame(state, DT);
    expect(modeOf(state)).toBe('chase');
    // Reversed on the switch step; it may turn again at a tile centre, but never
    // keeps going the old way on that same step.
    expect(murk?.dir).not.toBe(before);
  });

  it('starts every life in scatter', () => {
    const state = createGame(fallbackMaze(1));
    runUntil(state, () => state.phase === 'dying', 120);
    runUntil(state, () => state.phase === 'ready');
    expect(state.modeClock).toEqual({ index: 0, time: 0 });
    expect(modeOf(state)).toBe('scatter');
  });
});

describe('the extra life (M2.5)', () => {
  it('gives one life when the score first reaches the threshold, and only once', () => {
    const state = createGame(corridors());
    addScore(state, ROUND.extraLifeAt - 10);
    expect(state.lives).toBe(ROUND.lives);
    addScore(state, 10);
    expect(state).toMatchObject({ lives: ROUND.lives + 1, extraLifeGiven: true });
    addScore(state, ROUND.extraLifeAt * 3);
    expect(state.lives).toBe(ROUND.lives + 1);
  });

  it('is not given again on the next maze', () => {
    const state = createGame(corridors(), {
      level: 2,
      carry: { score: ROUND.extraLifeAt + 5, lives: 2, extraLifeGiven: true },
    });
    addScore(state, 100);
    expect(state.lives).toBe(2);
  });

  it('never goes past the most lives the HUD can show', () => {
    const state = createGame(corridors(), {
      carry: { score: 0, lives: ROUND.maxLives, extraLifeGiven: false },
    });
    addScore(state, ROUND.extraLifeAt);
    expect(state.lives).toBe(ROUND.maxLives);
  });
});

describe('the next maze', () => {
  it('keeps the score and lives carried over from the last maze', () => {
    const state = createGame(corridors(), {
      level: 2,
      carry: { score: 1230, lives: 2, extraLifeGiven: true },
    });
    expect(state.level).toBe(2);
    expect(state).toMatchObject({ score: 1230, lives: 2, extraLifeGiven: true, phase: 'ready' });
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
