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

/** Distance to the next tile centre ahead: 1 when already on a centre. */
export function toNextCentre(m: Mover): number {
  const [dx] = DIR_VEC[m.dir];
  const pos = dx !== 0 ? m.x : m.y;
  if (Number.isInteger(m.x) && Number.isInteger(m.y)) return 1;
  const sign = DIR_VEC[m.dir][0] + DIR_VEC[m.dir][1];
  const next = sign > 0 ? Math.floor(pos) + 1 : Math.ceil(pos) - 1;
  return Math.abs(next - pos);
}

/**
 * Moves an actor that picks its own way (an opponent) up to `distance` tiles.
 * `choose` is asked for a direction at every tile centre it reaches, so no
 * junction is skipped even when one step passes a centre.
 */
export function steer(
  m: Mover,
  distance: number,
  choose: (m: Mover) => Dir,
  open: OpenFn,
  width: number,
  stop?: (m: Mover) => boolean,
): void {
  let left = distance;
  for (let guard = 0; left > 0 && guard < 64; guard++) {
    if (Number.isInteger(m.x) && Number.isInteger(m.y)) {
      // `stop` ends the move at a tile centre (eyes reaching the house).
      if (stop?.(m)) return;
      m.dir = choose(m);
    }
    const d = Math.min(left, toNextCentre(m));
    move(m, null, d, open, width);
    if (!m.moving) return;
    left -= d;
  }
}

/**
 * The direction a target-seeking opponent takes from a tile centre (WW-02):
 * the open direction, other than reversing, that ends nearest the target
 * (straight-line distance). Ties go up, left, down, right. It reverses only
 * when nothing else is open.
 */
export function chooseToward(m: Mover, target: Point, open: OpenFn): Dir {
  let best: Dir | null = null;
  let bestDist = Infinity;
  for (const dir of DIRS) {
    if (dir === OPPOSITE[m.dir]) continue;
    const [dx, dy] = DIR_VEC[dir];
    if (!open(m.x + dx, m.y + dy)) continue;
    const d = (m.x + dx - target.x) ** 2 + (m.y + dy - target.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = dir;
    }
  }
  return best ?? OPPOSITE[m.dir];
}

/** Grid distance between two actors along each axis, the short way round through the tunnel. */
export function gap(a: Point, b: Point, width: number): number {
  const dx = Math.abs(a.x - b.x);
  return Math.min(dx, width - dx) + Math.abs(a.y - b.y);
}

/** The tile an actor is in: its position rounded, wrapped into the maze. */
export function tileOf(p: Point, width: number): Point {
  return { x: ((Math.round(p.x) % width) + width) % width, y: Math.round(p.y) };
}

/** A random open direction, not reversing (scared opponents, WW-02). Uses the seeded RNG. */
export function chooseRandom(m: Mover, open: OpenFn, pick: (dirs: readonly Dir[]) => Dir): Dir {
  const options = DIRS.filter((dir) => {
    if (dir === OPPOSITE[m.dir]) return false;
    const [dx, dy] = DIR_VEC[dir];
    return open(m.x + dx, m.y + dy);
  });
  return options.length > 0 ? pick(options) : OPPOSITE[m.dir];
}

/**
 * The first step of a shortest path from `m` (at a tile centre) to `target`,
 * by breadth-first search over open tiles; reversing is allowed. Used only by
 * eaten opponents' eyes, which must always find the house: greedy targeting can
 * circle a block for ever in a generated maze. Chasing keeps `chooseToward` (WW-02).
 */
export function chooseShortest(
  m: Mover,
  target: Point,
  open: OpenFn,
  width: number,
  height: number,
): Dir {
  const wrap = (x: number): number => ((x % width) + width) % width;
  const key = (x: number, y: number): number => y * width + wrap(x);
  const dist = new Map<number, number>([[key(target.x, target.y), 0]]);
  const queue: Point[] = [target];
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head] as Point;
    const d = dist.get(key(p.x, p.y)) ?? 0;
    for (const dir of DIRS) {
      const [dx, dy] = DIR_VEC[dir];
      const x = wrap(p.x + dx);
      const y = p.y + dy;
      if (y < 0 || y >= height || dist.has(key(x, y)) || !open(x, y)) continue;
      dist.set(key(x, y), d + 1);
      queue.push({ x, y });
    }
  }
  let best: Dir = m.dir;
  let bestDist = Infinity;
  for (const dir of DIRS) {
    const [dx, dy] = DIR_VEC[dir];
    const d = dist.get(key(m.x + dx, m.y + dy));
    if (d !== undefined && d < bestDist) {
      bestDist = d;
      best = dir;
    }
  }
  return best;
}
