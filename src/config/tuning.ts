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
  /** Bolt's Dash (WW-10); null while it is off. */
  dash: DashRow | null;
  /** Gnash's Lunge (WW-10); null while it is off. */
  lunge: LungeRow | null;
  /** Wisp's Phase (WW-10); null while it is off. */
  phase: PhaseRow | null;
  /** Points for eating the bonus battery on this maze (M3.3). */
  bonusPoints: number;
}

/**
 * Phase: when the hero is within `range` tiles, beyond a straight run of exactly
 * `wall` wall tiles, Wisp turns see-through for `tell` seconds, drifts through the
 * wall in `cross` seconds, and may not phase again for `cooldown` seconds.
 */
export interface PhaseRow {
  wall: number;
  range: number;
  tell: number;
  cross: number;
  cooldown: number;
}

/**
 * Lunge: when the hero is `minRange`..`maxRange` tiles straight ahead, Gnash stops
 * for `tell` seconds, jumps `jump` tiles at `factor` speed, and if it misses pauses
 * for `recover` seconds; it may not lunge again for `cooldown` seconds.
 */
export interface LungeRow {
  minRange: number;
  maxRange: number;
  tell: number;
  jump: number;
  factor: number;
  recover: number;
  cooldown: number;
}

/**
 * Dash: when the hero is in Bolt's straight corridor within `range` tiles, Bolt
 * stops for `tell` seconds, then shoots along the corridor at `factor` speed to
 * the next junction; it may not dash again for `cooldown` seconds.
 */
