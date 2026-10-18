import { LEVELS, type LevelRow } from '../config/tuning';

/** The difficulty row for a maze number (WW-07). Past the last row, the last row repeats. */
export function levelRow(level: number): LevelRow {
  const i = Math.min(Math.max(Math.floor(level), 1), LEVELS.length) - 1;
  return LEVELS[i] as LevelRow;
}
