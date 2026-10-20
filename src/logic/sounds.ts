import type { SoundKey } from '../config/audio';
import type { Eaten, GameState, Phase } from './game';

/** The parts of the game state that sound cues watch, taken before and after a step. */
export interface CueWatch {
  phase: Phase;
  eatChain: number;
  extraLifeGiven: boolean;
}

export function cueWatch(state: GameState): CueWatch {
  return { phase: state.phase, eatChain: state.eatChain, extraLifeGiven: state.extraLifeGiven };
}

/**
 * The sounds one simulation step calls for (M5.2): what was eaten, and the
 * phase it moved into. One sound of each kind at most; the last dot of a maze
 * plays the cleared sound instead of the dot.
 */
export function stepSounds(before: CueWatch, after: CueWatch, eaten: readonly Eaten[]): SoundKey[] {
  const sounds: SoundKey[] = [];
  const entered = after.phase !== before.phase ? after.phase : null;
  const ate = (kind: Eaten['kind']): boolean => eaten.some((e) => e.kind === kind);
  if (entered === 'cleared') {
    sounds.push('sfx-clear');
  } else {
    if (ate('dot')) sounds.push('sfx-dot');
    if (ate('pellet')) sounds.push('sfx-pellet');
  }
  if (ate('bonus')) sounds.push('sfx-battery');
  // A new pellet restarts the chain, so an opponent eaten on that same step still counts.
  const chainGrew = after.eatChain > (ate('pellet') ? 0 : before.eatChain);
  if (chainGrew) sounds.push('sfx-eat');
  if (after.extraLifeGiven && !before.extraLifeGiven) sounds.push('sfx-life');
  if (entered === 'dying') sounds.push('sfx-caught');
  if (entered === 'ready') sounds.push('sfx-ready');
  if (entered === 'gameover') sounds.push('sfx-over');
  return sounds;
}
