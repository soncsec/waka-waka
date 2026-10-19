import { describe, expect, it } from 'vitest';
import { OPPONENTS, ROUND, STEP_HZ } from '../../src/config/tuning';
import { levelRow } from '../../src/logic/difficulty';
import { createGame, stepGame, type GameState } from '../../src/logic/game';
import { fallbackMaze, type Maze } from '../../src/logic/maze';
import { OPPOSITE } from '../../src/logic/movement';
import {
  chaseTarget,
  createOpponents,
  homeCorner,
  houseExit,
  mayLeave,
  moveInHouse,
  opponentStart,
  reverseAll,
  type Opponent,
  type TargetContext,
} from '../../src/logic/opponents';

const DT = 1 / STEP_HZ;
const maze = fallbackMaze(1);
const row = levelRow(1);

function ctx(hero: TargetContext['hero'], murk = { x: 0, y: 0 }): TargetContext {
  return { maze, mode: 'chase', hero, murk };
}

describe('the cast', () => {
  it('starts with Murk at the door and the others spaced inside the house', () => {
    const cast = createOpponents(maze);
    expect(cast.map((o) => o.name)).toEqual(['murk', 'gnash', 'bolt', 'wisp']);
    expect(cast[0]).toMatchObject({ ...houseExit(maze), state: 'out', dir: OPPONENTS.startDir });
    const middle = (maze.house.y0 + maze.house.y1) / 2;
    expect(opponentStart(maze, 'gnash')).toEqual({ x: maze.start.x, y: middle });
    expect(opponentStart(maze, 'bolt').x).toBe(maze.start.x - OPPONENTS.houseSpacing);
    expect(opponentStart(maze, 'wisp').x).toBe(maze.start.x + OPPONENTS.houseSpacing);
    expect(cast.slice(1).every((o) => o.state === 'waiting' && o.dir === 'up')).toBe(true);
  });

  it('gives each opponent its own corner outside the maze', () => {
    const corners = ['murk', 'gnash', 'bolt', 'wisp'].map((n) =>
      homeCorner(maze, n as Opponent['name']),
    );
    expect(new Set(corners.map((c) => `${c.x},${c.y}`)).size).toBe(4);
    for (const c of corners) {
      expect(c.x < 0 || c.x > maze.width - 1).toBe(true);
      expect(c.y < 0 || c.y > maze.height - 1).toBe(true);
    }
  });
});

describe('chaseTarget', () => {
  const hero = { x: 10, y: 10, dir: 'right' as const };

  it('Murk aims at the hero', () => {
    expect(chaseTarget('murk', { x: 0, y: 0 }, ctx(hero))).toEqual({ x: 10, y: 10 });
  });

  it('Gnash aims ahead of the hero', () => {
    expect(chaseTarget('gnash', { x: 0, y: 0 }, ctx(hero))).toEqual({
      x: 10 + OPPONENTS.gnashAhead,
      y: 10,
    });
    expect(chaseTarget('gnash', { x: 0, y: 0 }, ctx({ ...hero, dir: 'up' }))).toEqual({
      x: 10,
      y: 10 - OPPONENTS.gnashAhead,
    });
  });

  it('Bolt flanks: the point ahead of the hero, doubled away from Murk', () => {
    const murk = { x: 6, y: 10 };
    const pivot = { x: 10 + OPPONENTS.boltAhead, y: 10 };
    expect(chaseTarget('bolt', { x: 0, y: 0 }, ctx(hero, murk))).toEqual({
      x: 2 * pivot.x - murk.x,
      y: 2 * pivot.y - murk.y,
    });
  });

  it('Wisp chases from afar and retreats to its corner up close', () => {
    const far = { x: 10 + OPPONENTS.wispShyDistance + 1, y: 10 };
    const near = { x: 10 + OPPONENTS.wispShyDistance - 1, y: 10 };
    expect(chaseTarget('wisp', far, ctx(hero))).toEqual({ x: 10, y: 10 });
    expect(chaseTarget('wisp', near, ctx(hero))).toEqual(homeCorner(maze, 'wisp'));
  });
});

