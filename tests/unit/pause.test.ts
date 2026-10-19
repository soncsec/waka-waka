import { describe, expect, it } from 'vitest';
import { ROUND, STEP_HZ } from '../../src/config/tuning';
import { clearMaze, createGame, setPaused, stepGame, type GameState } from '../../src/logic/game';
import { fallbackMaze } from '../../src/logic/maze';

const DT = 1 / STEP_HZ;

function steps(state: GameState, seconds: number): void {
  for (let t = 0; t < seconds * STEP_HZ; t++) stepGame(state, DT);
}

describe('pause (M4.4)', () => {
  it('freezes everything while paused and carries on where it left off', () => {
    const state = createGame(fallbackMaze(1));
    steps(state, ROUND.readySeconds + 1);
    expect(state.phase).toBe('playing');
    setPaused(state, true);
    const frozen = structuredClone(state);
    steps(state, 5);
    expect(state).toEqual(frozen);

    setPaused(state, false);
    expect(state.paused).toBe(false);
    steps(state, 0.5);
    // Time runs again (the hero may be stopped at a wall, so check the clock).
    expect(state.phaseTime).toBeCloseTo(frozen.phaseTime + 0.5, 5);
  });

  it('can pause during the GET SET! pause without starting play', () => {
    const state = createGame(fallbackMaze(1));
    setPaused(state, true);
    steps(state, ROUND.readySeconds + 1);
    expect(state.phase).toBe('ready');
    expect(state.phaseTime).toBe(0);
  });

  it('cannot pause once the run has ended or the maze is cleared', () => {
    const over = createGame(fallbackMaze(1));
    over.phase = 'gameover';
    setPaused(over, true);
    expect(over.paused).toBe(false);

    const cleared = createGame(fallbackMaze(1));
    clearMaze(cleared);
    setPaused(cleared, true);
    expect(cleared.paused).toBe(false);
  });
});
