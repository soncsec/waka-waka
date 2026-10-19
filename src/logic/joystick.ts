import type { Point } from './movement';
import { swipeDirection } from './swipe';

/**
 * Where the joystick knob sits for a thumb `dx`, `dy` from where it landed:
 * the same point, pulled back onto the rim when it is past `radius`.
 */
export function knobOffset(dx: number, dy: number, radius: number): Point {
  const d = Math.hypot(dx, dy);
  if (d <= radius) return { x: dx, y: dy };
  return { x: (dx / d) * radius, y: (dy / d) * radius };
}

/** The joystick's direction: like a swipe (WW-06), the longer axis wins once past the dead zone. */
export const stickDirection = swipeDirection;
