import { describe, expect, it } from 'vitest';
import { NEON, STEP_HZ, type LevelRow } from '../../src/config/tuning';
import { dashPixels, lungePixels, opponentPixels } from '../../src/art/sprites';
import { levelRow } from '../../src/logic/difficulty';
import { createGame, powerUp, stepGame, type GameState } from '../../src/logic/game';
import { fallbackMaze } from '../../src/logic/maze';
import { createOpponents, type Opponent } from '../../src/logic/opponents';
import {
  createSpecials,
  dashAim,
  dashStops,
  endDash,
  lungeCanStart,
  othersBusy,
  phaseCanStart,
  phaseExit,
  primeSpecial,
  specialSpeed,
  tickSpecials,
  type SpecialContext,
} from '../../src/logic/specials';

const DT = 1 / STEP_HZ;
const maze = fallbackMaze(1);
const row = levelRow(1);
const frenzy = row.frenzy as NonNullable<LevelRow['frenzy']>;

function ctx(over: Partial<SpecialContext> = {}): SpecialContext {
  return {
    row,
    mode: 'chase',
    opponents: createOpponents(maze),
    inTunnel: () => false,
    hero: { x: 1, y: 25 },
    open: () => true,
    maze,
    ...over,
  };
}

/** Ticks for `seconds` of game time. */
function run(
  specials: ReturnType<typeof createSpecials>,
  c: SpecialContext,
  seconds: number,
): void {
  for (let i = 0; i < Math.round(seconds * STEP_HZ); i++) tickSpecials(specials, c, DT);
}

describe('Frenzy (WW-10)', () => {
  it('row 1 has Frenzy on, with a tell of at least 0.5 s that slows Murk', () => {
    expect(row.frenzy).not.toBeNull();
    expect(frenzy.tell).toBeGreaterThanOrEqual(0.5);
    expect(frenzy.tellSpeed).toBeLessThan(1);
    expect(frenzy.factor).toBeGreaterThan(1);
  });

  it('charges only during chase, then tells, bursts and resets', () => {
    const s = createSpecials();
    run(s, ctx({ mode: 'scatter' }), frenzy.every + 5);
    expect(s[0]).toMatchObject({ phase: 'ready', charge: 0 });
    const c = ctx();
    run(s, c, frenzy.every - 0.5);
    expect(s[0]?.phase).toBe('ready');
    run(s, c, 0.6);
    expect(s[0]?.phase).toBe('tell');
    run(s, c, frenzy.tell);
    expect(s[0]?.phase).toBe('active');
    run(s, c, frenzy.burst + 0.1);
    // Back to ready, charging from zero again (chase goes on).
    expect(s[0]?.phase).toBe('ready');
    expect(s[0]?.charge).toBeLessThan(0.2);
  });

  it('slows Murk during the tell and speeds it up during the burst', () => {
    const s = createSpecials();
    expect(specialSpeed(row, 0, s[0])).toBe(1);
    primeSpecial(s, 0);
    tickSpecials(s, ctx(), DT);
    expect(specialSpeed(row, 0, s[0])).toBe(frenzy.tellSpeed);
    run(s, ctx(), frenzy.tell);
    expect(specialSpeed(row, 0, s[0])).toBe(frenzy.factor);
    // Other opponents are unaffected.
    expect(specialSpeed(row, 1, s[0])).toBe(1);
  });

  it('waits while another opponent is mid-move (one at a time)', () => {
    // Bolt is mid-Dash (maze 2 has Dash on).
    const c = ctx({ row: levelRow(2) });
    Object.assign(c.opponents[2] as Opponent, { state: 'out', x: 5, y: 1 });
    const s = createSpecials();
    (s[2] as { phase: string }).phase = 'active';
    expect(othersBusy(s, 0)).toBe(true);
    primeSpecial(s, 0);
    run(s, c, 1);
    expect(s[0]?.phase).toBe('ready');
  });

  it('does not start in the tunnel', () => {
    const s = createSpecials();
    primeSpecial(s, 0);
    run(s, ctx({ inTunnel: () => true }), 1);
    expect(s[0]?.phase).toBe('ready');
  });

  it('stops at once if Murk is scared, eaten or back in the house', () => {
    for (const change of [{ scared: true }, { state: 'eyes' }, { state: 'entering' }] as const) {
      const s = createSpecials();
      const c = ctx();
      primeSpecial(s, 0);
      run(s, c, 0.1);
      expect(s[0]?.phase).toBe('tell');
      Object.assign(c.opponents[0] as Opponent, change);
      tickSpecials(s, c, DT);
      expect(s[0]).toMatchObject({ phase: 'ready', charge: 0 });
    }
  });

  it('stays off on a row without Frenzy', () => {
    const s = createSpecials();
    primeSpecial(s, 0);
    run(s, ctx({ row: { ...row, frenzy: null } }), 2);
    expect(s[0]?.phase).toBe('ready');
  });
});

