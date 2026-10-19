import type { LevelRow } from '../config/tuning';
import { DIR_VEC, DIRS, type Dir, type OpenFn, type Point } from './movement';
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
  /** Seconds before the move may start again (Dash). */
  cool: number;
  /** Dash: the way Bolt will shoot, and the tile it starts from. */
  aim: Dir | null;
  from: Point | null;
}

export function createSpecials(): SpecialState[] {
  return [0, 1, 2, 3].map(() => ({
    phase: 'ready',
    time: 0,
    charge: 0,
    cool: 0,
    aim: null,
    from: null,
  }));
}

export interface SpecialContext {
  row: LevelRow;
  mode: Mode;
  opponents: readonly Opponent[];
  /** Whether an opponent is inside the tunnel. */
  inTunnel: (o: Opponent) => boolean;
  /** The hero's tile. */
  hero: Point;
  /** Whether a tile can be walked on. */
  open: OpenFn;
}

/** An opponent that could use or keep using a special move. */
function able(o: Opponent | undefined): boolean {
  return o !== undefined && o.state === 'out' && !o.scared;
}

function reset(s: SpecialState): void {
  s.phase = 'ready';
  s.time = 0;
  s.charge = 0;
  s.aim = null;
  s.from = null;
}

/** Whether any opponent other than `index` is mid-move (the one-at-a-time rule). */
export function othersBusy(specials: readonly SpecialState[], index: number): boolean {
  return specials.some((s, i) => i !== index && s.phase !== 'ready');
}

/** Advances every opponent's special move by `dt` seconds. */
export function tickSpecials(specials: SpecialState[], ctx: SpecialContext, dt: number): void {
  tickFrenzy(specials, ctx, dt);
  tickDash(specials, ctx, dt);
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

/**
 * The way to the hero if Bolt (at a tile centre) can see it straight down an open
 * corridor within `range` tiles, else null.
 */
export function dashAim(from: Point, hero: Point, open: OpenFn, range: number): Dir | null {
  if (!Number.isInteger(from.x) || !Number.isInteger(from.y)) return null;
  for (const dir of DIRS) {
    const [dx, dy] = DIR_VEC[dir];
    for (let n = 1; n <= range; n++) {
      const x = from.x + dx * n;
      const y = from.y + dy * n;
      if (!open(x, y)) break;
      if (x === hero.x && y === hero.y) return dir;
    }
  }
  return null;
}

/** A tile centre where a dash ends: a junction (3+ ways open) or a wall ahead. */
export function dashStops(m: Point & { dir: Dir }, open: OpenFn): boolean {
  const [dx, dy] = DIR_VEC[m.dir];
  if (!open(m.x + dx, m.y + dy)) return true;
  const ways = DIRS.filter((d) => open(m.x + DIR_VEC[d][0], m.y + DIR_VEC[d][1])).length;
  return ways >= 3;
}

/** Bolt's Dash: sees the hero down a straight corridor, stops (tell), then shoots along it. */
function tickDash(specials: SpecialState[], ctx: SpecialContext, dt: number): void {
  const s = specials[2];
  const bolt = ctx.opponents[2];
  const d = ctx.row.dash;
  if (!s) return;
  s.cool = Math.max(0, s.cool - dt);
  if (!d || !able(bolt)) {
    reset(s);
    return;
  }
  const b = bolt as Opponent;
  switch (s.phase) {
    case 'ready': {
      const aim = dashCanStart(specials, ctx, b);
      if (!aim) return;
      s.phase = 'tell';
      s.time = 0;
      s.charge = 0;
      s.aim = aim;
      s.from = { x: b.x, y: b.y };
      b.dir = aim;
      return;
    }
    case 'tell':
      s.time += dt;
      if (s.time >= d.tell) {
        s.phase = 'active';
        s.time = 0;
      }
      return;
    case 'active':
      // The game ends a dash at the next junction (`endDash`); this cap is a safety net.
      s.time += dt;
      if (s.time > DASH_MAX_SECONDS) endDash(s, d.cooldown);
      return;
  }
}

/** Longest a dash can last, whatever the maze. */
const DASH_MAX_SECONDS = 3;

/**
 * The way Bolt would dash from position `m`, or null if it may not dash there.
 * The game also asks this at every tile centre Bolt passes, and stops Bolt on
 * the centre where it is true, so the tell starts exactly there.
 */
export function dashCanStart(
  specials: readonly SpecialState[],
  ctx: SpecialContext,
  m: Opponent,
): Dir | null {
  const s = specials[2];
  const d = ctx.row.dash;
  if (!s || !d || s.phase !== 'ready' || s.cool > 0 || !able(m)) return null;
  if (othersBusy(specials, 2) || ctx.inTunnel(m)) return null;
  if (s.charge === Number.MAX_VALUE) return primedAim(m, ctx);
  return dashAim(m, ctx.hero, ctx.open, d.range);
}

/** A primed dash (test hook) shoots the way Bolt faces, or the first open way. */
function primedAim(b: Opponent, ctx: SpecialContext): Dir | null {
  if (!Number.isInteger(b.x) || !Number.isInteger(b.y)) return null;
  const [dx, dy] = DIR_VEC[b.dir];
  if (ctx.open(b.x + dx, b.y + dy)) return b.dir;
  return DIRS.find((dir) => ctx.open(b.x + DIR_VEC[dir][0], b.y + DIR_VEC[dir][1])) ?? null;
}

/** Ends a dash and starts its cooldown. */
export function endDash(s: SpecialState, cooldown: number): void {
  reset(s);
  s.cool = cooldown;
}

/** Speed multiplier from an opponent's special move: slower in a tell, faster in the move. */
export function specialSpeed(row: LevelRow, index: number, s: SpecialState | undefined): number {
  if (!s || s.phase === 'ready') return 1;
  if (index === 0 && row.frenzy) {
    return s.phase === 'tell' ? row.frenzy.tellSpeed : row.frenzy.factor;
  }
  // Bolt stands still while it takes aim, then shoots.
  if (index === 2 && row.dash) return s.phase === 'tell' ? 0 : row.dash.factor;
  return 1;
}

/** Test hook: makes an opponent's move due, so it starts as soon as the rules allow. */
export function primeSpecial(specials: SpecialState[], index: number): void {
  const s = specials[index];
  if (s) s.charge = Number.MAX_VALUE;
}
