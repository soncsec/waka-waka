/** All gameplay numbers live here so they can be tuned in one place. */

/** Size of one maze tile in pixels. */
export const TILE_SIZE = 16;
/** Height of the HUD bar above and below the maze. */
export const HUD_HEIGHT = 16;
/** Logical game size (WW-05): the 24 x 27 tile maze plus a HUD bar above and below. */
export const GAME_WIDTH = 24 * TILE_SIZE;
export const GAME_HEIGHT = 27 * TILE_SIZE + 2 * HUD_HEIGHT;

/** Simulation steps per second (WW-01): the game rules always advance in steps of 1/60 s. */
export const STEP_HZ = 60;
/** Most simulation steps run in one frame, so a stalled tab doesn't fast-forward. */
export const MAX_STEPS_PER_FRAME = 5;

/** The hero. Speeds are in tiles per second. */
export const HERO = {
  speed: 7.5,
  startDir: 'left',
  /** Mouth frames per second while moving. */
  chompHz: 14,
} as const;

/** Murk, the first opponent (WW-02). Speeds are in tiles per second. */
export const MURK = {
  speed: 7.0,
  startDir: 'left',
} as const;

/** Round rules. Times are in seconds. */
export const ROUND = {
  lives: 3,
  /** "READY!" pause before play starts, and again after losing a life. */
  readySeconds: 2,
  /** Pause after being caught, before the next life or game over. */
  deathSeconds: 1.5,
  /** "MAZE CLEARED!" pause before the next maze. */
  clearedSeconds: 2,
  /** Caught when the hero and an opponent are closer than this, in tiles. */
  catchDistance: 0.5,
  /** Game over ignores input this long, so a last swipe doesn't restart at once. */
  restartDelay: 1,
} as const;

/** Opponent animation: body frames per second, and the bob up and down. */
export const OPPONENT_ART = {
  frames: 6,
  frameHz: 6,
  bobHz: 4,
} as const;

/** Points. */
export const SCORE = {
  dot: 10,
  pellet: 50,
} as const;

/** Touch controls (WW-06). */
export const SWIPE = {
  /** Distance in game pixels a finger must travel to count as a swipe. */
  minDistance: 10,
} as const;

/** Look B, "Neon Arcade" (WW-04). */
export const NEON = {
  background: 0x07051a,
  /** Inside of thick walls. */
  wallFill: 0x140a33,
  /** The bright outline of every wall. */
  wallLine: 0xff3df2,
  /** Soft glow between the outline and the corridor. */
  wallGlow: 0x5a1a7a,
  door: 0xffb3f5,
  dot: 0xffe8a3,
  pellet: 0xff3df2,
  pelletCore: 0xffffff,
  hero: 0x2ef2c8,
  heroShade: 0x13b48f,
  heroTeeth: 0xffffff,
  heroEye: 0x0b0820,
  /** Opponent bodies: Murk, Gnash, Bolt, Wisp. */
  opponents: [0xff4d7e, 0xff9f1c, 0xffe14d, 0xb28dff],
  opponentOutline: 0x0b0820,
  eyeWhite: 0xffffff,
  pupil: 0x151040,
  gnashTeeth: 0xfff8e0,
  ready: '#ffe14d',
  gameOver: '#ff4d7e',
  hud: '#2ef2c8',
  hudDim: '#7a6fb8',
} as const;

/**
 * Wall drawing, in pixels from the nearest corridor pixel (WW-04).
 * Pixels nearer than `glowFrom` are corridor, then glow, then the outline at
 * `lineAt`, then glow again until `fillFrom`, then fill. Corners round off at `radius`.
 */
export const WALL_ART = {
  radius: 7,
  glowFrom: 3.6,
  lineAt: 5,
  fillFrom: 6.5,
  /** Height of the door bar, centred in the door tile. */
  doorThickness: 2,
} as const;

/** Dots and power pellets. */
export const PICKUP_ART = {
  dotSize: 2,
  /** Power pellet size in pixels (a rounded square with a bright core). */
  pelletSize: 10,
  /** Blinks per second; held steady when the player prefers reduced motion. */
  pelletBlinkHz: 2,
} as const;

/** HUD text: Press Start 2P drawn at 8 px, its native size. */
export const HUD = {
  font: '"Press Start 2P"',
  fontSize: 8,
  /** Gap from the screen edge in pixels. */
  margin: 4,
} as const;

/**
 * Maze generation (WW-03). The maze is a lattice of corridor nodes `pitch` tiles
 * apart: corridors are 1 tile wide and walls at least 2 tiles thick.
 * Grid size = pitch * (cols - 1) + 3 by pitch * (rows - 1) + 3 tiles (24 x 27).
 */
export const MAZE = {
  /** Lattice size in nodes. */
  cols: 8,
  rows: 9,
  /** Tiles between neighbouring nodes. */
  pitch: 3,
  /** Ghost house: lattice rectangle (inclusive), door in the top centre. */
  house: { col0: 2, col1: 5, row0: 3, row1: 5 },
  /** Lattice row of the wrap-around tunnel. */
  tunnelRow: 4,
  /** Lattice row of the hero's start corridor. */
  startRow: 6,
  /** Share of corridor segments to close, picked per maze in [min, max). */
  closeRatioMin: 0.36,
  closeRatioMax: 0.48,
  /** Chance that closing a segment may leave a node with no corridors (a solid block). */
  solidChance: 0.35,
  /** Longest chain of corner nodes, in segments (3 segments = 8 tiles with no turn-off). */
  maxChainSegments: 3,
  /** Owner's rule: no stretch longer than this many tiles without a turn-off, counted around corners. */
  maxStretchTiles: 10,
  /** Power pellets per maze, one near each corner. */
  pellets: 4,
  /** Generation attempts before the built-in fallback maze is used. */
  maxAttempts: 20,
} as const;