describe('Frenzy in a game', () => {
  function chasing(): GameState {
    const state = createGame(maze);
    state.phase = 'playing';
    state.modeClock = { index: 1, time: 0 }; // chase
    return state;
  }

  it('moves Murk slower in the tell and faster in the burst', () => {
    const state = chasing();
    const murk = state.opponents[0] as Opponent;
    const stepDistance = (): number => {
      const before = { x: murk.x, y: murk.y };
      Object.assign(state.hero, { x: 1, y: 25 });
      stepGame(state, DT);
      return Math.abs(murk.x - before.x) + Math.abs(murk.y - before.y);
    };
    expect(stepDistance()).toBeCloseTo(row.opponentSpeed * DT, 5);
    primeSpecial(state.specials, 0);
    expect(stepDistance()).toBeCloseTo(row.opponentSpeed * frenzy.tellSpeed * DT, 5);
    for (let i = 0; i < frenzy.tell * STEP_HZ; i++) stepDistance();
    expect(state.specials[0]?.phase).toBe('active');
    expect(stepDistance()).toBeCloseTo(row.opponentSpeed * frenzy.factor * DT, 5);
  });

  it('a power pellet cancels it, and a new life starts with it ready', () => {
    const state = chasing();
    primeSpecial(state.specials, 0);
    stepGame(state, DT);
    expect(state.specials[0]?.phase).toBe('tell');
    powerUp(state);
    stepGame(state, DT);
    expect(state.specials[0]?.phase).toBe('ready');
    state.phase = 'dying';
    state.phaseTime = 99;
    stepGame(state, DT);
    expect(state.specials.every((s) => s.phase === 'ready' && s.charge === 0)).toBe(true);
  });
});

describe('Frenzy tell art', () => {
  it('draws Murk white-hot, in the same shape', () => {
    const normal = opponentPixels(0, 'left', 0);
    const hot = opponentPixels(0, 'left', 0, NEON.frenzyHot);
    const alpha = (d: Uint8ClampedArray): number[] => [...d].filter((_, i) => i % 4 === 3);
    expect(alpha(hot.data)).toEqual(alpha(normal.data));
    expect(hot.data).not.toEqual(normal.data);
  });
});

