import { describe, expect, it } from 'vitest';
import { DEATH_ART, ROUND } from '../../src/config/tuning';
import { deathLook } from '../../src/logic/death';

const { holdSeconds, shrinkSeconds, shrinkSteps, burstSeconds, crackleHz } = DEATH_ART;

describe('deathLook (M4.5)', () => {
  it('fits the whole fizzle into the dying phase', () => {
    expect(holdSeconds + shrinkSeconds + burstSeconds).toBeCloseTo(ROUND.deathSeconds, 5);
  });

  it('holds the hero still at full size first', () => {
    expect(deathLook(0, false, 2)).toEqual({ heroScale: 1, crackle: null, burst: null });
  });

  it('shrinks the hero in steps, smaller each time', () => {
    const sizes = shrinkSteps.map(
      (_, i) =>
        deathLook(holdSeconds + ((i + 0.5) * shrinkSeconds) / shrinkSteps.length, false, 2)
          .heroScale,
    );
    expect(sizes).toEqual([...shrinkSteps]);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThan(sizes[i - 1] ?? 0);
  });

  it('crackles while shrinking, cycling through the spark frames', () => {
    const at = (n: number) => deathLook(holdSeconds + n / crackleHz + 0.001, false, 2).crackle;
    expect([at(0), at(1), at(2)]).toEqual([0, 1, 0]);
  });

  it('has no crackle with reduced flash, but still shrinks and bursts', () => {
    const mid = deathLook(holdSeconds + shrinkSeconds / 2, true, 2);
    expect(mid.crackle).toBeNull();
    expect(mid.heroScale).toBeLessThan(1);
    expect(deathLook(holdSeconds + shrinkSeconds + burstSeconds / 2, true, 2).burst).toBeCloseTo(
      0.5,
      5,
    );
  });

  it('bursts once the hero is gone, from 0 to 1 and no further', () => {
    const start = deathLook(holdSeconds + shrinkSeconds, false, 2);
    expect(start).toEqual({ heroScale: 0, crackle: null, burst: 0 });
    expect(deathLook(ROUND.deathSeconds + 1, false, 2).burst).toBe(1);
  });
});
