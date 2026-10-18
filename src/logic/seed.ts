/** Largest run seed: seeds are unsigned 32-bit integers. */
export const MAX_SEED = 0xffffffff;

/**
 * Reads a run seed from the `?seed=` URL value (WW-08). Only plain decimal
 * digits, at most 10 of them, with a value of at most MAX_SEED are accepted.
 * Anything else (signs, spaces, exponents, hex, empty) returns null, and the
 * game then picks a random seed.
 */
export function parseSeed(raw: string | null): number | null {
  if (raw === null || !/^[0-9]{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_SEED ? n : null;
}

/** Turns 32 random bits into a run seed. */
export function seedFromRandomWord(word: number): number {
  return word >>> 0;
}
