import { describe, expect, it } from 'vitest';
import { TITLE } from '../../src/config/tuning';
import { isNewBest, titleTakesInput, titleView } from '../../src/logic/title';

const CYCLE = TITLE.castSeconds + TITLE.helpSeconds;

describe('titleView (M4.3)', () => {
  it('shows the cast page first, then the help page, then the cast again', () => {
    expect(titleView(0, 5, false).page).toBe('cast');
    expect(titleView(TITLE.castSeconds - 0.01, 5, false).page).toBe('cast');
    expect(titleView(TITLE.castSeconds, 5, false).page).toBe('help');
    expect(titleView(CYCLE - 0.01, 5, false).page).toBe('help');
    expect(titleView(CYCLE, 5, false).page).toBe('cast');
  });

  it('reveals the cast one row at a time, and starts again each cycle', () => {
    expect(titleView(0, 5, false).castShown).toBe(1);
    expect(titleView(TITLE.revealSeconds, 5, false).castShown).toBe(2);
    expect(titleView(TITLE.revealSeconds * 10, 5, false).castShown).toBe(5);
    expect(titleView(CYCLE, 5, false).castShown).toBe(1);
  });

  it('hides the cast on the help page', () => {
    expect(titleView(TITLE.castSeconds + 1, 5, false).castShown).toBe(0);
  });

  it('blinks the prompt, but holds it lit for reduced motion', () => {
    const half = 1 / (TITLE.promptBlinkHz * 2);
    expect(titleView(0, 5, false).promptLit).toBe(true);
    expect(titleView(half, 5, false).promptLit).toBe(false);
    expect(titleView(half, 5, true).promptLit).toBe(true);
  });

  it('shows the whole cast at once for reduced motion', () => {
    expect(titleView(0, 5, true).castShown).toBe(5);
  });

  it('treats a negative time as the start', () => {
    expect(titleView(-1, 5, false)).toEqual(titleView(0, 5, false));
  });
});

describe('titleTakesInput', () => {
  it('ignores input for a moment after the title appears', () => {
    expect(titleTakesInput(0)).toBe(false);
    expect(titleTakesInput(TITLE.inputDelay - 0.01)).toBe(false);
    expect(titleTakesInput(TITLE.inputDelay)).toBe(true);
  });
});

describe('isNewBest', () => {
  it('is a new best only when the score beats the best from before the run', () => {
    expect(isNewBest(500, 400)).toBe(true);
    expect(isNewBest(400, 400)).toBe(false);
    expect(isNewBest(300, 400)).toBe(false);
  });

  it('a first run with no score is not a new best', () => {
    expect(isNewBest(0, 0)).toBe(false);
    expect(isNewBest(10, 0)).toBe(true);
  });
});
