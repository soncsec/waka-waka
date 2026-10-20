import { describe, expect, it } from 'vitest';
import type { SoundKey } from '../../src/config/audio';
import { ROUND, STEP_HZ } from '../../src/config/tuning';
import { catchHero, createGame, endRun, stepGame, type GameState } from '../../src/logic/game';
import { fallbackMaze } from '../../src/logic/maze';
import { cueWatch, stepSounds, type CueWatch } from '../../src/logic/sounds';

const DT = 1 / STEP_HZ;
const playing: CueWatch = { phase: 'playing', eatChain: 0, extraLifeGiven: false };
const at = { x: 1, y: 1 };

/** Runs the game for `seconds`, collecting the sounds each step calls for. */
function run(state: GameState, seconds: number): SoundKey[] {
  const sounds: SoundKey[] = [];
  for (let t = 0; t < seconds * STEP_HZ; t++) {
    const before = cueWatch(state);
    const eaten = stepGame(state, DT);
    sounds.push(...stepSounds(before, cueWatch(state), eaten));
  }
  return sounds;
}

describe('sound cues (M5.2)', () => {
  it('a quiet step plays nothing', () => {
    expect(stepSounds(playing, playing, [])).toEqual([]);
  });

  it('dots, pellets and the battery each play their sound once a step', () => {
    const eaten = [
      { ...at, kind: 'dot' as const },
      { ...at, x: 2, kind: 'dot' as const },
      { ...at, kind: 'pellet' as const },
      { ...at, kind: 'bonus' as const },
    ];
    expect(stepSounds(playing, playing, eaten)).toEqual(['sfx-dot', 'sfx-pellet', 'sfx-battery']);
  });

  it('the last dot plays the cleared sound instead of the dot', () => {
    const after = { ...playing, phase: 'cleared' as const };
    expect(stepSounds(playing, after, [{ ...at, kind: 'dot' }])).toEqual(['sfx-clear']);
  });

  it('an opponent eaten plays its sound, even on the step a new pellet restarts the chain', () => {
    const chained = { ...playing, eatChain: 2 };
    expect(stepSounds(playing, { ...playing, eatChain: 1 }, [])).toEqual(['sfx-eat']);
    expect(stepSounds(chained, { ...playing, eatChain: 0 }, [{ ...at, kind: 'pellet' }])).toEqual([
      'sfx-pellet',
    ]);
    expect(stepSounds(chained, { ...playing, eatChain: 1 }, [{ ...at, kind: 'pellet' }])).toEqual([
      'sfx-pellet',
      'sfx-eat',
    ]);
  });

  it('the extra life plays once, when it is given', () => {
    const given = { ...playing, extraLifeGiven: true };
    expect(stepSounds(playing, given, [])).toEqual(['sfx-life']);
    expect(stepSounds(given, given, [])).toEqual([]);
  });

  it('caught, a new life, and the end of the run each play as the game enters them', () => {
    const dying = { ...playing, phase: 'dying' as const };
    expect(stepSounds(playing, dying, [])).toEqual(['sfx-caught']);
    expect(stepSounds(dying, { ...playing, phase: 'ready' }, [])).toEqual(['sfx-ready']);
    expect(stepSounds(dying, { ...playing, phase: 'gameover' }, [])).toEqual(['sfx-over']);
    // Staying in a phase plays nothing more.
    expect(stepSounds(dying, dying, [])).toEqual([]);
  });

  it('in a real game: dots while playing, then caught, then GET SET! for the next life', () => {
    const state = createGame(fallbackMaze(1));
    expect(run(state, ROUND.readySeconds)).toEqual([]);
    expect(run(state, 2)).toContain('sfx-dot');
    catchHero(state);
    const afterCatch = run(state, ROUND.deathSeconds + DT);
    expect(afterCatch).toContain('sfx-ready');
    expect(afterCatch).not.toContain('sfx-dot');
  });

  it('in a real game: the end of the run plays the run-ended sound once', () => {
    const state = createGame(fallbackMaze(1));
    run(state, ROUND.readySeconds + 1);
    const before = cueWatch(state);
    endRun(state);
    expect(stepSounds(before, cueWatch(state), [])).toEqual(['sfx-over']);
    expect(run(state, 1)).toEqual([]);
  });
});
