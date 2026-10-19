import { describe, expect, it } from 'vitest';
import { BONUS, LEVELS, ROUND, STEP_HZ } from '../../src/config/tuning';
import {
  clearMaze,
  createGame,
  setWanted,
  showBonus,
  stepGame,
  type Eaten,
  type GameState,
} from '../../src/logic/game';
import { levelRow } from '../../src/logic/difficulty';
import type { Maze } from '../../src/logic/maze';

const DT = 1 / STEP_HZ;

/** Steps until `done` is true, failing after `maxSeconds` of game time. Returns everything eaten. */
function runUntil(state: GameState, done: () => boolean, maxSeconds = 30): Eaten[] {
  const eaten: Eaten[] = [];
  for (let t = 0; t < maxSeconds * STEP_HZ; t++) {
    if (done()) return eaten;
    eaten.push(...stepGame(state, DT));
  }
  throw new Error('condition not reached');
}

const play = (state: GameState): void => {
  runUntil(state, () => state.phase === 'playing');
};

/**
 * The hero's corridor has 10 dots to the left of its start. Murk's corridor,
 * two rows down, has 12 more the hero can never reach, so the maze never clears.
 */
function corridors(): Maze {
  return {
    seed: 0,
    width: 14,
    height: 5,
    grid: [
      '##############',
      '#..........  #',
      '##############',
      '#............#',
      '##############',
    ],
    start: { x: 11.5, y: 1 },
    house: { x0: 0, x1: 0, y0: 4, y1: 4 },
    tunnelY: -1,
  };
}

const TOTAL = 22;
const eatenSoFar = (state: GameState): number => TOTAL - state.dotsLeft;

describe('the bonus battery (M3.3)', () => {
  it('appears once 30% of the dots are eaten, not before', () => {
    const state = createGame(corridors());
    expect(state.dotsTotal).toBe(TOTAL);
    play(state);
    const due = Math.ceil((BONUS.appearAt[0] as number) * TOTAL);
    runUntil(state, () => eatenSoFar(state) === due - 1);
    stepGame(state, DT);
    expect(state.bonusTime).toBe(0);
    runUntil(state, () => state.bonusTime > 0);
    expect(eatenSoFar(state)).toBe(due);
    expect(state.bonusShown).toBe(1);
  });

  it('goes after its time is up if nobody eats it', () => {
    const state = createGame(corridors());
    play(state);
    runUntil(state, () => state.bonusTime > 0);
    const shownAt = state.phaseTime;
    runUntil(state, () => state.bonusTime === 0, BONUS.seconds + 1);
    expect(state.phaseTime - shownAt).toBeCloseTo(BONUS.seconds, 1);
    // The hero eats the rest of its dots; the next share is out of reach, so no new battery.
    runUntil(state, () => !state.hero.moving);
    expect(state.bonusShown).toBe(1);
    expect(state.bonusTime).toBe(0);
  });

  it("is worth this maze's points when the hero reaches it, once", () => {
    const state = createGame(corridors(), { level: 3 });
    play(state);
    runUntil(state, () => state.bonusTime > 0);
    setWanted(state, 'right');
    const before = state.score;
    const eaten = runUntil(state, () => state.bonusTime === 0, BONUS.seconds);
    expect(eaten).toEqual([{ ...corridors().start, kind: 'bonus' }]);
    expect(state.score - before).toBe(levelRow(3).bonusPoints);
    runUntil(state, () => !state.hero.moving);
    expect(state.score - before).toBe(levelRow(3).bonusPoints);
  });

  it('does not count as a dot for the house release', () => {
    const state = createGame(corridors());
    play(state);
    runUntil(state, () => state.bonusTime > 0);
    const dots = state.dotsThisLife;
    setWanted(state, 'right');
    runUntil(state, () => state.bonusTime === 0, BONUS.seconds);
    expect(state.dotsThisLife).toBe(dots);
  });

  it('appears a second time at 70%, and never a third', () => {
    const state = createGame(corridors());
    play(state);
    runUntil(state, () => state.bonusTime > 0);
    runUntil(state, () => state.bonusTime === 0, BONUS.seconds + 1);
    state.dotsLeft = Math.floor(TOTAL * (1 - (BONUS.appearAt[1] as number)));
    stepGame(state, DT);
    expect(state.bonusShown).toBe(2);
    expect(state.bonusTime).toBeGreaterThan(0);
    runUntil(state, () => state.bonusTime === 0, BONUS.seconds + 1);
    state.dotsLeft = 1;
    for (let t = 0; t < STEP_HZ; t++) stepGame(state, DT);
    expect(state.bonusShown).toBe(2);
    expect(state.bonusTime).toBe(0);
  });

  it('goes when a life is lost', () => {
    const state = createGame(corridors());
    play(state);
    showBonus(state);
    state.phase = 'dying';
    runUntil(state, () => state.phase === 'ready', ROUND.deathSeconds + 1);
    expect(state.bonusTime).toBe(0);
    expect(state.bonusShown).toBe(1);
  });

  it('goes when the maze is cleared', () => {
    const state = createGame(corridors());
    showBonus(state);
    clearMaze(state);
    expect(state.bonusTime).toBe(0);
  });

  it('is worth more on later mazes, and the last row repeats', () => {
    const points = LEVELS.map((row) => row.bonusPoints);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThan(points[i - 1] as number);
    }
    expect(levelRow(LEVELS.length + 10).bonusPoints).toBe(points.at(-1));
  });
});
