import { DEATH_ART } from '../config/tuning';

/** How the caught hero looks `t` seconds into the dying phase (M4.5). */
export interface DeathLook {
  /** The hero's size as a share of full size; 0 once it has burst. */
  heroScale: number;
  /** Which crackle frame shows over the hero, or null for none. */
  crackle: number | null;
  /** How far the final burst has gone, 0 to 1, or null before it starts. */
  burst: number | null;
}

/**
 * The fizzle: hold, shrink in steps with crackling sparks, then one spark burst.
 * With reduced flash the shrink has no crackle; the single burst stays, as it
 * doesn't repeat.
 */
export function deathLook(t: number, reducedFlash: boolean, crackleFrames: number): DeathLook {
  const { holdSeconds, shrinkSeconds, shrinkSteps, crackleHz, burstSeconds } = DEATH_ART;
  if (t < holdSeconds) return { heroScale: 1, crackle: null, burst: null };
  const shrinking = t - holdSeconds;
  if (shrinking < shrinkSeconds) {
    const step = Math.floor((shrinking / shrinkSeconds) * shrinkSteps.length);
    const crackle = reducedFlash
      ? null
      : Math.floor(shrinking * crackleHz) % Math.max(1, crackleFrames);
    return { heroScale: shrinkSteps[step] ?? 0, crackle, burst: null };
  }
  const burst = Math.min(1, (shrinking - shrinkSeconds) / burstSeconds);
  return { heroScale: 0, crackle: null, burst };
}
