/**
 * The stored mute choice (M5.2, WW-08). Only exactly "1" (muted) or "0"
 * (sound on) is accepted; anything else counts as not set, and the caller
 * removes it. With nothing stored, sound is on.
 */
export function parseMuted(raw: string | null): boolean | null {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export function formatMuted(muted: boolean): '1' | '0' {
  return muted ? '1' : '0';
}
