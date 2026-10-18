import { describe, expect, it } from 'vitest';
import {
  chooseToward,
  gap,
  move,
  steer,
  tileOf,
  toNextCentre,
  type Dir,
  type Mover,
  type OpenFn,
} from '../../src/logic/movement';

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

describe('chooseToward', () => {
  it('takes the open direction that ends nearest the target, never reversing', () => {
    // At (3, 1) heading right: right, down (left is a reverse; up is a wall).
    expect(chooseToward(at(3, 1, 'right'), { x: 3, y: 3 }, open)).toBe('down');
    expect(chooseToward(at(3, 1, 'right'), { x: 5, y: 1 }, open)).toBe('right');
    // The target is behind, but reversing isn't allowed while another way is open.
    expect(chooseToward(at(3, 1, 'right'), { x: 1, y: 1 }, open)).toBe('down');
  });

  it('breaks ties in the order up, left, down, right', () => {
    // At (3, 3) heading up: left and right are equally near a target straight above.
    expect(chooseToward(at(3, 3, 'down'), { x: 3, y: 0 }, open)).toBe('left');
  });

  it('reverses only from a dead end', () => {
    const lane = openIn(['#####', '#...#', '#####']);
    expect(chooseToward(at(3, 1, 'right'), { x: 9, y: 9 }, lane)).toBe('left');
  });
});

describe('steer', () => {
  it('asks for a direction at every tile centre it passes', () => {
    const m = at(1, 1, 'right');
    const asked: string[] = [];
    steer(m, 2.5, (x) => (asked.push(`${x.x},${x.y}`), 'right'), open, 7);
    expect(asked).toEqual(['1,1', '2,1', '3,1']);
    expect(m.x).toBe(3.5);
  });

  it('chases a target around corners', () => {
    const m = at(1, 1, 'right');
    const target = { x: 5, y: 3 };
    // Opponents never stop, so check that it passes through the target within 7 tiles.
    const visited = new Set<string>();
    for (let i = 0; i < 28; i++) {
      steer(m, 0.25, (x) => chooseToward(x, target, open), open, 7);
      visited.add(`${m.x},${m.y}`);
    }
    expect(visited).toContain('5,3');
  });

  it('stops against a wall when its choice is blocked', () => {
    const m = at(5, 1, 'right');
    steer(m, 1, () => 'right', open, 7);
    expect(m).toMatchObject({ x: 5, moving: false });
  });
});

describe('toNextCentre and gap', () => {
  it('measures to the next centre ahead', () => {
    expect(toNextCentre(at(2, 1, 'right'))).toBe(1);
    expect(toNextCentre(at(2.25, 1, 'right'))).toBe(0.75);
    expect(toNextCentre(at(2.25, 1, 'left'))).toBe(0.25);
    expect(toNextCentre(at(1, 2.5, 'up'))).toBe(0.5);
  });

  it('measures the short way through the tunnel', () => {
    expect(gap({ x: 0, y: 1 }, { x: 23, y: 1 }, 24)).toBe(1);
    expect(gap({ x: 2, y: 1 }, { x: 4, y: 3 }, 24)).toBe(4);
  });
});
