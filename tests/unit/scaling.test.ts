import { describe, expect, it } from 'vitest';
import { integerZoom, needsRotate } from '../../src/logic/scaling';

describe('integerZoom', () => {
  it('picks the largest whole zoom that fits', () => {
    expect(integerZoom(1920, 1080, 256, 320)).toBe(3); // height limits: 1080 / 320 = 3.375
    expect(integerZoom(2560, 1440, 256, 320)).toBe(4); // 1440 / 320 = 4.5
    expect(integerZoom(800, 600, 256, 320)).toBe(1); // 600 / 320 = 1.875
  });

  it('uses the tighter of width and height', () => {
    expect(integerZoom(600, 2000, 256, 320)).toBe(2); // width limits: 600 / 256 = 2.34
  });

  it('returns exact multiples unchanged', () => {
    expect(integerZoom(512, 640, 256, 320)).toBe(2);
  });

  it('never goes below 1 for tiny or empty windows', () => {
    expect(integerZoom(100, 100, 256, 320)).toBe(1);
    expect(integerZoom(0, 0, 256, 320)).toBe(1);
    expect(integerZoom(Number.NaN, 600, 256, 320)).toBe(1);
  });

  it('rejects a non-positive game size', () => {
    expect(() => integerZoom(800, 600, 0, 320)).toThrow(RangeError);
    expect(() => integerZoom(800, 600, 256, -1)).toThrow(RangeError);
  });
});

describe('needsRotate (WW-05)', () => {
  const W = 384;
  const H = 464;
  it('asks a phone held landscape to turn upright', () => {
    expect(needsRotate(844, 390, W, H)).toBe(true);
    expect(needsRotate(640, 360, W, H)).toBe(false); // too small even upright: nothing to gain
    expect(needsRotate(740, 400, W, H)).toBe(true);
  });

  it('never asks when the game already fits, or when upright', () => {
    expect(needsRotate(1024, 768, W, H)).toBe(false); // tablet, landscape
    expect(needsRotate(1920, 950, W, H)).toBe(false); // laptop
    expect(needsRotate(390, 844, W, H)).toBe(false); // phone, upright
    expect(needsRotate(500, 500, W, H)).toBe(false); // square
  });
});
