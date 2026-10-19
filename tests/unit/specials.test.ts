import { describe, expect, it } from 'vitest';
import { NEON, STEP_HZ, type LevelRow } from '../../src/config/tuning';
import { opponentPixels } from '../../src/art/sprites';
import { levelRow } from '../../src/logic/difficulty';
import { createGame, powerUp, stepGame, type GameState } from '../../src/logic/game';
import { fallbackMaze } from '../../src/logic/maze';
import { createOpponents, type Opponent } from '../../src/logic/opponents';
import {
  createSpecials,
  othersBusy,
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
  return { row, mode: 'chase', opponents: createOpponents(maze), inTunnel: () => false, ...over };
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
    const s = createSpecials();
    (s[2] as { phase: string }).phase = 'tell';
    expect(othersBusy(s, 0)).toBe(true);
    primeSpecial(s, 0);
    run(s, ctx(), 1);
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
