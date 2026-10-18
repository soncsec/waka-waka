/**
 * Seeded pseudo-random number generator (mulberry32).
 * Gameplay randomness goes through this so tests can replay a run exactly (ADR-006).
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`invalid int range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min, max) {
      if (max < min) throw new RangeError(`invalid range [${min}, ${max})`);
      return min + next() * (max - min);
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('cannot pick from an empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
  };
}

/**
 * Derives a new 32-bit seed from a seed and a number (for example a maze number
 * or a retry count), so each maze in a run gets its own repeatable seed.
 */
export function mixSeed(seed: number, n: number): number {
  let h = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n >>> 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}
