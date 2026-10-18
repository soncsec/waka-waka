import type { Dir } from './movement';

/**
 * The direction of a swipe from its start to its current point, or null while
 * it is shorter than `minDistance`. The longer axis wins (WW-06).
 */
export function swipeDirection(dx: number, dy: number, minDistance: number): Dir | null {
  if (Math.hypot(dx, dy) < minDistance) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
