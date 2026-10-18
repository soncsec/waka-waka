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
