/**
 * Grid movement (WW-01): plain TypeScript, unit tested.
 *
 * Positions are in tiles: (3, 5) is the centre of tile column 3, row 5.
 * An actor moves along one axis at a time, so while moving one coordinate is a
 * whole number and the other is between two tile centres. Turns happen only at
 * tile centres; reversing is allowed anywhere.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'left', 'down', 'right'];

export const DIR_VEC: Readonly<Record<Dir, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export interface Point {
  x: number;
  y: number;
}

export interface Mover extends Point {
  dir: Dir;
  /** False when the last step was blocked by a wall. */
  moving: boolean;
}

/** Whether the tile at (x, y) can be entered; it handles wrap-around itself. */
export type OpenFn = (x: number, y: number) => boolean;

/**
 * Moves `m` up to `distance` tiles. A buffered `wanted` direction is taken at the
 * first tile centre where it is open; the opposite direction is taken at once.
 * Returns the direction to keep buffered: null once it has been taken.
 * `width` is the maze width, for wrapping through the tunnel.
 */
export function move(
  m: Mover,
  wanted: Dir | null,
  distance: number,
  open: OpenFn,
  width: number,
): Dir | null {
  let buffered = wanted === m.dir ? null : wanted;
  if (buffered !== null && buffered === OPPOSITE[m.dir]) {
    m.dir = buffered;
    buffered = null;
  }

  let left = distance;
  // Each pass reaches at most one tile centre; the guard only stops runaway loops.
  for (let guard = 0; left > 0 && guard < 64; guard++) {
    if (Number.isInteger(m.x) && Number.isInteger(m.y)) {
      if (buffered !== null) {
        const [wx, wy] = DIR_VEC[buffered];
        if (open(m.x + wx, m.y + wy)) {
          m.dir = buffered;
          buffered = null;
        }
      }
      const [dx, dy] = DIR_VEC[m.dir];
      if (!open(m.x + dx, m.y + dy)) {
        m.moving = false;
        return buffered;
      }
    }

    const [dx, dy] = DIR_VEC[m.dir];
    const axis = dx !== 0 ? 'x' : 'y';
    const sign = dx + dy;
    const pos = m[axis];
    const next = sign > 0 ? Math.floor(pos) + 1 : Math.ceil(pos) - 1;
    const toNext = Math.abs(next - pos);
    m.moving = true;
    if (left >= toNext) {
      m[axis] = next;
      left -= toNext;
      // Through the tunnel: reappear on the other side.
      if (m.x < 0) m.x += width;
      else if (m.x > width - 1) m.x -= width;
    } else {
      m[axis] = pos + sign * left;
      left = 0;
    }
  }
  return buffered;
}

/** The tile an actor is in: its position rounded, wrapped into the maze. */
export function tileOf(p: Point, width: number): Point {
  return { x: ((Math.round(p.x) % width) + width) % width, y: Math.round(p.y) };
}
