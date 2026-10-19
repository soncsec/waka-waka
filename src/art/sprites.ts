import { NEON } from '../config/tuning';
import type { Dir } from '../logic/movement';
import type { Pixels } from './walls';

/** Sprites are 16 x 16 pixels, one tile. */
export const SPRITE_SIZE = 16;

/** Paints a sprite: `colour` returns an 0xRRGGBB colour, or null for transparent. */
export function paint(size: number, colour: (px: number, py: number) => number | null): Pixels {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const c = colour(px, py);
      if (c === null) continue;
      const i = (py * size + px) * 4;
      data[i] = (c >> 16) & 0xff;
      data[i + 1] = (c >> 8) & 0xff;
      data[i + 2] = c & 0xff;
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

const FACING: Readonly<Record<Dir, number>> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/** Top-left pixel of the hero's 2 x 2 eye, for each facing. */
const EYE: Readonly<Record<Dir, readonly [number, number]>> = {
  right: [8, 3],
  left: [6, 3],
  up: [3, 6],
  down: [3, 8],
};

/** Mouth opening (radians either side of the facing) for each chomp frame. */
export const HERO_MOUTH_FRAMES: readonly number[] = [0.15, 0.45, 0.75, 0.45];

/**
 * The hero (WW-04): a round teal chomper with a shaded rim, a row of teeth
 * along the mouth and an eye, facing `dir` with its mouth open by `mouth` radians.
 */
export function heroPixels(dir: Dir, mouth: number): Pixels {
  const face = FACING[dir];
  const [ex, ey] = EYE[dir];
  return paint(SPRITE_SIZE, (px, py) => {
    if (px >= ex && px <= ex + 1 && py >= ey && py <= ey + 1) return NEON.heroEye;
    const dx = px - 7.5;
    const dy = py - 7.5;
    const r = Math.hypot(dx, dy);
    if (r > 6.9) return null;
    let a = Math.atan2(dy, dx) - face;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) < mouth * 0.9) return null;
    const teeth = Math.abs(a) < mouth * 0.9 + 0.42 && r > 3.5 && (px + py) % 2 === 0;
    if (teeth && mouth > 0.2) return NEON.heroTeeth;
    return r > 5.6 && dx + dy > 2 ? NEON.heroShade : NEON.hero;
  });
}

/** The four opponents, in order: Murk, Gnash, Bolt, Wisp. */
export type OpponentIndex = 0 | 1 | 2 | 3;

/** Body shapes (WW-04). dx, dy: offset from the centre; r, a: polar; t: animation time 0..1. */
const SHAPES: readonly ((
  dx: number,
  dy: number,
  r: number,
  a: number,
  t: number,
  px: number,
) => boolean)[] = [
  // Murk: a spiky ball whose spikes turn.
  (_dx, _dy, r, a, t) => r < 4.6 + (Math.cos(6 * a + t * 5) > 0.35 ? 2.6 : 0),
  // Gnash: a box with clipped corners (its teeth are drawn on top).
  (dx, dy) => Math.abs(dx) <= 6 && Math.abs(dy) <= 6 && !(Math.abs(dx) === 6 && Math.abs(dy) === 6),
  // Bolt: a diamond.
  (dx, dy) => Math.abs(dx) + Math.abs(dy) <= 7.6,
  // Wisp: a jelly with a rippling skirt.
  (dx, dy, r, _a, t, px) =>
    dy <= 0.5
      ? r <= 6.6
      : dy <= 7.5 && Math.abs(dx) <= 6.6 && (px + Math.floor(t * 6) + (dy > 4 ? 1 : 0)) % 3 !== 0,
];

/** Where an opponent's pupils look, for each facing. */
const LOOK: Readonly<Record<Dir, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * An opponent (WW-04): its body shape in its colour with a dark outline, and two
 * eyes looking the way it moves. `frame` animates Murk's spikes and Wisp's skirt.
 */
export function opponentPixels(who: OpponentIndex, dir: Dir, frame: number): Pixels {
  const shape = SHAPES[who] as (typeof SHAPES)[number];
  const t = frame / 6;
  const body = (px: number, py: number): boolean => {
    if (px < 0 || py < 0 || px >= SPRITE_SIZE || py >= SPRITE_SIZE) return false;
    const dx = px - 7.5;
    const dy = py - 7.5;
    return shape(dx, dy, Math.hypot(dx, dy), Math.atan2(dy, dx), t, px);
  };
  const [ox, oy] = LOOK[dir];
  return paint(SPRITE_SIZE, (px, py) => {
    for (const ex of [4, 9]) {
      if (px === ex + 1 + ox && py === 6 + oy) return NEON.pupil;
      if (px >= ex && px < ex + 3 && py >= 5 && py < 8) return NEON.eyeWhite;
    }
    if (who === 1 && py === 11 && px >= 3 && px <= 12 && (px - 3) % 2 === 0) return NEON.gnashTeeth;
    if (body(px, py)) return NEON.opponents[who];
    const touches = body(px + 1, py) || body(px - 1, py) || body(px, py + 1) || body(px, py - 1);
    return touches ? NEON.opponentOutline : null;
  });
}

/** How an opponent is drawn: normal, scared (M2.3), scared and flashing, or eaten (eyes only). */
export type OpponentLook = 'scared' | 'flash';

/**
 * A scared opponent keeps its own shape, so players can still tell them apart,
 * but turns blue (white when flashing) with a small dotted face and a wavy mouth.
 */
export function scaredPixels(who: OpponentIndex, look: OpponentLook, frame: number): Pixels {
  const shape = SHAPES[who] as (typeof SHAPES)[number];
  const t = frame / 6;
  const body = (px: number, py: number): boolean => {
    if (px < 0 || py < 0 || px >= SPRITE_SIZE || py >= SPRITE_SIZE) return false;
    const dx = px - 7.5;
    const dy = py - 7.5;
    return shape(dx, dy, Math.hypot(dx, dy), Math.atan2(dy, dx), t, px);
  };
  const fill = look === 'flash' ? NEON.scaredFlash : NEON.scared;
  const face = look === 'flash' ? NEON.scaredFlashFace : NEON.scaredFace;
  return paint(SPRITE_SIZE, (px, py) => {
    if (body(px, py)) {
      const eye = py === 6 && (px === 5 || px === 6 || px === 9 || px === 10);
      const mouth = px >= 4 && px <= 11 && py === (px % 2 === 0 ? 10 : 11);
      return eye || mouth ? face : fill;
    }
    const touches = body(px + 1, py) || body(px - 1, py) || body(px, py + 1) || body(px, py - 1);
    return touches ? NEON.opponentOutline : null;
  });
}

/** An eaten opponent: just its eyes, looking the way they travel. */
export function eyesPixels(dir: Dir): Pixels {
  const [ox, oy] = LOOK[dir];
  return paint(SPRITE_SIZE, (px, py) => {
    for (const ex of [4, 9]) {
      if (px === ex + 1 + ox && py === 6 + oy) return NEON.pupil;
      if (px >= ex && px < ex + 3 && py >= 5 && py < 8) return NEON.eyeWhite;
      const ring = px >= ex - 1 && px < ex + 4 && py >= 4 && py < 9;
      if (ring) return NEON.opponentOutline;
    }
    return null;
  });
}
