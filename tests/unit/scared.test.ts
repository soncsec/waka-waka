import { describe, expect, it } from 'vitest';
import { eyesPixels, scaredPixels, SPRITE_SIZE } from '../../src/art/sprites';
import { NEON, SCORE, STEP_HZ } from '../../src/config/tuning';
import { levelRow } from '../../src/logic/difficulty';
import { createGame, powerUp, stepGame, type GameState } from '../../src/logic/game';
import { buildMaze, fallbackMaze, isWalkable } from '../../src/logic/maze';
import { chooseRandom, chooseShortest, OPPOSITE, type Mover } from '../../src/logic/movement';
import type { Opponent } from '../../src/logic/opponents';

const DT = 1 / STEP_HZ;

function playing(): GameState {
  const state = createGame(fallbackMaze(1));
  for (let i = 0; i < STEP_HZ * 3 && state.phase !== 'playing'; i++) stepGame(state, DT);
  expect(state.phase).toBe('playing');
  return state;
}

const murkOf = (s: GameState): Opponent => s.opponents[0] as Opponent;

describe('powerUp', () => {
  it('scares and reverses the opponents out in the maze, not the ones in the house', () => {
    const state = playing();
    const murk = murkOf(state);
    const dir = murk.dir;
    powerUp(state);
    expect(state.scaredTime).toBe(levelRow(1).scaredSeconds);
    expect(murk).toMatchObject({ scared: true, dir: OPPOSITE[dir] });
    for (const o of state.opponents.filter((x) => x.state !== 'out')) expect(o.scared).toBe(false);
  });

  it('only turns them around when the row has no scare time', () => {
    const state = playing();
    state.row = { ...state.row, scaredSeconds: 0 };
    const dir = murkOf(state).dir;
    powerUp(state);
    expect(murkOf(state)).toMatchObject({ scared: false, dir: OPPOSITE[dir] });
  });

  it('wears off after the scare time, and the scatter/chase clock waits meanwhile', () => {
    const state = playing();
    powerUp(state);
    const clock = { ...state.modeClock };
    // Only Murk is out, and scared opponents cannot catch the hero.
    for (let i = 0; i < (levelRow(1).scaredSeconds - 0.5) * STEP_HZ; i++) stepGame(state, DT);
    expect(state.phase).toBe('playing');
    expect(murkOf(state).scared).toBe(true);
    expect(state.modeClock).toEqual(clock);
    for (let i = 0; i < STEP_HZ; i++) stepGame(state, DT);
    expect(state.scaredTime).toBe(0);
    expect(state.opponents.some((o) => o.scared)).toBe(false);
  });

  it('slows scared opponents to the scared speed', () => {
    const state = playing();
    powerUp(state);
    const murk = murkOf(state);
    const before = { x: murk.x, y: murk.y };
    stepGame(state, DT);
    const moved = Math.abs(murk.x - before.x) + Math.abs(murk.y - before.y);
    expect(moved).toBeCloseTo(levelRow(1).scaredSpeed * DT, 5);
  });
});

describe('eating scared opponents', () => {
  /** Puts every opponent, scared, on top of the hero. */
  function crowdTheHero(state: GameState): void {
    powerUp(state);
    for (const o of state.opponents) {
      Object.assign(o, { x: state.hero.x, y: state.hero.y, state: 'out', scared: true });
    }
  }

  it('scores 200, 400, 800 and 1600 on one pellet, and turns them into eyes', () => {
    const state = playing();
    const score = state.score;
    crowdTheHero(state);
    stepGame(state, DT);
    expect(state.phase).toBe('playing');
    expect(state.score - score).toBe(200 + 400 + 800 + 1600);
    expect(state.opponents.map((o) => o.state)).toEqual(['eyes', 'eyes', 'eyes', 'eyes']);
    expect(state.opponents.some((o) => o.scared)).toBe(false);
  });

  it('starts the points again on the next pellet; past the table the last value repeats', () => {
    expect(SCORE.eaten).toEqual([200, 400, 800, 1600]);
    const state = playing();
    crowdTheHero(state);
    stepGame(state, DT);
    const score = state.score;
    crowdTheHero(state);
    state.eatChain = 5;
    stepGame(state, DT);
    expect(state.score - score).toBe(4 * 1600);
  });

  it('sends the eyes home, through the door, and out again', () => {
    const state = playing();
    const murk = murkOf(state);
    // Put Murk's eyes far from the house: on the hero's start corridor.
    Object.assign(murk, { x: state.maze.start.x - 0.5, y: state.maze.start.y, state: 'eyes' });
    Object.assign(state.hero, { x: 1, y: 1 });
    const seen = new Set<string>();
    for (let i = 0; i < 20 * STEP_HZ && murk.state !== 'out'; i++) {
      // Keep the hero out of trouble: nobody else can catch it in this test.
      for (const o of state.opponents.slice(1)) Object.assign(o, { state: 'waiting' });
      state.phase = 'playing';
      stepGame(state, DT);
      seen.add(murk.state);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['eyes', 'entering', 'leaving', 'out']));
    expect(murk.state).toBe('out');
  });

  it('eyes get home from far corners of 30 generated mazes', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const maze = buildMaze(seed, 1).maze;
      const corners = [
        [1, 1],
        [maze.width - 2, 1],
        [1, maze.height - 2],
        [maze.width - 2, maze.height - 2],
      ];
      for (const [cx, cy] of corners) {
        // The nearest corridor tile to the corner.
        let start = { x: 0, y: 0 };
        let best = Infinity;
        maze.grid.forEach((row, y) =>
          [...row].forEach((c, x) => {
            const d = Math.abs(x - (cx ?? 0)) + Math.abs(y - (cy ?? 0));
            if (isWalkable(c) && d < best) [best, start] = [d, { x, y }];
          }),
        );
        const state = createGame(maze);
        state.phase = 'playing';
        const murk = murkOf(state);
        Object.assign(murk, { ...start, state: 'eyes', dir: 'up' });
        for (let i = 0; i < 15 * STEP_HZ && murk.state !== 'out'; i++) {
          state.phase = 'playing';
          for (const o of state.opponents.slice(1)) o.state = 'waiting';
          // Keep the hero parked away from Murk so nothing else happens.
          Object.assign(state.hero, { x: -50, y: -50, moving: false });
          stepGame(state, DT);
        }
        expect(murk.state, `seed ${seed} from ${start.x},${start.y}`).toBe('out');
      }
    }
  }, 30_000); // 120 searches across 30 mazes: slow on a busy machine

  it('a scared opponent cannot catch the hero, but eyes pass straight through', () => {
    const state = playing();
    powerUp(state);
    const murk = murkOf(state);
    Object.assign(murk, { x: state.hero.x, y: state.hero.y, state: 'eyes' });
    stepGame(state, DT);
    expect(state.phase).toBe('playing');
  });
});

