import { describe, expect, it } from 'vitest';
import { formatMuted, parseMuted } from '../../src/logic/mute';

describe('mute setting (M5.2, WW-08)', () => {
  it('reads only exactly "1" or "0"', () => {
    expect(parseMuted('1')).toBe(true);
    expect(parseMuted('0')).toBe(false);
  });

  it('treats anything else as not set', () => {
    for (const bad of [null, '', 'true', ' 1', '1 ', '01', '2', '<b>1</b>', 'muted']) {
      expect(parseMuted(bad), String(bad)).toBeNull();
    }
  });

  it('writes "1" or "0", which read back the same', () => {
    expect(parseMuted(formatMuted(true))).toBe(true);
    expect(parseMuted(formatMuted(false))).toBe(false);
  });
});
