import { describe, expect, it } from 'vitest';
import { formatHighScore, parseHighScore } from '../../src/logic/highscore';

describe('parseHighScore (WW-08)', () => {
  it('accepts plain non-negative integers', () => {
    expect(parseHighScore('0')).toBe(0);
    expect(parseHighScore('1234')).toBe(1234);
    expect(parseHighScore('007')).toBe(7);
    expect(parseHighScore(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('treats anything else as 0', () => {
    for (const bad of [
      null,
      '',
      ' 12',
      '12 ',
      '-5',
      '+5',
      '1e5',
      '1.5',
      '0x10',
      'NaN',
      'Infinity',
      '<img src=x onerror=alert(1)>',
      '9007199254740993', // past the largest safe integer
      '12345678901234567', // too many digits
      '١٢٣', // non-ASCII digits
    ]) {
      expect(parseHighScore(bad), String(bad)).toBe(0);
    }
  });
});

describe('formatHighScore', () => {
  it('writes digits only, and 0 for anything that is not a positive safe integer', () => {
    expect(formatHighScore(4560)).toBe('4560');
    expect(formatHighScore(0)).toBe('0');
    expect(formatHighScore(-1)).toBe('0');
    expect(formatHighScore(1.5)).toBe('0');
    expect(formatHighScore(Number.NaN)).toBe('0');
    expect(formatHighScore(2 ** 60)).toBe('0');
  });

  it('round-trips', () => {
    for (const n of [0, 1, 99, 123456, Number.MAX_SAFE_INTEGER]) {
      expect(parseHighScore(formatHighScore(n))).toBe(n);
    }
  });
});
