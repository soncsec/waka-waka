import { describe, expect, it } from 'vitest';
import { STEP_HZ, type LevelRow } from '../../src/config/tuning';
import { levelRow } from '../../src/logic/difficulty';
import { createModeClock, currentMode, tickMode } from '../../src/logic/scheduler';

const DT = 1 / STEP_HZ;
const row: LevelRow = {
  ...levelRow(1),
  modes: [
    { mode: 'scatter', seconds: 2 },
    { mode: 'chase', seconds: 3 },
    { mode: 'chase', seconds: 1 },
    { mode: 'scatter', seconds: Infinity },
  ],
};

/** Seconds of game time until each mode change, using real 60 Hz steps. */
function switchTimes(r: LevelRow, seconds: number): number[] {
  const clock = createModeClock();
  const times: number[] = [];
  for (let i = 1; i <= seconds * STEP_HZ; i++) {
    if (tickMode(r, clock, DT)) times.push(i / STEP_HZ);
  }
  return times;
}

describe('scatter/chase scheduler', () => {
  it('starts in the first phase', () => {
    expect(currentMode(row, createModeClock())).toBe('scatter');
  });

  it('switches at each phase boundary, and reports only real mode changes', () => {
    const times = switchTimes(row, 20);
    // scatter -> chase at 2 s; chase -> chase at 5 s is no change; chase -> scatter at 6 s.
    expect(times).toHaveLength(2);
    expect(times[0]).toBeCloseTo(2, 1);
    expect(times[1]).toBeCloseTo(6, 1);
  });

  it('stays in the last phase for ever', () => {
    const clock = createModeClock();
    for (let i = 0; i < 1000 * STEP_HZ; i++) tickMode(row, clock, DT);
    expect(clock.index).toBe(row.modes.length - 1);
    expect(currentMode(row, clock)).toBe('scatter');
  });

  it('handles a long step that crosses several phases at once', () => {
    const clock = createModeClock();
    expect(tickMode(row, clock, 5.5)).toBe(true);
    expect(clock.index).toBe(2);
    expect(clock.time).toBeCloseTo(0.5);
  });

  it('the first difficulty row starts with scatter and ends chasing for ever', () => {
    const { modes } = levelRow(1);
    expect(modes[0]?.mode).toBe('scatter');
    expect(modes[modes.length - 1]).toEqual({ mode: 'chase', seconds: Infinity });
    for (const m of modes.slice(0, -1)) expect(Number.isFinite(m.seconds)).toBe(true);
  });
});
