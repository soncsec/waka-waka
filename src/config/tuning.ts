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

/** The hero. Its speed is in the difficulty table below. */
export const HERO = {
  startDir: 'left',
  /** Mouth frames per second while moving. */
  chompHz: 14,
} as const;

/** The opponents (WW-02). Their maze speed is in the difficulty table; distances are in tiles. */
export const OPPONENTS = {
  /** Speed inside the ghost house, waiting and leaving. */
  houseSpeed: 3.5,
  /** Direction an opponent takes when it comes out of the door. */
  startDir: 'left',
  /** Gnash aims this far ahead of the hero. */
  gnashAhead: 3,
  /** Bolt pivots on the point this far ahead of the hero. */
  boltAhead: 3,
  /** Wisp gives up the chase when closer than this. */
  wispShyDistance: 6,
  /** Bolt and Wisp wait this far either side of the house centre. */
  houseSpacing: 2,
  /** How far waiting opponents bob up and down from the house centre. */
  bob: 0.5,
  /** Speed of an eaten opponent's eyes on their way back to the house. */
  eyesSpeed: 14,
} as const;

/**
 * Difficulty table (WW-07): one row per maze. Beyond the last row, the last row
 * repeats. M3.1 fills the rows up to the plateau around maze 20.
 */
export interface LevelRow {
  /** Hero speed in tiles per second. */
  heroSpeed: number;
  /** Opponent speed out in the maze, in tiles per second. */
  opponentSpeed: number;
  /** Dots eaten this life before each opponent may leave the house, in cast order. */
  releaseDots: readonly [number, number, number, number];
  /** Any waiting opponent leaves if the hero goes this long without eating, in seconds. */
  releaseIdleSeconds: number;
  /**
   * Scatter and chase phases in order, in seconds (WW-02). The last phase lasts
   * for ever. Every switch reverses the opponents out in the maze.
   */
  modes: readonly ModePhase[];
  /** How long a power pellet scares the opponents, in seconds; 0 only turns them around. */
  scaredSeconds: number;
  /** Speed of a scared opponent, in tiles per second. */
  scaredSpeed: number;
  /** Top speed of an opponent inside the wrap-around tunnel, in tiles per second (M2.4). */
  tunnelSpeed: number;
  /** Murk's Frenzy (WW-10, docs/SPECIAL-MOVES.md); null while it is off. */
  frenzy: FrenzyRow | null;
}

/** Frenzy: after `every` seconds of chase, a `tell` at `tellSpeed`, then `burst` seconds at `factor`. */
export interface FrenzyRow {
  every: number;
  tell: number;
  tellSpeed: number;
  burst: number;
  factor: number;
}

export interface ModePhase {
  mode: 'scatter' | 'chase';
  seconds: number;
}

export const LEVELS: readonly LevelRow[] = [
  {
    heroSpeed: 7.5,
    opponentSpeed: 7.0,
    releaseDots: [0, 0, 30, 60],
    releaseIdleSeconds: 4,
    modes: [
      { mode: 'scatter', seconds: 6 },
      { mode: 'chase', seconds: 22 },
      { mode: 'scatter', seconds: 6 },
      { mode: 'chase', seconds: 22 },
      { mode: 'scatter', seconds: 4 },
      { mode: 'chase', seconds: 25 },
      { mode: 'scatter', seconds: 4 },
      { mode: 'chase', seconds: Infinity },
    ],
    scaredSeconds: 6,
    scaredSpeed: 4.5,
    tunnelSpeed: 3.5,
    frenzy: { every: 20, tell: 1, tellSpeed: 0.5, burst: 3, factor: 1.3 },
  },
];

/** Round rules. Times are in seconds. */
export const ROUND = {
  lives: 3,
  /** "GET SET!" pause before play starts, and again after losing a life. */
  readySeconds: 2,
  /** Pause after being caught, before the next life or game over. */
  deathSeconds: 1.5,
  /** "MAZE CLEARED!" pause before the next maze. */
  clearedSeconds: 2,
  /** Caught when the hero and an opponent are closer than this, in tiles. */
  catchDistance: 0.5,
  /** Game over ignores input this long, so a last swipe doesn't restart at once. */
  restartDelay: 1,
  /** One extra life when the score first reaches this. */
  extraLifeAt: 12_000,
  /** Most lives a player can hold (the HUD has room for this many minus one). */
  maxLives: 5,
} as const;

/** Scared opponents flash for the last `flashSeconds` of the scare, `flashHz` times a second. */
export const SCARED_ART = {
  flashSeconds: 2,
  flashHz: 4,
} as const;

/** Opponent animation: body frames per second, and the bob up and down. */
export const OPPONENT_ART = {
  frames: 6,
  frameHz: 6,
  bobHz: 4,
  /** How much faster Murk's spikes spin during Frenzy (WW-10). */
  frenzySpin: 4,
} as const;

/** Points. */
export const SCORE = {
  dot: 10,
  pellet: 50,
  /** Points for each scared opponent eaten on one pellet, in order; the last repeats. */
  eaten: [100, 300, 700, 1500],
} as const;

/** High score (WW-08): the only thing kept in localStorage. */
export const HIGH_SCORE = {
  storageKey: 'waka-waka.highScore',
  /** Longest stored value accepted, in digits (Number.MAX_SAFE_INTEGER has 16). */
  maxDigits: 16,
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
  /** Scared opponents: body and face, then the flash colours near the end. */
  /** Scared ("short-circuited") opponents: a dark body, a pale edge and spark line;
   *  pink when the scare is about to end (M2.7: not Pac-Man's blue and white). */
  scared: 0x262a45,
  scaredFace: 0x9aa3d6,
  scaredFlash: 0x4a1640,
  scaredFlashFace: 0xff7ae0,
  /** Murk's Frenzy tell: white-hot spikes (WW-10). */
  frenzyHot: 0xfff0f4,
  /** An eaten opponent travels home as a spark. */
  sparkCore: 0xffffff,
  sparkRay: 0x7af7ff,
  eyeWhite: 0xffffff,
  pupil: 0x151040,
  gnashTeeth: 0xfff8e0,
  /** GET SET! and MAZE CLEARED! (M2.7: not Pac-Man's yellow READY!). */
  ready: '#ff7ae0',
  /** RUN ENDED (M2.7: not Pac-Man's red GAME OVER). */
  gameOver: '#ffb340',
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
