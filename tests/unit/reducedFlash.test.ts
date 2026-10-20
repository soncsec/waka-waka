import { describe, expect, it } from 'vitest';
import {
  formatReducedFlash,
  parseReducedFlash,
  reducedFlashOn,
} from '../../src/logic/reducedFlash';

describe('reduced flash setting (M4.5, WW-08)', () => {
  it('reads only exactly "1" or "0"', () => {
    expect(parseReducedFlash('1')).toBe(true);
    expect(parseReducedFlash('0')).toBe(false);
  });

  it('treats anything else as not set', () => {
    for (const bad of [null, '', 'true', ' 1', '1 ', '01', '2', '<b>1</b>', 'on']) {
      expect(parseReducedFlash(bad), String(bad)).toBeNull();
    }
  });

  it('writes "1" or "0", which read back the same', () => {
    expect(parseReducedFlash(formatReducedFlash(true))).toBe(true);
    expect(parseReducedFlash(formatReducedFlash(false))).toBe(false);
  });

  it("follows the device until the player chooses; then the player's choice wins", () => {
    expect(reducedFlashOn(null, true)).toBe(true);
    expect(reducedFlashOn(null, false)).toBe(false);
    expect(reducedFlashOn(false, true)).toBe(false);
    expect(reducedFlashOn(true, false)).toBe(true);
  });
});
