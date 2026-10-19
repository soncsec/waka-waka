import type { LevelRow, ModePhase } from '../config/tuning';

export type Mode = ModePhase['mode'];

/** Where the opponents are in the scatter/chase sequence (WW-02). */
export interface ModeClock {
  /** Index into the row's `modes`. */
  index: number;
  /** Seconds spent in the current phase. */
  time: number;
}

export function createModeClock(): ModeClock {
  return { index: 0, time: 0 };
}

function phaseAt(row: LevelRow, index: number): ModePhase {
  const last = row.modes[row.modes.length - 1];
  if (!last) throw new Error('a difficulty row needs at least one mode phase');
  return row.modes[index] ?? last;
}

export function currentMode(row: LevelRow, clock: ModeClock): Mode {
  return phaseAt(row, clock.index).mode;
}

/**
 * Advances the clock by `dt` seconds. Returns true when the mode changed, so the
 * caller can reverse the opponents. The last phase never ends.
 */
export function tickMode(row: LevelRow, clock: ModeClock, dt: number): boolean {
  clock.time += dt;
  const before = currentMode(row, clock);
  while (clock.index < row.modes.length - 1 && clock.time >= phaseAt(row, clock.index).seconds) {
    clock.time -= phaseAt(row, clock.index).seconds;
    clock.index++;
  }
  return currentMode(row, clock) !== before;
}
