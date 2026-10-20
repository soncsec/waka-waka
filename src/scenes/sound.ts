import type Phaser from 'phaser';
import { MUTE, SOUNDS, soundFiles, type SoundKey } from '../config/audio';
import { formatMuted, parseMuted } from '../logic/mute';

/**
 * Sound helpers (M5.2, WW-09). Sounds load once with the title screen and are
 * shared by both scenes through Phaser's global sound manager. Browsers only
 * allow sound after the player's first key press or tap; Phaser unlocks it then.
 */

/** The key that turns sound off and on, on the title and in the game. */
export const MUTE_KEY = 'KeyM';

/** How many times each sound has started, for the e2e test hook. */
export const soundLog: Partial<Record<SoundKey, number>> = {};

/**
 * Whether sound is off. Kept here rather than read back from Phaser, whose
 * `sound.mute` can report the old value until the audio engine applies it.
 */
let muted = false;

export function isMuted(): boolean {
  return muted;
}

function setMuted(scene: Phaser.Scene, value: boolean): void {
  muted = value;
  scene.sound.mute = value;
}

/** Queues every sound to load with the scene (only once per page). */
export function loadSounds(scene: Phaser.Scene): void {
  for (const key of Object.keys(SOUNDS) as SoundKey[]) {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, soundFiles(key));
  }
}

/** Plays a sound at its set volume; silent while muted or if it failed to load. */
export function play(scene: Phaser.Scene, key: SoundKey): void {
  if (muted || !scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: SOUNDS[key].volume });
  soundLog[key] = (soundLog[key] ?? 0) + 1;
}

/**
 * Applies the saved choice (WW-08): only "1" or "0" is accepted; anything else
 * is removed and sound stays on. Storage that is blocked is ignored.
 */
export function applySavedMute(scene: Phaser.Scene): void {
  let stored: boolean | null = null;
  try {
    const raw = window.localStorage.getItem(MUTE.storageKey);
    stored = parseMuted(raw);
    if (raw !== null && stored === null) window.localStorage.removeItem(MUTE.storageKey);
  } catch {
    // Storage blocked: sound on.
  }
  setMuted(scene, stored ?? false);
}

/** Turns sound on or off and saves the choice. Returns true when sound is now off. */
export function toggleMute(scene: Phaser.Scene): boolean {
  setMuted(scene, !muted);
  try {
    window.localStorage.setItem(MUTE.storageKey, formatMuted(muted));
  } catch {
    // Storage blocked (private mode, quota): the choice lasts for this visit.
  }
  return muted;
}
