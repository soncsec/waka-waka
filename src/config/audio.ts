/**
 * Sound manifest (M5.2, WW-09): every sound the game plays, built by
 * tools/audio/build_audio.py from the owner-approved CC0 packs (CREDITS.md).
 * Each sound ships as Ogg (most browsers) and M4A (iPhone Safari); Phaser
 * loads whichever the browser can play. The files all peak at the same level,
 * so these volumes (0 to 1) set the mix.
 */
export interface SoundSpec {
  volume: number;
}

export const AUDIO_DIR = 'assets/audio/';

export const SOUNDS = {
  /** Every dot, up to 7 or 8 a second, so it stays soft. */
  'sfx-dot': { volume: 0.2 },
  'sfx-pellet': { volume: 0.5 },
  /** A scared opponent eaten. */
  'sfx-eat': { volume: 0.5 },
  'sfx-battery': { volume: 0.5 },
  /** The hero caught, with the fizzle. */
  'sfx-caught': { volume: 0.6 },
  'sfx-life': { volume: 0.5 },
  /** Maze cleared. */
  'sfx-clear': { volume: 0.6 },
  /** GET SET!, at the start of each maze and life. */
  'sfx-ready': { volume: 0.4 },
  /** The run ended. */
  'sfx-over': { volume: 0.5 },
  'sfx-pause': { volume: 0.4 },
  'sfx-resume': { volume: 0.4 },
  /** A game starts, and title-screen buttons. */
  'sfx-start': { volume: 0.4 },
} as const satisfies Record<string, SoundSpec>;

export type SoundKey = keyof typeof SOUNDS;

/** The two files for a sound, in the order the browser should try them. */
export function soundFiles(key: SoundKey): string[] {
  return [`${AUDIO_DIR}${key}.ogg`, `${AUDIO_DIR}${key}.m4a`];
}

/** The saved mute choice (WW-08, WW-09 amendment): "1" muted or "0" sound on. */
export const MUTE = {
  storageKey: 'waka-waka.muted',
} as const;
