import { HIGH_SCORE } from '../config/tuning';

/**
 * Reads a stored high score (WW-08). Only plain decimal digits that make a
 * non-negative safe integer are accepted; anything else (missing, tampered,
 * negative, huge, '1e5', ' 12') counts as 0, and the caller resets the store.
 */
export function parseHighScore(raw: string | null): number {
  if (raw === null) return 0;
  if (!new RegExp(`^[0-9]{1,${HIGH_SCORE.maxDigits}}$`).test(raw)) return 0;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : 0;
}

/** The value to store: only a non-negative safe integer, written as digits. */
export function formatHighScore(score: number): string {
  return Number.isSafeInteger(score) && score > 0 ? String(score) : '0';
}