describe('Dash (WW-10)', () => {
  const row2 = levelRow(2);
  const dash = row2.dash as NonNullable<LevelRow['dash']>;
  // A ring corridor with one junction at (4,1): a spur goes down from it.
  const grid = ['#########', '#.......#', '#.##.##.#', '#.......#', '#########'];
  const open = (x: number, y: number): boolean => (grid[y]?.[x] ?? '#') !== '#';

  it('is off on maze 1 and on from maze 2, with a tell of at least 0.5 s', () => {
    expect(levelRow(1).dash).toBeNull();
    expect(dash.tell).toBeGreaterThanOrEqual(0.5);
    expect(dash.factor).toBeGreaterThan(1);
  });

  it('dashAim sees the hero straight down an open corridor within range', () => {
    expect(dashAim({ x: 1, y: 1 }, { x: 6, y: 1 }, open, 8)).toBe('right');
    expect(dashAim({ x: 1, y: 1 }, { x: 1, y: 3 }, open, 8)).toBe('down');
    expect(dashAim({ x: 1, y: 1 }, { x: 6, y: 1 }, open, 4)).toBeNull(); // out of range
    expect(dashAim({ x: 1, y: 1 }, { x: 6, y: 3 }, open, 8)).toBeNull(); // not in line
    expect(dashAim({ x: 2, y: 1 }, { x: 2, y: 3 }, open, 8)).toBeNull(); // wall between
    expect(dashAim({ x: 1.5, y: 1 }, { x: 6, y: 1 }, open, 8)).toBeNull(); // not at a centre
  });

  it('dashStops at a junction or a wall ahead', () => {
    expect(dashStops({ x: 4, y: 1, dir: 'right' }, open)).toBe(true); // junction
    expect(dashStops({ x: 7, y: 1, dir: 'right' }, open)).toBe(true); // wall
    expect(dashStops({ x: 2, y: 1, dir: 'right' }, open)).toBe(false);
  });

  it('takes aim when the hero is in sight: Bolt faces it and stands still for the tell', () => {
    const c = ctx({ row: row2, hero: { x: 6, y: 1 }, open });
    Object.assign(c.opponents[2] as Opponent, { state: 'out', x: 1, y: 1, dir: 'up' });
    const s = createSpecials();
    tickSpecials(s, c, DT);
    expect(s[2]).toMatchObject({ phase: 'tell', aim: 'right', from: { x: 1, y: 1 } });
    expect((c.opponents[2] as Opponent).dir).toBe('right');
    expect(specialSpeed(row2, 2, s[2])).toBe(0);
    run(s, c, dash.tell);
    expect(s[2]?.phase).toBe('active');
    expect(specialSpeed(row2, 2, s[2])).toBe(dash.factor);
  });

  it('waits for its cooldown after a dash, and for Frenzy to finish', () => {
    const c = ctx({ row: row2, hero: { x: 6, y: 1 }, open });
    Object.assign(c.opponents[2] as Opponent, { state: 'out', x: 1, y: 1 });
    const s = createSpecials();
    endDash(s[2] as NonNullable<(typeof s)[2]>, dash.cooldown);
    run(s, c, dash.cooldown - 0.5);
    expect(s[2]?.phase).toBe('ready');
    run(s, c, 0.6);
    expect(s[2]?.phase).toBe('tell');

    const t = createSpecials();
    (t[0] as { phase: string }).phase = 'active';
    Object.assign(c.opponents[0] as Opponent, { state: 'out' });
    tickSpecials(
      t,
      {
        ...c,
        row: {
          ...row2,
          frenzy: { ...(row2.frenzy as NonNullable<LevelRow['frenzy']>), burst: 99 },
        },
      },
      DT,
    );
    expect(t[2]?.phase).toBe('ready');
  });

  it('in a game, Bolt shoots straight at dash speed and stops at the junction', () => {
    const corridorMaze = {
      seed: 0,
      width: 9,
      height: 5,
      grid,
      start: { x: 6, y: 3 },
      house: { x0: 0, x1: 0, y0: 4, y1: 4 },
      tunnelY: -1,
    };
    const state = createGame(corridorMaze, { level: 2 });
    state.phase = 'playing';
    state.modeClock = { index: 1, time: 0 };
    const bolt = state.opponents[2] as Opponent;
    Object.assign(bolt, { state: 'out', x: 1, y: 1, dir: 'right' });
    // Only Bolt is in play: the others stay parked in the house.
    const step = (): void => {
      for (const i of [0, 1, 3])
        Object.assign(state.opponents[i] as Opponent, { state: 'waiting', x: -20 });
      stepGame(state, DT);
    };
    primeSpecial(state.specials, 2);
    step();
    expect(state.specials[2]?.phase).toBe('tell');
    expect(bolt.x).toBe(1);
    for (let i = 0; i < dash.tell * STEP_HZ + 1; i++) step();
    expect(state.specials[2]?.phase).toBe('active');
    const x0 = bolt.x;
    step();
    expect(bolt.x - x0).toBeCloseTo(row2.opponentSpeed * dash.factor * DT, 5);
    for (let i = 0; i < STEP_HZ && state.specials[2]?.phase === 'active'; i++) step();
    expect(bolt).toMatchObject({ x: 4, y: 1 });
    expect(state.specials[2]).toMatchObject({ phase: 'ready', cool: dash.cooldown });
  });
});

