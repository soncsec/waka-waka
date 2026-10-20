import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/config/tuning';
import { levelRow } from '../../src/logic/difficulty';

describe('levelRow', () => {
  it('maps maze 1 to the first row and repeats the last row for ever', () => {
    expect(levelRow(1)).toBe(LEVELS[0]);
    expect(levelRow(LEVELS.length)).toBe(LEVELS[LEVELS.length - 1]);
    expect(levelRow(LEVELS.length + 50)).toBe(LEVELS[LEVELS.length - 1]);
  });

  it('treats a maze number below 1 as maze 1', () => {
    expect(levelRow(0)).toBe(LEVELS[0]);
    expect(levelRow(-3)).toBe(LEVELS[0]);
  });

  it('has sane rows: positive speeds and a release order that never jumps backwards', () => {
    for (const row of LEVELS) {
      expect(row.heroSpeed).toBeGreaterThan(0);
      expect(row.opponentSpeed).toBeGreaterThan(0);
      expect(row.releaseIdleSeconds).toBeGreaterThan(0);
      expect(row.tunnelSpeed).toBeGreaterThan(0);
      expect(row.tunnelSpeed).toBeLessThan(row.opponentSpeed);
      expect(row.scaredSpeed).toBeLessThan(row.opponentSpeed);
      expect(row.releaseDots).toHaveLength(4);
      expect([...row.releaseDots]).toEqual([...row.releaseDots].sort((a, b) => a - b));
    }
  });

  it('ramps to a plateau at maze 20: never easier from one maze to the next (M3.1)', () => {
    expect(LEVELS).toHaveLength(20);
    for (let i = 1; i < LEVELS.length; i++) {
      const [prev, row] = [LEVELS[i - 1], LEVELS[i]];
      if (!prev || !row) throw new Error('missing row');
      expect(row.opponentSpeed, `maze ${i + 1}`).toBeGreaterThanOrEqual(prev.opponentSpeed);
      expect(row.heroSpeed, `maze ${i + 1}`).toBeGreaterThanOrEqual(prev.heroSpeed);
      expect(row.scaredSeconds, `maze ${i + 1}`).toBeLessThanOrEqual(prev.scaredSeconds);
      expect(row.bonusPoints, `maze ${i + 1}`).toBeGreaterThanOrEqual(prev.bonusPoints);
      expect(row.releaseIdleSeconds, `maze ${i + 1}`).toBeLessThanOrEqual(prev.releaseIdleSeconds);
    }
    // Opponents stay slower than the hero out in the maze (special moves aside).
    for (const row of LEVELS) expect(row.opponentSpeed).toBeLessThan(row.heroSpeed);
    // Every move is on by maze 5 and stays on.
    for (const row of LEVELS.slice(4)) {
      expect([row.frenzy, row.dash, row.lunge, row.phase].every((m) => m !== null)).toBe(true);
    }
  });

  it('keeps every tell at the 0.5 s fairness floor or longer, with real cooldowns (WW-10)', () => {
    for (const row of LEVELS) {
      for (const move of [row.dash, row.lunge, row.phase]) {
        if (!move) continue;
        expect(move.tell).toBeGreaterThanOrEqual(0.5);
        expect(move.cooldown).toBeGreaterThan(move.tell);
      }
      if (row.frenzy) {
        expect(row.frenzy.tell).toBeGreaterThanOrEqual(0.5);
        expect(row.frenzy.every).toBeGreaterThan(row.frenzy.burst);
      }
      const chase = row.modes.at(-1);
      expect(chase).toEqual({ mode: 'chase', seconds: Infinity });
    }
  });
});
