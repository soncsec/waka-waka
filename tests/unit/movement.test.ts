import { describe, expect, it } from 'vitest';
import { move, tileOf, type Dir, type Mover, type OpenFn } from '../../src/logic/movement';

/** Open test for a small hand-drawn map; `wrapRow` wraps left-right like the tunnel. */
function openIn(map: string[], wrapRow = -1): OpenFn {
  const w = (map[0] as string).length;
  return (x, y) => {
    const tx = y === wrapRow ? ((x % w) + w) % w : x;
    return map[y]?.[tx] === '.';
  };
}

const BOX = ['#######', '#.....#', '#.#.#.#', '#.....#', '#######'];
const open = openIn(BOX);
const at = (x: number, y: number, dir: Dir): Mover => ({ x, y, dir, moving: true });

describe('move', () => {
  it('moves along a corridor by the given distance', () => {
    const m = at(1, 1, 'right');
    move(m, null, 0.5, open, 7);
    expect(m).toMatchObject({ x: 1.5, y: 1, moving: true });
  });

  it('passes several tile centres in one call', () => {
    const m = at(1, 1, 'right');
    move(m, null, 3.5, open, 7);
    expect(m.x).toBe(4.5);
  });

  it('stops at a wall, centred on the last tile', () => {
    const m = at(4.5, 1, 'right');
    move(m, null, 2, open, 7);
    expect(m).toMatchObject({ x: 5, y: 1, moving: false });
  });

  it('buffers a turn and takes it at the next tile centre where it is open', () => {
    const m = at(2, 1, 'right');
    // Down is a wall at x = 2, so the turn waits for x = 3.
    expect(move(m, 'down', 0.5, open, 7)).toBe('down');
    expect(m).toMatchObject({ x: 2.5, y: 1, dir: 'right' });
    expect(move(m, 'down', 1, open, 7)).toBeNull();
    expect(m).toMatchObject({ x: 3, y: 1.5, dir: 'down' });
  });

  it('reverses at once, even between tile centres', () => {
    const m = at(2.5, 1, 'right');
    expect(move(m, 'left', 0.25, open, 7)).toBeNull();
    expect(m).toMatchObject({ x: 2.25, dir: 'left' });
  });

  it('turns from a standstill against a wall', () => {
    const m = at(5, 1, 'right');
    move(m, null, 1, open, 7);
    expect(m.moving).toBe(false);
    move(m, 'down', 0.5, open, 7);
    expect(m).toMatchObject({ x: 5, y: 1.5, dir: 'down', moving: true });
  });

  it('keeps a turn that is never possible buffered without changing course', () => {
    const m = at(1, 1, 'down');
    expect(move(m, 'left', 1, open, 7)).toBe('left');
    expect(m).toMatchObject({ x: 1, y: 2, dir: 'down' });
  });

  it('drops a wanted direction equal to the current one', () => {
    expect(move(at(1, 1, 'right'), 'right', 0.5, open, 7)).toBeNull();
  });

  it('wraps through the tunnel in both directions', () => {
    const tunnel = openIn(['#####', '.....', '#####'], 1);
    const left = at(0, 1, 'left');
    move(left, null, 1, tunnel, 5);
    expect(left.x).toBe(4);
    const right = at(4, 1, 'right');
    move(right, null, 1.5, tunnel, 5);
    expect(right.x).toBe(0.5);
  });

  it('does nothing for a zero distance', () => {
    const m = at(1.5, 1, 'right');
    move(m, null, 0, open, 7);
    expect(m.x).toBe(1.5);
  });
});

describe('tileOf', () => {
  it('rounds to the nearest tile and wraps into the maze', () => {
    expect(tileOf({ x: 2.4, y: 3 }, 5)).toEqual({ x: 2, y: 3 });
    expect(tileOf({ x: 2.6, y: 3 }, 5)).toEqual({ x: 3, y: 3 });
    expect(tileOf({ x: 4.6, y: 1 }, 5)).toEqual({ x: 0, y: 1 });
    expect(tileOf({ x: -0.6, y: 1 }, 5)).toEqual({ x: 4, y: 1 });
  });
});