describe('Dash in play (regression: Bolt is rarely exactly on a tile centre)', () => {
  it('starts when Bolt, moving between centres, comes into line with the hero', () => {
    const grid = ['#########', '#.......#', '#.##.##.#', '#.......#', '#########'];
    const state = createGame(
      {
        seed: 0,
        width: 9,
        height: 5,
        grid,
        start: { x: 6, y: 3 },
        house: { x0: 0, x1: 0, y0: 4, y1: 4 },
        tunnelY: -1,
      },
      { level: 2 },
    );
    state.phase = 'playing';
    state.modeClock = { index: 1, time: 0 };
    const bolt = state.opponents[2] as Opponent;
    Object.assign(bolt, { state: 'out', x: 1, y: 2.3, dir: 'up' });
    Object.assign(state.hero, { x: 7, y: 1, dir: 'left', moving: false });
    let started = false;
    for (let i = 0; i < STEP_HZ && !started; i++) {
      for (const j of [0, 1, 3])
        Object.assign(state.opponents[j] as Opponent, { state: 'waiting', x: -20 });
      state.hero.moving = false;
      stepGame(state, DT);
      started = state.specials[2]?.phase === 'tell';
    }
    expect(started).toBe(true);
    expect(state.specials[2]).toMatchObject({ aim: 'right', from: { x: 1, y: 1 } });
  });
});

