import { TITLE } from '../config/tuning';

/** The title screen's two pages (M4.3). */
export type TitlePage = 'cast' | 'help';

export interface TitleView {
  page: TitlePage;
  /** How many cast rows show so far. */
  castShown: number;
  /** Whether "PRESS A KEY OR TAP TO PLAY" is lit. */
  promptLit: boolean;
}

/**
 * What the title screen shows `seconds` after it appeared: the cast page, then
 * the help page, over and over. `rows` is the number of cast rows. With
 * `steady` (reduced motion) the cast shows at once and the prompt doesn't blink.
 */
export function titleView(seconds: number, rows: number, steady: boolean): TitleView {
  const t = Math.max(0, seconds) % (TITLE.castSeconds + TITLE.helpSeconds);
  const page: TitlePage = t < TITLE.castSeconds ? 'cast' : 'help';
  const castShown = steady ? rows : Math.min(rows, Math.floor(t / TITLE.revealSeconds) + 1);
  const promptLit = steady || Math.floor(seconds * TITLE.promptBlinkHz * 2) % 2 === 0;
  return { page, castShown: page === 'cast' ? castShown : 0, promptLit };
}

/** Whether the title takes keys and taps yet (see TITLE.inputDelay). */
export function titleTakesInput(seconds: number): boolean {
  return seconds >= TITLE.inputDelay;
}

/** A run's score is a new best when it beats the best stored before the run began. */
export function isNewBest(score: number, bestBefore: number): boolean {
  return score > 0 && score > bestBefore;
}
