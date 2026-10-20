import { describe, expect, it } from 'vitest';
import {
  heroPixels,
  HERO_MOUTH_FRAMES,
  opponentPixels,
  speakerPixels,
  SPRITE_SIZE,
} from '../../src/art/sprites';
import { NEON } from '../../src/config/tuning';

const pixel = (data: Uint8ClampedArray, x: number, y: number): number | null => {
  const i = (y * SPRITE_SIZE + x) * 4;
  if (data[i + 3] === 0) return null;
  return ((data[i] as number) << 16) | ((data[i + 1] as number) << 8) | (data[i + 2] as number);
};

describe('heroPixels', () => {
  it('is one 16 x 16 tile', () => {
    const art = heroPixels('left', 0.45);
    expect([art.width, art.height, art.data.length]).toEqual([16, 16, 16 * 16 * 4]);
  });

  it('opens its mouth in the direction it faces', () => {
    const right = heroPixels('right', 0.75).data;
    const left = heroPixels('left', 0.75).data;
    expect(pixel(right, 13, 8)).toBeNull();
    expect(pixel(right, 2, 8)).not.toBeNull();
    expect(pixel(left, 2, 8)).toBeNull();
    expect(pixel(left, 13, 8)).not.toBeNull();
  });

  it('has an eye, teeth when open, and the body colour', () => {
    const art = heroPixels('up', 0.75).data;
    const colours = new Set<number | null>();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) colours.add(pixel(art, x, y));
    expect(colours).toContain(NEON.hero);
    expect(colours).toContain(NEON.heroEye);
    expect(colours).toContain(NEON.heroTeeth);
  });

  it('has a frame for each mouth position', () => {
    expect(HERO_MOUTH_FRAMES.length).toBe(4);
  });
});

describe('opponentPixels', () => {
  it('draws each opponent in its own colour, with eyes and an outline', () => {
    for (const who of [0, 1, 2, 3] as const) {
      const art = opponentPixels(who, 'left', 0).data;
      const colours = new Set<number | null>();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) colours.add(pixel(art, x, y));
      expect(colours).toContain(NEON.opponents[who]);
      expect(colours).toContain(NEON.eyeWhite);
      expect(colours).toContain(NEON.pupil);
      expect(colours).toContain(NEON.opponentOutline);
    }
  });

  it('looks the way it moves', () => {
    expect(pixel(opponentPixels(0, 'left', 0).data, 4, 6)).toBe(NEON.pupil);
    expect(pixel(opponentPixels(0, 'right', 0).data, 6, 6)).toBe(NEON.pupil);
  });

  it('animates Murk but not Bolt', () => {
    const same = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean =>
      a.every((v, i) => v === b[i]);
    expect(same(opponentPixels(0, 'up', 0).data, opponentPixels(0, 'up', 1).data)).toBe(false);
    expect(same(opponentPixels(2, 'up', 0).data, opponentPixels(2, 'up', 1).data)).toBe(true);
  });
});

describe('speakerPixels (M5.2)', () => {
  const lit = (p: ReturnType<typeof speakerPixels>): number =>
    Array.from({ length: p.width * p.height }, (_, i) => p.data[i * 4 + 3]).filter((a) => a === 255)
      .length;

  it('draws a sprite-sized speaker, different when muted', () => {
    const on = speakerPixels(false);
    const off = speakerPixels(true);
    expect([on.width, on.height]).toEqual([SPRITE_SIZE, SPRITE_SIZE]);
    expect(lit(on)).toBeGreaterThan(20);
    expect(lit(off)).toBeGreaterThan(20);
    expect(Array.from(off.data)).not.toEqual(Array.from(on.data));
  });
});
