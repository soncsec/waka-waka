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
});
