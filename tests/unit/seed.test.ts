import { describe, expect, it } from 'vitest';
import { MAX_SEED, parseSeed, seedFromRandomWord } from '../../src/logic/seed';

describe('parseSeed', () => {
  it('accepts plain decimal integers from 0 to 2^32 - 1', () => {
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed('0042')).toBe(42);
    expect(parseSeed('4294967295')).toBe(MAX_SEED);
  });

  it('ignores anything else', () => {
    for (const raw of [
      null,
      '',
      ' 1',
      '1 ',
      '-1',
      '+1',
      '1.5',
      '1e5',
      '0x10',
      'abc',
      '4294967296',
      '99999999999',
      '<script>',
      '１２３',
    ]) {
      expect(parseSeed(raw), String(raw)).toBeNull();
    }
  });
});

describe('seedFromRandomWord', () => {
  it('keeps 32-bit unsigned values', () => {
    expect(seedFromRandomWord(-1)).toBe(MAX_SEED);
    expect(seedFromRandomWord(7)).toBe(7);
  });
});
