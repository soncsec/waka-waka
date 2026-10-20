import { HIGH_SCORE } from '../config/tuning';
import { formatHighScore, parseHighScore } from '../logic/highscore';

/**
 * The stored high score, validated (WW-08). An invalid value is reset; storage
 * that is blocked or full is ignored, and the game plays on without it.
 */
export function loadHighScore(): number {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE.storageKey);
    const best = parseHighScore(raw);
    if (raw !== null && raw !== formatHighScore(best)) {
      window.localStorage.setItem(HIGH_SCORE.storageKey, formatHighScore(best));
    }
    return best;
  } catch {
    return 0;
  }
}

/** Stores `score` as the high score; false if storage is blocked (private mode, quota). */
export function storeHighScore(score: number): boolean {
  try {
    window.localStorage.setItem(HIGH_SCORE.storageKey, formatHighScore(score));
    return true;
  } catch {
    return false;
  }
}
