import { REDUCED_FLASH } from '../config/tuning';
import { formatReducedFlash, parseReducedFlash, reducedFlashOn } from '../logic/reducedFlash';

const deviceReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Whether flashing is reduced (M4.5, WW-08): the stored choice, validated, or
 * the device's setting when none is stored. An invalid stored value is
 * removed; storage that is blocked is ignored.
 */
export function loadReducedFlash(): boolean {
  let stored: boolean | null = null;
  try {
    const raw = window.localStorage.getItem(REDUCED_FLASH.storageKey);
    stored = parseReducedFlash(raw);
    if (raw !== null && stored === null) window.localStorage.removeItem(REDUCED_FLASH.storageKey);
  } catch {
    // Storage blocked: follow the device.
  }
  return reducedFlashOn(stored, deviceReducedMotion());
}

/** Stores the player's choice; it still applies for this visit if storage is blocked. */
export function storeReducedFlash(on: boolean): void {
  try {
    window.localStorage.setItem(REDUCED_FLASH.storageKey, formatReducedFlash(on));
  } catch {
    // Storage blocked (private mode, quota).
  }
}
