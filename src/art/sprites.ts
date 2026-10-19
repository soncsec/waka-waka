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
export function opponentPixels(
  who: OpponentIndex,
  dir: Dir,
  frame: number,
  /** Body colour; defaults to the opponent's own (the Frenzy tell uses white-hot). */
  colour: number = NEON.opponents[who],
): Pixels {
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
    if (body(px, py)) return colour;
    const touches = body(px + 1, py) || body(px - 1, py) || body(px, py + 1) || body(px, py - 1);
    return touches ? NEON.opponentOutline : null;
  });
}

/** How a scared opponent is drawn: steady, or flashing as the scare runs out. */
export type OpponentLook = 'scared' | 'flash';

/**
 * A scared opponent (M2.3, redrawn in M2.7) keeps its own shape, so players can
 * still tell them apart, but looks short-circuited: a dark body with a pale edge
 * and a zigzag spark across it. Flashing swaps to pink. No eyes.
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
  const edge = look === 'flash' ? NEON.scaredFlashFace : NEON.scaredFace;
  // The spark line zigzags and shifts with the animation frame.
  const zig = (px: number): number => 7 + ((px + frame) % 4 < 2 ? -1 : 1);
  return paint(SPRITE_SIZE, (px, py) => {
    if (body(px, py)) {
      const inner = body(px + 1, py) && body(px - 1, py) && body(px, py + 1) && body(px, py - 1);
      if (!inner) return edge;
      return py === zig(px) && px >= 3 && px <= 12 ? edge : fill;
    }
    const touches = body(px + 1, py) || body(px - 1, py) || body(px, py + 1) || body(px, py - 1);
    return touches ? NEON.opponentOutline : null;
  });
}

/** Frames of the spark an eaten opponent travels home as. */
export const SPARK_FRAMES = 2;

/** An eaten opponent: a small twinkling spark (M2.7: not Pac-Man's floating eyes). */
export function sparkPixels(frame: number): Pixels {
  const long = frame % 2 === 0;
  return paint(SPRITE_SIZE, (px, py) => {
    const dx = Math.abs(px - 7.5);
    const dy = Math.abs(py - 7.5);
    if (dx <= 1 && dy <= 1) return NEON.sparkCore;
    // Rays along the axes; on the other frame, short diagonal rays instead.
    if (long && ((dx <= 0.5 && dy <= 4.5) || (dy <= 0.5 && dx <= 4.5))) return NEON.sparkRay;
    if (!long && Math.abs(dx - dy) < 0.6 && dx <= 3.5) return NEON.sparkRay;
    return null;
  });
}

/**
 * Bolt's Dash tell and dash (WW-10): its diamond stretched long and thin,
 * pointing the way it will shoot, with its eyes looking that way.
 */
export function dashPixels(dir: Dir): Pixels {
  const along = dir === 'left' || dir === 'right';
  const [ox, oy] = LOOK[dir];
  const body = (px: number, py: number): boolean => {
    if (px < 0 || py < 0 || px >= SPRITE_SIZE || py >= SPRITE_SIZE) return false;
    const dx = Math.abs(px - 7.5);
    const dy = Math.abs(py - 7.5);
    return along ? dx / 7.6 + dy / 4.2 <= 1 : dx / 4.2 + dy / 7.6 <= 1;
  };
  return paint(SPRITE_SIZE, (px, py) => {
    for (const [ex, ey] of along
      ? [
          [5, 6],
          [9, 6],
        ]
      : [
          [6, 5],
          [6, 9],
        ]) {
      const x = ex as number;
      const y = ey as number;
      if (px === x + 1 + ox && py === y + oy) return NEON.pupil;
      if (px >= x && px < x + 3 && py >= y - 1 && py < y + 2 && along === true)
        return NEON.eyeWhite;
      if (px >= x - 1 && px < x + 2 && py >= y && py < y + 3 && along === false)
        return NEON.eyeWhite;
    }
    if (body(px, py)) return NEON.opponents[2];
    const touches = body(px + 1, py) || body(px - 1, py) || body(px, py + 1) || body(px, py - 1);
    return touches ? NEON.opponentOutline : null;
  });
}

/**
 * Gnash's Lunge tell and jump (WW-10): its box with the mouth wide open and the
 * teeth bared top and bottom, eyes narrowed towards the way it will jump.
 */
export function lungePixels(dir: Dir): Pixels {
  const [ox, oy] = LOOK[dir];
  const body = (px: number, py: number): boolean =>
    px >= 1 &&
    px <= 14 &&
    py >= 1 &&
    py <= 14 &&
    !((px === 1 || px === 14) && (py === 1 || py === 14));
  return paint(SPRITE_SIZE, (px, py) => {
    // Narrow eyes: one row of white with the pupil.
    for (const ex of [4, 9]) {
      if (py === 4 && px >= ex && px < ex + 3)
        return px === ex + 1 + ox && oy >= 0 ? NEON.pupil : NEON.eyeWhite;
      if (py === 3 && px === ex + 1 + ox && oy < 0) return NEON.pupil;
    }
    // The open mouth, with teeth along its top and bottom edges.
    if (px >= 3 && px <= 12 && py >= 7 && py <= 12) {
      if ((py === 7 || py === 12) && (px - 3) % 2 === 0) return NEON.gnashTeeth;
      return NEON.opponentOutline;
    }
    if (body(px, py)) return NEON.opponents[1];
    const touches = body(px + 1, py) || body(px - 1, py) || body(px, py + 1) || body(px, py - 1);
    return touches ? NEON.opponentOutline : null;
  });
}