describe('scared wandering', () => {
  it('chooseRandom never reverses and only takes open directions', () => {
    const m: Mover = { x: 5, y: 5, dir: 'left', moving: true };
    const openAll = (): boolean => true;
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++)
      seen.add(chooseRandom(m, openAll, (d) => d[i % d.length] as never));
    expect(seen).toEqual(new Set(['up', 'left', 'down']));
    const onlyUp = (x: number, y: number): boolean => x === 5 && y === 4;
    expect(chooseRandom(m, onlyUp, (d) => d[0] as never)).toBe('up');
    const walled = (): boolean => false;
    expect(chooseRandom(m, walled, (d) => d[0] as never)).toBe('right');
  });

  it('is the same every time for the same seed (ADR-006)', () => {
    const run = (): string => {
      const state = playing();
      powerUp(state);
      for (let i = 0; i < 4 * STEP_HZ; i++) stepGame(state, DT);
      return JSON.stringify(state.opponents);
    };
    expect(run()).toBe(run());
  });
});

describe('chooseShortest', () => {
  it('takes the first step of a shortest path, even if that means turning back', () => {
    // A ring corridor: from (1,1) facing right, the target (1,3) is two steps down.
    const grid = ['#####', '#   #', '# # #', '#   #', '#####'];
    const open = (x: number, y: number): boolean => grid[y]?.[x] === ' ';
    const m: Mover = { x: 1, y: 1, dir: 'right', moving: true };
    expect(chooseShortest(m, { x: 1, y: 3 }, open, 5, 5)).toBe('down');
    expect(chooseShortest({ ...m, dir: 'up' }, { x: 3, y: 1 }, open, 5, 5)).toBe('right');
  });
});

describe('scared and eyes art', () => {
  it('keeps each opponent its shape but paints it blue, or white when flashing', () => {
    for (const who of [0, 1, 2, 3] as const) {
      const art = scaredPixels(who, 'scared', 0);
      expect(art.width).toBe(SPRITE_SIZE);
      const colours = new Set<number>();
      for (let i = 0; i < art.data.length; i += 4) {
        if (art.data[i + 3] === 0) continue;
        colours.add(
          ((art.data[i] ?? 0) << 16) | ((art.data[i + 1] ?? 0) << 8) | (art.data[i + 2] ?? 0),
        );
      }
      expect(colours.has(NEON.scared)).toBe(true);
      expect(colours.has(NEON.opponents[who])).toBe(false);
      const flash = scaredPixels(who, 'flash', 0);
      expect(flash.data).not.toEqual(art.data);
    }
  });

  it('draws eaten opponents as eyes only, looking the way they go', () => {
    const up = eyesPixels('up');
    const down = eyesPixels('down');
    expect(up.data).not.toEqual(down.data);
    const opaque = [...up.data].filter((_, i) => i % 4 === 3 && up.data[i] !== 0).length;
    expect(opaque).toBeGreaterThan(10);
    expect(opaque).toBeLessThan((SPRITE_SIZE * SPRITE_SIZE) / 4);
  });
});