describe('scatter', () => {
  it('sends every opponent to its own corner, whatever the hero does', () => {
    const hero = { x: 10, y: 10, dir: 'left' as const };
    for (const name of ['murk', 'gnash', 'bolt', 'wisp'] as const) {
      expect(chaseTarget(name, { x: 3, y: 3 }, { ...ctx(hero), mode: 'scatter' })).toEqual(
        homeCorner(maze, name),
      );
    }
  });
});

describe('reverseAll', () => {
  it('turns around the opponents out in the maze and leaves the house alone', () => {
    const cast = createOpponents(maze);
    reverseAll(cast);
    expect(cast[0]?.dir).toBe(OPPOSITE[OPPONENTS.startDir]);
    expect(cast.slice(1).map((o) => o.dir)).toEqual(['up', 'up', 'up']);
  });
});

describe('mayLeave', () => {
  it('releases each opponent after its dot count, or when the hero idles', () => {
    expect(mayLeave(1, 0, 0, row)).toBe(true);
    expect(mayLeave(2, row.releaseDots[2] - 1, 0, row)).toBe(false);
    expect(mayLeave(2, row.releaseDots[2], 0, row)).toBe(true);
    expect(mayLeave(3, 0, row.releaseIdleSeconds - 0.1, row)).toBe(false);
    expect(mayLeave(3, 0, row.releaseIdleSeconds, row)).toBe(true);
  });
});

describe('moveInHouse', () => {
  it('bobs a waiting opponent between the bob limits', () => {
    const [, gnash] = createOpponents(maze) as [Opponent, Opponent];
    const middle = gnash.y;
    const ys: number[] = [];
    for (let i = 0; i < 3 * STEP_HZ; i++) {
      expect(moveInHouse(gnash, maze, OPPONENTS.houseSpeed * DT)).toBe(false);
      ys.push(gnash.y);
    }
    expect(Math.min(...ys)).toBeCloseTo(middle - OPPONENTS.bob, 5);
    expect(Math.max(...ys)).toBeCloseTo(middle + OPPONENTS.bob, 5);
    expect(gnash.x).toBe(maze.start.x);
  });

  it('walks a leaving opponent to the door column, then up and out', () => {
    const [, , bolt] = createOpponents(maze) as [Opponent, Opponent, Opponent];
    bolt.state = 'leaving';
    const exit = houseExit(maze);
    let out = false;
    for (let i = 0; i < 10 * STEP_HZ && !out; i++) {
      out = moveInHouse(bolt, maze, OPPONENTS.houseSpeed * DT);
      if (bolt.y < exit.y + 1 && bolt.y !== exit.y) expect(bolt.x).toBe(exit.x);
    }
    expect(out).toBe(true);
    expect(bolt).toMatchObject({ ...exit, state: 'out', dir: OPPONENTS.startDir });
  });
});

describe('the release order in a game', () => {
  /** The hero's corridor is sealed off from the house exit, so nobody can catch it. */
  const sealed = (): Maze => ({
    seed: 0,
    width: 6,
    height: 5,
    grid: ['######', '#.  o#', '######', '#    #', '######'],
    start: { x: 2.5, y: 1 },
    house: { x0: 0, x1: 0, y0: 4, y1: 4 },
    tunnelY: -1,
  });
  const states = (s: GameState): string[] => s.opponents.map((o) => o.state);

  it('lets Gnash out straight away, and the rest as the hero idles', () => {
    const state = createGame(sealed());
    const run = (seconds: number): void => {
      for (let i = 0; i < seconds * STEP_HZ; i++) stepGame(state, DT);
    };
    run(ROUND.readySeconds + 0.5);
    expect(state.phase).toBe('playing');
    expect(states(state)[1]).not.toBe('waiting');
    expect(states(state).slice(2)).toEqual(['waiting', 'waiting']);
    // The hero stops at the wall and eats nothing: the idle rule frees Bolt, then Wisp.
    run(row.releaseIdleSeconds + 0.5);
    expect(states(state)[2]).not.toBe('waiting');
    expect(states(state)[3]).toBe('waiting');
    run(row.releaseIdleSeconds + 0.5);
    expect(states(state)[3]).not.toBe('waiting');
    run(3);
    expect(states(state)).toEqual(['out', 'out', 'out', 'out']);
  });
});