describe('Dash tell art', () => {
  it('stretches Bolt along the way it will shoot', () => {
    const width = (art: ReturnType<typeof dashPixels>, horizontal: boolean): number => {
      let lo = 99;
      let hi = -1;
      for (let y = 0; y < art.height; y++) {
        for (let x = 0; x < art.width; x++) {
          if ((art.data[(y * art.width + x) * 4 + 3] ?? 0) === 0) continue;
          const v = horizontal ? x : y;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
      return hi - lo + 1;
    };
    const right = dashPixels('right');
    expect(width(right, true)).toBeGreaterThan(width(right, false) + 4);
    const up = dashPixels('up');
    expect(width(up, false)).toBeGreaterThan(width(up, true) + 4);
    expect(dashPixels('left').data).not.toEqual(right.data);
  });
});

/** The phase, read fresh (TypeScript would narrow `state.phase` after an assignment). */
const phaseOf = (s: GameState): string => s.phase;

describe('Lunge (WW-10)', () => {
  const row3 = levelRow(3);
  const lunge = row3.lunge as NonNullable<LevelRow['lunge']>;
  const grid = ['#########', '#.......#', '#.##.##.#', '#.......#', '#########'];
  const open = (x: number, y: number): boolean => (grid[y]?.[x] ?? '#') !== '#';
  const corridorMaze = {
    seed: 0,
    width: 9,
    height: 5,
    grid,
    start: { x: 6, y: 3 },
    house: { x0: 0, x1: 0, y0: 4, y1: 4 },
    tunnelY: -1,
  };

  it('is off before maze 3 and on from maze 3, with a tell of at least 0.5 s', () => {
    expect(levelRow(1).lunge).toBeNull();
    expect(levelRow(2).lunge).toBeNull();
    expect(lunge.tell).toBeGreaterThanOrEqual(0.5);
    expect(lunge.minRange).toBeGreaterThan(1);
  });

  it('starts only when the hero is 2-3 tiles straight ahead along open tiles', () => {
    const gnashAt = (x: number, dir: Opponent['dir']): Opponent => ({
      ...(createOpponents(maze)[1] as Opponent),
      state: 'out',
      x,
      y: 1,
      dir,
    });
    const can = (g: Opponent, hero: { x: number; y: number }): string | null =>
      lungeCanStart(createSpecials(), ctx({ row: row3, hero, open }), g);
    expect(can(gnashAt(1, 'right'), { x: 2, y: 1 })).toBeNull(); // 1 tile: too close
    expect(can(gnashAt(1, 'right'), { x: 3, y: 1 })).toBe('right');
    expect(can(gnashAt(1, 'right'), { x: 4, y: 1 })).toBe('right');
    expect(can(gnashAt(1, 'right'), { x: 5, y: 1 })).toBeNull(); // 4 tiles: too far
    expect(can(gnashAt(4, 'left'), { x: 6, y: 1 })).toBeNull(); // behind
    expect(can(gnashAt(1.5, 'right'), { x: 4, y: 1 })).toBeNull(); // not on a centre
  });

  it('in a game: stops to bare its teeth, jumps 2 tiles at x3, pauses, then cools down', () => {
    const state = createGame(corridorMaze, { level: 3 });
    state.phase = 'playing';
    state.modeClock = { index: 1, time: 0 };
    const gnash = state.opponents[1] as Opponent;
    Object.assign(gnash, { state: 'out', x: 1, y: 1, dir: 'right' });
    // The hero is parked out of reach, so the lunge misses.
    const step = (): void => {
      for (const i of [0, 2, 3])
        Object.assign(state.opponents[i] as Opponent, { state: 'waiting', x: -20 });
      Object.assign(state.hero, { x: 7, y: 3, moving: false });
      stepGame(state, DT);
    };
    primeSpecial(state.specials, 1);
    step();
    expect(state.specials[1]).toMatchObject({ phase: 'tell', aim: 'right', from: { x: 1, y: 1 } });
    expect(gnash.x).toBe(1);
    for (let i = 0; i < lunge.tell * STEP_HZ + 1; i++) step();
    expect(state.specials[1]?.phase).toBe('active');
    const x0 = gnash.x;
    step();
    expect(gnash.x - x0).toBeCloseTo(row3.opponentSpeed * lunge.factor * DT, 5);
    for (let i = 0; i < STEP_HZ && state.specials[1]?.phase === 'active'; i++) step();
    expect(gnash).toMatchObject({ x: 1 + lunge.jump, y: 1 });
    expect(state.specials[1]?.phase).toBe('recover');
    step();
    expect(gnash.x).toBe(1 + lunge.jump); // shaking its head, not moving
    for (let i = 0; i < lunge.recover * STEP_HZ + 1; i++) step();
    expect(state.specials[1]).toMatchObject({ phase: 'ready', cool: expect.any(Number) });
    expect(state.specials[1]?.cool).toBeGreaterThan(lunge.cooldown - 0.2);
  });

  it('a lunge that reaches the hero catches it', () => {
    const state = createGame(corridorMaze, { level: 3 });
    state.phase = 'playing';
    state.modeClock = { index: 1, time: 0 };
    const gnash = state.opponents[1] as Opponent;
    Object.assign(gnash, { state: 'out', x: 1, y: 1, dir: 'right' });
    let caught = false;
    for (let i = 0; i < 2 * STEP_HZ && !caught; i++) {
      for (const j of [0, 2, 3])
        Object.assign(state.opponents[j] as Opponent, { state: 'waiting', x: -20 });
      if (state.phase === 'playing') Object.assign(state.hero, { x: 3, y: 1, moving: false });
      stepGame(state, DT);
      caught = phaseOf(state) === 'dying';
    }
    expect(caught).toBe(true);
  });
});

describe('Lunge tell art', () => {
  it('opens Gnash wide with teeth top and bottom', () => {
    const art = lungePixels('left');
    const colourAt = (x: number, y: number): number => {
      const i = (y * art.width + x) * 4;
      return ((art.data[i] ?? 0) << 16) | ((art.data[i + 1] ?? 0) << 8) | (art.data[i + 2] ?? 0);
    };
    expect(colourAt(3, 7)).toBe(NEON.gnashTeeth);
    expect(colourAt(3, 12)).toBe(NEON.gnashTeeth);
    expect(colourAt(6, 9)).toBe(NEON.opponentOutline);
    expect(lungePixels('right').data).not.toEqual(art.data);
  });
});

describe('Phase (WW-10)', () => {
  const row5 = levelRow(5);
  const ph = row5.phase as NonNullable<LevelRow['phase']>;
  // Two corridors (rows 1 and 4) with a 2-tile wall between them.
  const grid = ['#########', '#.......#', '#.#####.#', '#.#####.#', '#.......#', '#########'];
  const thin = {
    seed: 0,
    width: 9,
    height: 6,
    grid,
    start: { x: 6, y: 4 },
    house: { x0: 0, x1: 0, y0: 5, y1: 5 },
    tunnelY: -1,
  };
  const open = (x: number, y: number): boolean => (grid[y]?.[x] ?? '#') !== '#';

  it('is off before maze 5 and on from maze 5, with a tell of at least 0.5 s', () => {
    for (const n of [1, 2, 3, 4]) expect(levelRow(n).phase).toBeNull();
    expect(ph.tell).toBeGreaterThanOrEqual(0.5);
    expect(ph.wall).toBe(2);
  });

  it('phaseExit finds the tile past exactly two plain wall tiles, and nothing else', () => {
    expect(phaseExit(thin, { x: 4, y: 1 }, 'down', 2, open)).toEqual({ x: 4, y: 4 });
    expect(phaseExit(thin, { x: 4, y: 4 }, 'up', 2, open)).toEqual({ x: 4, y: 1 });
    expect(phaseExit(thin, { x: 2, y: 1 }, 'right', 2, open)).toBeNull(); // open, not a wall
    expect(phaseExit(thin, { x: 1, y: 1 }, 'up', 2, open)).toBeNull(); // the outer border
    const thick = {
      ...thin,
      grid: [...grid.slice(0, 4), '#.#####.#', '#.......#', '#########'],
      height: 7,
    };
    const openThick = (x: number, y: number): boolean => (thick.grid[y]?.[x] ?? '#') !== '#';
    expect(phaseExit(thick, { x: 4, y: 1 }, 'down', 2, openThick)).toBeNull(); // 3 thick
    const house = { ...thin, house: { x0: 3, x1: 5, y0: 2, y1: 3 } };
    expect(phaseExit(house, { x: 4, y: 1 }, 'down', 2, open)).toBeNull(); // the ghost house
    const tunnel = { ...thin, tunnelY: 4 };
    expect(phaseExit(tunnel, { x: 4, y: 1 }, 'down', 2, open)).toBeNull(); // into the tunnel row
  });

  it('starts only when the hero is near and on the far side of the wall', () => {
    const wispAt = (x: number, y: number): Opponent => ({
      ...(createOpponents(maze)[3] as Opponent),
      state: 'out',
      x,
      y,
    });
    const can = (hero: { x: number; y: number }): string | null =>
      phaseCanStart(createSpecials(), ctx({ row: row5, hero, open, maze: thin }), wispAt(4, 1));
    expect(can({ x: 4, y: 4 })).toBe('down');
    expect(can({ x: 5, y: 4 })).toBe('down');
    expect(can({ x: 2, y: 1 })).toBeNull(); // near, but on Wisp's side
    expect(can({ x: 7, y: 4 })).toBeNull(); // too far
  });

  it('in a game: turns see-through and holds still, drifts through in 0.8 s, then cools down', () => {
    const state = createGame(thin, { level: 5 });
    state.phase = 'playing';
    state.modeClock = { index: 1, time: 0 };
    const wisp = state.opponents[3] as Opponent;
    Object.assign(wisp, { state: 'out', x: 4, y: 1, dir: 'left' });
    const step = (): void => {
      for (const i of [0, 1, 2])
        Object.assign(state.opponents[i] as Opponent, { state: 'waiting', x: -20 });
      if (phaseOf(state) === 'playing') Object.assign(state.hero, { x: 7, y: 4, moving: false });
      stepGame(state, DT);
    };
    primeSpecial(state.specials, 3);
    step();
    expect(state.specials[3]).toMatchObject({ phase: 'tell', aim: 'down', from: { x: 4, y: 1 } });
    for (let i = 0; i < ph.tell * STEP_HZ - 2; i++) step();
    expect(wisp).toMatchObject({ x: 4, y: 1 });
    for (let i = 0; i < 3; i++) step();
    expect(state.specials[3]?.phase).toBe('active');
    for (let i = 0; i < (ph.cross / 2) * STEP_HZ; i++) step();
    expect(wisp.y).toBeGreaterThan(1.5);
    expect(wisp.y).toBeLessThan(3.5);
    for (let i = 0; i < ph.cross * STEP_HZ && state.specials[3]?.phase === 'active'; i++) step();
    // Out on the far side; it may already have taken one normal step from (4,4).
    expect(wisp.y).toBe(4);
    expect(Math.abs(wisp.x - 4)).toBeLessThanOrEqual(row5.opponentSpeed * DT + 1e-9);
    expect(state.specials[3]?.phase).toBe('ready');
    expect(state.specials[3]?.cool).toBeGreaterThan(ph.cooldown - 1);
  });

  it('starts in play when Wisp, moving between centres, reaches a thin wall with the hero beyond', () => {
    const state = createGame(thin, { level: 5 });
    state.phase = 'playing';
    state.modeClock = { index: 1, time: 0 };
    const wisp = state.opponents[3] as Opponent;
    Object.assign(wisp, { state: 'out', x: 2.6, y: 1, dir: 'right' });
    let started = false;
    for (let i = 0; i < STEP_HZ && !started; i++) {
      for (const j of [0, 1, 2])
        Object.assign(state.opponents[j] as Opponent, { state: 'waiting', x: -20 });
      Object.assign(state.hero, { x: 4, y: 4, moving: false });
      stepGame(state, DT);
      started = state.specials[3]?.phase === 'tell';
    }
    expect(started).toBe(true);
    expect(state.specials[3]?.aim).toBe('down');
    expect(Number.isInteger(state.specials[3]?.from?.x)).toBe(true);
  });
});