export interface DashRow {
  range: number;
  tell: number;
  factor: number;
  cooldown: number;
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

const MAZE_1: LevelRow = {
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
  dash: null,
  lunge: null,
  phase: null,
  bonusPoints: 250,
};

const DASH: DashRow = { range: 8, tell: 0.6, factor: 2.2, cooldown: 10 };

const MAZE_3: LevelRow = {
  ...MAZE_1,
  dash: DASH,
  lunge: { minRange: 2, maxRange: 3, tell: 0.5, jump: 2, factor: 3, recover: 0.5, cooldown: 8 },
};

export const LEVELS: readonly LevelRow[] = [
  MAZE_1,
  // Maze 2: Bolt's Dash switches on (PROJECT.md, WW-10).
  { ...MAZE_1, dash: DASH, bonusPoints: 500 },
  // Maze 3: Gnash's Lunge switches on.
  { ...MAZE_3, bonusPoints: 750 },
  { ...MAZE_3, bonusPoints: 1000 },
  // Maze 5: Wisp's Phase switches on.
  {
    ...MAZE_3,
    phase: { wall: 2, range: 4, tell: 1, cross: 0.8, cooldown: 12 },
    bonusPoints: 1500,
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

/** Special-move art (WW-10): Bolt's dotted aim line, and Gnash's head shake after a missed Lunge. */
export const DASH_ART = {
  dotSize: 3,
  /** Head shakes per second (one pixel each way). */
  shakeHz: 12,
} as const;

/** Wisp's Phase (WW-10): how see-through Wisp is, and the faint mark where it will come out. */
export const PHASE_ART = {
  alpha: 0.4,
  markAlpha: 0.3,
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

/**
 * The bonus battery (M3.3, not fruit per docs/ORIGINALITY.md): it appears on the
 * hero's start spot twice per maze, once each share of the maze's dots is eaten,
 * and stays for `seconds` of play. Its points are in the difficulty table.
 */
export const BONUS = {
  /** Share of the maze's dots and pellets eaten when each battery appears. */
  appearAt: [0.3, 0.7],
  seconds: 9,
  /** Eaten when the hero is closer than this, in tiles. */
  reach: 0.6,
} as const;

/** Bonus battery art: charge-bar steps per second (held full for reduced motion) and the points popup. */
export const BONUS_ART = {
  chargeHz: 3,
  popupSeconds: 1.5,
} as const;

/** High score (WW-08), kept in localStorage with the reduced-flash and mute settings. */
export const HIGH_SCORE = {
  storageKey: 'waka-waka.highScore',
  /** Longest stored value accepted, in digits (Number.MAX_SAFE_INTEGER has 16). */
  maxDigits: 16,
} as const;

/**
 * The title screen (M4.3): the cast page and the how-to-play page take turns,
 * like an arcade attract mode. Any key or tap starts a game.
 */
export const TITLE = {
  /** Seconds the cast page shows, then the help page, before the cycle repeats. */
  castSeconds: 7,
  helpSeconds: 8,
  /** The cast appears one row at a time (all at once for reduced motion). */
  revealSeconds: 0.6,
  /** Blinks per second of "PRESS A KEY OR TAP TO PLAY"; steady for reduced motion. */
  promptBlinkHz: 1,
  /** Keys and taps are ignored this long after the title appears, so the key that left a game doesn't start one. */
  inputDelay: 0.3,
  /** The WAKA-WAKA logo: Press Start 2P at 3 times its native size. */
  logoSize: 24,
  /** Rows of the bottom lines, in tiles above the bottom edge: the prompt, then the two setting buttons. */
  promptRow: 4.25,
  flashRow: 2.5,
  soundRow: 1,
  /** Rows of the cast page, then of the help page's points list, in pixels apart. */
  rowGap: 48,
  helpRowGap: 32,
  /** Space around the reduced-flash button's text (M4.5), so it is easier to tap. */
  buttonPadding: 6,
} as const;

/**
 * The reduced-flash setting (M4.5, WW-08): it follows the device's "reduce
 * motion" setting until the player changes it on the title screen; then the
 * choice is stored as "1" or "0".
 */
export const REDUCED_FLASH = {
  storageKey: 'waka-waka.reducedFlash',
} as const;

/**
 * The hero fizzles out when caught (M4.5): a short hold, then it shrinks in
 * steps while sparks crackle over it, then it bursts into a spark. The three
 * parts add up to ROUND.deathSeconds.
 */
export const DEATH_ART = {
  holdSeconds: 0.2,
  shrinkSeconds: 0.8,
  /** The hero's size at each step of the shrink, as a share of full size. */
  shrinkSteps: [1, 0.75, 0.5, 0.25],
  /** Crackle frames per second over the shrinking hero (off with reduced flash). */
  crackleHz: 10,
  /** The crackle's size, as a multiple of a tile: its rays reach past the hero. */
  crackleScale: 1.5,
  burstSeconds: 0.5,
  /** How big the final spark grows, as a multiple of a tile. */
  burstScale: 3,
} as const;

/** Touch controls (WW-06). */
export const SWIPE = {
  /** Distance in game pixels a finger must travel to count as a swipe. */
  minDistance: 10,
} as const;

/**
 * The floating joystick (M4.1, WW-06): it appears under a thumb that touches the
 * page outside the maze. Sizes are in CSS pixels.
 */
export const JOYSTICK = {
  /** How far the knob can move from the centre. */
  radius: 36,
  /** The thumb must move this far from where it landed before the hero turns. */
  deadZone: 10,
  /** Diameter of the knob. */
  knobSize: 36,
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
  /** The bonus battery (M3.3): case, charge bars and the + terminal. */
  battery: 0x6dff7a,
  batteryCharge: 0xd8ff4a,
  batteryCap: 0xffffff,
  eyeWhite: 0xffffff,
  pupil: 0x151040,
  gnashTeeth: 0xfff8e0,
  /** GET SET! and MAZE CLEARED! (M2.7: not Pac-Man's yellow READY!). */
  ready: '#ff7ae0',
  /** RUN ENDED (M2.7: not Pac-Man's red GAME OVER). */
  gameOver: '#ffb340',
  hud: '#2ef2c8',
  hudDim: '#7a6fb8',
  /** The HUD's speaker (M5.2): the HUD colours, with sound on and muted. */
  speaker: 0x2ef2c8,
  speakerMuted: 0x7a6fb8,
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

/**
 * The tap target round the HUD speaker (M5.2), in pixels: this far either side of
 * it, from the bottom edge up through the HUD row and the maze's bottom wall.
 */
export const SPEAKER_HIT = {
  halfWidth: 24,
  height: 32,
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
