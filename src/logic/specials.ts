import type { LevelRow } from '../config/tuning';
import type { Mode } from './scheduler';
import type { Opponent } from './opponents';

/**
 * Special moves (WW-10, docs/SPECIAL-MOVES.md). Each opponent has one small
 * state machine: ready -> tell -> active -> ready. Fairness rules:
 * - a tell always comes first, and the opponent slows during it;
 * - only one opponent may be in a tell or a move at a time;
 * - never while scared, a spark, in the house or (to start) in the tunnel.
 */
export type SpecialPhase = 'ready' | 'tell' | 'active';

export interface SpecialState {
  phase: SpecialPhase;
  /** Seconds in the current phase. */
  time: number;
  /** Progress towards the trigger (Frenzy: seconds of chase). */
  charge: number;
}

export function createSpecials(): SpecialState[] {
  return [0, 1, 2, 3].map(() => ({ phase: 'ready', time: 0, charge: 0 }));
}

export interface SpecialContext {
  row: LevelRow;
  mode: Mode;
  opponents: readonly Opponent[];
  /** Whether an opponent is inside the tunnel. */
  inTunnel: (o: Opponent) => boolean;
}

/** An opponent that could use or keep using a special move. */
function able(o: Opponent | undefined): boolean {
  return o !== undefined && o.state === 'out' && !o.scared;
}

function reset(s: SpecialState): void {
  s.phase = 'ready';
  s.time = 0;
  s.charge = 0;
}

/** Whether any opponent other than `index` is mid-move (the one-at-a-time rule). */
export function othersBusy(specials: readonly SpecialState[], index: number): boolean {
  return specials.some((s, i) => i !== index && s.phase !== 'ready');
}

/** Advances every opponent's special move by `dt` seconds. */
export function tickSpecials(specials: SpecialState[], ctx: SpecialContext, dt: number): void {
  tickFrenzy(specials, ctx, dt);
}

/** Murk's Frenzy: after enough chase, a white-hot tell, then a burst of speed. */
function tickFrenzy(specials: SpecialState[], ctx: SpecialContext, dt: number): void {
  const s = specials[0];
  const murk = ctx.opponents[0];
  const f = ctx.row.frenzy;
  if (!s) return;
  if (!f || !able(murk)) {
    reset(s);
    return;
  }
  switch (s.phase) {
    case 'ready':
      if (ctx.mode !== 'chase') return;
      s.charge += dt;
      if (s.charge >= f.every && !othersBusy(specials, 0) && !ctx.inTunnel(murk as Opponent)) {
        s.phase = 'tell';
        s.time = 0;
      }
      return;
    case 'tell':
      s.time += dt;
      if (s.time >= f.tell) {
        s.phase = 'active';
        s.time = 0;
      }
      return;
    case 'active':
      s.time += dt;
      if (s.time >= f.burst) reset(s);
      return;
  }
}

/** Speed multiplier from an opponent's special move: slower in a tell, faster in the move. */
export function specialSpeed(row: LevelRow, index: number, s: SpecialState | undefined): number {
  if (!s || s.phase === 'ready') return 1;
  if (index === 0 && row.frenzy)
    return s.phase === 'tell' ? row.frenzy.tellSpeed : row.frenzy.factor;
  return 1;
}

/** Test hook: makes an opponent's move due, so it starts as soon as the rules allow. */
export function primeSpecial(specials: SpecialState[], index: number): void {
  const s = specials[index];
  if (s) s.charge = Number.MAX_VALUE;
}
