/**
 * The stored reduced-flash choice (M4.5, WW-08). Only exactly "1" (on) or "0"
 * (off) is accepted; anything else counts as not set, and the caller removes it.
 */
export function parseReducedFlash(raw: string | null): boolean | null {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export function formatReducedFlash(on: boolean): '1' | '0' {
  return on ? '1' : '0';
}

/** The player's choice wins; with none stored, the device's "reduce motion" setting decides. */
export function reducedFlashOn(stored: boolean | null, deviceReducedMotion: boolean): boolean {
  return stored ?? deviceReducedMotion;
}
