import { describe, expect, it } from 'vitest';
import { JOYSTICK } from '../../src/config/tuning';
import { knobOffset, stickDirection } from '../../src/logic/joystick';

describe('the joystick (M4.1)', () => {
  it('keeps the knob under the thumb inside the rim, and on the rim past it', () => {
    expect(knobOffset(10, -5, 36)).toEqual({ x: 10, y: -5 });
    const k = knobOffset(72, 0, 36);
    expect(k).toEqual({ x: 36, y: 0 });
    const d = knobOffset(30, 40, 36);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(36);
    expect(d.y / d.x).toBeCloseTo(40 / 30);
  });

  it('does not steer inside the dead zone', () => {
    expect(stickDirection(JOYSTICK.deadZone - 1, 0, JOYSTICK.deadZone)).toBeNull();
  });

  it('points the way the thumb moved most', () => {
    const z = JOYSTICK.deadZone;
    expect(stickDirection(z + 5, 3, z)).toBe('right');
    expect(stickDirection(-z - 5, 3, z)).toBe('left');
    expect(stickDirection(4, z + 5, z)).toBe('down');
    expect(stickDirection(4, -z - 5, z)).toBe('up');
  });
});
