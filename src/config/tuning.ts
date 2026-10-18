/** All gameplay numbers live here so they can be tuned in one place. */
export const GAME_WIDTH = 256;
export const GAME_HEIGHT = 320;

/** The placeholder player: a box moved with the arrow keys or WASD. */
export const PLAYER = {
  size: 16,
  color: 0x2de2e6,
  /** Pixels per second. */
  speed: 120,
  /** Starting position as a fraction of the screen height. */
  startY: 0.85,
} as const;

/** Seed for the random number generator; override with ?seed= in the URL. */
export const DEFAULT_SEED = 1;

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
